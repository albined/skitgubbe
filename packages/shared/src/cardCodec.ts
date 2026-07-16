import type { Card } from './types.js';
import { VALUES_ORDER, SUITS_ORDER } from './types.js';

const SUITS_MAP = {
	spades: { symbol: '♠', color: 'black' },
	hearts: { symbol: '♥', color: 'red' },
	diamonds: { symbol: '♦', color: 'red' },
	clubs: { symbol: '♣', color: 'black' }
} as const;

export function cardToInt(card: Card): number {
	const suitIdx = SUITS_ORDER.indexOf(card.suitName);
	const valIdx = VALUES_ORDER.indexOf(card.value);
	if (suitIdx === -1 || valIdx === -1) {
		throw new Error(`Invalid card for encoding: ${JSON.stringify(card)}`);
	}
	return suitIdx * 13 + valIdx;
}

export function intToCard(n: number): Card {
	if (!Number.isInteger(n) || n < 0 || n > 51) {
		throw new Error(`Invalid card integer: ${n}`);
	}
	const suitIdx = Math.floor(n / 13);
	const valIdx = n % 13;

	const suitName = SUITS_ORDER[suitIdx];
	const value = VALUES_ORDER[valIdx];
	const suitInfo = SUITS_MAP[suitName];

	return {
		id: `${suitName}-${value}`,
		suit: suitInfo.symbol,
		value,
		suitName,
		color: suitInfo.color
	};
}

export function deckToString(deck: Card[]): string {
	return deck.map(cardToInt).join(',');
}

export function deckFromString(s: string): Card[] {
	if (!s) return [];
	return s.split(',').map((n) => intToCard(parseInt(n, 10)));
}

export function cardsToString(cards: Card[]): string {
	return cards.map(cardToInt).join(',');
}

export function cardsFromString(s: string): Card[] {
	if (!s) return [];
	return s.split(',').map((n) => intToCard(parseInt(n, 10)));
}
