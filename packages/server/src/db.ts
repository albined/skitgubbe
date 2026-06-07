import { Database } from 'bun:sqlite';

const db = new Database('skitgubbe.db');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Initialize Schema
db.run(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'waiting',
    active_player_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (active_player_id) REFERENCES profiles (id) ON DELETE SET NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    is_ready INTEGER DEFAULT 0,
    invite_status TEXT NOT NULL DEFAULT 'pending',
    turn_order INTEGER DEFAULT 0,
    PRIMARY KEY (game_id, profile_id),
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );
`);

try {
	db.run("ALTER TABLE game_players ADD COLUMN invite_status TEXT NOT NULL DEFAULT 'pending';");
} catch (e) {
	// Column already exists
}

// Types
export interface DbProfile {
	id: string;
	name: string;
	color: string;
	created_at: string;
}

export interface DbGame {
	id: string;
	status: 'waiting' | 'playing' | 'ended';
	active_player_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface DbGamePlayer {
	game_id: string;
	profile_id: string;
	role: 'host' | 'player';
	is_ready: number;
	invite_status: 'pending' | 'accepted';
	turn_order: number;
	name?: string; // joined from profiles
	color?: string; // joined from profiles
}

// Queries
export const dbOps = {
	// Profile Operations
	getAllProfiles(): DbProfile[] {
		const stmt = db.query('SELECT * FROM profiles ORDER BY name ASC');
		return stmt.all() as DbProfile[];
	},

	getProfileById(id: string): DbProfile | null {
		const stmt = db.query('SELECT * FROM profiles WHERE id = ?');
		return stmt.get(id) as DbProfile | null;
	},

	createProfile(id: string, name: string, color: string): DbProfile {
		db.run('INSERT INTO profiles (id, name, color) VALUES (?, ?, ?)', [id, name, color]);
		return { id, name, color, created_at: new Date().toISOString() };
	},

	updateProfile(id: string, name: string, color: string): void {
		db.run('UPDATE profiles SET name = ?, color = ? WHERE id = ?', [name, color, id]);
	},

	// Game Operations
	getGame(gameId: string): DbGame | null {
		const stmt = db.query('SELECT * FROM games WHERE id = ?');
		return stmt.get(gameId) as DbGame | null;
	},

	createGame(gameId: string, hostProfileId: string, invitedProfileIds: string[] = []): void {
		db.transaction(() => {
			db.run('INSERT INTO games (id, status, active_player_id) VALUES (?, ?, ?)', [gameId, 'playing', hostProfileId]);
			db.run(
				'INSERT INTO game_players (game_id, profile_id, role, is_ready, invite_status) VALUES (?, ?, ?, ?, ?)',
				[gameId, hostProfileId, 'host', 1, 'accepted']
			);
			for (const profileId of invitedProfileIds) {
				db.run(
					'INSERT INTO game_players (game_id, profile_id, role, is_ready, invite_status) VALUES (?, ?, ?, ?, ?)',
					[gameId, profileId, 'player', 0, 'pending']
				);
			}
		})();
	},

	joinGame(gameId: string, profileId: string): void {
		// Check if player is already in game
		const stmt = db.query('SELECT invite_status FROM game_players WHERE game_id = ? AND profile_id = ?');
		const exists = stmt.get(gameId, profileId) as { invite_status: string } | null;
		if (!exists) {
			db.run(
				'INSERT INTO game_players (game_id, profile_id, role, is_ready, invite_status) VALUES (?, ?, ?, ?, ?)',
				[gameId, profileId, 'player', 1, 'accepted']
			);
		} else if (exists.invite_status === 'pending') {
			db.run(
				'UPDATE game_players SET invite_status = "accepted", is_ready = 1 WHERE game_id = ? AND profile_id = ?',
				[gameId, profileId]
			);
		}
	},

	getGamesForProfile(profileId: string) {
		// Get all games the user is part of.
		// We want to return game metadata plus active player name/color, and if it is the current user's turn.
		// Sorted by whether it is the profile's turn first.
		const query = `
			SELECT g.id, g.status, g.active_player_id, g.updated_at,
			       p_active.name as active_player_name, p_active.color as active_player_color,
			       gp.role, gp.invite_status,
			       (CASE WHEN g.active_player_id = ? THEN 1 ELSE 0 END) as is_my_turn
			FROM games g
			JOIN game_players gp ON g.id = gp.game_id
			LEFT JOIN profiles p_active ON g.active_player_id = p_active.id
			WHERE gp.profile_id = ?
			ORDER BY is_my_turn DESC, g.updated_at DESC
		`;
		return db.query(query).all(profileId, profileId) as Array<{
			id: string;
			status: 'waiting' | 'playing' | 'ended';
			active_player_id: string | null;
			updated_at: string;
			active_player_name: string | null;
			active_player_color: string | null;
			role: 'host' | 'player';
			invite_status: 'pending' | 'accepted';
			is_my_turn: number;
		}>;
	},

	getGamePlayers(gameId: string): DbGamePlayer[] {
		const query = `
			SELECT gp.*, p.name, p.color
			FROM game_players gp
			JOIN profiles p ON gp.profile_id = p.id
			WHERE gp.game_id = ?
			ORDER BY gp.role DESC, gp.profile_id ASC
		`;
		return db.query(query).all(gameId) as DbGamePlayer[];
	},

	setPlayerReady(gameId: string, profileId: string, isReady: boolean): void {
		db.run('UPDATE game_players SET is_ready = ? WHERE game_id = ? AND profile_id = ?', [
			isReady ? 1 : 0,
			gameId,
			profileId
		]);
	},

	updateGameStatus(gameId: string, status: 'waiting' | 'playing' | 'ended', activePlayerId: string | null): void {
		db.run('UPDATE games SET status = ?, active_player_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
			status,
			activePlayerId,
			gameId
		]);
	},

	removePlayerFromGame(gameId: string, profileId: string): void {
		db.transaction(() => {
			// Get player info to see if they were the host
			const stmt = db.query('SELECT role FROM game_players WHERE game_id = ? AND profile_id = ?');
			const player = stmt.get(gameId, profileId) as { role: string } | null;

			db.run('DELETE FROM game_players WHERE game_id = ? AND profile_id = ?', [gameId, profileId]);

			// If they were host, promote another player if there is one
			if (player && player.role === 'host') {
				const nextPlayerStmt = db.query('SELECT profile_id FROM game_players WHERE game_id = ? LIMIT 1');
				const nextPlayer = nextPlayerStmt.get(gameId) as { profile_id: string } | null;
				if (nextPlayer) {
					db.run('UPDATE game_players SET role = "host", is_ready = 1 WHERE game_id = ? AND profile_id = ?', [
						gameId,
						nextPlayer.profile_id
					]);
				} else {
					// No players left, clean up the game
					db.run('DELETE FROM games WHERE id = ?', [gameId]);
				}
			}
		})();
	}
};
