# VOID DROP — Mobile Space Rental & Deployment

Source: the founder's own VOID DROP spec (select → book → deliver →
deploy → use → retrieve → redeploy; 14 named products; "Mobile Space
Asset," not "container"), plus a real follow-up (hub-based storage,
driver-fulfilled delivery, the DREAMS-screen/VACAY-listing add-ons, a
15th product). This file records the real implementation decisions
made against both, not a restatement of either.

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

**Three modules, not fifteen.** 15 named products (DROP POP SHOP, DROP
FOOD, …) differ in label, typical uses, and which rental models make
sense — not in mechanics. `voidDropCategories.js` is config, matching
`verticalServiceConfigs.js`'s own SERVICE_CONFIGS pattern; one real
engine (`voidDropAssets.js` + `voidDropBooking.js`) serves all 15.
Adding a 16th product is a new config entry, never a new module —
the founder's own standing instruction, applied directly. (DROP SHOP's
real branded name is "DROP POP SHOP" — the category id stayed
`dropShop`, only the label changed. DROP BATH — mobile luxury
bathroom — is the 15th, added the same way.)

A sauna/jacuzzi combo, a sauna inside a Vacay Villa, a pool alongside
one — none of these needed a new category. `amenities` on the asset
is a free list; "this specific DROP SAUNA unit also has a hot tub" is
just two entries in it, not a `dropSaunaSpa` category. DROP OFFICE
(mobile office) was already one of the original 14 and needed nothing
further.

```
MobileSpaceAsset (lib/voidDropAssets.js) {
  id: "VOID-DROP-0001"
  category, sizeDescription, dimensions, weightKg, amenities
  dailyRate, ownerId, ownerType: "void"|"third-party"|"business"|"investor"
  operatorId      // separate from ownerId -- spec §20
  homeStationId   // optional real VOID Hub/Port station this unit stages at
  status: available|reserved|in-transit|deploying|active-rental|
          maintenance|cleaning|inspection|damaged|offline|retired
  lat, lng, homeLat, homeLng   // homeLat/Lng derive from homeStationId's
                                // own station if not given explicitly
  hasDreamsScreen, dreamsScreenId   // see "DREAMS screens" below
}

DropMaintenanceEvent {
  id, assetId, type, notes, performedBy, loggedAt, resolvedAt
  // unresolved (resolvedAt: null) blocks booking regardless of status
}

DropBooking (lib/voidDropBooking.js) {
  id, customerId, assetId, category, rentalModel, startDate, endDate
  locationType, deliveryLat, deliveryLng, siteAddress, intendedUse
  eligibilityStatus: pending-review|approved|rejected
  pricing: { rentalPrice, outboundDeliveryFee, retrievalFee, setupFee,
             distanceKm, totalPrice }
  status: pending-approval|booked|delivery-scheduled|in-transit|
          deployed|active|retrieval-scheduled|returning|inspection|
          cleaning|completed|cancelled|rejected
  jobId                        // the real marketplace job this settles through
  deliveryDriverId, retrievalDriverId   // the approved driver for each real leg
}
```

## Hub-based storage, and driver-fulfilled delivery

