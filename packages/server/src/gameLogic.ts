import type { GameState, Card, Player } from 'shared';
import { sortHand, getValueNumeric } from 'shared';

// Helper to log message to state.logs
function logState(state: GameState, message: string) {
	state.logs.push(message);
	if (state.logs.length > 80) {
		state.logs.shift();
	}
}

export function applyStartGame(state: GameState, initialDeck: Card[]): void {
	let newDeck = [...initialDeck];
	for (const p of state.players) {
		if (p.inviteStatus === 'accepted') {
			p.hand = sortHand(newDeck.slice(newDeck.length - 3));
			newDeck = newDeck.slice(0, newDeck.length - 3);
		} else {
			p.hand = [];
		}
		p.reserveStack = [];
		p.isDone = false;
		p.isSkitgubbe = false;
	}
	state.deck = newDeck;
	state.discardPile = [];
	state.tablePile = [];
	state.tablePilePlayers = [];
	state.trumpCard = null;
	state.hiddenTrumpStorage = null;
	state.logs = [`Game started. Phase 1: The Gathering. ${state.players[0]?.name || 'Host'}'s lead.`];
	state.phase = 1;
	state.activePlayerIdx = 0;
	state.tieBreakerActive = false;
	state.tiedPlayerIds = [];
	state.tieBreakerStartPileSize = 0;
	state.trickWinnerId = null;
	state.status = 'playing';
}

