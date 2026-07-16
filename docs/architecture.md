# Architecture & Codebase Overview

Condensed from the 2026-07 tech-debt review (all actionable findings from
that review have since been implemented; the backlog docs that tracked them
live in git history on `review/tech-debt-audit-2026-07`). This is the
durable "how the code works" doc. Game/invite flow is in
[game-flow.md](game-flow.md).

## System shape

```
Browser (SvelteKit SPA + PWA service worker)
   │  REST /api/*  (Hono, cookie JWT)
   │  WS   /api/room/:roomId/ws
   ▼
Bun server (packages/server)
   ├─ Hono app: routes/{profiles,games,push,statistics}
   ├─ GameRoom (in-memory, one per active room, Map in rooms.ts)
   ├─ gameLogic.ts: pure-ish state transition functions
   ├─ gameReplay.ts: event-sourcing replay (moves table → GameState)
   └─ bun:sqlite (skitgubbe.db) — profiles, games, game_moves, chats, push subs
packages/shared: card types, deck, rules (isValidPlay/getLegalPlays), codec
Infra: docker-compose → nginx → web (adapter-node) + server containers
```

## Deployment & trust model (owner decision, 2026-07-13)

Self-hosted, **LAN-only, never internet-exposed**. Trust is honor-based by
design: the passwordless "Netflix profile picker" is the product, and the
**sign-in log is the accountability mechanism** — profile takeover is
possible but leaves a trace. There is no external attacker in the threat
model. Security work is therefore judged by one question: *does it protect
the honor model's own audit trail?* (WS identity is now verified at upgrade —
see P-1, done 2026-07-16 — so WS impersonation no longer bypasses the
sign-in-log trace.)

### Deployment config notes (QW-37, verified 2026-07-16)

- **`JWT_SECRET`**: if unset, the server generates one and persists it to
  `jwt_secret.txt` next to the DB (`utils/jwt.ts`), so sessions survive
  restarts on a single instance. Set it explicitly if you ever run multiple
  server instances or want reproducible sessions across volume wipes.
- **`NODE_ENV=production`** reaches the server container twice over (compose
  `environment:` and the Dockerfile `ENV`), so the session cookie's `secure`
  flag (`routes/profiles.ts`) is active in production. Caveat: `secure`
  cookies are only sent over HTTPS (or localhost) — if the LAN deployment is
  served over plain `http://<lan-ip>`, sign-in would silently fail; keep this
  in mind if sessions ever break after a deploy-setup change.

## Key invariants (read before touching game code)

1. **Games are event-sourced.** A game is `initial_deck` + an ordered
   `game_moves` log (compact 1-char move types, `UNIQUE(game_id, seq)`);
   state is rebuilt via replay. Crash recovery, reconnect replay, and audit
   come from this. Never mutate persisted state directly.
2. **Masking is a security boundary.** State reaches clients through one
   funnel: `broadcastState()` → `getSanitizedState(ws)` → per-player
   masking (`getSanitizedStateForPlayerId`). **Any new `GameState` field is
   sent to all players unless masked there.** Review it on every
   state-shape change. Hidden cards use the `'?'` value sentinel.
3. **Rules live once, in `packages/shared`.** `isValidPlay`/`getLegalPlays`
   are used by server validation and the client UI. Never re-implement a
   rule on one side of the client/server boundary.
4. **Card codec is order-dependent.** `cardToInt = suitIdx*13 + valIdx`
   against `SUITS_ORDER`/`VALUES_ORDER` — reordering those arrays breaks
   every persisted game. Card values are `J/Q/K` internally; `Kn/D/K` is
   Swedish display only, strictly client-side.
5. **Pending invitees hold the turn by design.** Invitees join the rotation
   immediately; when the turn reaches one, the game waits until they accept
   (dealt `min(3, deck.length)` cards, still their turn) or decline/are
   removed. Do **not** "fix" this by skipping non-accepted players. Details
   in [game-flow.md](game-flow.md).
