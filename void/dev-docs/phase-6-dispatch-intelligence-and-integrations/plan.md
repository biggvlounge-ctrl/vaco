# Plan — Phase 6: Dispatch Intelligence, Multi-Modal Relay, VOID Direct, Affiliate Network

## Goal
The last named-agent-adjacent and integration pieces flagged as
buildable across the source docs: the real, deterministic logic
underneath Gibson's and Kyle's stated dispatch behavior (never the
agents themselves — no AI agent exists in this session, matching
HVNTZ's DREA/HVNTER precedent), real multi-hop drone relay chaining
across the Phase 1 Station network, and the two named external-facing
integrations (VOID Direct, the Affiliate Network).

## Design
- `lib/dispatchIntelligence.js`:
  `decideAirVsGround()` implements Gibson's own stated rule literally:
  ground is chosen only when real capacity already exists heading
  toward the destination *and* it fits a real acceptable time window
  (default 48h — the doc's own "1-2 days," upper bound used as
  default, flagged overridable); otherwise air.
  `computeLoadIntelligenceScore()` implements Gibson Load
  Intelligence's stated inputs (passenger count, cargo volume vs.
  capacity) into a real, flagged utilization score and the real
  leftover-capacity numbers that would actually gate whether more work
  can be safely accepted — hard-rejects any input that would already
  violate seating/cargo capacity (a safety constraint, not just a
  scoring input).
  `recommendDeadTimeOpportunity()` implements Kyle's own concrete
  example ("22 minutes until your next likely ride — here's a food
  delivery job that fits") as real filtering (certified vertical +
  fits the time window) and real best-payout selection — explicitly
  not real demand forecasting (V4's stated job, an AI agent not built
  here), just the deterministic fit/selection layer underneath it.
- `lib/multiModalRelay.js`: `findRelayPath()` — real Dijkstra's
  algorithm over a graph where edges are station pairs within
  `maxDroneLegRangeKm` of each other, directly implementing the doc's
  "if Hubs are spaced within each drone's real range... a package can
  hop hub-to-hub by drone" framing as a standard, well-established
  shortest-path algorithm, not an invented heuristic. Correctly
  reports `found: false` for a disconnected/unreachable station rather
  than guessing — the real signal a ground/autonomous handoff leg is
  needed (not itself simulated here).
- `lib/externalIntegration.js`: `submitDeliveryManifest()` is real code
  reuse, not a stub — it creates an actual `courier`-vertical job
  through Phase 3's own `requestJob()`, proving VOID Direct is wired to
  VOID's real dispatch/payout mechanism, not a separate parallel
  system, matching the doc's own DoorDash Drive/Uber Direct comparable
  (a white-label API that dispatches through the same real network).
  `registerAffiliateStation()`/`listAffiliateStations()` implement the
  doc's real Affiliate Network roles, with HVNTZ-onboarded affiliates
  surfaced first per the doc's own recruitment-priority refinement —
  `isHvntzOnboarded` is caller-declared here rather than a live
  cross-service HVNTZ lookup, to keep this phase's scope bounded (a
  live integration would be the natural next step, not attempted in
  this pass).
- `server.js`: 9 new endpoints.

## Explicitly NOT in this task
- No real demand forecasting (V4's stated responsibility) feeding
  Kyle's recommendation — `recommendDeadTimeOpportunity` takes a
  caller-supplied `availableOpportunities` list.
- No live cross-service HVNTZ business lookup for Affiliate Network
  prioritization — `isHvntzOnboarded` is a caller-declared boolean.
- No ground/autonomous-vehicle handoff simulation when a relay path
  isn't found by drone hops alone — `findRelayPath` correctly detects
  and reports this case but doesn't simulate the handoff itself.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 20
checks, all passed clean on first run). The relay-path correctness
claim is checked against a real constructed station chain (4 stations
~5km apart along a line, plus one deliberately isolated station ~90km
away) — the algorithm must find the correct 3-hop path, the correct
1-hop path when in direct range, and correctly report no path for the
isolated station. Then a live pass: `void/server.js` running alone —
all three dispatch-intelligence endpoints, a real multi-hop relay path
found through the HTTP API, and a VOID Direct manifest submission
independently confirmed to have created a real, retrievable courier
job via `GET /api/job/:id` (not just trusted from the manifest
endpoint's own response).

## Done when
- `decideAirVsGround` correctly chooses ground only when both
  conditions hold, air otherwise, and rejects invalid inputs.
- `computeLoadIntelligenceScore` computes correct utilization and
  leftover-capacity numbers, and rejects any input already violating
  capacity.
- `recommendDeadTimeOpportunity` correctly filters by certification and
  time fit, picks the best payout among what fits, and returns `null`
  when nothing does.
- `findRelayPath` finds the correct multi-hop and single-hop paths on a
  real station graph and correctly reports no path for an unreachable
  station.
- `submitDeliveryManifest` rejects an invalid API key and, on success,
  creates a real, independently-verifiable job through the existing
  marketplace loop.
- `listAffiliateStations` correctly surfaces HVNTZ-onboarded affiliates
  first.
- Live: all of the above confirmed through the real HTTP API, matching
  the plain-Node pass.
