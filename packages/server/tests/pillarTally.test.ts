import { afterEach, expect, test } from 'bun:test';
import { db, dbOps } from '../src/db';

const prefix = 'pillar-test-';
afterEach(() => {
	db.run('DELETE FROM skitgubbe_history WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM player_titles WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM game_player_results WHERE profile_id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM games WHERE id LIKE ?', [prefix + '%']);
	db.run('DELETE FROM profiles WHERE id LIKE ?', [prefix + '%']);
});
function player(n: number) {
	const id = prefix + n;
	dbOps.createProfile(id, `Player ${n}`, '#ffffff');
	return id;
}
function result(
	id: string,
	name: string,
	loser = 1,
	sweet = 0,
	trump = 0,
	timestamp = '2026-01-01 12:00:00'
) {
	const game = prefix + name;
	db.run("INSERT INTO games (id, status) VALUES (?, 'ended')", [game]);
	db.run(
		'INSERT INTO game_player_results (game_id, profile_id, is_skitgubbe, is_sweetgubbe, is_trumfman, finished_at) VALUES (?,?,?,?,?,?)',
		[game, id, loser, sweet, trump, timestamp]
	);
	if (loser) db.run('INSERT INTO skitgubbe_history (game_id, profile_id) VALUES (?,?)', [game, id]);
}

test('pillar returns the latest five distinct losers, with lifetime counts rather than ranking by losses', () => {
	const ids = Array.from({ length: 7 }, (_, i) => player(i));
	ids.slice(0, 6).forEach((id, i) => result(id, String(i)));
	result(ids[1], 'repeat');
	const rows = dbOps.getPillarTally();
	expect(rows.map((p) => p.id)).toEqual([ids[1], ids[5], ids[4], ids[3], ids[2]]);
	expect(rows[0].skitgubbe).toBe(2);
	expect(rows[1].skitgubbe).toBe(1);
});

test('decorations show the title each player holds, hidden for the reigning skitgubbe', () => {
	const earlier = player(10);
	const reigning = player(11);
	result(earlier, 'earlier-loss');
	result(reigning, 'latest-loss');
	const hold = (id: string, title: string) =>
		db.run('INSERT OR REPLACE INTO player_titles (profile_id, title, earned_at) VALUES (?, ?, 0)', [
			id,
			title
		]);

	hold(earlier, 'sweetgubbe');
	hold(reigning, 'trumfman');
	const rows = dbOps.getPillarTally();
	expect(rows.find((p) => p.id === earlier)).toMatchObject({
		isSweetgubbe: true,
		isTrumfman: false
	});
	expect(rows.find((p) => p.id === reigning)).toMatchObject({
		isSweetgubbe: false,
		isTrumfman: false
	});

	hold(earlier, 'trumfman');
	expect(dbOps.getPillarTally().find((p) => p.id === earlier)).toMatchObject({
		isSweetgubbe: false,
		isTrumfman: true
	});
	db.run('DELETE FROM player_titles WHERE profile_id = ?', [earlier]);
	expect(dbOps.getPillarTally().find((p) => p.id === earlier)).toMatchObject({
		isSweetgubbe: false,
		isTrumfman: false
	});
});

test('fewer than five distinct losers leaves spare rows rather than adding players who never lost', () => {
	const id = player(20);
	player(21);
	result(id, 'only-loss');
	const rows = dbOps.getPillarTally();
	expect(rows.map((p) => p.id)).toEqual([id]);
	expect(rows[0]).toMatchObject({ isSweetgubbe: false, isTrumfman: false });
});
