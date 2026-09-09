# Tasks — Phase 3: co-writer/collaborator royalty splits

- [x] Investigate: read `lib/releases.js` in full; confirm the real
      DistroKid "Splits" comparable (percentages summing to 100%,
      each collaborator paid directly).
- [x] `lib/releases.js` — added `validateCoWriters`; `submitRelease`
      accepts optional `coWriters`, defaulting to single-payee 100%;
      `reportStreamingRevenue` rewritten to loop real per-collaborator
      payouts with exact-sum rounding discipline, management
      commission scoped to the primary artist only;
      `getArtistSummary` corrected to reflect only the artist's own
      share; added `getCollaboratorEarnings`.
- [x] `server.js` — wired `GET /api/collaborators/:userId/earnings`.
- [x] 8 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vulture-music`: a real
      3-way-split release, a real 20% management deal on the primary
      artist, real streaming revenue reported — all four real account
      balances confirmed exactly against V3's own live ledger, plus
      the collaborator-earnings endpoint and an invalid-split
      rejection both confirmed over real HTTP.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Label-level (not just personal-manager) deal shapes — advances,
recoupment, per-release vs. blanket deals — remain a real, flagged
gap.
