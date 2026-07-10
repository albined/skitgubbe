# Skitgubbe — Comprehensive Code & Tech-Stack Review (July 2026)

**Reviewer:** Claude (autonomous session, 2026-07-10)
**Branch:** `review/tech-debt-audit-2026-07`
**Scope:** entire monorepo at commit `4df7c66`

## Purpose

Deep-dive audit of the whole project: correctness, security, performance,
maintainability, testing, and infrastructure. Findings are documented in
numbered files in `docs/review/` so follow-up agents can use them as
scaffolding when fixing issues. **No fixes are applied in this branch — review
only.**

## The stack (as discovered)

- **Runtime / tooling:** Bun (workspaces monorepo), TypeScript 6
- **Server:** `packages/server` — Hono, Bun WebSockets, `bun:sqlite`, web-push
- **Shared:** `packages/shared` — game rules, types, card codec (pure TS)
- **Web:** `packages/web` — SvelteKit 2 + Svelte 5 (runes), Tailwind 4,
  adapter-node, PWA (service worker, manifest, push)
- **Infra:** docker-compose, per-package Dockerfiles, nginx reverse proxy
- **Size:** ~16k lines of TS/Svelte (excl. generated)

## Review plan (each step = one findings file)

1. **01-architecture.md** — repo layout, module boundaries, data flow
   (WS + REST), shared-package hygiene, dependency graph. What's clean, what's
   tangled.
2. **02-server-core.md** — `index.ts`, `rooms.ts`, `gameRoom.ts` (992 loc),
   `gameLogic.ts`: game-state machine correctness, WS lifecycle, race
   conditions, memory leaks (room cleanup, timers), error handling.
3. **03-server-data.md** — `db.ts`, `schema.ts`, `db-types.ts`,
   `gameReplay.ts`: SQLite usage (prepared statements, transactions, indexes,
   WAL), migration story, replay/event-sourcing design.
4. **04-server-api-security.md** — routes (`games`, `profiles`, `push`,
   `statistics`), `middleware/auth.ts`, `utils/jwt.ts`, `ipAndDevice.ts`,
   `gameValidation.ts`, `notifications.ts`/`vapid.ts`: authn/authz, input
   validation, rate limiting, secret handling, injection, IDOR, the
   "dual REST/WS entry point" fix (commit 99791f6) — is it complete?
5. **05-shared-rules.md** — `rules.ts`, `types.ts`, `cardCodec.ts`: rule
   correctness vs `skitgubbe_rules.md`, type safety, purity, test coverage.
6. **06-web-state.md** — `roomState.svelte.ts` (1216 loc!),
   `lobbyState.svelte.ts`, `cardDragState.svelte.ts`: reactivity patterns,
   WS reconnect logic, state-sync correctness, derived-state perf.
7. **07-web-ui.md** — routes & components: the 2201-line avatar page,
   `avatarFeatures.ts` (2096 loc), component decomposition, accessibility,
   animation perf, asset weight (static/ images, cards SVGs).
8. **08-pwa.md** — service worker, manifest, push flow end-to-end, caching
   strategy, offline behavior, notification lifecycle.
9. **09-testing.md** — what's tested (5 test files) vs what should be; test
   quality; missing CI.
10. **10-infra-deps.md** — Dockerfiles, docker-compose, nginx.conf, .env
    handling, dependency freshness/pinning, build reproducibility, deploy
    story.
11. **11-performance.md** — cross-cutting perf pass: server hot paths
    (broadcast fan-out, DB in request path), client bundle & render perf,
    asset loading, N+1 patterns.
12. **12-summary.md** — ranked findings (severity × effort), quick wins,
    long-term refactors, and "what's already good" (to preserve).

## What I'm checking for (checklist applied in every step)

- **Correctness:** state machines, edge cases (disconnects mid-turn, ties,
  empty deck), off-by-ones, unhandled promise rejections.
- **Security:** authz on every entry point (REST *and* WS), token lifetime,
  validation at trust boundaries, secrets, rate limits, CORS/CSP.
- **Performance:** synchronous DB in hot paths, broadcast cost, payload
  sizes, over-rendering, image/bundle weight, memory growth.
- **Maintainability:** file size & cohesion, duplication (esp. server/client
  rule logic), typing rigor (`any`, casts), naming, dead code, comment rot.
- **Resilience:** reconnect, idempotency, timer cleanup, graceful shutdown,
  data durability (SQLite settings, backups).
- **Testing & tooling:** coverage of core rules, regression tests for past
  fixes (see git log), lint/format/CI gaps.

## Severity scale

- 🔴 **P0** — bug or vulnerability with user-visible/exploitable impact
- 🟠 **P1** — significant debt/risk; fix soon
- 🟡 **P2** — worth fixing opportunistically
- 🔵 **P3** — nice-to-have / style
- ✅ **Good** — deliberately called out as good design worth preserving

## Working method

Read every source file (not skim), cross-reference rules doc + git history,
run typecheck/tests to verify claims, commit docs after each step.
