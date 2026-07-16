---
name: verify
description: Build, launch and drive the Skitgubbe app end-to-end (two-player game room in headless chromium) to verify changes at the real UI surface.
---

# Verifying Skitgubbe changes

## Launch

```bash
bun run dev > /tmp/dev.log 2>&1 &   # server :3000 + vite web :5173, wait ~6s
```

**Gotcha: SSR is broken in dev** — `@dotlottie/player-component` throws
`window is not defined` when node evaluates `+layout.svelte`, so every page
500s. Temporary workaround for verification only (remove afterwards, do NOT
commit):

```bash
printf 'export const ssr = false;\n' > packages/web/src/routes/+layout.ts
```

The room UI is fully client-driven (WebSocket), so CSR-only is representative.

## Drive (headless chromium via playwright-core)

Playwright's chromium lives in `~/.cache/ms-playwright`. In a scratch dir:
`npm i playwright-core`, launch with `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`.

Two-player game setup, all via in-page `fetch` (cookies land in the browser
context automatically):

1. Per player: new browser context → goto `http://localhost:5173/` →
   `POST /api/profiles {name, color}` → `POST /api/profiles/:id/select`.
2. Player A: `POST /api/games/create {name, invitedProfileIds:[bId]}` → `{roomId}`.
3. Player B: `POST /api/games/:roomId/accept`.
4. Both goto `/room/:roomId` — the game auto-starts and deals.

## Useful hooks in the room UI

- Card FLIP/fly animations add class `.transitioning`; a played card gets
  `.playing-fly-up`. Poll these to catch flights.
- Hand cards: `.hand-card`; double-click a playable card plays it.
- Debug tools (needs `PUBLIC_ALLOW_DEV_SETTINGS=true`, set in `.env`):
  opener is `button[aria-label="Toggle debug menu"]`, then buttons
  "Autoplay Turn", "God Mode (Play Anytime)", "Skip to Phase 2",
  "Force Skitgubbe Loss", "Reset Game".
- Enable "Autoplay Turn" for both players and the game plays itself to the
  Skitgubbe endgame in ~2–3 min; watch for "Invalid play" toasts (a server
  rejection means a client play-finder bug).
- Beware text matching: the debug menu contains the literal text
  "Skip to Phase 2", so don't grep the page for "Phase 2" to detect phase.
- UI copy is Swedish: deck shows "DRAG n kvar", discard "SLÄNG n kort",
  chance button "CHANSA".
