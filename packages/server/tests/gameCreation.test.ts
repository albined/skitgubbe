import { describe, test, expect, afterAll, beforeAll, mock } from 'bun:test';

const mockSendNotification = mock(() => Promise.resolve({ statusCode: 201 }));

mock.module('web-push', () => {
	return {
		default: {
			sendNotification: mockSendNotification
		}
	};
});

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
		// Clean up lingering games for host/guest to prevent foreign key errors on profile delete
		try {
			const hostGames = dbOps.getGamesForProfile(hostId);
			for (const g of hostGames) {
				dbOps.deleteGame(g.id);
			}
		} catch (e) {}
		try {
			const guestGames = dbOps.getGamesForProfile(guestId);
			for (const g of guestGames) {
				dbOps.deleteGame(g.id);
			}
		} catch (e) {}

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

	test('sends push notifications to invited players', async () => {
		// Mock a push subscription for the guest
		dbOps.addPushSubscription(guestId, 'https://updates.push.services.mozilla.com/wpush/v1/mock', 'p256dh_key', 'auth_key');

		mockSendNotification.mockClear();

		const res = await app.request('/api/games/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': authCookie
			},
			body: JSON.stringify({
				name: 'Test Room',
				invitedProfileIds: [guestId]
			})
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.roomId).toBeDefined();

		// Yield event loop to let async notification fire
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(mockSendNotification).toHaveBeenCalled();
		const calls = mockSendNotification.mock.calls as any[][];
		const calledArgs = calls[0];
		expect(calledArgs[0].endpoint).toBe('https://updates.push.services.mozilla.com/wpush/v1/mock');
		
		const payload = JSON.parse(calledArgs[1]);
		expect(payload.title).toBe('Skitgubbe');
		expect(payload.body).toContain('Host Player har bjudit in dig till "Test Room"');
		expect(payload.url).toBe('/');

		// Clean up
		dbOps.deleteGame(data.roomId);
		dbOps.deletePushSubscription('https://updates.push.services.mozilla.com/wpush/v1/mock');
	});

	test('declining a pending invitation removes player from DB immediately', async () => {
		// Create game with host and guest
		const createRes = await app.request('/api/games/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': authCookie
			},
			body: JSON.stringify({
				name: 'Test Decline Room',
				invitedProfileIds: [guestId]
			})
		});
		expect(createRes.status).toBe(200);
		const { roomId } = await createRes.json();

		// Authenticate guest
		const selectRes = await app.request(`/api/profiles/${guestId}/select`, {
			method: 'POST'
		});
		expect(selectRes.status).toBe(200);
		const guestCookie = selectRes.headers.get('set-cookie') || '';

		// Guest declines the game invitation
		const declineRes = await app.request(`/api/games/${roomId}/decline`, {
			method: 'POST',
			headers: {
				'Cookie': guestCookie
			}
		});
		expect(declineRes.status).toBe(200);

		// Verify game_players is deleted for guest
		const players = dbOps.getGamePlayers(roomId);
		const guestInGame = players.find(p => p.profile_id === guestId);
		expect(guestInGame).toBeUndefined();

		// Clean up game
		dbOps.deleteGame(roomId);
	});
});

