# Backlog — Projects (need planning / careful execution)

Larger items from the 2026-07 review. Each needs a design pass or touches
game-critical code — don't hand these to an agent without a plan and
regression tests. Suggested order below; **resolve the decisions first**,
they shrink what the projects touch.

## Decisions needed (owner input, blocks work below)

- [x] **D-1: Bot takeover — keep or remove?** → **REMOVED (2026-07-16).**
  Bots are gone: `botPlayer.ts` deleted, `isBot` replaced everywhere by
  `hasLeft`. New leave-mid-game behavior — an accepted player who leaves a
  `playing` game is marked `hasLeft`, kept in the roster but grayed-out and
  skipped forever, their cards discarded and any staged table batches pulled
  back (`applyDecline`/`removeLeftPlayerCards` in `gameLogic.ts`); the game
  ends if fewer than two players can still act. See game-flow.md for the
  authoritative description.

- [ ] **D-2: Profile deletion policy (latent, decide before ever adding
  "delete my account").** `game_moves.player_id` has RESTRICT semantics, so
  `deleteProfile` throws for any profile that ever played; meanwhile
  `skitgubbe_history.profile_id` is CASCADE, so deletion would silently
  rewrite coronation history. Event-sourced moves make hard deletes
  structurally hostile — soft-delete (a `deleted` flag) is the natural
  answer. Only tests call `deleteProfile` today; no urgency, just don't
  expose deletion before deciding.

- [ ] **D-3: Games with no natural loser record no results — intentional?**
  `recordGameResults` (`db.ts:363`) returns early if nobody is the loser
  (e.g. everyone declined), yet the game is marked ended, so the archive
  lists it loserless. If intentional, add a comment; if not, decide what to
  record.

## Projects, in suggested order

