import type { WSContext } from 'hono/ws';
import type { ServerWebSocket } from 'bun';
import type {
	GameState,
	SanitizedGameState,
	MaskedCard,
	Card,
	ClientMessage,
	ServerMessage
} from 'shared';
import {
	createDeck,
	shuffle,
	deckFromString,
	orderSkitgubbeLast,
	HIDDEN_CARD_VALUE,
	makeInitialState
} from 'shared';
import { dbOps } from './db.js';
import { replayGame } from './gameReplay.js';
import {
	applyStartGame,
	applyPlayCards,
	applyPickUp,
	applyChance,
	applySprinkle,
	applyJoin,
	applyDecline,
	applyClearTrick,
	resetToFreshGame,
	canPlayCards,
	canPickUp,
	canChance,
	canSprinkle
} from './gameLogic.js';
import { sendGameEndedNotification, sendTurnNotification } from './notifications.js';

// The socket hono's Bun adapter hands to WS event handlers. `raw` is the
// underlying Bun socket — stable per connection, unlike the WSContext wrapper,
// so it is what identity maps must key on.
export type GameSocket = WSContext<ServerWebSocket>;

const maskedCardCache = new Map<string, MaskedCard>();
function getMaskedCard(id: string): MaskedCard {
	let card = maskedCardCache.get(id);
	if (!card) {
		card = { id, value: HIDDEN_CARD_VALUE, suit: '♠', suitName: 'spades', color: 'black' };
		maskedCardCache.set(id, card);
	}
	return card;
}

const maskedArrayCache = new Map<string, MaskedCard[]>();
function getMaskedArray(prefix: string, length: number): MaskedCard[] {
	const key = `${prefix}:${length}`;
	let arr = maskedArrayCache.get(key);
	if (!arr) {
		arr = Array.from({ length }, (_, idx) => getMaskedCard(`${prefix}-${idx}`));
		maskedArrayCache.set(key, arr);
	}
	return arr;
}

export class GameRoom {
	roomId: string;
	state: GameState;
	clients: Set<GameSocket> = new Set(); // WS connections
	playerSockets: Map<string, GameSocket> = new Map(); // playerId -> WS connection
	private socketProfiles: Map<ServerWebSocket, string> = new Map(); // raw socket -> session-verified profileId
	private cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
	private trickCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
	private disposed = false;
	// Keyed on the raw socket: hono's Bun adapter wraps the same connection in
	// a fresh WSContext per event, so wrapper-keyed state never survives from
	// one message to the next.
	private chatLimiters = new WeakMap<ServerWebSocket, { tokens: number; lastRefill: number }>();
	private lastKnownStatus: 'waiting' | 'playing' | 'ended' | null = null;
	private lastActivePlayerId: string | null = null;
	private gameName: string | undefined = undefined;
	private socketPlayerIds: Map<ServerWebSocket, string> = new Map();
	private stateHistory: GameState[] = [];

	// Cancel all timers and mark the room dead. A disposed room must never
	// write moves again — a replacement GameRoom may already be replaying the
	// same game, and a stray timer would race it on UNIQUE(game_id, seq).
	dispose() {
		this.disposed = true;
		this.cancelCleanup();
		this.cancelTrickCleanup();
	}

	private cancelTrickCleanup() {
		if (this.trickCleanupTimeout) {
			clearTimeout(this.trickCleanupTimeout);
			this.trickCleanupTimeout = null;
		}
	}

