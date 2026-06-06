import type { GameState, Card, Player, ClientMessage } from 'shared';
import { createDeck, shuffle, sortHand, isValidPlay, getValueNumeric } from 'shared';

export class GameRoom {
	roomId: string;
	state: GameState;
	clients: Set<any> = new Set(); // WS connections
	playerSockets: Map<string, any> = new Map(); // playerId -> WS connection
	private cleanupTimeout: any = null;

	constructor(roomId: string) {
		this.roomId = roomId;
		this.state = {
			status: 'waiting',
			phase: 1,
			activePlayerIdx: 0,
			players: [],
			deck: [],
			tablePile: [],
			tablePilePlayers: [],
			discardPile: [],
			trumpCard: null,
			hiddenTrumpStorage: null,
			logs: [`🎲 Room ${roomId} created. Waiting for players...`],
			tieBreakerActive: false,
			tiedPlayerIds: [],
			tieBreakerStartPileSize: 0,
			trickWinnerId: null
		};
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
					this.log(`🔌 ${player.name} disconnected.`);
				}
				this.playerSockets.delete(playerId);
			}
		}

		// If the room has no players left, we don't necessarily destroy it immediately,
		// but we broadcast to anyone else (like spectators)
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

		// Check if player is already registered in the state
		const existingPlayer = this.state.players.find(p => p.id === playerId);
		if (existingPlayer) {
			// Reconnection
			this.playerSockets.set(playerId, ws);
			this.log(`🔌 ${existingPlayer.name} reconnected.`);
			this.broadcastState();
			return;
		}

		// Spectator if game is already active
		if (this.state.status !== 'waiting') {
			this.playerSockets.set(playerId, ws); // Register connection
			this.log(`👁️ ${name} joined as a spectator.`);
			this.broadcastState();
			return;
		}

		// Otherwise, join as a regular player
		const isHost = this.state.players.length === 0;
		const newPlayer: Player = {
			id: playerId,
			name,
			color,
			hand: [],
			reserveStack: [],
			isDone: false,
			isSkitgubbe: false,
			isHost
		};

		this.state.players.push(newPlayer);
		this.playerSockets.set(playerId, ws);
		this.log(`👋 ${name} joined the room.`);
		this.broadcastState();
	}

	private handleStartGame(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

		const player = this.state.players.find(p => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can start the game.' }));
			return;
		}

		if (this.state.players.length < 2) {
			ws.send(JSON.stringify({ type: 'error', message: 'At least 2 players are required to start.' }));
			return;
		}

		if (this.state.status !== 'waiting') return;

		// Initialize Deck
		let newDeck = shuffle(createDeck());

		// Deal 3 cards to each player
		for (const p of this.state.players) {
			p.hand = sortHand(newDeck.slice(newDeck.length - 3));
			newDeck = newDeck.slice(0, newDeck.length - 3);
			p.reserveStack = [];
			p.isDone = false;
			p.isSkitgubbe = false;
		}

		this.state.deck = newDeck;
		this.state.discardPile = [];
		this.state.tablePile = [];
		this.state.tablePilePlayers = [];
		this.state.trumpCard = null;
		this.state.hiddenTrumpStorage = null;
		this.state.logs = [`🎲 Game started. Phase 1: The Gathering. ${this.state.players[0].name}'s lead!`];
		this.state.phase = 1;
		this.state.activePlayerIdx = 0; // Host leads first round
		this.state.tieBreakerActive = false;
		this.state.tiedPlayerIds = [];
		this.state.tieBreakerStartPileSize = 0;
		this.state.trickWinnerId = null;
		this.state.status = 'playing';

		this.broadcastState();
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

		// Process play
		activePlayer.hand = sortHand(activePlayer.hand.filter(c => !cardIds.includes(c.id)));

		if (this.state.phase === 1) {
			this.state.tablePile.push(selectedCards);
			this.state.tablePilePlayers.push(playerId);
			this.log(`📤 ${activePlayer.name} played: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

			this.drawReplacements(activePlayer, selectedCards.length);
			this.progressPhase1Turn();
		} else {
			const sorted = [...selectedCards].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
			this.state.tablePile.push(sorted);
			this.state.tablePilePlayers.push(playerId);
			this.log(`📤 ${activePlayer.name} played: ${sorted.map(c => c.value + c.suit).join(' ')}`);

			this.checkPlayerEscape(activePlayer);

			const activeCount = this.state.players.filter(p => !p.isDone).length;
			if (this.state.tablePile.length === activeCount) {
				this.log(`🔥 Table Burned! ${activePlayer.name} clears the table and starts next.`);
				const burned = this.state.tablePile.flat();
				this.state.discardPile.push(...burned);
				this.state.tablePile = [];
				this.state.tablePilePlayers = [];
				this.checkGameOverOrProgress();
			} else {
				this.progressPhase2Turn();
			}
		}

		this.broadcastState();
	}

	private handlePickUp(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing' || this.state.phase !== 2 || this.state.trickWinnerId !== null) return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (activePlayer.id !== playerId) return;

		if (this.state.tablePile.length === 0) return;

		const oldestBatch = this.state.tablePile[0];
		const oldestPlayerId = this.state.tablePilePlayers[0];
		const oldestPlayer = this.state.players.find(p => p.id === oldestPlayerId)!;

		activePlayer.hand = sortHand([...activePlayer.hand, ...oldestBatch]);
		this.state.tablePile = this.state.tablePile.slice(1);
		this.state.tablePilePlayers = this.state.tablePilePlayers.slice(1);

		this.log(`❌ ${activePlayer.name} picked up the oldest batch (${oldestBatch.map(c => c.value + c.suit).join(' ')} played by ${oldestPlayer.name})`);

		this.progressPhase2Turn();
		this.broadcastState();
	}

	private handleChance(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId || this.state.status !== 'playing' || this.state.phase !== 1 || this.state.trickWinnerId !== null) return;

		const activePlayer = this.state.players[this.state.activePlayerIdx];
		if (activePlayer.id !== playerId) return;

		if (this.state.deck.length === 0) return;

		const chancedCard = this.state.deck[this.state.deck.length - 1];
		this.state.deck = this.state.deck.slice(0, this.state.deck.length - 1);

		this.state.tablePile.push([chancedCard]);
		this.state.tablePilePlayers.push(playerId);

		this.log(`🎲 ${activePlayer.name} chanced the top card from the deck: ${chancedCard.value}${chancedCard.suit}`);

		this.progressPhase1Turn();
		this.broadcastState();
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

		player.hand = sortHand(player.hand.filter(c => !cardIds.includes(c.id)));
		this.state.tablePile[playerPlayedIdx] = [...this.state.tablePile[playerPlayedIdx], ...selectedCards];

		this.log(`✨ ${player.name} sprinkled: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

		this.drawReplacements(player, selectedCards.length);
		this.broadcastState();
	}

	private handleResetGame(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

		const player = this.state.players.find(p => p.id === playerId);
		if (!player || !player.isHost) {
			ws.send(JSON.stringify({ type: 'error', message: 'Only the Host can reset the game.' }));
			return;
		}

		this.state = {
			status: 'waiting',
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
			logs: [`🎲 Room ${this.roomId} reset by host. Waiting for players...`],
			tieBreakerActive: false,
			tiedPlayerIds: [],
			tieBreakerStartPileSize: 0,
			trickWinnerId: null
		};

		this.broadcastState();
	}

	private handleDebugSkipToPhase2(ws: any) {
		const playerId = this.getPlayerId(ws);
		if (!playerId) return;

		let newDeck = shuffle(createDeck());
		
		for (const p of this.state.players) {
			p.hand = sortHand(newDeck.slice(newDeck.length - 6));
			newDeck = newDeck.slice(0, newDeck.length - 6);
			p.reserveStack = [];
			p.isDone = false;
			p.isSkitgubbe = false;
		}

		const trump = newDeck.pop() || null;
		
		this.state.status = 'playing';
		this.state.phase = 2;
		this.state.deck = [];
		this.state.discardPile = [];
		this.state.tablePile = [];
		this.state.tablePilePlayers = [];
		this.state.trumpCard = trump;
		this.state.hiddenTrumpStorage = null;
		this.state.logs = [`⚙️ Debug: Skipped ahead to Phase 2 with 6 random cards each. Trump is ${trump ? trump.value + trump.suit : 'None'}.`];
		this.state.activePlayerIdx = 0;
		this.state.tieBreakerActive = false;
		this.state.tiedPlayerIds = [];
		this.state.tieBreakerStartPileSize = 0;
		this.state.trickWinnerId = null;

		this.broadcastState();
	}

	private drawReplacements(player: Player, count: number) {
		const targetHandSize = 3;
		const currentSize = player.hand.length;
		const toDraw = Math.max(count, targetHandSize - currentSize);
		for (let i = 0; i < toDraw; i++) {
			if (this.state.deck.length === 0) break;
			const nextCard = this.state.deck[this.state.deck.length - 1];
			this.state.deck = this.state.deck.slice(0, this.state.deck.length - 1);

			if (this.state.deck.length === 0) {
				this.state.hiddenTrumpStorage = { playerId: player.id, card: nextCard };
				this.log(`🔒 ${player.name} drew the absolute last card (Hidden Trump Storage)!`);
			} else {
				player.hand = sortHand([...player.hand, nextCard]);
			}
		}
	}

	private progressPhase1Turn() {
		if (this.state.tieBreakerActive) {
			const subRoundPlays = this.state.tablePile.length - this.state.tieBreakerStartPileSize;
			if (subRoundPlays === this.state.tiedPlayerIds.length) {
				this.resolveTieBreaker();
			} else {
				const nextTiedId = this.state.tiedPlayerIds[subRoundPlays];
				this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === nextTiedId);
			}
		} else {
			if (this.state.tablePile.length === this.state.players.filter(p => !p.isDone).length) {
				this.resolveNormalRoundPhase1();
			} else {
				this.state.activePlayerIdx = (this.state.activePlayerIdx + 1) % this.state.players.length;
			}
		}
	}

	private resolveNormalRoundPhase1() {
		let maxVal = -1;
		const plays: { playerId: string; val: number }[] = [];

		for (let i = 0; i < this.state.tablePile.length; i++) {
			const playerId = this.state.tablePilePlayers[i];
			const val = getValueNumeric(this.state.tablePile[i][0]);
			plays.push({ playerId, val });
			if (val > maxVal) {
				maxVal = val;
			}
		}

		const winners = plays.filter(p => p.val === maxVal);
		if (winners.length === 1) {
			const winnerId = winners[0].playerId;
			const winner = this.state.players.find(p => p.id === winnerId)!;

			winner.reserveStack = [...winner.reserveStack, ...this.state.tablePile.flat()];
			this.log(`⭐ ${winner.name} wins trick with ${this.state.tablePile[plays.findIndex(p => p.playerId === winnerId)][0].value}s!`);

			this.state.trickWinnerId = winnerId;
			this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === winnerId);

			this.broadcastState();

			setTimeout(() => {
				this.state.trickWinnerId = null;
				this.state.tablePile = [];
				this.state.tablePilePlayers = [];

				if (this.state.deck.length === 0 && this.state.players.some(p => p.hand.length === 0)) {
					this.transitionToPhase2();
				}
				this.broadcastState();
			}, 2000);
		} else {
			if (this.state.deck.length === 0 && this.state.players.some(p => p.hand.length === 0)) {
				this.log(`⚠️ Tie occurred but deck is empty. Transitioning to Phase 2!`);
				this.transitionToPhase2();
				return;
			}

			const tiedIds = winners.map(w => w.playerId);
			this.log(`⚔️ Tie for highest! Tied players: ${tiedIds.map(id => this.state.players.find(p => p.id === id)!.name).join(', ')}. Tie-breaker starts.`);

			this.state.tieBreakerActive = true;
			this.state.tiedPlayerIds = tiedIds;
			this.state.tieBreakerStartPileSize = this.state.tablePile.length;
			this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === this.state.tiedPlayerIds[0]);
		}
	}

	private resolveTieBreaker() {
		const K = this.state.tiedPlayerIds.length;
		const subRoundBatches = this.state.tablePile.slice(this.state.tablePile.length - K);
		const subRoundPlayers = this.state.tablePilePlayers.slice(this.state.tablePilePlayers.length - K);

		let maxVal = -1;
		const plays: { playerId: string; val: number }[] = [];
		for (let i = 0; i < K; i++) {
			const playerId = subRoundPlayers[i];
			const val = getValueNumeric(subRoundBatches[i][0]);
			plays.push({ playerId, val });
			if (val > maxVal) {
				maxVal = val;
			}
		}

		const winners = plays.filter(p => p.val === maxVal);
		if (winners.length === 1) {
			const winnerId = winners[0].playerId;
			const winner = this.state.players.find(p => p.id === winnerId)!;

			winner.reserveStack = [...winner.reserveStack, ...this.state.tablePile.flat()];
			this.log(`⭐ ${winner.name} breaks the tie and wins trick with ${subRoundBatches[plays.findIndex(p => p.playerId === winnerId)][0].value}!`);

			this.state.trickWinnerId = winnerId;
			this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === winnerId);
			this.state.tieBreakerActive = false;
			this.state.tiedPlayerIds = [];

			this.broadcastState();

			setTimeout(() => {
				this.state.trickWinnerId = null;
				this.state.tablePile = [];
				this.state.tablePilePlayers = [];

				if (this.state.deck.length === 0 && this.state.players.some(p => p.hand.length === 0)) {
					this.transitionToPhase2();
				}
				this.broadcastState();
			}, 2000);
		} else {
			const newTiedIds = winners.map(w => w.playerId);

			if (this.state.deck.length === 0 && this.state.players.some(p => p.hand.length === 0)) {
				this.log(`⚠️ Tie occurred again but deck is empty. Transitioning to Phase 2!`);
				this.transitionToPhase2();
				return;
			}

			this.log(`⚔️ Tied again! Tied: ${newTiedIds.map(id => this.state.players.find(p => p.id === id)!.name).join(', ')}. Another tie-breaker card required.`);

			this.state.tiedPlayerIds = newTiedIds;
			this.state.tieBreakerStartPileSize = this.state.tablePile.length;
			this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === this.state.tiedPlayerIds[0]);
		}
	}

	private transitionToPhase2() {
		this.state.phase = 2;
		this.log('🔄 All Phase 1 cards drawn. Transitioning to Phase 2: The Shedding!');

		for (const p of this.state.players) {
			p.hand = sortHand([...p.hand, ...p.reserveStack]);
			p.reserveStack = [];
			this.log(`${p.name} picked up reserve stack. Hand: ${p.hand.length} cards.`);
		}

		if (this.state.hiddenTrumpStorage) {
			const { playerId, card } = this.state.hiddenTrumpStorage;
			const owner = this.state.players.find(p => p.id === playerId)!;

			this.state.trumpCard = card;
			this.log(`👑 Trump revealed: ${card.value}${card.suit} (${card.suitName.toUpperCase()})`);
			this.log(`${owner.name} adds it to hand and leads Phase 2!`);

			owner.hand = sortHand([...owner.hand, card]);
			this.state.activePlayerIdx = this.state.players.findIndex(p => p.id === playerId);
		} else {
			this.state.activePlayerIdx = 0;
		}

		this.state.tablePile = [];
		this.state.tablePilePlayers = [];
		this.state.discardPile = [];

		for (const p of this.state.players) {
			this.checkPlayerEscape(p);
		}
		this.checkGameOverOrProgress();
	}

	private checkPlayerEscape(player: Player) {
		if (player.hand.length === 0 && !player.isDone) {
			player.isDone = true;
			this.log(`🎉 ${player.name} emptied their hand and ESCAPED! 🎉`);

			const remaining = this.state.players.filter(p => !p.isDone);
			if (remaining.length === 1) {
				const loser = remaining[0];
				loser.isSkitgubbe = true;
				this.log(`💀 Game Over! ${loser.name} is the Skitgubbe! 💀`);
				this.state.status = 'ended';
			}
		}
	}

	private progressPhase2Turn() {
		const remaining = this.state.players.filter(p => !p.isDone);
		if (remaining.length <= 1) return;

		let nextIdx = (this.state.activePlayerIdx + 1) % this.state.players.length;
		while (this.state.players[nextIdx].isDone) {
			nextIdx = (nextIdx + 1) % this.state.players.length;
		}
		this.state.activePlayerIdx = nextIdx;
	}

	private checkGameOverOrProgress() {
		const remaining = this.state.players.filter(p => !p.isDone);
		if (remaining.length <= 1) return;
		if (this.state.players[this.state.activePlayerIdx].isDone) {
			this.progressPhase2Turn();
		}
	}
}
