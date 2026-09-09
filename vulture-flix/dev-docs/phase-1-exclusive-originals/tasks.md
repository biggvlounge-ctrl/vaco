# Tasks — Phase 1: Exclusive Originals

- [x] `lib/subscriptions.js` — `MONTHLY_FEE`, `subscribe` (charge +
      renewal, reactivation), `cancelSubscription`, `getSubscription`,
      `isSubscriber`.
- [x] `lib/titles.js` — types/statuses, `acquireExclusiveTitle` (real
      platform → creator payment, `ownershipRetainedPercent: 0`),
      `markStreaming`/`removeTitle`, `isExclusive` (date-driven),
      `getCatalog`, `watchTitle` (subscription-gated, zero-cost),
      `getWatchHistory`.
- [x] `lib/store.js` — `titles`, `watchEvents`, `subscriptions`.
- [x] `server.js` — real Express API, real injected `transferVCoin`
      against V3 (`venvs-mock-backend`).
- [x] `npm install`.
- [x] Verify in plain Node (24 checks): subscription gating including
      a non-subscriber blocked from an already-streaming title, the
      real monthly charge, cancel/reactivate, acquisition proven
      paying the creator via transfer-call arguments, validation, full
      lifecycle including illegal transitions, watch blocked
      pre-streaming/post-removal, a real watch event with zero money
      moved, catalog/creator listing.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: a title acquired with the studio's real balance
      confirmed increasing by the fee, a viewer blocked pre-
      subscription, the real subscription charge confirmed, a
      successful watch confirmed to move zero additional money.
- [x] Shut down the test server; confirmed via port check (left
      `venvs-mock-backend` running — shared infrastructure).
- [x] Write `README.md`, this plan/tasks pair — including the explicit
      structural contrast with `vulture-music`.

## Next
Licensed non-exclusive content. Multiple subscription tiers. Real
video delivery infrastructure. Viewership-bonus clauses on top of the
flat acquisition fee. Co-production/multi-studio acquisitions.
