import type { GameState, Card, Player, ClientMessage } from 'shared';
import { createDeck, shuffle, isValidPlay, deckFromString, cardsFromString, getLegalPlays, getValueNumeric, orderSkitgubbeLast, HIDDEN_CARD_VALUE } from 'shared';
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
	applyClearTrick
} from './gameLogic.js';
import { sendTurnNotification } from './notifications.js';

export class GameRoom {
	roomId: string;
	state: GameState;
	clients: Set<any> = new Set(); // WS connections
	playerSockets: Map<string, any> = new Map(); // playerId -> WS connection
	private socketProfiles: Map<any, string> = new Map(); // raw socket -> session-verified profileId
	private cleanupTimeout: any = null;
	private chatLimiters = new WeakMap<any, { tokens: number; lastRefill: number }>();

	syncGameStatusToDb() {
		const activePlayer = this.state.players[this.state.activePlayerIdx];
		const activePlayerId = this.state.status === 'ended' ? null : (activePlayer ? activePlayer.id : null);

		const dbGame = dbOps.getGame(this.roomId);
		const wasEnded = dbGame?.status === 'ended';
		const prevActivePlayerId = dbGame?.active_player_id;

		dbOps.updateGameStatus(this.roomId, this.state.status, activePlayerId);

		if (this.state.status === 'ended' && !wasEnded) {
			dbOps.recordGameResults(this.roomId, this.state);
		}

		// Send push notification if the turn shifted to a new human player
		if (
			this.state.status === 'playing' &&
			activePlayerId &&
			activePlayerId !== prevActivePlayerId &&
			activePlayer &&
			!activePlayer.hasLeft
		) {
			sendTurnNotification(this.roomId, activePlayerId, dbGame?.name).catch((err) => {
				console.error('Unhandled error in sendTurnNotification promise:', err);
			});
		}
	}

	private setActivePlayerIdx(idx: number) {
		this.state.activePlayerIdx = idx;
		this.syncGameStatusToDb();
	}

	private shuffleAndOrderPlayers() {
		const globalSkitgubbe = dbOps.getCurrentGlobalSkitgubbe();
		const acceptedPlayers = this.state.players.filter(p => p.inviteStatus === 'accepted');
		const otherPlayers = this.state.players.filter(p => p.inviteStatus !== 'accepted');

		const shuffledAccepted = shuffle(acceptedPlayers);
		const orderedAccepted = orderSkitgubbeLast(shuffledAccepted, globalSkitgubbe?.id, p => p.id);

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
		const dbPlayers = dbOps.getGamePlayers(roomId);

		const status = dbGame ? dbGame.status : 'waiting';
		const activePlayerId = dbGame ? dbGame.active_player_id : null;
		const initialDeckStr = dbGame ? dbGame.initial_deck : null;

		if ((status === 'playing' || status === 'ended') && initialDeckStr) {
			// Restore game state via Replay Engine
			const initialDeck = deckFromString(initialDeckStr);
			const moves = dbOps.getGameMoves(roomId);
			this.state = replayGame(roomId, dbPlayers, initialDeck, moves);

			if (this.state.status === 'playing') {
				// Re-schedule trick resolution timeout if reloading a pending trick
				if (this.state.trickWinnerId !== null) {
					this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
				}
			}
		} else {
			// Initialize waiting state
			const players: Player[] = dbPlayers.map(p => ({
				id: p.profile_id,
				name: p.name || 'Unknown',
				color: p.color || '#3b82f6',
				avatarConfig: p.avatar_config || undefined,
				hand: [],
				reserveStack: [],
				isDone: false,
				isSkitgubbe: false,
				isHost: p.role === 'host',
				inviteStatus: p.invite_status as 'pending' | 'accepted'
			}));

			let activePlayerIdx = 0;
			if (activePlayerId) {
				const idx = players.findIndex(p => p.id === activePlayerId);
				if (idx !== -1) {
					activePlayerIdx = idx;
				}
			}

			this.state = {
				status,
				phase: 1,
				activePlayerIdx,
				players,
				deck: [],
				tablePile: [],
				tablePilePlayers: [],
				discardPile: [],
				trumpCard: null,
				hiddenTrumpStorage: null,
				logs: [`Room ${roomId} loaded.`],
				tieBreakerActive: false,
				tiedPlayerIds: [],
				tieBreakerStartPileSize: 0,
				trickWinnerId: null,
				seq: dbOps.getNextMoveSeq(roomId)
			};
		}
	}

