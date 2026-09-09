# Tasks — Phase 1: Flat-Fee Distribution

- [x] `lib/releases.js` — formats, targets, fee schedule, statuses,
      `submitRelease`, `getRelease`, `listReleasesForArtist`,
      `markDistributing`/`markLive`/`takeDown`,
      `reportStreamingRevenue`, `getArtistSummary`.
- [x] `lib/store.js` — `releases`, `revenueReports`.
- [x] `server.js` — real Express API, real injected `transferVCoin`
      against V3 (`venvs-mock-backend`).
- [x] `npm install`.
- [x] Verify in plain Node (24 checks): validation, the real flat fee
      proven via transfer-call arguments, full lifecycle including
      illegal transitions in both directions, revenue correctly
      blocked pre-live and post-takedown, the 0%-commission full
      payout proven the same way, a two-release artist summary with
      hand-verified totals, cross-artist isolation, ordering.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: a video release submitted for a fresh artist, the real
      flat fee confirmed via V3's own live balance, the lifecycle
      advanced to `live`, real streaming revenue reported and the
      full-amount 0%-commission payout confirmed via V3's own live
      balance, the artist summary endpoint cross-checked against the
      raw ledger numbers.
- [x] Shut down the test server; confirmed via port check (left
      `venvs-mock-backend` running — shared infrastructure).
- [x] Write `README.md`, this plan/tasks pair.

## Next
Real DSP delivery integration. DistroKid's own alternative
subscription pricing shape. Any UI. Multi-party/collaborator royalty
splits. Vvltvre Flix (the Netflix Originals model) as the next
Vvltvre division.
