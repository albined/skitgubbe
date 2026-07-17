import { Database } from 'bun:sqlite';

export function initializeDatabase(db: Database) {
	// Enable foreign keys
	db.run('PRAGMA foreign_keys = ON;');
	db.run('PRAGMA journal_mode = WAL;');
	db.run('PRAGMA busy_timeout = 5000;');
	db.run('PRAGMA synchronous = NORMAL;');

	// Create tables if they do not exist (including migrations table)
	db.transaction(() => {
		// 1. Migrations tracking table
		db.run(`
			CREATE TABLE IF NOT EXISTS migrations (
				id INTEGER PRIMARY KEY,
				name TEXT NOT NULL,
				applied_at TEXT DEFAULT CURRENT_TIMESTAMP
			);
		`);

		// 2. Profiles table
		db.run(`
			CREATE TABLE IF NOT EXISTS profiles (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				color TEXT NOT NULL,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				avatar_config TEXT,
				avatar_image TEXT -- unused legacy column (abandoned snapshot feature); kept to avoid a drop migration
			);
		`);

		// 3. Games table
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

		// 4. Game Players table
		db.run(`
			CREATE TABLE IF NOT EXISTS game_players (
				game_id TEXT NOT NULL,
				profile_id TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'player',
				is_ready INTEGER DEFAULT 0,
				invite_status TEXT NOT NULL DEFAULT 'pending',
				turn_order INTEGER DEFAULT 0,
				is_archived INTEGER DEFAULT 0,
				PRIMARY KEY (game_id, profile_id),
				FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
				FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_game_players_profile ON game_players(profile_id);');

		// 5. Game Moves table
		db.run(`
			CREATE TABLE IF NOT EXISTS game_moves (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
				seq INTEGER NOT NULL,
				player_id TEXT NOT NULL REFERENCES profiles(id),
				move_type TEXT NOT NULL,
				cards TEXT,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				UNIQUE (game_id, seq)
			);
		`);

		// 6. Game Player Results table
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

		// 7. Skitgubbe History table
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

		// 8. Profile Access Logs table
		db.run(`
			CREATE TABLE IF NOT EXISTS profile_access_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				profile_id TEXT NOT NULL,
				device_info TEXT,
				ip_address TEXT,
				location TEXT,
				accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
			);
		`);

		// 9. Push Subscriptions table
		db.run(`
			CREATE TABLE IF NOT EXISTS push_subscriptions (
				profile_id TEXT NOT NULL,
				endpoint TEXT NOT NULL,
				p256dh TEXT NOT NULL,
				auth TEXT NOT NULL,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (profile_id, endpoint),
				FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
			);
		`);

		// 10. Game Chats table
		db.run(`
			CREATE TABLE IF NOT EXISTS game_chats (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
				player_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
				message TEXT,
				emote TEXT,
				seq INTEGER NOT NULL,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_game_chats_game_id ON game_chats (game_id);');
	})();

	// 10. Run migrations inside a transaction
	runMigrations(db);
}

interface Migration {
	id: number;
	name: string;
	// For column migrations: used to skip if the column already exists (legacy
	// runs predating the ledger). Data migrations omit both and run once by id.
	table?: string;
	column?: string;
	query: string;
}

const migrations: Migration[] = [
	{
		id: 1,
		name: 'add_initial_deck_to_games',
		table: 'games',
		column: 'initial_deck',
		query: 'ALTER TABLE games ADD COLUMN initial_deck TEXT;'
	},
	{
		id: 2,
		name: 'add_avatar_config_to_profiles',
		table: 'profiles',
		column: 'avatar_config',
		query: 'ALTER TABLE profiles ADD COLUMN avatar_config TEXT;'
	},
	{
		id: 3,
		name: 'add_avatar_image_to_profiles',
		table: 'profiles',
		column: 'avatar_image',
		query: 'ALTER TABLE profiles ADD COLUMN avatar_image TEXT;'
	},
	{
		id: 4,
		name: 'add_is_archived_to_game_players',
		table: 'game_players',
		column: 'is_archived',
		query: 'ALTER TABLE game_players ADD COLUMN is_archived INTEGER DEFAULT 0;'
	},
	{
		id: 5,
		name: 'add_location_to_profile_access_logs',
		table: 'profile_access_logs',
		column: 'location',
		query: 'ALTER TABLE profile_access_logs ADD COLUMN location TEXT;'
	},
	{
		// Ended games now stay in the lobby until each player has viewed the
		// result (which archives them). Grandfather games that ended before
		// this feature so they don't flood back into everyone's lobby.
		id: 6,
		name: 'archive_preexisting_ended_games',
		query: `UPDATE game_players SET is_archived = 1 WHERE game_id IN (SELECT id FROM games WHERE status = 'ended');`
	}
];

function runMigrations(db: Database) {
	db.transaction(() => {
		for (const migration of migrations) {
			// Check if the migration has been logged
			const applied = db.query('SELECT 1 FROM migrations WHERE id = ?').get(migration.id);
			if (applied) {
				continue;
			}

			// Not logged. For column migrations, check if the column already exists.
			// This is for backward compatibility where columns were added in previous runs.
			if (migration.table && migration.column) {
				const tableInfo = db.query(`PRAGMA table_info(${migration.table})`).all() as {
					name: string;
				}[];
				const columnExists = tableInfo.some((col) => col.name === migration.column);

				if (columnExists) {
					// Column is already present, just log the migration as applied
					db.run('INSERT INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
					continue;
				}
			}

			// Column is missing, execute the migration
			console.log(`Running migration ${migration.id}: ${migration.name}`);
			db.run(migration.query);
			db.run('INSERT INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
		}
	})();
}
