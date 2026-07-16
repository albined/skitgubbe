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

- [ ] **P-3: Extract `foldMoves()` + `commitMove()`.** *(biggest correctness
  refactor)* Two copies of the replay move-switch exist and can drift:
  `gameReplay.ts:57-110` and `GameRoom.getSanitizedStatesRange`
  (`gameRoom.ts:387-501`). And every handler hand-rolls the 5-step commit
  ritual (architecture.md invariant 6) with `MAX(seq)+1` at 6+ call sites.
  Plan: one `foldMoves(initialState, moves, onStateAfterEachMove?)` used by
  both replay paths; one `commitMove(playerId, type, cards?)` doing
  seq-compute + insert + status sync in a single transaction
  (`INSERT ... SELECT COALESCE(MAX(seq),-1)+1` or `db.transaction`).
  While there: stop calling `getNextMoveSeq()` (a `MAX(seq)` SQL query) per
  broadcast recipient in `getSanitizedStateForPlayerId`
  (`gameRoom.ts:315`) — `state.seq` is already authoritative. Requires the
  regression-test net (P-5) in place first, ideally.

- [ ] **P-4: Finish the legacy `waiting`-lobby removal.** *(owner confirmed:
  the old lobby flow is gone for good)* `createGame` creates games directly
  in `playing`; the `waiting` branches in GameRoom's constructor and
  `applyJoin`'s "join as regular player" path are near-dead code that still
  shapes control flow. Delete the path (commit ac542f8 started this),
  keeping `docs/game-flow.md` as the source of truth for the current flow.
  Reduces the surface P-3 and the invite-lifecycle tests must cover.

- [ ] **P-5: Regression-test suite for the recurring bug class + invite
  lifecycle.** Git history keeps re-fixing the same area (tie-breaker
  a50bf76, decline 6f61fb3, start order ac542f8) and none of those fixes
  has a test. The replay engine makes these cheap: build a move list,
  replay, assert final state. Cover at least:
  - decline mid-phase-1 → turn order stays valid;
  - pending invitee holds turn → accept → dealt ≤3, still their turn →
    plays (the designed flow, per game-flow.md);
  - **empty-deck accept** (unverified edge): invitee accepts after the deck
    is empty → dealt 0 cards while holding the turn — probe whether this
    wedges phase 1/2, and if so decide (auto-skip? auto-remove?);
  - tie-breaker where a tied player declines (see P-6 — write the test
    first, it currently fails);
  - phase-2 burn with a player escaping mid-trick (probe-verified correct —
    keep as a pin); extract a single `activeCount(state)` helper for the
    two inline "active player" definitions (`gameLogic.ts:71` vs
    `progressPhase2Turn`).
  A small move-builder helper (`move('P','p1',[card])`) makes these
  pleasant. Also add the masking test from P-1 here.

- [ ] **P-6: Fix tie-breaker state on decline.** *(real live bug)*
  `applyDecline` never edits `tiedPlayerIds`/`tieBreakerActive`. If a tied
  player declines mid-tie-breaker, `progressPhase1Turn` (line ~295) indexes
  `tiedPlayerIds[subRoundPlays]`, `findIndex` misses, and the turn silently
  falls to player 0. Also `resolveTieBreaker`'s
  `state.tablePile.length - K` slice math shifts if
  `distributeTablePileBack` ran meanwhile. Plan: strip declined ids from
  `tiedPlayerIds`; if <2 remain, resolve the tie immediately; make the
  slice math immune to redistribution. Land with its P-5 test.

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
- [ ] **P-8.1**
  *Future optimization:* Shrink and optimize the `avatarFeatures.json` SVG path
  strings using a tool like `SVGO` to clean up unnecessary precision/metadata.

- [ ] **P-9: PWA update strategy.**
  Today `skipWaiting()` + `clients.claim()` force-activate a new SW
  mid-game (assets can swap under a live game), version polling every 5min
  re-triggers it, and the runtime cache stores every 200 GET unboundedly
  within a version. Plan: prompt-to-reload instead of silent takeover (or
  gate `skipWaiting` while a room socket is open — note the manifest is
  `display: fullscreen`, so users can't manually reload), scope the runtime
  cache to known static paths or cap it, and align the poll interval with
  the chosen strategy.

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
