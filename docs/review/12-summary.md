# 12 — Executive Summary & Ranked Findings

**Reviewed:** entire Skitgubbe monorepo (~16k loc TS/Svelte) at `4df7c66`.
**Docs 01–11** hold the detail; this file ranks everything and tells the next
agent where to start.

## Verdict

This is a **genuinely well-built project** — well above typical hobby-project
quality. The architecture is the standout: event-sourced games (initial deck +
move log → replay), a single shared rules package used by server, bot, and
client, and clean component/route decomposition on the front end. The polish
(animations, PWA, push) is real and complete.

The debt clusters in four places:
1. **Security of the trust model** — the WebSocket path trusts client-asserted
   identity, and the whole profile system is unauthenticated by design. Some
   of this is an intentional family-app choice; some is an actual hole.
2. **A recurring turn-order/player-lifecycle bug class** that the git log
   keeps re-patching and that still has live edge cases + no regression tests.
3. **Two oversized modules** (`roomState` 1.2k, avatar builder 4.3k) and
   duplicated replay/seq logic.
4. **Process gaps** — web tests don't run, there's no CI.

Nothing here threatens the core; all of it is fixable incrementally.

---

## 🔴 P0 — do first

| # | Finding | Where | Doc |
|---|---------|-------|-----|
| 1 | **WS identity is client-asserted** — any user can send `join{playerId:victim}` to read the victim's hand, play their turns, and kick their socket. Verify the session JWT at WS upgrade; derive playerId from it; ignore client-sent id. | `index.ts`, `gameRoom.handleJoin` | 02 §1, 04 §3 |
| 2 | **Profile system is fully unauthenticated** — `GET /api/profiles` lists everyone; `POST /:id/select` mints a 30-day session for *any* id with no secret. Full account takeover by design. Decide consciously: document as accepted, or add a device-bound claim. | `routes/profiles.ts`, `statistics.ts` | 04 §1, §2 |
| 3 | **Diagnostic logging dumps session cookies** — WS handshake logs all headers incl. `Cookie` (the JWT). Remove. | `index.ts:31-34` | 02 §3 |
| 4 | **Documented `bun run test` skips 22 of 37 tests** — it runs server-only (15 tests); the web + shared suites (incl. 353-loc `lobbyState.test.ts`) run only under a bare `bun test`. CI wired to the npm script gets false confidence. Point root `test` at `bun test` (or compose per-package scripts). | `package.json` | 09 §1 |

## 🟠 P1 — soon

| # | Finding | Doc |
|---|---------|-----|
| 5 | **Pending-invitee turn stall (CONFIRMED by probe test)** — a pending invitee stays in the rotation with an empty hand; the turn lands on them and the game waits forever for a move no one will make (hard deadlock if the deck empties). Also decline/tie-breaker turn-order gaps. Introduce one `activePlayers(state)` helper (accepted && !isDone) used everywhere and skip non-accepted players in rotation. NB: the `progressPhase1Turn` `while(isDone)` infinite-loop I first flagged is *not* reachable in pure phase 1 (no player is `isDone` there) — it's a P2 defensive gap, corrected in 02 §5. | 02 §5, §6, §7; 05 §1 |
| 6 | **Orphaned timers act on evicted rooms** — trick/bot `setTimeout`s aren't cancelled on eviction/reset → double bot loops, `UNIQUE(seq)` throws in un-caught timers, state divergence. Add `GameRoom.dispose()` + a disposed/generation guard. | 02 §4 |
| 7 | **Duplicated replay + seq logic** — `gameReplay.ts` and `getSanitizedStatesRange` are copy-pasted move-switches; seq is `MAX+1` at 6 call sites. Extract `foldMoves()` + `commitMove()`. | 01 §1, §2 |
| 8 | **No CI + no regression tests for the recurring bug class** — every past `fix:` (tie-breaker, decline, start-order) should get a replay-based test; add a CI running typecheck + tests + prettier. | 09 §2, §3 |
| 9 | **SQLite durability pragmas missing** — set WAL + busy_timeout + synchronous=NORMAL. Add index on `game_players(profile_id)`. `deleteProfile` will FK-throw. | 03 §1, §2, §3 |
| 10 | **No rate limiting anywhere** — profile create, `/select` oracle, invite-push spam, WS chat/join. Add per-IP + per-socket buckets. | 04 §4; 02 §14 |
| 11 | **`roomState` (1.2k) and avatar builder (4.3k) monoliths** — extract animation math, color math, feature-data-as-JSON; ~27% of the codebase is the avatar feature. | 06 §1; 07 §1 |
| 12 | **Client reconnect: flat 3s retry forever, no backoff** — self-inflicted thundering herd on restart; worsened by nginx 60s WS idle timeout. Add backoff+jitter; raise `proxy_read_timeout`. | 06 §2; 10 §8 |
| 13 | **CDN `<script>` from unpkg (no SRI) + Google Fonts** render-blocking and breaks offline/privacy. Self-host both; add a CSP. | 07 §2; 10 §1 |
| 14 | **No `.dockerignore`** — `.env`, local `*.db`, `.git`, `node_modules` sent to build context / possibly into image layers. Add one. | 10 §6 |
| 15 | **PWA silently force-activates new SW mid-game** (`skipWaiting`+`claim`) and caches every 200 unboundedly. Prompt-to-reload; scope the runtime cache. | 08 §1, §2 |

