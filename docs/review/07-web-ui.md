# 07 — Web UI: routes, components, avatar builder

Files: `routes/{+page,+layout,avatar,room}`, `lib/components/**`,
`lib/Avatar.svelte`, `lib/avatarFeatures.ts`

## Component decomposition — mostly excellent, one monolith

The **room** view is well decomposed: `[roomId]/+page.svelte` (437 loc) is a
thin composition root wiring `RoomState`/`CardDragState` into focused
components (`Sidebar`, `PlayersRow`, `TablePile`, `PlayerHand`,
`EndGameOverlay`, `GameLogPanel`, `GameChatPanel`, `DebugMenu`). The **lobby**
is likewise split into `lobby/*` modal components. This is good Svelte
architecture — keep it as the pattern.

The outlier is the **avatar builder**.

## 🟠 P1

### 1. `avatar/+page.svelte` (2201 loc) + `avatarFeatures.ts` (2096 loc)
Nearly 4300 lines — 27% of the entire codebase — in the avatar feature. The
page mixes: HSL/hex color math, a history/undo stack (JSON.stringify diffing),
drag-and-drop feature placement, wheel/pointer gesture handling, canvas
rendering, and persistence. `avatarFeatures.ts` is 2096 lines of inline SVG
path strings in a data structure.

- The SVG template data (`avatarFeatures.ts`) is *data*, not code — it could
  be JSON (or many small files) loaded/tree-split, cutting the TS bundle and
  letting the builder code be read without scrolling past thousands of path
  strings.
- The page should split into: `colorMath.ts` (hex/HSL/snap helpers, all
  pure, all testable), a `featureHistory` store (undo/redo), and the
  DnD/gesture controller — mirroring how `CardDragState` was extracted from
  the room. Right now none of the color math is unit-tested (see 09) because
  it's trapped in a `.svelte` file.

This is the single largest maintainability liability in the repo by volume.
It isn't *buggy* — it's just an unreviewable size for one feature.

### 2. Third-party scripts break the offline/PWA and privacy story
`app.html` loads two external origins directly in `<head>`:
- Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) — render-
  blocking stylesheet + font fetches on every cold load; also a privacy/GDPR
  consideration for an EU (Swedish) audience.
- **`unpkg.com/@dotlottie/player-component@2.7.12`** — a **synchronous,
  render-blocking `<script>` from a CDN with no SRI hash and a floating
  availability dependency.** If unpkg is slow/down, first paint blocks; if
  unpkg is compromised, it's arbitrary JS on your origin (session cookie is
  httpOnly so not directly stealable, but it can drive the authenticated
  session). The service worker also can't cache cross-origin opaque responses
  here, so this defeats offline for the one blocking resource. **Self-host
  both** (fonts via `@fontsource`, the lottie player as a dep) — removes the
  CDN trust, the SRI gap, and the offline hole in one move.

## 🟡 P2

3. **`{@html namespaceSvgGradients(...)}` is safe *today* but fragile** —
   verified: the `svgContent` passed to `{@html}` always comes from the
   trusted `AVATAR_FEATURES` constant (looked up by `templateId`); user
   config only supplies `templateId` + numbers + hex colors. So no stored
   XSS. **Guard this invariant:** add a comment at each `{@html}` site and
   never interpolate `parsedConfig`-derived strings into rendered SVG. If a
   future "custom SVG" feature is added, this becomes an XSS hole instantly.
4. **Avatar colors flow into inline `style` unescaped** — `bgColor`,
   `skinColor` etc. from parsed config go into `style="background-color:
   {bgColor}"` (Avatar.svelte:88, and CSS custom props line 95). Svelte
   escapes the attribute so you can't break out of it, but a value like
   `red; --x:url(...)` is stored verbatim. Validate config colors are
   `#[0-9a-f]{6}` on load (belt-and-suspenders; the 20KB cap is the only
   current check).
5. **`Math.random()` gradient namespace** (Avatar.svelte:83) — used to
   uniquify `_grad_` ids across multiple avatars on one page. Collisions are
   improbable but non-zero and would cross-apply gradients between avatars.
   Use a monotonic counter or `crypto.randomUUID()`.
6. **`viewport user-scalable=no`** (app.html:7) — disables pinch-zoom; an
   accessibility regression (WCAG 1.4.4). Deliberate for a game, but note it.
7. **`any`-typed `$state` throughout `.svelte` files** — `activeProfile`,
   feature objects, drag payloads. Same DTO-typing gap as 06 §5.

## 🔵 P3

- `app.html` `<title>`/description call the app a "proof-of-concept... built
  with Svelte 5" — stale marketing copy shipped to prod `<head>` (SEO/meta).
- `handleError` hook returns a generic message and logs server-side — correct
  (no stack leak to client). ✅
- Manifest `orientation: landscape` + `display: fullscreen` — good for the
  game, but the avatar builder and lobby also inherit fullscreen landscape;
  confirm those are usable that way on phones.
- Manifest description "Det bästa spelet" vs app.html English description —
  inconsistent tone/lang.
- Numerous components re-derive `cardWidth`-style layout math from
  `roomState`; fine, it's centralized in `RoomState`'s `$derived`.

## ✅ Good

- Room and lobby component decomposition is genuinely good — small, focused,
  prop-driven components with the state classes as the single brain.
- `Avatar.svelte` gracefully falls back to initials + color when config is
  missing/unparseable (try/catch in `parsedConfig`).
- FLIP animations, confetti, end-game cinematics — the "high fidelity" goal
  is met; the polish is real and consistent.
- `data-sveltekit-preload-data="hover"` for snappy nav.
- Feature category z-ordering (`CATEGORY_ORDER`) centralizes avatar layering
  cleanly.
