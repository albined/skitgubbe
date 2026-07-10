# 09 — Testing & CI

## Current state

- **Server tests** (`packages/server/tests/`): `gameCreation`, `gameReplay`,
  `playerShuffle`, `titles` — 15 tests, all passing. Focus on the replay
  engine + title/stat calculation, which is exactly the right place to
  concentrate (the event-sourcing core).
- **Shared tests** (`packages/shared/tests/`): `rules`, `cardCodec` — solid
  coverage of `isValidPlay` cases and full 52-card codec round-trip.
- **Web tests** (`packages/web/tests/lobbyState.test.ts`, 353 loc): exists
  and looks substantial.

## 🔴 P0 (process)

### 1. The web test suite never runs
Root `package.json` `test` = `test:server` only. `packages/web` has **no
`test` script at all**, so `lobbyState.test.ts` is dead weight — it's not
executed by `bun run test`, and there's no `bun test`-in-web wiring. Someone
wrote 353 lines of tests that provide **zero** regression protection. Either
add a web test runner (`vitest` is the SvelteKit default) + a `test:web`
script and include it in root `test`, or the suite will rot. Also: the shared
package's tests — confirm they're picked up (they run because `bun test`
globs, but `test:server` filters to server; verify `packages/shared` tests
actually execute in CI).

## 🟠 P1

### 2. No CI pipeline
No `.github/workflows`, no pre-commit hook. `bun run check` (typecheck) and
`bun run test` exist but nothing enforces them. Given the git log is full of
`fix:` commits for game-logic edge cases, a CI that runs typecheck + all
tests + `prettier --check` on every PR would have caught regressions before
merge. This is the highest-leverage process fix.

### 3. The recurring bug class has no regression tests
Git history shows repeated fixes around the same area — tie-breaker
resolution (a50bf76), player decline (6f61fb3), start order / legacy lobby
(ac542f8). These are exactly the edge cases flagged in **02 §5/§6/§7** and
**05 §1**. There is no test that:
- declines a player mid-phase-1 and asserts turn order stays valid,
- has a pending (never-accepted) invitee and asserts the game doesn't
  deadlock,
- runs a tie-breaker where a tied player leaves,
- triggers phase-2 burn when a player escaped mid-trick.
Each past fix should get a replay-based regression test (the replay engine
makes these cheap — construct a move list, assert final state).

## 🟡 P2

4. **No test exercises the WS layer or `GameRoom`** — all server tests hit
   `replayGame`/`apply*` directly. The orchestration (seq management,
   broadcast masking, timer scheduling, the impersonation surface in 02 §1)
   is untested. A test that drives `GameRoom` with fake sockets would cover
   the masking boundary (security-relevant) and the join/reconnect flow.
5. **No test for `getSanitizedStateForPlayerId` masking** — this is a
   security boundary (01 data-flow note). A test asserting "player A cannot
   see player B's hand values" would lock it down.
6. **Color/HSL math in the avatar builder is untested** because it's trapped
   in `.svelte` (07 §1). Extracting it (as recommended) makes it testable.
7. **`ipAndDevice.ts` parsing** (user-agent → device, private-IP detection)
   is pure and fiddly with many branches — ideal for table-driven tests,
   currently none.

## 🔵 P3

- Tests use hand-built `DbMove[]` fixtures inline; a small builder helper
  (`move('P', 'p1', [card])`) would cut boilerplate and make the regression
  tests in §3 pleasant to write.
- No coverage reporting configured; `bun test --coverage` is one flag.
- `titles.test.ts` mutates replayed state by hand to set up scenarios — works
  but couples tests to internal state shape; prefer driving via moves.

## ✅ Good

- The tests that exist target the **right** subsystem (replay determinism,
  rules, codec) — the parts where a bug corrupts persisted games.
- `gameReplay.test.ts` verifies exact deck counts and draw order using an
  unshuffled deck — precise, not hand-wavy.
- Shared codec test covers all 52 cards + empty cases.
- Tests run fast (~340ms) and use `:memory:` SQLite — no fixture DB needed.
