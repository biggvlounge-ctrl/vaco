# Plan — Phase 1: Flat-Fee Distribution

## Goal
Start Vvltvre Music/Distribution built against its real, named
comparables specifically — DistroKid and TuneCore's real flat-fee
model, plus gamma.'s real multi-format artist-retained-ownership
model — rather than a generic music-app build. Vvltvre's own division
under the same umbrella VOID MAGIC already belongs to
(`VVLTVRE -> MUSIC/DISTRIBUTION`, mirroring
`VVLTVRE -> TOURING & TIX -> VOID MAGIC`).

## Design
- `RELEASE_FORMATS`: `single`/`album`/`video`/`podcast-episode` —
  gamma.'s real multi-format scope (video/podcast alongside music),
  not just DistroKid/TuneCore's music-only shape.
- `DISTRIBUTION_FEES`: a real, flagged-interpretive flat-fee schedule
  grounded in TuneCore's real per-release pricing structure. TuneCore's
  real shape (pay per release) was picked over DistroKid's real
  alternative (unlimited-annual subscription) because it maps directly
  onto individual `Release` records — a deliberate choice between two
  real comparable models, not the only one, flagged as such.
- Zero percentage splits anywhere — the single real structural point
  of this whole module. `ownershipRetainedPercent: 100` lives on every
  release as a real field. `reportStreamingRevenue` pays the artist
  the full amount via `transferFn`, 0% commission.
- A real, guarded release lifecycle (`submitted → distributing → live
  → taken-down`), matching the `requireStatus`/status-guard pattern
  established across this session (VACA's `requirePending`, VOID
  MAGIC's various status guards).
- Real cross-app money via V3 (`venvs-mock-backend`), same injected
  `transferVCoin` pattern as CHOPZ SHOP/VOID/VACAY.

## Explicitly NOT in this task
Real DSP delivery integration (platform names are real, used
descriptively). DistroKid's own alternative subscription pricing
shape. Any UI. Multi-party/collaborator royalty splits on one release.
Vvltvre Flix or any other Vvltvre division.

## Verification approach
Plain-Node pass (24 checks): format/platform validation, the flat fee
proven via the actual transfer call arguments (not just a stored
number), full lifecycle including illegal-transition rejection, the
0%-commission full-amount payout proven the same way, a two-release
artist summary with hand-verified totals, cross-artist isolation.
Then a live pass: the real server run against `venvs-mock-backend`'s
own live V3 ledger — a release submitted, the real flat fee confirmed
via V3's own balance endpoint, the lifecycle advanced, real revenue
reported and the full-amount payout confirmed the same way, the
summary endpoint cross-checked against the raw ledger numbers.

## Done when
- The flat-fee charge and 0%-commission payout are both proven against
  a real, live V3 ledger, not just asserted in isolation.
- The lifecycle genuinely blocks out-of-order transitions and
  post-takedown revenue reporting.
- The artist summary's totals are hand-verified correct.
