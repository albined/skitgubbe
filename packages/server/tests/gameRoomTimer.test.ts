import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

// Avoid real web-push calls
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import {
	GameRoom,
	PHASE1_TRICK_CLEANUP_MS,
	PHASE1_SPRINKLE_GRACE_MS,
	PHASE2_TRICK_CLEANUP_MS,
	type GameSocket
} from '../src/gameRoom.js';
import { dbOps } from '../src/db.js';
import type { Card, Player } from 'shared';

const SUIT_CHARS: Record<string, string> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

let cardUid = 0;
function c(value: string, suitName: keyof typeof SUIT_CHARS = 'spades'): Card {
	return {
		id: `${suitName}-${value}-${cardUid++}`,
		value,
		suit: SUIT_CHARS[suitName],
		suitName,
		color: suitName === 'hearts' || suitName === 'diamonds' ? 'red' : 'black'
	} as Card;
}

function fakeSocket(): GameSocket {
	const sent: any[] = [];
	const raw = {} as any;
	return {
		raw,
		sent,
		send(data: string) {
			try {
				sent.push(JSON.parse(data));
			} catch {
				sent.push(data);
			}
		},
		close() {}
	} as any;
}

describe('Step 5: Conditional 3-second sprinkle grace window and timer selection', () => {
	const roomId = 'timer_test_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7);
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'Timer Test Room', [bob]);
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

	function createPendingRoom() {
		const room = new GameRoom(roomId);
		room.state.status = 'playing';
		room.state.phase = 1;
		room.state.trickWinnerId = bob;

		// Table: Alice played 5, Bob played K
		room.state.tablePile = [[c('5', 'spades')], [c('K', 'diamonds')]];
		room.state.tablePilePlayers = [alice, bob];

		const alicePlayer = room.state.players.find((p) => p.id === alice)!;
		const bobPlayer = room.state.players.find((p) => p.id === bob)!;
		alicePlayer.inviteStatus = 'accepted';
		bobPlayer.inviteStatus = 'accepted';

		// Alice holds a matching 5 (can sprinkle) and a 7
		alicePlayer.hand = [c('5', 'hearts'), c('7', 'spades')];
		bobPlayer.hand = [c('2', 'clubs'), c('3', 'clubs')];

		return { room, alicePlayer, bobPlayer };
	}

	test('Case 1: connected player has a legal sprinkle -> 3000ms delay', () => {
		const { room } = createPendingRoom();
		const sock = fakeSocket();
		room.playerSockets.set(alice, sock);

		expect(room.hasOnlineSprinkleOpportunity()).toBe(true);
		expect(room.getTrickCleanupDelayMs()).toBe(PHASE1_SPRINKLE_GRACE_MS);
		expect(room.getTrickCleanupDelayMs()).toBe(3000);
		room.dispose();
	});

	test('Case 2: player has matching sprinkle card but is offline -> 1000ms delay', () => {
		const { room } = createPendingRoom();
		// Nobody in playerSockets (offline)
		room.playerSockets.clear();

		expect(room.hasOnlineSprinkleOpportunity()).toBe(false);
		expect(room.getTrickCleanupDelayMs()).toBe(PHASE1_TRICK_CLEANUP_MS);
		expect(room.getTrickCleanupDelayMs()).toBe(1000);
		room.dispose();
	});

	test('Case 3: connected player has no matching sprinkle card -> 1000ms delay', () => {
		const { room, alicePlayer } = createPendingRoom();
		// Alice has no 5s in hand
		alicePlayer.hand = [c('7', 'hearts'), c('9', 'spades')];
		const sock = fakeSocket();
		room.playerSockets.set(alice, sock);

		expect(room.hasOnlineSprinkleOpportunity()).toBe(false);
		expect(room.getTrickCleanupDelayMs()).toBe(PHASE1_TRICK_CLEANUP_MS);
		expect(room.getTrickCleanupDelayMs()).toBe(1000);
		room.dispose();
	});

	test('Case 4: Phase 2 always uses 500ms delay regardless of cards or connections', () => {
		const { room } = createPendingRoom();
		room.state.phase = 2;
		const sock = fakeSocket();
		room.playerSockets.set(alice, sock);

		expect(room.hasOnlineSprinkleOpportunity()).toBe(false);
		expect(room.getTrickCleanupDelayMs()).toBe(PHASE2_TRICK_CLEANUP_MS);
		expect(room.getTrickCleanupDelayMs()).toBe(500);
		room.dispose();
	});

	test('Fixed window: a valid sprinkle does not restart or create a new cleanup timer', () => {
		const { room, alicePlayer } = createPendingRoom();
		const sock = fakeSocket();
		room.playerSockets.set(alice, sock);

		let scheduleCallCount = 0;
		const originalSchedule = room.scheduleTrickCleanupTimeout.bind(room);
		room.scheduleTrickCleanupTimeout = (winnerId: string) => {
			scheduleCallCount++;
			return originalSchedule(winnerId);
		};

		// 1. Initial resolution schedules the timer once
		room.scheduleTrickCleanupTimeout(bob);
		expect(scheduleCallCount).toBe(1);

		// 2. Sprinkle during pending trick
		const fiveCard = alicePlayer.hand.find((card) => card.value === '5')!;
		(room as any).commitMove(alice, 'R', [fiveCard], () => {
			// Simulates applySprinkle during commitMove
			const { applySprinkle } = require('../src/gameLogic.js');
			applySprinkle(room.state, alice, [fiveCard.id]);
		});

		// 3. scheduleTrickCleanupTimeout must NOT have been called again!
		expect(scheduleCallCount).toBe(1);
		room.dispose();
	});
});
