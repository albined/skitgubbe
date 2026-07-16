# Work plan — 2026-07-16

Owner-requested fixes/features. Each task lists design decisions and exact
touch points so any agent can pick one up. Check the box + note the commit
when done. Read `docs/architecture.md` invariants (esp. #2 masking, #6
move-commit ritual) before touching game code.

## T1 — Finished games: keep visible until result seen + push notification

**Problem:** When a game ends, it instantly disappears from the lobby's
active list (`getGamesForProfile` filters `g.status != 'ended'`,
`packages/server/src/db.ts`). Players who didn't have the room open never
see who won. No push is sent on game end.

**Design:**
- A finished game stays in the lobby's active list per player until that
  player has *viewed the ending* (the existing end-game animation in the
  room). Viewing = the end animation sequence starts for a non-replaying,
  ended game; the client then auto-archives the game for that profile via
  the existing `POST /api/games/archive`. Reuses `game_players.is_archived`
  — no new column.
- Opening an ended room already gives the desired UX: reconnect replay
  shows the last ≤10 states, then the skitgubbe poster animation plays
  (`roomState.svelte.ts` end-game `$effect`). No new replay work needed.
- Push notification "game over" to **all accepted players** when status
  transitions to ended (hook: `syncGameStatusToDb()` in
  `packages/server/src/gameRoom.ts`, the `ended && !wasEnded` branch —
  same place `recordGameResults` runs). Body names the Skitgubbe. The
  service worker already suppresses notifications when the app is focused.
- Grandfathering: data migration marks `is_archived = 1` for all rows of
  already-ended games so old games don't flood back into the lobby.
  Requires extending the column-based migration runner
  (`packages/server/src/schema.ts`) to support data migrations (no
  column check — run-once by ledger id).

**Touch points:**
- `packages/server/src/db.ts`: `getGamesForProfile` → include
  `(g.status = 'ended' AND gp.is_archived = 0)`;
  `getArchivedGamesForProfile` → archived only (`gp.is_archived = 1`).
- `packages/server/src/notifications.ts`: add `sendGameEndedNotification`.
- `packages/server/src/gameRoom.ts`: call it in `syncGameStatusToDb`.
- `packages/server/src/schema.ts`: migration id 6 (data migration).
- `packages/web/src/lib/state/roomState.svelte.ts`: when the end animation
  starts (ended, has skitgubbe, not replaying), fire-and-forget
  `POST /api/games/archive { gameIds: [roomId] }` once per mount.
- `packages/web/src/routes/+page.svelte`: show a "finished" badge on ended
  games in the active list (they're clickable → room → animation → archived).
- Watch out: `updateGameStatus` un-archives the row of the active player on
  every status write (`db.ts` ~line 258) — it already skips `ended`, keep it
  that way. Lobby `is_my_turn` is null for ended games (active_player_id
  cleared) — fine.

**Status:** [x] done & verified end-to-end (headless chromium) — (db queries + `sendGameEndedNotification`
+ migration 6 + client auto-archive on animation + lobby badge)

## T2 — Bug: last deck card can be chanced → no trump

**Problem:** In phase 1, "chansa" pops the top deck card onto the table. If
it's the **last** card, `hiddenTrumpStorage` is never set (that only happens
in `drawReplacements`), so phase 2 has no trump. Rule fix: the last card is
not chanceable.

**Design:** Enforce at move creation, NOT in `applyChance`
(`gameLogic.ts`) — historical `game_moves` logs may contain a last-card 'C'
move, and tightening the replay-side guard would corrupt replay of persisted
games (invariant 1). New games simply can never record such a move.

**Touch points:**
- `packages/server/src/gameRoom.ts` `handleChance`: reject when
  `state.deck.length <= 1` (was `=== 0`).
- `packages/web/src/lib/components/room/Sidebar.svelte`: disable/hide the
  "Chansa" button when `deck.length < 2` (button currently shows whenever
  `deck.length > 0`). Also check the drag-to-deck chance path in
  `roomState.svelte.ts` (`handleChanceClick` / drag handler ~line 614).
- Test: `packages/server/tests/` — chance rejected with 1 card left;
  replay of an old log containing a last-card chance still works
  (applyChance stays permissive).

**Status:** [x] done & verified — server guard + client button/drag guards + 2 tests

## T3 — Bug: profile selector ("Netflix" screen) can't scroll

**Problem:** `layout.css` sets `body { overflow: hidden; height:
var(--app-height) }`. The lobby root (`packages/web/src/routes/+page.svelte`)
is `min-h-screen flex items-center justify-center` with no scroll container,
so with many profiles the grid clips (and `justify-center` + overflow clips
the *top* unrecoverably).

**Design:** Make the lobby root the scroll container:
`h-[var(--app-height)] overflow-y-auto`, and center children with
`margin: auto` instead of `justify-center` (auto-margins center when content
fits and allow full scroll when it doesn't — the `justify-center` top-clip
trap). Applies to both the profile selector and the game-hub grid (hub keeps
its own inner list scroll).

**Status:** [x] done & verified — root is scroll container, children use `m-auto`

## T4 — Bug: avatar creator scrollbar can disappear (mobile-fatal)

**Problem:** The feature grid (`packages/web/src/routes/avatar/+page.svelte`)
has `touch-action: none` (needed for drag-out gestures), so the custom
scrollbar is the ONLY way to scroll on touch. The scrollbar renders only
`{#if showScrollbar}` where dimensions update solely on `onscroll` +
ResizeObserver of the container. Switching category changes `scrollHeight`
but fires neither → scrollbar stays hidden → mobile users can't scroll,
and can't bring it back.

**Design:**
- Always render the track (permanently visible, per owner request). When
  content fits, show a full-height inert thumb.
- Fix staleness: re-measure on `activeCategory` change (after `tick()`),
  and keep the ResizeObserver.

**Status:** [x] done & verified — track always rendered, re-measure on category change

## Verify

- `bun run check` + `bun test` (server tests cover T1 queries + T2 guard).
- `/verify` skill (headless two-player game) for T1 end-flow and T2 button
  state if feasible.