export function applyPlayCards(state: GameState, playerId: string, cardIds: string[]): void {
	if (state.status !== 'playing') return;

	const activePlayer = state.players[state.activePlayerIdx];
	if (activePlayer.id !== playerId || state.trickWinnerId !== null) return;

	const selectedCards = activePlayer.hand.filter(c => cardIds.includes(c.id));
	if (selectedCards.length !== cardIds.length) return;

	activePlayer.hand = sortHand(activePlayer.hand.filter(c => !cardIds.includes(c.id)));

	if (state.phase === 1) {
		state.tablePile.push(selectedCards);
		state.tablePilePlayers.push(playerId);
		logState(state, `${activePlayer.name} played: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

		drawReplacements(state, activePlayer, selectedCards.length);
		progressPhase1Turn(state);
	} else {
		const sorted = [...selectedCards].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		state.tablePile.push(sorted);
		state.tablePilePlayers.push(playerId);
		logState(state, `${activePlayer.name} played: ${sorted.map(c => c.value + c.suit).join(' ')}`);

		checkPlayerEscape(state, activePlayer);

		const activeCount = state.players.filter(p => !p.isDone).length;
		if (state.tablePile.length === activeCount) {
			logState(state, `Table burned. ${activePlayer.name} clears the table.`);
			state.trickWinnerId = playerId;
		} else {
			progressPhase2Turn(state);
		}
	}
}

export function applyPickUp(state: GameState, playerId: string): void {
	if (state.status !== 'playing' || state.phase !== 2 || state.trickWinnerId !== null) return;

	const activePlayer = state.players[state.activePlayerIdx];
	if (activePlayer.id !== playerId) return;

	if (state.tablePile.length === 0) return;

	const oldestBatch = state.tablePile[0];
	const oldestPlayerId = state.tablePilePlayers[0];
	const oldestPlayer = state.players.find(p => p.id === oldestPlayerId);
	const oldestName = oldestPlayer ? oldestPlayer.name : 'a departed player';

	activePlayer.hand = sortHand([...activePlayer.hand, ...oldestBatch]);
	state.tablePile = state.tablePile.slice(1);
	state.tablePilePlayers = state.tablePilePlayers.slice(1);

	logState(state, `${activePlayer.name} picked up ${oldestBatch.map(c => c.value + c.suit).join(' ')} played by ${oldestName}.`);

	progressPhase2Turn(state);
}

export function applyChance(state: GameState, playerId: string, drawnCard: Card): void {
	if (state.status !== 'playing' || state.phase !== 1 || state.trickWinnerId !== null) return;

	const activePlayer = state.players[state.activePlayerIdx];
	if (activePlayer.id !== playerId) return;

	if (state.deck.length === 0) return;

	// In logic, the drawnCard is passed, and we verify it is the top card of the deck
	const topCard = state.deck[state.deck.length - 1];
	if (!topCard || topCard.id !== drawnCard.id) {
		// Replay fallback: just slice from deck
		state.deck = state.deck.slice(0, state.deck.length - 1);
	} else {
		state.deck = state.deck.slice(0, state.deck.length - 1);
	}

	state.tablePile.push([drawnCard]);
	state.tablePilePlayers.push(playerId);

	logState(state, `${activePlayer.name} chanced deck card: ${drawnCard.value}${drawnCard.suit}.`);

	progressPhase1Turn(state);
}

export function applySprinkle(state: GameState, playerId: string, cardIds: string[]): void {
	if (state.status !== 'playing' || state.phase !== 1 || state.trickWinnerId !== null) return;

	const player = state.players.find(p => p.id === playerId);
	if (!player) return;

	const selectedCards = player.hand.filter(c => cardIds.includes(c.id));
	if (selectedCards.length !== cardIds.length || selectedCards.length === 0) return;

	const firstVal = selectedCards[0].value;
	if (!selectedCards.every(c => c.value === firstVal)) return;

	const playerPlayedIdx = state.tablePilePlayers.findIndex((pId, idx) => 
		pId === playerId && state.tablePile[idx].length > 0 && state.tablePile[idx][0].value === firstVal
	);

	if (playerPlayedIdx === -1) return;

	player.hand = sortHand(player.hand.filter(c => !cardIds.includes(c.id)));
	state.tablePile[playerPlayedIdx] = [...state.tablePile[playerPlayedIdx], ...selectedCards];

	logState(state, `${player.name} sprinkled: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

	drawReplacements(state, player, selectedCards.length);
}

export function applyJoin(state: GameState, playerId: string, name: string, color: string): void {
	// Reconnection / Acceptance / Mid-game join
	const existingPlayer = state.players.find(p => p.id === playerId);
	if (existingPlayer) {
		if (existingPlayer.inviteStatus === 'pending') {
			existingPlayer.inviteStatus = 'accepted';
			logState(state, `${existingPlayer.name} accepted the invite.`);

			if (state.status === 'playing') {
				const dealCount = Math.min(3, state.deck.length);
				if (dealCount > 0) {
					existingPlayer.hand = sortHand(state.deck.slice(state.deck.length - dealCount));
					state.deck = state.deck.slice(0, state.deck.length - dealCount);
					logState(state, `Dealt ${dealCount} cards to ${existingPlayer.name} on mid-game join.`);
				} else {
					logState(state, `${existingPlayer.name} joined but no cards left in deck.`);
				}
			}
		} else {
			logState(state, `${existingPlayer.name} reconnected.`);
		}
		return;
	}

	// Spectator if game is already active
	if (state.status !== 'waiting') {
		logState(state, `${name} joined as spectator.`);
		return;
	}

	// Join as regular player
	const isHost = state.players.length === 0;
	const newPlayer: Player = {
		id: playerId,
		name,
		color,
		hand: [],
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost,
		inviteStatus: 'accepted'
	};

	state.players.push(newPlayer);
	logState(state, `${name} joined.`);
}

export function applyDecline(state: GameState, playerId: string): void {
	const idx = state.players.findIndex(p => p.id === playerId);
	if (idx !== -1) {
		const player = state.players[idx];
		const declinedPlayerName = player.name;
		const wasActive = state.activePlayerIdx === idx;
		const wasPending = player.inviteStatus === 'pending';

		if (state.status === 'playing' && !wasPending) {
			player.isBot = true;
			logState(state, `${player.name} left the game and was replaced by a bot.`);
		} else {
			state.players.splice(idx, 1);
			logState(state, `Invite declined or player removed: ${declinedPlayerName}`);

			// Adjust activePlayerIdx if it was pointed at or after the removed player
			if (state.players.length === 0) {
				state.activePlayerIdx = 0;
			} else if (wasActive) {
				state.activePlayerIdx = idx % state.players.length;
			} else if (state.activePlayerIdx > idx) {
				state.activePlayerIdx = state.activePlayerIdx - 1;
			}
		}

		if (state.status === 'playing') {
			const activeCount = state.players.length;
			if (activeCount <= 1) {
				state.status = 'ended';
				logState(state, `All other players declined or left. Game aborted.`);
			} else {
				for (const p of state.players) {
					checkPlayerEscape(state, p);
				}
				if (state.status === 'playing' && !wasPending) {
					if (state.phase === 1) {
						progressPhase1Turn(state);
					} else {
						checkGameOverOrProgress(state);
					}
				}
			}
		}
	}
}

export function applyClearTrick(state: GameState): void {
	if (!state.trickWinnerId) return;

	if (state.phase === 1) {
		state.trickWinnerId = null;
		state.tablePile = [];
		state.tablePilePlayers = [];

		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted')) {
			transitionToPhase2(state);
		}
	} else {
		// Phase 2
		const burned = state.tablePile.flat();
		state.discardPile.push(...burned);
		state.tablePile = [];
		state.tablePilePlayers = [];
		state.trickWinnerId = null;
		checkGameOverOrProgress(state);
	}
}

// Private logic helpers
function drawReplacements(state: GameState, player: Player, count: number) {
	const targetHandSize = 3;
	const currentSize = player.hand.length;
	const toDraw = Math.max(count, targetHandSize - currentSize);
	for (let i = 0; i < toDraw; i++) {
		if (state.deck.length === 0) break;
		const nextCard = state.deck[state.deck.length - 1];
		state.deck = state.deck.slice(0, state.deck.length - 1);

		if (state.deck.length === 0) {
			state.hiddenTrumpStorage = { playerId: player.id, card: nextCard };
			logState(state, `${player.name} drew absolute last card.`);
		} else {
			player.hand = sortHand([...player.hand, nextCard]);
		}
	}
}

function progressPhase1Turn(state: GameState) {
	if (state.tieBreakerActive) {
		const subRoundPlays = state.tablePile.length - state.tieBreakerStartPileSize;
		if (subRoundPlays === state.tiedPlayerIds.length) {
			resolveTieBreaker(state);
		} else {
			const nextTiedId = state.tiedPlayerIds[subRoundPlays];
			const idx = state.players.findIndex(p => p.id === nextTiedId);
			state.activePlayerIdx = idx !== -1 ? idx : 0;
		}
	} else {
		const activeCount = state.players.filter(p => !p.isDone).length;
		if (state.tablePile.length === activeCount) {
			resolveNormalRoundPhase1(state);
		} else {
			let nextIdx = (state.activePlayerIdx + 1) % state.players.length;
			while (state.players[nextIdx].isDone) {
				nextIdx = (nextIdx + 1) % state.players.length;
			}
			state.activePlayerIdx = nextIdx;
		}
	}
}

function resolveNormalRoundPhase1(state: GameState) {
	let maxVal = -1;
	const plays: { playerId: string; val: number }[] = [];

	for (let i = 0; i < state.tablePile.length; i++) {
		const playerId = state.tablePilePlayers[i];
		const val = getValueNumeric(state.tablePile[i][0]);
		plays.push({ playerId, val });
		if (val > maxVal) {
			maxVal = val;
		}
	}

	const winners = plays.filter(p => p.val === maxVal);
	if (winners.length === 1) {
		const winnerId = winners[0].playerId;
		const winner = state.players.find(p => p.id === winnerId)!;

		winner.reserveStack = [...winner.reserveStack, ...state.tablePile.flat()];
		logState(state, `${winner.name} won trick with ${state.tablePile[plays.findIndex(p => p.playerId === winnerId)][0].value}s.`);

		state.trickWinnerId = winnerId;
		const idx = state.players.findIndex(p => p.id === winnerId);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	} else {
		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted')) {
			logState(state, `Tie occurred, deck empty. Transitioning to Phase 2.`);
			transitionToPhase2(state);
			return;
		}

		const tiedIds = winners.map(w => w.playerId);
		logState(state, `Tie for highest: ${tiedIds.map(id => state.players.find(p => p.id === id)!.name).join(', ')}. Tie-breaker starts.`);

		state.tieBreakerActive = true;
		state.tiedPlayerIds = tiedIds;
		state.tieBreakerStartPileSize = state.tablePile.length;
		const idx = state.players.findIndex(p => p.id === state.tiedPlayerIds[0]);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	}
}

