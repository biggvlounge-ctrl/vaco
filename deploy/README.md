# deploy/

Real production-deployment tooling for the VACO ecosystem's 34 Express
backends + 2 Vite frontends, plus nginx and the LiveKit SFU — 38
Compose services and 29 named volumes. (`venvs-mock-backend` is the
one server in the repo that is deliberately *not* deployed: the apps
were cut over to standalone V3 and Shield, and it stays for local
development only.) Every file here is *generated* from the
same authoritative app/path/port manifest `start-ecosystem.sh` already
uses for local dev — there's exactly one source of truth for "what
apps exist, at what path, on what port," not four drifting copies.
Three real deployment paths exist side by side: pm2 + nginx directly
on a VPS (original, below), Docker Compose (see "Docker Compose
deployment" below, the one this session's own recommendation is built
around), and the single-port gateway for hosts that give you one port
and no nginx (see "Single-port deployment" below).

## Single-port deployment (`gateway.js`, Replit and other PaaS)

Both paths above assume you can run nginx. Replit, Render, Fly and
most PaaS boxes expose exactly one port and expect one process to own
it. On those, the deploy story used to be "run 36 servers and expose
one of them", which is not a deploy story.

`gateway.js` at the repo root is the same routing table in Node, in
front of the same servers: `/<app>/...` strips the prefix and proxies
to that app's port, `/` goes to `vaco-shell` unprefixed. Like every
other consumer it reads `start-ecosystem.sh`'s APPS array rather than
keeping its own copy, and `scripts/test/gateway.test.mjs` holds it and
`nginx-docker.conf` to the same table so the day they disagree the
suite says so instead of a deployment.

```bash
./start-ecosystem.sh          # the apps, on their own ports
PORT=8080 node gateway.js     # all of them, through one
node gateway.js --print-routes  # the table, without starting anything
```

**Verified (2026-09-10):** driven against the booted ecosystem, 33 of
34 apps answered 200 through the single port; the 34th was `v4-proxy`,
deliberately down for want of `ANTHROPIC_API_KEY`, and its 502 named
the app and the port rather than saying "502" against 34 services.

### Replit

`.replit`, `replit.nix` and `deploy/replit-boot.sh` are the entry
point. The boot script installs on first run, starts the apps, then
`exec`s the gateway on `$PORT`. Only the gateway binds anything
public; the backends stay on 127.0.0.1, the same shape as the nginx
configs.

**`.replit` and `replit.nix` have not been run on a real Replit
container** — there is no Replit account attached to this work, and
they are marked as first drafts in their own headers. `replit-boot.sh`
*has* been driven for real here, and the run found a defect that would
have failed on Replit every time: `PORT` is set for the gateway, but
`start-ecosystem.sh` hands its environment to every app it starts and
every app reads `process.env.PORT`, so all of them tried to bind the
gateway's port. The boot reported five apps DOWN that had started fine
a minute earlier, which reads like an out-of-memory problem and is
not one. `scripts/test/replit-boot.test.mjs` now holds that.

### Memory, and `VACO_APPS`

Measured on the development machine (2026-09-10):

| | processes | resident |
|---|---|---|
| full stack, 36 apps | 68 | 2.43 GB |
| 5-app subset + gateway | 6 | 0.35 GB |

68 rather than 36 because `npm start` stays alive as a parent of each
`node`. A container with less RAM than the full stack needs will OOM
partway through the boot, and the OOM killer picks a different half of
the ecosystem each time.

`VACO_APPS` is the escape hatch — a space-separated list of app names
to start instead of all of them:

```bash
VACO_APPS="vaco-shell v3 shield void vacay" ./start-ecosystem.sh
```

An unknown name is refused with the list of known apps rather than
skipped, and naming nothing at all is refused too: a subset boot that
silently starts zero apps reports "0 up, 0 down", which is a clean
bill of health for an ecosystem that is not running.

### What this path is *not* for

Production, as things stand. Every app keeps its state in JSON files
on disk. That survives in a persistent workspace or on a Reserved VM;
it does not survive an autoscaling deployment, where the filesystem is
ephemeral and a second instance means a second, divergent ledger —
the exact failure this repo spent the settlement-atomicity sweep
eliminating everywhere else. The Postgres conversion is the real
prerequisite, and it is not done.

