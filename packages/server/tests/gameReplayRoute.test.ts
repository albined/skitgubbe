import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { sign } from 'hono/jwt';

mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test', privateKey: 'test' })
	}
}));

import { decodeReplayFrame, type ApiGameReplay } from 'shared';
import { gamesApp } from '../src/routes/games';
import { dbOps } from '../src/db';
import { logLinesAdded } from '../src/replayFrames';
import { JWT_SECRET } from '../src/utils/jwt';

describe('watching a finished game back', () => {
	const suffix = crypto.randomUUID();
	const roomId = `replay-${suffix}`;
	const hostId = `host-${suffix}`;
	const guestId = `guest-${suffix}`;
	const outsiderId = `outsider-${suffix}`;
	const cookies: Record<string, string> = {};

	beforeAll(async () => {
		dbOps.createProfile(hostId, 'Anna', '#ff0000');
		dbOps.createProfile(guestId, 'Bertil', '#00ff00');
		dbOps.createProfile(outsiderId, 'Cecilia', '#0000ff');
		dbOps.createGame(roomId, hostId, 'Kvällsspelet', [guestId]);
		dbOps.joinGame(roomId, guestId);
		dbOps.saveMove(roomId, dbOps.getNextMoveSeq(roomId), guestId, 'A');
		for (const id of [hostId, guestId, outsiderId]) {
			cookies[id] =
				`skitgubbe_session=${await sign({ profileId: id, exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET, 'HS256')}`;
		}
	});

	afterAll(() => {
		dbOps.deleteGame(roomId);
		for (const id of [hostId, guestId, outsiderId]) dbOps.deleteProfile(id);
	});

	const request = (profileId?: string) =>
		gamesApp.request(`/${roomId}/replay`, {
			headers: profileId ? { Cookie: cookies[profileId] } : {}
		});

	test('is only for players of a finished game', async () => {
		expect((await request()).status).toBe(401);
		expect((await request(hostId)).status).toBe(409);
		dbOps.updateGameStatus(roomId, 'ended', null);
		expect((await request(outsiderId)).status).toBe(403);
		expect((await request(guestId)).status).toBe(200);
	});

	test('returns one frame before the first move and one after each move', async () => {
		dbOps.updateGameStatus(roomId, 'ended', null);
		const replay = (await (await request(guestId)).json()) as ApiGameReplay;
		const moves = dbOps.getGameMoves(roomId);

		expect(replay.viewerId).toBe(guestId);
		expect(replay.name).toBe('Kvällsspelet');
		expect(replay.players.map((p) => p.name).sort()).toEqual(['Anna', 'Bertil']);
		expect(replay.frames.length).toBe(moves.length + 1);
		expect(replay.frames[0].move).toBeNull();
		expect(replay.frames.slice(1).map((f) => f.move?.type)).toEqual(['S', 'A']);
		expect(replay.frames[2].log).toContain('Bertil accepterade inbjudan.');

		// Both hands are dealt and face up, and every card is somewhere.
		const last = decodeReplayFrame(replay.frames[2], replay.players);
		for (const player of last.players) expect(player.hand.length).toBe(3);
		const cards = [...last.deck, ...last.players.flatMap((p) => p.hand)].map((c) => c.id);
		expect(new Set(cards).size).toBe(52);
	});
});

describe('logLinesAdded', () => {
	test('returns the lines appended after the previous log', () => {
		expect(logLinesAdded(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
		expect(logLinesAdded(['a', 'b'], ['a', 'b'])).toEqual([]);
	});

	test('allows for lines dropped off the front of a full log', () => {
		expect(logLinesAdded(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['d']);
		expect(logLinesAdded(['a', 'b', 'c'], ['c', 'd', 'e'])).toEqual(['d', 'e']);
	});

	test('treats a replaced log as all new', () => {
		expect(logLinesAdded(['Rummet är skapat.'], ['Spelet startar.'])).toEqual(['Spelet startar.']);
	});
});
