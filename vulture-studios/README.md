# Vvltvre Studios

`VVLTVRE -> STUDIOS` — the newest Vvltvre division, alongside VOID
MAGIC (`VVLTVRE -> TOURING & TIX`), Vvltvre Music/Distribution
(`VVLTVRE -> MUSIC/DISTRIBUTION`), Vvltvre Flix (`VVLTVRE -> FLIX`),
and Vvltvre Pods (`VVLTVRE -> PODS`). Built against the real, named
comparable given for it: **a Universal-Studios-style production-
financing company that funds and produces projects**, not another
distribution business.

Confirmed genuinely new by direct grep across the whole repo before
building anything: no "Vvltvre Studios" concept, under any name,
existed anywhere in this codebase or its docs.

**The real structural difference from every other Vvltvre division.**
Vvltvre Music, Vvltvre Flix, and Vvltvre Pods are all real
*distribution* businesses — they acquire, license, or distribute
already-existing or independently-financed content. None of them puts
up the money to make something exist in the first place. Vvltvre
Studios is the real *financing* layer that can sit before all of
them: a real financing round raises real capital from investors, the
studio moves the project through a real production pipeline, and once
it's complete and earning real revenue, every investor gets a real,
proportional, ongoing share of that revenue — much closer to
`../vulture-music/lib/releases.js`'s own co-writer percentage-split
payout discipline (reused directly for the payout math, not
reinvented) than to any of Vvltvre Flix's flat one-time acquisition-
fee shapes.

## Run
```
cd ../v3 && npm install && npm start                # localhost:8811 (VCoin ledger)
cd ../vulture-flix && npm install && npm start       # localhost:8807 (distribution target)
cd vulture-studios && npm install && npm start       # localhost:8815
```

## Test
```
curl http://localhost:8815/api/health

curl -X POST http://localhost:8815/api/projects -H "Content-Type: application/json" -d '{
  "title":"The Vvltvre Heist","medium":"film","synopsis":"A heist movie.","budgetRequested":1000
}'

curl -X POST http://localhost:8815/api/projects/1/invest -H "Content-Type: application/json" -d '{
  "investorId":"investor-a","amount":700
}'
```

## What's here
- `lib/projects.js` — the real core loop. `PROJECT_MEDIUMS` (`film`,
  `tv`, `music`, `podcast`), `PROJECT_STATUSES` (`greenlit` ->
  `funded` -> `in-production` -> `completed`).
  - `greenlightProject` creates a project with a real, caller-supplied
    `budgetRequested` — deliberately not looked up from a fixed rate
    card, since real production budgets vary by project the same way
    Vvltvre Flix's own `acquisitionFee` does.
  - `investInProject` is the real financing round: a real investor's
    capital moves via `transferFn` into the studio's own production
    account, capped so the round can never overfund past the real
    remaining budget, and only open while the project is still
    `greenlit` — once production starts, financing is closed, the
    same way a real film's financing round closes before principal
    photography begins. Reaching the exact budget auto-advances the
    project to `funded`.
  - `getProjectEquity` returns every real investor's real,
    contribution-derived equity percentage, computed directly from
    their real contribution against the real total raised — not a
    separately-tracked, driftable field.
  - `startProduction` / `completeProject` move the project through
    the rest of its real, guarded lifecycle. `finalAssetUrl` is a
    real, honestly-nullable, caller-supplied field — no real video/
    audio rendering pipeline exists in this environment, the same
    class of gap already flagged in Vavlt Stvdios' own `streamUrl`
    and VENVM's own `videoUrl`.
  - `recordDistribution` / `reportProjectRevenue`: once a completed
    project earns real revenue, every real investor gets their exact
    proportional share, reusing `releases.js`'s own exact-sum-
    rounding discipline (every payout but the last is rounded
    independently; the last absorbs whatever remainder is left, so
    payouts always sum to exactly the reported amount).
  - **Rounding-precision fix, caught by a real failing unit test**:
    the first draft computed each investor's payout share directly
    from `getProjectEquity`'s own already-rounded (2-decimal) display
    percentage, compounding two separate rounding steps and quietly
    shortchanging every investor but whichever one absorbed the final
    remainder (`100 * round(1/3)` = `100 * 0.33` = `33`, not the
    correct `33.33`). Fixed with an internal `getInvestorContributions`
    helper that keeps every investor's raw, unrounded contribution
    total, and `reportProjectRevenue` now computes its payout fraction
    directly from that raw total — `getProjectEquity`'s own returned
    `equityPercent` stays rounded, correctly, for display only.
