# 10 — Infrastructure, Build & Dependencies

Files: `docker-compose.yml`, `nginx.conf`, `packages/*/Dockerfile`,
`.env.example`, `vite.config.ts`, `svelte.config.js`, `.gitignore`, lockfiles

## Secrets hygiene — ✅ verified clean

No secrets or databases are tracked: `git ls-files` shows no `*.db`, no
`jwt_secret.txt`, no `vapid_keys.json`, no `.env`. `.gitignore` correctly
covers `*.db`, `*.db-wal`/`-shm`/`-journal`, `.env*`, `vapid_keys.json`,
`*jwt_secret.txt`. Good.

## 🟠 P1

### 1. nginx passes no security headers and doesn't cap upload size
`nginx.conf` proxies `/api` and `/` but sets **no** response security headers
and **no** `client_max_body_size`. Missing:
- `client_max_body_size` — default 1MB; the avatar PUT allows 20KB config so
  fine today, but there's no explicit cap and no protection against large
  bodies to other routes.
- Security headers: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` (clickjacking),
  and a **Content-Security-Policy**. A CSP would also have forced the
  self-hosting of the unpkg/fonts scripts (07 §2) — right now nothing
  restricts script origins.
- No TLS config at all — assumes TLS terminates upstream. Document where
  (Cloudflare? another proxy?), because `secure` cookies and `wss://` depend
  on it, and `getIpLocation` reads `cf-connecting-ip` implying Cloudflare —
  make that explicit.

### 2. No healthchecks, no resource limits, no log rotation
`docker-compose.yml` has `restart: unless-stopped` (good) but:
- no `healthcheck` on server/web/gateway → `depends_on` only waits for
  container start, not readiness; a slow server start can 502 early requests.
- no `mem_limit`/`cpus` → a memory leak (e.g. the unbounded room/timer/cache
  growth in 02) can OOM the host.
- nginx logs to files inside the container with no rotation → disk fill over
  time. And it logs full access logs including the `?`-less API paths.

### 3. `JWT_SECRET` unset in compose default → silent per-container secret
`docker-compose.yml:9` passes `JWT_SECRET=${JWT_SECRET}` with no default and
`.env.example` ships it blank. If the operator doesn't set it, `jwt.ts`
generates one and writes `jwt_secret.txt` **into the container filesystem**
(not the `skitgubbe_db_data` volume — DATABASE_PATH is `/app/data` but the
secret is written next to it via `path.dirname(dbPath)` = `/app/data`, so
actually it IS on the volume — good). But: on `web` there's no volume, and if
any secret-writing code ran there it'd be ephemeral. Confirm the secret only
lives server-side (it does) and document that `JWT_SECRET` should be set
explicitly for reproducible sessions across rebuilds.

## 🟡 P2

4. **Stale per-package lockfiles** — `packages/server/bun.lock` and
   `packages/web/bun.lock` exist alongside the root `bun.lock`. In a Bun
   workspace only the root lock is authoritative; the per-package ones are
   stale/misleading and the Dockerfiles copy only the root `bun.lock`. Delete
   the two per-package locks.
5. **Dockerfiles `COPY ... bun.lock` but don't `--frozen-lockfile`** — `bun
   install` without `--frozen-lockfile` can silently resolve to newer
   versions at build time, so builds aren't reproducible. Add
   `--frozen-lockfile` to both.
6. **Server image runs from source, not built** — server `CMD` runs
   `bun run packages/server/src/index.ts` (TS directly, fine for Bun) but
   copies the whole `packages/server` including `tests/`, `README.md`, and
   the dev `skitgubbe.db` that's in the build context (unless dockerignored —
   there's **no `.dockerignore`**, so `node_modules`, `.git`, local `*.db`,
   and `.env` are all sent to the build daemon and potentially into layers).
   **Add a `.dockerignore`** (node_modules, .git, *.db, .env, .svelte-kit,
   build, docs) — this is a real leak risk (`.env` into an image layer) and
   bloats build context.
7. **`PUBLIC_ALLOW_DEV_SETTINGS` plumbed to both server and web** — good that
   it defaults false, but it gates destructive debug handlers (02 §8) with no
   host check. Treat "true in prod" as a footgun and add a startup warning.
8. **No `wss`/websocket timeout tuning in nginx** — default `proxy_read_
   timeout` is 60s; a quiet game socket (waiting for the other player) will
   be closed by nginx after 60s of no data, triggering the client's 3s
   reconnect loop (06 §2) repeatedly. Set `proxy_read_timeout`/`proxy_send_
   timeout` high (e.g. 3600s) on the `/api` location, or implement WS
   heartbeats/pings (none currently exist server-side).

## 🔵 P3

- Dependencies are current (Svelte 5.55, Kit 2.57, Vite 8, TS 6, Tailwind 4,
  Hono 4.12) — no obviously stale/vulnerable packages; runtime deps are
  minimal (hono, web-push, canvas-confetti). Low supply-chain surface. ✅
- `vite.config.ts` proxies `/api` with `ws:true` for dev — correct.
- No `.nvmrc`/engines pin, but Bun is the runtime and Dockerfiles pin
  `oven/bun:1` — acceptable; consider pinning a minor for reproducibility.
- `svelte.config.js` version `pollInterval: 300000` interacts with the PWA
  update strategy (08 §3).
- Consider a periodic SQLite backup/`litestream` sidecar — the whole game
  history lives in one file on one volume with no backup story.

## ✅ Good

- Clean multi-stage web Dockerfile (builder → slim runner) copying only
  `build/` + needed modules.
- Workspace-aware layer caching (copy package.jsons, install, then copy
  source) in both Dockerfiles — correct Docker practice.
- `restart: unless-stopped` on all services; named volume for DB persistence.
- Single nginx gateway cleanly splits `/api` (Hono) from `/` (SvelteKit) and
  correctly forwards WS upgrade headers + `X-Forwarded-*`.
- gzip enabled for text responses.
- Env-driven config with sensible defaults and a documented `.env.example`.
