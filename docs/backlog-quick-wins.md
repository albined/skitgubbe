# Backlog — Quick Wins (delegatable)

Small, self-contained fixes. Each item carries enough context to hand to an
agent as-is. Line numbers are from the 2026-07 review (commit `4df7c66`) —
they may have drifted slightly; the file + symbol names are the anchor.

**Standing instructions for every item:** read
[architecture.md](architecture.md) first (especially the invariants). After
the change, run `bun test` (bare, from repo root — runs all 37 tests) and
`bun run check`. Add/adjust a test when the item says so.

## Do first (P0)

- [x] **QW-1: Remove WS handshake cookie logging.**
  `packages/server/src/index.ts:31-34` logs all upgrade headers including
  `Cookie` (the 30-day session JWT) on every WS handshake. It's marked
  "temporary diagnostic logging". Delete it. Done when: no header/cookie
  contents are logged on WS upgrade.

- [x] **QW-2: Make `bun run test` run every test.**
  Root `package.json`'s `test` script (`bun --filter server test`) runs only
  15 of 37 tests; the shared + web suites only run under a bare `bun test`.
  Point the root `test` script at bare `bun test` (simplest), or add
  `test` scripts to `packages/shared` and `packages/web` and compose them.
  Done when: `bun run test` reports 37 tests across 7 files.

## Server correctness & robustness

- [x] **QW-3: Reject WS upgrades for unknown rooms.**
  `packages/server/src/index.ts:36-43` — when `roomId` doesn't exist the
  handler returns `{}` but the socket still upgrades and stays open forever
  with no handlers. Return a 404 / refuse the upgrade instead.

- [x] **QW-4: Guard + assert the debug handlers.**
  `handleDebugSkipToPhase2` (`gameRoom.ts:878`) wipes all moves via
  `dbOps.resetGame` with no host check (the real reset-game requires host).
  Add a host check, and a startup warning if `PUBLIC_ALLOW_DEV_SETTINGS` is
  true in production. Also fix `handleDebugForceLose` (`gameRoom.ts:939-941`)
  fabricating cards with Swedish values `'Kn'/'D'` — internal values must be
  `'J'/'Q'` (see architecture.md invariant 4).

- [x] **QW-5: Add the missing replay-integrity assert in `applyChance`.**
  `gameLogic.ts:119` — the comment claims "we verify it is the top card of
  the deck" but nothing verifies; the `deck.pop()` result is discarded.
  Assert the passed card equals the popped card and throw/log loudly on
  mismatch (catches deck/codec drift during replay instead of silently
  corrupting).

- [x] **QW-6: Add a defensive guard to `progressPhase1Turn`'s rotation loop.**
  `gameLogic.ts:304-308` — `while (players[nextIdx].isDone)` has no
  "everyone is done" bail-out (`progressPhase2Turn` at 526-529 guards
  `remaining.length <= 1` first). Not reachable today (verified by probe
  test) but any future code marking a phase-1 player done would hang the
  single-threaded server. Add the same guard + a full-cycle bail-out.

- [x] **QW-7: Per-socket chat rate limit.**
  `handleChat` in `gameRoom.ts` persists + broadcasts arbitrarily fast;
  `game_chats` can grow unboundedly. Add a small per-socket token bucket
  (e.g. 5 msgs / 10s), drop + notify on excess.

- [x] **QW-8: Membership/validation checks on game routes.**
  `packages/server/src/routes/games.ts`: (a) `GET /api/games/:roomId`
  (line 83) returns full game + all players to any authenticated user —
  add a "requester is a game_player (or invitee)" check. (b) `create`
  (line 61) accepts arbitrary `invitedProfileIds` — validate they exist
  before inserting/sending push notifications.

## Database

- [x] **QW-9: SQLite pragmas.**
  In `initializeDatabase` (`packages/server/src/db.ts:11`) set
  `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;`. Prevents `SQLITE_BUSY` throws the moment a
  second connection (backup script, sqlite3 CLI) touches the DB.

- [x] **QW-10: Index on `game_players(profile_id)`.**
  `getGamesForProfile` filters on it every lobby load; only the
  `(game_id, profile_id)` PK exists, which doesn't serve profile-first
  lookups. Add `CREATE INDEX IF NOT EXISTS idx_game_players_profile ON
  game_players(profile_id)` (idempotent, can live in initializeDatabase
  next to table creation).

