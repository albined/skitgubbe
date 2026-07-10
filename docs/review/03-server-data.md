# 03 — Server Data Layer: db.ts, schema.ts, gameReplay.ts

## 🟠 P1

### 1. SQLite durability/concurrency pragmas missing
`db.ts:11` opens the DB with defaults: journal mode is likely `delete`, no
`busy_timeout`, `synchronous` default. For a long-running game server on a
Docker volume:

```sql
PRAGMA journal_mode = WAL;      -- readers don't block writer; fewer fsyncs
PRAGMA busy_timeout = 5000;     -- don't throw SQLITE_BUSY immediately
PRAGMA synchronous = NORMAL;    -- sane with WAL
```

Bun is single-threaded so contention is rare *today*, but any second
connection (backup script, litestream, sqlite3 CLI poking prod) will produce
`SQLITE_BUSY` throws in request handlers. One-time, two-line fix in
`initializeDatabase`.

### 2. `deleteProfile` breaks once a profile has played
`game_moves.player_id REFERENCES profiles(id)` (schema.ts:66) has **no ON
DELETE action** → RESTRICT semantics. `dbOps.deleteProfile` (db.ts:43) will
throw FK-constraint errors for any profile with recorded moves. Either no
route calls it today (dead code — then delete it) or the flow it serves is
broken. Same latent issue: `skitgubbe_history.profile_id` is CASCADE, so
deleting a profile silently rewrites the coronation history — probably not
intended either. Decide on soft-delete (profiles.deleted flag) instead;
event-sourced moves make hard deletes structurally hostile.

### 3. Missing indexes on the two hottest lookups
- `game_moves(game_id, seq)` has a UNIQUE constraint — that one's covered.
- `game_players(profile_id)` — `getGamesForProfile` joins/filters on it on
  every lobby load; only the (game_id, profile_id) PK exists, which does not
  serve a profile_id-first lookup. Add
  `CREATE INDEX idx_game_players_profile ON game_players(profile_id)`.
- `skitgubbe_history(game_id)` used by archived-games LEFT JOIN — small
  table, lower priority.

### 4. `getNextMoveSeq` read-then-insert has no transactional guard
`MAX(seq)+1` then `INSERT` as two statements (db.ts:330, 311). Safe only
because Bun is single-threaded *and* every caller does both synchronously
with no await between. That invariant is invisible and already threatened by
the orphaned-timer scenario (02 §4). Options: do it atomically
(`INSERT ... SELECT COALESCE(MAX(seq),-1)+1 ...`) or wrap
seq-compute+insert+status in one `db.transaction` inside a `commitMove()`
helper (same refactor as 01 §2).

## 🟡 P2

5. **`recordGameResults(gameId, state: any)`** — the one `any` in the DB API;
   type it `GameState` (it already reads `isSkitgubbe`, `inviteStatus`...).
6. **Results only recorded with a natural loser** (db.ts:363 `if (!loser)
   return`) — games ended by everyone-declining record nothing, yet
   `updateGameStatus` marks them ended; archived-list LEFT JOIN then shows
   them without a loser. Intentional? Add a comment either way.
7. **`getPlayerStatsBreakdown` interpolates `LIMIT ${limit}`** (db.ts:461) —
   values are internal constants (10/50) so not injectable *today*, but it's
   the only non-parameterized query in the file; someone will copy the
   pattern with user input. Parameterize (`LIMIT ?`).
8. **`logProfileAccess` trusts `x-forwarded-for` verbatim** (profiles.ts:67)
   — spoofable header stored and geolocated; fine for a family app, but know
   the "login history" is advisory, not forensic.
9. **Migration runner only supports add-column migrations** — the
   `table`/`column` shape can't express data transforms or index creation
   (notice finding 3 needs one). Generalize to `{id, name, up(db)}` with the
   column-exists check moving into the specific migrations that need it.
10. **`createGame` duplicates the Fisher-Yates + skitgubbe-last ordering**
    that also lives in `GameRoom.shuffleAndOrderPlayers` — two
    implementations of "seat players, skitgubbe last". Extract to one place
    (shared util) so a rules tweak can't fork them.
11. **`joinGame` turn_order = COUNT(*)** can collide with existing
    turn_order values after declines re-sequence — harmless because
    `getGamePlayers` orders by `(turn_order, role, profile_id)`, but it makes
    turn_order non-unique by design; document or make it MAX+1.

## 🔵 P3

- `chats` limit param is fine; `getGameChats` double-nested ORDER BY works
  but `ORDER BY id DESC LIMIT ?` + reverse in JS is clearer.
- `db-types.ts` mixes snake_case rows with camelCase domain types — fine,
  but `DbGamePlayer.name?/color?` being join-dependent optionals is easy to
  misuse; a separate `DbGamePlayerWithProfile` would be honest.
- `vapid_keys.json`/`jwt_secret.txt` written next to the DB and correctly
  gitignored ✅ — but note they live in `packages/server/` in dev (dbPath
  default is relative), so `bun dev` from repo root vs package dir writes
  them in different places. `DATABASE_PATH` absolute in `.env` avoids the
  ambiguity.

## ✅ Good

- Compact single-letter move encoding + `UNIQUE(game_id, seq)` — the schema
  enforces replay integrity at the storage layer. Excellent.
- Idempotent, transaction-wrapped `recordGameResults` with the
  results-already-recorded check — survives double game-end.
- The migration ledger (`migrations` table with applied-check +
  column-exists backfill) is a real migration system, unusual and welcome in
  a hobby project.
- `logProfileAccess` self-prunes to 5 rows per profile inside a transaction.
- FK cascades on games → players/moves/results keep game deletion clean.