function resolveTieBreaker(state: GameState) {
	const K = state.tiedPlayerIds.length;
	const subRoundBatches = state.tablePile.slice(state.tablePile.length - K);
	const subRoundPlayers = state.tablePilePlayers.slice(state.tablePilePlayers.length - K);

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
		const winner = state.players.find(p => p.id === winnerId)!;

		winner.reserveStack = [...winner.reserveStack, ...state.tablePile.flat()];
		logState(state, `${winner.name} won tie with ${subRoundBatches[plays.findIndex(p => p.playerId === winnerId)][0].value}.`);

		state.trickWinnerId = winnerId;
		const idx = state.players.findIndex(p => p.id === winnerId);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
		state.tieBreakerActive = false;
		state.tiedPlayerIds = [];
	} else {
		const newTiedIds = winners.map(w => w.playerId);

		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted')) {
			logState(state, `Tie occurred again, deck empty. Transitioning to Phase 2.`);
			transitionToPhase2(state);
			return;
		}

		logState(state, `Tied again: ${newTiedIds.map(id => state.players.find(p => p.id === id)!.name).join(', ')}. Another tie-breaker card required.`);

		state.tiedPlayerIds = newTiedIds;
		state.tieBreakerStartPileSize = state.tablePile.length;
		const idx = state.players.findIndex(p => p.id === state.tiedPlayerIds[0]);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	}
}