- [x] **QW-11: Parameterize the one interpolated query.**
  `getPlayerStatsBreakdown` (`db.ts:461`) does `LIMIT ${limit}`. Values are
  internal constants today, but it's the only non-parameterized query in the
  file and will get copied. Use `LIMIT ?`.

## Shared package

- [x] **QW-12: NaN guard in the card codec.**
  `intToCard` (`packages/shared/src/cardCodec.ts:20`) guards
  `n < 0 || n > 51` but NaN passes both, so a corrupted DB row crashes room
  construction deep in decode with a useless error. Add
  `Number.isInteger(n)` to the guard and throw naming the bad token. Add a
  test (`deckFromString('x,y')` should throw a clear error).

- [x] **QW-13: One generic `shuffle<T>`.**
  Three Fisher-Yates copies exist: `shuffle` in shared, an inline one in
  `gameRoom.ts` (`shuffleAndOrderPlayers`), one in `db.ts` (`createGame`).
  Make shared `shuffle` generic and use it everywhere. Note `createGame`
  and `shuffleAndOrderPlayers` both implement "seat players, skitgubbe
  last" — extract that ordering to one shared helper too.

- [x] **QW-14: Trim `isValidPlay`'s dead parameters.**
  `handCards`, `isTie`, `tiedIds`, `playerId` are never read. Reduce the
  signature to `isValidPlay(selected, table, phase, trumpSuit)` and update
  all call sites (server, client). Tests must stay green.

- [x] **QW-15: Shared mask sentinel.**
  The hidden-card mask is the magic string `'?'`, set in `gameRoom.ts` and
  string-checked in `roomState.ts:434`. Export `HIDDEN_CARD_VALUE` +
  `isMasked(card)` from `packages/shared` and use them on both sides.

- [x] **QW-16: Blast-radius comment on the codec constants.**
  Add a comment on `VALUES_ORDER`/`SUITS_ORDER`: "changing these arrays
  changes the on-disk card encoding and breaks all persisted games."

## Web client

- [x] **QW-17: Reconnect backoff.**
  `roomState.ts:523` — `onclose` reschedules `connectWebSocket()` every
  flat 3000ms forever (thundering herd on server restart). Add exponential
  backoff (3s → ~30s cap) with jitter, and stop reconnecting while the tab
  is hidden/unloading.

- [x] **QW-18: Track every timeout in RoomState.**
  The end-game animation is a 5-deep `setTimeout` tower
  (`roomState.ts:206-238`) with untracked handles (also line 797 and 845),
  so `destroy()` can't cancel them and they fire against torn-down state.
  Route all `setTimeout`s through a tracked-handle helper that `destroy()`
  clears.

- [x] **QW-19: Chat memory bounds.**
  `roomState.ts` — `chatMessages.push` (line 498) never trims, and
  `unreadChatCount`/`markChatsAsRead` do `Math.max(...map)` over the full
  array (line 901). Cap the array to the last N messages and track `maxId`
  incrementally.

- [x] **QW-20: Fix LobbyState.init's redundant/serial fetches.**
  `lobbyState.ts` `init()` (line 73) awaits 4 sequential fetches and calls
  `loadCurrentSkitgubbe` twice (once inside `checkAuth`, once directly).
  Remove the duplicate; `Promise.all` the independent ones.

- [x] **QW-21: Validate avatar colors on load.**
  Config colors (`bgColor`, `skinColor`, …) flow into inline `style` and CSS
  custom props verbatim (`Avatar.svelte:88,95`). Validate `#[0-9a-f]{3,6}`
  when parsing config; fall back to defaults otherwise. Also replace the
  `Math.random()` gradient-id namespace (`Avatar.svelte:83`) with a
  monotonic counter, and add a comment at each `{@html}` site: "must only
  render trusted AVATAR_FEATURES content — never user-supplied strings."

- [x] **QW-22: Prune per-room localStorage keys.**
  `skitgubbe_last_seq_${roomId}`, `skitgubbe_last_seen_chat_id_${roomId}`,
  `push_synced:*` accumulate forever. Prune keys for games no longer in the
  user's game list (e.g. on lobby load).

