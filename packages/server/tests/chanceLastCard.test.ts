import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

// Avoid real web-push calls
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { createDeck, makeInitialState, type Player } from 'shared';
import { GameRoom } from '../src/gameRoom.js';
import { applyChance } from '../src/gameLogic.js';
import { dbOps } from '../src/db.js';

function fakeSocket() {
	const sent: unknown[] = [];
	return {
		raw: {},
		sent,
		send(data: string) {
			try {
				sent.push(JSON.parse(data));
			} catch {
				sent.push(data);
			}
		},
		close() {}
	};
}

function makePlayer(id: string, name: string, isHost = false): Player {
	return {
		id,
		name,
		color: '#fff',
		hand: [],
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost,
		inviteStatus: 'accepted'
	};
}

describe('Chance on the last deck card (reserved as hidden trump)', () => {
	const roomId = 'chance_test_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7);
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'Chance Test Room', [bob]);
		dbOps.joinGame(roomId, bob);
		const seq = dbOps.getNextMoveSeq(roomId);
		dbOps.saveMove(roomId, seq, bob, 'A');
	});

	afterAll(() => {
		try {
			dbOps.deleteGame(roomId);
		} catch {}
		try {
			dbOps.deleteProfile(alice);
		} catch {}
		try {
			dbOps.deleteProfile(bob);
		} catch {}
	});

	test('handleChance rejects when only one card is left in the deck', () => {
		const room = new GameRoom(roomId);
		const sock = fakeSocket();
		room.addClient(sock as any, alice);
		room.handleMessage(sock as any, JSON.stringify({ type: 'join', playerId: alice }));

		expect(room.state.status).toBe('playing');
		room.state.phase = 1;
		const aliceIdx = room.state.players.findIndex((p) => p.id === alice);
		room.state.activePlayerIdx = aliceIdx;
		room.state.trickWinnerId = null;

		room.state.deck = room.state.deck.slice(0, 1);
		const pileBefore = room.state.tablePile.length;

		room.handleMessage(sock as any, JSON.stringify({ type: 'chance' }));

		expect(room.state.deck.length).toBe(1);
		expect(room.state.tablePile.length).toBe(pileBefore);

		// With two cards left the chance goes through
		room.state.deck = createDeck().slice(0, 2);
		room.handleMessage(sock as any, JSON.stringify({ type: 'chance' }));

		expect(room.state.deck.length).toBe(1);
		expect(room.state.tablePile.length).toBe(pileBefore + 1);
		expect(room.state.lastChanceCardId).not.toBeNull();
	});

	test('applyChance still replays a persisted last-card chance (old logs)', () => {
		const p1 = makePlayer('p1', 'P1', true);
		const p2 = makePlayer('p2', 'P2');
		const state = makeInitialState([p1, p2], { seq: 0, status: 'playing', logs: [] });
		const lastCard = createDeck()[0];
		state.deck = [lastCard];

		applyChance(state, 'p1', lastCard);

		expect(state.deck.length).toBe(0);
		expect(state.tablePile.length).toBe(1);
		expect(state.tablePile[0][0].id).toBe(lastCard.id);
	});
});