	syncGameStatusToDb() {
		const activePlayer = this.state.players[this.state.activePlayerIdx];
		const activePlayerId =
			this.state.status === 'ended' ? null : activePlayer ? activePlayer.id : null;

		const wasEnded = this.lastKnownStatus === 'ended';
		const prevActivePlayerId = this.lastActivePlayerId;

		// Only write to DB if the status or active player changed in memory
		if (this.state.status !== this.lastKnownStatus || activePlayerId !== this.lastActivePlayerId) {
			dbOps.updateGameStatus(this.roomId, this.state.status, activePlayerId);
			this.lastKnownStatus = this.state.status;
			this.lastActivePlayerId = activePlayerId;
		}

		if (this.state.status === 'ended' && !wasEnded) {
			dbOps.recordGameResults(this.roomId, this.state);

			// Tell everyone the game is over (the SW suppresses the notification
			// for players who have the app focused).
			const skitgubbe = this.state.players.find((p) => p.isSkitgubbe) ?? null;
			const recipients = this.state.players
				.filter((p) => p.inviteStatus === 'accepted' && !p.hasLeft)
				.map((p) => p.id);
			sendGameEndedNotification(
				this.roomId,
				recipients,
				skitgubbe?.name ?? null,
				this.gameName
			).catch((err) => {
				console.error('Unhandled error in sendGameEndedNotification promise:', err);
			});
		}

		// Send push notification if the turn shifted to a new human player
		if (
			this.state.status === 'playing' &&
			activePlayerId &&
			activePlayerId !== prevActivePlayerId &&
			activePlayer &&
			!activePlayer.hasLeft
		) {
			sendTurnNotification(this.roomId, activePlayerId, this.gameName).catch((err) => {
				console.error('Unhandled error in sendTurnNotification promise:', err);
			});
		}
	}

	// The move-commit ritual (architecture.md invariant 6) in one place:
	// seq-compute → saveMove → apply → syncGameStatusToDb → schedule a trick
	// cleanup if the move completed a trick → broadcastState, synchronously
	// (Bun's single thread is what makes MAX(seq)+1 safe). Keeps `state.seq`
	// authoritative for sanitization/broadcast.
	private commitMove(
		playerId: string,
		type: 'P' | 'U' | 'C' | 'R' | 'A' | 'L' | 'T',
		cards: Card[] | undefined,
		apply: () => void,
		opts: { broadcast?: boolean } = {}
	) {
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, type, cards);

		const trickWasPending = this.state.trickWinnerId !== null;
		apply();
		this.state.seq = seq + 1;

		this.syncGameStatusToDb();
		this.pushStateHistory(this.state);

		if (this.state.status === 'playing' && this.state.trickWinnerId !== null && !trickWasPending) {
			this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
		}

