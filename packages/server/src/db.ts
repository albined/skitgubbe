import { Database } from "bun:sqlite";

// Create or open the SQLite database
export const db = new Database("db.sqlite", { create: true });

// Create the profile_logins table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS profile_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    time INTEGER NOT NULL,
    user_agent TEXT,
    location TEXT,
    ip TEXT
  )
`);

// Create a trigger to automatically rotate logs, keeping only the 5 most recent logins per profile
db.run(`
  CREATE TRIGGER IF NOT EXISTS keep_latest_logins
  AFTER INSERT ON profile_logins
  BEGIN
      DELETE FROM profile_logins
      WHERE profile_id = NEW.profile_id
      AND id NOT IN (
          SELECT id FROM profile_logins
          WHERE profile_id = NEW.profile_id
          ORDER BY time DESC
          LIMIT 5
      );
  END;
`);
