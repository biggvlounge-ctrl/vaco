# Phase 1 — DREAMS core buildable slice — tasks

- [x] Confirmed by direct grep across the whole repo that no DREAMS
      implementation exists under any name, and read every real
      source doc that references it (`hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`,
      `HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md`, `voidmagic/VOID_MAGIC_MASTER_BUILD_BRIEF.md`,
      `voken/VOKEN_NEW_VALUE_ALGORITHM.md`, `venvs/CLAUDE.md`) before
      designing anything.
- [x] Confirmed HVNTZ's own `lib/adReview.js`/`lib/adPricing.js` are a
      real, narrower, HVNTZ-local feature — a different shape from
      DREAMS' own standalone marketplace, not a duplicate to avoid
      building, and not touched by this phase.
- [x] `package.json`, `.gitignore` — standard shape.
- [x] `lib/persistence.js` — copied verbatim from the ecosystem's
      shared pattern.
- [x] `lib/store.js` — `createDreamsStore()`.
- [x] `lib/screens.js` — `registerScreen`, `getScreen`,
      `listActiveScreens`, `deactivateScreen` (owner-scoped),
      `getScreenRevenue`.
- [x] `lib/advertisers.js` — `signUpAdvertiser`, `getAdvertiser`.
- [x] `lib/campaigns.js` — `createCampaign`, `selectScreens`,
      `setCreative`, `generateCreativeText`, `setBudget`,
      `launchCampaign`, `recordImpression` (real 70/30 split, two real
      transfers), `getCampaign`, `listCampaignsForAdvertiser`.
- [x] `server.js` — full Express app on port 8814, `transferVCoin`,
      `invokeViaV4Proxy`, `pushMetric`, all routes wired.
- [x] `npm install`.
- [x] 6 real unit tests, run and passed, scratch test file removed
      after.
- [x] Live verification: registered a real screen, signed up a real
      advertiser, walked a real campaign through every step
      (select-screens → creative → budget → launch), recorded a real
      impression, confirmed exact real V3 balance changes (advertiser
      −10, screen owner +7, `dreams-platform` +3), confirmed
      `GET /api/screens/:id/revenue` aggregation, confirmed the real
      `screen_revenue` metric in VACO Analytics.
- [x] Found and fixed a real bug during live verification:
      `/api/campaigns/:id/generate-creative`'s error-status logic
      misclassified a real `fetch failed` connection error as 400
      instead of 502 (the substring check for `"invokeViaV4Proxy"`
      never matched a raw connection failure). Fixed by having
      `generateCreativeText` rethrow with a reliable
      `"completion failed: ..."` prefix; reverified the fix returns a
      real 502.
- [x] Restart-survival confirmed (killed `dreams`, restarted it, same
      real campaign/screen data came back unchanged).
- [x] Test/runtime artifacts cleaned up (`v3/data`, `dreams/data`,
      `vaco-analytics/data`, logs).
- [x] README.md — source-material honesty, HVNTZ scope boundary,
      revenue-split decision, run/test, verified, not yet built.
- [x] plan.md / tasks.md (this file).

## Next
- Add DREAMS to `start-ecosystem.sh`'s app manifest and generate a
  `deploy/ecosystem.config.js`/nginx entry for it (same pattern as
  every other real backend).
- A VDP district, once a screen/campaign UI is worth surfacing.
- DREA's own placement-matching intelligence (contextual relevance,
  competitor exclusion, ad tiers, dynamic pricing) — a real, much
  larger phase, deliberately deferred per the explicit "start with the
  core" instruction.
