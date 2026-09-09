# Plan — Phase 18: Multi-Midpoint Delivery Choice, Forward Inventory & the Quick Innovation Thread

## Goal
Build the real, buildable features described in
`MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_INVENTORY.md` (3 features) and
`QUICK_INNOVATION_THREAD.md` (5 features), all extending VOID's
already-existing infrastructure rather than standing up parallel
systems, per both source docs' own explicit framing.

## Real bug found and fixed first
`registerAffiliateStation` (`lib/externalIntegration.js`) required an
already-existing `stationId` on every call. Read literally, that means
an HVNTZ business could only ever become an affiliate midpoint at a
location VOID already owned a station at — directly contradicting the
Multi-Midpoint doc's own stated purpose: "expanding real physical
coverage without VOID needing to own or lease every node." Fixed:
`stationId` is now optional; an affiliate without one must carry real
coordinates (self-reported `lat`/`lng`, or pulled from a real,
verified HVNTZ `Location` via a new `hvntzLocationId` + injected
`hvntzLocationFetchFn`). HVNTZ itself gained the missing
`GET /api/business/:id/locations` route this real fix needed.

## Design, per feature
- **Multi-Midpoint #1 (affiliate relay midpoints)**:
  `multiModalRelay.js`'s real Dijkstra graph now includes eligible
  `'drone-support'` affiliate stations as genuine nodes alongside real
  stations — not a second routing system.
- **Multi-Midpoint #2 (delivery method choice)**: `lib/deliveryChoice.js`
  — a real, bounded bike/car/drone quote formula (same "invented but
  bounded" posture as `cargoPricing.js`) plus a Hub/kiosk pickup option.
- **Multi-Midpoint #3 (forward inventory)**: `lib/businessLockers.js`
  — real `BusinessLocker`/`SellerInventoryPlacement`/`DroneLoadingEvent`,
  staffed loading only (matching `hubOrigination.js`'s own precedent).
  Tied to a real `orderId`, not a fabricated VMall integration (VMall
  doesn't exist anywhere in this codebase).
- **Quick Innovation #1 (Regulated Boxes)**: `lib/regulatedBoxes.js` —
  chain-of-custody log + real, live VACA identity check. Does not
  relax the existing `licensingGated` gate on cannabis/medical-
  transportation verticals.
- **Quick Innovation #2-3 (VOID Staffing + HUNT Staffing)**:
  `lib/staffing.js` — formalizes the already-existing generic
  `staffing` vertical, real HVNTZ cross-app layer on top.
- **Quick Innovation #4-5a-5b (Mobile Docking, Dual Mobility,
  Launchpad Driver)**: `lib/mobileDocking.js` — real vehicle registry
  with live position updates, a real bounded rendezvous-point
  calculation (Haversine against real range/speed), a driver role
  fixed to the DSP tier and validated against a real
  `MobileDroneDockingVehicle`. Deliberately NOT wired into the fixed-
  coordinate relay graph — a real, separate, harder problem.
- **Quick Innovation #5c (TaaS)**: `lib/taas.js` — real subscriptions,
  fixed `brandedAs: 'vaco'`, three acquisition models each mapped to
  one billing model.

## Explicitly deferred, not built
"Proactive hardware suggestions" (part of Quick Innovation #5) depends
on "the already-established proactive business suggestion engine,"
which a full-repo search confirmed does not exist as real code
anywhere — only in planning documents. Building a suggestion feature
on top of a suggestion engine that doesn't exist would mean inventing
both in one pass; deferred rather than faked.

## Seed data
`lib/seedDemoData.js`, per `SEED_DEMO_DATA_REQUIREMENT.md`: two real
St. Louis Port Stations, two gig drivers, four real courier jobs (three
clustered Downtown, one on Cherokee Street), run through the real
`groupOrdersIntoRoutes` batching engine — the differentiator
(multiple simultaneous nearby orders visibly batched) is the seeded
engine output itself, not a hand-labeled claim.
