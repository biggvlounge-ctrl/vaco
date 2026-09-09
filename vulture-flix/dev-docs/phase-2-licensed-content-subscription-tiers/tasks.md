# Tasks — Phase 2: licensed content + subscription tiers

- [x] Investigate: read `lib/titles.js` and `lib/subscriptions.js` in
      full; confirm both gaps are genuinely different economics, not
      extensions of the existing shape.
- [x] `lib/titles.js` — added `licenseNonExclusiveTitle`,
      `isLicenseActive`; `acquisitionType`/`acquisitionFee`/
      `licenseFee`/`licenseExpiresAt` added symmetrically to both
      record types; `watchTitle` rejects an expired license.
- [x] `lib/subscriptions.js` — added `SUBSCRIPTION_TIERS`,
      `TIER_FEES`, `TIER_MAX_SIMULTANEOUS_STREAMS`; `subscribe` takes
      an optional `tier` (default `'standard'`).
- [x] `server.js` — wired `POST /api/titles/licensed`; `/api/health`
      now exposes `subscriptionTiers`/`tierFees`/
      `tierMaxSimultaneousStreams`.
- [x] 9 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vulture-flix`: a real
      licensed title, a premium subscriber watching it, a license-
      expiry rejection isolated from subscription-lapse via the `now`
      testability parameter, an ad-supported subscriber's distinct
      fee, and invalid-tier/invalid-license-fee rejections, all over
      real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Concurrent-stream limit enforcement, co-production/multi-studio
acquisitions, and viewership-based bonus clauses remain real, flagged
gaps.
