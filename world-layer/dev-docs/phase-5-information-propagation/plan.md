# Plan — Phase 5: Information Propagation Engine

## Goal
Fifth bundled system from `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`,
section 5: "Used for rumors, disasters, laws, business openings, wars,
discoveries, and player reputation — one system, not separate
mechanisms per event type." Doc's field list: `eventType, origin,
distance, connectivity, trustNetwork, languageBarrier, timeDelay,
spreadProbability`.

## Design
- `eventType` is a free-form string, not a fixed enum. The doc's own
  point is that rumors/wars/business-openings/etc. all go through the
  *same* mechanism — constraining `eventType` to a fixed list would
  contradict that, so `originateEvent()` only requires it be present
  and truthy, same treatment as `industry` on a business (Phase 3).
- `originateEvent(worldLayer, options)` creates the event
  (`eventType`, `originLocationId`, `description`); validates the
  origin is a real location.
- `calculatePropagation(options)` is a **pure function**, deliberately
  separated from any world-state mutation: given `distance`,
  `connectivity` (0-100), `trustNetwork` (0-100), `languageBarrier`
  (boolean), it returns `{ spreadProbability, timeDelay }`. Kept pure
  specifically so the formula itself is directly testable without
  needing an event or location to exist first.
- **No formula for either output is specified in any source doc.**
  What's implemented is a real, deterministic placeholder, flagged
  honestly as interpretive (same posture as VACON-C's own territory
  thresholds):
  - `spreadProbability = connectivity * (trustNetwork/100) *
    distanceDecay * languageMultiplier`, where `distanceDecay = 1 / (1
    + distance/50)` (50 is an arbitrary decay constant — larger
    distances asymptotically approach 0, closer ones approach
    `connectivity * trustNetwork/100`) and `languageMultiplier` is
    `0.5` when `languageBarrier` is true, `1` otherwise. Clamped to
    [0, 100].
  - `timeDelay = max(1, round(distance / max(connectivity, 1)))` —
    ticks until arrival; higher connectivity shortens it, and it's
    never less than 1 tick regardless of how close/connected.
- `propagateEvent(worldLayer, eventId, targetLocationId,
  propagationOptions)` is the stateful half: validates the event and
  target location both exist, calls `calculatePropagation()`, and
  appends `{ locationId, spreadProbability, timeDelay, arrivesTick:
  worldLayer.tick + timeDelay }` to the event's `propagations` array.
  Deliberately does **not** decide whether the event "actually"
  reaches that location (no random roll against `spreadProbability`)
  — recording the probability and delay is the deliverable; turning
  that into a yes/no outcome is a decision for whichever tick-pipeline
  phase eventually consumes it, not invented here.
- `getPropagationsForLocation(worldLayer, locationId)` — the query a
  location's "what has it heard" view would read from.

## Explicitly NOT in this task
- No random roll / actual pass-fail outcome from `spreadProbability` —
  see above.
- No connection to VACON-C's own event system
  (`vacon-c/server/tick.js`'s Event phase) — this is a parallel,
  shared mechanism, not a replacement, and wiring the two together is
  a separate decision.
- No use of `connectivity` derived from the Transportation Network
  (Phase 4) — callers pass `connectivity` directly as a number; a
  believable next step is computing it from real transport-node data
  at a location, not done here.

## Done when
- `originateEvent` validates `eventType` and a real `originLocationId`.
- `calculatePropagation` validates all four inputs and is
  monotonic in the expected directions (closer distance → higher
  probability; language barrier → lower probability), verified
  directly, not just asserted.
- `propagateEvent` validates both the event and target location exist,
  and stamps `arrivesTick` correctly against the World Layer's current
  `tick`.
- `getPropagationsForLocation` aggregates across multiple events
  correctly.
- Regression: Phase 1 (`generateLocation`) unaffected.
