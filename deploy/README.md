# deploy/

Real production-deployment tooling for the VACO ecosystem's 34 Express
backends + 2 Vite frontends, plus nginx and the LiveKit SFU — 38
Compose services and 28 named volumes. (`venvs-mock-backend` is the
one server in the repo that is deliberately *not* deployed: the apps
were cut over to standalone V3 and Shield, and it stays for local
development only.) Every file here is *generated* from the
same authoritative app/path/port manifest `start-ecosystem.sh` already
uses for local dev — there's exactly one source of truth for "what
apps exist, at what path, on what port," not four drifting copies.
Two real deployment paths exist side by side: pm2 + nginx directly on
a VPS (original, below), and Docker Compose (new — see "Docker
Compose deployment" below, the one this session's own recommendation
is built around).

## Docker Compose deployment (recommended)

**Why Docker over Render for this specific project**: Render bills and
manages *per service*, and this ecosystem is genuinely ~30 independent
services — that's an awkward, expensive shape for a platform built
around a handful of services per app. Docker Compose runs the whole
thing as one real, portable unit on a single host (a VPS, a bare-metal
box, any cloud VM) — the natural continuation of the pm2 + nginx setup
this repo already has, not a competing approach. **Render stays a real
option later**: every service here builds from a real, standard
Dockerfile, and Render's own "Deploy an existing Dockerfile" service
type can point at any of them individually if you eventually want
specific apps on managed infrastructure — nothing here locks that door.

```
cp .env.example .env                                  # 1
node scripts/generate-service-tokens.mjs >> .env      # 2
$EDITOR .env                                          # 3  set ANTHROPIC_API_KEY
node deploy/generate-docker-compose.js                # 4
node deploy/generate-nginx-conf.js --docker           # 5
docker compose up --build                             # 6
```

**Step 2 is not optional and the order matters.** `.env.example`
ships the service-token block with every value *empty*, which is
correct for an example and fatal for a run: `shared/serviceAuth.js`
throws on `chopz:` with no token rather than silently dropping that
caller from the allowlist, so skipping step 2 does not produce a
degraded system — it produces every guarded service crash-looping at
startup with a parse error. The generator writes real 32-byte tokens
for all 27 callers, in both forms the ecosystem needs (the
`VACO_SERVICE_TOKENS` allowlist that receiving services hold, and the
`VACO_TOKEN_<APP>` value each calling service presents). Appending it
after the copy means the generated block wins over the empty one.

Two more the quickstart does *not* set, both deliberate:

- **`VACO_SERVICE_AUTH_MODE`** is unset, and unset means `enforce`.
  That is the intended deployment posture. `observe` exists to debug a
  401 by letting the call through and recording the caller; it is a
  step backwards you take on purpose, not a state to launch in.
- **`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`** stay empty unless you
  want real audio. `vaco-media` asserts its transport unusable at boot
  rather than pretending, so an unconfigured media plane is a clear
  refusal instead of calls that ring and carry nothing.

Front door: `http://localhost/` (nginx → vaco-shell). Every app is
also reachable directly, bypassing nginx, at its own real port
(`http://localhost:8811/api/health` for V3, etc.) — the exact same
ports `start-ecosystem.sh` uses locally, so nothing about "which port
is which app" needs relearning.

- **`Dockerfile.node`** — one shared Dockerfile for every real Express
  backend (all ~28 of them build and run identically: `npm install` +
  `npm start`, one `PORT`). Not 28 near-duplicate Dockerfiles.
- **`Dockerfile.vite`** — one shared multi-stage Dockerfile for the 2
  real Vite frontends (`vdp`, `venvs`): builds the real production
  bundle, then serves it via `serve` from a second, much smaller
  image. Every real `VITE_*_API_URL` build arg (grep-verified against
  every actual `import.meta.env.VITE_*` reference in both apps' own
  client files) defaults to nginx's own path-prefixed route (e.g.
  `/vulture-music`) — the browser only ever talks to nginx's one
  exposed origin, matching the exact routing scheme
  `nginx-vaco.conf.example` already established for the VPS target.
