# Skitgubbe — Tech-Debt & Code Review (2026-07-10)

A comprehensive, from-scratch review of the whole monorepo. **Review only —
no source changes.** Findings are scaffolding for follow-up fix agents; every
one cites file + line.

**Start with [`12-summary.md`](12-summary.md)** — ranked findings + suggested
fix sequencing. Then dive into the numbered docs for detail.

| Doc | Area |
|-----|------|
| [00-plan](00-plan.md) | Method, scope, severity scale |
| [01-architecture](01-architecture.md) | Stack, module boundaries, data flow |
| [02-server-core](02-server-core.md) | GameRoom, gameLogic, bots, WS lifecycle |
| [03-server-data](03-server-data.md) | SQLite, schema, migrations, replay |
| [04-server-api-security](04-server-api-security.md) | Routes, auth, threat model |
| [05-shared-rules](05-shared-rules.md) | Rules vs spec, types, card codec |
| [06-web-state](06-web-state.md) | roomState / cardDragState / lobbyState |
| [07-web-ui](07-web-ui.md) | Routes, components, avatar builder |
| [08-pwa](08-pwa.md) | Service worker, manifest, push |
| [09-testing](09-testing.md) | Coverage, CI gaps |
| [10-infra-deps](10-infra-deps.md) | Docker, nginx, deps, secrets |
| [11-performance](11-performance.md) | Cross-cutting perf |
| [12-summary](12-summary.md) | **Ranked findings + sequencing** |

**Severity:** 🔴 P0 (exploitable/user-visible) · 🟠 P1 (fix soon) ·
🟡 P2 (opportunistic) · 🔵 P3 (style) · ✅ Good (preserve).

Tests pass (15/15 server) and typecheck is clean as of this review.
