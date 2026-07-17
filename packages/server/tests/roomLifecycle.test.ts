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
import { app } from '../src/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeSocket() {
	const sent: any[] = [];
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

	test('state.seq is authoritative: fresh room, broadcasts, and reconnect replay agree', () => {
		const seqRoomId = 'p3_seq_' + Math.random().toString(36).substring(2, 8);
		dbOps.createGame(seqRoomId, alice, 'P3 Seq Room', [bob]);
		try {
			// createGame wrote the 'S' move at seq 0 → replayed room sits at seq 1
			const room = new GameRoom(seqRoomId);
			expect(room.state.seq).toBe(1);

			// A reconnect with lastSeq 0 gets a replay window with seqs 0..1
			const sock = fakeSocket();
			room.addClient(sock as any, alice);
			room.handleMessage(sock as any, JSON.stringify({ type: 'join', lastSeq: 0 }));
			const replay = sock.sent.find((m) => m.type === 'replay');
			expect(replay).toBeDefined();
			expect(replay.states.map((s: any) => s.seq)).toEqual([0, 1]);

			// Bob accepts → a move is committed and broadcast state carries seq 2
			room.handleAccept(bob);
			expect(dbOps.getNextMoveSeq(seqRoomId)).toBe(2);
			const updates = sock.sent.filter((m) => m.type === 'stateUpdate');
			expect(updates[updates.length - 1].state.seq).toBe(2);
			room.dispose();
		} finally {
			try {
				dbOps.deleteGame(seqRoomId);
			} catch {}
		}
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

	test('a decline with no sockets connected schedules eviction of the REST-loaded room', async () => {
		const declRoomId = 'p2_decl_' + Math.random().toString(36).substring(2, 8);
		dbOps.createGame(declRoomId, alice, 'Decline Leak Room', [bob]);
		try {
			// Bob authenticates the way the real client does (cookie session)
			const selectRes = await app.request(`/api/profiles/${bob}/select`, { method: 'POST' });
			const cookie = selectRes.headers.get('set-cookie') || '';
			expect(cookie).toContain('skitgubbe_session');

			expect(rooms.get(declRoomId)).toBeUndefined();

			const res = await app.request(`/api/games/${declRoomId}/decline`, {
				method: 'POST',
				headers: { Cookie: cookie }
			});
			expect(res.status).toBe(200);

			// The decline loaded the room into memory with zero sockets. The WS
			// onClose cleanup will never run for such a room, so the route must
			// have armed the eviction timer itself — otherwise it leaks forever.
			const room = rooms.get(declRoomId);
			expect(room).toBeDefined();
			expect(room!.clients.size).toBe(0);
			expect((room as any).cleanupTimeout).not.toBeNull();

			rooms.evict(declRoomId);
		} finally {
			try {
				dbOps.deleteGame(declRoomId);
			} catch {}
		}
	});

	test('stateHistory is used for reconnection replay and is bounded', () => {
		const perfRoomId = 'p_perf_' + Math.random().toString(36).substring(2, 8);
		dbOps.createGame(perfRoomId, alice, 'Perf Test Room', [bob]);
		try {
			const room = new GameRoom(perfRoomId);
			// Initially, stateHistory has seq 0 and seq 1
			expect((room as any).stateHistory.map((s: any) => s.seq)).toEqual([0, 1]);

			// Push more states to test bounding (limit is 15)
			for (let i = 2; i <= 20; i++) {
				room.state.seq = i;
				(room as any).pushStateHistory(room.state);
			}

			// History should be bounded to 15 entries
			expect((room as any).stateHistory.length).toBe(15);
			expect((room as any).stateHistory[(room as any).stateHistory.length - 1].seq).toBe(20);
			expect((room as any).stateHistory[0].seq).toBe(6);

			// Replay of range [10, 15] should hit the history buffer directly
			let getGameCalled = false;
			const originalGetGame = dbOps.getGame;
			dbOps.getGame = (id: string) => {
				getGameCalled = true;
				return originalGetGame(id);
			};

			const range = (room as any).getSanitizedStatesRange(alice, 10, 15);
			expect(range.map((s: any) => s.seq)).toEqual([10, 11, 12, 13, 14, 15]);
			// Replay hit history buffer directly, so getGame was NOT called!
			expect(getGameCalled).toBe(false);

			// Restore
			dbOps.getGame = originalGetGame;
			room.dispose();
		} finally {
			try {
				dbOps.deleteGame(perfRoomId);
			} catch {}
		}
	});
});