Use this to *show* the ecosystem at a URL. Use Compose or pm2+nginx to
run it.

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
rejects a missing `VACO_SERVICE_TOKENS` with the real, intended error
message, then validates clean once all 29 required vars are set;
confirmed cross-app URLs resolve to the correct real service name +
port per app (spot-checked `vulture-studios` → `shield`/`v3`/
`vaco-analytics`/`vaco-audit`/`vaco-operator`/`vulture-flix`/
`vulture-music`, all seven real, all correctly scoped — no unrelated
var leaked in); confirmed exactly 29 named volumes, each declared once
and mounted by exactly one service, matching the real persisted-app
list. `deploy/nginx-docker.conf`'s braces balance (40 open, 40 close)
and all 36 expected `location` blocks appear exactly once, no
duplicates. **Not verified**: an actual `docker compose up --build` —
no image has ever been built here, for any service. Run
`docker compose up --build` yourself as the real first test before
trusting this in production.

**Exactly what blocks it, re-measured 2026-09-10.** An earlier version
of this paragraph said the daemon could not start. That was wrong, and
carried forward without testing:

```
dockerd --iptables=false --bridge=none     # starts, buildkit initialises
docker info                                # Server Version: 29.3.1
docker pull node:22-alpine                 # manifest resolves, then:
  production.cloudfront.docker.com ... Forbidden
```

The daemon runs. DNS, TLS and registry auth all work through the
proxy. The single thing denied is Docker Hub's **blob CDN** —
`production.cloudfront.docker.com:443` answers 403 to CONNECT by proxy
policy, so no base image can be fetched and `FROM node:22-alpine`
cannot resolve. Even `docker build --check`, which does not execute the
build, needs that metadata and fails at the same line.

This matters for whoever picks it up: there is **no container
capability problem to solve and nothing to configure**. On any machine
that can reach Docker Hub, `docker compose up --build` is the next
command, with nothing else standing in front of it. Everything short of
the image pull — compose validation, the build contexts, the
`.dockerignore` files, the env and volume wiring — is verified above
and by `scripts/deploy-preflight.mjs`.

The counts in this file are held against the generated artifacts by
`scripts/test/deploy-readme.test.mjs`, so a number here that drifts
from what the generators emit fails the suite rather than sitting
quietly wrong.

## VPS deployment (pm2 + nginx)