- [x] **QW-23: Sanitize the geolocation lookup.**
  `getIpLocation` (`packages/server/src/utils/ipAndDevice.ts:28`)
  interpolates the client-controlled `x-forwarded-for` value into the
  freeipapi URL unescaped. Validate it parses as an IP (reuse
  `isPrivateIp`'s parser) before fetching, and `encodeURIComponent` it.

## PWA / infra

- [ ] **QW-24: Same-origin check on push navigation.**
  `service-worker.ts:120,142` — `notificationclick` navigates to the push
  payload's `url`. Enforce `new URL(targetPath, origin).origin ===
  self.location.origin` before navigating/opening.

- [ ] **QW-25: Add `.dockerignore`.**
  There is none, so `node_modules`, `.git`, local `*.db`, and `.env` are
  sent to the build context (and `.env` can end up in image layers). Add
  one covering: `node_modules`, `.git`, `*.db*`, `.env*`, `.svelte-kit`,
  `build`, `docs`, `**/tests`.

- [ ] **QW-26: Lockfile hygiene.**
  Delete the stale `packages/server/bun.lock` and `packages/web/bun.lock`
  (only the root lock is authoritative in a Bun workspace), and add
  `--frozen-lockfile` to `bun install` in both Dockerfiles.

- [ ] **QW-27: nginx hardening + WS timeout.**
  `nginx.conf`: (a) set `proxy_read_timeout`/`proxy_send_timeout` high
  (e.g. 3600s) on the `/api` location — the default 60s kills quiet game
  sockets and triggers the client reconnect loop; (b) add
  `client_max_body_size` (e.g. 1m) and headers `X-Content-Type-Options:
  nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`.

- [ ] **QW-28: docker-compose healthchecks + memory limits.**
  Add a `healthcheck` to server/web/gateway (so `depends_on` waits for
  readiness, not just start) and `mem_limit` per service. Add log rotation
  for nginx (or route to stdout with docker's json-file rotation opts).

- [ ] **QW-29: Self-host the two CDN dependencies.**
  `app.html` loads Google Fonts and a render-blocking
  `unpkg.com/@dotlottie/player-component` `<script>`. On a LAN-only deploy
  with no/flaky internet these break the app. Replace fonts with
  `@fontsource/*` packages and install the lottie player as an npm dep
  imported in the app. Done when: no request leaves the origin on cold load.

- [ ] **QW-30: Keep the 3.7MB PNG off the critical path.**
  `static/notice_board_hq.png` is 3.7MB; a 100KB `notice_board.webp`
  exists. Verify nothing references the HQ PNG at runtime; if it's only a
  design source, move it out of `static/` (or document it). Check
  `bg-large.*` (~400KB each) are lazy/responsive too.

- [ ] **QW-31: Minimal CI.**
  No `.github/workflows`. Add one workflow running `bun install
  --frozen-lockfile`, `bun run check`, bare `bun test`, and
  `prettier --check` on push/PR. (Depends on QW-2 if you wire it to the
  npm script.)

## Nice-to-have (P3 — batch these opportunistically)

- [ ] **QW-32:** Update stale `app.html` meta ("proof-of-concept…" copy) and
  align manifest/app.html description language.
- [ ] **QW-33:** `handleResetGame` rebuilds initial state inline duplicating
  the constructor — extract `makeInitialState()`; make `state.seq` a
  required field set consistently.
- [ ] **QW-34:** Fold `checkDropValidity` into `isPlayableGroup`
  (`roomState.ts:715,757` — near duplicates), and extract the duplicated
  push-sync block in `selectProfile`/`initNotifications` into
  `syncPushSubscription()`.
- [ ] **QW-35:** `cardIn` detects chance-plays by substring-matching log text
  (`log.includes('chanced')`, `roomState.ts:1112` — the log is actually
  written as "chansade", so it may never match). Drive it off structured
  state (e.g. a `lastMoveType` field) instead.
- [ ] **QW-36:** Language rule for logs: user-visible strings Swedish,
  diagnostics English; fix the mixed cases (incl. "Alle andra spelare" typo).
- [ ] **QW-37:** Document that `JWT_SECRET` must be set for multi-instance /
  reproducible sessions; verify `NODE_ENV=production` actually reaches the
  server container (secure-cookie flag depends on it).
- [ ] **QW-38:** SW cleanups: open `caches` once instead of per-fetch;
  type SW events instead of `any`; consider a `pushsubscriptionchange`
  handler for rotated push endpoints.
