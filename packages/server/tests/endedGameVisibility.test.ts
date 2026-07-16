import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';

// Avoid real web-push calls
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { dbOps } from '../src/db.js';

describe('Ended games stay in the lobby until the result is viewed (archived)', () => {
	const roomId = 'ended_vis_' + Math.random().toString(36).substring(2, 8);
	const alice = 'alice_' + Math.random().toString(36).substring(2, 7);
	const bob = 'bob_' + Math.random().toString(36).substring(2, 7);

	beforeAll(() => {
		dbOps.createProfile(alice, 'Alice', '#ff0000');
		dbOps.createProfile(bob, 'Bob', '#00ff00');
		dbOps.createGame(roomId, alice, 'Ended Vis Room', [bob]);
		dbOps.joinGame(roomId, bob);
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

	test('an ended, unarchived game is listed as active, not archived', () => {
		dbOps.updateGameStatus(roomId, 'ended', null);

		const active = dbOps.getGamesForProfile(alice).map((g) => g.id);
		const archived = dbOps.getArchivedGamesForProfile(alice).map((g) => g.id);
		expect(active).toContain(roomId);
		expect(archived).not.toContain(roomId);
	});

	test('archiving (viewing the result) moves it to the archive, per player', () => {
		dbOps.archiveGames(alice, [roomId]);

		// Alice has seen it: archived for her
		expect(dbOps.getGamesForProfile(alice).map((g) => g.id)).not.toContain(roomId);
		expect(dbOps.getArchivedGamesForProfile(alice).map((g) => g.id)).toContain(roomId);

		// Bob has not: still in his active list
		expect(dbOps.getGamesForProfile(bob).map((g) => g.id)).toContain(roomId);
		expect(dbOps.getArchivedGamesForProfile(bob).map((g) => g.id)).not.toContain(roomId);
	});
});
