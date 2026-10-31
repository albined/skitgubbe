import { describe, test, expect, mock } from 'bun:test';

mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { CURRENT_RULES_VERSION, createDeck, type Card, type GameState, type Player } from 'shared';
import { applyClearTrick, applyDecline, applyPlayCards, applySprinkle } from '../src/gameLogic.js';
import { replayGame } from '../src/gameReplay.js';
import { GameRoom } from '../src/gameRoom.js';
import { db, dbOps } from '../src/db.js';

let uid = 0;
function c(value: string, suitName: Card['suitName'] = 'spades'): Card {
	return {
		id: `${suitName}-${value}-${uid++}`,
		value,
		suit: '♠',
		suitName,
		color: 'black'
	} as Card;
}

function player(id: string, cards: Card[] = [], opts: Partial<Player> = {}): Player {
	return {
		id,
		name: id,
		color: '#000',
		hand: cards,
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost: false,
		inviteStatus: 'accepted',
		...opts
	};
}

// The deck has run out and `players[0]` holds the hidden trump unless told otherwise.
function endOfDeck(players: Player[], opts: Partial<GameState> = {}): GameState {
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
		hiddenTrumpStorage: { playerId: players[0].id, card: c('2', 'clubs') },
		logs: [],
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null,
		lastChanceCardId: null,
		rulesVersion: CURRENT_RULES_VERSION,
		seq: 0,
		...opts
	};
}

const active = (s: GameState) => s.players[s.activePlayerIdx];

