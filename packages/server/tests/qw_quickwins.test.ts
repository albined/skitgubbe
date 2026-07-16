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
import { dbOps, db } from '../src/db.js';
import { isValidIp, getIpLocation } from '../src/utils/ipAndDevice.js';

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

describe('QW-4 and QW-7 validations', () => {
	const roomId = 'qw_test_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7); // Host
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7); // Player

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'QW Test Room', [bob]);
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
		const alicePlayerInRoom = room.state.players.find((p) => p.id === alice)!;
		alicePlayerInRoom.hand = [];

		// Alice loses
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'debugForceLose' }));
		expect(room.state.status).toBe('ended');

		const alicePlayer = room.state.players.find((p) => p.id === alice)!;
		expect(alicePlayer.isSkitgubbe).toBe(true);

		const heartsJ = alicePlayer.hand.find((c) => c.id === 'hearts-J');
		const spadesQ = alicePlayer.hand.find((c) => c.id === 'spades-Q');

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
		const chatMessages = sockAlice.sent.filter((m) => m.type === 'chatMessage');
		expect(chatMessages.length).toBe(5);

		// Send 6th chat message (should fail with rate limit error)
		room.handleMessage(sockAlice as any, JSON.stringify({ type: 'chat', message: 'rate limited' }));

		const lastMsg = sockAlice.sent[sockAlice.sent.length - 1];
		expect(lastMsg?.type).toBe('error');
		expect(lastMsg?.message).toBe('Chat rate limit exceeded. Please wait.');
	});
});

describe('QW-11: Parameterize the LIMIT interpolation in db.ts:getPlayerStatsBreakdown', () => {
	const charlie = 'charlie_' + Math.random().toString(36).substring(2, 7);
	const dummy = 'dummy_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(charlie, 'Charlie', '#0000ff');
		dbOps.createProfile(dummy, 'Dummy', '#cccccc');
	});

	afterAll(() => {
		try {
			dbOps.deleteProfile(charlie);
		} catch {}
		try {
			dbOps.deleteProfile(dummy);
		} catch {}
	});

	test('should return correct stats with limits 10, 50, and all', () => {
		// Let's insert 15 games for Charlie.
		// Charlie is skitgubbe in 5, sweetgubbe in 5, and trumfman in 5.
		for (let i = 0; i < 15; i++) {
			const gameId = `charlie_game_${i}`;
			dbOps.createGame(gameId, charlie, `Game ${i}`, [dummy]);
			const state = {
				players: [
					{
						id: charlie,
						inviteStatus: 'accepted',
						isSkitgubbe: i < 5 ? 1 : 0,
						isSweetgubbe: i >= 5 && i < 10 ? 1 : 0,
						isTrumfman: i >= 10 ? 1 : 0,
						isConstipated: 0,
						isMegaConstipated: 0
					},
					{
						id: dummy,
						inviteStatus: 'accepted',
						isSkitgubbe: i >= 5 ? 1 : 0,
						isSweetgubbe: 0,
						isTrumfman: 0,
						isConstipated: 0,
						isMegaConstipated: 0
					}
				]
			};
			dbOps.recordGameResults(gameId, state);
			// Update finished_at to have distinct, increasing timestamps to ensure deterministic DESC order
			const fakeFinishedAt = new Date(Date.now() + i * 1000).toISOString();
			db.run('UPDATE game_player_results SET finished_at = ? WHERE game_id = ?', [
				fakeFinishedAt,
				gameId
			]);
		}

		const stats = dbOps.getPlayerStatsBreakdown(charlie);

		// With last10, we should see 10 games total.
		// Since we finished games in order, the last 10 games are index 5 to 14.
		// index 5 to 9 are sweetgubbe (5 games)
		// index 10 to 14 are trumfman (5 games)
		// So skitgubbe should be 0.
		expect(stats.last10.games).toBe(10);
		expect(stats.last10.sweetgubbe).toBe(5);
		expect(stats.last10.trumfman).toBe(5);
		expect(stats.last10.skitgubbe).toBe(0);

		// With last50, we should see 15 games total.
		expect(stats.last50.games).toBe(15);
		expect(stats.last50.skitgubbe).toBe(5);
		expect(stats.last50.sweetgubbe).toBe(5);
		expect(stats.last50.trumfman).toBe(5);

		// With all, we should see 15 games total.
		expect(stats.all.games).toBe(15);
		expect(stats.all.skitgubbe).toBe(5);
		expect(stats.all.sweetgubbe).toBe(5);
		expect(stats.all.trumfman).toBe(5);

		// Clean up games
		for (let i = 0; i < 15; i++) {
			try {
				dbOps.deleteGame(`charlie_game_${i}`);
			} catch {}
		}
	});
});

describe('QW-23: Geolocation sanitization', () => {
	test('isValidIp validation', () => {
		// Valid IPv4
		expect(isValidIp('127.0.0.1')).toBe(true);
		expect(isValidIp('8.8.8.8')).toBe(true);
		expect(isValidIp('192.168.1.1')).toBe(true);
		expect(isValidIp('1.2.3.4, 5.6.7.8')).toBe(true); // first segment is valid

		// Invalid IPv4
		expect(isValidIp('256.0.0.1')).toBe(false);
		expect(isValidIp('1.2.3')).toBe(false);
		expect(isValidIp('1.2.3.4.5')).toBe(false);
		expect(isValidIp('a.b.c.d')).toBe(false);
		expect(isValidIp('1.2.3. ')).toBe(false);
		expect(isValidIp('1.2.3.4a')).toBe(false);

		// Valid IPv6
		expect(isValidIp('::1')).toBe(true);
		expect(isValidIp('2001:db8::')).toBe(true);
		expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
		expect(isValidIp('::1, 2001:db8::')).toBe(true); // first segment is valid

		// Invalid IPv6
		expect(isValidIp('2001:db8::g')).toBe(false);
		expect(isValidIp('2001:db8:85a3:0000:0000:8a2e:0370:7334:5678:9abc:def0')).toBe(false); // too long
		expect(isValidIp('12345')).toBe(false); // no colon
		expect(isValidIp('invalid_ip, 127.0.0.1')).toBe(false); // first segment is invalid
	});

	test('getIpLocation behaviour', async () => {
		// Private IP
		const localRes = await getIpLocation('127.0.0.1');
		expect(localRes).toBe('Lokalt nätverk');

		// Invalid IP
		const invalidRes = await getIpLocation('invalid-ip-format');
		expect(invalidRes).toBe('Okänd plats');

		// Valid IP with mocked API response
		const originalFetch = globalThis.fetch;
		let requestedUrl = '';
		globalThis.fetch = mock((url: string) => {
			requestedUrl = url;
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						cityName: 'Stockholm',
						countryName: 'Sweden',
						countryCode: 'SE'
					})
			});
		}) as any;

		try {
			const res = await getIpLocation('8.8.8.8');
			expect(res).toBe('Stockholm (SE)');
			expect(requestedUrl).toBe('https://freeipapi.com/api/json/8.8.8.8');

			// Check URI encoding
			await getIpLocation('2001:db8::1');
			expect(requestedUrl).toBe('https://freeipapi.com/api/json/2001%3Adb8%3A%3A1');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
