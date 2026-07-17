# Code Review — Performance & Maintainability

Review date: 2026-07-17 · Branch: `project-refactor-and-bug-fixes`
Scope: performance first, then code quality/maintainability, then the test suite.
Verified against a full run: `bun test` (112 pass / 0 fail, ~4 s) and `bun run check` (0 errors, 0 warnings).

This review respects the deferrals in `docs/architecture.md` ("Deliberately dropped"):
`structuredClone`-per-viewer masking, `captureCardRects` reflow batching, migration-runner
generalization, and SQLite backup are **not** re-litigated here — they're only referenced
where new context changes the picture. Everything below is either new or newly verified.

---

## Verdict in one paragraph

The codebase is in genuinely good shape: event-sourced games, one shared rules package, WAL +
sane pragmas, per-viewer broadcast caching, and a test suite with real regression pins. The
findings below are mostly moderate. One is an actual production bug (the chat rate limiter is
a no-op, masked by its own test), one is a slow memory leak (rooms created via the decline
route are never evicted), and the rest are quick wins and scaling notes.

---

## Implementation Checklist

### Quick Wins
- [x] **QW-1**: Chat rate limiter never limits in production (Bug)
- [x] **QW-2**: Declined rooms leak in the room map
- [x] **QW-3**: Dead avatar-snapshot generation on every save
- [x] **QW-4**: Per-instance constants in CardFace
- [ ] **QW-5**: Duplicate SVG element IDs across component instances
- [x] **QW-6**: Room join does two sequential fetches
- [x] **QW-7**: O(n) array scans per fetch in the service worker
- [x] **QW-8**: WS upgrade queries the game row twice
- [x] **QW-9**: Random IDs surface collisions as opaque errors
- [x] **QW-10**: `logProfileAccess` prunes with SELECT-all + IN-delete

### Packages / Server
- [ ] **Server - Performance**: Reduce per-move DB chatter by tracking `lastKnownStatus`/`lastActivePlayerId` in memory
- [ ] **Server - Performance**: Ring buffer of last ~10 post-move states to optimize reconnect replay
- [ ] **Server - Performance**: Map raw socket to playerId in `socketProfiles` for O(1) owner checks
- [ ] **Server - Performance**: Memoize masked card arrays and skip cloning deck/discard pile
- [ ] **Server - Quality**: Extract shared `resetToFreshGame` helper for starting/debugging games
- [ ] **Server - Quality**: Share can-play predicate guards between `gameRoom` and `gameLogic`
- [ ] **Server - Quality**: Split phase-1/phase-2 decline logic in `applyDecline`
- [ ] **Server - Quality**: Shared query VIEW/fragment for `getGamesForProfile` and `getArchivedGamesForProfile`
- [ ] **Server - Quality**: Batch archive/unarchive updates using SQL `IN` operator
- [ ] **Server - Database**: Add missing index for `game_player_results(profile_id)`
- [ ] **Server - Database**: Add missing index for `skitgubbe_history(game_id)`
- [ ] **Server - Database**: Add missing index for `profile_access_logs(profile_id)`

### Packages / Shared
- [ ] **Shared**: Optimize `getValueNumeric` / `sortHand` using a module-level Map for order lookups
- [ ] **Shared**: Pin phase-2 run validation semantics with a test case

### Packages / Web
- [x] **Web - Performance**: Convert Svelte avatar gesture event handler to in-place mutation (avoid map recreation)
- [x] **Web - Performance**: Limit `FeatureHistory` stack size (e.g. 100 entries) and strip static `svgContent`/`name` fields
- [x] **Web - Performance**: Defer `/api/games/archived` in `pruneLocalStorageKeys` behind idle callback
- [x] **Web - Performance**: Optimize global font weight loads (filter unused Outfit/Inter weights)
- [x] **Web - Performance**: Track `setTimeout` in `saveLastSeq` or write synchronously
- [ ] **Web - Performance**: Profile backdrop filter / GPU animation cost for active room cards
- [x] **Web - Quality**: Fix test mock interface to provide `text()` and remove check in production code
- [ ] **Web - Quality**: Split `RoomState` concerns into separate classes/files
- [x] **Web - Quality**: Export `CATEGORY_ORDER` from `avatarFeatures.svelte.ts`
- [ ] **Web - Quality**: Share CSS color classes for avatar colors instead of duplicate `<style>` blocks
- [ ] **Web - Quality**: Remove port 3000 local websocket fallback from `getWsUrl`
- [ ] **Web - Quality**: Extract custom scrollbar implementation into `CustomScrollbar.svelte`

