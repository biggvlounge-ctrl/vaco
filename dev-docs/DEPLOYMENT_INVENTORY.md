# Deployment Inventory — What Exists and What Ships

Verified by booting the whole ecosystem, not from memory. Result:
**32 up, 0 down, out of 32** at the time of that boot; the stack has since gained `vaco-audit` and `vaco-operator`, both verified live but not in that count. Every claim below traces to a live health
response or a file on disk.

## Deployment tooling — what you already have

Everything needed to deploy exists. There is nothing to write.

| File | What it is |
|---|---|
| `start-ecosystem.sh` | **Authoritative manifest.** name : path : command : port : health-path, for every service. Boots and health-checks all of them. |
| `stop-ecosystem.sh` | Stops by recorded PID, with a sweep for leftovers. |
| `deploy/Dockerfile.node` | One shared Dockerfile for all Express backends. Per-app build context. |
| `deploy/Dockerfile.vite` | For the two Vite frontends (VDP, VENVS). |
| `deploy/generate-docker-compose.js` | **Generates** `docker-compose.yml` from the manifest. |
| `deploy/generate-nginx-conf.js` | **Generates** the nginx config from the same manifest. |
| `docker-compose.yml` | 35 app services + nginx, 27 named volumes. Generated. |
| `deploy/nginx-docker.conf` | Reverse proxy, all 32 upstreams, rate limiting (10r/s, burst 20). |
| `deploy/nginx-vaco.conf.example` | Same for the pm2-on-a-VPS path. |
| `deploy/ecosystem.config.js` | pm2 process config. |
| `deploy/README.md` | Both deployment paths, with the Docker-over-Render reasoning. |

**Critical rule:** `start-ecosystem.sh` is the single source of truth.
The compose file and both nginx configs are *generated* from it. Editing
them by hand is how they drift — that is exactly how `docker-compose.yml`
lost its `vex` service until it was caught. Change the manifest, then
re-run the generators.

**Deploy command:**

```sh
cp .env.example .env                          # set ANTHROPIC_API_KEY
node scripts/generate-service-tokens.mjs --write   # V3 service credentials
node deploy/generate-docker-compose.js
node deploy/generate-nginx-conf.js --docker
docker compose up -d
```

**Two required secrets now, not one.** V3 refuses unauthenticated
mutating calls (`VACO_SERVICE_AUTH_MODE` defaults to `enforce`), so every
settling app presents a service credential. `generate-service-tokens.mjs`
writes both halves — V3's allowlist and the twenty per-caller tokens —
from one source, so they cannot disagree. Every token is marked `:?` in
the compose file, which means a missing one stops the stack at `up`
rather than at the first settlement. See `dev-docs/AUTH_HARDENING.md`.

---

## Docker readiness — verified and not

Recorded honestly because "the compose file exists" and "the stack
runs" are different claims.

> ## Two things are NOT done, and both are environmental
>
> Nothing below should be read as "deployment is verified". Two items
> stay open and neither can be closed from this environment:
>
> **1. No container image has ever been built.** Docker Hub's blob CDN
> is blocked by proxy policy here, so `node:20-alpine` cannot be pulled
> and `docker compose build` has never run — not once, for any app.
> `docker compose config` validating is not the same claim and must not
> be reported as one. The first real build on a network that can reach
> Docker Hub is still an unknown. Detail below.
>
> **2. The off-host backup sync has never been run against a real
> remote.** `scripts/backup-stores.mjs` and `restore-stores.mjs` are
> built and covered by 13 tests, and `dev-docs/DISASTER_RECOVERY.md`
> documents the procedure — but a backup that has never been restored
> *from the remote copy* is a procedure, not a backup.
>
> **3. `VACO_OPERATOR_BOOTSTRAP` is the one secret whose absence does
> not stop the stack — and should.** Every other secret is `${VAR:?}`,
> so a missing one fails at `up`. This one is `:-`, because "no
> operators yet" is the correct starting state for an authority
> service. The consequence: leave it empty and the stack comes up
> perfectly clean with **all 27 group-2 routes dead** — settlements,
> grading, vetting and refunds all 403, because no operator exists to
> hold any scope. Nothing warns you.
>
> ```
> curl localhost:8820/api/coverage    # "operators": 0 means nobody can decide
> ```
>
> Not a code gap — it is deliberate — but it is the single most likely
> way a correct deploy of this stack looks healthy and cannot settle
> anything. `.env.example` says so at the variable.

Items 1 and 2 are waiting on real infrastructure to test against, not
on more code. Flagged here because this is the document most likely to
be read before a deploy.

---

**Verified 2026-08-26:**

