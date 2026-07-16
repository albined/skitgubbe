import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { app } from '../src/index.js';
import { dbOps } from '../src/db.js';

describe('WS Upgrade Early Validation', () => {
	const hostId = 'host_' + Math.random().toString(36).substring(2, 9);
	const guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
	const roomId = 'room_' + Math.random().toString(36).substring(2, 9);

	beforeAll(() => {
		dbOps.createProfile(hostId, 'Host Player', '#ff0000');
		dbOps.createProfile(guestId, 'Guest Player', '#00ff00');
	});

	afterAll(() => {
		try { dbOps.deleteGame(roomId); } catch {}
		try { dbOps.deleteProfile(hostId); } catch {}
		try { dbOps.deleteProfile(guestId); } catch {}
	});

	test('returns 404 for unknown roomId', async () => {
		const res = await app.request('/api/room/unknown_room_id_123/ws');
		expect(res.status).toBe(404);
		const text = await res.text();
		expect(text).toBe('Room not found');
	});

	test('allows connection (passes early validation) for valid roomId', async () => {
		dbOps.createGame(roomId, hostId, 'Valid Game Room', [guestId]);

		const res = await app.request(`/api/room/${roomId}/ws`);
		// Since it's not a real WebSocket upgrade request (no Upgrade headers),
		// it will pass our middleware check (not return 404 Room not found)
		// and reach Hono's upgradeWebSocket which will check upgrade headers and
		// likely return 404 / 400 or ignore it, but it won't be "Room not found".
		expect(res.status).not.toBe(404);
	});
});