	scheduleTrickCleanupTimeout(winnerId: string) {
		const delay = this.state.phase === 1 ? 1000 : 500;
		setTimeout(() => {
			if (
				this.state.status === 'playing' &&
				this.state.trickWinnerId === winnerId
			) {
				const seq = dbOps.getNextMoveSeq(this.roomId);
				dbOps.saveMove(this.roomId, seq, winnerId, 'T');

				applyClearTrick(this.state);
				// Sync active player and check game end in Database
				this.syncGameStatusToDb();
				this.broadcastState();
			}
		}, delay);
	}

	addClient(ws: any, profileId?: string) {
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

	removeClient(ws: any) {
		if (!ws || !ws.raw) return;
		const rawWs = ws.raw;
		// Delete the client wrapper matching this raw socket
		for (const client of this.clients) {
			if (client && client.raw === rawWs) {
				this.clients.delete(client);
				break;
			}
		}

		// Find if this socket belonged to players
		for (const [playerId, socket] of this.playerSockets.entries()) {
			if (socket && socket.raw === rawWs) {
				const player = this.state.players.find(p => p.id === playerId);
				if (player) {
					this.log(`${player.name} kopplades bort.`);
				}
				this.playerSockets.delete(playerId);
			}
		}

		this.socketProfiles.delete(rawWs);

		// If the room has no players left, we broadcast to anyone else (like spectators)
		this.broadcastState();
	}

	handleMessage(ws: any, data: string) {
		try {
			const msg: ClientMessage = JSON.parse(data);

			// Guard against debug/dev actions if not allowed
			const allowDev = process.env.PUBLIC_ALLOW_DEV_SETTINGS === 'true';
			if (!allowDev) {
				if (msg.type === 'debugSkipToPhase2' || msg.type === 'debugForceLose') {
					ws.send(JSON.stringify({ type: 'error', message: 'Development/debug settings are disabled.' }));
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

			const playerId = this.getPlayerId(ws);
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

	private getPlayerId(ws: any): string | null {
		if (!ws || !ws.raw) return null;
		const rawWs = ws.raw;
		for (const [playerId, socket] of this.playerSockets.entries()) {
			if (socket && socket.raw === rawWs) {
				return playerId;
			}
		}
		return null;
	}

	// The session-verified identity bound to this socket at upgrade time.
	private getAuthedProfileId(ws: any): string | null {
		if (!ws || !ws.raw) return null;
		return this.socketProfiles.get(ws.raw) ?? null;
	}

	private log(message: string) {
		this.state.logs.push(message);
		if (this.state.logs.length > 80) {
			this.state.logs.shift();
		}
	}

	private sendStateToClient(ws: any) {
		if (!ws) return;
		const matchingPlayerId = this.getPlayerId(ws) || '';
		try {
			ws.send(JSON.stringify({
				type: 'stateUpdate',
				state: this.getSanitizedState(ws),
				yourPlayerId: matchingPlayerId
			}));
		} catch (e) {
			console.error('Error sending state to client:', e);
		}
	}

	private getSanitizedState(ws: any): GameState {
		const activePlayerId = this.getPlayerId(ws) || '';
		return this.getSanitizedStateForPlayerId(activePlayerId, this.state);
	}

	private getSanitizedStateForPlayerId(activePlayerId: string, state: GameState): GameState {
		// Deep clone state to avoid mutating master state
		const sanitized = structuredClone(state) as GameState;

		// Ensure seq is populated
		if (state === this.state) {
			sanitized.seq = dbOps.getNextMoveSeq(this.roomId);
		} else {
			sanitized.seq = state.seq;
		}

		// Populate isOnline property for players
		for (const player of sanitized.players) {
			player.isOnline = this.playerSockets.has(player.id);
		}

		// 1. Mask deck cards
		if (sanitized.deck) {
			sanitized.deck = sanitized.deck.map((_, idx) => ({
				id: `hidden-deck-${idx}`,
				value: HIDDEN_CARD_VALUE,
				suit: '♠',
				suitName: 'spades',
				color: 'black'
			}));
		}

		// 2. Mask discard pile cards
		if (sanitized.discardPile) {
			sanitized.discardPile = sanitized.discardPile.map((_, idx) => ({
				id: `hidden-discard-${idx}`,
				value: HIDDEN_CARD_VALUE,
				suit: '♠',
				suitName: 'spades',
				color: 'black'
			}));
		}

		// 3. Mask other players' hands and reserve stacks
		for (const player of sanitized.players) {
			if (player.id !== activePlayerId) {
				const shouldMask = state.status !== 'ended' || !player.isSkitgubbe;
				if (shouldMask) {
					player.hand = player.hand.map((_, idx) => ({
						id: `hidden-hand-${player.id}-${idx}`,
						value: HIDDEN_CARD_VALUE,
						suit: '♠',
						suitName: 'spades',
						color: 'black'
					}));
					player.reserveStack = player.reserveStack.map((_, idx) => ({
						id: `hidden-reserve-${player.id}-${idx}`,
						value: HIDDEN_CARD_VALUE,
						suit: '♠',
						suitName: 'spades',
						color: 'black'
					}));
				}
			}
		}

		// 4. Mask hidden trump storage details
		if (sanitized.hiddenTrumpStorage) {
			sanitized.hiddenTrumpStorage = {
				playerId: sanitized.hiddenTrumpStorage.playerId,
				card: {
					id: 'hidden-trump',
					value: HIDDEN_CARD_VALUE,
					suit: '♠',
					suitName: 'spades',
					color: 'black'
				}
			};
		}

		return sanitized;
	}

	private getSanitizedStatesRange(playerId: string, startSeq: number, endSeq: number): GameState[] {
		const dbPlayers = dbOps.getGamePlayers(this.roomId);
		const dbGame = dbOps.getGame(this.roomId);
		if (!dbGame || !dbGame.initial_deck) {
			const fallbackState = this.getSanitizedStateForPlayerId(playerId, this.state);
			const states: GameState[] = [];
			for (let s = startSeq; s <= endSeq; s++) {
				states.push({ ...fallbackState, seq: s });
			}
			return states;
		}

		const initialDeck = deckFromString(dbGame.initial_deck);
		const moves = dbOps.getGameMoves(this.roomId);

		const players: Player[] = dbPlayers.map(p => {
			const hasJoinMove = moves.some(m => m.player_id === p.profile_id && m.move_type === 'A');
			return {
				id: p.profile_id,
				name: p.name || 'Unknown',
				color: p.color || '#3b82f6',
				avatarConfig: p.avatar_config || undefined,
				hand: [],
				reserveStack: [],
				isDone: false,
				isSkitgubbe: false,
				isHost: p.role === 'host',
				inviteStatus: hasJoinMove ? 'pending' : (p.invite_status as 'pending' | 'accepted')
			};
		});

		const state: GameState = {
			status: 'waiting',
			phase: 1,
			activePlayerIdx: 0,
			players,
			deck: [],
			tablePile: [],
			tablePilePlayers: [],
			discardPile: [],
			trumpCard: null,
			hiddenTrumpStorage: null,
			logs: [`Room ${this.roomId} initialized for replay.`],
			tieBreakerActive: false,
			tiedPlayerIds: [],
			tieBreakerStartPileSize: 0,
			trickWinnerId: null,
			seq: 0
		};

		const states: GameState[] = [];
		if (startSeq <= 0 && endSeq >= 0) {
			states.push(this.getSanitizedStateForPlayerId(playerId, state));
		}

		for (let i = 0; i < moves.length; i++) {
			const move = moves[i];
			if (state.trickWinnerId !== null) {
				applyClearTrick(state);
			}

			const movePlayerId = move.player_id;
			const cardList = move.cards ? cardsFromString(move.cards) : [];

			switch (move.move_type) {
				case 'S':
					applyStartGame(state, initialDeck);
					break;
				case 'P':
					applyPlayCards(state, movePlayerId, cardList.map(c => c.id), true);
					break;
				case 'U':
					applyPickUp(state, movePlayerId, true);
					break;
				case 'C':
					if (cardList.length > 0) {
						applyChance(state, movePlayerId, cardList[0], true);
					}
					break;
				case 'R':
					applySprinkle(state, movePlayerId, cardList.map(c => c.id));
					break;
				case 'A': {
					const dbPlayer = dbPlayers.find(p => p.profile_id === movePlayerId);
					const name = dbPlayer?.name || 'Unknown';
					const color = dbPlayer?.color || '#3b82f6';
					applyJoin(state, movePlayerId, name, color);
					const joined = state.players.find(p => p.id === movePlayerId);
					if (joined && dbPlayer?.avatar_config) {
						joined.avatarConfig = dbPlayer.avatar_config;
					}
					break;
				}
				case 'L':
					applyDecline(state, movePlayerId);
					break;
				case 'T':
					applyClearTrick(state);
					break;
			}

			state.seq = i + 1;

			if (state.seq >= startSeq && state.seq <= endSeq) {
				states.push(this.getSanitizedStateForPlayerId(playerId, state));
			}
		}

		while (states.length < (endSeq - startSeq + 1)) {
			const currentFillSeq = startSeq + states.length;
			states.push(this.getSanitizedStateForPlayerId(playerId, { ...state, seq: currentFillSeq }));
		}

		return states;
	}

	scheduleCleanup(onCleanup: () => void, delayMs: number) {
		this.cancelCleanup();
		this.cleanupTimeout = setTimeout(onCleanup, delayMs);
	}

	cancelCleanup() {
		if (this.cleanupTimeout) {
			clearTimeout(this.cleanupTimeout);
			this.cleanupTimeout = null;
		}
	}

	broadcastState(excludeWs?: any) {
		const cache = new Map<string, string>(); // playerId -> JSON string
		this.clients.forEach((ws) => {
			if (excludeWs && ws.raw === excludeWs.raw) return;
			try {
				const playerId = this.getPlayerId(ws) || '';
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

	private handleChat(ws: any, playerId: string, message?: string, emote?: string) {
		// Retrieve or create rate limiter bucket
		let limiter = this.chatLimiters.get(ws);
		const now = Date.now();
		if (!limiter) {
			limiter = { tokens: 5, lastRefill: now };
			this.chatLimiters.set(ws, limiter);
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
		const saved = dbOps.saveChat(this.roomId, playerId, sanitizedMessage, sanitizedEmote, currentSeq);

		// Broadcast message to all active clients in the room
		const chatMsg = {
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

	private handleJoin(ws: any, playerId: string, lastSeq?: number) {
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
			} catch (e) { }
		}

		// Clean up any old associations for this physical socket under different playerIds
		for (const [oldPlayerId, socket] of this.playerSockets.entries()) {
			if (socket.raw === ws.raw && oldPlayerId !== playerId) {
				this.playerSockets.delete(oldPlayerId);
			}
		}

		const existingPlayer = this.state.players.find(p => p.id === playerId);
		const acceptedPlayers = this.state.players.filter(p => p.inviteStatus === 'accepted');

		if (
			(existingPlayer && existingPlayer.inviteStatus === 'pending') ||
			(!existingPlayer && this.state.status === 'waiting')
		) {
			if (acceptedPlayers.length >= 10) {
				ws.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
				return;
			}

			// Save accept/join event to DB
			const seq = dbOps.getNextMoveSeq(this.roomId);
			dbOps.saveMove(this.roomId, seq, playerId, 'A');

			// Persist the join to database
			dbOps.joinGame(this.roomId, playerId);
		}

		// Name/color/avatar always come from the DB profile, never the client.
		const dbProfile = dbOps.getProfileById(playerId);
		const name = dbProfile?.name || 'Unknown';
		const color = dbProfile?.color || '#3b82f6';

		// Apply transition
		applyJoin(this.state, playerId, name, color);

		// Set avatar config from DB profile if available
		const joinedPlayer = this.state.players.find(p => p.id === playerId);
		if (joinedPlayer && dbProfile?.avatar_config) {
			joinedPlayer.avatarConfig = dbProfile.avatar_config;
		}
		this.playerSockets.set(playerId, ws);

		// Send chat history to the newly connected client
		const chats = dbOps.getGameChats(this.roomId);
		try {
			ws.send(JSON.stringify({
				type: 'chatHistory',
				messages: chats.map(c => ({
					id: c.id,
					playerId: c.player_id,
					message: c.message || undefined,
					emote: c.emote || undefined,
					seq: c.seq,
					createdAt: c.created_at
				}))
			}));
		} catch (e) {
			console.error('Error sending chat history to client:', e);
		}

		// Check if we should send a replay or normal update to the newly joined player
		const currentSeq = dbOps.getNextMoveSeq(this.roomId);
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
				ws.send(JSON.stringify({
					type: 'replay',
					states,
					yourPlayerId: playerId
				}));
			} catch (e) {
				console.error('Error sending replay to client:', e);
			}
		} else {
			// Broadcast to everyone including this client
			this.broadcastState();
		}

	}

	private handlePlayCards(ws: any, playerId: string, cardIds: string[], debugForce?: boolean) {
		if (this.state.status !== 'playing') return;

		const activePlayer = this.state.players.find(p => p.id === playerId);
		if (!activePlayer) return;

		if (!debugForce) {
			const currentActive = this.state.players[this.state.activePlayerIdx];
			if (currentActive.id !== playerId || this.state.trickWinnerId !== null) {
				ws.send(JSON.stringify({ type: 'error', message: 'It is not your turn.' }));
				return;
			}
		}

		const selectedCards = activePlayer.hand.filter(c => cardIds.includes(c.id));
		if (selectedCards.length !== cardIds.length) {
			ws.send(JSON.stringify({ type: 'error', message: 'Invalid card selection.' }));
			return;
		}

		const trumpSuit = this.state.trumpCard ? this.state.trumpCard.suitName : null;
		const valid = isValidPlay(
			selectedCards,
			this.state.tablePile,
			this.state.phase,
			trumpSuit
		);

		if (!valid) {
			ws.send(JSON.stringify({ type: 'error', message: 'This move violates Skitgubbe rules.' }));
			return;
		}

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'P', selectedCards);

		// Apply transition
		applyPlayCards(this.state, playerId, cardIds, debugForce);

		// Update DB active player and status
		this.syncGameStatusToDb();

		// Re-schedule trick cleanup if completed
		if (this.state.trickWinnerId !== null) {
			this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
		}

		this.broadcastState();
	}

	private handlePickUp(ws: any, playerId: string, debugForce?: boolean) {
		if (this.state.status !== 'playing' || this.state.phase !== 2 || (this.state.trickWinnerId !== null && !debugForce)) return;

		const activePlayer = this.state.players.find(p => p.id === playerId);
		if (!activePlayer) return;
		if (!debugForce) {
			const currentActive = this.state.players[this.state.activePlayerIdx];
			if (currentActive.id !== playerId) return;
		}

		if (this.state.tablePile.length === 0) return;

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'U');

		// Apply transition
		applyPickUp(this.state, playerId, debugForce);

		// Update DB active player and status
		this.syncGameStatusToDb();

		this.broadcastState();
	}

	private handleChance(ws: any, playerId: string, debugForce?: boolean) {
		if (this.state.status !== 'playing' || this.state.phase !== 1 || (this.state.trickWinnerId !== null && !debugForce)) return;

		const activePlayer = this.state.players.find(p => p.id === playerId);
		if (!activePlayer) return;
		if (!debugForce) {
			const currentActive = this.state.players[this.state.activePlayerIdx];
			if (currentActive.id !== playerId) return;
		}

		if (this.state.deck.length === 0) return;

		const chancedCard = this.state.deck[this.state.deck.length - 1];

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'C', [chancedCard]);

		// Apply transition
		applyChance(this.state, playerId, chancedCard, debugForce);

		// Update DB active player and status
		this.syncGameStatusToDb();

		if (this.state.trickWinnerId !== null) {
			this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
		}

		this.broadcastState();
	}

	private handleSprinkle(ws: any, playerId: string, cardIds: string[]) {
		if (this.state.status !== 'playing' || this.state.phase !== 1 || this.state.trickWinnerId !== null) return;

		const player = this.state.players.find(p => p.id === playerId);
		if (!player) return;

		const selectedCards = player.hand.filter(c => cardIds.includes(c.id));
		if (selectedCards.length !== cardIds.length || selectedCards.length === 0) return;

		const firstVal = selectedCards[0].value;
		if (!selectedCards.every(c => c.value === firstVal)) return;

		const playerPlayedIdx = this.state.tablePilePlayers.findIndex((pId, idx) =>
			pId === playerId && this.state.tablePile[idx].length > 0 && this.state.tablePile[idx][0].value === firstVal
		);

		if (playerPlayedIdx === -1) {
			ws.send(JSON.stringify({ type: 'error', message: 'You can only Sprinkle matching values you already played.' }));
			return;
		}

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'R', selectedCards);

		// Apply transition
		applySprinkle(this.state, playerId, cardIds);

		this.broadcastState();
	}

	private handleResetGame(ws: any, playerId: string) {
		const player = this.state.players.find(p => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can reset the game.' }));
			return;
		}

		const newDeck = shuffle(createDeck());

		// Reset in DB
		dbOps.resetGame(this.roomId, playerId, newDeck);

		// Apply transition (in-memory reset)
		this.state = {
			status: 'playing',
			phase: 1,
			activePlayerIdx: 0,
			players: this.state.players.map(p => ({
				...p,
				hand: [],
				reserveStack: [],
				isDone: false,
				isSkitgubbe: false
			})),
			deck: [],
			tablePile: [],
			tablePilePlayers: [],
			discardPile: [],
			trumpCard: null,
			hiddenTrumpStorage: null,
			logs: [`Room ${this.roomId} reset by host. Fresh game started.`],
			tieBreakerActive: false,
			tiedPlayerIds: [],
			tieBreakerStartPileSize: 0,
			trickWinnerId: null
		};

		// Shuffle and order players
		this.shuffleAndOrderPlayers();

		applyStartGame(this.state, newDeck);

		this.broadcastState();
	}

	private handleDebugSkipToPhase2(ws: any, playerId: string) {
		const player = this.state.players.find(p => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can skip to Phase 2.' }));
			return;
		}

		// Wipe moves in DB to keep consistency
		dbOps.resetGame(this.roomId);

		let newDeck = shuffle(createDeck());

		for (const p of this.state.players) {
			if (p.inviteStatus === 'accepted') {
				p.hand = newDeck.slice(newDeck.length - 6);
				newDeck = newDeck.slice(0, newDeck.length - 6);
			} else {
				p.hand = [];
			}
			p.reserveStack = [];
			p.isDone = false;
			p.isSkitgubbe = false;
		}

		const trump = newDeck.pop() || null;

		// Save deck and start move in DB so it doesn't crash on reload
		dbOps.saveInitialDeck(this.roomId, newDeck);
		dbOps.saveMove(this.roomId, 0, playerId, 'S', []);

		this.state.status = 'playing';
		this.state.phase = 2;
		this.state.deck = [];
		this.state.discardPile = [];
		this.state.tablePile = [];
		this.state.tablePilePlayers = [];
		this.state.trumpCard = trump;
		this.state.hiddenTrumpStorage = null;
		this.state.logs = [`Debug: Skipped to Phase 2. Trump: ${trump ? trump.value + trump.suit : 'None'}.`];
		const initialActiveIdx = this.state.players.findIndex(p => p.inviteStatus === 'accepted');
		this.setActivePlayerIdx(initialActiveIdx !== -1 ? initialActiveIdx : 0);
		this.state.tieBreakerActive = false;
		this.state.tiedPlayerIds = [];
		this.state.tieBreakerStartPileSize = 0;
		this.state.trickWinnerId = null;

		this.syncGameStatusToDb();

		this.broadcastState();
	}

	private handleDebugForceLose(ws: any, playerId: string) {
		const player = this.state.players.find(p => p.id === playerId);
		if (!player) return;

		// Force this player to be skitgubbe and end the game
		this.state.status = 'ended';
		for (const p of this.state.players) {
			p.isSkitgubbe = (p.id === playerId);
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
		this.broadcastState();
	}

	handleAccept(playerId: string) {
		const player = this.state.players.find(p => p.id === playerId);
		if (player && player.inviteStatus === 'pending') {
			// Save Accept move in DB
			const seq = dbOps.getNextMoveSeq(this.roomId);
			dbOps.saveMove(this.roomId, seq, playerId, 'A');

			// Apply transition
			applyJoin(this.state, playerId, player.name, player.color);

			this.broadcastState();
		}
	}

	handleDecline(playerId: string) {
		const idx = this.state.players.findIndex(p => p.id === playerId);
		if (idx !== -1) {
			// Save Decline/Leave in DB
			const seq = dbOps.getNextMoveSeq(this.roomId);
			dbOps.saveMove(this.roomId, seq, playerId, 'L');

			const trickWasPending = this.state.trickWinnerId !== null;

			// Apply transition
			applyDecline(this.state, playerId);

			// Update DB active player and status
			this.syncGameStatusToDb();

			// A departure can resolve a round/trick (e.g. the active player left
			// and the round was otherwise complete); schedule its cleanup.
			if (
				this.state.status === 'playing' &&
				this.state.trickWinnerId !== null &&
				!trickWasPending
			) {
				this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
			}

			this.broadcastState();
		}
	}

}
