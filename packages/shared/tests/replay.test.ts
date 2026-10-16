import { describe, test, expect } from 'bun:test';
import {
	createDeck,
	decodeReplayFrame,
	encodeReplayFrame,
	makeInitialState,
	type Player
} from '../src/index.js';

const player = (id: string, name: string): Player => ({
	id,
	name,
	color: '#ff0000',
	hand: [],
	reserveStack: [],
	isDone: false,
	isSkitgubbe: false,
	isHost: false
});

describe('Replay frames', () => {
	test('a frame survives JSON and decodes back to the same table', () => {
		const deck = createDeck();
		const state = makeInitialState([player('p1', 'Alice'), player('p2', 'Bob')], {
			seq: 7,
			status: 'playing',
			logs: []
		});
		state.phase = 2;
		state.activePlayerIdx = 1;
		state.players[0].hand = deck.slice(0, 5);
		state.players[0].isDone = true;
		state.players[1].reserveStack = deck.slice(5, 8);
		state.players[1].isTrumfman = true;
		state.tablePile = [deck.slice(8, 9), deck.slice(9, 12)];
		state.tablePilePlayers = ['p1', 'p2'];
		state.discardPile = deck.slice(12, 20);
		state.deck = deck.slice(20);
		state.trumpCard = deck[51];
		state.hiddenTrumpStorage = { playerId: 'p2', card: deck[51] };

		const move = { type: 'P' as const, playerId: 'p2', at: '2026-10-16 12:00:00' };
		const frame = JSON.parse(JSON.stringify(encodeReplayFrame(state, move, ['Bob la: 2♠'])));
		expect(frame.players[0]).not.toHaveProperty('isSkitgubbe');

		const people = [
			{ id: 'p1', name: 'Alice', color: '#ff0000', avatar_config: null },
			{ id: 'p2', name: 'Bob', color: '#00ff00', avatar_config: '{"hair":1}' }
		];
		const back = decodeReplayFrame(frame, people);
		expect(back.phase).toBe(2);
		expect(back.activePlayerIdx).toBe(1);
		expect(back.players[0].hand).toEqual(state.players[0].hand);
		expect(back.players[0].isDone).toBe(true);
		expect(back.players[1].reserveStack).toEqual(state.players[1].reserveStack);
		expect(back.players[1].isTrumfman).toBe(true);
		expect(back.players[1].color).toBe('#00ff00');
		expect(back.players[1].avatarConfig).toBe('{"hair":1}');
		expect(back.tablePile).toEqual(state.tablePile);
		expect(back.tablePilePlayers).toEqual(['p1', 'p2']);
		expect(back.discardPile).toEqual(state.discardPile);
		expect(back.deck).toEqual(state.deck);
		expect(back.trumpCard).toEqual(deck[51]);
		expect(back.hiddenTrumpStorage).toEqual({ playerId: 'p2', card: deck[51] });
		expect(back.logs).toEqual(['Bob la: 2♠']);
	});
});