function transitionToPhase2(state: GameState) {
	state.phase = 2;
	logState(state, 'Transitioned to Phase 2: The Shedding.');

	const activePlayers = state.players.filter(p => p.inviteStatus === 'accepted');

	// 1. Calculate Constipated Skitgubbe: player who won all tricks in Phase 1.
	// This means only one active player has a non-empty reserveStack.
	const playersWithTricks = activePlayers.filter(p => p.reserveStack.length > 0);
	if (playersWithTricks.length === 1) {
		const constipatedPlayer = playersWithTricks[0];
		constipatedPlayer.isConstipated = true;
		logState(state, `${constipatedPlayer.name} is a Constipated Skitgubbe!`);
	}

	// 2. Pick up reserve stacks
	for (const p of state.players) {
		if (p.inviteStatus === 'accepted') {
			p.hand = sortHand([...p.hand, ...p.reserveStack]);
			p.reserveStack = [];
			logState(state, `${p.name} picked up reserve stack (${p.hand.length} cards).`);
		} else {
			p.hand = [];
			p.reserveStack = [];
		}
	}

	// 3. Calculate Sweetgubbe and Trumfman:
	// A player with 0 cards before the trump is added:
	// - If they own the hidden trump card: Trumfman (starts Phase 2 with only that card).
	// - Otherwise: Sweetgubbe (starts Phase 2 with 0 cards, escapes immediately).
	const trumpOwnerId = state.hiddenTrumpStorage?.playerId || null;
	for (const p of activePlayers) {
		if (p.hand.length === 0) {
			if (trumpOwnerId === p.id) {
				p.isTrumfman = true;
				logState(state, `${p.name} is a Trumfman!`);
			} else {
				p.isSweetgubbe = true;
				logState(state, `${p.name} is a Sweetgubbe!`);
			}
		}
	}

	// 4. Add Hidden Trump card
	if (state.hiddenTrumpStorage) {
		const { playerId, card } = state.hiddenTrumpStorage;
		const owner = state.players.find(p => p.id === playerId);

		state.trumpCard = card;
		logState(state, `Trump: ${card.value}${card.suit}.`);

		if (owner) {
			logState(state, `${owner.name} adds it and leads Phase 2.`);
			owner.hand = sortHand([...owner.hand, card]);
			const idx = state.players.findIndex(p => p.id === playerId);
			state.activePlayerIdx = idx !== -1 ? idx : 0;
		} else {
			logState(state, `Trump owner left. Defaulting turn to first player.`);
			const firstAcceptedIdx = state.players.findIndex(p => p.inviteStatus === 'accepted');
			state.activePlayerIdx = firstAcceptedIdx !== -1 ? firstAcceptedIdx : 0;
		}
	} else {
		const firstAcceptedIdx = state.players.findIndex(p => p.inviteStatus === 'accepted');
		state.activePlayerIdx = firstAcceptedIdx !== -1 ? firstAcceptedIdx : 0;
	}

	// 5. Calculate Mega Constipated Skitgubbe:
	// Everyone else becomes a Sweetgubbe (starts Phase 2 with 0 cards).
	if (activePlayers.length > 1) {
		const sweetgubbes = activePlayers.filter(p => p.isSweetgubbe);
		if (sweetgubbes.length === activePlayers.length - 1) {
			const megaPlayer = activePlayers.find(p => !p.isSweetgubbe);
			if (megaPlayer) {
				megaPlayer.isMegaConstipated = true;
				logState(state, `${megaPlayer.name} is a MEGA Constipated Skitgubbe!`);
			}
		}
	}

	state.tablePile = [];
	state.tablePilePlayers = [];
	state.discardPile = [];

	for (const p of state.players) {
		checkPlayerEscape(state, p);
	}
	checkGameOverOrProgress(state);
}

function checkPlayerEscape(state: GameState, player: Player) {
	if (player.hand.length === 0 && !player.isDone && player.inviteStatus === 'accepted') {
		player.isDone = true;
		logState(state, `${player.name} escaped.`);

		const remaining = state.players.filter(p => !p.isDone && p.inviteStatus === 'accepted');
		if (remaining.length === 1) {
			const loser = remaining[0];
			loser.isSkitgubbe = true;
			logState(state, `Game over! ${loser.name} is the Skitgubbe.`);
			state.status = 'ended';
		}
	}
}

function progressPhase2Turn(state: GameState) {
	const remaining = state.players.filter(p => !p.isDone);
	if (remaining.length <= 1) return;

	let nextIdx = (state.activePlayerIdx + 1) % state.players.length;
	while (state.players[nextIdx].isDone) {
		nextIdx = (nextIdx + 1) % state.players.length;
	}
	state.activePlayerIdx = nextIdx;
}

function checkGameOverOrProgress(state: GameState) {
	const remaining = state.players.filter(p => !p.isDone);
	if (remaining.length <= 1) return;
	if (state.players[state.activePlayerIdx].isDone) {
		progressPhase2Turn(state);
	}
}