| Check | Result |
|---|---|
| `docker compose config` resolves against a real `.env` | valid, every `${VAR:?}` satisfied |
| The trusted-service allowlist matches every caller token | no mismatches — 19 callers, and `generate-service-tokens.mjs --check` now enforces it in CI |
| No app `require`s a path outside its own build context | clean across all 33 — this is why `shieldAuth`/`serviceAuth` are *copied* into each app by `sync-shared-runtime.sh` rather than required from `shared/` |
| Every app has a lockfile | 33/33 |
| Every app excludes `node_modules/`, `data/`, `.env` | 33/33, enforced by the generator |
| Generated compose + nginx match the manifest | byte-identical on regeneration, checked in CI |
| `.env.example` lists every real service caller | derived from the same scan as compose, checked in CI |
| Every mutating route is guarded or declared open with a reason | 508/508, enforced in CI — zero unaccounted, not a ratchet |

**Not verified — no image has ever been built.** The environment this
was prepared in blocks Docker Hub's blob CDN by proxy policy
(`production.cloudfront.docker.com` → 403 on CONNECT), so
`node:20-alpine` cannot be pulled and `docker compose build` cannot run.
The daemon itself works; the base image is unreachable.

So the first real `docker compose build` on a network that can reach
Docker Hub is still the unknown. What was done instead was to check the
things that are *VACO-specific* — build-context escapes, env
completeness, credential consistency, ignore hygiene — rather than
claim the whole path works.

**Three real deployment bugs were found doing that**, all invisible from
the `npm start` path:

1. **11 apps had no `SHIELD_API_URL` in compose.** They declare it in
   `lib/`, and the generator only read `server.js`. Inside a container
   the default `http://localhost:8812` resolves to the container itself,
   not Shield — so every auth check would have failed with a connection
   error. `vaco-shell` and `vxllage` were missing `V3_API_URL` the same
   way.
2. **`v4-proxy/.env` would have been baked into its image**, carrying a
   live Anthropic key into a distributable artifact.
3. **`vex/` and `vex-trading/` had no `.dockerignore` at all**, so
   `vex/data/store.json` would ship inside the image — and Docker seeds
   a fresh named volume *from image content*, so local dev balances and
   orders would have become the deployed starting state.

All three are fixed, and the third is now enforced: the generator
refuses to emit a service whose `.dockerignore` does not exclude
`node_modules/`, `data/`, and `.env`.

## The 16 apps

Grouped as `vaco-shell/lib/registry.js` groups them. "Modules" = real
library files; "routes" = Express endpoints. Both counted from source.

### Core infrastructure

| App | Service | Port | Modules | Routes | State |
|---|---|---|---|---|---|
| **V3** | `v3` | 8811 | 6 | 6 | Canonical VCoin/VASH ledger. 18 apps settle through it. **Has tests.** Persisted. |
| | `vaca` | 8804 | 4 | 8 | Identity/authenticity attestation. Consumed by VOKEN, VOID, CVNVO. Persisted. |
| **VACON** | `vacon` | 8805 | 4 | 6 | The operating network. **14 agents live.** Routing + invoke. **Has tests.** Persisted. |
| | `vacon-c` | 8809 | — | 7 | Civ-sim engine (paused). |
| | `vsafe` | 8799 | 15 | 43 | Shared safety: check-ins, ID verification, 6 source apps. **Has tests.** Persisted. |
| **V4** | `v4-proxy` | 8787 | 4 | 17 | Agent interface. Holds the Anthropic key. Twin profiles, 5 surfaces, call flow. |
| | `v4-search` | 8788 | — | 2 | Cross-app search over 6 apps. |
| — | `shield` | 8812 | 4 | 5 | Sessions + credential auth. **Has tests.** Persisted. |
| — | `vaco-shell` | 8789 | 2 | 10 | Launcher, session host, app registry (31 entries). |
| — | `vaco-analytics` | 8790 | — | 7 | Metric ingestion + proactive anomaly/alert loop. |

### Consumer apps

