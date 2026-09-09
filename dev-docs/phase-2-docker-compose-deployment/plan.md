# Plan — Phase 2: Docker Compose deployment

## Goal
Close a real, direct gap: no Docker or Render config existed anywhere
in the repo. Given the choice between the two, recommend and build
the real one — Docker Compose, not Render — with the reasoning made
explicit rather than just asserted.

## Design
**Docker over Render, and why**: this ecosystem is genuinely ~30
independent services. Render bills and operates per-service, which is
an awkward, expensive shape at this scale; Docker Compose runs the
whole thing as one real, portable unit on a single host, directly
continuing the pm2 + nginx VPS setup this repo already had rather than
replacing it with something unrelated. Render isn't closed off by this
choice — every service builds from a real, standard Dockerfile Render
can deploy individually later if wanted.

**Same generation discipline as everything else in `deploy/`**: a new
`deploy/generate-docker-compose.js` reads the same authoritative
`start-ecosystem.sh` manifest `ecosystem.config.js` and
`generate-nginx-conf.js` already use — one source of truth, not a
fourth drifting copy. `generate-nginx-conf.js` itself gained a real
`--docker` mode (upstreams by Compose service name instead of
`127.0.0.1:<port>`; `/vdp/`/`/venvs/` become `proxy_pass` to their own
containers instead of a bare-metal `alias`) rather than a second,
separate script duplicating its manifest-parsing logic.

**Cross-app URL rewriting is per-app-scoped, not blanket**: every real
`process.env.*_API_URL` reference was grep-verified directly against
this repo's own `server.js` files first (not assumed from any doc),
producing an explicit `ENV_VAR_TO_SERVICE` table. Each generated
service's `environment` block only includes the vars that specific
app's own `server.js` actually reads — checked directly per app via a
real file read, not blasted uniformly into all ~30 services.

**Persistence volumes are grep-verified, not assumed**: `grep -l
createPersistentStore */server.js` produced the real, exact list of
24 apps that write to `data/store.json` via `lib/persistence.js`; only
those get a named volume. An app that's in-memory-only doesn't get an
invented volume.

**Vite build-arg correctness**: `Dockerfile.vite`'s `VITE_*_API_URL`
build args are re-declared as `ENV` immediately before `RUN npm run
build` — `ARG` alone isn't reliably exposed as a real process
environment variable to a `RUN` shell across Docker versions, and
`vite build`'s own `import.meta.env.VITE_*` reads `process.env` at
build time, so this needed to be unambiguous, not left to a version-
dependent Docker behavior.

## Verification approach
`docker compose config` — real YAML parsing + variable interpolation
against the actual generated `docker-compose.yml`, no daemon required.
Confirmed: the required-secret guard on `ANTHROPIC_API_KEY` rejects a
missing value with the real, intended error and validates clean once
set; cross-app URLs resolve to the correct real service + port,
scoped correctly per app (spot-checked against `vulture-studios`'s own
real 4 dependencies); exactly 24 named volumes, matching the real
persisted-app list one-for-one. `deploy/nginx-docker.conf`'s braces
balance and all 31 expected `location` blocks appear exactly once.

**Real, disclosed limit**: `docker compose up --build` itself was not
run — this sandbox's Docker daemon can't start (no permission to raise
the ulimits `dockerd` needs here). No image was ever actually built.
Flagged directly in `deploy/README.md` rather than claimed as verified
when it wasn't — the real first test is the user's own `docker compose
up --build`.
