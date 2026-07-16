import { describe, test, expect } from 'bun:test';
import { cardToInt, intToCard, deckToString, deckFromString, cardsToString, cardsFromString, createDeck } from '../src/index.js';

describe('Skitgubbe Card Codec', () => {
	test('round-trip encode and decode for all 52 cards', () => {
		const deck = createDeck();
		expect(deck.length).toBe(52);

		for (const card of deck) {
			const encoded = cardToInt(card);
			expect(encoded).toBeGreaterThanOrEqual(0);
			expect(encoded).toBeLessThanOrEqual(51);

			const decoded = intToCard(encoded);
			expect(decoded.id).toBe(card.id);
			expect(decoded.value).toBe(card.value);
			expect(decoded.suitName).toBe(card.suitName);
			expect(decoded.suit).toBe(card.suit);
			expect(decoded.color).toBe(card.color);
		}
	});

	test('deck serialization and deserialization', () => {
		const deck = createDeck();
		const serialized = deckToString(deck);
		const deserialized = deckFromString(serialized);

		expect(deserialized.length).toBe(52);
		for (let i = 0; i < 52; i++) {
			expect(deserialized[i].id).toBe(deck[i].id);
		}
	});

	test('empty collections return empty arrays', () => {
		expect(deckFromString('')).toEqual([]);
		expect(cardsFromString('')).toEqual([]);
		expect(deckToString([])).toBe('');
		expect(cardsToString([])).toBe('');
	});

	test('deckFromString with invalid input throws a clear error', () => {
		expect(() => deckFromString('x,y')).toThrow('Invalid card integer: NaN');
	});
});