- `server.js` — full Express app, port 8815. Routes: `POST
  /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `GET
  /api/projects/:id/equity`, `POST /api/projects/:id/invest`, `POST
  /api/projects/:id/start-production`, `POST
  /api/projects/:id/complete`, `POST /api/projects/:id/distribute`,
  `POST /api/projects/:id/revenue`.
  - `transferVCoin` — the same real, live call into V3's own ledger
    used by every other app in this ecosystem.
  - `pushMetric` — fail-soft push of `project_financing_raised` and
    `project_revenue_distributed` to VACO Analytics, same posture as
    every other app's own metrics call: a real investment or revenue
    report is never held up by analytics being down.
  - **Real cross-app distribution into Vvltvre Flix**: `POST
    /api/projects/:id/distribute` is only wired for `film`/`tv`
    projects in this phase — music/podcast projects distribute
    through Vvltvre Music's/Vvltvre Pods' own existing real submission
    flows directly, since their flat-fee, creator-retains-ownership
    shape already fits a self-financed project honestly with no new
    integration needed. This is a deliberate scope boundary, flagged
    here rather than silently built deeper or silently left undone.
    `registerWithVultureFlix` calls Vvltvre Flix's own new, honest
    third acquisition path (see below) — no fabricated second fee on
    top of the real financing already paid.
  - **Fetch-failure classification, caught proactively before any
    test ran**, recognized from the identical bug DREAMS'
    generate-creative route hit and fixed earlier this session: a
    real connection failure (Vvltvre Flix unreachable) throws Node's
    own generic `"fetch failed"`, which a naive substring check on a
    function name would never match. `registerWithVultureFlix` wraps
    its own fetch and rethrows with a reliable `"distribution call
    failed: "` prefix; the route matches on that exact prefix to
    return a real `502` (upstream/connectivity failure) instead of a
    `400` (validation error).

