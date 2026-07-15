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

## ⚠️ Owner clarifications (2026-07-13) — re-grades several findings

1. **Deployment context:** self-hosted, LAN-only, never internet-exposed.
   Trust is honor-based *by design*; the sign-in log is the accountability
   mechanism. → Old P0 #2 (unauthenticated profiles) is **accepted by
   design**; old P0 #1 (WS identity) drops to P1 — still the top security
   fix because WS impersonation *bypasses the sign-in log*, defeating the
   honor model's own trace. Rate limiting (old P1 #10) drops to P3.
2. **Invite flow is intentional:** invitees join the rotation immediately;
   when the turn reaches a pending invitee **the game waits for them to
   accept** (they're then dealt 3 cards, still their turn) **or
   decline/be removed** (rotation moves on). Old P1 #5 ("pending-invitee
   turn stall") described this working-as-intended behavior as a deadlock —
   **reclassified**, see 02 §6. Residual: one unverified empty-deck-accept
   edge + the still-real tie-breaker-decline cleanup (02 §7).
3. **Bots:** owner believed bot functionality was fully removed. Mostly
   true (no way to create one), **except leave-mid-game → bot takeover is
   live** (gameLogic.ts:212 + botPlayer.ts + 🤖 badge in PlayersRow).
   **Open decision needed:** keep the feature or remove it and pick a new
   leave-mid-game behavior. See 02 header note.
4. **Lobby-era code is confirmed legacy:** the old lobby → everyone-accepts
   → start flow is gone; games are created directly in `playing`. 01 §3's
   `waiting`-status cleanup recommendation is confirmed — finish it, and
   write the *current* invite flow down as real docs (see `docs/game-flow.md`).

## 🔴 P0 — do first

| # | Finding | Where | Doc |
|---|---------|-------|-----|
| 1 | ~~WS identity is client-asserted~~ **→ moved to P1** (LAN-only re-grade; see clarification 1). Fix direction unchanged: verify the session JWT at WS upgrade; derive playerId from it; ignore client-sent id. | `index.ts`, `gameRoom.handleJoin` | 02 §1, 04 §3 |
| 2 | ~~Profile system is fully unauthenticated~~ **→ accepted by design** (clarification 1). The "decide consciously & document" action item is now done. | `routes/profiles.ts` | 04 §1, §2 |
| 3 | **Diagnostic logging dumps session cookies** — WS handshake logs all headers incl. `Cookie` (the JWT). Remove. (Still P0: trivial, explicitly temporary, no reason to keep.) | `index.ts:31-34` | 02 §3 |
| 4 | **Documented `bun run test` skips 22 of 37 tests** — it runs server-only (15 tests); the web + shared suites (incl. 353-loc `lobbyState.test.ts`) run only under a bare `bun test`. CI wired to the npm script gets false confidence. Point root `test` at `bun test` (or compose per-package scripts). | `package.json` | 09 §1 |

## 🟠 P1 — soon

| # | Finding | Doc |
|---|---------|-----|
| 5 | ~~Pending-invitee turn stall~~ **→ RECLASSIFIED: intended behavior** (clarification 2). The game deliberately waits on a pending invitee until they accept (dealt 3, plays) or decline (removed). Do **not** skip non-accepted players in rotation. Remaining actions: probe-test the empty-deck-accept edge; fix tie-breaker cleanup on decline (02 §7); encode the invite lifecycle in docs + replay regression tests. The `progressPhase1Turn` `while(isDone)` guard remains a P2 defensive gap (02 §5). | 02 §5, §6, §7 |
| 6 | **Orphaned timers act on evicted rooms** — trick/bot `setTimeout`s aren't cancelled on eviction/reset → double bot loops, `UNIQUE(seq)` throws in un-caught timers, state divergence. Add `GameRoom.dispose()` + a disposed/generation guard. | 02 §4 |
| 7 | **Duplicated replay + seq logic** — `gameReplay.ts` and `getSanitizedStatesRange` are copy-pasted move-switches; seq is `MAX+1` at 6 call sites. Extract `foldMoves()` + `commitMove()`. | 01 §1, §2 |
| 8 | **No CI + no regression tests for the recurring bug class** — every past `fix:` (tie-breaker, decline, start-order) should get a replay-based test; add a CI running typecheck + tests + prettier. | 09 §2, §3 |
| 9 | **SQLite durability pragmas missing** — set WAL + busy_timeout + synchronous=NORMAL. Add index on `game_players(profile_id)`. `deleteProfile` will FK-throw. | 03 §1, §2, §3 |
| 10 | ~~No rate limiting anywhere~~ **→ downgraded to P3** (LAN-only, trusted users; clarification 1). | 04 §4; 02 §14 |
| 11 | **`roomState` (1.2k) and avatar builder (4.3k) monoliths** — extract animation math, color math, feature-data-as-JSON; ~27% of the codebase is the avatar feature. | 06 §1; 07 §1 |
| 12 | **Client reconnect: flat 3s retry forever, no backoff** — self-inflicted thundering herd on restart; worsened by nginx 60s WS idle timeout. Add backoff+jitter; raise `proxy_read_timeout`. | 06 §2; 10 §8 |
| 13 | **CDN `<script>` from unpkg + Google Fonts** — the LAN-only clarification makes this *more* important, not less: a self-hosted app on a network without (or with flaky) internet breaks on these external fetches. Self-host both. (SRI/CSP angle downgraded.) | 07 §2; 10 §1 |
| 14 | **No `.dockerignore`** — `.env`, local `*.db`, `.git`, `node_modules` sent to build context / possibly into image layers. Add one. | 10 §6 |
| 15 | **PWA silently force-activates new SW mid-game** (`skipWaiting`+`claim`) and caches every 200 unboundedly. Prompt-to-reload; scope the runtime cache. | 08 §1, §2 |

## 🟡 P2 — opportunistic
Grouped; see docs for detail.
- **Correctness:** tie-breaker slice math after redistribution (02 §7);
  `applyChance` missing replay assert (02 §9); NaN passes card-codec guard →
  delayed crash (05 §1). (The phase-2 burn-vs-escape concern was **probe-
  tested and disproved** — now a P2 maintainability smell, 05 §2a.)
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

1. **Security (shrunk by re-grade):** P0 #3 (remove cookie logging — one
   line), then the WS-auth fix (now P1) with a masking test (09 §5) so it
   can't regress. Rate limiting dropped.
2. **Correctness sprint:** P1 #6 + #7 together plus the *residuals* of #5
   (empty-deck-accept probe, tie-breaker-decline cleanup), each landing with
   a replay regression test (P1 #8). Fold in the two owner decisions first:
   bot-takeover keep/remove and finishing the `waiting`-status legacy
   cleanup (01 §3) — both shrink the surface the fixes touch.
3. **Process:** stand up CI (P1 #8) *before* the refactors so they're
   guarded — arguably do this first of all.
4. **Perf/DX:** P1 #9 (DB), #11 (split monoliths), #12/#13 (client), #14/#15
   (infra/PWA) as independent follow-ups.

Every finding cites its file and line in the numbered docs; start there.
