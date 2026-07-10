# 08 — PWA: service worker, manifest, push pipeline

Files: `service-worker.ts`, `manifest.webmanifest`, `app.html`,
push flow across `lobbyState`, `push.ts`, `notifications.ts`

## Overall

This is a **well-built PWA** — the push pipeline end-to-end (subscribe →
store → send-on-turn → suppress-if-focused → click-to-focus/navigate) is
complete and thoughtfully handles the awkward cases. Findings are refinements,
not rewrites.

## 🟠 P1

### 1. Network-first caching can serve stale/opaque responses and grows unbounded
`service-worker.ts:66-72` caches **every** successful GET (`status === 200`)
into `CACHE_NAME`, including arbitrary navigations and any same-origin file.
- The cache is only pruned on version change (activate deletes old caches),
  so within one version it grows without bound as users hit new URLs.
- `cache.put(event.request, response.clone())` stores whatever came back;
  if the SvelteKit node server ever returns a 200 with a transient/erroneous
  body it becomes the offline fallback until the next deploy.
Scope the runtime cache to known static paths (or a size/entry cap), and
don't cache HTML navigations beyond the `/` app shell you already special-case.

### 2. `skipWaiting()` + `clients.claim()` can swap assets under a live game
The SW force-activates immediately on install (line 18) and claims all clients
(line 38). A user mid-game gets a new SW controlling their page instantly;
combined with cache-first immutable assets keyed by `version`, a deploy during
an active game can produce a client running new JS against a state shape it
didn't load with. For a realtime game, prefer prompting "update available →
reload" rather than silent immediate takeover, or at least gate `skipWaiting`
so it doesn't apply while a room socket is open.

## 🟡 P2

3. **Version polling every 5 min** (`svelte.config.js` `pollInterval:
   300000`) drives SvelteKit's update detection; combined with §2's silent
   takeover this means an active player can be interrupted every 5 minutes
   after a deploy. Align this with the update-prompt strategy.
4. **Push payload trusts server `url` into `openWindow`/`navigate`**
   (service-worker.ts:120, 142) — the URL comes from your own server
   (`/room/${roomId}` etc.), so not user-controlled today. But
   `notificationclick` does `new URL(targetPath, origin)` and navigates; if a
   push `url` ever became attacker-influenced (e.g. an "invite from X" with a
   crafted field) it's an open-redirect-in-app. Whitelist to same-origin
   pathnames (it already resolves against `self.location.origin`, so enforce
   `.origin === self.location.origin` before navigating).
5. **No `updated_at`/re-subscribe refresh for push subscriptions** — browsers
   rotate endpoints; the client re-syncs via the `push_synced:*` localStorage
   guard, but if that key exists and the endpoint silently changed, the stale
   sub lingers until a 410 prunes it. Acceptable, but a periodic
   `pushsubscriptionchange` handler in the SW would be the robust fix (not
   currently handled).

## 🔵 P3

- `shouldSuppressNotification` compares `client.focused && pathname === url` —
  good, but only suppresses exact-path matches; a turn notification while
  you're on `/` (lobby) still shows, which is probably intended.
- Icons/badges are all present and correctly sized in the manifest ✅.
- SW is TypeScript with `/// <reference lib="webworker" />` but uses `any`
  for every event — Bun/SvelteKit ship SW types; tightening them would catch
  the `(self as any)` casts.
- `caches.open(CACHE_NAME)` is called on **every** fetch (line 56) — cheap but
  redundant; open once.
- Manifest `display: fullscreen` means no browser UI — users can't see the
  URL/refresh; make sure the in-app update path (§2) exists because they
  can't manually reload easily.

## ✅ Good

- Cache-first for hashed build assets, network-first for mutable — the
  correct split, and offline navigation falls back to the `/` app shell.
- Push suppression when the target page is already focused — a genuinely
  nice touch most apps skip.
- `notificationclick` focus-existing-then-navigate-then-open cascade is the
  correct three-tier UX.
- Dead-subscription pruning on 410/404 (notifications.ts) closes the loop.
- Notification permission requested only on explicit user toggle
  (lobbyState.toggleNotifications), not on load — correct consent UX.
