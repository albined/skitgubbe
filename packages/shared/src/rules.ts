import type { Card, SuitName, Player, GameState } from './types.js';
import { VALUES_ORDER, SUITS_ORDER } from './types.js';

// Pre-compute order maps for O(1) lookups in performance-sensitive sort/rank loops
const VALUES_LOOKUP = new Map<string, number>(VALUES_ORDER.map((val, idx) => [val, idx + 2]));
const SUITS_LOOKUP = new Map<string, number>(SUITS_ORDER.map((val, idx) => [val, idx]));

export function getValueNumeric(card: Card): number {
	const idx = VALUES_LOOKUP.get(card.value);
	if (idx === undefined) {
		// A masked card (or corrupt wire data) reached rule logic — that is a
		// bug at the call site, never a value to rank.
		throw new Error(`getValueNumeric: unknown card value "${card.value}" (card ${card.id})`);
	}
	return idx;
}

export function sortHand(hand: Card[]): Card[] {
	return [...hand].sort((a, b) => {
		const aSuit = SUITS_LOOKUP.get(a.suitName);
		const bSuit = SUITS_LOOKUP.get(b.suitName);
		if (aSuit === undefined || bSuit === undefined) {
			throw new Error(`sortHand: unknown suit name "${a.suitName}" or "${b.suitName}"`);
		}
		const suitDiff = aSuit - bSuit;
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
	const values = VALUES_ORDER;
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

export function shuffle<T>(array: T[]): T[] {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function orderSkitgubbeLast<T>(
	players: T[],
	skitgubbeId: string | null | undefined,
	getId: (player: T) => string
): T[] {
	if (!skitgubbeId) return [...players];
	const arr = [...players];
	const idx = arr.findIndex((p) => getId(p) === skitgubbeId);
	if (idx !== -1) {
		const [skitgubbe] = arr.splice(idx, 1);
		arr.push(skitgubbe);
	}
	return arr;
}

export function isValidPlay(
	selected: Card[],
	table: Card[][],
	currPhase: number,
	tSuit: SuitName | null
): boolean {
	if (selected.length === 0) return false;

	if (currPhase === 1) {
		// Phase 1 (including tie-breaker) requires all played cards to be of the same value
		const firstVal = selected[0].value;
		return selected.every((c) => c.value === firstVal);
	}

	if (currPhase === 2) {
		// Phase 2 requires same suit cards in a sequential order, or Trump Suit cards
		const suit = selected[0].suitName;
		if (!selected.every((c) => c.suitName === suit)) return false;

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

		const isTrumpPlay = playSuit === tSuit;
		const isTopTrump = topSuit === tSuit;

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

// Phase 1 (including tie-breaker): any non-empty group of same-value cards is
// a legal play, regardless of the table. One play per value and group size.
export function getLegalPlaysPhase1(handCards: Card[]): Card[][] {
	const valueGroups: { [value: string]: Card[] } = {};
	for (const card of handCards) {
		if (!valueGroups[card.value]) valueGroups[card.value] = [];
		valueGroups[card.value].push(card);
	}

	const legal: Card[][] = [];
	for (const value in valueGroups) {
		const cards = valueGroups[value];
		for (let size = 1; size <= cards.length; size++) {
			legal.push(cards.slice(0, size));
		}
	}
	return legal;
}

export function getLegalPlays(
	handCards: Card[],
	table: Card[][],
	tSuit: SuitName | null
): Card[][] {
	const legal: Card[][] = [];
	const suitGroups: { [suit: string]: Card[] } = {};

	for (const card of handCards) {
		if (!suitGroups[card.suitName]) suitGroups[card.suitName] = [];
		suitGroups[card.suitName].push(card);
	}

	// Single card checks
	for (const card of handCards) {
		if (isValidPlay([card], table, 2, tSuit)) {
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
					if (isValidPlay(seq, table, 2, tSuit)) {
						legal.push(seq);
					}
				}
			}
		}
	}

	return legal;
}

export function makeInitialState(
	players: Player[],
	options: { seq: number; status: 'waiting' | 'playing' | 'ended'; logs: string[] }
): GameState {
	return {
		status: options.status,
		phase: 1,
		activePlayerIdx: 0,
		players,
		deck: [],
		tablePile: [],
		tablePilePlayers: [],
		discardPile: [],
		trumpCard: null,
		hiddenTrumpStorage: null,
		logs: options.logs,
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null,
		lastChanceCardId: null,
		seq: options.seq
	};
}
