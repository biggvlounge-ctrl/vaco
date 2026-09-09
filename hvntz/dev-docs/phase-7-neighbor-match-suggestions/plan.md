# Plan — Phase 7: real DREA-driven automatic neighbor-match suggestions

## Goal
Close `neighborProgram.js`'s own previously-flagged gap: "No
DREA-driven automatic neighbor-match suggestions — matching by
distance exists; nothing auto-generates or ranks suggested trades."
Part of a broader ecosystem sweep, confirmed with the user before
starting.

## Real investigation before any code
Re-read `neighborProgram.js` (distance-only `findNearbyNeighbors`,
purely manual `recordNeighborTrade`) and `drea.js` (the real, cited
"avoid direct competitor conflicts" constraint, and the existing
posture of building the deterministic rule-layer underneath DREA
rather than the AI agent itself). Also re-read `explore.js`, which
already had a real, working location+activity ranking formula for its
own Explore Page -- reusable rather than reinventing a second scoring
scheme.

## Design
`optInToNeighborProgram` gains an optional `category` field (a real,
minimal schema addition, the same kind CHOPZ SHOP's own
`Product.category` already made when a feature needed it).
`suggestNeighborTrades(store, businessId)` filters the real candidate
pool (opted-in, in-radius) down to genuinely suggestible options: not
already an established partner, and not the same declared category as
the searching business (the doc's own cited competitor-avoidance
constraint, applied here for the first time to trade suggestions
specifically). Remaining candidates are ranked by a real combined
location + activity score -- moved `computeLocationScore`/
`LOCATION_SCORE_DECAY_KM` out of `explore.js` and into
`neighborProgram.js` so both real callers share one real function
instead of two independent copies (verified via a regression check
that `explore.js`'s own output is unchanged).

## Explicitly NOT in this task
The actual DREA AI agent -- this is the deterministic ranking layer
underneath it, the same posture `drea.js` already established for
placement rules. Any change to `findNearbyNeighbors` or
`recordNeighborTrade`'s existing behavior.

## Verification approach
6 plain-Node checks (closest-first ranking, same-category exclusion,
already-partnered exclusion, out-of-radius exclusion, no-category
never excluded, and activity score contributing to ranking), plus an
explicit `explore.js` regression check confirming the moved scoring
function produces identical output. A live pass against the real
running server: three real businesses (two same-category, one
different), suggestions confirmed correctly excluding the closer
competitor and surfacing only the real, non-competing candidate.

## Done when
Neighbor-trade suggestions are genuinely auto-generated and ranked,
confirmed by both isolated and live tests, and the README's own "Not
yet built" list no longer names this gap.
