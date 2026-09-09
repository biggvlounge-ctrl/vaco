# Tasks — Phase 1: fund-and-produce core

- [x] Grepped the whole repo for any existing "Vvltvre Studios"
      concept under any name — confirmed genuinely new.
- [x] Investigated Vvltvre Flix's existing `acquireExclusiveTitle` /
      `licenseNonExclusiveTitle` paths, confirmed both hard-require a
      positive fee and are unsuitable for an already-financed title.
- [x] Built `vulture-studios/package.json`,
      `lib/persistence.js` (copied verbatim from `venvm`), `lib/store.js`.
- [x] Built `lib/projects.js`: `greenlightProject`, `getProject`,
      `listProjects`, `investInProject`, `getProjectEquity`,
      `startProduction`, `completeProject`, `recordDistribution`,
      `reportProjectRevenue`.
- [x] Built `server.js`: full Express app on port 8815, real
      `transferVCoin` + fail-soft `pushMetric`, all routes.
- [x] Added `registerStudioProducedTitle` to
      `../vulture-flix/lib/titles.js` and its `module.exports`.
- [x] Added `POST /api/titles/studio-produced` route to
      `../vulture-flix/server.js`.
- [x] Wrote `registerWithVultureFlix` in `vulture-studios/server.js`;
      proactively caught and fixed the fetch-failure-classification
      bug (recognized from the DREAMS precedent) *before* running any
      test — wrapped the fetch in try/catch, rethrown with a reliable
      `"distribution call failed: "` prefix.
- [x] `node --check` on every new/modified file — passed.
- [x] `npm install` in `vulture-studios/` — 71 packages, succeeded.
- [x] Wrote 5 real unit tests to a scratchpad file, ran them — 1
      FAILED (`33 !== 33.33`).
- [x] Diagnosed the rounding-precision bug: `reportProjectRevenue` was
      reusing `getProjectEquity`'s already-2-decimal-rounded
      `equityPercent` for its own payout math, compounding two
      rounding steps.
- [x] Fixed: added internal `getInvestorContributions` helper
      returning raw, unrounded per-investor totals; rewrote
      `reportProjectRevenue`'s payout loop to compute its fraction
      from the raw total, never the pre-rounded display value.
- [x] Re-ran all 5 tests — all passed, including the exact
      33.34/33.33/33.33 exact-sum case. Deleted the scratch test file.
- [x] Started real servers: V3 (8811), Vvltvre Flix (8807), Vvltvre
      Studios (8815), VACO Analytics (8790) — confirmed all healthy.
- [x] Live-verified the full real flow via curl: greenlight -> two
      real investors finance it (exact V3 balance changes confirmed,
      auto-advance to `funded` confirmed) -> start-production ->
      complete (`finalAssetUrl` confirmed honestly null) -> distribute
      (real Vvltvre Flix title created, independently re-confirmed via
      Vvltvre Flix's own separate `GET /api/titles/:id`) -> revenue
      report (exact 70/30 split confirmed via direct V3 balance
      checks and via `GET /api/projects/:id/equity`).
- [x] Created a second project, financed/started/completed it, killed
      Vvltvre Flix, called `distribute` again — confirmed the real,
      correct `HTTP 502 {"error":"distribution call failed: fetch failed"}`.
- [x] Killed all test server processes; removed all four apps' live
      test `data/` directories (runtime state, gitignored, not meant
      to ship).
- [x] Wrote this README + dev-docs; updated Vvltvre Flix's own
      README + added its own dev-docs entry for
      `registerStudioProducedTitle`.
- [x] Added `vulture-studios` to `start-ecosystem.sh`'s `APPS`
      manifest; regenerated `deploy/nginx-vaco.conf.example` via
      `node deploy/generate-nginx-conf.js`; hand-added the matching
      entry to `deploy/ecosystem.config.js` (no generator script exists
      for that file — mechanically mirrored the existing entries'
      exact shape).

## Next
A real VDP district for Vvltvre Studios (a Studios lot/backlot,
matching the pattern every other Vvltvre division and the beat
marketplace already got) is the natural next piece, not yet built —
see README's own "Not yet built" section.
