import { describe, test, expect, afterEach, mock } from 'bun:test';

// Avoid real web-push calls
mock.module('web-push', () => ({
	default: {
		sendNotification: mock(() => Promise.resolve({ statusCode: 201 })),
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test-public-key', privateKey: 'test-private-key' })
	}
}));

import { createDeck, type GameState } from 'shared';
import { db, dbOps } from '../src/db.js';
import { rooms } from '../src/rooms.js';
import { applyClearTrick } from '../src/gameLogic.js';

const prefix = 'titles-test-';
let counter = 0;

afterEach(() => {
	for (const row of db.query('SELECT id FROM games WHERE id LIKE ?').all(prefix + '%') as {
		id: string;
	}[]) {
		rooms.evict(row.id);
	}
	db.run('DELETE FROM skitgubbe_history WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM game_player_results WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM game_moves WHERE game_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM game_players WHERE game_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM games WHERE id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM player_titles WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM profiles WHERE id LIKE ?', [prefix + '%']);
});

function profiles(...names: string[]) {
	return names.map((name) => {
		const id = `${prefix}${name}-${++counter}`;
		dbOps.createProfile(id, name, '#ffffff');
		return id;
	});
}

function game(ids: string[]) {
	const gameId = `${prefix}game-${++counter}`;
	dbOps.createGame(gameId, ids[0], 'Titles', ids.slice(1));
	for (const id of ids.slice(1)) dbOps.joinGame(gameId, id);
	return gameId;
}

// Only the per-player outcome flags matter to the title bookkeeping.
function outcome(players: Record<string, Partial<GameState['players'][number]>>) {
	return {
		players: Object.entries(players).map(([id, flags]) => ({
			id,
			inviteStatus: 'accepted',
			isSkitgubbe: false,
			...flags
		}))
	} as unknown as GameState;
}

const luck = () => dbOps.getPlayerTitles().luck;

describe('player titles', () => {
	test('reaching phase 2 hands out the titles at once, replacing the other one, once per game', () => {
		const [ann, bob] = profiles('ann', 'bob');
		db.run("INSERT INTO player_titles (profile_id, title, earned_at) VALUES (?, 'sweetgubbe', 1)", [
			ann
		]);
		const gameId = game([ann, bob]);

		expect(
			dbOps.recordPhase2(gameId, outcome({ [ann]: { isTrumfman: true }, [bob]: {} }), 100)
		).toBe(true);
		expect(luck()[ann]).toBe('trumfman');
		expect(luck()[bob]).toBeUndefined();

		expect(dbOps.recordPhase2(gameId, outcome({ [bob]: { isSweetgubbe: true } }), 200)).toBe(false);
		expect(luck()[bob]).toBeUndefined();
	});

	test('a finished game costs the title of everyone who got neither, and nobody else', () => {
		const [ann, bob, cid] = profiles('ann', 'bob', 'cid');
		db.run(
			"INSERT INTO player_titles (profile_id, title, earned_at) VALUES (?, 'trumfman', 1), (?, 'sweetgubbe', 1)",
			[ann, bob]
		);
		const gameId = game([ann, bob, cid]);
		const result = outcome({ [ann]: {}, [bob]: {}, [cid]: { isSweetgubbe: true } });
		result.players[1].isSkitgubbe = true;
		dbOps.recordPhase2(gameId, result, 100);
		dbOps.recordGameResults(gameId, result);

		expect(luck()).toEqual({ [cid]: 'sweetgubbe' });
	});

	test('a title earned after a game reached phase 2 survives that game finishing', () => {
		const [ann, bob] = profiles('ann', 'bob');
		const older = game([ann, bob]);
		const newer = game([ann, bob]);
		const neither = outcome({ [ann]: {}, [bob]: { isSkitgubbe: true } });

		dbOps.recordPhase2(older, neither, 100);
		dbOps.recordPhase2(newer, outcome({ [ann]: { isTrumfman: true }, [bob]: {} }), 200);
		dbOps.recordGameResults(older, neither);

		expect(luck()[ann]).toBe('trumfman');
	});

	test('a game that ends before phase 2 still costs the titles held going in', () => {
		const [ann, bob] = profiles('ann', 'bob');
		db.run("INSERT INTO player_titles (profile_id, title, earned_at) VALUES (?, 'trumfman', 1)", [
			ann
		]);
		const gameId = game([ann, bob]);
		dbOps.recordGameResults(gameId, outcome({ [ann]: {}, [bob]: { isSkitgubbe: true } }));

		expect(luck()[ann]).toBeUndefined();
	});

	test('a game that ends without a loser takes no title away', () => {
		const [ann, bob] = profiles('ann', 'bob');
		db.run("INSERT INTO player_titles (profile_id, title, earned_at) VALUES (?, 'trumfman', 1)", [
			ann
		]);
		const gameId = game([ann, bob]);
		const abandoned = outcome({ [ann]: {}, [bob]: {} });
		dbOps.recordPhase2(gameId, abandoned, 100);
		dbOps.recordGameResults(gameId, abandoned);

		expect(luck()[ann]).toBe('trumfman');
	});

	test('a Trumfman crowned in one room shows up in every other open room right away', () => {
		const [ann, bob] = profiles('ann', 'bob');
		const here = game([ann, bob]);
		const elsewhere = game([ann, bob]);

		const watcher = fakeSocket();
		const other = rooms.getOrCreate(elsewhere);
		other.addClient(watcher as any, bob);
		other.handleMessage(watcher as any, JSON.stringify({ type: 'join', playerId: bob }));
		expect(watcher.sent.find((m) => m.type === 'titles')?.titles.luck[bob]).toBeUndefined();

		// The last trick of phase 1: ann won it, bob ends empty-handed but owns
		// the hidden trump, so the phase change makes him Trumfman.
		const room = rooms.getOrCreate(here);
		const card = (id: string) => createDeck().find((c) => c.id === id)!;
		const [annP, bobP] = [ann, bob].map((id) => room.state.players.find((p) => p.id === id)!);
		room.state.deck = [];
		annP.hand = [];
		annP.reserveStack = [card('clubs-10'), card('clubs-J')];
		bobP.hand = [];
		bobP.reserveStack = [];
		room.state.hiddenTrumpStorage = { playerId: bob, card: card('diamonds-K') };
		room.state.trickWinnerId = ann;
		(room as any).commitMove(ann, 'T', undefined, () => applyClearTrick(room.state));

		expect(room.state.phase).toBe(2);
		expect(watcher.sent.filter((m) => m.type === 'titles').at(-1)?.titles.luck[bob]).toBe(
			'trumfman'
		);
	});
});

function fakeSocket() {
	const sent: any[] = [];
	return {
		raw: {},
		sent,
		send(data: string) {
			sent.push(JSON.parse(data));
		},
		close() {}
	};
}
