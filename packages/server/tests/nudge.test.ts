import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { sign } from 'hono/jwt';

const deliveries: { title: string; body: string; url: string }[] = [];
mock.module('web-push', () => ({
	default: {
		sendNotification: async (_subscription: unknown, payload: string) => {
			deliveries.push(JSON.parse(payload));
		},
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test', privateKey: 'test' })
	}
}));

import { gamesApp } from '../src/routes/games';
import { dbOps } from '../src/db';
import { rooms } from '../src/rooms';
import { JWT_SECRET } from '../src/utils/jwt';
import type { GameSocket } from '../src/gameRoom';

describe('offline turn nudges', () => {
	const suffix = crypto.randomUUID();
	const roomId = `nudge-${suffix}`;
	const senderId = `sender-${suffix}`;
	const targetId = `target-${suffix}`;
	const otherId = `other-${suffix}`;
	let cookie: string;
	beforeAll(async () => {
		dbOps.createProfile(senderId, 'Albin', '#ff0000');
		dbOps.createProfile(targetId, 'Bertil', '#00ff00');
		dbOps.createProfile(otherId, 'Cecilia', '#0000ff');
		dbOps.createGame(roomId, senderId, 'Kvällsspelet', [targetId, otherId]);
		cookie = `skitgubbe_session=${await sign({ profileId: senderId, exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET, 'HS256')}`;
	});
	beforeEach(() => {
		rooms.evict(roomId);
		const room = rooms.getOrCreate(roomId);
		room.state.status = 'playing';
		room.state.players.forEach((player) => {
			player.inviteStatus = 'accepted';
		});
		room.state.activePlayerIdx = room.state.players.findIndex((player) => player.id === targetId);
		room.playerSockets.set(senderId, {} as GameSocket);
		room.playerSockets.set(otherId, {} as GameSocket);
		deliveries.length = 0;
	});
	afterAll(() => {
		rooms.evict(roomId);
		dbOps.deleteGame(roomId);
		for (const id of [senderId, targetId, otherId]) dbOps.deleteProfile(id);
	});
	const request = (authenticated = true) =>
		gamesApp.request(`/${roomId}/nudge/${targetId}`, {
			method: 'POST',
			headers: authenticated ? { Cookie: cookie } : {}
		});

	test('requires authentication and active room participation', async () => {
		expect((await request(false)).status).toBe(401);
		const room = rooms.get(roomId)!;
		expect(room.claimNudge('outsider', targetId).success).toBe(false);
		room.playerSockets.delete(senderId);
		expect((await request()).status).toBe(403);
	});
	test('accepts the offline current player and rate limits all senders together', async () => {
		dbOps.addPushSubscription(targetId, `https://push.example/${targetId}`, 'test', 'test');
		expect((await request()).status).toBe(202);
		expect(deliveries).toEqual([
			{
				title: 'Skitgubbe – din tur',
				body: 'Albin väntar på att du ska göra ditt drag i "Kvällsspelet".',
				url: `/room/${roomId}`
			}
		]);
		dbOps.deletePushSubscription(`https://push.example/${targetId}`);
		expect((await request()).status).toBe(429);
		const room = rooms.get(roomId)!;
		expect(room.claimNudge(otherId, targetId)).toMatchObject({ success: false, code: 429 });
		expect(room.claimNudge(otherId, targetId, Date.now() + 60_001)).toMatchObject({
			success: true,
			senderName: 'Cecilia'
		});
	});
	test('rejects online targets and stale turns', async () => {
		const room = rooms.get(roomId)!;
		room.playerSockets.set(targetId, {} as GameSocket);
		expect((await request()).status).toBe(409);
		room.playerSockets.delete(targetId);
		room.state.activePlayerIdx = room.state.players.findIndex((player) => player.id === senderId);
		expect((await request()).status).toBe(409);
		expect(room.claimNudge(senderId, senderId).success).toBe(false);
	});
	test('rejects finished games, trick transitions, departed and pending players', () => {
		const room = rooms.get(roomId)!;
		const target = room.state.players[room.state.activePlayerIdx];
		room.state.status = 'ended';
		expect(room.claimNudge(senderId, targetId).success).toBe(false);
		room.state.status = 'playing';
		room.state.trickWinnerId = targetId;
		expect(room.claimNudge(senderId, targetId).success).toBe(false);
		room.state.trickWinnerId = null;
		target.hasLeft = true;
		expect(room.claimNudge(senderId, targetId).success).toBe(false);
		target.hasLeft = false;
		target.inviteStatus = 'pending';
		expect(room.claimNudge(senderId, targetId).success).toBe(false);
	});
});
