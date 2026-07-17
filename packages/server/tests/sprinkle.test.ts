import { describe, test, expect } from 'bun:test';
import type { GameState, Card, Player } from 'shared';
import { applySprinkle, applyPlayCards } from '../src/gameLogic.js';

// --- Small builders (same conventions as gameLogicRegression.test.ts) -------

const SUIT_CHARS: Record<string, string> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

let cardUid = 0;
function c(value: string, suitName: keyof typeof SUIT_CHARS = 'spades'): Card {
	return {
		id: `${suitName}-${value}-${cardUid++}`,
		value,
		suit: SUIT_CHARS[suitName],
		suitName,
		color: suitName === 'hearts' || suitName === 'diamonds' ? 'red' : 'black'
	} as Card;
}

function player(id: string, opts: Partial<Player> = {}): Player {
	return {
		id,
		name: id,
		color: '#3b82f6',
		hand: [],
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost: false,
		inviteStatus: 'accepted',
		...opts
	};
}

function makeState(players: Player[], opts: Partial<GameState> = {}): GameState {
	return {
		status: 'playing',
		phase: 1,
		activePlayerIdx: 0,
		players,
		deck: [],
		tablePile: [],
		tablePilePlayers: [],
		discardPile: [],
		trumpCard: null,
		hiddenTrumpStorage: null,
		logs: [],
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null,
		seq: 0,
		...opts
	};
}

// A 3-player phase-1 state where 'a' has just played a 5 and the turn moved
// to 'b'; 'a' still holds a second 5 that is legal to sprinkle.
function sprinkleState(): GameState {
	const state = makeState([player('a'), player('b'), player('c')]);
	state.players[0].hand = [c('5', 'spades'), c('5', 'hearts'), c('7')];
	state.players[1].hand = [c('6'), c('8'), c('9')];
	state.players[2].hand = [c('4'), c('10'), c('J')];
	state.deck = Array.from({ length: 12 }, (_, i) => c('3', i % 2 ? 'hearts' : 'clubs'));

	applyPlayCards(state, 'a', [state.players[0].hand[0].id]); // a plays 5♠
	expect(state.players[state.activePlayerIdx].id).toBe('b');
	return state;
}

describe('applySprinkle (strö) — out-of-turn add to an own played batch', () => {
	test('valid sprinkle appends to the matching batch, refills the hand, and keeps the turn', () => {
		const state = sprinkleState();
		const a = state.players[0];
		const five = a.hand.find((card) => card.value === '5')!;
		const handBefore = a.hand.length;
		const deckBefore = state.deck.length;

		applySprinkle(state, 'a', [five.id]);

		// The 5 landed in a's existing batch on the table
		expect(state.tablePile[0].map((card) => card.id)).toContain(five.id);
		expect(state.tablePile[0].length).toBe(2);
		// No new batch/slot was created — the round's play count is unchanged
		expect(state.tablePile.length).toBe(1);
		expect(state.tablePilePlayers).toEqual(['a']);
		// Hand refilled from the deck back to the same size
		expect(a.hand.length).toBe(handBefore);
		expect(a.hand.map((card) => card.id)).not.toContain(five.id);
		expect(state.deck.length).toBe(deckBefore - 1);
		// Sprinkling is out-of-turn by design: the turn stays with b
		expect(state.players[state.activePlayerIdx].id).toBe('b');
	});

	test('sprinkling clears a pending lastChanceCardId', () => {
		const state = sprinkleState();
		state.lastChanceCardId = 'stale-chance-id';
		const five = state.players[0].hand.find((card) => card.value === '5')!;

		applySprinkle(state, 'a', [five.id]);
		expect(state.lastChanceCardId).toBeNull();
	});

	test('rejects a mixed-value selection', () => {
		const state = sprinkleState();
		const a = state.players[0];
		const ids = a.hand.map((card) => card.id); // 5 and 7 — mixed values
		const before = JSON.stringify(state);

		applySprinkle(state, 'a', ids);
		expect(JSON.stringify(state)).toBe(before);
	});

	test('rejects when the player has no matching batch of that value on the table', () => {
		const state = sprinkleState();
		const a = state.players[0];
		const seven = a.hand.find((card) => card.value === '7')!;
		const before = JSON.stringify(state);

		applySprinkle(state, 'a', [seven.id]);
		expect(JSON.stringify(state)).toBe(before);
	});

	test("rejects sprinkling onto another player's batch of the same value", () => {
		const state = sprinkleState();
		// b plays a 6; c holds a 6 but never played one this round
		const b = state.players[1];
		applyPlayCards(state, 'b', [b.hand.find((card) => card.value === '6')!.id]);
		const cPlayer = state.players[2];
		cPlayer.hand = [c('6', 'diamonds'), ...cPlayer.hand];
		const before = JSON.stringify(state);

		applySprinkle(state, 'c', [cPlayer.hand[0].id]);
		expect(JSON.stringify(state)).toBe(before);
	});

	test('rejects while a trick winner is pending', () => {
		const state = sprinkleState();
		state.trickWinnerId = 'a';
		const five = state.players[0].hand.find((card) => card.value === '5')!;
		const batchBefore = state.tablePile[0].length;

		applySprinkle(state, 'a', [five.id]);
		expect(state.tablePile[0].length).toBe(batchBefore);
	});

	test('rejects in phase 2', () => {
		const state = sprinkleState();
		state.phase = 2;
		const five = state.players[0].hand.find((card) => card.value === '5')!;
		const batchBefore = state.tablePile[0].length;

		applySprinkle(state, 'a', [five.id]);
		expect(state.tablePile[0].length).toBe(batchBefore);
	});

	test('rejects card ids that are not in the hand, and empty selections', () => {
		const state = sprinkleState();
		const before = JSON.stringify(state);

		applySprinkle(state, 'a', ['not-a-real-card']);
		applySprinkle(state, 'a', []);
		expect(JSON.stringify(state)).toBe(before);
	});

	test('sprinkling multiple cards at once appends all of them and refills the hand', () => {
		const state = makeState([player('a'), player('b')]);
		state.players[0].hand = [c('5', 'spades'), c('5', 'hearts'), c('5', 'diamonds'), c('7')];
		state.players[1].hand = [c('6'), c('8'), c('9')];
		state.deck = Array.from({ length: 12 }, (_, i) => c('3', i % 2 ? 'hearts' : 'clubs'));

		const a = state.players[0];
		applyPlayCards(state, 'a', [a.hand[0].id]); // play one 5

		const remainingFives = a.hand.filter((card) => card.value === '5').map((card) => card.id);
		expect(remainingFives.length).toBe(2);

		applySprinkle(state, 'a', remainingFives);

		expect(state.tablePile[0].length).toBe(3);
		// Hand refilled to at least the 3-card target
		expect(a.hand.length).toBeGreaterThanOrEqual(3);
		expect(a.hand.some((card) => card.value === '5')).toBe(false);
	});
});
