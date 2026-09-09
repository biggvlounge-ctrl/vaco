# VACO Ecosystem — Completion Audit

**Date:** 2026-08-22 · **Method:** measured against the repo, not
recalled. Every number below came from running the code or counting the
files at audit time. Where a claim could not be verified, it says so.

Written to be cross-checked. If something here is wrong, it is wrong in
a way another reader can catch — that is the point.

---

## 1. Headline numbers

| Metric | Value | How it was measured |
|---|---:|---|
| Apps with a running server | **31** | `server.js` present + boots |
| Apps with a frontend | **31 / 31** | browser smoke test, all pass |
| Total API routes | **855** | counted incl. sub-routers |
| Automated tests | **522** | `node scripts/run-all-tests.mjs`; 0 failures |
| Apps with any test suite | **22 / 31** | `test/` directory present |
| Design-system adoption | **31 apps** | `sync-design-system.sh --check` clean |

Two additional Vite frontends (VDP, VENVS) exist and are not counted in
the 31 — they predate this system and build separately.

**Updated 2026-08-26.** The 29 above was 30: `vex-trading` was missed.
See §4.4 — it had a frontend, but a hand-maintained smoke list never
included it, and the page turned out not to use the design system at
all. Both are now fixed. It is 31 now that `vaco-notify` exists.

Test count over this pass: 391 → 404 (backup/restore) → 464 (the gate
tier: VACA, VEX, YAP) → 477 (the shared auth middleware) → 505 (VOKEN's
eight money flows) → **522** (vaco-notify).

