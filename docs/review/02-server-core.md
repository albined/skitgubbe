# 02 — Server Core: GameRoom, gameLogic, bots

Files: `packages/server/src/{index,gameRoom,gameLogic,botPlayer,rooms}.ts`

## 🔴 P0

### 1. WebSocket identity is client-asserted (impersonation)
`gameRoom.ts:583 handleJoin(ws, msg.playerId, ...)` — the `join` message
carries a client-chosen `playerId`, and no token/cookie is ever verified on
the WS path. The upgrade handler (`index.ts:26-72`) receives the session
cookie but does not validate it. Consequences:

- Anyone can send `{type:'join', playerId:'<victim>'}` and **see the victim's
  unmasked hand** (sanitization keys on the joined playerId) and **play their
  turns**.
- `handleJoin` also *kicks the victim's real socket* (old-socket cleanup at
  line 585-596), so the attack is disruptive, not just passive.
- Room IDs are 6 lowercase-alnum chars from `Math.random` (games.ts:59) and
  profile IDs are enumerable via `GET /api/profiles` (see 04), so both inputs
  are obtainable.

**Fix direction:** verify the `skitgubbe_session` JWT in the upgrade handler
(cookie is available there), stash `profileId` on the socket data, and ignore
any client-sent playerId. This also makes `name`/`color` in the join message
(currently trusted, spoofable) unnecessary — they're in the DB.

Commit 99791f6 closed the REST-vs-WS *game-action* gap, but join/identity was
left open.

### 2. Invalid-room WS upgrades are accepted
`index.ts:36-43` — when `roomId` is unknown, the handler returns `{}`;
the socket still upgrades and stays open forever (no handlers, no close).
Cheap DoS-ish resource leak; return a 404 / close the socket instead.

## 🟠 P1

