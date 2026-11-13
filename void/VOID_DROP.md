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

**Four modules, not sixteen.** 16 named products (DROP POP SHOP, DROP
FOOD, …) differ in label, typical uses, and which rental models make
sense — not in mechanics. `voidDropCategories.js` is config, matching
`verticalServiceConfigs.js`'s own SERVICE_CONFIGS pattern; one real
engine (`voidDropAssets.js` + `voidDropBooking.js` + `voidDropZones.js`,
the last covered below) serves all 16. Adding a 17th product is a new
config entry, never a new module — the founder's own standing
instruction, applied directly. (DROP SHOP's real branded name is
"DROP POP SHOP" — the category id stayed `dropShop`, only the label
changed. DROP BATH — mobile luxury bathroom — and DROP BAR — mobile
bar setup — are the 15th and 16th, added the same way.)

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

**The screen belongs to the current renter, not VOID and not the
asset's owner.** A real follow-up correction, superseding the earlier
"always VOID's own" decision: "those screens that are connected to the
void operation ... will just be connected to whatever business is out
there ... it's just like having an apartment complex with screens in
it that we created — those screens are attached to that apartment
complex, but are also still part of the Dreams network." A fresh
screen is registered per deployment (the asset's own `dreamsScreenId`
is cleared on retrieval, so a redeploy to a new customer registers a
new one), and `screenOwnerId` is now `booking.customerId` — the
business currently renting and running that location — regardless of
who owns the physical unit itself. Tested directly, including on a
third-party-owned unit, to prove the screen follows the renter, not
the asset's owner.

**This is what makes "the renter receives a small percentage of scans
and sales on the screens" real, using DREAMS' own existing payout
mechanism rather than inventing a second one.** DREAMS'
`screenOwnerId` was already both the registration/deactivation
authority and the payout recipient for ad-impression revenue (a real
70/30 split, `SCREEN_OWNER_SHARE`). The founder's own further
follow-up ("we will run our ads ... plus the renter's personal ads
... they will receive a small percentage of scans and sales on the
screens") needed two things DREAMS did not yet have — real, audited —
and now does: `setScanPricing`/`recordScan` (a scan priced and split
the same shape as an impression) and `setSaleCommission`/`recordSale`
(a real commission, a percentage of an actual sale's own value, since
taking a cut of a full sale the way an impression is charged would be
unrealistic — the "small percentage" the founder names). Both split
70/30 to whoever is registered as `screenOwnerId` at the time, so the
renter is who actually gets paid while their deployment is live. See
`dreams/lib/campaigns.js` and `dreams/test/scanSale.test.js`.

**Why no default registration implementation is wired into
`server.js`.** DREAMS' own `POST /api/screens` requires the real
screen owner's own Shield session (`requireActor('screenOwnerId')`) —
confirmed directly against `dreams/server.js`, not assumed — with no
service-credential path at all. VOID cannot register a screen
server-to-server through that route as it exists today, even on the
renter's own behalf. The hook is real, fully tested
(`test/voidDrop.test.js`), and ready for whatever real flow eventually
authorizes this — nothing here pretends that flow already exists.

## Drop Zones: a real "small village" or "shopping center"

Spec §18, previously the one deliberately-not-built item on this
list: "A vacant commercial property could temporarily host DROP FOOD,
DROP SHOP, DROP SPA, DROP GAME, DROP EVENT — creating a temporary
commercial village." Built now, directly against the founder's own
follow-up ("if we have enough different setups, we could piece all
these things together and have a small village or a small shopping
center").

`voidDropZones.js` registers a real `DropZone` — a named location
with real coordinates and a real integer `maxUnits` — and
`createDropBooking` takes an optional `zoneId`. Two real consequences
of booking into a zone rather than a bare address:

1. **The zone's own real capacity gates the booking**, the same
   "refuse before accepting" posture `isAssetAvailable` already holds
   for a single asset's date range — a booking into a full zone for
   an overlapping date range is refused outright, not silently
   over-packed.
2. **The zone's own site is already proven.** `locationType`/`lat`/
   `lng`/`siteAddress` come from the zone itself, and road access is
   treated as already confirmed — registering a zone *is* the
   real-world act of establishing that a location supports drop
   deliveries, so asking the same two eligibility questions again for
   every unit dropped there would be real, pointless duplication. The
   zone's own location overrides whatever the caller passed for those
   fields.

`GET /api/drop/zone/:id/occupancy` is the real "what does this little
village look like right now" view: every unit actually on site
(`deployed`/`active`/`retrieval-scheduled`, whose date range covers
right now), each with its own real category — not a stand-in list,
and not units merely booked for a future date. No category
restriction on what may book into a zone, matching the spec's own
mixed-category example directly.

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

**A naming note, not a built module.** The brand family, per the
founder's own two follow-ups, stated plainly rather than inferred:

- **VACAY is one hospitality company/app**, hotel-style and Airbnb-
  style both. **Vacay Villa** is the container-built product line
  under it (a single unit); many Villas clustered together (what this
  file calls a Drop Zone above) is a **container village** — a small
  one, distinct from the larger "Village" below. Plural branding
  follows the same letter-swap VXLLAGE already uses: "Villas" →
  "VXLLAS."
- **"Village" is a two-sided brand, same shape as "The Vault" (physical)
  and Vault Studios (the app)**: one physical half (real estate plus
  the DREAMS screen network, spanning commercial, residential, and
  container properties) and one app half. **VXLLAGE — the social app
  already built in this repo** (feed, threads, villages, live, call,
  cosmetics) — is that app half, not an unrelated brand as an earlier
  draft of this note assumed; the physical half has no built entity of
  its own yet.

Nothing here stands up a formal "Village" (physical) account or
corporate entity. The screen-ownership behavior above no longer
implies one either: a Drop unit's screen is now the current renter's,
not VOID's own platform account — "Village" as the physical
real-estate/screen-network half of the brand remains undecided in
code, a real naming question, not a built one.

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
- A formal "Village" (physical) account/entity in code — see the
  naming note above. No longer implied by screen ownership (now the
  renter's), and still undecided.
- A real QR/NFC scan mechanism on a physical screen, and a real
  sales-attribution link between a scan and a confirmed purchase.
  `recordScan`/`recordSale` (DREAMS) are the real revenue-settlement
  half — pricing, the 70/30 split, the budget/commission math — but
  nothing here simulates the hardware/attribution chain that would
  call them from an actual scan or sale happening in the real world;
  see "DREAMS screens" above.
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
`GET /api/drop/assets/nearby` ·
`POST /api/drop/zone` · `GET /api/drop/zone/:id` · `GET /api/drop/zones` ·
`POST /api/drop/zone/:id/status` · `GET /api/drop/zone/:id/occupancy`

VACAY: `GET /api/bookings/drop-stays/search` ·
`POST /api/bookings/drop-stays`.

See `void/test/voidDrop.test.js` (~~31~~ **32** tests — corrected
13 Nov 2026, doc-vs-code reconciliation pass, counted directly against
the real suite: the full lifecycle with real drivers and a DREAMS
screen, a failed-inspection path, the no-double-booking check,
hub-derived homing, the nearby search) and `vacay/test/dropStays.test.js`
for the real, exercised behavior.
