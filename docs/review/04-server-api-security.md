# 04 — API & Security: routes, auth, notifications

Files: `routes/{games,profiles,push,statistics}.ts`, `middleware/auth.ts`,
`utils/{jwt,gameValidation,ipAndDevice}.ts`, `notifications.ts`, `vapid.ts`

## Threat-model preface

> **Corrected per owner clarification (2026-07-13).** The original preface
> assumed the app is internet-deployed. It is not: this is a **self-hosted,
> LAN-only app that is never exposed to the internet**. The trust model is
> deliberate and honor-based — the "Netflix profile picker" with no passwords
> is a conscious design choice, and the **sign-in log is the accountability
> mechanism**: profile takeover is possible but leaves a trace. There is no
> "curious stranger who finds the URL" in the threat model.
>
> Consequences for the findings below:
> - **§1 and §2 are accepted by design**, downgraded from P0. The public
>   profile list and secretless `/select` *are* the product. No action needed
>   beyond this documentation (which this note now provides).
> - **§3 (WS identity) is downgraded P0 → P1** but stays worth fixing for a
>   reason internal to the honor model itself: WS impersonation bypasses the
>   sign-in log entirely (no `/select`, no log entry), so it defeats the one
>   trace the honor system relies on. Fixing it makes "cheating leaves a
>   trace" actually true.
> - **§4 (rate limiting) is downgraded to P3** — DoS/enumeration by trusted
>   family members on a LAN is out of scope.
> - **§6 (geolocation of XFF)** drops in practice too: on a LAN most logins
>   are private IPs and `isPrivateIp` already skips the fetch. The
>   `encodeURIComponent` fix is still one line of cheap hygiene.
> - General input validation, the cookie-logging leak (02 §3), and secrets
>   hygiene remain good practice regardless of exposure and are unaffected.

## 🔴 P0 → ✅ accepted by design (see preface)

### 1. Any authenticated user can read/impersonate any profile — no ownership check on IDs
**Status: accepted by design (owner, 2026-07-13).** Honor-based trust model
for a LAN-only deployment; the sign-in log is the accountability mechanism.
Kept below for the record.
The whole auth model is "possession of a `skitgubbe_session` cookie = you are
`profileId`." But `profileId`s are **not secret**: `GET /api/profiles`
(profiles.ts:12) returns **every profile** (id, name, color, and
`avatar_config`) with **no auth at all**. Combined with:

- `POST /api/profiles/:id/select` (profiles.ts:41) issues a valid 30-day
  session for **any id with no secret/password** → full account takeover of
  every profile by design. Anyone who loads the site can `select` anyone.
- `GET /api/statistics/:profileId` (statistics.ts:26) returns another
  player's full stats breakdown — authenticated as anyone.

So the "login" is decorative: the cookie authenticates *a* profile, and you
can mint a cookie for *any* profile freely. For a family app this may be
acceptable, **but it must be a conscious decision** — document it, and at
minimum stop leaking `avatar_config`/ids to unauthenticated callers if any
privacy is intended. If real per-user privacy is ever wanted, this is the
foundation that has to change first (a claim code / device-bound token).

### 2. `select` sets a session for arbitrary ids without rate limiting
**Status: accepted by design (owner, 2026-07-13)** — same rationale as §1.
Because `/select` is unauthenticated and unthrottled, it doubles as an
oracle: iterate ids, mint sessions, enumerate. Pair with §1's public listing
and there's nothing to enumerate — but any future "private profile" is
instantly defeated. At least require the request to originate from the same
device that created the profile, or gate behind a short claim code.

## 🟠 P1

### 3. WebSocket endpoints bypass `authMiddleware` entirely
**Re-graded under the LAN threat model:** still the highest-value security
fix, not because of external attackers, but because WS impersonation is the
one way to act as another profile *without leaving a sign-in-log trace* —
it undermines the honor model's own audit trail.
(Cross-ref 02 §1 — the impersonation bug.) All REST routes use
`authMiddleware`, but `/api/room/:roomId/ws` (index.ts) never verifies the
cookie; identity comes from the client-sent `join.playerId`. The REST/WS
parity fix (99791f6) covered game *actions* routed through REST but not the
WS handshake identity. **Verify the JWT at upgrade and derive playerId from
it.** This is the highest-value single fix in the codebase.

### 4. No rate limiting anywhere
**Downgraded P1 → P3 (LAN-only, trusted users; see preface).**
No middleware limits request rate on any route. Exposed amplifiers:
- `/api/profiles` (create) — unauthenticated `POST /` makes unlimited
  profiles (DB growth, name spam).