**Stored at the Void Hub** (founder's own words): `homeStationId` ties
a unit's fleet base to a real `stations.js` Hub/Port station rather
than a bare coordinate pair. Given one, the station's own real
`lat`/`lng` become the asset's home base unless explicit
`homeLat`/`homeLng` override it — a unit without a home station is
still valid (third-party/investor-owned inventory may not stage at a
VOID hub at all).

**"Void drivers that are approved ... will come get it ... and
receive the fee."** `requireApprovedDropDriver` holds delivery/
retrieval assignment to a stricter bar than `voidDrop`'s own
(non-licensing-gated) default: a driver needs a *verified*, not
merely claimed, `voidDrop` skill (`providerProfiles.js`'s existing
skill-verification system — placing a multi-ton structure in a
stranger's driveway earns the same bar licensing-gated verticals
already hold). `dispatchDelivery`/`dispatchRetrieval` take an optional
`driverId`; a VOID-owned unit may still move with no outside gig
driver at all.

**The real pricing fix this surfaced.** `computeDropPrice` originally
charged `DELIVERY_FEE_PER_KM` once — pricing only the outbound leg
while the fleet still ran the return trip for free. It now prices both
real legs (`outboundDeliveryFee`, `retrievalFee`), which is also what
makes paying a real driver honest: at `completeCleaningAndClose`, the
asset's `operatorId` pays each assigned driver their own leg's real
fee out of what the operator was just paid — a second, separate real
V3 settlement, not a second payment system or an invented split.

## DREAMS screens

"Put our screens on so they're always advertising." `hasDreamsScreen`
on an asset, and `registerDreamsScreenFn`/`deactivateDreamsScreenFn` —
**injected, optional, fail-soft** parameters on
`markArrivedAndDeploying`/`dispatchRetrieval` — are the real hook.

**The screen is always VOID's, never the unit owner's.** A real
follow-up correction: "those won't have necessarily a direct touch to
a Hunt's business ... those will be our screens ... where other
people are paying us to advertise." `registerDreamsScreenFn` is now
called with `screenOwnerId: VOID_PLATFORM_ACCOUNT_ID` (the same
`'void-platform'` account every vertical's take rate already settles
to) regardless of whether the asset itself is VOID-owned or a real
third-party/business/investor unit — the billboard-company shape: VOID
owns and sells the ad placement, independent of who owns the structure
it rides on. A unit rented out carries VOID's own ad network, which
could be advertising VOID's own other apps or any real paying
advertiser — the same real DREAMS marketplace model already built,
not a second one. Tested directly, including on a third-party-owned
unit specifically to prove the screen does not inherit that ownership.

**Why no default registration implementation is wired into
`server.js`.** DREAMS' own `POST /api/screens` requires the real
screen owner's own Shield session (`requireActor('screenOwnerId')`) —
confirmed directly against `dreams/server.js`, not assumed — with no
service-credential path at all. VOID cannot register a screen
server-to-server through that route as it exists today, even on its
own platform account's behalf. The hook is real, fully tested
(`test/voidDrop.test.js`), and ready for whatever real flow eventually
authorizes this — nothing here pretends that flow already exists.

## VACAY: "Vacay Villas"

A visitor in town who does not want a hotel but wants to stay close —
the real use case named directly. VACAY is the hospitality company;
"Vacay Villas" is the real branded name for these container-built
stays (a real correction — not "Drop Hotel").
`vacay/lib/bookings/dropStays.js` + two routes
(`GET /api/bookings/drop-stays/search`, `POST /api/bookings/drop-stays`)
let a VACAY guest search real `dropRoom`/`dropHome` units near a
location/date range (VOID's own `GET /api/drop/assets/nearby`) and
book one, with the guest's real session forwarded straight through to
VOID's own booking endpoint. VACAY tracks no drop-booking state of its
own — VOID stays the one real system of record, the same
"read/write-through, not a second system" posture `voidServices.js`
already held for VOID job requests. Searching with no category means
both `dropRoom` and `dropHome`, merged by real distance, since VOID
has no single "Vacay Villas" category.

**A naming note, not a built module.** The founder distinguishes
VACAY (the hospitality company booking these stays) from "Village" —
described as the real-estate-plus-DREAMS-screen network spanning
commercial, residential, and these container properties. No such
entity exists in this codebase today (confirmed: distinct from
VXLLAGE, the unrelated social app) and nothing here builds one — the
one concrete consequence already real above is that a Drop unit's
screen is VOID-platform-owned, independent of the unit's own owner,
which is the behavior "Village" describes regardless of what formally
holds that account later.

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
- The HVNTZ and real-estate cross-app hooks the spec describes
  (§§15, 17) — VACAY's own "Vacay Villas" hook is now built; see above.
- A real DREAMS screen registration flow (the hook exists; see "DREAMS
  screens" above for exactly what's missing and why).
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
`POST /api/drop/booking/:id/cancel` ·
`GET /api/drop/assets/nearby`

VACAY: `GET /api/bookings/drop-stays/search` ·
`POST /api/bookings/drop-stays`.

See `void/test/voidDrop.test.js` (31 tests: the full lifecycle with
real drivers and a DREAMS screen, a failed-inspection path, the
no-double-booking check, hub-derived homing, the nearby search) and
`vacay/test/dropStays.test.js` for the real, exercised behavior.