## Real music/podcast distribution (Phase 2)
Closes this README's own previously-flagged gap. `POST
/api/projects/:id/distribute` now handles every medium this app
supports, not just film/tv. For `music`/`podcast` projects, it hands
off directly into Vvltvre Music's own already-real, already-tested
distribution economics — `registerWithVultureMusic` in `server.js`
POSTs to Vvltvre Music's real `POST /api/releases`, deliberately
reusing that mechanism rather than building a second, parallel one:

- `artistId` is `VULTURE_STUDIOS_PRODUCTION_ACCOUNT` — the same real
  account every investor's financing already sits in — so the studio
  itself pays Vvltvre Music's real, flat, TuneCore-style distribution
  fee, the same real-world shape as a label paying to distribute a
  record it financed.
- `format` maps `music` -> Vvltvre Music's real `single` format and
  `podcast` -> its real, already-standalone `podcast-episode` format.
  That format's own header comment already describes it as "a
  standalone item... with no concept of a running series" — the exact
  shape of a one-off Vvltvre Studios project — so no Vvltvre Pods
  Show/Episode wrapper is fabricated here to carry metadata
  (category, episode number, duration) this project's own schema
  doesn't have. A deliberate, flagged simplification.
- `coWriters` is this project's own real investors, reshaped from
  their real raw contribution totals into Vvltvre Music's own
  `{userId, splitPercent}` shape via the new, exported
  `getInvestorCoWriterSplits` in `lib/projects.js`. This is the real
  point of the whole hand-off: once this release goes live and real
  streaming revenue is reported *there*, Vvltvre Music's own
  `reportStreamingRevenue` pays every investor directly and
  proportionally on its own — no second call back into this app is
  needed for that medium, unlike film/tv (see below).
- `reportProjectRevenue` gained a real, deliberate guard: a project
  once distributed through Vvltvre Music (`distributionApp ===
  'vulture-music'`) now rejects a call to this app's own revenue
  endpoint, naming the real correct endpoint
  (`POST /api/releases/:id/revenue`) to use instead — without this,
  the same money could appear to have two independent, competing
  "real" payout paths.
- A real, previously-missing status check was also added: `distribute`
  now rejects a non-`completed` project before making ANY cross-app
  call (film/tv included) — previously, `recordDistribution`'s own
  status check ran only after the external call had already fired,
  which could have created a real title/release for an unfinished
  project.

**Live-verified** against real running V3/Vvltvre Music/Vvltvre
Studios instances: a real music project financed 70/30 by two
investors, completed, and distributed — confirmed Vvltvre Music
created a real release with `coWriters: [{inv-a, 0.7}, {inv-b, 0.3}]`
and charged the studio's own production account the real distribution
fee (independently re-confirmed via Vvltvre Music's own separate `GET
/api/releases/:id`). Confirmed this app's own `/api/projects/:id/revenue`
now honestly rejects a call for that same project. Advanced the real
release through Vvltvre Music's own `distributing` -> `live` gate and
reported real streaming revenue there — confirmed the exact real
70/30 payout landed directly in both investors' V3 balances, with zero
code in this app moving that money. A real podcast project confirmed
the `podcast-episode` format and single-investor 100% split map
correctly. A real pre-completion `distribute` call confirmed the new
status check rejects it with an honest `400`, before any cross-app
call fires.

## Vvltvre Flix side: `registerStudioProducedTitle`
`../vulture-flix/lib/titles.js` gained a real, new, third title-
creation path — `registerStudioProducedTitle` — alongside its existing
`acquireExclusiveTitle` and `licenseNonExclusiveTitle`. Both of those
hard-require a positive fee, making them unsuitable for a title that
was already fully financed here in Vvltvre Studios: forcing a
fabricated second fee through either existing path would have double-
charged the project. The new path creates the title record with
`acquisitionType: 'studio-produced'`, `acquisitionFee: null`,
`licenseFee: null`, `ownershipRetainedPercent: 0`, and a real
`studioProjectId` cross-reference back to this app — and deliberately
calls **no** `transferFn`, since the real payment already happened as
production financing, tracked entirely in Vvltvre Studios' own ledger.
Exposed as `POST /api/titles/studio-produced` on Vvltvre Flix's own
`server.js`.

## Live-verified
Full real flow via curl against real running servers (V3, Vvltvre
Flix, Vvltvre Studios, VACO Analytics): greenlit "The Vvltvre Heist"
(film, budget 1000) -> two real investors financed it (700 + 300,
exact V3 balance changes confirmed, auto-advance to `funded`
confirmed at the exact budget) -> `start-production` -> `complete`
(`finalAssetUrl` confirmed honestly null) -> `distribute` (the real
cross-app call confirmed to succeed: Vvltvre Flix created a real title
with `acquisitionType:"studio-produced"`, `acquisitionFee:null`,
`ownershipRetainedPercent:0`, `studioProjectId:1` — independently
re-confirmed by querying Vvltvre Flix's own separate `GET
/api/titles/:id` directly, not just trusting Vvltvre Studios' own
success response) -> reported real project revenue (100 VCoin, source
`box-office`) and confirmed the exact real 70/30 payout split via
direct V3 balance checks (investor-a: 300 -> 370, investor-b:
700 -> 730) and via `GET /api/projects/:id/equity`.

The real, honest-failure distribution path was also live-verified: a
second, fully-completed project's `distribute` call against a
deliberately-killed Vvltvre Flix process returned the real, correct
`HTTP 502 {"error":"distribution call failed: fetch failed"}` — proving
the fetch-failure-classification fix, not just asserting it.

5 plain-Node unit tests covering `greenlightProject` validation,
`investInProject`'s budget cap and auto-advance-to-`funded`, the
rounding-precision fix in `reportProjectRevenue` (the exact case that
originally failed: three investors at 100/100/100 sharing 100 in
revenue, confirmed splitting 33.34/33.33/33.33 — exact-sum, not the
previously-buggy 33/33/33 undershoot), and the full status-guard chain
(`startProduction`/`completeProject`/`reportProjectRevenue` all
rejecting out-of-order calls) — run to green, then deleted (scratch
only, never committed).

## Real persistence
`lib/persistence.js` (the same shared module every app in this
ecosystem uses) wraps `server.js`'s own store — `data/store.json`
(port 8815) — so a real project's state survives a restart.

## Not yet built
- A VDP district (a real Studios lot/backlot district, the same
  pattern every other Vvltvre division and the beat marketplace
  already got) — not yet built as of Phase 1/2; see VDP's own
  dev-docs once it lands.
- Real production financing safeguards a real studio would have —
  refunds if a project fails to reach full funding by a deadline, a
  minimum-investment floor, secondary resale of an investor's stake
  before the project completes (VOKEN's own fractional-share resale
  module is the real, existing precedent for that last one, not
  reused here yet).
- Real content delivery/rendering — `finalAssetUrl` is a real,
  honestly-nullable pointer, not an actual production pipeline.