6. **The move-commit ritual.** Every GameRoom action must do:
   `getNextMoveSeq()` → `saveMove()` → `apply*()` → `syncGameStatusToDb()`
   → `broadcastState()`, in order, synchronously (Bun's single thread is
   what makes MAX(seq)+1 safe). Forgetting a step silently desyncs DB vs
   memory. `GameRoom.commitMove()` enforces this ritual — route every move
   writer through it rather than hand-rolling the steps.

## Design strengths — preserve these

- **Event-sourced game persistence** (deck + move log + replay) — the
  architectural crown jewel; the schema enforces replay integrity via
  `UNIQUE(game_id, seq)`.
- **Single shared rules package** — no rule implemented twice.
- **Deterministic integer card codec** with a full 52-card round-trip test.
- **`CardDragState`** — textbook pointer state machine (drag threshold,
  run detection, click/drag disambiguation). The model for splitting other
  state classes.
- **Room/lobby component decomposition** — thin composition roots, small
  prop-driven components, single-brain state classes.
- **Complete push pipeline** — subscribe → store → send-on-turn →
  suppress-if-focused → click-to-focus, with dead-subscription pruning on
  410/404 and consent requested only on explicit toggle.
- **Real migration system** (applied-ledger + idempotent backfill) and
  idempotent, transaction-wrapped `recordGameResults`.
- **Per-viewer broadcast cache** + reconnect replay protocol (`lastSeq` →
  ≤10-state window, correctly sanitized per viewer; client queues live
  updates during replay and dedups by seq).
- **Guard-first `apply*` functions** that no-op on illegal input — replay
  stays robust to garbage moves.
- **Trick-clear-on-timeout persisted as a 'T' move** — replay stays
  deterministic despite timers.
- **Secrets hygiene** — nothing sensitive tracked in git; env-first config
  with self-host file fallback (`jwt_secret.txt`, `vapid_keys.json`).
- **Docker/nginx basics** — multi-stage web build, workspace-aware layer
  caching, single gateway splitting `/api` from `/`, correct WS upgrade
  forwarding, gzip.

## Test layout

- `packages/server/tests/` — replay engine, game creation, shuffle, titles,
  room lifecycle, WS identity/upgrade, and game-logic regression suites.
- `packages/shared/tests/` — rules, card codec (full round-trip).
- `packages/web/tests/` — lobbyState, color math, feature history, gestures.
- Tests use in-memory SQLite; `bun run test` (or bare `bun test`) from the
  repo root runs everything.

## Open decisions (owner input needed before touching these areas)

Carried over from the 2026-07 review — not urgent, but decide before
shipping the related feature:

- **Profile deletion policy (latent — decide before ever adding "delete my
  account").** `game_moves.player_id` has RESTRICT semantics, so
  `deleteProfile` throws for any profile that ever played; meanwhile
  `skitgubbe_history.profile_id` is CASCADE, so deletion would silently
  rewrite coronation history. Event-sourced moves make hard deletes
  structurally hostile — soft-delete (a `deleted` flag) is the natural
  answer. Only tests call `deleteProfile` today; just don't expose deletion
  before deciding.
- **Games with no natural loser record no results — intentional?**
  `recordGameResults` returns early if nobody is the loser (e.g. everyone
  declined), yet the game is marked ended, so the archive lists it
  loserless. If intentional, add a comment; if not, decide what to record.

## Deliberately dropped (so you don't re-litigate)

- Unauthenticated profiles / passwordless `/select` — **accepted by
  design** (LAN-only honor model; the sign-in log is the mechanism).
- Rate limiting on REST routes — out of scope for trusted LAN users
  (the per-socket chat limit is kept for DB-growth reasons).
- "Pending-invitee turn stall" — reclassified: **waiting is the feature**
  (see game-flow.md); the empty-deck edge is handled (auto-escape on accept).
- Phase-2 burn-vs-escape stall — probe-tested and disproved; survives only
  as the `activeCount` helper + pin test in the regression suite.
- Migration-runner generalization, `structuredClone`-per-viewer masking
  optimization, `captureCardRects` reflow batching, SQLite backup /
  litestream sidecar — real but low-value at current scale; revisit if the
  app grows.
