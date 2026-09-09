# Plan — Phase 12: Full cross-phase regression (Phases 1–11)

## Goal
Phase 7 ran a full regression across Phases 1–6. Phases 8–11 added
four more modules (driver/fleet, food delivery, moving/real estate
media, hub origination/locker network) on top of that same shared
store shape. This phase extends the same discipline: one comprehensive
scenario touching every phase together, proving nothing added since
Phase 7 broke anything nothing added before it, and that the four new
modules genuinely compose with the original six, not just individually.

## Design
One script, one shared store, a single connected narrative: a real
station network and drone route (Phases 1–2); a gig driver and VOID
DSP, with a real marketplace job driven through a genuine
delivery-failure-and-retry cycle to a real payout (Phase 8, exercising
the Phase 3 marketplace loop under Phase 8's extension); the new
`foodDelivery` vertical proven to actually change `decideAirVsGround`'s
real output via its tighter delay window, plus a transparent-kitchen
registration (Phase 9); a moving job and a real estate media job, both
confirmed to produce distinct marketplace job ids with no collision
against the earlier jobs (Phase 10); a hub-originated shipment
resolved to real fulfillment, plus a locker explicitly linked to the
same Phase 1 station and a full Locker-to-Door lifecycle completed
(Phase 11). A final sanity check confirms every top-level store
collection across all eleven phases holds exactly the expected count.

## Verification approach
Plain-Node pass (throwaway `.cjs`, deleted after — 8 checks; one
test-script bug found and fixed, not an app bug: an assertion checked
a `LockerToDoorRequest` object's `.status` *after* calling
`completeLockerToDoorDelivery`, which mutates that same object
reference — the object correctly showed `'delivered'` at that point,
not the `'retrieved'` value the test expected from an earlier step;
fixed by capturing the status immediately after the retrieval call,
before the completion call runs). Then a live smoke pass:
`void/server.js` started fresh with all eleven phases' modules wired
together, confirming a clean startup and a correct, complete
`/api/health` response.

## Done when
- All 8 regression checks pass, confirming Phases 1–11 compose
  correctly with no cross-module interference.
- Every job-creating flow (direct marketplace request, moving, real
  estate media, hub origination) produces a genuinely distinct job id
  — no collisions across four different creation paths writing into
  the same `store.jobs` array.
- The locker registered in this pass is explicitly linked to a real
  station from Phase 1's own module, and the full Locker-to-Door
  security lifecycle completes correctly on the shared store.
- The final store-collection sanity check confirms exact expected
  counts across all eleven phases' worth of collections.
- `void/server.js` starts cleanly with every phase's modules wired in.
