import { Database } from 'bun:sqlite';
import type { Card } from 'shared';
import { deckToString, cardsToString, createDeck, shuffle } from 'shared';

const isTest = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
const dbPath = process.env.DATABASE_PATH || (isTest ? ':memory:' : 'skitgubbe.db');
const db = new Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Initialize Schema
db.run(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    avatar_config TEXT,
    avatar_image TEXT
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    active_player_id TEXT,
    initial_deck TEXT,
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

db.run(`
  CREATE TABLE IF NOT EXISTS game_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    player_id TEXT NOT NULL REFERENCES profiles(id),
    move_type TEXT NOT NULL, -- 'S' (start), 'P' (play), 'U' (pickup), 'C' (chance), 'R' (sprinkle), 'A' (accept/join), 'L' (leave/decline)
    cards TEXT, -- comma-separated ints, null for pickup/leave
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_id, seq)
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS game_player_results (
    game_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    is_skitgubbe INTEGER DEFAULT 0,
    is_sweetgubbe INTEGER DEFAULT 0,
    is_trumfman INTEGER DEFAULT 0,
    is_constipated INTEGER DEFAULT 0,
    is_mega_constipated INTEGER DEFAULT 0,
    finished_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, profile_id),
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS skitgubbe_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS profile_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );
`);

// Check if migration is needed (if table games doesn't have initial_deck column)
let needsMigration = false;
try {
	db.query('SELECT initial_deck FROM games LIMIT 1').get();
} catch (e) {
	needsMigration = true;
}

if (needsMigration) {
	console.log('Migrating database: adding initial_deck column to games table.');
	try {
		db.run('ALTER TABLE games ADD COLUMN initial_deck TEXT;');
	} catch (e) {
		// Column might already exist
	}
}

try {
	db.run("ALTER TABLE profiles ADD COLUMN avatar_config TEXT;");
} catch (e) {
	// Column already exists
}

try {
	db.run("ALTER TABLE profiles ADD COLUMN avatar_image TEXT;");
} catch (e) {
	// Column already exists
}

try {
	db.run("ALTER TABLE game_players ADD COLUMN is_archived INTEGER DEFAULT 0;");
} catch (e) {
	// Column already exists
}


// Types
export interface DbProfile {
	id: string;
	name: string;
	color: string;
	created_at: string;
	avatar_config?: string | null;
	avatar_image?: string | null;
}

export interface DbProfileAccessLog {
	id: number;
	profile_id: string;
	device_info: string | null;
	ip_address: string | null;
	accessed_at: string;
}

export interface DbGame {
	id: string;
	name: string;
	status: 'waiting' | 'playing' | 'ended';
	active_player_id: string | null;
	initial_deck: string | null;
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
	is_archived?: number;
	name?: string; // joined from profiles
	color?: string; // joined from profiles
	avatar_config?: string | null; // joined from profiles
}

export interface DbMove {
	id: number;
	game_id: string;
	seq: number;
	player_id: string;
	move_type: 'S' | 'P' | 'U' | 'C' | 'R' | 'A' | 'L' | 'T';
	cards: string | null;
	created_at: string;
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

	updateProfileAvatar(id: string, avatarConfig: string): void {
		db.run('UPDATE profiles SET avatar_config = ? WHERE id = ?', [avatarConfig, id]);
	},

	deleteProfile(id: string): void {
		db.run('DELETE FROM profiles WHERE id = ?', [id]);
	},

	logProfileAccess(profileId: string, deviceInfo: string | null, ipAddress: string | null): void {
		db.transaction(() => {
			db.run(
				'INSERT INTO profile_access_logs (profile_id, device_info, ip_address) VALUES (?, ?, ?)',
				[profileId, deviceInfo, ipAddress]
			);

			// Keep only the last 5 logs for this profile
			const logsStmt = db.query('SELECT id FROM profile_access_logs WHERE profile_id = ? ORDER BY accessed_at DESC');
			const logs = logsStmt.all(profileId) as { id: number }[];

			if (logs.length > 5) {
				const idsToDelete = logs.slice(5).map(l => l.id);
				const placeholders = idsToDelete.map(() => '?').join(',');
				db.run(`DELETE FROM profile_access_logs WHERE id IN (${placeholders})`, idsToDelete);
			}
		})();
	},

	getProfileAccessLogs(profileId: string): DbProfileAccessLog[] {
		const stmt = db.query('SELECT * FROM profile_access_logs WHERE profile_id = ? ORDER BY accessed_at DESC LIMIT 5');
		return stmt.all(profileId) as DbProfileAccessLog[];
	},

	// Game Operations
	getGame(gameId: string): DbGame | null {
		const stmt = db.query('SELECT * FROM games WHERE id = ?');
		return stmt.get(gameId) as DbGame | null;
	},

	createGame(gameId: string, hostProfileId: string, name: string, invitedProfileIds: string[] = []): void {
		const initialDeck = shuffle(createDeck());
		const deckStr = deckToString(initialDeck);

		db.transaction(() => {
			db.run('INSERT INTO games (id, name, status, active_player_id, initial_deck) VALUES (?, ?, ?, ?, ?)', [
				gameId,
				name,
				'playing',
				hostProfileId,
				deckStr
			]);
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
			db.run(
				'INSERT INTO game_moves (game_id, seq, player_id, move_type) VALUES (?, 0, ?, ?)',
				[gameId, hostProfileId, 'S']
			);
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
			SELECT g.id, g.name, g.status, g.active_player_id, g.updated_at,
			       p_active.name as active_player_name, p_active.color as active_player_color,
			       gp.role, gp.invite_status, gp.is_archived,
			       (CASE WHEN g.active_player_id = ? THEN 1 ELSE 0 END) as is_my_turn
			FROM games g
			JOIN game_players gp ON g.id = gp.game_id
			LEFT JOIN profiles p_active ON g.active_player_id = p_active.id
			WHERE gp.profile_id = ? AND (gp.invite_status = 'pending' OR (gp.invite_status = 'accepted' AND g.status != 'ended' AND gp.is_archived = 0))
			ORDER BY is_my_turn DESC, g.updated_at DESC
		`;
		return db.query(query).all(profileId, profileId) as Array<{
			id: string;
			name: string | null;
			status: 'waiting' | 'playing' | 'ended';
			active_player_id: string | null;
			updated_at: string;
			active_player_name: string | null;
			active_player_color: string | null;
			role: 'host' | 'player';
			invite_status: 'pending' | 'accepted';
			is_archived: number;
			is_my_turn: number;
		}>;
	},

	getArchivedGamesForProfile(profileId: string) {
		const query = `
			SELECT g.id, g.name, g.status, g.active_player_id, g.updated_at,
			       p_active.name as active_player_name, p_active.color as active_player_color,
			       gp.role, gp.invite_status, gp.is_archived,
			       (CASE WHEN g.active_player_id = ? THEN 1 ELSE 0 END) as is_my_turn,
			       p_loser.name as loser_name, p_loser.color as loser_color, p_loser.avatar_config as loser_avatar_config
			FROM games g
			JOIN game_players gp ON g.id = gp.game_id
			LEFT JOIN profiles p_active ON g.active_player_id = p_active.id
			LEFT JOIN skitgubbe_history sh ON g.id = sh.game_id
			LEFT JOIN profiles p_loser ON sh.profile_id = p_loser.id
			WHERE gp.profile_id = ? AND gp.invite_status = 'accepted' AND (g.status = 'ended' OR gp.is_archived = 1)
			ORDER BY g.updated_at DESC
		`;
		return db.query(query).all(profileId, profileId) as Array<{
			id: string;
			name: string | null;
			status: 'waiting' | 'playing' | 'ended';
			active_player_id: string | null;
			updated_at: string;
			active_player_name: string | null;
			active_player_color: string | null;
			role: 'host' | 'player';
			invite_status: 'pending' | 'accepted';
			is_archived: number;
			is_my_turn: number;
			loser_name: string | null;
			loser_color: string | null;
			loser_avatar_config: string | null;
		}>;
	},

	archiveGames(profileId: string, gameIds: string[]): void {
		db.transaction(() => {
			for (const gameId of gameIds) {
				db.run('UPDATE game_players SET is_archived = 1 WHERE profile_id = ? AND game_id = ?', [profileId, gameId]);
			}
		})();
	},

	unarchiveGames(profileId: string, gameIds: string[]): void {
		db.transaction(() => {
			for (const gameId of gameIds) {
				db.run('UPDATE game_players SET is_archived = 0 WHERE profile_id = ? AND game_id = ?', [profileId, gameId]);
			}
		})();
	},

	getGamePlayers(gameId: string): DbGamePlayer[] {
		const query = `
			SELECT gp.*, p.name, p.color, p.avatar_config
			FROM game_players gp
			JOIN profiles p ON gp.profile_id = p.id
			WHERE gp.game_id = ?
			ORDER BY gp.turn_order ASC, gp.role DESC, gp.profile_id ASC
		`;
		return db.query(query).all(gameId) as DbGamePlayer[];
	},

	updatePlayerTurnOrder(gameId: string, profileId: string, turnOrder: number): void {
		db.run('UPDATE game_players SET turn_order = ? WHERE game_id = ? AND profile_id = ?', [
			turnOrder,
			gameId,
			profileId
		]);
	},

	setPlayerReady(gameId: string, profileId: string, isReady: boolean): void {
		db.run('UPDATE game_players SET is_ready = ? WHERE game_id = ? AND profile_id = ?', [
			isReady ? 1 : 0,
			gameId,
			profileId
		]);
	},

	updateGameStatus(gameId: string, status: 'waiting' | 'playing' | 'ended', activePlayerId: string | null): void {
		db.transaction(() => {
			db.run('UPDATE games SET status = ?, active_player_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
				status,
				activePlayerId,
				gameId
			]);
			if (activePlayerId && status !== 'ended') {
				db.run('UPDATE game_players SET is_archived = 0 WHERE game_id = ? AND profile_id = ?', [gameId, activePlayerId]);
			}
		})();
	},

	removePlayerFromGame(gameId: string, profileId: string): void {
		db.transaction(() => {
			const game = dbOps.getGame(gameId);
			if (game && game.status === 'playing') {
				// Mid-game leave, keep in DB
				return;
			}

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
	},

	deleteGame(gameId: string): void {
		db.run('DELETE FROM games WHERE id = ?', [gameId]);
	},

	saveInitialDeck(gameId: string, deck: Card[]): void {
		const deckStr = deckToString(deck);
		db.run('UPDATE games SET initial_deck = ? WHERE id = ?', [deckStr, gameId]);
	},

	saveMove(
		gameId: string,
		seq: number,
		playerId: string,
		type: 'S' | 'P' | 'U' | 'C' | 'R' | 'A' | 'L' | 'T',
		cards?: Card[]
	): void {
		const cardsStr = cards ? cardsToString(cards) : null;
		db.run(
			'INSERT INTO game_moves (game_id, seq, player_id, move_type, cards) VALUES (?, ?, ?, ?, ?)',
			[gameId, seq, playerId, type, cardsStr]
		);
	},

	getGameMoves(gameId: string): DbMove[] {
		const stmt = db.query('SELECT * FROM game_moves WHERE game_id = ? ORDER BY seq ASC');
		return stmt.all(gameId) as DbMove[];
	},

	getNextMoveSeq(gameId: string): number {
		const stmt = db.query('SELECT COUNT(*) as count FROM game_moves WHERE game_id = ?');
		const res = stmt.get(gameId) as { count: number } | null;
		return res ? res.count : 0;
	},

	resetGame(gameId: string, hostProfileId?: string, newDeck?: Card[]): void {
		db.transaction(() => {
			db.run('DELETE FROM game_moves WHERE game_id = ?', [gameId]);
			if (hostProfileId && newDeck) {
				const deckStr = deckToString(newDeck);
				db.run('UPDATE games SET initial_deck = ?, active_player_id = ?, status = "playing" WHERE id = ?', [
					deckStr,
					hostProfileId,
					gameId
				]);
				db.run(
					'INSERT INTO game_moves (game_id, seq, player_id, move_type) VALUES (?, 0, ?, ?)',
					[gameId, hostProfileId, 'S']
				);
			} else {
				db.run('UPDATE games SET initial_deck = NULL, active_player_id = NULL, status = "waiting" WHERE id = ?', [gameId]);
			}
		})();
	},

	recordGameResults(gameId: string, state: any): void {
		// Check if results already recorded for this game to avoid duplication
		const check = db.query('SELECT 1 FROM game_player_results WHERE game_id = ? LIMIT 1').get(gameId);
		if (check) return;

		db.transaction(() => {
			const loser = state.players.find((p: any) => p.isSkitgubbe);
			if (!loser) return; // Only record results if there is a designated loser (game naturally finished)

			for (const player of state.players) {
				if (player.inviteStatus !== 'accepted') continue;

				db.run(`
					INSERT INTO game_player_results (game_id, profile_id, is_skitgubbe, is_sweetgubbe, is_trumfman, is_constipated, is_mega_constipated)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`, [
					gameId,
					player.id,
					player.isSkitgubbe ? 1 : 0,
					player.isSweetgubbe ? 1 : 0,
					player.isTrumfman ? 1 : 0,
					player.isConstipated ? 1 : 0,
					player.isMegaConstipated ? 1 : 0
				]);
			}

			// Add to global skitgubbe coronation history
			db.run(`
				INSERT INTO skitgubbe_history (game_id, profile_id)
				VALUES (?, ?)
			`, [gameId, loser.id]);
		})();
	},

	getCurrentGlobalSkitgubbe() {
		const query = `
			SELECT sh.acquired_at, p.id, p.name, p.color, p.avatar_config
			FROM skitgubbe_history sh
			JOIN profiles p ON sh.profile_id = p.id
			ORDER BY sh.id DESC
			LIMIT 1
		`;
		return db.query(query).get() as {
			acquired_at: string;
			id: string;
			name: string;
			color: string;
			avatar_config: string | null;
		} | null;
	},

	getSkitgubbeHistory() {
		const query = `
			SELECT sh.id, sh.acquired_at, p.id as profile_id, p.name as profile_name, p.color as profile_color, p.avatar_config as profile_avatar, g.name as game_name
			FROM skitgubbe_history sh
			JOIN profiles p ON sh.profile_id = p.id
			LEFT JOIN games g ON sh.game_id = g.id
			ORDER BY sh.id DESC
		`;
		return db.query(query).all() as Array<{
			id: number;
			acquired_at: string;
			profile_id: string;
			profile_name: string;
			profile_color: string;
			profile_avatar: string | null;
			game_name: string | null;
		}>;
	},

	getAllPlayerStats() {
		const query = `
			SELECT
				p.id,
				p.name,
				p.color,
				p.avatar_config,
				COUNT(gpr.game_id) as games,
				SUM(CASE WHEN gpr.is_skitgubbe = 1 THEN 1 ELSE 0 END) as skitgubbe,
				SUM(CASE WHEN gpr.is_sweetgubbe = 1 THEN 1 ELSE 0 END) as sweetgubbe,
				SUM(CASE WHEN gpr.is_trumfman = 1 THEN 1 ELSE 0 END) as trumfman,
				SUM(CASE WHEN gpr.is_constipated = 1 THEN 1 ELSE 0 END) as constipated,
				SUM(CASE WHEN gpr.is_mega_constipated = 1 THEN 1 ELSE 0 END) as mega_constipated
			FROM profiles p
			LEFT JOIN game_player_results gpr ON p.id = gpr.profile_id
			GROUP BY p.id
			ORDER BY games DESC, p.name ASC
		`;
		return db.query(query).all() as Array<{
			id: string;
			name: string;
			color: string;
			avatar_config: string | null;
			games: number;
			skitgubbe: number;
			sweetgubbe: number;
			trumfman: number;
			constipated: number;
			mega_constipated: number;
		}>;
	},

	getPlayerStatsBreakdown(profileId: string) {
		const runQuery = (limit?: number) => {
			const limitClause = limit ? `LIMIT ${limit}` : '';
			const query = `
				SELECT
					COUNT(*) as games,
					SUM(is_skitgubbe) as skitgubbe,
					SUM(is_sweetgubbe) as sweetgubbe,
					SUM(is_trumfman) as trumfman,
					SUM(is_constipated) as constipated,
					SUM(is_mega_constipated) as mega_constipated
				FROM (
					SELECT * FROM game_player_results
					WHERE profile_id = ?
					ORDER BY finished_at DESC
					${limitClause}
				)
			`;
			const res = db.query(query).get(profileId) as any;
			return {
				games: res?.games || 0,
				skitgubbe: res?.skitgubbe || 0,
				sweetgubbe: res?.sweetgubbe || 0,
				trumfman: res?.trumfman || 0,
				constipated: res?.constipated || 0,
				mega_constipated: res?.mega_constipated || 0
			};
		};

		return {
			last10: runQuery(10),
			last50: runQuery(50),
			all: runQuery()
		};
	}
};

