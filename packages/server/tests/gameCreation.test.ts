import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { app } from '../src/index.js';
import { dbOps } from '../src/db.js';

describe('Game Creation Validation', () => {
	const hostId = 'host_' + Math.random().toString(36).substring(2, 9);
	const guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
	let authCookie = '';

	beforeAll(async () => {
		// Create profiles in DB
		dbOps.createProfile(hostId, 'Host Player', '#ff0000');
		dbOps.createProfile(guestId, 'Guest Player', '#00ff00');

		// Authenticate host
		const selectRes = await app.request(`/api/profiles/${hostId}/select`, {
			method: 'POST'
		});
		expect(selectRes.status).toBe(200);
		authCookie = selectRes.headers.get('set-cookie') || '';
		expect(authCookie).toContain('skitgubbe_session');
	});

	afterAll(() => {
		// Clean up created profiles
		dbOps.deleteProfile(hostId);
		dbOps.deleteProfile(guestId);
	});

	test('rejects creation when no other players are invited', async () => {
		const res = await app.request('/api/games/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': authCookie
			},
			body: JSON.stringify({
				name: 'Solo Room',
				invitedProfileIds: []
			})
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('You must invite at least one other player to create a game.');
	});

	test('rejects creation when only the host themselves is invited', async () => {
		const res = await app.request('/api/games/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': authCookie
			},
			body: JSON.stringify({
				name: 'Self Invited Room',
				invitedProfileIds: [hostId]
			})
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('You must invite at least one other player to create a game.');
	});

	test('allows creation when at least one other player is invited', async () => {
		const res = await app.request('/api/games/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': authCookie
			},
			body: JSON.stringify({
				name: 'Valid Multiplayer Room',
				invitedProfileIds: [guestId]
			})
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.roomId).toBeDefined();

		// Clean up the created game
		dbOps.deleteGame(data.roomId);
	});
});