- **`generate-docker-compose.js`** — writes the real, root-level
  `docker-compose.yml`. Every app that calls another app over HTTP
  (checked directly against every real `process.env.*_API_URL`
  reference in this repo's own `server.js` files — not blasted
  uniformly into every service) gets that var rewritten from its
  bare-metal `http://localhost:<port>` default to the real Docker
  Compose service name (`http://v3:8811`, etc.) — containers reach
  each other by service name, not `localhost`. Every app confirmed via
  `grep -l createPersistentStore` to actually use
  `lib/persistence.js` (24 of them) gets a real named volume at
  `/app/data`, so `docker compose down` (without `-v`) doesn't
  silently wipe state that was never volume-backed to begin with.
- **`generate-nginx-conf.js --docker`** — the same generator as the
  VPS target, extended with a real `--docker` mode: upstreams become
  Compose service names instead of `127.0.0.1:<port>`, and `/vdp/`/
  `/venvs/` become real `proxy_pass` blocks to their own containers
  (which each serve their own build via `serve`) instead of a bare-
  metal `alias` onto a shared host `dist/` path. Writes
  `deploy/nginx-docker.conf`.

**Verified**: `docker compose config` (real YAML parsing + variable
interpolation, no daemon required) validates the generated
`docker-compose.yml` cleanly — confirmed the required-secret guard
rejects a missing `ANTHROPIC_API_KEY` with the real, intended error
message, then validates clean once one is set; confirmed cross-app
URLs resolve to the correct real service name + port per app (spot-
checked `vulture-studios` → `v3`/`vaco-analytics`/`vulture-flix`/
`vulture-music`, all four real, all correctly scoped — no unrelated
var leaked in); confirmed exactly 24 named volumes, matching the real
persisted-app list. `deploy/nginx-docker.conf`'s braces balance (31/31)
and all 31 expected `location` blocks appear exactly once, no
duplicates. **Not verified**: an actual `docker compose up --build` —
this sandbox's Docker daemon can't start here (no permission to raise
the ulimits `dockerd` needs in this container), so no real image was
ever built or run. Run `docker compose up --build` yourself as the
real first test before trusting this in production.

## VPS deployment (pm2 + nginx)

## `ecosystem.config.js`
A real [pm2](https://pm2.keymetrics.io/) process list for the 26
backend apps (the 2 Vite frontends are deliberately excluded — they
get a real production build and are served as static files by nginx
instead; see below).

```
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # then run the command it prints, once, as root
```

Redeploy after a code update:
```
pm2 reload deploy/ecosystem.config.js --update-env
```

Regenerate after adding/removing an app in `start-ecosystem.sh`'s own
`APPS` array — this file is not meant to be hand-edited; re-run the
same generation this file was built with (see the deployment guide)
so it never drifts from the real manifest.

**Live-verified this session**: `pm2 start` brought up all 26 apps
online, every one answered a real `GET /api/health` with `200`, `pm2
reload deploy/ecosystem.config.js --update-env` completed cleanly with
the app still answering afterward, and `pm2 save` / `pm2 startup`
both ran and produced their real expected output.

## `generate-nginx-conf.js`
Generates a real nginx reverse-proxy config from the same manifest —
one domain, path-based routing (`https://yourdomain.com/void/`,
`/vago/`, etc.), one Let's Encrypt certificate, rather than a
subdomain (and per-subdomain cert) for every one of the 26+ apps.

```
node deploy/generate-nginx-conf.js yourdomain.com
```

Writes `deploy/nginx-vaco.conf.example`. `cvnvo`'s location block
carries real WebSocket upgrade headers (its real-time messaging,
Phase 13) that the other 25 don't need. The path prefix is stripped
before proxying (`rewrite ^/void/(.*)$ /$1 break;`) so each backend's
own real `/api/...` routes resolve unchanged — matching exactly how
every VDP/VENVS district client already builds its request URL
(`${BASE_URL}${path}`, where `path` already starts with `/api/...`).

**Not live-verified against a real nginx**: this sandbox's outbound
package mirrors couldn't install `nginx` to run a real `nginx -t`
against the generated file. What *is* verified: the generated config's
braces are balanced (29 open, 29 close) and every one of the 28
expected `location` blocks (26 backends + `/vdp/` + `/venvs/` + the
`/` root) appears exactly once, no duplicates — a real bug this
generator had on its first pass (`cvnvo` emitted twice) and was fixed
before committing. Run `nginx -t` yourself as the first real check on
your actual server before reloading nginx with it.

## Committed example
`nginx-vaco.conf.example` in this directory is the real output of
`node generate-nginx-conf.js example.com` — read it directly to see
the exact shape before running the generator yourself with your real
domain.
