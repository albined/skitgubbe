import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

// Avoid real web-push calls
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { GameRoom } from '../src/gameRoom.js';
import { rooms } from '../src/rooms.js';
import { dbOps } from '../src/db.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('P-2: room/timer lifecycle', () => {
	const roomId = 'p2_test_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7);
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'P2 Test Room', [bob]);
	});

	afterAll(() => {
		try { dbOps.deleteGame(roomId); } catch {}
		try { dbOps.deleteProfile(alice); } catch {}
		try { dbOps.deleteProfile(bob); } catch {}
	});

	function pendingTrickRoom(): GameRoom {
		const room = new GameRoom(roomId);
		// Fabricate a pending trick; phase 2 uses the shorter (500ms) delay.
		room.state.status = 'playing';
		room.state.phase = 2;
		room.state.trickWinnerId = alice;
		return room;
	}

	function countTrickMoves(): number {
		return dbOps.getGameMoves(roomId).filter((m) => m.move_type === 'T').length;
	}

	test('trick-cleanup timer fires when the room stays live (control)', async () => {
		const before = countTrickMoves();
		const room = pendingTrickRoom();
		room.scheduleTrickCleanupTimeout(alice);
		await sleep(700);
		expect(countTrickMoves()).toBe(before + 1);
		room.dispose();
	});

	test('dispose() cancels a pending trick-cleanup timer — no move is written', async () => {
		const before = countTrickMoves();
		const room = pendingTrickRoom();
		room.scheduleTrickCleanupTimeout(alice);
		room.dispose();
		await sleep(700);
		expect(countTrickMoves()).toBe(before);
	});

	test('a disposed room never schedules new timers', async () => {
		const before = countTrickMoves();
		const room = pendingTrickRoom();
		room.dispose();
		room.scheduleTrickCleanupTimeout(alice);
		await sleep(700);
		expect(countTrickMoves()).toBe(before);
	});

	test('rescheduling replaces the previous trick timer instead of stacking', async () => {
		const before = countTrickMoves();
		const room = pendingTrickRoom();
		room.scheduleTrickCleanupTimeout(alice);
		room.scheduleTrickCleanupTimeout(alice);
		await sleep(700);
		expect(countTrickMoves()).toBe(before + 1);
		room.dispose();
	});

	test('RoomManager.evict disposes the room', async () => {
		const before = countTrickMoves();
		const room = rooms.getOrCreate(roomId);
		room.state.status = 'playing';
		room.state.phase = 2;
		room.state.trickWinnerId = alice;
		room.scheduleTrickCleanupTimeout(alice);

		rooms.evict(roomId);
		expect(rooms.get(roomId)).toBeUndefined();

		await sleep(700);
		expect(countTrickMoves()).toBe(before);
	});
});