- [x] **P-1: WS identity — verify the JWT at upgrade.** → **DONE (2026-07-16).**
  The WS upgrade handler (`index.ts`) now verifies the `skitgubbe_session`
  JWT and binds the verified `profileId` to the physical socket
  (`GameRoom.socketProfiles`, keyed by `ws.raw`). `join` resolves identity
  from that binding via `getAuthedProfileId` — the client-asserted
  `playerId`/`name`/`color` are ignored (name/color/avatar are read from the
  DB profile). Unauthenticated upgrades are closed with 1008; an unbound
  socket that sends `join` gets an `Unauthorized` error. Also removed the
  diagnostic handshake logging that dumped the raw cookie header. Regression
  test: `tests/wsIdentity.test.ts` (fake-socket GameRoom) asserts a player
  never sees another's card values, an Alice-authed socket cannot join as
  Bob (treated as Alice, Bob's socket not kicked), and an unbound socket is
  refused and leaks no hands.

- [x] **P-2: Room/timer lifecycle — `GameRoom.dispose()`.** → **DONE (2026-07-16).**
  `GameRoom.dispose()` cancels both timers (trick-cleanup + idle-cleanup) and
  sets a `disposed` flag checked in every timer body; timer bodies are
  try/caught so a throw can't take down the process. The trick timer handle is
  now stored, rescheduling replaces (not stacks) it, and game reset /
  debug-skip cancel it explicitly. `rooms.ts` is now a `RoomManager`
  (`get`/`getOrCreate`/`evict`) — eviction always disposes, and the two room
  creation sites (`index.ts`, `routes/games.ts`) both go through
  `getOrCreate`. Regression tests: `tests/roomLifecycle.test.ts`.

- [x] **P-3: Extract `foldMoves()` + `commitMove()`.** → **DONE (2026-07-16,
  after P-5).** The replay move-switch now lives once: `replayGame` grew an
  `onState` callback (fired at seq 0 and after each move) and
  `GameRoom.getSanitizedStatesRange` folds through it — its 110-line copy is
  gone. `GameRoom.commitMove(playerId, type, cards, apply, {broadcast?})`
  enforces the 5-step ritual (seq → save → apply → status sync →
  trick-cleanup scheduling → broadcast) and is used by every move writer:
  play/pickup/chance/sprinkle handlers, accept, decline, join-accept, and
  the trick timer. `state.seq` is maintained by `commitMove` (and the two
  reset paths) and is now authoritative — no more `MAX(seq)` query per
  broadcast recipient in `getSanitizedStateForPlayerId`. Side benefit:
  accept/join now sync game status to DB (they didn't before), so an
  auto-escape on accept updates `active_player_id`. Seq/replay pinned in
  `tests/roomLifecycle.test.ts`. (Kept `getNextMoveSeq`+`saveMove` inside
  `commitMove` rather than an `INSERT…SELECT MAX` — equivalent under Bun's
  single thread, and now there's exactly one call site.)

- [x] **P-4: Finish the legacy `waiting`-lobby removal.** → **DONE (2026-07-16).**
  GameRoom's constructor now always builds state via `replayGame` (the
  55-line "initialize waiting state" branch is gone; a missing deck replays
  an empty move log into an inert pre-start state). `handleJoin` only writes
  an 'A' move for pending invitees — non-roster connections are spectators —
  and `applyJoin`'s "join as regular player" path is deleted. `'waiting'`
  survives only as the replay engine's transient pre-`S` status.

- [x] **P-5: Regression-test suite for the recurring bug class + invite
  lifecycle.** → **DONE (2026-07-16).** `tests/gameLogicRegression.test.ts`
  (pure-state builders, no DB) covers: decline mid-phase-1 turn validity,
  trick winner leaving while a trick is pending, the pending-invitee accept
  flow, the **empty-deck accept** edge (it did wedge — decided: auto-escape
  via `checkPlayerEscape` + turn progression in `applyJoin`, see
  game-flow.md), the P-6 tie-breaker decline scenarios, and the phase-2
  escape-mid-trick pin. Extracted `activeCount(state)` and
  `trickParticipantCount(state)` helpers for the previously-inline
  definitions. (The masking test lives in `tests/wsIdentity.test.ts`.)

- [x] **P-6: Fix tie-breaker state on decline.** → **DONE (2026-07-16).**
  `removeLeftPlayerCards` strips the leaver from `tiedPlayerIds` and, when
  <2 tied players remain, resolves the tie immediately
  (`resolveDegenerateTieBreaker`: sole survivor wins the pile as a pending
  trick; zero survivors → `distributeTablePileBack`). The
  `tieBreakerStartPileSize` adjustment now only counts batches removed from
  *before* the sub-round, keeping `resolveTieBreaker`'s tail-slice math
  correct when a leaver's tie-breaker play is removed. `applyClearTrick`
  (phase 1) also progresses the turn if the pending winner left before the
  cleanup timer fired. Landed with its P-5 tests.

- [ ] **P-7: Split `RoomState` (1216 loc, four responsibilities).**
  It owns the WS client + reconnect, the gameState mirror, ~300 loc of
  FLIP/card-fly geometry (`cardIn`/`cardOut`), and chat. Plan: extract the
  pure animation math into `cardTransitions.ts` (mirrors how
  `CardDragState` was extracted) — this alone makes the WS/state core
  reviewable. Also have autoplay (`triggerAutoplay`, powerset enumeration)
  reuse `getLegalPlays`/shared helpers instead of being a third play-finder.

- [x] **P-8: Avatar feature diet (27% of the codebase).** → **DONE (2026-07-16).**
  `avatar/+page.svelte` refactored: SVG template data moved to JSON loaded
  lazily (`avatarFeatures.json`), color math split into `colorMath.ts` (with unit
  tests), history state managed via `FeatureHistory` class (with unit tests),
  and gestures/DnD managed via `AvatarGestureController` class (with unit tests).
- [x] **P-8.1** → **DONE (2026-07-16).** `avatarFeatures.json` run through
  SVGO via `packages/web/scripts/optimize-avatar-features.ts` (svgo is a web
  devDependency; re-runnable). svgContent shrank 31% (140KB → 96KB file). The
  script preserves ids (cross-fragment `url(#…)` refs + runtime `_grad_`
  namespacing) and `class` recolor hooks, and asserts per-fragment id/ref/class
  sets are unchanged. Also fixed a latent `<<path` typo in
  `hair_back/spiky_short` that SVGO's parser caught.

- [x] **P-9: PWA update strategy.** → **DONE (2026-07-16).**
  Prompt-to-reload: the SW no longer calls `skipWaiting()` on install — a new
  worker stays waiting until the user accepts the (pre-existing) "Update
  Available" banner, whose Reload button now posts `SKIP_WAITING` to the
  waiting worker and reloads on `controllerchange` (2s fallback). The layout
  detects updates three ways: `reg.waiting` at registration, `updatefound` →
  `installed`-with-controller, and SvelteKit's `updated` store (which now also
  calls `reg.update()` so the new SW is waiting by the time the user clicks).
  Runtime cache is scoped: only known app-shell paths (`ASSETS`) are cached,
  so per-room URLs etc. no longer grow the cache unboundedly. The 5-min
  version poll is kept — it only surfaces the passive banner now.

- [ ] **P-10: Shared DTO types — kill the `any`s.**
  Client `$state` fields (`profiles`, `games`, `activeProfile`, …),
  `recordGameResults(state: any)`, `ws: any` throughout GameRoom, SW event
  types. Plan: define shared response types in `packages/shared` (or infer
  from route handlers) so server/client DTO drift breaks the build; type
  `ws` as `WSContext` and collapse the three raw-socket identity scans into
  one `socketOwner(ws)` helper; introduce a strict
  `CardValue = '2'|…|'A'` literal type with a separate masked-card
  representation, and make `getValueNumeric` throw on unknown values
  instead of returning 1.

## Deliberately dropped (so you don't re-litigate)

- Unauthenticated profiles / passwordless `/select` — **accepted by
  design** (LAN-only honor model; the sign-in log is the mechanism).
- Rate limiting on REST routes — out of scope for trusted LAN users
  (the per-socket chat limit, QW-7, is kept for DB-growth reasons).
- "Pending-invitee turn stall" — reclassified: **waiting is the feature**
  (see game-flow.md); only the empty-deck edge (P-5) remains.
- Phase-2 burn-vs-escape stall — probe-tested and disproved; survives only
  as the `activeCount` helper + pin test in P-5.
- Migration-runner generalization, `structuredClone`-per-viewer masking
  optimization, `captureCardRects` reflow batching, SQLite backup /
  litestream sidecar — real but low-value at current scale; revisit if the
  app grows.
