# Architecture & Codebase Overview

Condensed from the 2026-07 tech-debt review. This is the durable "how the
code works" doc; the actionable findings live in
[backlog-quick-wins.md](backlog-quick-wins.md) and
[backlog-projects.md](backlog-projects.md). Game/invite flow is in
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
the honor model's own audit trail?* (This is why WS identity verification is
still worth fixing — WS impersonation leaves no sign-in-log trace.)

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
   are used by server validation, the bot, and the client UI. Never
   re-implement a rule on one side of the client/server boundary.
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
   memory. (A `commitMove()` helper to enforce this is on the backlog.)

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

- `packages/server/tests/` — replay engine, game creation, shuffle, titles.
- `packages/shared/tests/` — rules, card codec (full round-trip).
- `packages/web/tests/` — lobbyState.
- Tests use in-memory SQLite and run in ~340ms via bare `bun test` from the
  repo root. (Note: the `bun run test` script under-covers — see backlog.)