> ### ⚠ Two things are NOT verified, and the numbers above do not cover them
>
> **Docker has never been build-tested.** `docker compose build` has
> never run, for any service. The compose file, Dockerfiles and nginx
> config are complete, consistent, and regenerate byte-identically from
> the manifest — and **none of that is the same as an image existing.**
> Docker Hub's blob CDN is blocked by proxy policy on the machine this
> was built on.
>
> **Backups are same-host only.** The restore is tested; the off-host
> sync has never run, and nothing has ever been restored from a remote
> copy.
>
> Both are environmental, both are tracked (#128, #125), and neither
> needs a decision — they need real infrastructure to run against.
> Details in §3.3b.

---

## 2. What is genuinely done

### Money
- **V3 ledger** is real and every paying surface settles through it.
  Transfers are two-sided and separately auditable; there is no reversal
  endpoint by design, so a correction is another transfer.
- **Idempotency** works — a retried transfer with the same key replays
  rather than double-charging.
- **Durability**: writes flush to disk before the response on every
  mutating route in 25 apps. Verified by `kill -9` mid-session; an
  acknowledged purchase survived.
- **One settlement path** (`void/lib/settlement.js`) for all 25 VOID
  verticals. Previously the engine covered 23 and two domain modules
  silently paid nobody.

### Identity & safety
- **Shield** is the single session authority; every app adopts a
  `?shieldToken=` handoff through one shared function.
- **VACA** verification gates real actions in consuming apps.
- **VSAFE** check-ins, screening, and escalation are real mechanics.
- **Licensing gates** on `cannabisDelivery` and `medicalTransportation`
  genuinely refuse. **Vetting gates** refuse unvetted providers on the
  verticals that require it.

### Commerce
- **App Store**: listings, entitlements, subscriptions with real expiry,
  refunds that reverse both money and access.
- **VACO Merch**: zero-inventory, platform fee on margin not retail,
  below-cost products refused at creation. Surfaces in the shell and in
  VDP.
- **VOID**: 25 verticals, 158 routes, the cross-vertical service day.

### Frontend
- **Design system** (`vaco-design.css` + `vaco-ui.js`) with structure
  shared and colour per-app, recorded in `VACO_PALETTE_REGISTER.md`.
- **31 frontends**, each a real client of its own API.
- **Smoke harness** (`scripts/smoke-frontend.mjs`) asserts tokens
  resolve, tabs render, and nothing is stuck loading.

---

## 3. What is NOT done — ranked by consequence

### 3.1 Real-time media — **the largest gap**
Six surfaces cannot do their core thing: Vvltvre Flix cannot play,
Vvltvre Pods cannot stream audio, Vavlt Stvdios cannot show a feed,
CHOPZ cannot play video, VENVM cannot generate media, DREAMS has no
display. Blocked on a **vendor decision, not effort**. Full analysis and
a per-product recommendation: `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`.

### 3.2 Test coverage — **9 of 31 apps still have no tests**

**Updated 2026-08-26 — the gate tier is now covered.** VACA (17), VEX
(16), and YAP (20) all have suites, and V3 gained 7 more. The table
below is left as it stood, with the three struck through, because *how*
they were untested is the useful part.

**Testing the gates found a real bug in the ledger.** A VEX test passed
`pricePerUnit: NaN`, which reached V3 through `quantity * pricePerUnit`.
Both `v3/lib/vcoin.js` and `v3/lib/vash.js` guarded amounts with
`typeof amount !== 'number' || amount <= 0` — and **NaN passes both**:
`typeof NaN === 'number'` is true, `NaN <= 0` is false. So is the
insufficient-balance check right after it, since `fromBalance < NaN` is
also false. Nothing in the path stopped it.

The consequence was not one bad transaction. Both balances become NaN,
NaN propagates through every later sum on those accounts, and V3 has no
reversal endpoint by design — so the documented correction, another
transfer, reads the poisoned balance and stays poisoned. **A single NaN
permanently destroyed two accounts.** Fixed with `Number.isFinite` in
both modules plus the VEX caller, and locked down by
`v3/test/nonFiniteAmounts.test.js`.

Worth noting how it arrived: not somebody typing NaN, but arithmetic on
a field that came in as `undefined`, an empty form input, or a string
that failed to parse. Every one of those produces NaN silently. The bug
had been reachable from any of 855 routes that multiply a quantity by a
price.

**Every app that moves real VCoin is now covered.** Six suites added
since the first audit — vacay (22), voidmagic (16), vxllage (13),
vulture-flix (12), chopz-shop (11), vulture-studios (11) — all written
against transfers, balances, and conservation identities rather than
statuses, because a status is exactly what stays correct while the money
goes wrong.

Still untested, by route count. None of these move money, which is why
they are now below the notification gap in priority:

| App | Routes | What is at risk |
|---|---:|---|
| cvnvo | 59 | safety gates, message screening, compatibility |
| hvntz | 40 | hunt progress, break recommendations, neighbours |
| dreams | 22 | screen revenue splits (recorded, not settled) |
| vulture-pods | 17 | listen counts, subscriptions |
| vacon-c | 8 | simulation state and tick |
| ~~vaca~~ | ~~8~~ | ✅ **done** — 17 tests |
| vaco-analytics | 7 | metric ingest and alerting |
| ~~vex~~ | ~~7~~ | ✅ **done** — 16 tests |
| chopz | 5 | linked-product verification |
| ~~yap~~ | ~~5~~ | ✅ **done** — 20 tests |
| v4-search | 2 | fan-out routing |

The three shared one shape — *a gate other apps trust* — and the reason
they were the priority holds up in hindsight: **a gate that silently
stops gating is worse than one that was never built, because the callers
believe it.** Each suite asserts on the refusal, never on a status.

What each turned out to be protecting:

- **VACA** — before VACA existed, VOKEN's `POST /api/card/:id/value-score`
  trusted whatever `authenticityGrade` the caller put in the body. Every
  test here is one shape: a grade must never appear where nothing was
  approved. Pending, rejected, and absent all resolve to `null`.
- **VEX** — the `vex-brokerage` gate is closed by default and must be
  consulted *before* the card is fetched, priced, or settled. Also
  proven: an unknown gate name throws rather than reading as closed,
  which would hide the typo behind a plausible refusal.
- **YAP** — the verified-reporter check rejects outright rather than
  weighting, a refused report never lands in the store, and the
  decoupling from CVNVO matching is asserted *structurally* (yap.js may
  not require CVNVO's matching, profiles, or store), because that is the
  documented guarantee and it is a property of the code, not of a value.

**Still untested, now the top of the list:** `cvnvo` (59), `hvntz` (40),
`dreams` (22), `vulture-pods` (17), `vacon-c` (8), `vaco-analytics` (7),
`chopz` (5), `v4-search` (2). Under the constellation grouping in
`VACO_CONSTELLATIONS.md`, the first three plus yap sat together in the
VOID square holding 126 of the ecosystem's untested routes; yap is now
covered, and cvnvo/hvntz/dreams are what remain of that concentration.

### 3.3 No persistence in some services
- **v4-proxy** — deliberate and documented (a call restored from disk is
  ringing at nobody). But its *fallback messages* genuinely should
  survive, and its own header says so.
- **Shield** — check its persistence posture before relying on
  long-lived tokens.

### 3.3b Blocked by this environment — **not verified, do not assume**

Two items are complete in code and **cannot be exercised from the
machine this was built on.** Neither is a judgment call or a
deprioritisation; both need real infrastructure. They are called out
here because the surrounding sections read as "done", and these must
not be read the same way.

| | Status |
|---|---|
| **No Docker image has ever been built.** `docker compose build` has never run — not once, for any service. Docker Hub's blob CDN is blocked by proxy policy here (`production.cloudfront.docker.com` → 403 on CONNECT), so `node:20-alpine` cannot be pulled. The daemon itself starts fine; the base image is unreachable. | **UNTESTED** |
| **Backups are same-host only.** `scripts/backup-stores.mjs` runs and its restore is tested, but the off-host sync in `DISASTER_RECOVERY.md` §6 has never been executed and nothing has ever been restored *from* a remote copy. Snapshots survive a bad deploy; they do not survive losing the machine. | **UNTESTED** |

**What was done instead of claiming the Docker path works:** every
VACO-*specific* risk was checked statically — build-context escapes
(none), env completeness, credential consistency across V3's allowlist
and its 16 callers, `.dockerignore` hygiene (now enforced by the
generator), lockfile coverage. Those checks found three real bugs. They
do not substitute for a build. See `dev-docs/DEPLOYMENT_INVENTORY.md`
for the full verified/not-verified split.

Tracked as tasks #128 and #125.

### 3.4 Hardware-dependent, by nature
- **VOID**: drones, docks, Port Stations, lockers. Software models them;
  none exist.
- **DREAMS**: no physical screens.
- Both are separate budget lines, not software gaps.

### 3.5 Integrations that are seams, not connections
| Seam | Where | State |
|---|---|---|
| Printify / Printful | `merchStore.js` | `submitToFulfilment` records intent; nothing ships |
| Anthropic API | v4-proxy | routing is real; completions need a key |
| PMS (Yardi/Entrata/etc.) | VOID lockers | a recorded target field |
| Road routing | VOID service day | straight-line at assumed speed |
| ~~Notification channel~~ | VSAFE, DREAMS, VACO Analytics | ✅ **built and wired** — `vaco-notify` (8818). All three callers deliver end to end, verified live |
| Document verification | VACA | approval is a human act; no vendor |
| GDS / airline | VACAY flights | inventory is VACAY's own |

### 3.6 Known missing gates
- **YAP has no moderation queue.** Nothing reviews a report before it
  counts toward a subject's signal. Flagged on the surface itself.
- ~~**`requireSession()` does not cross-check identity.**~~ **CLOSED
  2026-08-26 — and this entry badly understated it.** It described an
  authorization gap: an attacker needs a valid session, then names
  someone else. The reality was that ten of twelve apps had no
  `requireSession` on those routes at all — they mounted
  `optionalOwnAccount` alone, whose first line was
  `if (!token) return next()`. **Sending no token was the bypass**, so
  thirteen money-moving routes had no authentication whatsoever,
  including V3's own `POST /api/vcoin/transfer`. Demonstrated live: one
  unauthenticated curl moved 500 VCoin out of a stranger's wallet.
  Fixed with `requireActor`; full write-up in
  `dev-docs/AUTH_HARDENING.md`.

  **Worth keeping for the pattern:** 464 tests passed while this was
  open, because every one exercised a library function directly and the
  hole lived entirely in the middleware wiring. Three separately
  reasonable decisions — an honestly-named optional middleware, a
  deliberately permissive `observe` migration default, and task #98
  closed by adding that middleware — were only dangerous in
  combination, and nothing tested the composition.

  **A full route-authorization pass followed** and found four more,
  all in one class — *the gates that are supposed to be hard to change*.
  An unauthenticated POST could open VEX's live-trading gate, VOKEN's
  fractional-ownership gate, the `influencer-culture-card-rewards` gate
  held closed pending review, and approve any VACA authenticity claim
  under any reviewer's name. All four verified live, all four now 401.
  Full classification of every mutating route:
  `dev-docs/ROUTE_AUTHORIZATION_AUDIT.md`.

  **This became a standing category, not a one-time fix.** Three
  separate security bugs this session had the same shape — the wallet
  drain, VOKEN's four unguarded trade routes, and vxllage's four
  ownership-lookup routes — and none was a logic bug. Every library
  function involved was correct in isolation. What was wrong each time
  was *which middleware was mounted on which route*, which no unit test
  can see by construction. See
  `dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md`.

### 3.7 Paused by decision — do not "fix"
- **VACON-C** civ-sim expansion (scoped to the live 5-endpoint contract).
- **Kyle** stays scoped to the dead-time mechanic.
- **`influencer-culture-card-rewards`** closed pending review.
- **Live-trading interlock** never bypassed.
- **GitHub push** — confirmed broken (403 scope); local commits only.

---

## 4. Corrections to earlier claims in this session

Recorded because an audit that only confirms itself is worthless.

1. **"All 25 apps have frontends" was incomplete.** Four apps with real
   servers were missed: `v4-proxy` (28 routes, including the whole Maps
   layer), `v4-search`, `vaco-analytics` (had a `wallboard.html` but no
   index, so `/` 404'd), and `yap`. All four now built and passing —
   the count is 29.
2. **My route-count regex assumed single quotes.** Three apps use
   double quotes and reported as having zero routes. The corrected total
   is 855, not the ~700 implied earlier.
3. **VACAY's route count was reported as 1.** Its routes live in four
   sub-routers; the real figure is 62.

### 4.4 Added 2026-08-26 — the frontend count was 30, not 29

Found while building CI (task #118), and found *by* a change made for
CI rather than by looking harder.

`scripts/smoke-frontend.mjs` took its targets from a list typed on the
command line. Adding `--all`, which reads the `APPS` array in
`start-ecosystem.sh` — the same manifest `install-ecosystem.sh` and the
deploy generators already parse — immediately surfaced a 30th app that
had never been smoke-tested: **`vex-trading`**, the parent front door
for VEX and Vex Business.

It failed on the first run, and not marginally: no masthead, no design
tokens resolving, no accent, no tabs. The page carried its own
hand-rolled stylesheet with its own `--bg`/`--panel`/`--accent`
variables and never loaded `vaco-design.css` or `vaco-ui.js` — **even
though `sync-design-system.sh` had been copying both into its
`public/` all along.** The drift check compared the synced files and
found them current, which they were. Nothing checked that anything
imported them.

Rebuilt on the design system; smoke is now 30/30. Two things worth
keeping from it:

- **A synced file nobody imports is drift `--check` cannot see.** The
  check verifies copies match the source, not that they are used.
- **A hand-maintained list is a list that silently stops covering the
  newest thing.** This is the exact failure the audit's own §4.1
  recorded ("all 25 apps have frontends" was incomplete), recurring in
  a different place for the same reason. Both `run-all-tests.mjs` and
  `smoke-frontend.mjs --all` now discover rather than enumerate.

---

## 5. Open questions for the founder

Not blockers, but each changes what gets built next:

1. **Media vendor** — the split-by-product recommendation needs a yes.
   Cheapest first step: Vvltvre Pods with audio.
2. ~~**Which untested app gets tests first?**~~ — done. Every
   money-moving app now has tests. The next tier is the *gates other
   apps trust*: VACA, VEX, and YAP.
3. **Does YAP need a moderation queue before it is usable?** It is a
   reporting tool with real consequences and no review step.
4. **Per-app typography** — the palette register deliberately kept
   per-app identity to colour only. Whether apps get distinct typefaces
   is still open.
5. ~~**Notification channel**~~ — built as `vaco-notify`, and all
   three callers are now wired and verified live:

   | Caller | Event | Severity |
   |---|---|---|
   | VSAFE | emergency triggered, missed check-in swept | `critical` |
   | DREAMS | campaign budget exhausted, screen went offline | `alert` |
   | VACO Analytics | z-score anomaly detected | `alert` |

   **Only VSAFE fails hard.** Its escalation reports its own delivery
   failure in the response, because the product promise is that
   somebody finds out. DREAMS and Analytics fail soft — holding up an
   ad impression because a webhook is slow is the wrong trade, and a
   pager that fires for ad budgets gets muted, after which the real one
   is missed too. Severity `critical` is reserved for safety.

---

## 6. How to verify any of this

```bash
./sync-design-system.sh --check       # design system copies current
./start-ecosystem.sh                  # boot everything
node scripts/smoke-frontend.mjs \
  vaco-shell:8789 void:8793 ...       # every frontend, in a browser
cd void && npm test                   # 124 tests
```

The smoke harness fails on: runtime not booting, design tokens not
resolving, a tab throwing, or a tab stuck on "Loading…". It caught two
real bugs during this session that reading the code did not.
