# Tasks — Phase 10: secondary resale market for fractional shares

- [x] Investigate: read `lib/fractionalOwnership.js` in full; confirm
      no secondary transfer path exists; find Rally's real, cited
      90-day lockup figure in `VOKEN_MASTER_SPEC_PROGRESS.md`.
- [x] `lib/fractionalOwnership.js` — added `SECONDARY_LOCKUP_MS`;
      `buyShares` now sets/extends `lockedUntil` on primary purchase;
      added `createSecondaryListing`, `getSecondaryListing`,
      `listOpenSecondaryListings`, `cancelSecondaryListing`,
      `buySecondaryShares`; `getFractionalHoldings` now surfaces
      `sellableShares`/`lockedUntil` and skips zeroed-out holdings.
- [x] `lib/store.js` — added `secondaryListings`/
      `nextSecondaryListingId`.
- [x] `server.js` — wired `POST /api/fractional/secondary-listing`,
      `GET /api/fractional/secondary-listing/:id`,
      `GET /api/fractional/listing/:id/secondary-listings`,
      `POST /api/fractional/secondary-listing/:id/cancel`,
      `POST /api/fractional/secondary-listing/:id/buy`.
- [x] 10 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `voken`: a real
      card/edition minted, a real fractional listing bought into, an
      immediate secondary-listing attempt rejected with the real
      lockup timestamp, a future-dated listing created and bought by
      a second real buyer with real peer-to-peer settlement and
      immediately-resalable new shares confirmed, plus double-
      purchase/self-purchase/non-seller-cancel all rejected, all over
      real HTTP.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
A real registered-ATS-style order book and per-share-lot lockup
cohort tracking remain real, flagged gaps.