| App | Service | Port | Modules | Routes | State |
|---|---|---|---|---|---|
| **VOID** | `void` | 8793 | 33 | 119 | **Largest app.** 25 verticals, drone/ground routing, stations, staffing. **Has tests.** Persisted. |
| | `voidmagic` | 8797 | 12 | 33 | Meet & greet bookings, 15.5% take rate, real cancellations. Persisted. |
| **VOKEN** | `voken` | 8794 | 27 | 63 | Cvltvre Cards, auctions, fractional shares, resale, compliance gates. **Has tests.** Persisted. |
| **VXLLAGE** | `vxllage` | 8796 | 19 | 64 | Feed, threads, villages, profiles, follows, search. Persisted. |
| **CVNVO** | `cvnvo` | 8798 | 19 | 59 | Gale-Shapley matching, 11 dating formats, VSAFE-backed. Persisted. |
| | `yap` | 8802 | 3 | 5 | Green/red flag reviews. Deliberately decoupled from matching. Persisted. |
| **VAGO** | `vago` | 8795 | 13 | 39 | Prediction markets, sportsbook, esports, casino, Gold Coin, AMOE, provably-fair. **Has tests.** Persisted. |
| **HVNTZ** | `hvntz` | 8792 | 13 | 40 | 14 revenue streams, businesses, locations, hunts. Persisted. |
| | `dreams` | 8814 | 6 | 22 | Screens, campaigns, impressions, offline cache. Persisted. |
| **CHOPZ** | `chopz` | 8800 | 3 | 4 | Persisted. |
| | `chopz-shop` | 8801 | 5 | 10 | Native checkout, category fees, affiliate splits. Persisted. |
| **VACAY** | `vacay` | 8803 | 2 | 1 | 4 sections: Stays, Experiences, Auto, Homes, Flights. Persisted. |
| **VENVS** | `venvs` | 5173 | 9 | — | Vite frontend. Marketplace, shop, publishing. |
| **VDP** | `vdp` | 5174 | 33 | — | Vite frontend. **The walkable world** — districts for most apps. |
| **Vault** | `vavlt-stvdios` | 8808 | 18 | 57 | Multi-channel streaming, 8-screen sessions, VOD. Persisted. |
| **Vex** | `vex-trading` | 8817 | 1 | 3 | Parent shell over the two below. |
| | `vex` | 8816 | 5 | 7 | Brokerage, gated pending broker-dealer registration. Persisted. |
| **Vvltvre** | `vulture-music` | 8806 | 7 | 26 | Releases, royalty splits, label deals, beat marketplace. **Has tests.** Persisted. |
| | `vulture-flix` | 8807 | 5 | 17 | Titles, 3 subscription tiers, licensing. Persisted. |
| | `vulture-pods` | 8810 | 7 | 17 | 10 show categories, 10% take. Persisted. |
| | `vulture-studios` | 8815 | 4 | 10 | Fund-and-produce financing. Persisted. |
| | `venvm` | 8813 | 6 | 14 | Script engine, reformatting, production pipeline, consent gate. **Has tests.** Persisted. |

**Totals: 239 library modules, ~700 routes, 24 apps with disk
persistence.**

## Deploys separately — do not forget this one

**`vex-business/`** (Vex Business — futures research platform) is a
self-contained **Python** monorepo: pyproject, uv.lock, alembic
migrations, `apps/web` (Next.js), its own `docker-compose.yml`,
Makefile, and `infra/`. It is correctly absent from the root manifest
because it does not build with `Dockerfile.node`.

**`docker compose up` at the root does not bring up Vex Business.** It
needs its own bring-up from inside `vex-business/`.

## Not services, by design

- `world-layer/` — shared data module, no HTTP layer. Skip documented
  in the manifest.
- `venvs-mock-backend/` — legacy mock that V3 and Shield replaced.
  Started only with `--with-mock`, excluded from Docker.
- `deploy/`, `dev-docs/` — tooling and docs.
- `logs/` — gitignored runtime output.

## Honest gaps before production

None of these block a deploy; all matter before real users.

1. **Storage — and a correction to what this entry used to say.**

   This line previously claimed V3's `cashout` could debit VCoin
   without crediting VASH because the two are sequential writes. That
   is **not true**, and it was worth testing rather than repeating:
   `cashout` is fully synchronous with no `await` between the two
   lines, Node is single-threaded, and the persistence layer already
   does write-to-temp-then-rename. There is no interleaving point and
   no torn-file window.

   The real defect was durability, found by killing a live server:
   a cashout returned 201 with new balances, the process was killed
   inside the 200ms debounce, and the whole operation was gone on
   restart — balances consistent, but the caller had been told it
   succeeded. **That is now fixed** (`lib/persistence.js` `durable()`,
   mounted app-wide in all 24 persisted services; a commit is forced
   before any 2xx response to a mutating request).

   What remains is genuinely smaller than "no transactions":
   - No protection against **sudden power loss** — that needs an
     fsync of the file and its directory, not just `renameSync`.
   - **Whole-file writes** cost ~0.13 ms at the current largest store
     (10.4 KB) but ~30 ms at 50k records. Past roughly a megabyte per
     store this wants append-only or SQLite — `node:sqlite` is in
     Node 22's standard library, so no package is needed.
   - **No cross-app transaction.** If VOKEN charges through V3 and
     then crashes before recording the purchase, money moved with no
     card to show for it. A database in one app does not fix this;
     it needs idempotency keys plus reconciliation, which is why
     gap #2 matters more than this one.
