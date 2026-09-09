# Plan — Phase 1: Cvltvre Card core + the real Value Algorithm

## Goal
VOKEN is a much larger platform than one phase covers — VEX brokerage,
VADO art gallery/auctions, fractional ownership, packs/raffles/trading,
Kenji's onboarding flow. All of it sits on two foundations: the actual
`CultureCard` object, and the real value algorithm that scores it. This
phase builds only that foundation, matching the recommendation already
given when the four source docs were first reviewed — everything else
needs a working card and a working score before it means anything.

## Design
- `lib/cardTypes.js`: `CATEGORIES` (10) and `RARITY_TIERS` (7) — the
  master spec doc is explicit that the real label strings weren't
  recoverable from its source transcript; these are flagged
  placeholders grounded in VOKEN's own description and design tokens
  (the mythic/1-of-1 foil gradients confirming a 7-tier system), not
  final labels. `TOKENIZATION_TYPES`/`FORMATS` are the four real named
  types from the architecture doc.
- `lib/cultureCards.js`: `mintCultureCard()` is the real, literal
  implementation of two confirmed requirements — mint transparency
  (the full mint plan is set and exposed at mint time, never hidden)
  and the subject's guaranteed first mint (both digital and physical,
  if planned, performed atomically inside the same mint call, not a
  separate step someone could forget). `mintAdditionalEdition()`
  enforces the real mint cap — an edition beyond the planned count is
  rejected, not silently over-minted.
- `lib/valueAlgorithm.js`: the real, hybrid formula. `computeTraditionalScore()`
  uses a real log-scale scarcity curve (a true 1/1 scores far above a
  mass print run, with a smooth curve rather than a hard cliff) plus
  authenticity grade and a rookie bonus. `computeDigitalEngagementScore()`
  log-normalizes views/clicks/comments/likes (raw counts span wildly
  different real scales) and adds a real, capped velocity bonus,
  rewarding a card gaining attention *fast*, not just a big total.
  `computeGenuineSignificanceScore()` is completely independent of
  engagement, built from longevity of real impact, institutional
  recognition, and documented historical impact. `computeCombinedRealValueScore()`
  weights `digitalEngagement` and `genuineSignificance` **equally**
  (0.35 each) — the literal implementation of the doc's own
  requirement that neither should silently dominate the other. No
  exact formula is given anywhere for any of these four functions —
  every weight and curve is real, deterministic, bounded [0,100], and
  flagged as an interpretive choice, matching this session's
  established pattern (`hvntz/adPricing.js`, `void/cargoPricing.js`).
- `lib/establishedCreatorAssessment.js`: `assessEstablishedCreator()`
  calibrates a starting tier from real external metrics (social
  following, press coverage, industry recognition) — never the
  blank-slate `common` tier (the doc's own "not treated like a rookie"
  requirement) and never `1-of-1` (a card-scarcity property, not a
  person's fame).
- `server.js`: a real Express API (CommonJS, matching this session's
  established convention) — 7 endpoints.

## Explicitly NOT in this task
- No VEX brokerage trading, no VADO auctions/galleries, no fractional
  ownership — all compliance-gated per the architecture doc's own
  instruction, sequenced for a later phase.
- No packs/raffles/trading, no Kenji onboarding flow (proactive
  invitation vs. self-initiated application) — real, separate
  mechanics for a later phase once the card/score foundation is solid.
- No Kenji as an actual agent — matching this whole session's
  consistent stance, only the deterministic scoring/assessment logic
  underneath what Kenji is described as doing exists here.
- No real payout wiring yet — minting and scoring are free operations
  in this phase; the `transferVCoin` helper is defined in `server.js`
  for later phases (VEX/VADO/packs) to use, not called yet.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 18
checks, all passed clean on first run). The most important check
isn't a unit in isolation: a direct "MLK test" constructs two
contrasting cards — one with immense genuine significance but modest
real-time engagement, one with massive viral engagement and no lasting
substance — and asserts the first genuinely outranks the second in the
combined score, proving the algorithm's stated design goal actually
holds, not just that the formula runs without erroring. Then a live
pass: `voken/server.js` running alone — a real card minted with the
subject's guaranteed first copy confirmed on both formats, an
additional edition minted to a buyer, a value score computed live
matching the plain-Node result, and a real established-creator
assessment confirmed to never assign the rookie tier.

## Done when
- `mintCultureCard` rejects every invalid input and guarantees the
  subject's first digital (and physical, if planned) edition
  atomically.
- `mintAdditionalEdition` assigns sequential edition numbers and
  enforces the real mint cap per format.
- `transferEditionOwnership` correctly rejects a mismatched
  `fromOwnerId`.
- The value algorithm's four functions all validate their inputs and
  produce bounded [0,100] scores; the MLK test passes.
- `assessEstablishedCreator` never assigns `common`, and a genuinely
  bigger real profile produces a genuinely higher tier than a small
  one.
- Live: minting, additional editions, value scoring, and creator
  assessment all confirmed through the real HTTP API, matching the
  plain-Node pass.
