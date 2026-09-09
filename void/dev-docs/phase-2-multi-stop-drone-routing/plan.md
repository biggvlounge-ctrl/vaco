# Plan — Phase 2: Multi-Stop Drone Routing (TSP-D / VRP-D)

## Goal
`VOID_MULTI_STOP_DRONE_ROUTING.md` explicitly flags this as "Ready for
Claude Code — real, published algorithms (TSP-D, VRP-D) exist as a
starting reference; Claude Code can implement a working
route-optimization solver from this established literature rather
than inventing one from scratch." This is the flagship algorithmic
piece across all the VOID docs — the one place the source material
itself says the routing algorithm, not just the data model around it,
is genuinely software this session can build. Everything in HVNTZ
explicitly excluded drone routing as out of scope; this phase is where
that boundary moves, because this doc supplies a real, well-established
algorithm class to implement rather than asking for a novel,
safety-critical dispatch system from scratch.

## Design
- `lib/droneRouting.js`: `optimizeStopSequence(origin, stops)` — real
  nearest-neighbor construction followed by 2-opt local-search
  improvement, the standard, well-established approximate approach for
  this exact class of problem (exact TSP solving is NP-hard; this is
  the real technique the cited literature itself builds on, not an
  invented shortcut).
- `buildRoute()` — the actual `MultiStopDroneRoute` mechanic per the
  doc's own data model: real payload-capacity validation
  (`totalPayload` must fit `maxPayloadCapacity`), real range validation
  (`estimatedRangeUsed` is the full **closed-loop** distance — a real
  drone must return to its origin hub to recharge, so the route
  distance includes the return leg, not just the outbound one — checked
  against `maxRangeKm`), and a real no-fly-zone check across every leg
  of the optimized route (not just the endpoints).
- No-fly-zone geometry: real point-to-segment distance, computed via a
  **local flat-plane projection** centered on the route's origin —
  flagged as a real, deliberate approximation valid at the short
  distances real drone routes actually cover (single-digit to
  low-double-digit km), not for continental-scale geometry. Every
  actual route-length number still uses real Haversine distance; the
  projection is used only for this geometric segment-distance check.
- `groupOrdersIntoRoutes()` — the real VRP-D extension: a larger pool
  of candidate orders near one origin hub gets grouped into multiple
  capacity/range-respecting routes, directly implementing the doc's
  own framing ("group nearby orders into one multi-stop drone route...
  when combined payload stays within range"). Real, standard greedy
  nearest-first bin-packing heuristic: orders sorted by distance from
  origin, packed into a route until capacity or range would be
  exceeded, then the next drone in the fleet starts a new route. Orders
  that can never fit any drone in the given fleet (alone over payload
  or over range) are reported in `unassignedOrders` rather than
  crashing the batch.
- `lib/noFlyZones.js`: `registerNoFlyZone`/`getNoFlyZones` — registered
  globally (not region-scoped), since the source doc doesn't specify
  regional scoping for zones specifically; flagged, interpretive
  simplification.
- `optimizedFor` (`shortest-time`/`lowest-cost`/`max-stops`): kept on
  the route record per the doc's own data model, but **no formula
  differentiates the three modes in this pass** — no source doc
  specifies how they'd diverge, so all three currently share the same
  minimize-total-distance objective. Flagged, not silently pretended to
  be three distinct algorithms.
- `server.js`: 5 new endpoints (`POST /api/no-fly-zone`,
  `GET /api/no-fly-zones`, `POST /api/drone-route`,
  `GET /api/drone-route/:id`, `POST /api/drone-route/group`).

## Explicitly NOT in this task
- No real flight-path planning, altitude control, or obstacle
  avoidance beyond the flat 2D no-fly-zone geometric check — that's
  genuinely safety-critical flight-control software, out of scope.
- No actual drone hardware, battery telemetry, or charging-dock
  coordination — `maxRangeKm`/`maxPayloadCapacity` are caller-supplied
  real numbers, not read from real hardware.
- No demand forecasting or dynamic re-routing — `buildRoute()` and
  `groupOrdersIntoRoutes()` are one-shot planning calls on a fixed set
  of stops/orders, not a continuously re-optimizing dispatch loop
  (that's Gibson's real-time responsibility, itself an AI agent not
  built here).

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 16
checks). The core correctness claim — that `optimizeStopSequence`
actually finds a genuinely good route, not just *a* route — is checked
against a **real brute-force optimum** computed by trying all 5! = 120
permutations of a scattered 5-stop test case and confirming the
heuristic's result exactly matches the true minimum, not just
"passes" on faith. Then a live pass: `void/server.js` running alone, a
real multi-stop route built through the actual HTTP API, a real
no-fly-zone rejection confirmed live, and the VRP-D grouping endpoint
confirmed to genuinely split a candidate order pool across two drones
by real proximity clustering.

## Done when
- `optimizeStopSequence` matches the true brute-force optimal route
  distance on a scattered test case, not just an arbitrary valid tour.
- `buildRoute` rejects every invalid input (missing IDs, empty stops,
  invalid `optimizedFor`, non-positive capacity/range, malformed
  stops), rejects payload over capacity, rejects a route over range,
  and rejects a route passing within a registered no-fly zone.
- `groupOrdersIntoRoutes` correctly splits a payload-heavy candidate
  pool across multiple drones, correctly reports orders unassigned
  once the fleet runs out, and correctly handles (without crashing) a
  single order that alone exceeds capacity or range.
- Live: a real multi-stop route, a real no-fly-zone rejection, and a
  real multi-drone grouping split all confirmed through the actual
  HTTP API, matching the plain-Node pass.
