# 02 — Server Core: GameRoom, gameLogic, bots

Files: `packages/server/src/{index,gameRoom,gameLogic,botPlayer,rooms}.ts`

> **Owner clarifications (2026-07-13):**
> - **Deployment is LAN-only, honor-based** (see 04 preface). §1 is
>   downgraded P0 → P1; its remaining value is that WS impersonation
>   bypasses the sign-in-log audit trail.
> - **Bots:** the owner believed all bot functionality was removed. It is
>   not — there is no way to *create* a bot player, but
>   **leave-mid-game → bot takeover is live**: `applyDecline` sets
>   `isBot = true` on an accepted player who leaves a `playing` game
>   (gameLogic.ts:212), `botPlayer.ts` then auto-plays their turns, and the
>   web UI renders a 🤖 BOT badge (PlayersRow.svelte:58). **Open decision:**
>   keep the takeover feature (then `botPlayer.ts` stays and §4's timer fix
>   still applies) or remove it (then choose a new leave-mid-game behavior
>   and delete `botPlayer.ts` + `isBot` throughout).

## 🔴 P0 → 🟠 P1 (re-graded, see note above)

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
to `progressPhase1Turn` for parity and safety, but this is **P2**, not a
live bug. (§6 below was originally called the live bug in this area; it has
since been reclassified as intended behavior — see §6.)

### 6. Pending invitees hold the turn — **RECLASSIFIED: by design** (owner, 2026-07-13)
**The original finding misread the intent.** The probe-test *observation*
stands (a pending invitee stays in rotation with an empty hand and the turn
lands on them), but the conclusion "the game waits forever for a move no one
will make" is wrong: **waiting is the feature.** The designed invite flow is:

1. Invitees are added to the rotation immediately as presumed players.
2. When the turn reaches a pending invitee, **the game waits for them to
   accept the invite** (via `POST /:roomId/accept` → `handleAccept`, which
   they can do at any time from the lobby/push notification).
3. On accept it is *still their turn*: `applyJoin` deals them
   `min(3, deck.length)` cards (gameLogic.ts:164-172) and they play.
4. On decline (or host removal) `applyDecline` removes them from the
   rotation and play moves on.

So the "move no one will make" does exist — it's accept/decline, delivered
over REST rather than the game WS. The original recommendation to **skip
non-accepted players in rotation would break the intended flow** and is
withdrawn.

**Residual real issues (downgraded to targeted checks, not a redesign):**
- **Empty-deck accept (unverified edge):** if an invitee accepts after the
  deck is empty, `applyJoin` deals 0 cards ("inga kort fanns kvar") and they
  hold the turn with an empty hand — verify this can't wedge phase 1/2, or
  auto-remove/skip a card-less late accepter. Worth one probe test.
- The threshold math counting pending invitees (`activeCount` in
  `progressPhase1Turn`, gameLogic.ts:300) is *consistent with* the design
  (a round can't resolve while a presumed player hasn't played) but the
  invariant is nowhere written down — which is exactly why this review
  misread it and why past fix commits (6f61fb3, a50bf76, ac542f8) kept
  circling it. **Document the invite lifecycle as real docs and encode it in
  replay regression tests** so intent is checkable.
- §7 below (tie-breaker state not cleaned on decline) is unaffected by this
  reclassification and still stands.

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
