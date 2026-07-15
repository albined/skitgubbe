# 01 — Architecture & Stack Overview

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

## ✅ Good design worth preserving

1. **Event sourcing for games.** Games persist as `initial_deck` + ordered
   `game_moves` (compact 1-char move types), and state is rebuilt via
   `replayGame()`. This gives crash recovery, reconnect replay (client gets a
   `replay` message with the last ≤10 states), and an audit trail for free.
   This is the architectural crown jewel of the project.
2. **Shared rules package.** `isValidPlay`/`getLegalPlays` live in
   `packages/shared` and are used by server validation, the bot, and the
   client UI — one source of truth for rules. Exactly right for this app.
3. **Separation of `apply*` transition functions** (`gameLogic.ts`) from the
   `GameRoom` orchestration (persistence, timers, broadcast). Transitions are
   deterministic and replayable.
4. **Monorepo with Bun workspaces** — thin, no build step for shared code,
   `workspace:*` linking. Low ceremony, appropriate scale.
5. **Modularized server** (routes/, middleware/, utils/) after the 5a3c0f8
   refactor — files are mostly small and single-purpose.

## 🟠 P1 — Structural issues

### 1. Two replay implementations that can drift
`gameReplay.ts:57-110` and `GameRoom.getSanitizedStatesRange()`
(`gameRoom.ts:387-501`) contain the *same* move-switch and player-init logic,
copy-pasted. A rules change applied to one and not the other produces
divergent replays (client sees different history than server state). Extract
one iterator (`foldMoves(initialState, moves, onStateAfterEachMove?)`) used by
both.

### 2. In-memory room ↔ DB dual-write coupling
`GameRoom` methods each do: `getNextMoveSeq()` → `saveMove()` → `apply*()` →
`syncGameStatusToDb()` → `broadcastState()`. The seq is derived from
`MAX(seq)+1` at each call site (6+ places) rather than owned by one
`commitMove()` helper. Any new handler must remember all five steps in order;
forgetting one silently desyncs DB vs memory. Centralize into a single
`commitMove(playerId, type, cards?)` method.

### 3. `waiting` status is mostly legacy
`createGame()` (db.ts:77) creates games directly in `playing` with a seq-0
'S' move. The `waiting` branches in `GameRoom`'s constructor and
`applyJoin`'s "join as regular player" path are near-dead code that still
shape control flow (e.g. uninvited join is only possible `status === 'waiting'`).
Commit ac542f8 ("cleaning up legacy code for lobbies") started this cleanup;
finish it: either delete the waiting-lobby path or document it as reachable.
**Owner confirmed (2026-07-13): the lobby flow is gone for good — delete the
path.** The current intended flow is documented in `docs/game-flow.md`.

### 4. Room lifecycle is implicit
Rooms are created in **two** places (WS upgrade in `index.ts`, decline route
in `games.ts`) and destroyed only by the 30s empty-room timeout. There is no
`dispose()`; pending `setTimeout`s (trick cleanup, bot moves) keep references
to evicted rooms and keep acting on them (see 02, finding 2). A
`GameRoom.dispose()` that cancels all timers, called at eviction, closes this
class of bugs.

## 🟡 P2

- `rooms.ts` is a bare global `Map` — fine today, but hides the singleton
  dependency; both `index.ts` and `routes/games.ts` mutate it. A tiny
  `RoomManager` with `getOrCreate(roomId)` would remove the duplicated
  create-if-missing logic and give a single eviction point.
- Mixed languages: code/comments in English, user-facing strings and logs in
  Swedish, some log lines mixed ("Log: Room ... cleaned up"). Fine for a
  Swedish-audience app, but pick a rule (user-visible = sv, diagnostics = en)
  and apply it; today game `logs[]` shown to users sometimes carry English.
- `general_plan.md`, `SKILL.md`, `skitgubbe_rules.md` at repo root are useful
  docs but unversioned by area; consider `docs/`.
- Root has both `bun.lock` and per-package `bun.lock` files (`packages/server`,
  `packages/web`) — stale per-package locks contradict workspace-root
  resolution. Delete the per-package ones.

## Data-flow note for future fixers

State reaches clients through exactly one funnel: `broadcastState()` →
`getSanitizedState(ws)` → per-player masking. **Any new field added to
`GameState` is sent to all players unless masked here** — treat
`getSanitizedStateForPlayerId` as a security boundary and review it on every
state-shape change. (The REST layer violates this today — see 04, finding 1.)
