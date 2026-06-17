import type { Card } from './types.js';

export const VALUES_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS_ORDER = ['spades', 'hearts', 'diamonds', 'clubs'];

export function getValueNumeric(card: Card): number {
	return VALUES_ORDER.indexOf(card.value) + 2;
}

export function sortHand(hand: Card[]): Card[] {
	return [...hand].sort((a, b) => {
		const suitDiff = SUITS_ORDER.indexOf(a.suitName) - SUITS_ORDER.indexOf(b.suitName);
		if (suitDiff !== 0) return suitDiff;
		return getValueNumeric(a) - getValueNumeric(b);
	});
}

export function createDeck(): Card[] {
	const suits = [
		{ symbol: '♠', name: 'spades', color: 'black' },
		{ symbol: '♥', name: 'hearts', color: 'red' },
		{ symbol: '♦', name: 'diamonds', color: 'red' },
		{ symbol: '♣', name: 'clubs', color: 'black' }
	] as const;
	const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
	const newDeck: Card[] = [];

	for (const suit of suits) {
		for (const value of values) {
			newDeck.push({
				id: `${suit.name}-${value}`,
				suit: suit.symbol,
				value,
				suitName: suit.name,
				color: suit.color
			});
		}
	}
	return newDeck;
}

export function shuffle(array: Card[]): Card[] {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function isValidPlay(
	selected: Card[],
	handCards: Card[],
	table: Card[][],
	currPhase: number,
	isTie: boolean,
	tiedIds: string[],
	playerId: string,
	tSuit: string | null
): boolean {
	if (selected.length === 0) return false;

	if (currPhase === 1) {
		// Phase 1 (including tie-breaker) requires all played cards to be of the same value
		const firstVal = selected[0].value;
		return selected.every(c => c.value === firstVal);
	}

	if (currPhase === 2) {
		// Phase 2 requires same suit cards in a sequential order, or Trump Suit cards
		const suit = selected[0].suitName;
		if (!selected.every(c => c.suitName === suit)) return false;

		// Sort selected cards numerically
		const sorted = [...selected].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		
		// Verify sequential values
		for (let i = 0; i < sorted.length - 1; i++) {
			if (getValueNumeric(sorted[i + 1]) !== getValueNumeric(sorted[i]) + 1) {
				return false;
			}
		}

		// Empty table: any card or valid sequence goes
		if (table.length === 0) return true;

		// Check against the top card of the table pile
		const topBatch = table[table.length - 1];
		const topCard = topBatch[topBatch.length - 1];

		const topVal = getValueNumeric(topCard);
		const topSuit = topCard.suitName;

		const playVal = getValueNumeric(sorted[0]);
		const playSuit = sorted[0].suitName;

		const isTrumpPlay = (playSuit === tSuit);
		const isTopTrump = (topSuit === tSuit);

		if (isTopTrump) {
			// Beat a trump card with a higher value trump card
			return isTrumpPlay && playVal > topVal;
		} else {
			if (isTrumpPlay) {
				// Trump card beats any normal suit card
				return true;
			} else {
				// Normal card must match suit and be higher value
				return playSuit === topSuit && playVal > topVal;
			}
		}
	}

	return false;
}

export function getLegalPlays(handCards: Card[], table: Card[][], tSuit: string | null): Card[][] {
	const legal: Card[][] = [];
	const suitGroups: { [suit: string]: Card[] } = {};

	for (const card of handCards) {
		if (!suitGroups[card.suitName]) suitGroups[card.suitName] = [];
		suitGroups[card.suitName].push(card);
	}

	// Single card checks
	for (const card of handCards) {
		if (isValidPlay([card], handCards, table, 2, false, [], '', tSuit)) {
			legal.push([card]);
		}
	}

	// Sequence checks (unbroken sequences of same suit of size >= 2)
	for (const suit in suitGroups) {
		const cards = suitGroups[suit].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		
		// Group into contiguous segments
		const segments: Card[][] = [];
		let currentSegment: Card[] = [];
		for (const card of cards) {
			if (currentSegment.length === 0) {
				currentSegment.push(card);
			} else {
				const lastCard = currentSegment[currentSegment.length - 1];
				if (getValueNumeric(card) === getValueNumeric(lastCard) + 1) {
					currentSegment.push(card);
				} else {
					segments.push(currentSegment);
					currentSegment = [card];
				}
			}
		}
		if (currentSegment.length > 0) {
			segments.push(currentSegment);
		}

		// Generate contiguous subsequences of size >= 2 from each segment
		for (const segment of segments) {
			for (let i = 0; i < segment.length; i++) {
				for (let j = i + 1; j < segment.length; j++) {
					const seq = segment.slice(i, j + 1);
					if (isValidPlay(seq, handCards, table, 2, false, [], '', tSuit)) {
						legal.push(seq);
					}
				}
			}
		}
	}

	return legal;
}
