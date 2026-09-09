# Plan — Phase 7: Full Cross-Phase Regression

## Goal
Exercise every VOKEN module built across Phases 1–6 together in ONE
shared store, matching the discipline used for VOID's Phase 7 and
Phase 12 regressions — catching cross-module ID collisions or store
interference that per-phase testing, each in its own fresh store,
can't see.

## Design
Five Cvltvre cards across four categories (music, vehicles, property,
two art cards) seed the whole regression. Each subsequent module is
deliberately routed through a *different* card/edition than the ones
before it (trading swaps musicCard/propertyCard editions; fractional
ownership uses the vehicle card; VADO auctions all four types against
one art card; the digital art frame uses the second art card) so a
bug that clobbers the wrong edition or the wrong card is forced to
surface as a wrong-owner assertion, not hidden by every module
touching the same object. Kenji's onboarding, packs, and raffles run
against the remaining cards. VEX brokerage and fractional ownership
both exercise their real compliance gates from closed to cleared,
exactly like their own phase's test did — the regression re-proves the
gate still works correctly with five other modules' state already
present in the same store, not just in isolation.

## Verification approach
One throwaway `.cjs` script (deleted after — 17 checks) using a single
shared `store` and a single shared fake ledger across all six phases'
functionality end to end. The final check is a hand-computed global
sanity total: every real mint operation across the whole regression
(initial subject mints, explicit additional editions, the pack draw,
the raffle draw, VEX's buy quantity) sums to a known number of total
editions across all cards — 19 — checked against
`store.cultureCards.reduce((sum, c) => sum + c.editions.length, 0)`.
Trades, auctions, fractional listings, and VEX sells only ever
transfer existing editions' ownership, never mint new ones, so this
total is a real, independent proof that nothing was double-minted or
silently dropped anywhere across the whole chain. A final live smoke
test then confirms `voken/server.js` (with `venvs-mock-backend`
running alongside it) starts cleanly and serves a real request with
every module wired.

## Done when
- Every module from Phases 1–6 runs correctly inside one shared store.
- No collection holds an unexpected count once every module has run.
- The global edition total matches the hand-computed expectation
  exactly.
- Both compliance gates (VEX, fractional ownership) are re-proven to
  block-then-allow correctly with five other modules' state already
  present.
- `voken/server.js` starts cleanly and serves a real request.
