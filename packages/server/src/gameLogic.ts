import type { GameState, Card, Player } from 'shared';
import { sortHand, getValueNumeric } from 'shared';

// Helper to log message to state.logs
function logState(state: GameState, message: string) {
	state.logs.push(message);
	if (state.logs.length > 80) {
		state.logs.shift();
	}
}

// A player the turn rotation must skip: they escaped in Phase 2 (isDone) or
// left the game mid-play (hasLeft). Pending invitees are deliberately NOT
// skipped — they hold the turn by design until they accept or decline.
function isSkipped(player: Player): boolean {
	return player.isDone || !!player.hasLeft;
}

// Players who can still act in the current phase.
function activeCount(state: GameState): number {
	return state.players.filter(p => !isSkipped(p)).length;
}

// Players still contending in the current phase-2 trick: anyone not yet
// escaped/left, plus a player who escaped mid-trick but still has a staged
// batch on the table (their cards still count toward flipping the trick).
function trickParticipantCount(state: GameState): number {
	return state.players.filter(
		p => !isSkipped(p) || state.tablePilePlayers.includes(p.id)
	).length;
}

export function applyStartGame(state: GameState, initialDeck: Card[]): void {
	const newDeck = [...initialDeck];
	for (const p of state.players) {
		if (p.inviteStatus === 'accepted') {
			p.hand = sortHand(newDeck.splice(-3));
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
	state.logs = [`Spelet startar. Fas 1: ${state.players[0]?.name || 'Host'}s tur.`];
	state.phase = 1;
	state.activePlayerIdx = 0;
	state.tieBreakerActive = false;
	state.tiedPlayerIds = [];
	state.tieBreakerStartPileSize = 0;
	state.trickWinnerId = null;
	state.status = 'playing';
}

export function applyPlayCards(state: GameState, playerId: string, cardIds: string[], debugForce?: boolean): void {
	if (state.status !== 'playing') return;

	const activePlayer = state.players.find(p => p.id === playerId);
	if (!activePlayer) return;

	if (!debugForce) {
		const currentActive = state.players[state.activePlayerIdx];
		if (currentActive.id !== playerId || state.trickWinnerId !== null) return;
	}

	const selectedCards = activePlayer.hand.filter(c => cardIds.includes(c.id));
	if (selectedCards.length !== cardIds.length) return;

	activePlayer.hand = sortHand(activePlayer.hand.filter(c => !cardIds.includes(c.id)));

	if (state.phase === 1) {
		state.tablePile.push(selectedCards);
		state.tablePilePlayers.push(playerId);
		logState(state, `${activePlayer.name} la: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

		drawReplacements(state, activePlayer, selectedCards.length);
		progressPhase1Turn(state);
	} else {
		const sorted = [...selectedCards].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		state.tablePile.push(sorted);
		state.tablePilePlayers.push(playerId);
		logState(state, `${activePlayer.name} la: ${sorted.map(c => c.value + c.suit).join(' ')}`);

		checkPlayerEscape(state, activePlayer);

		if (state.tablePile.length === trickParticipantCount(state)) {
			logState(state, `${activePlayer.name} vände korten.`);
			state.trickWinnerId = playerId;
		} else {
			progressPhase2Turn(state);
		}
	}
}

export function applyPickUp(state: GameState, playerId: string, debugForce?: boolean): void {
	if (state.status !== 'playing' || state.phase !== 2 || (state.trickWinnerId !== null && !debugForce)) return;

	const activePlayer = state.players.find(p => p.id === playerId);
	if (!activePlayer) return;
	if (!debugForce) {
		const currentActive = state.players[state.activePlayerIdx];
		if (currentActive.id !== playerId) return;
	}

	if (state.tablePile.length === 0) return;

	const oldestBatch = state.tablePile[0];
	const oldestPlayerId = state.tablePilePlayers[0];
	const oldestPlayer = state.players.find(p => p.id === oldestPlayerId);
	const oldestName = oldestPlayer ? oldestPlayer.name : 'a departed player';

	activePlayer.hand = sortHand([...activePlayer.hand, ...oldestBatch]);
	state.tablePile = state.tablePile.slice(1);
	state.tablePilePlayers = state.tablePilePlayers.slice(1);

	logState(state, `${activePlayer.name} plockade upp ${oldestBatch.map(c => c.value + c.suit).join(' ')} från ${oldestName}.`);

	progressPhase2Turn(state);
}

export function applyChance(state: GameState, playerId: string, drawnCard: Card, debugForce?: boolean): void {
	if (state.status !== 'playing' || state.phase !== 1 || (state.trickWinnerId !== null && !debugForce)) return;

	const activePlayer = state.players.find(p => p.id === playerId);
	if (!activePlayer) return;
	if (!debugForce) {
		const currentActive = state.players[state.activePlayerIdx];
		if (currentActive.id !== playerId) return;
	}

	if (state.deck.length === 0) return;

	// In logic, the drawnCard is passed, and we verify it is the top card of the deck
	const poppedCard = state.deck.pop();
	if (!poppedCard) {
		throw new Error("Cannot draw from an empty deck.");
	}
	if (poppedCard.value !== drawnCard.value || poppedCard.suit !== drawnCard.suit) {
		throw new Error(
			`Replay integrity violation: drawn card (${drawnCard.value}${drawnCard.suit}) does not match the card popped from the deck (${poppedCard.value}${poppedCard.suit}).`
		);
	}

	state.tablePile.push([drawnCard]);
	state.tablePilePlayers.push(playerId);

	logState(state, `${activePlayer.name} chansade från högen: ${drawnCard.value}${drawnCard.suit}.`);

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

	logState(state, `${player.name} strödde: ${selectedCards.map(c => c.value + c.suit).join(' ')}`);

	drawReplacements(state, player, selectedCards.length);
}

export function applyJoin(state: GameState, playerId: string, name: string, color: string): void {
	// Reconnection / Acceptance / Mid-game join
	const existingPlayer = state.players.find(p => p.id === playerId);
	if (existingPlayer) {
		if (existingPlayer.inviteStatus === 'pending') {
			existingPlayer.inviteStatus = 'accepted';
			logState(state, `${existingPlayer.name} accepterade inbjudan.`);

			if (state.status === 'playing') {
				const dealCount = Math.min(3, state.deck.length);
				if (dealCount > 0) {
					existingPlayer.hand = sortHand(state.deck.splice(-dealCount));
					logState(state, `Delade ut ${dealCount} kort till ${existingPlayer.name}.`);
				} else {
					logState(state, `${existingPlayer.name} Gick med men inga kort fanns kvar i leken.`);
					// Nothing to deal — the player can never act, so they escape
					// immediately; otherwise the game would wait on them forever.
					checkPlayerEscape(state, existingPlayer);
					if (
						state.status === 'playing' &&
						state.players[state.activePlayerIdx]?.id === existingPlayer.id
					) {
						if (state.phase === 1) {
							progressPhase1Turn(state);
						} else {
							progressPhase2Turn(state);
						}
					}
				}
			}
		} else {
			logState(state, `${existingPlayer.name} gick in.`);
		}
		return;
	}

	// Not in the roster — always a spectator. Games are created with their
	// full roster (legacy waiting-lobby joins no longer exist).
	logState(state, `${name} gick med som åskådare.`);
}

export function applyDecline(state: GameState, playerId: string): void {
	const idx = state.players.findIndex(p => p.id === playerId);
	if (idx === -1) return;

	const player = state.players[idx];
	const declinedPlayerName = player.name;
	const wasActive = state.activePlayerIdx === idx;
	const wasPending = player.inviteStatus === 'pending';

	if (state.status === 'playing' && !wasPending) {
		// An accepted player left an in-progress game. They stay in the roster
		// (rendered grayed-out) but are skipped forever from here on; the cards
		// they were holding are simply discarded.
		player.hasLeft = true;
		player.hand = [];
		player.reserveStack = [];
		removeLeftPlayerCards(state, playerId);
		logState(state, `${player.name} lämnade spelet.`);
	} else {
		state.players.splice(idx, 1);
		logState(state, `${declinedPlayerName} tackade nej till inbjudan eller blev borttagen`);

		// Adjust activePlayerIdx if it was pointed at or after the removed player
		if (state.players.length === 0) {
			state.activePlayerIdx = 0;
		} else if (wasActive) {
			state.activePlayerIdx = idx % state.players.length;
		} else if (state.activePlayerIdx > idx) {
			state.activePlayerIdx = state.activePlayerIdx - 1;
		}
	}

	if (state.status !== 'playing') return;

	// End the game once fewer than two players are still able to act.
	const stillActive = state.players.filter(p => !p.hasLeft).length;
	if (stillActive <= 1) {
		state.status = 'ended';
		logState(state, `Alla andra spelare tackade nej eller lämnade spelet. Spelet avslutas.`);
		return;
	}

	for (const p of state.players) {
		checkPlayerEscape(state, p);
	}
	if (state.status !== 'playing') return;

	// Move the turn off the departed/removed player, and finish a trick that
	// the departure may have completed.
	const turnOnSkippedPlayer =
		!wasPending && (wasActive || isSkipped(state.players[state.activePlayerIdx]));

	if (state.phase === 1) {
		// If the departure just resolved a trick (degenerate tie-breaker), the
		// winner holds the turn until the trick clears — don't progress past them.
		if (turnOnSkippedPlayer && state.trickWinnerId === null) {
			progressPhase1Turn(state);
		}
	} else if (state.trickWinnerId === null) {
		if (state.tablePile.length > 0 && state.tablePile.length === trickParticipantCount(state)) {
			// The departure emptied the last outstanding slot — flip the trick.
			state.trickWinnerId = state.tablePilePlayers[state.tablePilePlayers.length - 1];
			logState(state, `Korten vänds.`);
		} else if (turnOnSkippedPlayer) {
			checkGameOverOrProgress(state);
		}
	}
}

export function applyClearTrick(state: GameState): void {
	if (!state.trickWinnerId) return;

	if (state.phase === 1) {
		state.trickWinnerId = null;
		state.tablePile = [];
		state.tablePilePlayers = [];

		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted' && !p.hasLeft)) {
			transitionToPhase2(state);
		} else if (
			state.status === 'playing' &&
			state.players.length > 0 &&
			isSkipped(state.players[state.activePlayerIdx])
		) {
			// The trick winner left while the trick was pending — move the turn
			// off them, or the game waits forever on a departed player.
			progressPhase1Turn(state);
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
function removeLeftPlayerCards(state: GameState, playerId: string): void {
	// Drop any batches this player already staged on the table this round, so a
	// departed player can never win a trick or end up holding the turn.
	const keptPile: Card[][] = [];
	const keptPlayers: string[] = [];
	let removedBeforeTieStart = 0;
	for (let i = 0; i < state.tablePile.length; i++) {
		if (state.tablePilePlayers[i] === playerId) {
			if (i < state.tieBreakerStartPileSize) {
				removedBeforeTieStart++;
			}
			continue;
		}
		keptPile.push(state.tablePile[i]);
		keptPlayers.push(state.tablePilePlayers[i]);
	}
	state.tablePile = keptPile;
	state.tablePilePlayers = keptPlayers;

	if (state.tieBreakerActive) {
		// Only batches removed from before the sub-round shift its start offset;
		// a removed tie-breaker play is accounted for by shrinking tiedPlayerIds,
		// keeping `tablePile.length - tieBreakerStartPileSize` (sub-round plays)
		// and resolveTieBreaker's tail slice consistent.
		state.tieBreakerStartPileSize = Math.max(0, state.tieBreakerStartPileSize - removedBeforeTieStart);
		state.tiedPlayerIds = state.tiedPlayerIds.filter(id => id !== playerId);
		if (state.tiedPlayerIds.length < 2) {
			resolveDegenerateTieBreaker(state);
		}
	}
}

// A tie-breaker with fewer than two contenders left cannot be decided by
// play — resolve it on the spot.
function resolveDegenerateTieBreaker(state: GameState): void {
	const soleTiedId = state.tiedPlayerIds[0] ?? null;
	state.tieBreakerActive = false;
	state.tiedPlayerIds = [];
	state.tieBreakerStartPileSize = 0;

	const winner = soleTiedId ? state.players.find(p => p.id === soleTiedId) : undefined;
	if (winner) {
		winner.reserveStack = [...winner.reserveStack, ...state.tablePile.flat()];
		logState(state, `${winner.name} vann rundan eftersom övriga i tie-breakern lämnade.`);
		state.trickWinnerId = winner.id;
		const idx = state.players.indexOf(winner);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	} else {
		// Every tied player left; hand the staged batches back to their owners
		// and let the round restart.
		distributeTablePileBack(state);
	}
}

function drawReplacements(state: GameState, player: Player, count: number) {
	const targetHandSize = 3;
	const currentSize = player.hand.length;
	const toDraw = Math.max(count, targetHandSize - currentSize);
	for (let i = 0; i < toDraw; i++) {
		const nextCard = state.deck.pop();
		if (!nextCard) break;

		if (state.deck.length === 0) {
			state.hiddenTrumpStorage = { playerId: player.id, card: nextCard };
			logState(state, `${player.name} drog trumfet.`);
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
		if (state.tablePile.length === activeCount(state)) {
			resolveNormalRoundPhase1(state);
		} else {
			const remaining = state.players.filter(p => !isSkipped(p));
			if (remaining.length <= 1) {
				if (remaining.length === 1) {
					const idx = state.players.indexOf(remaining[0]);
					if (idx !== -1) {
						state.activePlayerIdx = idx;
					}
				}
			} else {
				let nextIdx = (state.activePlayerIdx + 1) % state.players.length;
				const startIdx = nextIdx;
				while (isSkipped(state.players[nextIdx])) {
					nextIdx = (nextIdx + 1) % state.players.length;
					if (nextIdx === startIdx) {
						break;
					}
				}
				state.activePlayerIdx = nextIdx;
			}
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
		logState(state, `${winner.name} tog korten med ${state.tablePile[plays.findIndex(p => p.playerId === winnerId)][0].value}.`);

		state.trickWinnerId = winnerId;
		const idx = state.players.findIndex(p => p.id === winnerId);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	} else {
		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted' && !p.hasLeft)) {
			logState(state, `Lika kort, men leken är tom. Fas 2 startar.`);
			distributeTablePileBack(state);
			transitionToPhase2(state);
			return;
		}

		const tiedIds = winners.map(w => w.playerId);
		logState(state, `Lika kort för ${tiedIds.map(id => state.players.find(p => p.id === id)!.name).join(', ')}. Tie-breaker startar.`);

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
		logState(state, `${winner.name} vann tie-breaker med ${subRoundBatches[plays.findIndex(p => p.playerId === winnerId)][0].value}.`);

		state.trickWinnerId = winnerId;
		const idx = state.players.findIndex(p => p.id === winnerId);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
		state.tieBreakerActive = false;
		state.tiedPlayerIds = [];
	} else {
		const newTiedIds = winners.map(w => w.playerId);

		if (state.deck.length === 0 && state.players.some(p => p.hand.length === 0 && p.inviteStatus === 'accepted' && !p.hasLeft)) {
			logState(state, `Lika igen, men leken är tom. Fas 2 startar.`);
			distributeTablePileBack(state);
			transitionToPhase2(state);
			return;
		}

		logState(state, `Lika igen: ${newTiedIds.map(id => state.players.find(p => p.id === id)!.name).join(', ')}. Nytt tie-breaker kort krävs.`);

		state.tiedPlayerIds = newTiedIds;
		state.tieBreakerStartPileSize = state.tablePile.length;
		const idx = state.players.findIndex(p => p.id === state.tiedPlayerIds[0]);
		state.activePlayerIdx = idx !== -1 ? idx : 0;
	}
}

function distributeTablePileBack(state: GameState) {
	for (let i = 0; i < state.tablePile.length; i++) {
		const playerId = state.tablePilePlayers[i];
		const player = state.players.find(p => p.id === playerId);
		if (player) {
			player.reserveStack = [...player.reserveStack, ...state.tablePile[i]];
		}
	}
	state.tablePile = [];
	state.tablePilePlayers = [];
	logState(state, `Spelarna tar tillbaka sina lagda kort.`);
}

function transitionToPhase2(state: GameState) {
	state.phase = 2;
	logState(state, 'Fas 2 startar:');

	const activePlayers = state.players.filter(p => p.inviteStatus === 'accepted' && !p.hasLeft);

	// 1. Calculate Constipated Skitgubbe: player who won all tricks in Phase 1.
	// This means only one active player has a non-empty reserveStack.
	const playersWithTricks = activePlayers.filter(p => p.reserveStack.length > 0);
	if (playersWithTricks.length === 1) {
		const constipatedPlayer = playersWithTricks[0];
		constipatedPlayer.isConstipated = true;
		logState(state, `${constipatedPlayer.name} är en förstoppad Skitgubbe!`);
	}

	// 2. Pick up reserve stacks
	for (const p of state.players) {
		if (p.inviteStatus === 'accepted' && !p.hasLeft) {
			p.hand = sortHand([...p.hand, ...p.reserveStack]);
			p.reserveStack = [];
			logState(state, `${p.name} plockade reservkort, (${p.hand.length} kort).`);
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
				logState(state, `${p.name} är en Trumfman!`);
			} else {
				p.isSweetgubbe = true;
				logState(state, `${p.name} är en Sweetgubbe!`);
			}
		}
	}

	// 4. Add Hidden Trump card
	if (state.hiddenTrumpStorage) {
		const { playerId, card } = state.hiddenTrumpStorage;
		const owner = state.players.find(p => p.id === playerId);

		state.trumpCard = card;
		logState(state, `Trumf: ${card.value}${card.suit}.`);

		if (owner) {
			logState(state, `${owner.name} vänder trumfet och startar fas 2.`);
			owner.hand = sortHand([...owner.hand, card]);
			const idx = state.players.findIndex(p => p.id === playerId);
			state.activePlayerIdx = idx !== -1 ? idx : 0;
		} else {
			logState(state, `Trumf-ägaren har lämnat. Spelet fortsätter med första spelaren.`);
			const firstAcceptedIdx = state.players.findIndex(p => p.inviteStatus === 'accepted' && !p.hasLeft);
			state.activePlayerIdx = firstAcceptedIdx !== -1 ? firstAcceptedIdx : 0;
		}
	} else {
		const firstAcceptedIdx = state.players.findIndex(p => p.inviteStatus === 'accepted' && !p.hasLeft);
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
				logState(state, `${megaPlayer.name} är en MEGA förstoppad Skitgubbe!`);
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
	if (player.hand.length === 0 && !player.isDone && !player.hasLeft && player.inviteStatus === 'accepted') {
		player.isDone = true;
		logState(state, `${player.name} tog sig ut.`);

		const remaining = state.players.filter(p => !p.isDone && !p.hasLeft && p.inviteStatus === 'accepted');
		if (remaining.length === 1) {
			const loser = remaining[0];
			loser.isSkitgubbe = true;
			logState(state, `Spelet är slut! ${loser.name} är Skitgubbe.`);
			state.status = 'ended';
		}
	}
}

function progressPhase2Turn(state: GameState) {
	const remaining = state.players.filter(p => !p.isDone && !p.hasLeft);
	if (remaining.length <= 1) return;

	let nextIdx = (state.activePlayerIdx + 1) % state.players.length;
	while (isSkipped(state.players[nextIdx])) {
		nextIdx = (nextIdx + 1) % state.players.length;
	}
	state.activePlayerIdx = nextIdx;
}

function checkGameOverOrProgress(state: GameState) {
	const remaining = state.players.filter(p => !p.isDone && !p.hasLeft);
	if (remaining.length <= 1) return;
	if (isSkipped(state.players[state.activePlayerIdx])) {
		progressPhase2Turn(state);
	}
}
