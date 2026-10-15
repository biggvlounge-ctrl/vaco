# Deployment — File Placement Audit

A check that every file lives under the app that owns it, and that
every directory has a deliberate deployment disposition. Re-runnable:
the commands behind each claim are in this repo's history.

**Corrected 15 Oct 2026 — the fastest-drifting kind of claim in a
growing monorepo is a file/service count, and this doc has not been
revisited since at least three new apps were added.** Re-measured:
- Repository root: ~~"only four files"~~ now has ~18 non-directory
  files (`.env.example`, `gateway.js`, `package.json`,
  `sync-design-system.sh`, `install-ecosystem.sh`, a Replit layer,
  etc., alongside the original four).
- `start-ecosystem.sh` services: ~~33~~ **39**. `docker-compose.yml`
  services: ~~32~~ **42** (including nginx, livekit, postgres).
  `deploy/nginx-docker.conf`: ~~32~~ **39** `location` blocks.
- `vaco-shell/lib/registry.js`: ~~28 entries under 16 parents~~ **18
  distinct parents** (CVLTVRE and VADO promoted 26 Aug 2026, per
  `dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md`'s own
  recommendation — this doc's table was never updated to match).
- "Zero cross-app `require()` calls... none found" — now false in one
  place: `world-layer/test/sources.test.js` has 5 cross-directory
  `require('../../vacon-c/...')` calls. They're in a test file, not
  shipped app code, so the Docker-build-context conclusion likely
  still holds in practice, but "none" as written is wrong.
- New deploy infrastructure this doc's own inventory doesn't mention:
  `deploy/generate-ecosystem-config.js` / `ecosystem.config.js`,
  `deploy/replit-boot.sh`, `deploy/livekit.yaml`.

The underlying METHOD (regenerate from `start-ecosystem.sh`, don't
hand-edit the generated files) is unchanged and still the right
rule — only the specific counts below are dated.

## The chain, and which link is canonical

`start-ecosystem.sh` is **authoritative**. `docker-compose.yml` and
`deploy/nginx-docker.conf` are *generated* from it by
`deploy/generate-docker-compose.js` and
`deploy/generate-nginx-conf.js`. Editing either generated file by hand
is how they drift — regenerate instead.

Verified consistent:

| Link | Count |
|---|---|
| `start-ecosystem.sh` services | 33 |
| `docker-compose.yml` services | 32 |
| nginx upstreams | 32 |
| compose services with no nginx route | **none** |
| nginx routes with no compose service | **none** |
| in start script but not compose | `venvs-mock-backend` — deliberate |

## Repository root

Only four files, all legitimately repo-level:

```
README.md  docker-compose.yml  start-ecosystem.sh  stop-ecosystem.sh
```

**Fixed in this pass:** `V4Prototype.jsx` sat loose at the root — the
only application source file in the repo not filed under the app that
owns it. Moved to `v4-proxy/` with `git mv` (history preserved) and the
one path-based reference in `vacon-c/CLAUDE.md` updated. Every other
reference to it across 15 files uses the bare filename and is
unaffected.

## The 16 apps

`vaco-shell/lib/registry.js` groups 28 entries under **16 parents** —
this is the user-facing app count, distinct from the 32 deployed
services:

| Parent | Services |
|---|---|
| CHOPZ | chopz, chopz-shop |
| CVNVO | cvnvo, yap |
| HVNTZ | hvntz, dreams |
| V3 | v3, vaca |
| V4 | v4-proxy, v4-search |
| VACAY | vacay |
| VACON-C | vacon, vacon-c, vsafe |
| VAGO | vago |
| VDP | vdp |
| VENVS | venvs |
| VOID | void, voidmagic |
| VOKEN | voken |
| VXLLAGE | vxllage |
| Vault | vavlt-stvdios |
| Vex | vex-trading |
| Vvltvre | vulture-music, vulture-flix, vulture-pods, vulture-studios, venvm |

## Directories that deliberately do not deploy

Each was checked rather than assumed:

- **`deploy/`** — Dockerfiles and the compose/nginx generators.
- **`dev-docs/`** — ecosystem-wide process docs belonging to no single
  app (the standing evaluation instruction, the real-time media scope,
  this file).
- **`logs/`** — runtime output. Gitignored, zero tracked files.
- **`world-layer/`** — a shared data module with no HTTP layer of its
  own. The skip is documented in `start-ecosystem.sh`'s own header.
  **Nothing `require()`s it across a directory boundary** — the
  references in other apps are comments citing provenance, not imports.
- **`vex-business/`** — a self-contained Python monorepo (pyproject,
  uv.lock, alembic migrations, `apps/web`) with its **own**
  `docker-compose.yml`, Makefile, and `infra/`. Correctly absent from
  the root manifest: it does not build with `deploy/Dockerfile.node`.
  It deploys on its own, and that is the one thing here a deploy
  runbook must not forget.
- **`venvs-mock-backend/`** — the legacy mock that V3 and Shield
  replaced. Kept for local reference, started only with `--with-mock`,
  and excluded from Docker on purpose. The remaining mentions in
  `venvs/` and `vdp/` are comments recording where a contract came
  from, not live dependencies.

## The check that matters most for containers

**Zero cross-app `require()` calls.** Searched for `require('../../…')`
across every non-vendor `.js` file: none.

That is load-bearing. `deploy/Dockerfile.node` sets the build context
to a single app directory (`context: ./void`), so `COPY . .` only ever
sees that one app. Any import reaching outside its own directory would
build fine locally and fail inside the container. Every app is
self-contained, so the per-app build context is sound.

## Result

Nothing is unaccounted for. One misfile found and fixed; every other
directory has a deliberate, documented disposition.