### 3. "Temporary diagnostic logging" dumps auth cookies
`index.ts:31-34` logs **all headers including `Cookie`** (the session JWT) on
every WS handshake. Anyone with log access can hijack 30-day sessions; logs
now contain durable credentials. Remove (it's explicitly marked temporary).

### 4. Orphaned timers act on evicted rooms
`scheduleTrickCleanupTimeout` (gameRoom.ts:160) and the bot scheduler
(botPlayer.ts:21) hold `this`/`context` in `setTimeout`s that are never
cancelled when the room is evicted (`rooms.delete` in index.ts:64) or reset.
Scenario: all humans disconnect while a bot-vs-bot tail is running → after
30s the room is evicted while bot timers keep committing moves to the DB;
a player reconnects → *new* GameRoom replays DB and starts a *second* bot
loop → both loops call `getNextMoveSeq()`+`saveMove()`; the loser hits the
`UNIQUE(game_id, seq)` constraint and **throws inside a timer with no
try/catch** (unhandled), and the two in-memory states diverge from each other
and possibly from the DB. Add a `dispose()` cancelling all timers + a
generation/`disposed` flag checked in every timer body; also cancel eviction
while a game with bots is still `playing`.

### 5. Rotation `while (isDone)` guards — defensive gap, not a live loop
`gameLogic.ts:304-308` (`progressPhase1Turn`) and 526-529
(`progressPhase2Turn`) both do `while (players[nextIdx].isDone) nextIdx =
(nextIdx+1)%len`. `progressPhase2Turn` guards `remaining.length <= 1` first;
`progressPhase1Turn` has **no guard**.

**Verified (probe test):** in *pure phase-1 play no player is ever marked
`isDone`** — `isDone` is only set by `checkPlayerEscape` (phase-2 escape) and
the decline path. So the "all players done → infinite loop" scenario is **not
reachable in normal phase 1**; my initial framing overstated it. It remains a
real *defensive* gap: any future code that marks a phase-1 player done (or a
decline cascade that does — worth a targeted test) would hang the whole
single-threaded server. Add the `remaining <= 1` guard + full-cycle bail-out
to `progressPhase1Turn` for parity and safety, but this is **P2**, not the
live bug. The live bug in this area is §6 below.

### 6. Pending invitees stall the turn — CONFIRMED
**Verified (probe test):** with 2 accepted players + 1 *pending* invitee
(invited, never accepted — a normal mid-invite state), the invitee stays in
`state.players` with an empty hand and `isDone === false`. After both accepted
players play, the phase-1 rotation lands the turn **on the pending invitee**
(`activePlayerIdx` → p3). That player has no cards (can't `playCards`) and is
not controlled by anyone (they never opened the room), so **the game waits
forever for a move that no one will make.** With `deck > 0` the only legal
action is `chance`, which also requires that phantom player's socket — so the
stall holds; if the deck empties it becomes a hard deadlock.

Round resolution counts *all not-done players*, so the phantom also inflates
the threshold (counting *all not-done players*, including invitees who never
accepted):

- Phase 1 `progressPhase1Turn` (gameLogic.ts:300): `activeCount =
  players.filter(p => !p.isDone).length` — a pending invitee (in
  `state.players`, never `isDone`) makes `tablePile.length === activeCount`
  unreachable until the rotation lands on them; then they hold the turn with
  an empty hand: `playCards` no-ops (no cards), `chance` works only while the
  deck is non-empty. **With an empty deck the game deadlocks.**
- Phase 2 `applyPlayCards` (gameLogic.ts:71) has the same shape:
  `players.filter(p => !p.isDone || tablePilePlayers.includes(p.id))`.
- Contrast: `applyStartGame`, `transitionToPhase2`, `checkPlayerEscape` all
  correctly filter `inviteStatus === 'accepted'`.

The invariant "only accepted players participate in turn order" is enforced
in some functions and not others. Recent bug-fix commits (6f61fb3, a50bf76,
ac542f8) all orbit this same inconsistency. **Recommend: one helper
`activePlayers(state)` (accepted && !isDone) used everywhere**, and make the
turn-rotation skip non-accepted players.

### 7. Tie-breaker state not cleaned on decline
`applyDecline` removes/botifies a player but never edits `tiedPlayerIds` /
`tieBreakerActive`. If a tied player declines mid-tie-breaker,
`progressPhase1Turn` (line 295) indexes `tiedPlayerIds[subRoundPlays]`,
`findIndex` misses, and the turn silently falls back to player 0 — wrong
player, possibly a done one. Also `resolveTieBreaker` reads
`state.tablePile.length - K` slices which shift when
`distributeTablePileBack` ran meanwhile. Needs: strip declined ids from
`tiedPlayerIds`; if <2 remain, resolve the tie immediately.

## 🟡 P2

8. **Debug handlers are destructive and under-guarded** —
   `handleDebugSkipToPhase2` (gameRoom.ts:878) wipes all moves
   (`dbOps.resetGame`) with **no host check** (reset-game proper requires
   host). Gated only by `PUBLIC_ALLOW_DEV_SETTINGS`; if that's ever true in a
   deployed env, any player erases games. Add host check + non-prod assert.
9. **`applyChance` trusts the passed card** — comment says "we verify it is
   the top card of the deck" (gameLogic.ts:119) but no verification happens;
   `deck.pop()` result is discarded. Live path reads the top card itself, so
   this is only a replay-integrity assert that's missing — cheap to add,
   catches deck/codec drift loudly instead of corrupting silently.
10. **`handleDebugForceLose` fabricates cards with Swedish values** —
    `value: 'Kn'/'D'` (gameRoom.ts:939-941) are not in `VALUES_ORDER`
    (`'J'/'Q'`), so `getValueNumeric` returns 1. Debug-only, but it documents
    a real ambiguity: value encoding is `J/Q/K` internally, `Kn/D/K` in
    Swedish UI — keep display names strictly client-side.
11. **`ws: any` everywhere** (clients Set, playerSockets Map, every handler).
    Bun/Hono export `WSContext`; typing them would catch the `.raw`-identity
    juggling (three near-identical raw-socket scans: `removeClient`,
    `getPlayerId`, `handleJoin`) — which itself should be one
    `socketOwner(ws)` helper or a `WeakMap<raw, playerId>`.
12. **Per-broadcast DB hits** — `getSanitizedState` calls
    `dbOps.getNextMoveSeq` (a `MAX(seq)` query) once per unique player per
    broadcast, though `state.seq` is already maintained. Redundant queries in
    the hottest path; keep `state.seq` authoritative instead.
13. **`getSanitizedStatesRange` replays the whole game per reconnect** —
    fine at 10-player scale, but it also `structuredClone`s the full state up
    to 11× per call. If reconnect storms ever hurt, cap by move count, not
    just `>10 → last 10`.
14. **Chat has no rate limit** — `handleChat` persists + broadcasts
    arbitrarily fast; a hostile client can grow `game_chats` unboundedly and
    spam every player. Cheap fix: per-socket token bucket (e.g. 5 msg / 10s).

## 🔵 P3

- `broadcastState` catch logs but doesn't drop dead sockets; rely on onClose.
- `handleResetGame` rebuilds state inline (gameRoom.ts:845-867) duplicating
  the constructor's waiting-state literal — extract `makeInitialState()`.
- `state.seq` optional on `GameState` and set inconsistently (constructor
  sets it, `handleResetGame` doesn't) — make it required.
- Logs ring-buffer (80) duplicated in `gameRoom.log()` and
  `gameLogic.logState()`.
- `applyDecline` log typo: "Alle andra spelare" → "Alla andra spelare";
  also that message fires even when the game continues with >1 players?
  (only in the `<=1` branch — fine, but the text claims *everyone* left.)

## ✅ Good

- Per-playerId broadcast cache in `broadcastState` (gameRoom.ts:516) —
  avoids re-serializing identical masked states. Nice.
- Reconnect replay protocol (`lastSeq` → ≤10-state replay window) is a
  thoughtful UX touch and correctly sanitizes each historical state
  per-viewer.
- Trick-clear-on-timeout being *persisted as a 'T' move* keeps replay
  deterministic despite the timer — the design survived its own complexity.
- Guard-first `apply*` functions returning void no-ops on illegal input make
  replay robust to garbage moves.
