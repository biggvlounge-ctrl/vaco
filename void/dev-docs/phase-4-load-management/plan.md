# Plan — Phase 4: Passenger, Cargo & Load Management

## Goal
`VOID_MASTER_FREEZE.md`'s "PASSENGER, CARGO & LOAD MANAGEMENT" section
plus its own "Flags raised during review" subsection. The doc treats
vehicle capacity as a managed resource — a real differentiator it
calls out itself (Uber/Lyft keep passenger and package strictly
separate; VOID's mixed-load model doesn't). Three real gaps are
flagged in the doc's own review, not left silent, and this phase makes
an explicit, real decision on each rather than building around them.

## Design
- `lib/loadManagement.js`: `declareTrip()` — real declaration with
  **smart defaults** per the doc's own recommendation (booking-friction
  flag #3): `passengerCount` defaults to 1, `bagsIncluded` is computed
  automatically (not separately declared), rather than forcing active
  declaration on every request.
  **Service animals** (flag #2): `hasServiceAnimal` is a separate
  boolean field, never counted toward `oversizedItems`, cargo volume,
  or capacity-fit rejection — a firm rule implementing the doc's own
  point that ADA generally bars refusing a rider with one, not an
  optional item alongside golf clubs and coolers.
  **Car seats** (flag #1): the doc says this needs "an explicit
  decision, not silence." Real precedent it cites itself (Uber/Lyft:
  "parents supply their own seat," a real source of complaints) is
  followed by default; `carSeatsNeeded` lets a rider flag the need for
  matching to prefer a car-seat-capable driver, without building a full
  in-vehicle car-seat inventory/compliance system (out of scope, a
  genuinely separate real product surface).
  `registerVehicleCapacityProfile()`/`checkCapacityFit()` — the actual
  "preventing over-capacity assignment" mechanic: real seating-capacity,
  cargo-volume, and single-item-size checks against a real registered
  vehicle profile, recommending a larger vehicle when a single item
  exceeds `maxPackageSizeCubicFt`.
- `lib/cargoPricing.js`: `computeDynamicCargoPricing()` — the doc says
  "V4 automatically prices oversized items... based on the declared
  load" with no formula given anywhere. Real, deterministic, bounded
  formula (matching `hvntz`'s `adPricing.js` pattern: invented but
  flagged and capped, not unbounded), not a fake V4 AI call.
- `lib/sequencing.js`: `computeSequencing()` — the doc's own stated
  real rule: food > passenger safety/trip terms > non-perishable
  packages, except packages get parity with passengers on a dedicated
  delivery route. The doc itself calls full real-time sequencing
  "genuinely complex... should be scoped as real algorithmic work" —
  this is a real, deterministic first-pass priority rule implementing
  the doc's own stated ordering, not a claim to have solved the full
  live-traffic/ETA-aware routing problem the doc describes (this
  session has no access to live traffic data).
- `server.js`: 6 new endpoints.

## Explicitly NOT in this task
- No in-vehicle car-seat inventory or installation-compliance system —
  a genuinely separate, real product surface.
- No real-time re-sequencing using live traffic/ETA data — `computeSequencing`
  is a one-shot priority sort on a fixed stop list, matching the doc's
  own acknowledgment that the full problem is "genuinely complex."
  real-time work.
- No accessibility-needs matching logic beyond storing the declared
  field — actually matching a rider's accessibility needs to a
  qualified vehicle/driver is a separate, larger feature.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 21
checks, all passed clean on first run). Then a live pass:
`void/server.js` running alone — a real trip declared with a service
animal and an oversized item, capacity fit and dynamic cargo pricing
both confirmed correct against the real declared load, and the
sequencing endpoint confirmed to produce the doc's own stated
food-first ordering through the actual HTTP API.

## Done when
- `declareTrip` defaults correctly (smart defaults), rejects every
  invalid input, and never treats a service animal as an oversized
  item or cause for rejection.
- `checkCapacityFit` correctly passes a trip within a real vehicle's
  profile and correctly fails (with a specific reason) for
  over-seating, over-cargo-volume, and a too-large single item.
- `computeDynamicCargoPricing` computes a real, bounded fee correctly
  and caps at `MAX_CARGO_FEE`.
- `computeSequencing` correctly orders food > passenger > package by
  default, and correctly gives packages parity with passengers on a
  dedicated delivery route.
- Live: trip declaration, capacity fit, cargo pricing, and sequencing
  all confirmed through the real HTTP API, matching the plain-Node
  pass.
