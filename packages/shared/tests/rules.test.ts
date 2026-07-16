import { describe, test, expect } from 'bun:test';
import {
	getValueNumeric,
	sortHand,
	createDeck,
	isValidPlay,
	getLegalPlays,
	getLegalPlaysPhase1,
	type Card
} from '../src/index.js';

const deck = createDeck();
const card = (id: string): Card => {
	const found = deck.find((c) => c.id === id);
	if (!found) throw new Error(`No such card: ${id}`);
	return found;
};

describe('Skitgubbe Shared Rules & Helpers', () => {
	test('getValueNumeric returns correct relative rankings', () => {
		const card2: Card = { id: 'c-2', suit: '♣', value: '2', suitName: 'clubs', color: 'black' };
		const cardA: Card = { id: 's-A', suit: '♠', value: 'A', suitName: 'spades', color: 'black' };
		const card10: Card = { id: 'h-10', suit: '♥', value: '10', suitName: 'hearts', color: 'red' };

		expect(getValueNumeric(card2)).toBe(2);
		expect(getValueNumeric(cardA)).toBe(14);
		expect(getValueNumeric(card10)).toBe(10);
	});

	test('createDeck creates exactly 52 cards', () => {
		const deck = createDeck();
		expect(deck.length).toBe(52);

		// Ensure 13 cards of each suit
		const spades = deck.filter((c) => c.suitName === 'spades');
		expect(spades.length).toBe(13);
	});

	test('sortHand arranges cards by suit and ascending value', () => {
		const card1: Card = { id: 'c-10', suit: '♣', value: '10', suitName: 'clubs', color: 'black' };
		const card2: Card = { id: 's-2', suit: '♠', value: '2', suitName: 'spades', color: 'black' };
		const card3: Card = { id: 's-A', suit: '♠', value: 'A', suitName: 'spades', color: 'black' };

		// SUITS_ORDER is ['spades', 'hearts', 'diamonds', 'clubs']
		// Expected sort order: spades-2, spades-A, clubs-10
		const sorted = sortHand([card1, card2, card3]);
		expect(sorted[0].id).toBe('s-2');
		expect(sorted[1].id).toBe('s-A');
		expect(sorted[2].id).toBe('c-10');
	});

	describe('isValidPlay rules validation', () => {
		// Phase 1 tests
		test('Phase 1 accepts multiples of the same value', () => {
			const selected: Card[] = [
				{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' },
				{ id: 'h-8', suit: '♥', value: '8', suitName: 'hearts', color: 'red' }
			];

			const valid = isValidPlay(selected, [], 1, null);
			expect(valid).toBe(true);
		});

		test('Phase 1 rejects mismatched values', () => {
			const selected: Card[] = [
				{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' },
				{ id: 'h-9', suit: '♥', value: '9', suitName: 'hearts', color: 'red' }
			];

			const valid = isValidPlay(selected, [], 1, null);
			expect(valid).toBe(false);
		});

		test('Phase 1 tiebreaker accepts multiples of the same value', () => {
			const selected: Card[] = [
				{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' },
				{ id: 'h-8', suit: '♥', value: '8', suitName: 'hearts', color: 'red' }
			];

			const valid = isValidPlay(selected, [], 1, null);
			expect(valid).toBe(true);
		});

		test('Phase 1 tiebreaker rejects mismatched values', () => {
			const selected: Card[] = [
				{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' },
				{ id: 'h-9', suit: '♥', value: '9', suitName: 'hearts', color: 'red' }
			];

			const valid = isValidPlay(selected, [], 1, null);
			expect(valid).toBe(false);
		});

		// Phase 2 tests
		test('Phase 2 allows playing a higher value of the same suit', () => {
			const selected: Card[] = [
				{ id: 's-10', suit: '♠', value: '10', suitName: 'spades', color: 'black' }
			];
			const table: Card[][] = [
				[{ id: 's-7', suit: '♠', value: '7', suitName: 'spades', color: 'black' }]
			];

			const valid = isValidPlay(selected, table, 2, null);
			expect(valid).toBe(true);
		});

		test('Phase 2 rejects playing a lower value of the same suit', () => {
			const selected: Card[] = [
				{ id: 's-5', suit: '♠', value: '5', suitName: 'spades', color: 'black' }
			];
			const table: Card[][] = [
				[{ id: 's-7', suit: '♠', value: '7', suitName: 'spades', color: 'black' }]
			];

			const valid = isValidPlay(selected, table, 2, null);
			expect(valid).toBe(false);
		});

		test('Phase 2 allows trump to beat any normal suit', () => {
			const selected: Card[] = [
				{ id: 'h-2', suit: '♥', value: '2', suitName: 'hearts', color: 'red' } // Trump Suit
			];
			const table: Card[][] = [
				[{ id: 's-A', suit: '♠', value: 'A', suitName: 'spades', color: 'black' }] // High normal card
			];

			const valid = isValidPlay(selected, table, 2, 'hearts');
			expect(valid).toBe(true);
		});
	});

	describe('getLegalPlaysPhase1', () => {
		test('empty hand has no plays', () => {
			expect(getLegalPlaysPhase1([])).toEqual([]);
		});

		test('offers one play per value and group size', () => {
			const hand = [card('spades-7'), card('hearts-7'), card('clubs-K')];
			const plays = getLegalPlaysPhase1(hand);

			// 7 alone, both 7s, K alone
			expect(plays).toHaveLength(3);
			const sizesByValue = plays.map((p) => `${p[0].value}x${p.length}`).sort();
			expect(sizesByValue).toEqual(['7x1', '7x2', 'Kx1']);
		});

		test('every play is valid under phase-1 rules and drawn from the hand', () => {
			const hand = [card('spades-7'), card('hearts-7'), card('diamonds-7'), card('clubs-2')];
			for (const play of getLegalPlaysPhase1(hand)) {
				expect(isValidPlay(play, [], 1, null)).toBe(true);
				for (const c of play) {
					expect(hand).toContain(c);
				}
			}
		});
	});

	describe('getLegalPlays (phase 2)', () => {
		test('empty table: every single card is legal, plus runs', () => {
			const hand = [card('spades-5'), card('spades-6'), card('hearts-9')];
			const plays = getLegalPlays(hand, [], 'clubs');

			// 3 singles + the 5-6 run
			expect(plays).toHaveLength(4);
			const run = plays.find((p) => p.length === 2);
			expect(run?.map((c) => c.id).sort()).toEqual(['spades-5', 'spades-6']);
		});

		test('must beat the top card in suit, or trump it', () => {
			const table = [[card('hearts-10')]];
			const hand = [card('hearts-9'), card('hearts-J'), card('clubs-3'), card('diamonds-A')];
			const plays = getLegalPlays(hand, table, 'clubs');

			const ids = plays.map((p) => p.map((c) => c.id).join('+')).sort();
			expect(ids).toEqual(['clubs-3', 'hearts-J']);
		});

		test('a trumped table only accepts higher trumps', () => {
			const table = [[card('clubs-10')]];
			const hand = [card('clubs-9'), card('clubs-J'), card('spades-A')];
			const plays = getLegalPlays(hand, table, 'clubs');

			expect(plays.map((p) => p[0].id)).toEqual(['clubs-J']);
		});

		test('every play it returns passes isValidPlay, including multi-card runs', () => {
			const table = [[card('diamonds-4')]];
			const hand = [
				card('diamonds-5'),
				card('diamonds-6'),
				card('diamonds-7'),
				card('clubs-2'),
				card('hearts-K')
			];
			const plays = getLegalPlays(hand, table, 'clubs');
			expect(plays.some((p) => p.length > 1)).toBe(true);
			for (const play of plays) {
				expect(isValidPlay(play, table, 2, 'clubs')).toBe(true);
			}
		});
	});
});