### Test Suite Gaps
- [x] **Test Gap 1**: Chat rate-limit test wrapper identity modeling
- [ ] **Test Gap 2**: Add unit/state tests for `RoomState`
- [ ] **Test Gap 3**: Add state machine tests for `CardDragState`
- [x] **Test Gap 4**: Add test for room eviction after REST decline
- [ ] **Test Gap 5**: Add phase-2 run validation pin
- [ ] **Test Gap 6**: Cleanup test console logging / stub console errors

---

## Quick wins

Ordered roughly by value-for-effort.

### QW-1 · Chat rate limiter never limits in production (bug) — `packages/server/src/gameRoom.ts:52,499`

`chatLimiters` is a `WeakMap<GameSocket, …>` keyed on the **WSContext wrapper**. Hono's Bun
adapter constructs a *fresh* `WSContext` for every event — verified in
`hono/dist/adapter/bun/websocket.js`, where `message(ws, …)` calls `createWSContext(ws)` per
message. So `chatLimiters.get(ws)` never finds an existing bucket: every chat message starts
with a full 5-token bucket, and the limiter (kept "for DB-growth reasons" per
architecture.md) does nothing. The file's own header comment states the rule that was broken:
*"`raw` is the underlying Bun socket — stable per connection … it is what identity maps must
key on."* `socketProfiles` follows the rule; `chatLimiters` doesn't.

**Fix:** key on `ws.raw` — `WeakMap<ServerWebSocket, { tokens, lastRefill }>`.

**Why the existing test passes anyway:** `serverValidations.test.ts:111` sends every message
through the *same* mock object, so the WeakMap lookup succeeds in the test but never in
production. When fixing, make the fake socket mint a fresh wrapper per `handleMessage` call
around a shared `raw` (mirroring the adapter), so the test actually exercises the production
identity model:

```ts
const raw = {};
const wrapper = () => ({ raw, send: (m: string) => sent.push(JSON.parse(m)), close() {} });
// use wrapper() per handleMessage call instead of one shared object
```

### QW-2 · Declined rooms leak in the room map — `packages/server/src/routes/games.ts:143`, `packages/server/src/rooms.ts`

The decline route calls `rooms.getOrCreate(roomId)` (full replay if not loaded) and never
evicts. Eviction is only scheduled in the WS `onClose` handler (`index.ts:96`), which never
fires for a room that has no sockets. Every invitation declined while nobody is connected
permanently parks a `GameRoom` (full `GameState`, players, logs) in the `Map`. Small per
room, unbounded over months of play.

**Fix:** after `room.handleDecline(...)`, if `room.clients.size === 0`, schedule the same
30 s cleanup used in `onClose` (or evict directly once any pending trick-cleanup timer has
been committed — `scheduleCleanup` already coexists with the trick timer, so reusing it is
the safer option).

### QW-3 · Dead avatar-snapshot generation on every save — `packages/web/src/routes/avatar/+page.svelte:579-612`

`handleSave` clones the entire canvas SVG, injects a style block, strips attributes,
serializes with `XMLSerializer`, and base64-encodes it — into `base64Image`, which is **never
used**. The matching `profiles.avatar_image` column (schema.ts:29, migration 3) is never
written or read anywhere. This is a leftover from an abandoned snapshot feature: ~30 lines of
work per save plus a phantom column and API field (`shared/src/api.ts:12`).