2. **Idempotency — now built, and partially closed.**
   `v3/lib/idempotency.js` guards `POST /api/vcoin/transfer` and
   `POST /api/vash/cashout`: a caller sending `Idempotency-Key` gets
   its first result replayed verbatim on any retry, and reusing a key
   with a changed body is refused with a 422 rather than answered
   wrongly. **The remaining exposure is real and deliberate**: the
   guard is opt-in, so the eighteen services that call these routes
   are still unprotected until each one is wired to send a key. Making
   it mandatory would have 400'd all eighteen on their next deploy.
   Wiring the call sites is the follow-up, one at a time.
3. **Tests — 130 across 9 services, up from 3 services.**

   | Service | Tests | Covers |
   |---|---|---|
   | `v3` | 36 | Ledger, idempotency, durability, service auth |
   | `vsafe` | 17 | **Safety check-ins, escalation, panic trigger** |
   | `venvm` | 15 | **Likeness consent gate** |
   | `shield` | 12 | Sessions, credential auth |
   | `vacon` | 12 | Agent roster, MIA routing |
   | `vulture-music` | 12 | **Royalty split arithmetic** |
   | `voken` | 9 | **Compliance gates** (fractional, influencer) |
   | `vago` | 9 | **Gold Coin / VCoin separation** |
   | `void` | 8 | **Licensing gates** (cannabis, medical transport) |

   Run with `npm test` in any app directory. 23 services still have
   none.

   **The bolded suites were chosen deliberately**: they cover things
   that fail *silently*. A compliance gate softened to a warning still
   returns successfully. A licensing flag omitted from a new vertical
   reads as `undefined`, which is falsy, which is ungated. A Gold Coin
   conversion helper added for convenience would pass every other test
   in the repo while changing what VAGO legally is.

   Two are worth calling out specifically:

   - **VSAFE** is the highest-consequence code in the ecosystem. Its
     failure mode is not a wrong balance — it is a person who set a
     check-in timer, did not confirm, and had nobody notified. The
     suite pins the escalation boundary, that an escalated check-in
     cannot be quietly confirmed safe afterward, and that a re-run
     sweep does not re-notify contacts.
   - **Vvltvre Music's royalty arithmetic** loses money the moment
     someone "tidies up" the rounding. Three collaborators at a third
     each cannot divide 100 exactly; the code rounds every share but
     the last and lets the last absorb the remainder. The tests assert
     the *sum*, not the individual shares, so a consistent-rounding
     refactor fails instead of underpaying a co-writer a cent forever.

   VACON's suite came from the same reasoning and immediately earned
   it — MIA's router had a substring-matching bug sending travel and
   delivery queries to the Chief Legal Officer.

4. **Auth coverage — allowlist built, not yet enforced.**
   `v3/lib/serviceAuth.js` adds the trusted-service credential this
   line used to call for: a caller presents `X-Service-Name` and
   `X-Service-Token`, checked against per-service secrets in
   `VACO_SERVICE_TOKENS` (per-service, so one compromised service is
   revoked on its own). Three modes — `off`, `observe`, `enforce`.

   **It ships in `observe`, which rejects nothing.** That is the
   honest state: the protection exists and is tested, but until each
   of the 18 callers is issued a token, turning on `enforce` would
   401 them. Observe records every unauthenticated caller on
   `GET /api/health`, so the migration list comes from live traffic
   rather than from grepping. Rollout steps are in `.env.example`.
5. **Real-time media.** No WebRTC/SIP anywhere. Four surfaces wait on
   it — task #106, scoped at
   `dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md`.
6. **No frontend for most apps.** The ecosystem is overwhelmingly
   server-side JSON. Visible surfaces live in VDP's districts and the
   two Vite apps. Worth knowing before a demo.

## Compliance gates — closed by design, verify before opening

| Gate | Where | Blocks |
|---|---|---|
| `fractional-ownership` | `voken/lib/complianceGate.js` | Reg D / Reg A+ pending |
| `influencer-culture-card-rewards` | same | Held for Deskins' review |
| `vex-brokerage` | `vex/lib/complianceGate.js` | Broker-dealer registration |
| Likeness consent | `venvm/lib/likenessConsent.js` | Hard gate, throws |
| Real-money wagering | VAGO — no path exists | Gold Coin is a separate non-redeemable ledger |
| Licensing gates | VOID `cannabisDelivery`, `medicalTransportation` | Must not be relaxed |

Nothing in the system moves real currency. Everything settles in VCoin
through V3.
