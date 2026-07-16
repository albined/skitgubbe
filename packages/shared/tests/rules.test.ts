import { describe, test, expect } from 'bun:test';
import { getValueNumeric, sortHand, createDeck, isValidPlay, type Card } from '../src/index.js';

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
		const spades = deck.filter(c => c.suitName === 'spades');
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
});
