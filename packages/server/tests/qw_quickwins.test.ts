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
import { dbOps } from '../src/db.js';

function fakeSocket() {
	const sent: any[] = [];
	return {
		raw: {}, // unique object identity == one physical socket
		sent,
		closed: null as null | { code?: number; reason?: string },
		send(data: string) {
			try { sent.push(JSON.parse(data)); } catch { sent.push(data); }
		},
		close(code?: number, reason?: string) {
			this.closed = { code, reason };
		}
	};
}

describe('QW-4 and QW-7 validations', () => {
	const roomId = 'qw_test_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7); // Host
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);     // Player

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'QW Test Room', [bob]);
		dbOps.joinGame(roomId, bob);
		const seq = dbOps.getNextMoveSeq(roomId);
		dbOps.saveMove(roomId, seq, bob, 'A');
	});

	afterAll(() => {
		try { dbOps.deleteGame(roomId); } catch {}
		try { dbOps.deleteProfile(alice); } catch {}
		try { dbOps.deleteProfile(bob); } catch {}
	});

	test('QW-4: Only host can skip to Phase 2', () => {
		process.env.PUBLIC_ALLOW_DEV_SETTINGS = 'true';
		const room = new GameRoom(roomId);
		const sockAlice = fakeSocket();
		const sockBob = fakeSocket();

		room.addClient(sockAlice as any, alice);
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'join', playerId: alice }));
		room.addClient(sockBob as any, bob);
		room.handleMessage(sockBob as any, JSON.stringify({ type: 'join', playerId: bob }));

		// Bob (not host) attempts to skip to phase 2
		room.handleMessage(sockBob as any, JSON.stringify({ type: 'debugSkipToPhase2' }));
		const lastMsgBob = sockBob.sent[sockBob.sent.length - 1];
		expect(lastMsgBob?.type).toBe('error');
		expect(lastMsgBob?.message).toBe('Only the Host can skip to Phase 2.');

		// Alice (host) attempts to skip to phase 2
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'debugSkipToPhase2' }));
		// Game phase should be 2 now
		expect(room.state.phase).toBe(2);
	});

	test('QW-4: debugForceLose uses standard J and Q values', () => {
		process.env.PUBLIC_ALLOW_DEV_SETTINGS = 'true';
		const room = new GameRoom(roomId);
		const sockAlice = fakeSocket();

		room.addClient(sockAlice as any, alice);
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'join', playerId: alice }));

		// Clear Alice's hand to force the fabricated cards branch
		const alicePlayerInRoom = room.state.players.find(p => p.id === alice)!;
		alicePlayerInRoom.hand = [];

		// Alice loses
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'debugForceLose' }));
		expect(room.state.status).toBe('ended');

		const alicePlayer = room.state.players.find(p => p.id === alice)!;
		expect(alicePlayer.isSkitgubbe).toBe(true);

		const heartsJ = alicePlayer.hand.find(c => c.id === 'hearts-J');
		const spadesQ = alicePlayer.hand.find(c => c.id === 'spades-Q');

		expect(heartsJ?.value).toBe('J');
		expect(spadesQ?.value).toBe('Q');
	});

	test('QW-7: per-socket chat rate limit', () => {
		const room = new GameRoom(roomId);
		const sockAlice = fakeSocket();

		room.addClient(sockAlice as any, alice);
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'join', playerId: alice }));

		// Send 5 chat messages (should succeed)
		for (let i = 0; i < 5; i++) {
			room.handleMessage(sockAlice as any, JSON.stringify({ type: 'chat', message: `msg ${i}` }));
		}

		// Ensure 5 chat messages are sent to the client (we get broadcasts of chatMessage)
		const chatMessages = sockAlice.sent.filter(m => m.type === 'chatMessage');
		expect(chatMessages.length).toBe(5);

		// Send 6th chat message (should fail with rate limit error)
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'chat', message: 'rate limited' }));

		const lastMsg = sockAlice.sent[sockAlice.sent.length - 1];
		expect(lastMsg?.type).toBe('error');
		expect(lastMsg?.message).toBe('Chat rate limit exceeded. Please wait.');
	});
});
