import type { GameState, Card, Player, ClientMessage } from 'shared';
import { createDeck, shuffle, isValidPlay, deckFromString, getLegalPlays, getValueNumeric } from 'shared';
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

export class GameRoom {
	roomId: string;
	state: GameState;
	clients: Set<any> = new Set(); // WS connections
	playerSockets: Map<string, any> = new Map(); // playerId -> WS connection
	private cleanupTimeout: any = null;

	private setActivePlayerIdx(idx: number) {
		this.state.activePlayerIdx = idx;
		const activePlayer = this.state.players[idx];
		if (activePlayer && this.state.status === 'playing') {
			dbOps.updateGameStatus(this.roomId, 'playing', activePlayer.id);
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

		if (status === 'playing' && initialDeckStr) {
			// Restore game state via Replay Engine
			const initialDeck = deckFromString(initialDeckStr);
			const moves = dbOps.getGameMoves(roomId);
			this.state = replayGame(roomId, dbPlayers, initialDeck, moves);

			// Re-schedule trick resolution timeout if reloading a pending trick
			if (this.state.trickWinnerId !== null) {
				this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
			} else {
				this.checkAndTriggerBotMove();
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
				trickWinnerId: null
			};
		}
	}

	private scheduleTrickCleanupTimeout(winnerId: string) {
		const delay = this.state.phase === 1 ? 1000 : 500;
		setTimeout(() => {
			if (
				this.state.status === 'playing' &&
				this.state.trickWinnerId === winnerId
			) {
				applyClearTrick(this.state);
				// Sync active player in Database
				const activePlayer = this.state.players[this.state.activePlayerIdx];
				if (activePlayer) {
					dbOps.updateGameStatus(this.roomId, 'playing', activePlayer.id);
				}
				this.broadcastState();
				this.checkAndTriggerBotMove();
			}
		}, delay);
	}

	addClient(ws: any) {
		if (!ws) return;
		this.cancelCleanup();
		this.clients.add(ws);
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
					this.log(`${player.name} disconnected.`);
				}
				this.playerSockets.delete(playerId);
			}
		}

		// If the room has no players left, we broadcast to anyone else (like spectators)
		this.broadcastState();
	}

	handleMessage(ws: any, data: string) {
		try {
			const msg: ClientMessage = JSON.parse(data);
			switch (msg.type) {
				case 'join':
					this.handleJoin(ws, msg.playerId, msg.name, msg.color);
					break;
				case 'startGame':
					this.handleStartGame(ws);
					break;
				case 'playCards':
					this.handlePlayCards(ws, msg.cardIds);
					break;
				case 'pickUp':
					this.handlePickUp(ws);
					break;
				case 'chance':
					this.handleChance(ws);
					break;
				case 'sprinkle':
					this.handleSprinkle(ws, msg.cardIds);
					break;
				case 'resetGame':
					this.handleResetGame(ws);
					break;
				case 'debugSkipToPhase2':
					this.handleDebugSkipToPhase2(ws);
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
		const activePlayerId = this.getPlayerId(ws);

		// Deep clone state to avoid mutating master state
		const sanitized = JSON.parse(JSON.stringify(this.state)) as GameState;

		// 1. Mask deck cards
		if (sanitized.deck) {
			sanitized.deck = sanitized.deck.map((_, idx) => ({
				id: `hidden-deck-${idx}`,
				value: '?',
				suit: '♠',
				suitName: 'spades',
				color: 'black'
			}));
		}

		// 2. Mask discard pile cards
		if (sanitized.discardPile) {
			sanitized.discardPile = sanitized.discardPile.map((_, idx) => ({
				id: `hidden-discard-${idx}`,
				value: '?',
				suit: '♠',
				suitName: 'spades',
				color: 'black'
			}));
		}

		// 3. Mask other players' hands and reserve stacks
		for (const player of sanitized.players) {
			if (player.id !== activePlayerId) {
				player.hand = player.hand.map((_, idx) => ({
					id: `hidden-hand-${player.id}-${idx}`,
					value: '?',
					suit: '♠',
					suitName: 'spades',
					color: 'black'
				}));
				player.reserveStack = player.reserveStack.map((_, idx) => ({
					id: `hidden-reserve-${player.id}-${idx}`,
					value: '?',
					suit: '♠',
					suitName: 'spades',
					color: 'black'
				}));
			}
		}

		// 4. Mask hidden trump storage details
		if (sanitized.hiddenTrumpStorage) {
			sanitized.hiddenTrumpStorage = {
				playerId: sanitized.hiddenTrumpStorage.playerId,
				card: {
					id: 'hidden-trump',
					value: '?',
					suit: '♠',
					suitName: 'spades',
					color: 'black'
				}
			};
		}

		return sanitized;
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

	private broadcastState() {
		this.clients.forEach((ws) => {
			try {
				this.sendStateToClient(ws);
			} catch (e) {
				console.error('Error broadcasting to client:', e);
			}
		});
	}

	private handleJoin(ws: any, playerId: string, name: string, color: string) {
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
		}

		// Clean up any old associations for this physical socket under different playerIds
		for (const [oldPlayerId, socket] of this.playerSockets.entries()) {
			if (socket.raw === ws.raw && oldPlayerId !== playerId) {
				this.playerSockets.delete(oldPlayerId);
			}
		}

		const existingPlayer = this.state.players.find(p => p.id === playerId);

		if (
			(existingPlayer && existingPlayer.inviteStatus === 'pending') ||
			(!existingPlayer && this.state.status === 'waiting')
		) {
			// Save accept/join event to DB
			const seq = dbOps.getNextMoveSeq(this.roomId);
			dbOps.saveMove(this.roomId, seq, playerId, 'A');
		}

		// Apply transition
		applyJoin(this.state, playerId, name, color);

		// Set avatar config from DB profile if available
		const joinedPlayer = this.state.players.find(p => p.id === playerId);
		if (joinedPlayer) {
			const dbProfile = dbOps.getProfileById(playerId);
			if (dbProfile?.avatar_config) {
				joinedPlayer.avatarConfig = dbProfile.avatar_config;
			}
		}
		this.playerSockets.set(playerId, ws);

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handleStartGame(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

		const player = this.state.players.find(p => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can start the game.' }));
			return;
		}

		const acceptedPlayers = this.state.players.filter(p => p.inviteStatus === 'accepted');
		if (acceptedPlayers.length < 2) {
			ws.send(JSON.stringify({ type: 'error', message: 'At least 2 accepted players are required to start.' }));
			return;
		}

		if (this.state.status !== 'waiting') return;

		// Initialize Deck
		const newDeck = shuffle(createDeck());

		// Save deck and start move in DB
		dbOps.saveInitialDeck(this.roomId, newDeck);
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'S', []);

		// Apply transition
		applyStartGame(this.state, newDeck);

		// Update DB status
		dbOps.updateGameStatus(this.roomId, 'playing', playerId);

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handlePlayCards(ws: any, cardIds: string[]) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing') return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (activePlayer.id !== playerId || this.state.trickWinnerId !== null) {
			ws.send(JSON.stringify({ type: 'error', message: 'It is not your turn.' }));
			return;
		}

		const selectedCards = activePlayer.hand.filter(c => cardIds.includes(c.id));
		if (selectedCards.length !== cardIds.length) {
			ws.send(JSON.stringify({ type: 'error', message: 'Invalid card selection.' }));
			return;
		}

		const trumpSuit = this.state.trumpCard ? this.state.trumpCard.suitName : null;
		const valid = isValidPlay(
			selectedCards,
			activePlayer.hand,
			this.state.tablePile,
			this.state.phase,
			this.state.tieBreakerActive,
			this.state.tiedPlayerIds,
			playerId,
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
		applyPlayCards(this.state, playerId, cardIds);

		// Update DB active player
		const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
		if (nextActivePlayer) {
			dbOps.updateGameStatus(
				this.roomId,
				this.state.status,
				(this.state.status as string) === 'ended' ? null : nextActivePlayer.id
			);
		}

		// Re-schedule trick cleanup if completed
		if (this.state.trickWinnerId !== null) {
			this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
		}

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handlePickUp(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing' || this.state.phase !== 2 || this.state.trickWinnerId !== null) return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (activePlayer.id !== playerId) return;

		if (this.state.tablePile.length === 0) return;

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'U');

		// Apply transition
		applyPickUp(this.state, playerId);

		// Update DB active player
		const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
		if (nextActivePlayer) {
			dbOps.updateGameStatus(this.roomId, 'playing', nextActivePlayer.id);
		}

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handleChance(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing' || this.state.phase !== 1 || this.state.trickWinnerId !== null) return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (activePlayer.id !== playerId) return;

		if (this.state.deck.length === 0) return;

		const chancedCard = this.state.deck[this.state.deck.length - 1];

		// Save move in DB
		const seq = dbOps.getNextMoveSeq(this.roomId);
		dbOps.saveMove(this.roomId, seq, playerId, 'C', [chancedCard]);

		// Apply transition
		applyChance(this.state, playerId, chancedCard);

		// Update DB active player
		const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
		if (nextActivePlayer) {
			dbOps.updateGameStatus(this.roomId, 'playing', nextActivePlayer.id);
		}

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handleSprinkle(ws: any, cardIds: string[]) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing' || this.state.phase !== 1 || this.state.trickWinnerId !== null) return;

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
		this.checkAndTriggerBotMove();
	}

	private handleResetGame(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

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

		applyStartGame(this.state, newDeck);

		this.broadcastState();
		this.checkAndTriggerBotMove();
	}

	private handleDebugSkipToPhase2(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

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

		dbOps.updateGameStatus(this.roomId, 'playing', playerId);

		this.broadcastState();
		this.checkAndTriggerBotMove();
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
			this.checkAndTriggerBotMove();
		}
	}

	handleDecline(playerId: string) {
		const idx = this.state.players.findIndex(p => p.id === playerId);
		if (idx !== -1) {
			// Save Decline/Leave in DB
			const seq = dbOps.getNextMoveSeq(this.roomId);
			dbOps.saveMove(this.roomId, seq, playerId, 'L');

			// Apply transition
			applyDecline(this.state, playerId);

			// Update DB active player
			const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
			dbOps.updateGameStatus(
				this.roomId,
				this.state.status,
				this.state.status === 'ended' ? null : (nextActivePlayer ? nextActivePlayer.id : null)
			);

			this.broadcastState();
			this.checkAndTriggerBotMove();
		}
	}

	private checkAndTriggerBotMove() {
		if (this.state.status !== 'playing' || this.state.trickWinnerId !== null) return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (!activePlayer || !activePlayer.isBot || activePlayer.isDone) return;

		setTimeout(() => {
			if (this.state.status !== 'playing' || this.state.trickWinnerId !== null) return;
			const currentActive = this.state.players[this.state.activePlayerIdx];
			if (!currentActive || !currentActive.isBot || currentActive.isDone) return;

			this.executeBotTurn(currentActive);
		}, 1000);
	}

	private executeBotTurn(botPlayer: Player) {
		const playerId = botPlayer.id;
		if (this.state.phase === 1) {
			if (botPlayer.hand.length > 0) {
				// Play the lowest value card(s) from hand
				const sortedHand = [...botPlayer.hand].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
				const lowestVal = sortedHand[0].value;
				const cardsToPlay = sortedHand.filter(c => c.value === lowestVal);
				const cardIds = cardsToPlay.map(c => c.id);

				const seq = dbOps.getNextMoveSeq(this.roomId);
				dbOps.saveMove(this.roomId, seq, playerId, 'P', cardsToPlay);
				applyPlayCards(this.state, playerId, cardIds);

				const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
				if (nextActivePlayer) {
					dbOps.updateGameStatus(this.roomId, this.state.status, this.state.status === 'ended' ? null : nextActivePlayer.id);
				}
				if (this.state.trickWinnerId !== null) {
					this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
				}
				this.broadcastState();
				this.checkAndTriggerBotMove();
			} else if (this.state.deck.length > 0) {
				const chancedCard = this.state.deck[this.state.deck.length - 1];
				const seq = dbOps.getNextMoveSeq(this.roomId);
				dbOps.saveMove(this.roomId, seq, playerId, 'C', [chancedCard]);
				applyChance(this.state, playerId, chancedCard);

				const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
				if (nextActivePlayer) {
					dbOps.updateGameStatus(this.roomId, 'playing', nextActivePlayer.id);
				}
				this.broadcastState();
				this.checkAndTriggerBotMove();
			}
		} else {
			// Phase 2
			const trumpSuit = this.state.trumpCard ? this.state.trumpCard.suitName : null;
			const legalPlays = getLegalPlays(botPlayer.hand, this.state.tablePile, trumpSuit);

			if (legalPlays.length > 0) {
				// Select a play with the lowest value cards
				legalPlays.sort((a, b) => getValueNumeric(a[0]) - getValueNumeric(b[0]));
				const chosenPlay = legalPlays[0];
				const cardIds = chosenPlay.map(c => c.id);

				const seq = dbOps.getNextMoveSeq(this.roomId);
				dbOps.saveMove(this.roomId, seq, playerId, 'P', chosenPlay);
				applyPlayCards(this.state, playerId, cardIds);

				const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
				if (nextActivePlayer) {
					dbOps.updateGameStatus(this.roomId, this.state.status, this.state.status === 'ended' ? null : nextActivePlayer.id);
				}
				if (this.state.trickWinnerId !== null) {
					this.scheduleTrickCleanupTimeout(this.state.trickWinnerId);
				}
				this.broadcastState();
				this.checkAndTriggerBotMove();
			} else {
				// Pick up pile
				const seq = dbOps.getNextMoveSeq(this.roomId);
				dbOps.saveMove(this.roomId, seq, playerId, 'U');
				applyPickUp(this.state, playerId);

				const nextActivePlayer = this.state.players[this.state.activePlayerIdx];
				if (nextActivePlayer) {
					dbOps.updateGameStatus(this.roomId, 'playing', nextActivePlayer.id);
				}
				this.broadcastState();
				this.checkAndTriggerBotMove();
			}
		}
	}
}
