# Tasks — Phase 6: real per-collaborator label deals

- [x] Trace the actual root cause across `labelDeals.js` and
      `releases.js` rather than assuming a single fix point.
- [x] `labelDeals.js` — `findActiveDealForRelease` now filters by both
      `releaseId` and `artistId`.
- [x] `labelDeals.js` — `signLabelDeal`'s per-release branch allows
      the release's primary artist OR any real co-writer.
- [x] `labelDeals.js` — `getActiveLabelDealForRelease` passes
      `artistId` through to the fixed `findActiveDealForRelease`.
- [x] `releases.js` — the label-deal lookup in `reportStreamingRevenue`
      now runs per collaborator, not gated behind `isPrimaryArtist`.
- [x] 6 plain-Node checks — all passing.
- [x] Live pass: real V3 + Vvltvre Music started (post-cutover
      defaults), a real two-co-writer release with two independent
      label deals, one revenue report, all four resulting balances
      confirmed against V3's own ledger.
- [x] Shut down all test servers.
- [x] Update `vulture-music/README.md` — new Phase 6 bullets in
      "What's here", a new "Verified" paragraph, and the resolved item
      removed from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Cross-collateralization (recoupment spanning multiple releases beyond
blanket's existing scope) remains the one other real, named gap in
this module -- not attempted here.
