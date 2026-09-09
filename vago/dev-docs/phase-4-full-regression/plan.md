# Plan — Phase 4: Full Cross-Phase Regression

## Goal
Exercise every VAGO module built across Phases 1–3 together in ONE
shared store, matching the discipline used for VOID's and VOKEN's own
final regression phases — catching cross-module interference that
per-phase testing, each in its own fresh store, can't see.

## Design
Nine seeded accounts run every module in one pass: an AMOE-granted
Gold Coin session, a simultaneous VCoin casino session, a prediction
market bought on both sides and resolved, a sportsbook event bet on
both outcomes and settled, and an esports match with a pre-match stake
and a genuine live Flash Stake, resolved. Each module deliberately
touches a different set of users so cross-contamination would surface
as a wrong-balance assertion, not get hidden by shared state.

## Verification approach
One throwaway `.cjs` script (deleted after — 7 checks, one test bug
fixed: an assertion assumed `resolveMarket` deletes a losing contract
record, but it correctly leaves both sides' records on the book after
paying out, only zeroing/removing on an explicit `sellContract` call).
The final check is a **global VCoin conservation invariant**: summing
every account's real balance (all 8 players + the house) after the
entire regression must equal exactly the total seeded (9 accounts ×
1000 = 9000) — proof that no VCoin was created or destroyed by any of
the four independently-built modules sharing one store, only ever
moved. A second check independently confirms Gold Coin balances for
every VCoin-only participant stayed at zero throughout, and that the
original AMOE recipient's Gold Coin balance was untouched by every
other module. A final live smoke test then confirms `vago/server.js`
(with `venvs-mock-backend` running alongside it) starts cleanly and
serves real requests with every module wired.

## Done when
- Every module from Phases 1–3 runs correctly inside one shared store.
- No collection holds an unexpected count once every module has run.
- The global VCoin conservation invariant holds exactly.
- Gold Coin and VCoin remain genuinely isolated even under full
  cross-module load, not just in each phase's own isolated tests.
- `vago/server.js` starts cleanly and serves a real request.
