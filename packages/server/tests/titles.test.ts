import { describe, test, expect } from 'bun:test';
import type { GameState, Card, Player } from 'shared';
import { sortHand } from 'shared';
import { replayGame } from '../src/gameReplay.js';
import type { DbGamePlayer, DbMove } from '../src/db.js';
import { applyClearTrick } from '../src/gameLogic.js';

describe('Skitgubbe Titles & Stats Calculations', () => {
	const dbPlayers: DbGamePlayer[] = [
		{
			game_id: 't1',
			profile_id: 'p1',
			role: 'host',
			is_ready: 1,
			invite_status: 'accepted',
			turn_order: 0,
			name: 'Alice',
			color: '#ff0000'
		},
		{
			game_id: 't1',
			profile_id: 'p2',
			role: 'player',
			is_ready: 1,
			invite_status: 'accepted',
			turn_order: 1,
			name: 'Bob',
			color: '#00ff00'
		},
		{
			game_id: 't1',
			profile_id: 'p3',
			role: 'player',
			is_ready: 1,
			invite_status: 'accepted',
			turn_order: 2,
			name: 'Charlie',
			color: '#0000ff'
		}
	];

	test('calculates Sweetgubbe, Trumfman, and Constipated Skitgubbe during phase transition', () => {
		const initialDeck = [
			{ id: 'spades-2', suit: '♠', value: '2', suitName: 'spades', color: 'black' },
			{ id: 'spades-3', suit: '♠', value: '3', suitName: 'spades', color: 'black' },
			{ id: 'spades-4', suit: '♠', value: '4', suitName: 'spades', color: 'black' }
		] as Card[];

		const moves: DbMove[] = [
			{ id: 1, game_id: 't1', seq: 0, player_id: 'p1', move_type: 'S', cards: null, created_at: '' }
		];

		const state = replayGame('t1', dbPlayers, initialDeck, moves);

		state.deck = [];
		state.players[0].hand = [
			{ id: 'hearts-A', suit: '♥', value: 'A', suitName: 'hearts', color: 'red' }
		];
		state.players[0].reserveStack = [
			{ id: 'clubs-10', suit: '♣', value: '10', suitName: 'clubs', color: 'black' },
			{ id: 'clubs-J', suit: '♣', value: 'J', suitName: 'clubs', color: 'black' }
		];

		state.players[1].hand = [];
		state.players[1].reserveStack = [];

		state.players[2].hand = [];
		state.players[2].reserveStack = [];

		state.hiddenTrumpStorage = {
			playerId: 'p2',
			card: { id: 'diamonds-K', suit: '♦', value: 'K', suitName: 'diamonds', color: 'red' }
		};

		state.trickWinnerId = 'p1';
		applyClearTrick(state);

		expect(state.phase).toBe(2);

		// Alice won all tricks -> Constipated
		expect(state.players[0].isConstipated).toBe(true);
		expect(state.players[0].isMegaConstipated).toBeUndefined();

		// Bob had 0 cards and got trump -> Trumfman
		expect(state.players[1].isTrumfman).toBe(true);
		expect(state.players[1].isSweetgubbe).toBeUndefined();
		expect(state.players[1].hand.length).toBe(1);

		// Charlie had 0 cards and did not get trump -> Sweetgubbe
		expect(state.players[2].isSweetgubbe).toBe(true);
		expect(state.players[2].isTrumfman).toBeUndefined();
		expect(state.players[2].isDone).toBe(true);
	});

	test('calculates Mega Constipated Skitgubbe when everyone else is Sweetgubbe', () => {
		const initialDeck = [
			{ id: 'spades-2', suit: '♠', value: '2', suitName: 'spades', color: 'black' }
		] as Card[];

		const moves: DbMove[] = [
			{ id: 1, game_id: 't1', seq: 0, player_id: 'p1', move_type: 'S', cards: null, created_at: '' }
		];

		const state = replayGame('t1', dbPlayers, initialDeck, moves);

		state.deck = [];
		state.players[0].hand = [
			{ id: 'hearts-A', suit: '♥', value: 'A', suitName: 'hearts', color: 'red' }
		];
		state.players[0].reserveStack = [
			{ id: 'clubs-10', suit: '♣', value: '10', suitName: 'clubs', color: 'black' }
		];

		state.players[1].hand = [];
		state.players[1].reserveStack = [];

		state.players[2].hand = [];
		state.players[2].reserveStack = [];

		state.hiddenTrumpStorage = {
			playerId: 'p1',
			card: { id: 'diamonds-K', suit: '♦', value: 'K', suitName: 'diamonds', color: 'red' }
		};

		state.trickWinnerId = 'p1';
		applyClearTrick(state);

		expect(state.phase).toBe(2);

		expect(state.players[1].isSweetgubbe).toBe(true);
		expect(state.players[2].isSweetgubbe).toBe(true);

		// Alice ends up with all cards, since everyone else is a sweetgubbe -> Mega Constipated
		expect(state.players[0].isConstipated).toBe(true);
		expect(state.players[0].isMegaConstipated).toBe(true);
	});
});
