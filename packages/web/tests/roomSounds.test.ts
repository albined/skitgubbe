import { describe, expect, test } from 'bun:test';
import type { AnyCard, Card, SanitizedGameState, SanitizedPlayer, SuitName } from 'shared';
import { cuesForStateChange } from '../src/lib/audio/roomSounds';

const SUITS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;

function card(value: Card['value'], suitName: SuitName = 'hearts'): Card {
	const color = suitName === 'hearts' || suitName === 'diamonds' ? 'red' : 'black';
	return { id: `${suitName}-${value}`, value, suit: SUITS[suitName], suitName, color };
}

function player(id: string, hand: AnyCard[] = [], extra: Partial<SanitizedPlayer> = {}) {
	return {
		id,
		name: id,
		color: '#fff',
		hand,
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost: id === 'me',
		inviteStatus: 'accepted',
		...extra
	} as SanitizedPlayer;
}

function state(extra: Partial<SanitizedGameState> = {}): SanitizedGameState {
	return {
		status: 'playing',
		phase: 1,
		activePlayerIdx: 0,
		players: [player('me', [card('2'), card('5')]), player('bob', [card('3', 'clubs')])],
		deck: [card('9', 'spades'), card('10', 'spades')],
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
		lastChanceCardId: null,
		seq: 1,
		...extra
	};
}

const ids = (cues: { id: string }[]) => cues.map((c) => c.id);