		if (opts.broadcast !== false) {
			this.broadcastState();
		}
	}

	private setActivePlayerIdx(idx: number) {
		this.state.activePlayerIdx = idx;
		this.syncGameStatusToDb();
	}

	private shuffleAndOrderPlayers() {
		const globalSkitgubbe = dbOps.getCurrentGlobalSkitgubbe();
		const acceptedPlayers = this.state.players.filter((p) => p.inviteStatus === 'accepted');
		const otherPlayers = this.state.players.filter((p) => p.inviteStatus !== 'accepted');

		const shuffledAccepted = shuffle(acceptedPlayers);
		const orderedAccepted = orderSkitgubbeLast(shuffledAccepted, globalSkitgubbe?.id, (p) => p.id);

		const orderedPlayers = [...orderedAccepted, ...otherPlayers];
		this.state.players = orderedPlayers;

		// Save turn order in DB
		for (let i = 0; i < orderedPlayers.length; i++) {
			dbOps.updatePlayerTurnOrder(this.roomId, orderedPlayers[i].id, i);
		}
	}

	constructor(roomId: string) {
		this.roomId = roomId;

		// Load initial details from Database
		const dbGame = dbOps.getGame(roomId);
		this.gameName = dbGame?.name ?? undefined;
		this.lastKnownStatus = dbGame?.status ?? null;
		this.lastActivePlayerId = dbGame?.active_player_id ?? null;
		const dbPlayers = dbOps.getGamePlayers(roomId);

		// Games are created directly in 'playing' with an initial deck
		// (the legacy waiting-lobby flow is gone), so state is always the
		// replay of the move log. A missing deck (corrupt/legacy row) replays
		// an empty move log into an inert pre-start state.
		const initialDeckStr = dbGame ? dbGame.initial_deck : null;
		const initialDeck = initialDeckStr ? deckFromString(initialDeckStr) : [];
		const moves = dbOps.getGameMoves(roomId);

		// Populate history with the last few states from the initial replay
		const maxHistoryLength = 15;
		const historyList: GameState[] = [];
		this.state = replayGame(roomId, dbPlayers, initialDeck, moves, (state) => {
			historyList.push(structuredClone(state));
			if (historyList.length > maxHistoryLength) {
				historyList.shift();
			}
		});
		this.stateHistory = historyList;

		if (this.state.status === 'playing' && this.state.trickWinnerId !== null) {
			// Re-schedule trick resolution timeout if reloading a pending trick
			this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
		}
	}

	scheduleTrickCleanupTimeout(winnerId: string) {
		if (this.disposed) return;
		this.cancelTrickCleanup();
		const delay = this.state.phase === 1 ? 1000 : 500;
		this.trickCleanupTimeout = setTimeout(() => {
			this.trickCleanupTimeout = null;
			try {
				if (
					!this.disposed &&
					this.state.status === 'playing' &&
					this.state.trickWinnerId === winnerId
				) {
					this.commitMove(winnerId, 'T', undefined, () => applyClearTrick(this.state));
				}
			} catch (e) {
				console.error(`Error in trick cleanup timer for room ${this.roomId}:`, e);
			}
		}, delay);
	}

	addClient(ws: GameSocket, profileId?: string) {
		if (!ws) return;
		this.cancelCleanup();
		this.clients.add(ws);
		// Bind the session-verified identity to the physical socket. All
		// privileged actions resolve identity from here, never from the client.
		if (profileId && ws.raw) {
			this.socketProfiles.set(ws.raw, profileId);
		}
		// Send initial state update immediately to the newly connected client
		this.sendStateToClient(ws);
	}

	removeClient(ws: GameSocket) {
		if (!ws || !ws.raw) return;
		const rawWs = ws.raw;
		// Delete the client wrapper matching this raw socket
		for (const client of this.clients) {
			if (client && client.raw === rawWs) {
				this.clients.delete(client);
				break;
			}
		}

		// Find if this socket belonged to a player
		const ownerId = this.socketOwner(ws);
		if (ownerId) {
			const player = this.state.players.find((p) => p.id === ownerId);
			if (player) {
				this.log(`${player.name} kopplades bort.`);
			}
			this.playerSockets.delete(ownerId);
		}

		this.socketPlayerIds.delete(rawWs);
		this.socketProfiles.delete(rawWs);

		// If the room has no players left, we broadcast to anyone else (like spectators)
		this.broadcastState();
	}

	handleMessage(ws: GameSocket, data: string) {
		try {
			const msg: ClientMessage = JSON.parse(data);

			// Guard against debug/dev actions if not allowed
			const allowDev = process.env.PUBLIC_ALLOW_DEV_SETTINGS === 'true';
			if (!allowDev) {
				if (msg.type === 'debugSkipToPhase2' || msg.type === 'debugForceLose') {
					ws.send(
						JSON.stringify({ type: 'error', message: 'Development/debug settings are disabled.' })
					);
					return;
				}
				if ('debugForce' in msg && msg.debugForce) {
					msg.debugForce = undefined;
				}
			}

			if (msg.type === 'join') {
				// Identity is the session-verified profileId bound at socket
				// upgrade — the client-asserted playerId/name/color are ignored.
				const profileId = this.getAuthedProfileId(ws);
				if (!profileId) {
					ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized.' }));
					return;
				}
				this.handleJoin(ws, profileId, msg.lastSeq);
				return;
			}

			const playerId = this.socketOwner(ws);
			if (!playerId) {
				ws.send(JSON.stringify({ type: 'error', message: 'Not joined to this room.' }));
				return;
			}

			switch (msg.type) {
				case 'playCards':
					this.handlePlayCards(ws, playerId, msg.cardIds, msg.debugForce);
					break;
				case 'pickUp':
					this.handlePickUp(ws, playerId, msg.debugForce);
					break;
				case 'chance':
					this.handleChance(ws, playerId, msg.debugForce);
					break;
				case 'sprinkle':
					this.handleSprinkle(ws, playerId, msg.cardIds);
					break;
				case 'resetGame':
					this.handleResetGame(ws, playerId);
					break;
				case 'debugSkipToPhase2':
					this.handleDebugSkipToPhase2(ws, playerId);
					break;
				case 'debugForceLose':
					this.handleDebugForceLose(ws, playerId);
					break;
				case 'chat':
					this.handleChat(ws, playerId, msg.message, msg.emote);
					break;
			}
		} catch (e) {
			console.error('Error handling websocket message:', e);
			ws.send(JSON.stringify({ type: 'error', message: 'Failed to process move.' }));
		}
	}

	// The playerId that owns this physical socket. Compares raw sockets because
	// hono may hand the same connection to different handlers wrapped in
	// different WSContext objects.
	private socketOwner(ws: GameSocket): string | null {
		if (!ws || !ws.raw) return null;
		return this.socketPlayerIds.get(ws.raw) ?? null;
	}

	// The session-verified identity bound to this socket at upgrade time.
	private getAuthedProfileId(ws: GameSocket): string | null {
		if (!ws || !ws.raw) return null;
		return this.socketProfiles.get(ws.raw) ?? null;
	}

	private log(message: string) {
		this.state.logs.push(message);
		if (this.state.logs.length > 80) {
			this.state.logs.shift();
		}
	}

	private sendStateToClient(ws: GameSocket) {
		if (!ws) return;
		const matchingPlayerId = this.socketOwner(ws) || '';
		try {
			ws.send(
				JSON.stringify({
					type: 'stateUpdate',
					state: this.getSanitizedState(ws),
					yourPlayerId: matchingPlayerId
				})
			);
		} catch (e) {
			console.error('Error sending state to client:', e);
		}
	}

	private getSanitizedState(ws: GameSocket): SanitizedGameState {
		const activePlayerId = this.socketOwner(ws) || '';
		return this.getSanitizedStateForPlayerId(activePlayerId, this.state);
	}

	private getSanitizedStateForPlayerId(
		activePlayerId: string,
		state: GameState
	): SanitizedGameState {
		const players = state.players.map((player) => {
			const isOnline = this.playerSockets.has(player.id);
			const isSelf = player.id === activePlayerId;
			const shouldMask = state.status !== 'ended' || !player.isSkitgubbe;

			if (isSelf) {
				return {
					...player,
					isOnline,
					hand: player.hand.map((c) => ({ ...c })),
					reserveStack: player.reserveStack.map((c) => ({ ...c }))
				};
			} else if (shouldMask) {
				return {
					...player,
					isOnline,
					hand: getMaskedArray(`hidden-hand-${player.id}`, player.hand.length),
					reserveStack: getMaskedArray(`hidden-reserve-${player.id}`, player.reserveStack.length)
				};
			} else {
				return {
					...player,
					isOnline,
					hand: player.hand.map((c) => ({ ...c })),
					reserveStack: player.reserveStack.map((c) => ({ ...c }))
				};
			}
		});

		const sanitized: SanitizedGameState = {
			status: state.status,
			phase: state.phase,
			activePlayerIdx: state.activePlayerIdx,
			players,
			deck: getMaskedArray('hidden-deck', state.deck ? state.deck.length : 0),
			tablePile: state.tablePile ? state.tablePile.map((pile) => pile.map((c) => ({ ...c }))) : [],
			tablePilePlayers: state.tablePilePlayers ? [...state.tablePilePlayers] : [],
			discardPile: getMaskedArray(
				'hidden-discard',
				state.discardPile ? state.discardPile.length : 0
			),
			trumpCard: state.trumpCard ? { ...state.trumpCard } : null,
			hiddenTrumpStorage: state.hiddenTrumpStorage
				? {
						playerId: state.hiddenTrumpStorage.playerId,
						card: getMaskedCard('hidden-trump')
					}
				: null,
			logs: state.logs ? [...state.logs] : [],
			tieBreakerActive: state.tieBreakerActive,
			tiedPlayerIds: state.tiedPlayerIds ? [...state.tiedPlayerIds] : [],
			tieBreakerStartPileSize: state.tieBreakerStartPileSize,
			trickWinnerId: state.trickWinnerId,
			lastChanceCardId: state.lastChanceCardId,
			seq: state.seq ?? 0
		};

		return sanitized;
	}

	private getSanitizedStatesRange(
		playerId: string,
		startSeq: number,
		endSeq: number
	): SanitizedGameState[] {
		const allInHistory =
			this.stateHistory.length > 0 &&
			this.stateHistory[0].seq <= startSeq &&
			this.stateHistory[this.stateHistory.length - 1].seq >= endSeq;

		if (allInHistory) {
			const states: SanitizedGameState[] = [];
			for (let seq = startSeq; seq <= endSeq; seq++) {
				const histState = this.stateHistory.find((s) => s.seq === seq);
				if (histState) {
					states.push(this.getSanitizedStateForPlayerId(playerId, histState));
				}
			}
			if (states.length === endSeq - startSeq + 1) {
				return states;
			}
		}

		const dbPlayers = dbOps.getGamePlayers(this.roomId);
		const dbGame = dbOps.getGame(this.roomId);
		if (!dbGame || !dbGame.initial_deck) {
			const fallbackState = this.getSanitizedStateForPlayerId(playerId, this.state);
			const states: SanitizedGameState[] = [];
			for (let s = startSeq; s <= endSeq; s++) {
				states.push({ ...fallbackState, seq: s });
			}
			return states;
		}

		const initialDeck = deckFromString(dbGame.initial_deck);
		const moves = dbOps.getGameMoves(this.roomId);

		// One fold shared with crash recovery — snapshot the states in range.
		const states: SanitizedGameState[] = [];
		const finalState = replayGame(this.roomId, dbPlayers, initialDeck, moves, (state) => {
			const seq = state.seq ?? 0;
			if (seq >= startSeq && seq <= endSeq) {
				states.push(this.getSanitizedStateForPlayerId(playerId, state));
			}
		});

		while (states.length < endSeq - startSeq + 1) {
			const currentFillSeq = startSeq + states.length;
			states.push(
				this.getSanitizedStateForPlayerId(playerId, { ...finalState, seq: currentFillSeq })
			);
		}

		return states;
	}

	private pushStateHistory(state: GameState) {
		const cloned = structuredClone(state);
		if (
			this.stateHistory.length > 0 &&
			this.stateHistory[this.stateHistory.length - 1].seq === cloned.seq
		) {
			this.stateHistory[this.stateHistory.length - 1] = cloned;
		} else {
			this.stateHistory.push(cloned);
			if (this.stateHistory.length > 15) {
				this.stateHistory.shift();
			}
		}
	}

	scheduleCleanup(onCleanup: () => void, delayMs: number) {
		this.cancelCleanup();
		if (this.disposed) return;
		this.cleanupTimeout = setTimeout(() => {
			this.cleanupTimeout = null;
			try {
				if (!this.disposed) onCleanup();
			} catch (e) {
				console.error(`Error in cleanup timer for room ${this.roomId}:`, e);
			}
		}, delayMs);
	}

	cancelCleanup() {
		if (this.cleanupTimeout) {
			clearTimeout(this.cleanupTimeout);
			this.cleanupTimeout = null;
		}
	}

	broadcastState(excludeWs?: GameSocket) {
		const cache = new Map<string, string>(); // playerId -> JSON string
		this.clients.forEach((ws) => {
			if (excludeWs && ws.raw === excludeWs.raw) return;
			try {
				const playerId = this.socketOwner(ws) || '';
				let messageStr = cache.get(playerId);
				if (!messageStr) {
					const sanitized = this.getSanitizedState(ws);
					messageStr = JSON.stringify({
						type: 'stateUpdate',
						state: sanitized,
						yourPlayerId: playerId
					});
					cache.set(playerId, messageStr);
				}
				ws.send(messageStr);
			} catch (e) {
				console.error('Error broadcasting to client:', e);
			}
		});
	}

	private handleChat(ws: GameSocket, playerId: string, message?: string, emote?: string) {
		if (!ws.raw) return;
		// Retrieve or create rate limiter bucket
		let limiter = this.chatLimiters.get(ws.raw);
		const now = Date.now();
		if (!limiter) {
			limiter = { tokens: 5, lastRefill: now };
			this.chatLimiters.set(ws.raw, limiter);
		} else {
			const elapsedSeconds = (now - limiter.lastRefill) / 1000;
			limiter.tokens = Math.min(5, limiter.tokens + elapsedSeconds * 0.5);
			limiter.lastRefill = now;
		}

		if (limiter.tokens < 1) {
			ws.send(JSON.stringify({ type: 'error', message: 'Chat rate limit exceeded. Please wait.' }));
			return;
		}
		limiter.tokens -= 1;

		let sanitizedMessage = typeof message === 'string' ? message.trim() : null;
		if (sanitizedMessage === '') {
			sanitizedMessage = null;
		}
		if (sanitizedMessage && sanitizedMessage.length > 200) {
			sanitizedMessage = sanitizedMessage.substring(0, 200);
		}

		let sanitizedEmote = typeof emote === 'string' ? emote.trim() : null;
		if (sanitizedEmote === '') {
			sanitizedEmote = null;
		}
		if (sanitizedEmote && sanitizedEmote.length > 20) {
			sanitizedEmote = sanitizedEmote.substring(0, 20);
		}

		if (!sanitizedMessage && !sanitizedEmote) return;

		// Get current game sequence number
		const currentSeq = this.state.seq ?? dbOps.getNextMoveSeq(this.roomId);

		// Save chat to database
		const saved = dbOps.saveChat(
			this.roomId,
			playerId,
			sanitizedMessage,
			sanitizedEmote,
			currentSeq
		);

		// Broadcast message to all active clients in the room
		const chatMsg: ServerMessage = {
			type: 'chatMessage',
			id: saved.id,
			playerId: playerId,
			message: sanitizedMessage || undefined,
			emote: sanitizedEmote || undefined,
			seq: currentSeq,
			createdAt: saved.created_at
		};

		this.clients.forEach((client) => {
			try {
				client.send(JSON.stringify(chatMsg));
			} catch (e) {
				console.error('Error sending chat message:', e);
			}
		});
	}

	private handleJoin(ws: GameSocket, playerId: string, lastSeq?: number) {
		// Clean up old socket association if this player has another active connection
		const oldSocket = this.playerSockets.get(playerId);
		if (oldSocket && oldSocket.raw !== ws.raw) {
			for (const client of this.clients) {
				if (client.raw === oldSocket.raw) {
					this.clients.delete(client);
					break;
				}
			}
			try {
				oldSocket.close();
			} catch (e) {}
			if (oldSocket.raw) {
				this.socketPlayerIds.delete(oldSocket.raw);
			}
		}

		// Clean up any old association for this physical socket under a different playerId
		const previousOwner = this.socketOwner(ws);
		if (previousOwner && previousOwner !== playerId) {
			this.playerSockets.delete(previousOwner);
		}

		const existingPlayer = this.state.players.find((p) => p.id === playerId);
		const acceptedPlayers = this.state.players.filter((p) => p.inviteStatus === 'accepted');

		// Only pending invitees generate an accept move — anyone not in the
		// roster connects as a spectator (the legacy waiting-lobby join is gone).
		const isPendingAccept = !!existingPlayer && existingPlayer.inviteStatus === 'pending';
		if (isPendingAccept && acceptedPlayers.length >= 10) {
			ws.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
			return;
		}

		// Name/color/avatar always come from the DB profile, never the client.
		const dbProfile = dbOps.getProfileById(playerId);
		const name = dbProfile?.name || 'Unknown';
		const color = dbProfile?.color || '#3b82f6';

		const applyJoinWithProfile = () => {
			applyJoin(this.state, playerId, name, color);
			const joinedPlayer = this.state.players.find((p) => p.id === playerId);
			if (joinedPlayer && dbProfile?.avatar_config) {
				joinedPlayer.avatarConfig = dbProfile.avatar_config;
			}
		};

		if (isPendingAccept) {
			// Persist the join to database
			dbOps.joinGame(this.roomId, playerId);
			// handleJoin does its own broadcast/replay below
			this.commitMove(playerId, 'A', undefined, applyJoinWithProfile, { broadcast: false });
		} else {
			// Reconnection or spectator — no move is written
			applyJoinWithProfile();
		}
		this.playerSockets.set(playerId, ws);
		if (ws.raw) {
			this.socketPlayerIds.set(ws.raw, playerId);
		}

		// Send chat history to the newly connected client
		const chats = dbOps.getGameChats(this.roomId);
		try {
			ws.send(
				JSON.stringify({
					type: 'chatHistory',
					messages: chats.map((c) => ({
						id: c.id,
						playerId: c.player_id,
						message: c.message || undefined,
						emote: c.emote || undefined,
						seq: c.seq,
						createdAt: c.created_at
					}))
				})
			);
		} catch (e) {
			console.error('Error sending chat history to client:', e);
		}

		// Check if we should send a replay or normal update to the newly joined player
		const currentSeq = this.state.seq ?? 0;
		if (lastSeq !== undefined && lastSeq < currentSeq && this.state.status === 'playing') {
			let startSeq = lastSeq;
			if (currentSeq - startSeq > 10) {
				startSeq = currentSeq - 10;
			}
			const states = this.getSanitizedStatesRange(playerId, startSeq, currentSeq);

			// Broadcast latest state to everyone ELSE
			this.broadcastState(ws);

			// Send replay to THIS client
			try {
				ws.send(
					JSON.stringify({
						type: 'replay',
						states,
						yourPlayerId: playerId
					})
				);
			} catch (e) {
				console.error('Error sending replay to client:', e);
			}
		} else {
			// Broadcast to everyone including this client
			this.broadcastState();
		}
	}

	private handlePlayCards(
		ws: GameSocket,
		playerId: string,
		cardIds: string[],
		debugForce?: boolean
	) {
		const check = canPlayCards(this.state, playerId, cardIds, debugForce);
		if (!check.ok) {
			ws.send(JSON.stringify({ type: 'error', message: check.reason }));
			return;
		}

		this.commitMove(playerId, 'P', check.cards, () =>
			applyPlayCards(this.state, playerId, cardIds, debugForce)
		);
	}

	private handlePickUp(ws: GameSocket, playerId: string, debugForce?: boolean) {
		if (!canPickUp(this.state, playerId, debugForce)) {
			return;
		}

		this.commitMove(playerId, 'U', undefined, () => applyPickUp(this.state, playerId, debugForce));
	}

	private handleChance(ws: GameSocket, playerId: string, debugForce?: boolean) {
		if (!canChance(this.state, playerId, debugForce)) {
			return;
		}

		// The last deck card must become the hidden trump (set when it's drawn as
		// a replacement) — chancing it would leave phase 2 without a trump suit.
		// Enforced here at move creation, not in applyChance: old move logs may
		// contain a last-card chance and must still replay (invariant 1).
		if (this.state.deck.length <= 1) return;

		const chancedCard = this.state.deck[this.state.deck.length - 1];

		this.commitMove(playerId, 'C', [chancedCard], () =>
			applyChance(this.state, playerId, chancedCard, debugForce)
		);
	}

	private handleSprinkle(ws: GameSocket, playerId: string, cardIds: string[]) {
		const check = canSprinkle(this.state, playerId, cardIds);
		if (!check.ok) {
			ws.send(JSON.stringify({ type: 'error', message: check.reason }));
			return;
		}

		this.commitMove(playerId, 'R', check.cards, () => applySprinkle(this.state, playerId, cardIds));
	}

	private handleResetGame(ws: GameSocket, playerId: string) {
		const player = this.state.players.find((p) => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can reset the game.' }));
			return;
		}

		const newDeck = shuffle(createDeck());

		// A trick timer from the old game must not fire into the fresh one
		this.cancelTrickCleanup();

		// Reset in DB
		dbOps.resetGame(this.roomId, playerId, newDeck);

		// Apply transition (in-memory reset)
		const resetPlayers = this.state.players.map((p) => ({
			...p,
			hand: [],
			reserveStack: [],
			isDone: false,
			isSkitgubbe: false
		}));
		this.state = makeInitialState(resetPlayers, {
			status: 'playing',
			seq: 1, // dbOps.resetGame wrote the 'S' move at seq 0
			logs: [`Room ${this.roomId} reset by host. Fresh game started.`]
		});

		// Shuffle and order players
		this.shuffleAndOrderPlayers();

		applyStartGame(this.state, newDeck);

		this.lastKnownStatus = 'playing';
		this.lastActivePlayerId = playerId;
		this.stateHistory = [];
		this.pushStateHistory(this.state);

		this.broadcastState();
	}

	private handleDebugSkipToPhase2(ws: GameSocket, playerId: string) {
		const player = this.state.players.find((p) => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can skip to Phase 2.' }));
			return;
		}

		// A trick timer from the old game must not fire into the fresh one
		this.cancelTrickCleanup();

		// Wipe moves in DB to keep consistency
		dbOps.resetGame(this.roomId);

		const newDeck = shuffle(createDeck());

		const { remainingDeck } = resetToFreshGame(this.state, newDeck, { skipToPhase2: true });

		// Save deck and start move in DB so it doesn't crash on reload
		dbOps.saveInitialDeck(this.roomId, remainingDeck);
		dbOps.saveMove(this.roomId, 0, playerId, 'S', []);
		this.state.seq = 1;

		this.setActivePlayerIdx(this.state.activePlayerIdx);
		this.stateHistory = [];
		this.pushStateHistory(this.state);

		this.broadcastState();
	}

	private handleDebugForceLose(ws: GameSocket, playerId: string) {
		const player = this.state.players.find((p) => p.id === playerId);
		if (!player) return;

		// Force this player to be skitgubbe and end the game
		this.state.status = 'ended';
		for (const p of this.state.players) {
			p.isSkitgubbe = p.id === playerId;
			if (p.id === playerId) {
				p.isDone = false;
				// Ensure they have cards to display in the end animation!
				if (p.hand.length === 0) {
					// Give them a few random cards if their hand was empty
					p.hand = [
						{ id: 'hearts-J', value: 'J', suit: '♥', suitName: 'hearts', color: 'red' },
						{ id: 'spades-Q', value: 'Q', suit: '♠', suitName: 'spades', color: 'black' },
						{ id: 'diamonds-K', value: 'K', suit: '♦', suitName: 'diamonds', color: 'red' }
					];
				}
			} else if (p.inviteStatus === 'accepted') {
				p.isDone = true;
				p.hand = [];
			}
		}

		this.log(`Debug: ${player.name} tvingade fram förlust och blev Skitgubbe.`);

		this.syncGameStatusToDb();
		this.pushStateHistory(this.state);
		this.broadcastState();
	}

	handleAccept(playerId: string) {
		const player = this.state.players.find((p) => p.id === playerId);
		if (player && player.inviteStatus === 'pending') {
			this.commitMove(playerId, 'A', undefined, () =>
				applyJoin(this.state, playerId, player.name, player.color)
			);
		}
	}

	handleDecline(playerId: string) {
		const idx = this.state.players.findIndex((p) => p.id === playerId);
		if (idx !== -1) {
			// A departure can resolve a round/trick (e.g. the active player left
			// and the round was otherwise complete); commitMove schedules the
			// trick cleanup in that case.
			this.commitMove(playerId, 'L', undefined, () => applyDecline(this.state, playerId));
		}
	}
}