- `/select` — session-minting oracle (§2).
- `/:roomId/accept`, `/create` — each `create` sends push notifications to
  invitees (notifications.ts) → unauthenticated-ish push spam / email-to-push
  abuse vector.
- WS `chat` (02 §14) and `join`.
A single lightweight per-IP token bucket in Hono middleware would cover the
REST surface; the WS surface needs per-socket limits.

### 5. Authorization gaps on game membership
- `GET /api/games/:roomId` (games.ts:83) returns full game + **all players**
  (names, colors, avatars, roles, invite status) to **any authenticated
  user**, member or not. Room ids are guessable (6 lowercase alnum). Add a
  "requester is a game_player" check.
- `create` accepts arbitrary `invitedProfileIds` (games.ts:61) with no check
  that they exist or that the host may invite them → can inject nonexistent
  ids into a game and fire push notifications at any profileId.

### 6. IP geolocation calls an untrusted third party with user-controlled input on login
`getIpLocation` (ipAndDevice.ts:28) fetches
`https://freeipapi.com/api/json/${firstIp}` where `firstIp` comes from the
`x-forwarded-for` header (profiles.ts:67). The 2s timeout is good, but:
- `firstIp` is interpolated into a URL unescaped — a crafted XFF like
  `1.1.1.1/../../admin` alters the request path (SSRF-ish against freeipapi,
  low impact but sloppy). `encodeURIComponent` it.
- Every login blocks on / depends on a free external service; if it starts
  returning attacker-influenced data it's stored and shown as "login
  location." Validate the IP shape before the fetch (you already have
  `isPrivateIp`'s parser — reuse it to reject non-IP strings).

## 🟡 P2

7. **JWT `HS256` secret auto-generated & written to `jwt_secret.txt`** if env
   unset (jwt.ts:31). Good fallback for self-host, but: (a) evaluated once at
   module load, so the fallback file is created on first import even in odd
   contexts; (b) if two server instances ever share a volume they're fine,
   but if they *don't* share it, sessions break across instances. Document
   that `JWT_SECRET` must be set for any multi-instance deploy.
8. **No CSRF protection** — session is a `SameSite=Lax` cookie, and
   mutations are `POST`/`PUT` with JSON bodies. Lax + JSON content-type gives
   decent CSRF resistance, but `/select` (state-changing, unauthenticated)
   and any future top-level-navigation POST could be abused. Consider
   `SameSite=Strict` for the session cookie or an explicit CSRF token.
9. **`secure` cookie only in production via `NODE_ENV`** (profiles.ts:59) —
   correct, but the whole app is served behind nginx; ensure `NODE_ENV`
   actually reaches the server container (see 10 — docker-compose env).
10. **Error responses leak intent inconsistently** — some routes return
    `400` for "invalid payload OR failed to create" (games.ts:78), conflating
    client and server errors. Minor, but muddies monitoring.
11. **`isValidEndpoint` allows any https origin** (push.ts:14) — correct for
    web-push (endpoints are provider-controlled), but there's no cap on
    subscriptions per profile; `INSERT OR REPLACE` keys on (profile_id,
    endpoint) so it's bounded by distinct endpoints, acceptable. Note only.
12. **`generateProfileId` / room id use `Math.random`** — fine for
    non-secret ids, but they *are* effectively used as access tokens for
    rooms (§5). If room membership becomes access-controlled this weak
    randomness stops mattering; until then it's a contributing factor to §5.

## 🔵 P3

- `authMiddleware` casts `payload.profileId as string` with no shape check;
  a token signed with a `profileId`-less payload sets `undefined`. Validate.
- `validateAccept`/`validateDeclineOrLeave` re-query the game the caller
  already has in some paths — minor double reads.
- `notifications.ts sendPushNotification(payload: any)` — type the payload.
- freeipapi over https with no API key — subject to their rate limits; a
  burst of logins could get the server IP throttled. Cache by IP.

## ✅ Good

- Every REST data route except the intentional public ones uses
  `authMiddleware` — consistent and readable.
- Push subscription payload validation (`isValidEndpoint` + key type checks,
  push.ts:29) is thorough, and 410/404 responses prune dead subscriptions
  (notifications.ts:25). This is a well-built push pipeline.
- Avatar payload size cap (20 KB, profiles.ts:146) prevents blob-stuffing.
- Chat length caps (200 msg / 20 emote, gameRoom.ts:543) exist.
- Secrets (`jwt_secret.txt`, `vapid_keys.json`, `.env`, `*.db`) are
  gitignored; env-first with persistent-file fallback is a sensible
  self-host story.
- JWT verify is wrapped in try/catch returning 401 — no stack leaks.
