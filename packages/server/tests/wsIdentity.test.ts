import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

// Avoid real web-push calls when the room broadcasts. Provide the full surface
// the server touches (initWebPush calls setVapidDetails/generateVAPIDKeys) so
// this mock is safe regardless of test-file evaluation order.
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { GameRoom } from '../src/gameRoom.js';
import { dbOps } from '../src/db.js';
import { isMasked } from 'shared';

// A minimal stand-in for the Hono WSContext the GameRoom operates on. It
// captures everything the server tries to send so tests can inspect it.
function fakeSocket() {
	const sent: any[] = [];
	return {
		raw: {}, // unique object identity == one physical socket
		sent,
		closed: null as null | { code?: number; reason?: string },
		send(data: string) {
			try {
				sent.push(JSON.parse(data));
			} catch {
				sent.push(data);
			}
		},
		close(code?: number, reason?: string) {
			this.closed = { code, reason };
		}
	};
}

function lastStateUpdate(sock: ReturnType<typeof fakeSocket>) {
	return [...sock.sent].reverse().find((m) => m && m.type === 'stateUpdate');
}

describe('WS identity — session-verified, client playerId ignored', () => {
	const roomId = 'wsid_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7);
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		// Game starts in 'playing' with Alice (host) accepted and dealt a hand.
		dbOps.createGame(roomId, alice, 'WS Identity Room', [bob]);
		// Bob accepts (mirrors the /accept route when no room is in memory yet).
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

	test("a player sees their own hand but never another player's card values", () => {
		const room = new GameRoom(roomId);
		const sockA = fakeSocket();
		const sockB = fakeSocket();

		// The upgrade handler binds the session-verified id via addClient(ws, id).
		room.addClient(sockA as any, alice);
		room.handleMessage(
			sockA as any,
			JSON.stringify({ type: 'join', playerId: alice, name: 'x', color: 'x' })
		);
		room.addClient(sockB as any, bob);
		room.handleMessage(
			sockB as any,
			JSON.stringify({ type: 'join', playerId: bob, name: 'x', color: 'x' })
		);

		const stateForA = lastStateUpdate(sockA)?.state;
		expect(stateForA).toBeDefined();
		const aliceHandForA = stateForA.players.find((p: any) => p.id === alice).hand;
		const bobHandForA = stateForA.players.find((p: any) => p.id === bob).hand;

		// Alice's own cards are real; Bob's are fully masked to the '?' sentinel.
		expect(aliceHandForA.length).toBeGreaterThan(0);
		expect(aliceHandForA.every((c: any) => !isMasked(c))).toBe(true);
		expect(bobHandForA.length).toBeGreaterThan(0);
		expect(bobHandForA.every((c: any) => isMasked(c))).toBe(true);
	});

	test('a socket cannot impersonate another player by asserting their playerId', () => {
		const room = new GameRoom(roomId);

		// Bob is legitimately connected on his own socket.
		const sockBob = fakeSocket();
		room.addClient(sockBob as any, bob);
		room.handleMessage(
			sockBob as any,
			JSON.stringify({ type: 'join', playerId: bob, name: 'x', color: 'x' })
		);

		// An attacker authenticated as Alice tries to join AS Bob.
		const sockImp = fakeSocket();
		room.addClient(sockImp as any, alice);
		room.handleMessage(
			sockImp as any,
			JSON.stringify({ type: 'join', playerId: bob, name: 'x', color: 'x' })
		);

		const stateForImp = lastStateUpdate(sockImp);
		// The server treats the impostor as Alice (their real identity), not Bob.
		expect(stateForImp.yourPlayerId).toBe(alice);
		const bobHandForImp = stateForImp.state.players.find((p: any) => p.id === bob).hand;
		expect(bobHandForImp.every((c: any) => isMasked(c))).toBe(true);

		// Bob's real socket was not hijacked/kicked by the impostor's join.
		expect((room as any).playerSockets.get(bob)).toBe(sockBob);
		expect(sockBob.closed).toBeNull();
	});

	test('an unauthenticated socket cannot join and is never told any hand', () => {
		const room = new GameRoom(roomId);
		const sock = fakeSocket();

		// No profileId bound (simulates a socket the upgrade handler rejected).
		room.addClient(sock as any);
		room.handleMessage(
			sock as any,
			JSON.stringify({ type: 'join', playerId: alice, name: 'x', color: 'x' })
		);

		const err = sock.sent.find((m) => m && m.type === 'error');
		expect(err?.message).toBe('Unauthorized.');

		// Any state it did receive (the immediate post-connect snapshot) leaks
		// no real card values, since it maps to no player.
		for (const msg of sock.sent) {
			if (msg?.type !== 'stateUpdate') continue;
			for (const p of msg.state.players) {
				expect(p.hand.every((c: any) => isMasked(c))).toBe(true);
			}
		}
	});
});