## `ecosystem.config.js`
A real [pm2](https://pm2.keymetrics.io/) process list for the
**34 backends** (the 2 Vite frontends are deliberately excluded — they
get a real production build and are served as static files by nginx
instead; see below). Four fewer entries than the Compose service
count above, which additionally carries nginx and LiveKit as
image-based services and the 2 Vite frontends as built containers.

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
`APPS` array — this file is not hand-edited:

```
node deploy/generate-ecosystem-config.js
```

**That generator did not exist until 2026-09-09, and the file had
drifted.** Its header said "generated from the same authoritative
manifest" and this README said to re-run "the same generation this
file was built with", but nothing in the repository could regenerate
it, so the only way to add an app was by hand. Six were missed:
`vaco-audit`, `vaco-operator`, `vaco-media`, `vaco-notify`, `vex` and
`vex-trading`. A real `pm2 start` would have reported 28/28 online and
green while the decision log, the operator-authority service, the
media layer and the notification channel were all simply not running —
and every caller of those four fails soft by standing rule, so nothing
would have said so. The file is now genuinely generated from the
manifest and `scripts/test/deploy-readme.test.mjs` fails if it drifts
again.

**Live-verified when the pm2 path was built**: `pm2 start` brought up
all 26 apps online, every one answered a real `GET /api/health` with
`200`, `pm2 reload deploy/ecosystem.config.js --update-env` completed
cleanly with the app still answering afterward, and `pm2 save` / `pm2
startup` both ran and produced their real expected output. That run
happened when the manifest held 26 apps, so for a while it was
evidence the pm2 *path* worked rather than a current all-green — the
six apps restored in September had never been started under pm2 at
all. **It has since been repeated at 34; see below.**

The `deploy-readme.test.mjs` check holds the counts in this file
against the generators, but it cannot check a sentence like this one.
Both runs are dated deliberately so a reader can tell which is which.

**Re-verified at full scale under pm2, 2026-09-10.** Everything the
2026-08 run above proved at 26 apps now holds at 34:

| Step | Result |
|---|---|
| `pm2 start deploy/ecosystem.config.js` | 34 managed, **33 online** |
| `GET /api/health` on every one | **33/34 answer 200** |
| `pm2 reload ... --update-env` | completes cleanly, V3 still answering |
| `pm2 save` | saved to `~/.pm2/dump.pm2` |
| `pm2 startup` | ran, produced its real systemd output |
| `scripts/smoke-frontend.mjs --all` | **30 of 31 targets pass** |

The one process not online is `v4-proxy`, which refuses to start
without `ANTHROPIC_API_KEY`. pm2 retried it 9 times and then marked it
`errored` — its `max_restarts: 10` policy working exactly as
configured, which is itself the supervision behaviour this run was
meant to exercise.

31 smoke targets, not 34: the three headless services (`vaco-audit`,
`vaco-operator`, `vaco-media`) have no frontend by design and are
skipped with that reason stated.

Reached the same result twice by two different paths —
`./install-ecosystem.sh` then `./start-ecosystem.sh` gave 35 up of 36
(that count includes the two Vite frontends, which pm2 deliberately
does not manage), and pm2 gave 33 of 34. The apps and the supervision
layer are both now proven at full scale.

The boot found three real defects that no unit test could see — a
caller allowlist 8 services short, a smoke test failing on three
headless apps by design, and 33 lockfiles disagreeing with their own
package.json about the Node floor. All three are fixed, and the
settlement endpoint every app now depends on was exercised against the
running V3: atomicity, idempotency and whole-ledger reconciliation all
verified over real HTTP.

## `generate-nginx-conf.js`
Generates a real nginx reverse-proxy config from the same manifest —
one domain, path-based routing (`https://yourdomain.com/void/`,
`/vago/`, etc.), one Let's Encrypt certificate, rather than a
subdomain (and per-subdomain cert) for every one of the 34 apps.

```
node deploy/generate-nginx-conf.js yourdomain.com
```

Writes `deploy/nginx-vaco.conf.example`. `cvnvo`'s location block
carries real WebSocket upgrade headers (its real-time messaging,
Phase 13) that the other 32 don't need. The path prefix is stripped
before proxying (`rewrite ^/void/(.*)$ /$1 break;`) so each backend's
own real `/api/...` routes resolve unchanged — matching exactly how
every VDP/VENVS district client already builds its request URL
(`${BASE_URL}${path}`, where `path` already starts with `/api/...`).

**Not live-verified against a real nginx**: this sandbox's outbound
package mirrors couldn't install `nginx` to run a real `nginx -t`
against the generated file. What *is* verified: the generated config's
braces are balanced (40 open, 40 close) and every one of the 36
expected `location` blocks (33 backends + `/vdp/` + `/venvs/` + the
`/` root) appears exactly once, no duplicates — a real bug this
generator had on its first pass (`cvnvo` emitted twice) and was fixed
before committing. Run `nginx -t` yourself as the first real check on
your actual server before reloading nginx with it.

(33 backends rather than 34 because the 34th, `vaco-shell`, *is* the
`/` root — the app store is what a bare `https://yourdomain.com/`
serves, so it has no prefixed location of its own.)

The committed `nginx-vaco.conf.example` was itself four apps stale
until 2026-09-09 — `vaco-audit`, `vaco-media`, `vaco-notify` and
`vaco-operator` had no location block, so on a real VPS those four
would have 404'd at the reverse proxy no matter how healthy the
backends were. Same root cause as the pm2 drift above, caught the same
way: regenerate, then hold the output against the manifest in a test.

## Committed example
`nginx-vaco.conf.example` in this directory is the real output of
`node generate-nginx-conf.js example.com` — read it directly to see
the exact shape before running the generator yourself with your real
domain.
