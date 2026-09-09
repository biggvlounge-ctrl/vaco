# Tasks — Phase 13: real HVNTZ Affiliate Network verification

- [x] Investigate: confirmed `isHvntzOnboarded` was caller-declared;
      confirmed HVNTZ's own `GET /api/business/:id` now exists;
      grepped for other callers of `registerAffiliateStation` (found
      only the one real route).
- [x] `lib/externalIntegration.js` — `registerAffiliateStation` made
      async, gained real `hvntzBusinessId` + injected `hvntzFetchFn`,
      removed the old bare boolean entirely.
- [x] `server.js` — added `HVNTZ_API_URL` + `fetchHvntzBusiness`
      client, wired into the `POST /api/affiliate-station` route
      (now async).
- [x] 7 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `hvntz` + `void`: real
      business registered; unverified station confirmed unaffected;
      verified station confirmed succeeding with the real name stored;
      station against a nonexistent business confirmed rejected.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Real demand forecasting for Kyle — a separate, larger, real gap.
