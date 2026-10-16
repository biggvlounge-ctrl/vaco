# VOID DROP — Mobile Space Rental & Deployment (v1)

Source: the founder's own VOID DROP spec (select → book → deliver →
deploy → use → retrieve → redeploy; 14 named products; "Mobile Space
Asset," not "container"). This file records the real implementation
decisions made against it, not a restatement of the spec.

## The one real new idea

Every other VOID vertical's "thing" lives only inside a job — a
courier run, a moving job, a laundry order each happen once. VOID
DROP's whole premise is the opposite: one physical unit serves
customer A, then B, then C, with real state that outlives any single
booking. `lib/businessLockers.js` was the closest existing precedent
(a durable physical registration many orders reference over time);
VOID DROP follows the same shape at fleet scale.

## Architecture

**An additive vertical inside VOID, not a new app.** CLAUDE.md's
standing rule #1 ("one marketplace loop") and the founder's own
instruction ("do not create a second booking system") both point the
same way: `voidDropBooking.js` creates a real job through
`marketplace.js`'s existing `requestJob`/`matchProvider`/`acceptJob`/
`completeJob`, the same way `movingServices.js` and
`realEstateMedia.js` already do. Registered as the `voidDrop` vertical
(`pricingUnit: 'flat-quote'`, `takeRate: 0.20`, the same fallback every
other non-deep-researched vertical uses) and as an entry in
`SERVICE_CONFIGS` (`archetype: 'quote'`, `hasDedicatedModule`) so
`describeService` answers for it uniformly.

**Three modules, not twelve.** 14 named products (DROP SHOP, DROP
FOOD, …) differ in label, typical uses, and which rental models make
sense — not in mechanics. `voidDropCategories.js` is config, matching
`verticalServiceConfigs.js`'s own SERVICE_CONFIGS pattern; one real
engine (`voidDropAssets.js` + `voidDropBooking.js`) serves all 14.
Adding a 15th product is a new config entry, never a new module —
the founder's own standing instruction, applied directly.

```
MobileSpaceAsset (lib/voidDropAssets.js) {
  id: "VOID-DROP-0001"
  category, sizeDescription, dimensions, weightKg, amenities
  dailyRate, ownerId, ownerType: "void"|"third-party"|"business"|"investor"
  operatorId   // separate from ownerId -- spec §20
  status: available|reserved|in-transit|deploying|active-rental|
          maintenance|cleaning|inspection|damaged|offline|retired
  lat, lng, homeLat, homeLng
}

DropMaintenanceEvent {
  id, assetId, type, notes, performedBy, loggedAt, resolvedAt
  // unresolved (resolvedAt: null) blocks booking regardless of status
}

DropBooking (lib/voidDropBooking.js) {
  id, customerId, assetId, category, rentalModel, startDate, endDate
  locationType, deliveryLat, deliveryLng, intendedUse
  eligibilityStatus: pending-review|approved|rejected
  pricing: { rentalPrice, deliveryFee, setupFee, distanceKm, totalPrice }
  status: pending-approval|booked|delivery-scheduled|in-transit|
          deployed|active|retrieval-scheduled|returning|inspection|
          cleaning|completed|cancelled|rejected
  jobId   // the real marketplace job this booking settles through
}
```

## Three decisions that needed to be made, stated honestly

**1. Eligibility never auto-approves.** No zoning or permit database
exists anywhere in this ecosystem. `assessEligibility` can only
REJECT on a real, checkable mismatch — no confirmed road access, a
declared site weight limit the unit genuinely exceeds. Anything that
clears those comes back `pending-review`, never `approved` — a real
human (`POST /api/drop/booking/:id/approve`) always finalizes it,
recorded in vaco-audit first via `decisionLog`, same posture
`regulated-box` custody verification already holds. This is slower
than the spec's own "SYSTEM CHECKS ELIGIBILITY" framing implies, and
it is the honest version of that step given what this codebase can
actually verify.

**2. Payment settles once, at the end.** The spec's own customer flow
(§22) shows payment right after booking, before the unit ever moves —
a real deposit/upfront-charge product decision this does not invent
an answer for. Instead `completeCleaningAndClose` is the one moment
money moves, via the same `completeJob`/`settleVCoin` every other
vertical's completion already uses — the physical lifecycle in
between (delivery, active rental, retrieval, inspection, cleaning) is
tracked entirely in `DropBooking.status`, independent of the job,
which stays `accepted` throughout. Deposits, holds, and refunds are a
real gap, not faked.

**3. Delivery pricing is real distance, or honestly zero.**
`computeDropPrice` uses `geo.js`'s real Haversine distance between the
asset's home base and the delivery location when both are known. When
either is missing, the delivery fee is `0` and `distanceKm` is `null`
— never a guessed number. `DELIVERY_FEE_PER_KM` (3 VCoin/km) and
`SETUP_FEE_FLAT` (50 VCoin) are flagged interpretive constants; no
source document sets a real rate for either.

## What is deliberately not built yet

Recorded here and in `CLAUDE.md`'s own "Genuinely not built" section —
not a gap discovered later, a scope line drawn now:

- Third-party marketplace listings (the `ownerId`/`ownerType` split
  already exists so this is additive, not a rewrite).
- V4 natural-language discovery ("I need a space for 30 people
  Saturday").
- The DREAMS, HVNTZ, VACAY, and real-estate cross-app hooks the spec
  describes (§§13–17).
- DROP ZONES (clustering several units at one property).
- Rent-to-own ledgers, fractional ownership, revenue-share splits —
  real financial products that need their own real agreement model,
  the same way DREAMS' own VRG revenue attribution needed one
  (`dev-docs/CORPORATE_STRUCTURE.md`).
- A time/usage-based maintenance schedule — today the only real gate
  is "no open issue," not a mileage/hours interval (spec §10 lists
  what to track, not when service is due).

## API surface

`GET /api/drop/categories` · `POST /api/drop/asset` ·
`GET /api/drop/asset/:id` · `GET /api/drop/assets` ·
`POST /api/drop/asset/:id/status` · `POST /api/drop/asset/:id/location` ·
`POST /api/drop/asset/:id/maintenance` ·
`POST /api/drop/maintenance/:eventId/resolve` ·
`GET /api/drop/asset/:id/maintenance` · `GET /api/drop/asset/:id/quote` ·
`POST /api/drop/booking` · `GET /api/drop/booking/:id` ·
`GET /api/drop/bookings/user/:userId` ·
`POST /api/drop/booking/:id/approve` ·
`POST /api/drop/booking/:id/reject` ·
`POST /api/drop/booking/:id/schedule-delivery` ·
`POST /api/drop/booking/:id/dispatch-delivery` ·
`POST /api/drop/booking/:id/mark-deploying` ·
`POST /api/drop/booking/:id/start-rental` ·
`POST /api/drop/booking/:id/schedule-retrieval` ·
`POST /api/drop/booking/:id/dispatch-retrieval` ·
`POST /api/drop/booking/:id/mark-returned` ·
`POST /api/drop/booking/:id/inspection-result` ·
`POST /api/drop/booking/:id/complete` ·
`POST /api/drop/booking/:id/cancel`

See `test/voidDrop.test.js` for the real, exercised lifecycle
(including a failed-inspection path and the no-double-booking check).