describe('sounds for a state change', () => {
	test('stay quiet for the first state and without a local player', () => {
		expect(cuesForStateChange(null, state(), 'me')).toEqual([]);
		expect(cuesForStateChange(state(), state(), '')).toEqual([]);
	});

	test("an opponent's play lands softer and later than your own", () => {
		const prev = state({ activePlayerIdx: 1 });
		const next = state({ tablePile: [[card('3', 'clubs')]], tablePilePlayers: ['bob'] });
		const cues = cuesForStateChange(prev, next, 'me');
		expect(cues[0]).toEqual({ id: 'card_play', delay: 0.28, gainDb: -6 });
		expect(ids(cues)).toEqual(['card_play', 'your_turn']);
	});

	test('your play lands, then each replacement card is dealt in turn', () => {
		const prev = state();
		const next = state({
			activePlayerIdx: 1,
			players: [player('me', [card('2'), card('8'), card('9')]), player('bob')],
			tablePile: [[card('5')]],
			tablePilePlayers: ['me']
		});
		const cues = cuesForStateChange(prev, next, 'me');
		expect(cues[0]).toEqual({ id: 'card_play', delay: 0.2, gainDb: 0 });
		expect(cues.slice(1).map((c) => [c.id, c.delay])).toEqual([
			['card_draw', 0.1],
			['card_draw', 0.25]
		]);
	});

	test('Strö (a batch growing) sounds like a play, Chansa has its own sound', () => {
		const table = { tablePile: [[card('7')]], tablePilePlayers: ['me'], activePlayerIdx: 1 };
		const sprinkled = state({ ...table, tablePile: [[card('7'), card('7', 'spades')]] });
		expect(ids(cuesForStateChange(state(table), sprinkled, 'me'))).toEqual(['card_play']);

		const chanced = state({
			tablePile: [[card('7')], [card('K', 'spades')]],
			tablePilePlayers: ['me', 'bob'],
			lastChanceCardId: 'spades-K'
		});
		expect(cuesForStateChange(state(table), chanced, 'me')[0]).toEqual({
			id: 'chance',
			gainDb: -6
		});
	});

	test('a won Phase 1 trick is swept away, and its winner leads with your turn', () => {
		const won = state({
			tablePile: [[card('5')], [card('3', 'clubs')]],
			tablePilePlayers: ['me', 'bob'],
			trickWinnerId: 'me'
		});
		const cleared = state();
		expect(cuesForStateChange(won, cleared, 'me')).toEqual([
			{ id: 'trick_take' },
			{ id: 'your_turn', delay: 0.5 }
		]);
		expect(ids(cuesForStateChange(won, state({ activePlayerIdx: 1 }), 'me'))).toEqual([
			'trick_take'
		]);
	});

	test('a cleared Phase 2 table burns', () => {
		const flipped = state({
			phase: 2,
			activePlayerIdx: 1,
			tablePile: [[card('5')], [card('8')]],
			tablePilePlayers: ['me', 'bob'],
			trickWinnerId: 'bob'
		});
		const burned = state({ phase: 2, activePlayerIdx: 1, discardPile: [card('5'), card('8')] });
		expect(ids(cuesForStateChange(flipped, burned, 'me'))).toEqual(['burn']);
	});

	test('Plocka uses the draw sound, softer for an opponent', () => {
		const table = [[card('4')], [card('9')]];
		const prev = state({
			phase: 2,
			activePlayerIdx: 1,
			tablePile: table,
			tablePilePlayers: ['me', 'bob']
		});
		const next = state({
			phase: 2,
			activePlayerIdx: 0,
			players: [
				player('me', [card('2'), card('5')]),
				player('bob', [card('3', 'clubs'), card('4')])
			],
			tablePile: [table[1]],
			tablePilePlayers: ['bob']
		});
		expect(cuesForStateChange(prev, next, 'me')).toEqual([
			{ id: 'card_draw', gainDb: -6 },
			{ id: 'your_turn', delay: 0.5 }
		]);
	});

	test('a batch vanishing without anyone picking it up is not Plocka', () => {
		const prev = state({
			phase: 2,
			activePlayerIdx: 1,
			tablePile: [[card('4')], [card('9')]],
			tablePilePlayers: ['carl', 'bob']
		});
		const next = state({
			phase: 2,
			activePlayerIdx: 1,
			tablePile: [[card('9')]],
			tablePilePlayers: ['bob']
		});
		expect(cuesForStateChange(prev, next, 'me')).toEqual([]);
	});

	test('Phase 2 starting is one riffle, then your turn if you hold the trump', () => {
		const prev = state({ deck: [], tablePile: [[card('5')]], tablePilePlayers: ['me'] });
		const next = state({
			phase: 2,
			deck: [],
			players: [player('me', [card('2'), card('5'), card('J', 'spades')]), player('bob')],
			trumpCard: card('J', 'spades')
		});
		expect(cuesForStateChange(prev, next, 'me')).toEqual([
			{ id: 'phase2_start' },
			{ id: 'your_turn', delay: 1.2 }
		]);
	});

	test('your turn only sounds when it becomes yours, and not while a trick is pending', () => {
		expect(cuesForStateChange(state(), state(), 'me')).toEqual([]);
		const pending = state({
			tablePile: [[card('5')], [card('3', 'clubs')]],
			tablePilePlayers: ['me', 'bob'],
			trickWinnerId: 'me'
		});
		const before = state({
			activePlayerIdx: 1,
			tablePile: [[card('5')]],
			tablePilePlayers: ['me']
		});
		expect(ids(cuesForStateChange(before, pending, 'me'))).toEqual(['card_play']);
	});

	test('escapes: yours celebrates, others are acknowledged, the Skitgubbe gets neither', () => {
		const prev = state({ phase: 2, activePlayerIdx: 1 });
		const next = state({
			phase: 2,
			status: 'ended',
			players: [player('me', [], { isDone: true }), player('bob', [], { isSkitgubbe: true })],
			tablePile: [[card('A')]],
			tablePilePlayers: ['me']
		});
		expect(cuesForStateChange(prev, next, 'me')).toEqual([
			{ id: 'card_play', delay: 0.2, gainDb: 0 },
			{ id: 'escape_you', delay: 0.3 }
		]);
		expect(ids(cuesForStateChange(prev, next, 'bob'))).toEqual(['card_play', 'escape_other']);
	});
});
