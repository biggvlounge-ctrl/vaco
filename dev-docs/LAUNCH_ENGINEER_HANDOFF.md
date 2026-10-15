# Launch engineer handoff — the $1,600–5,200 engagement

**What this is.** A one-page brief for the one-time contractor engagement
scoped in this conversation: get the ecosystem (37 backends + VDP +
VENVS as the two Vite frontends, 39 processes total as of 15 Oct 2026)
actually live for a closed/beta rollout, at the minimal tier —
not the full production-hardening, not the compliance/moderation
spend, not the big engineering team. Those are real, and they're
costed separately in `GO_LIVE_DOSSIER.md` §2b/§4c; this document does
not repeat them.

**Everything referenced here already exists and is verified as far as
this environment can verify it.** This is a pointer to real, tested
tooling, not a new build.

---

## Which path to use: pm2 + nginx, not Docker

`deploy/README.md` documents three real paths. For this engagement,
**use pm2 + nginx**, not Docker Compose, for one concrete reason: pm2
has actually been run end-to-end and verified live. (The process list
has grown to 37 apps as of 15 Oct 2026 — `deploy/ecosystem.config.js`
is regenerated from the live manifest each time, per the mandatory
step below, so this count moves on its own; it was 34 when this doc
was first verified.) Every health check answered 200, reload tested,
`pm2 save`/`startup` both produced real output. Docker Compose's config is
fully generated and validated (`docker compose config` parses clean,
volumes/env/cross-service URLs all checked), but **no image has ever
actually been built anywhere** — this sandboxed environment's own
network policy blocks Docker Hub's blob CDN, so `docker compose up
--build` has never been run for real, by anyone, against this repo.

That's not a defect in the repo — it's untested, not broken — but it
means the first real build is also the first real unknown. On a
one-time, cost-capped engagement, don't spend billable hours finding
out whether that unknown is real. If the engineer's own machine can
reach Docker Hub, Docker Compose is fine and arguably nicer long-term;
pm2 is just the path with zero remaining unknowns.

## The exact sequence (pm2 + nginx path)

```bash
# 1. Secrets — not optional, and order matters (see .env.example's own header)
cp .env.example .env
node scripts/generate-service-tokens.mjs >> .env
$EDITOR .env   # set ANTHROPIC_API_KEY; leave LIVEKIT_* empty unless doing real-time media now

# 2. Regenerate the pm2 process list from the current app manifest
node deploy/generate-ecosystem-config.js

# 3. Start everything
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints, once, as root

# 4. nginx — one domain, path-based routing, one TLS cert
node deploy/generate-nginx-conf.js yourdomain.com
# install the output (deploy/nginx-vaco.conf.example) as your real nginx site config,
# then get a cert (certbot/Let's Encrypt) for yourdomain.com and reload nginx

# 5. Verify
curl https://yourdomain.com/api/health          # vaco-shell, the front door
curl https://yourdomain.com/vdp/api/health      # spot-check one app through the proxy
pm2 status                                      # confirm 34+ online, only v4-proxy down if no API key yet
```

**Known, already-explained exceptions — don't treat these as new bugs:**
- `v4-proxy` refuses to start without `ANTHROPIC_API_KEY`. If that key
  isn't set yet, seeing it down is correct, not broken.
- `vaco-audit`, `vaco-operator`, `vaco-media` are headless by design —
  no frontend, nothing to smoke-test visually.
- `.replit`/`replit.nix` are first drafts, never run on a real Replit
  container. Don't use the Replit path for this engagement — use the
  VPS path above.

## Regenerating is mandatory, not optional, if anything changed

`docker-compose.yml`, `deploy/ecosystem.config.js`, and the nginx
configs are **generated files** — the one source of truth is
`start-ecosystem.sh`'s own app manifest. Re-run the three generators
above any time an app is added/removed or gains a new cross-app
`*_API_URL` reference, and never hand-edit the generated files. This
session already found and fixed one real drift
(`docker-compose.yml` was one line stale) before this handoff —
`scripts/test/deploy-readme.test.mjs` catches this class of bug if it
recurs; run it before trusting the generated files again.

## What's deliberately NOT in this engagement's scope

Per the cost conversation that produced the $1,600–5,200 figure:

- **Real-time media (LiveKit)** — leave `LIVEKIT_API_KEY`/`SECRET`
  empty. `vaco-media` fails soft and says so; nothing crashes. Wire it
  up later, separately, once the vendor/tier decision is made (see
  `GO_LIVE_DOSSIER.md` §4b and this conversation's own LiveKit Cloud
  free-tier note).
- **Compliance/moderation spend** ($95k–305k/yr for a play-money
  launch) — not needed for a closed/beta rollout. Needed before
  opening to the public, especially because of CVNVO and YAP.
- **Docker build-testing, TLS automation, off-host backups at scale**
  — real gaps, tracked in `GO_LIVE_DOSSIER.md` §8, genuinely optional
  at this tier.
- **VACON-C / VACANCY's own 9 remaining statistic gaps** — none of
  them block a launch; the sim already runs and answers 111 of 122
  statistics on a real generated world.

## Monthly cost after this engagement

Matches `GO_LIVE_DOSSIER.md` §7b's demo/pilot tier: **$30–70/month**
for one modest VPS (4GB/2vCPU is enough — the whole 36-app ecosystem
measures under 1GB of memory), plus a domain (~$15–40/year, TLS is
free via Let's Encrypt).

## One security note for whoever does this

`.env` holds real secrets (`ANTHROPIC_API_KEY`, the service-token
allowlist). Never commit it — `.gitignore` already excludes it, but
double-check before any `git add -A`. Hand the engineer the *generator
commands*, not a pre-filled `.env` file, so the real secrets are
generated fresh on the machine that will actually run them.