**Fix:** delete the snapshot block, drop `avatar_image` from `ApiProfile`; leave the column
with a one-line comment (dropping SQLite columns isn't worth a migration).

### QW-4 · Per-instance constants in CardFace — `packages/web/src/lib/components/CardFace.svelte:48,127`

`PIP_LAYOUTS` (a ~70-line object) and `courtNames` are declared in the instance script, so
they're re-allocated for **every card face mounted** — and the room mounts/unmounts dozens
per trick (hand + table + flips). Move both to `<script module>` (same pattern
`Avatar.svelte` already uses for its module-level helpers).

### QW-5 · Duplicate SVG element IDs across component instances

- `CardFace.svelte:143` — every card defines `<clipPath id="courtClip">`.
- `Avatar.svelte:124-178` and `avatar/+page.svelte:992-1055` — every avatar defines the same
  11 filter IDs (`blur-shadow`, `eye-shadow`, …) and 7 clipPath IDs.

With 10+ cards and up to 10 avatars on screen, the document contains many duplicates of each
ID. It renders correctly today only because all definitions are identical and browsers
resolve `url(#…)` to the first match — but it's invalid HTML, and unmounting the instance
that "owns" the first match (cards unmount constantly during tricks) makes the reference
resolution order browser-dependent. Gradients already solved this exact problem with
`namespaceSvgGradients` (`_grad_` → `_grad_<ns>_`); extend the same namespacing to filters
and clip paths, or hoist one shared `<svg><defs>` into the layout and delete the per-instance
copies (smaller DOM, too).

### QW-6 · Room join does two sequential fetches — `packages/web/src/lib/state/roomState.svelte.ts:325-346`

`init()` awaits `/api/skitgubbe/current`, then `/api/profiles/me`, then opens the WebSocket.
The two fetches are independent — `Promise.all` them (or fire the skitgubbe fetch without
awaiting) and the room connects one RTT sooner. This is the app's most-trafficked entry path.

### QW-7 · O(n) array scans per fetch in the service worker — `packages/web/src/service-worker.ts:76,89`

`build.includes(url.pathname)` and `ASSETS.includes(url.pathname)` run on **every GET** the
page makes. Build once: `const BUILD_SET = new Set(build); const ASSET_SET = new Set(ASSETS)`.
Micro, but it's two lines and the fetch handler is the hottest client-side path.

### QW-8 · WS upgrade queries the game row twice — `packages/server/src/index.ts:41,54`

The pre-upgrade middleware does `dbOps.getGame(roomId)` and the `upgradeWebSocket` factory
repeats it. One is enough — validate in the middleware and let the factory trust it (or drop
the middleware since the factory re-checks anyway).

### QW-9 · Random IDs surface collisions as opaque errors — `packages/server/src/routes/games.ts:57`, `routes/profiles.ts:18`

Room IDs are 6 chars of `Math.random` base36 (~2.2 B space) and profile IDs 8 chars. A
collision hits the PK, throws, and returns a generic 400/500 the user can't act on. Wrap
creation in a small retry loop (2–3 attempts) — cheap insurance that turns an eventual
confusing failure into a non-event. (Not a security issue under the LAN honor model.)

### QW-10 · `logProfileAccess` prunes with SELECT-all + IN-delete — `packages/server/src/db.ts:69-86`

Two statements and a round-trip through JS where one SQL statement does it:

```sql
DELETE FROM profile_access_logs
WHERE profile_id = ?
  AND id NOT IN (SELECT id FROM profile_access_logs
                 WHERE profile_id = ? ORDER BY accessed_at DESC LIMIT 5);
```

---

## packages/server

### Performance

- **Per-move DB chatter — `gameRoom.ts:119-142` (`commitMove`) + `syncGameStatusToDb`.**
  Each move runs ~5 queries: `MAX(seq)` (`getNextMoveSeq`), the `saveMove` insert, a
  `getGame` read (only to learn `wasEnded`/`prevActivePlayerId`), the `updateGameStatus`
  transaction, and sometimes an unarchive `UPDATE`. All local SQLite in WAL, so this is fine
  at family scale — but the `getGame` read per move is pure bookkeeping the room could keep
  in memory (`lastKnownStatus`, `lastActivePlayerId` fields, reset on construction/reset).
  That would halve the per-move query count without touching the commit ritual
  (architecture.md invariant 6). Low priority; do it only if move latency ever shows up.

- **Reconnect replay is O(total moves) per reconnecting client — `gameRoom.ts:416-452`
  (`getSanitizedStatesRange`).** The output is capped at ≤10 states, but producing them
  re-reads the *entire* move log and re-folds the game from move 0. A long game (several
  hundred moves) with a flaky mobile client replays the whole log on every reconnect.
  Cheapest structural fix if this ever matters: keep a ring buffer of the last ~10
  post-move state snapshots in the room (they're produced anyway inside `commitMove`) and
  sanitize from the buffer; full replay then remains only for crash recovery.
  At current scale this is a *scaling note*, not a problem.

- **`socketOwner` scans `playerSockets` per message and per broadcast recipient —
  `gameRoom.ts:319-328`.** O(players) with ≤10 players ≈ free, but the class already
  maintains `socketProfiles: Map<ServerWebSocket, string>` for the same physical-socket
  identity problem; a parallel `Map<ServerWebSocket, playerId>` would make ownership O(1)
  and delete the loop. Do it if/when QW-1 is fixed — it's the same "key on raw" refactor.

- **Masking allocates fresh objects for every hidden card per viewer —
  `gameRoom.ts:359-414`.** The `structuredClone` question was deliberately deferred, but
  note for whenever it's revisited: masked card IDs are deterministic
  (`hidden-deck-${idx}`, `hidden-hand-${playerId}-${idx}`), so the masked arrays can be
  memoized by (owner, length) instead of rebuilt per broadcast — and cloning the deck and
  discard pile at all is wasted work since both are fully replaced right after the clone.
  Building the sanitized object field-by-field (cloning only hands/reserves that survive)
  would cut most of the clone cost without touching invariant 2's single-funnel property.

### Code quality / maintainability

- **Three hand-rolled "start a game" writers.** `applyStartGame` (gameLogic),
  `handleResetGame` (gameRoom.ts:797) and `handleDebugSkipToPhase2` (gameRoom.ts:834) each
  assemble fresh-game state with slightly different steps (the debug one writes ~15 state
  fields by hand). The debug path is dev-only, but it's also the most likely to silently rot
  when `GameState` grows a field (it already needs the manual `setActivePlayerIdx` +
  `syncGameStatusToDb` + `saveInitialDeck` choreography). Extracting a shared
  `resetToFreshGame(state, deck, opts)` would leave one writer to keep correct.

- **Guard duplication between `gameRoom.handle*` and `gameLogic.apply*`.**
  `handlePlayCards`/`handlePickUp`/`handleChance` re-implement the same status/turn/trick
  guards that the `apply*` functions check again (deliberately, for wire error messages vs.
  replay-tolerant no-ops). The duplication is understandable but drift-prone — a guard
  changed in one layer and not the other fails silently (the apply just no-ops and a
  seq-numbered move gets burned on a no-op). Consider shared predicate helpers
  (`canPlayCards(state, playerId): { ok } | { ok: false, reason }`) consumed by both layers,
  keeping messages at the boundary and semantics in one place.

- **`applyDecline` has grown into the hardest function in gameLogic.ts** (lines 261-329:
  roster-vs-left branching, tie-breaker surgery, trick-completion-by-departure, three
  different turn-advance paths). It's well-commented and extensively pin-tested (P-5/P-6
  suites), which is what makes it maintainable *today* — just don't let more cases in
  without splitting phase-1/phase-2 departure handling.

- `getGamesForProfile`/`getArchivedGamesForProfile` (db.ts:171-205) duplicate the same
  9-column SELECT head; a shared fragment or view would keep the two lists from drifting
  (they already differ only by archive flag + loser join).

- `archiveGames`/`unarchiveGames` loop one UPDATE per game id inside the transaction
  (db.ts:207-227) — a single `UPDATE … WHERE game_id IN (…)` is simpler and fewer
  statements. Trivial.

### Missing indexes (note only — tables are tiny at this scale)

- `game_player_results(profile_id)` — `getPlayerStatsBreakdown` filters by it and sorts by
  `finished_at`.
- `skitgubbe_history(game_id)` — joined in `getArchivedGamesForProfile`.
- `profile_access_logs(profile_id)` — filtered on every `/me/logs`.
Everything else already rides a PK or the `UNIQUE(game_id, seq)` index. Add these if any
list ever feels slow; don't bother preemptively.

---

## packages/shared

Small and clean; the codec round-trip test and single-source rules are exactly right.

- **`getValueNumeric` does `VALUES_ORDER.indexOf` per call — `rules.ts:4-12`.** It's called
  inside sort comparators (`sortHand` runs on every draw/play/pickup) and inside
  `isValidPlay`/`getLegalPlays` loops, so it executes O(n log n × 13) scans per sort. A
  module-level `Map`/record built once from `VALUES_ORDER` keeps the codec-order invariant
  in one place and makes it O(1). Same for the two `SUITS_ORDER.indexOf` calls in the
  `sortHand` comparator. Micro in absolute terms; free to do.

- **Un-pinned rule semantics: a phase-2 run is validated by its *lowest* card**
  (`rules.ts:109` uses `sorted[0]` against the top card). That means 5-6 on a 4 is legal but
  5-6 on a 5 is not — presumably intended (the whole run must beat the top), but no test
  asserts it. One pin test in `rules.test.ts` would protect this from a well-meaning
  "obviously the top card of the run is what counts" refactor.

---

## packages/web

### Performance

- **Avatar editor: whole-array replacement per pointer event —
  `avatarGestureController.svelte.ts:461-506` (also 279-289, 567-633).** Every
  `pointermove` during a drag or pinch does
  `this.placedFeatures = this.placedFeatures.map(f => f.id === sel ? { ...f, x, y } : f)`.
  Replacing the `$state` array invalidates the array signal, so per frame Svelte re-runs the
  `sortedFeatures` derived (spread + sort in `avatar/+page.svelte:446`), re-diffs the keyed
  each block, and re-evaluates the `{@html namespaceSvgGradients(...)}` expression for the
  moved feature (the `replaceAll` re-runs; only the innerHTML write is skipped by equality).
  Svelte 5 `$state` is deeply reactive precisely so you can write
  `feature.x = …; feature.y = …` and have *only* the `transform` attribute effect re-run.
  Converting the move/pinch/wheel handlers to in-place mutation is the single biggest
  perf lever in the editor and *simplifies* the code. (Keep the immutable style for
  structural ops — add/remove/replace — where the array really changes.)

- **`FeatureHistory` is O(state size) per interaction and unbounded —
  `featureHistory.svelte.ts:34-47`.** Every push does two `JSON.parse(JSON.stringify(...))`
  clones plus a full `JSON.stringify` equality check, and history grows without cap for the
  whole editing session (every wheel-tick burst and pointer-up appends a full snapshot of
  all features incl. their `svgContent` strings — which don't belong in the snapshot at all,
  see next item). Cap the stack (e.g. 100 entries) and snapshot only the stored shape
  (`StoredAvatarFeature` without `svgContent`/`name`, which are template-derived) — that
  makes snapshots ~50× smaller and the dedup check proportionally cheaper.

- **Lobby polling is well-behaved** (5 s interval, paused on hidden, response-text
  dedup before reassigning `$state` — nice touch at `lobbyState.svelte.ts:394-418`). Two
  small notes: `pruneLocalStorageKeys` fires an extra `/api/games/archived` fetch on every
  lobby init/profile-select purely for localStorage housekeeping (defer it behind the idle
  callback it already uses for the prune itself); and the `catch`-swallowed fetch means a
  down server polls silently forever — fine for LAN.

- **Fonts: 11 weight files imported globally — `+layout.svelte:3-12`.** Inter 300/400/500/600
  + Outfit 300–700 + Nanum ship as separate woff2 files on first load. A quick grep of
  actual `font-weight` usage would likely cut 3–4 files. One-time cost (SW caches them), so
  low priority — but it's the biggest lever on cold first paint.

- `saveLastSeq` (roomState.svelte.ts:839-847) spawns an untracked `setTimeout` per state
  update — harmless (a localStorage write after destroy), but inconsistent with the class's
  own `trackTimeout` discipline. Use `trackTimeout` or write synchronously (a single
  `localStorage.setItem` is microseconds; the deferral buys nothing).

- Room-card styling uses `backdrop-filter: blur(12px)` per card plus an infinite pulse
  animation on my-turn cards (`+page.svelte` lobby styles) — noticeable GPU cost on low-end
  phones when the list is long. Fine for the target hardware; know it's there if the room
  list view ever feels janky.

### Code quality / maintainability

- **Test-mock accommodation in production code — `lobbyState.svelte.ts:400-406`.**
  `typeof res.text === 'function'` exists because some test mocks return `{ ok, json }`
  without `text()`. Production code shouldn't branch on the shape of test doubles — give the
  mocks a `text()` (one line in the test helpers) and delete the fallback.

- **`RoomState` (848 lines) is the next candidate for the split that worked for
  `CardDragState`.** It currently owns five separable concerns: WS transport + reconnect
  backoff, the replay queue, chat/bubbles/catch-up, the end-game animation timeline (a
  five-deep `trackTimeout` pyramid at lines 203-251 that would read far better as a
  data-driven `[{ stage, delay }]` sequence), and selection/fan UI state. No correctness
  issue — purely a "which file do I open" cost that grows with every feature.

- **Duplicate `CATEGORY_ORDER`** in `Avatar.svelte:39` and `avatar/+page.svelte:433` —
  rendering order is a domain fact; export it from `avatarFeatures.svelte.ts` next to the
  categories themselves.

- **Duplicate inline `<style>` blocks for avatar color classes** — the same 8-class CSS
  (`.skin-color`, `.hair-color`, …) is repeated 4× (Avatar.svelte, canvas, library grid
  items, drag preview in avatar/+page.svelte). One `:global` block in the page (or a shared
  snippet) removes three copies; the library grid re-instantiates its copy per item.

- `getWsUrl` (roomState.svelte.ts:366-372) special-cases `localhost` → port 3000, but
  `vite.config.ts` already proxies `/api` with `ws: true` — the special case looks like a
  leftover from before the proxy existed. Verify and remove; one less prod/dev divergence.

- The avatar editor page (1477 lines) contains a fully self-contained custom scrollbar
  implementation (~110 lines, state + 3 handlers + resize observer). Extracting
  `CustomScrollbar.svelte` would shed a quarter of the file with zero behavior risk.

---

## Test suite

**State: strong.** 112 tests / ~4 s, in-memory SQLite, meaningful regression pins with
issue-numbered describe blocks (P-2/P-5/P-6), a full 52-card codec round-trip, WS identity
tests that assert the *security* property (never seeing another hand), and lifecycle tests
that verify timers don't outlive disposed rooms. `bun run check` is clean.

**Added by this review** (all passing): `packages/server/tests/sprinkle.test.ts` — 9 tests
covering `applySprinkle`, which previously had **zero** coverage anywhere despite subtle
semantics: out-of-turn legality, appending to own batch only (not another player's batch of
equal value), hand refill from deck, turn preservation, `lastChanceCardId` clearing, and
rejection paths (mixed values, no matching batch, pending trick, phase 2, bogus ids).

**Gaps worth closing, in priority order:**

1. **The chat rate-limit test must model per-message wrapper identity** (see QW-1) — it's
   currently green while the feature is broken in production. This is the highest-value
   test change in the repo: it converts a masked bug into a caught one.
2. **`RoomState` has no tests** despite being the largest client state class. Its pure parts
   don't need a DOM: `toggleSelect`/`isPlayableGroup` selection rules, `checkDropValidity`
   (play vs sprinkle vs null), `unreadChatCount`, replay-queue dedup by seq
   (`onmessage` stateUpdate-during-replay branch), and `handleCardClick` fan-window math.
   The lobbyState tests already prove the pattern (fetch/localStorage stubs) works in bun.
3. **`CardDragState` has no tests** — architecture.md calls it "the model" state machine;
   pin the model: drag threshold (8 px), run detection vs `lastReleasedRunCardIds`,
   double-click-to-play fallback ordering.
4. **Room eviction after REST-only interaction** — a test asserting that a decline on a
   room with zero WS clients doesn't leave it in `rooms` forever (catches QW-2 and guards
   the fix).
5. **Phase-2 run validation pin** — assert 5-6 on a 5 is illegal / on a 4 legal
   (see shared section), so the `sorted[0]` semantics are protected.
6. **Test output hygiene** — `lobbyState.test.ts` logs `RUNNING TEST: …` per test and the
   error-path tests intentionally print stack traces; 60+ lines of noise per run makes real
   failures harder to spot. Drop the `console.log`s and stub `console.error` in the
   error-path tests (assert it was called, if the call matters).

---

## Previously deferred items — status unchanged, with pointers

For completeness, these architecture.md deferrals were re-examined and remain correctly
deferred at current scale; the new context above is linked where it changes the eventual fix:

| Item | Status | New context |
|---|---|---|
| `structuredClone`-per-viewer masking | still fine at ≤10 players | cheaper shape sketched in the server section (skip cloning deck/discard; memoize masked arrays) |
| `captureCardRects` reflow batching | still fine | already does a clean write→read→write pass; no action |
| Migration-runner generalization | still fine | ledger + idempotent backfill works; don't touch |
| SQLite backup / litestream | still a good idea eventually | WAL + volume snapshot is the interim answer |
