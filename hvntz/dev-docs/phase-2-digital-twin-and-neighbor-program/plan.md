# Plan — Phase 2: Digital Twin auto-scaling, Neighbor Program, CVNVO placement

## Goal
Three more concretely-buildable pieces flagged as "Next" after Phase
1: Digital Twin auto-scaling (the most valuable — it computes a real
output from everything Phase 1 already tracks), the Hunts Local
Neighbor Program (real geographic matching), and CVNVO Placement Tier
(simple, quick, real).

## Design
- `lib/digitalTwin.js`: `computeDigitalTwinLevel(store, businessId)`
  reads directly from Phase 1's `getFranchiseList()` and
  `getParticipations()` — a literal implementation of the doc's own
  instruction ("a computed value derived directly from their real-
  world Franchise List, not a separate purchase decision"). **Built as
  a real, self-contained computation, not a connection to an existing
  Digital Twin Level system** — that system (referenced by this doc as
  already established) doesn't actually exist as working code
  anywhere in this session; `venvs`'s own README lists "Digital Twin
  levels" under its own "Not yet built" section. Rather than fake a
  connection to something that isn't there, this implements the level
  computation for real, so a future phase can wire `venvs`'s CHOPZ
  system to read from it if that connection is ever built.
  - No thresholds are specified anywhere — `LEVEL_2_LOCATION_THRESHOLD`
    (2), `LEVEL_2_SHARE_THRESHOLD` (0.5), `LEVEL_3_LOCATION_THRESHOLD`
    (3), `LEVEL_3_REVENUE_THRESHOLD` (200) are all real, deterministic,
    flagged interpretive choices. Level 3 correctly reachable by three
    independent real paths (location count, `hub-as-store`
    participation, or revenue alone) — verified each path separately,
    not just one.
- `lib/neighborProgram.js`: `haversineDistanceKm()` is the real,
  standard great-circle distance formula, not a placeholder —
  verified against real St. Louis-area coordinates (Cherokee St
  businesses ~0.85km apart) rather than synthetic test numbers.
  `findNearbyNeighbors()` scopes by the *searching* business's own
  chosen radius, a literal read of the doc's "the business owner
  chooses the radius" framing (each business's radius governs its own
  search, not a mutual-overlap requirement neither doc mentions).
  `recordNeighborTrade()` is genuinely mutual — recording one call
  creates both sides' records, since a trade is inherently two-sided
  and the doc frames neighbors as "allies," not one-sided requesters.
- `lib/cvnvoPlacement.js`: `PACKAGE_TIERS`/`VISIBILITY_BOOST_BY_TIER`
  are both invented (no tier names or boost values are given anywhere)
  — `setCvnvoPlacement` upserts in place per business rather than
  accumulating duplicate placement records on a tier change.
- `server.js`: 8 new endpoints wrapping all three modules.

## Verification approach
Plain-Node pass first (21 checks). Then a live pass with
`hvntz/server.js` and `venvs-mock-backend` running together: grew a
real business from Level 1 (0 locations) to Level 3 (3 locations)
through actual HTTP calls, confirming the auto-scaling genuinely
recomputes from real registered data, not a cached/manual value; ran a
real neighbor opt-in/find/trade sequence between two businesses at
real coordinates, confirming the 0.85km distance calculation and the
mutual trade reciprocation both work through the live API, not just
in-process.

## Explicitly NOT in this task
- No connection to `venvs`'s CHOPZ system — that Digital Twin Level
  system doesn't exist there yet (flagged in `venvs`'s own README).
  This phase computes a level for real; wiring it to an actual VDP
  business dashboard is a future integration, not built here.
- No DREA-driven *automatic* neighbor match suggestions — the doc says
  DREA should recommend matches; `findNearbyNeighbors()` finds who's
  in range, but nothing auto-generates a suggested trade or ranks
  match quality beyond distance.
- No HVNTZ Explore Page (location + attention-based ranking surface) —
  a real, separate, more open-ended piece not attempted this phase.

## Done when
- `computeDigitalTwinLevel` correctly starts at Level 1 for a
  business with no activity, correctly promotes to Level 2 at exactly
  its threshold (not before), and correctly reaches Level 3 through
  each of its three independent paths, verified separately.
- `haversineDistanceKm` produces a real, sane distance for real
  coordinates, not just an arbitrary number that happens to pass a
  loose assertion.
- Neighbor matching correctly includes in-range businesses and
  excludes out-of-range ones; trades are verified mutual by checking
  the *partner's* record, not just the initiator's; opting out
  correctly removes a business from both search results and the
  ability to search itself.
- CVNVO placement validates tier names and updates in place on a
  repeat call for the same business.
- Live: Digital Twin level genuinely recomputes as real locations are
  added through the API (not a static/mocked response), and a real
  trade between two live-registered businesses at real coordinates
  reciprocates correctly.