describe('phase 2 starts when the table is clear and someone is out of cards', () => {
	test('the trump holder goes first, not the trick winner', () => {
		const a = player('a', [c('K'), c('5')]);
		const b = player('b', [c('4'), c('6')]);
		const trumpHolder = player('c', [c('3')]);
		const state = endOfDeck([a, b, trumpHolder], {
			hiddenTrumpStorage: { playerId: 'c', card: c('2', 'clubs') }
		});

		applyPlayCards(state, 'a', [a.hand.find((x) => x.value === 'K')!.id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		applyPlayCards(state, 'c', [trumpHolder.hand[0].id]);
		expect(state.phase).toBe(1); // the trick still has to be picked up

		applyClearTrick(state);

		expect(state.phase).toBe(2);
		expect(active(state).id).toBe('c');
		expect(state.trumpCard?.value).toBe('2');
	});

	test('the winner having cards left does not hold it back', () => {
		const a = player('a', [c('A'), c('5'), c('6')]);
		const b = player('b', [c('4')]);
		const state = endOfDeck([a, b]);

		applyPlayCards(state, 'a', [a.hand.find((x) => x.value === 'A')!.id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		applyClearTrick(state);

		expect(state.phase).toBe(2);
	});

	test('phase 1 goes on while the deck has cards', () => {
		const a = player('a', [c('A', 'clubs')]);
		const b = player('b', [c('4', 'clubs')]);
		const state = endOfDeck([a, b], {
			deck: ['3', '4', '5', '6', '7', '8', '9', '10'].map((v) => c(v, 'hearts'))
		});
		state.hiddenTrumpStorage = null;

		applyPlayCards(state, 'a', [a.hand[0].id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		applyClearTrick(state);

		expect(state.phase).toBe(1);
	});

	test('a tie-breaker finishes even though someone outside it is out of cards', () => {
		const a = player('a', [c('K'), c('7')]);
		const b = player('b', [c('K', 'hearts'), c('9')]);
		const out = player('c', [c('4')]);
		const state = endOfDeck([a, b, out]);

		applyPlayCards(state, 'a', [a.hand[0].id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		applyPlayCards(state, 'c', [out.hand[0].id]);
		expect(state.tieBreakerActive).toBe(true);
		expect(state.phase).toBe(1);

		applyPlayCards(state, 'a', [a.hand[0].id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		expect(state.trickWinnerId).toBe('b');
		expect(state.phase).toBe(1);

		applyClearTrick(state);
		expect(state.phase).toBe(2);
	});

	test('a departure that clears the table starts it', () => {
		const a = player('a', [c('5')]);
		const b = player('b', [c('6')]);
		const out = player('c');
		const leaver = player('d', [c('7')]);
		const state = endOfDeck([a, b, out, leaver], {
			tablePile: [[c('K')]],
			tablePilePlayers: ['d'],
			activePlayerIdx: 0
		});

		applyDecline(state, 'd');

		expect(state.phase).toBe(2);
	});
});

describe('edge cases around the transition', () => {
	test('sprinkling your last card on your own tie-breaker turn does not freeze the game', () => {
		const last = c('K', 'clubs');
		const a = player('a', [last]);
		const b = player('b', [c('Q')]);
		const state = endOfDeck([a, b], {
			tablePile: [[c('K')], [c('K', 'hearts')]],
			tablePilePlayers: ['a', 'b'],
			tieBreakerActive: true,
			tiedPlayerIds: ['a', 'b'],
			tieBreakerStartPileSize: 2
		});

		applySprinkle(state, 'a', [last.id]);

		expect(state.phase).toBe(2);
	});

	test('a departure in phase 1 starts phase 2 instead of ending the game', () => {
		const a = player('a', [c('K')]);
		const b = player('b', [c('Q')]);
		const out = player('c', [], { reserveStack: [c('9')] });
		const state = endOfDeck([a, b, out]);

		applyDecline(state, 'b');

		expect(state.status).toBe('playing');
		expect(state.phase).toBe(2);
		expect(out.isDone).toBe(false);
		expect(out.hand.length).toBe(1);
		expect(state.players.some((p) => p.isSkitgubbe)).toBe(false);
	});

	test('an invitee declining as the last one the round waited for resolves it', () => {
		const a = player('a', [c('5')]);
		const b = player('b', [c('6')]);
		const invitee = player('c', [], { inviteStatus: 'pending' });
		const state = endOfDeck([a, b, invitee], {
			deck: [c('7'), c('8')],
			hiddenTrumpStorage: null,
			tablePile: [[c('K')], [c('Q')]],
			tablePilePlayers: ['a', 'b'],
			activePlayerIdx: 2
		});

		applyDecline(state, 'c');

		expect(state.trickWinnerId).toBe('a');
	});

	test('an invitee declining with plays still to come passes the turn to the next seat', () => {
		const a = player('a', [c('5')]);
		const invitee = player('b', [], { inviteStatus: 'pending' });
		const d = player('c', [c('6')]);
		const e = player('d', [c('7')]);
		const state = endOfDeck([a, invitee, d, e], {
			deck: [c('7'), c('8')],
			hiddenTrumpStorage: null,
			tablePile: [[c('K')]],
			tablePilePlayers: ['a'],
			activePlayerIdx: 1
		});

		applyDecline(state, 'b');

		expect(active(state).id).toBe('c');
		expect(state.trickWinnerId).toBeNull();
	});

	test('the last opponent leaving phase 2 makes the remaining player Skitgubbe', () => {
		const a = player('a', [c('5')]);
		const b = player('b', [c('6')]);
		const out = player('c', [], { isDone: true });
		const state = endOfDeck([a, b, out], { phase: 2, trumpCard: c('2', 'clubs') });

		applyDecline(state, 'b');

		expect(state.status).toBe('ended');
		expect(a.isSkitgubbe).toBe(true);
	});
});

describe('older games keep their rules', () => {
	test('a version 1 game stays in phase 1 until the turn reaches the empty player', () => {
		const a = player('a', [c('K'), c('5')]);
		const b = player('b', [c('4'), c('6')]);
		const out = player('c', [c('3')]);
		const state = endOfDeck([a, b, out], { rulesVersion: 1 });

		applyPlayCards(state, 'a', [a.hand.find((x) => x.value === 'K')!.id]);
		applyPlayCards(state, 'b', [b.hand[0].id]);
		applyPlayCards(state, 'c', [out.hand[0].id]);
		applyClearTrick(state);

		expect(state.phase).toBe(1);
	});

	test('replay falls back to version 1 for a log with no recorded version', () => {
		expect(replayGame('t', [], [], []).rulesVersion).toBe(1);
	});

	test('a game keeps its rules across a server restart, and a reset moves it to the current ones', () => {
		const id = () => 'rules_' + Math.random().toString(36).substring(2, 9);
		const [roomId, alice, bob] = [id(), id(), id()];
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'Rules Room', [bob]);
		try {
			const version = () => (new GameRoom(roomId) as unknown as { state: GameState }).state;

			expect(dbOps.getGame(roomId)!.rules_version).toBe(CURRENT_RULES_VERSION);
			expect(version().rulesVersion).toBe(CURRENT_RULES_VERSION);

			db.run('UPDATE games SET rules_version = 1 WHERE id = ?', [roomId]);
			expect(version().rulesVersion).toBe(1);

			dbOps.resetGame(roomId, alice, createDeck());
			expect(version().rulesVersion).toBe(CURRENT_RULES_VERSION);
		} finally {
			dbOps.deleteGame(roomId);
		}
	});
});