## 🟡 P2 — opportunistic
Grouped; see docs for detail.
- **Correctness:** phase-2 burn count vs escaped players (05 §1); tie-breaker
  slice math after redistribution (02 §7); `applyChance` missing replay assert
  (02 §9); NaN passes card-codec guard → delayed crash (05 §2).
- **Security/robustness:** game-membership authz on `GET /api/games/:id` &
  `create` invitees (04 §5); XFF trusted + unescaped into geolocation URL
  (04 §6); validate avatar colors (07 §4); whitelist push URLs to same-origin
  (08 §4).
- **Types:** kill `any` on DB DTOs and client `$state` (03 §5, 06 §5, 07 §7);
  strict `CardValue` type + `getValueNumeric` throw-on-unknown (05 §4, §5);
  type `ws` (02 §11).
- **Perf:** drop `MAX(seq)` per broadcast (11 §2); trim avatar/asset weight &
  the 3.7MB PNG off critical path (11 §5); `captureCardRects` reflow-per-
  message (11 §6); incremental chat maxId (11 §7).
- **Dedup:** three Fisher-Yates copies → shared generic `shuffle` (05 §6);
  `checkDropValidity`/`isPlayableGroup` (06 §3); `createGame` vs
  `shuffleAndOrderPlayers` seating (03 §10).
- **Infra:** healthchecks + mem limits (10 §2); `--frozen-lockfile` + delete
  stale per-package locks (10 §4, §5); nginx security headers + body cap
  (10 §1).

## 🔵 P3
Style/cleanup — see each doc's P3 section. Highlights: stale "proof-of-concept"
meta copy (07), mixed en/sv in user-facing logs (01), `waiting` status dead
code (01 §3), localStorage keys never GC'd (06 §7).

---

## ✅ What's good — preserve these

- **Event-sourced game persistence** (deck + move log + replay) — the core
  design; enables crash recovery, reconnect replay, and audit. (01, 03)
- **Single shared rules package** — no rule implemented twice across the
  client/server boundary. (05)
- **Deterministic integer card codec** with full round-trip test. (05)
- **`CardDragState`** — textbook pointer state machine; the model for
  splitting `roomState`. (06)
- **Room/lobby component decomposition** — small, prop-driven, single-brain
  state classes. (07)
- **Complete push pipeline** — subscribe → store → send → suppress-if-focused
  → click-to-focus, with dead-sub pruning. (08)
- **Real migration system** + idempotent, transactional result recording. (03)
- **Per-viewer broadcast cache** + reconnect replay protocol. (02)
- **Secrets hygiene** — nothing sensitive tracked; env-first with self-host
  fallback. (10)

---

## Suggested sequencing for the fix agents

1. **Security sprint:** P0 #1–#3, then P1 #10 (rate limit). Ship the WS-auth
   fix with a masking test (09 §5) so it can't regress.
2. **Correctness sprint:** P1 #5 + #6 + #7 together (they touch the same
   turn-order/replay core), each landing with a replay regression test
   (P1 #8). This retires the recurring bug class.
3. **Process:** stand up CI (P1 #8) *before* the refactors so they're
   guarded — arguably do this first of all.
4. **Perf/DX:** P1 #9 (DB), #11 (split monoliths), #12/#13 (client), #14/#15
   (infra/PWA) as independent follow-ups.

Every finding cites its file and line in the numbered docs; start there.
