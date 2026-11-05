# VACAY

One app, four real sections inside it, per explicit instruction: "one
big app with different apps inside," not five separate deployable
services (the previous, brief architecture — this README's own git
history shows that split and why it existed first). Same real
comparables as before, now composed into one Express server/one port
instead of five:

- **Bookings** (`/api/bookings`) — Airbnb-style individual stays,
  Booking.com-style professional/hotel inventory (`hostType`), and
  Airbnb Experiences, all sharing the real 15.5% host-fee model and
  the real escrow-then-settle payout shape.
- **Home** (`/api/home`) — Zillow's real estate model: listings for
  sale/rent, monetized entirely differently (agents pay for leads, not
  a transaction cut — see `lib/home/leads.js`'s own header).
- **Auto** (`/api/auto`) — three genuinely distinct real businesses in
  one section: Turo's peer rental (owner-earn split), CarGurus' buy/
  sell used-car marketplace (flat listing fee + a real price-rating
  algorithm), and VACAY's own owned-fleet rental (VACAY keeps 100%,
  Hertz/Enterprise-style — no peer owner to split with).
- **Flights** (`/api/flights`) — Expedia's merchant-of-record model
  (VACAY buys at net rate, sells at retail, keeps the spread), plus
  `/api/flights/bundles` — a real, in-process (no longer cross-app
  HTTP, now that everything shares one server) Flights+Stays booking.

**Each section keeps its own real, isolated `lib/` folder and its own
store namespace** (`lib/store.js`'s own header) — "different apps
inside," not one blended data model. No section's functions were
rewritten for this merge; only how the store is composed and how
routes are mounted changed. See `lib/*/routes.js` for each section's
own real Express Router.

Source docs: `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` (VACAY section —
data models + API map), `VACAY_COMPARABLES.md` (real 2026 fee/failure-
pattern research, including the real Booking.com/Expedia rates this
whole family is validated against).

**A real, flagged resolution of a source-doc inconsistency** (Phase 1,
still applies): the architecture doc's `Listing` model names
`type: "experience"` as an option, but the same doc separately defines
a distinct `Experience` entity and a separate API endpoint — the API
map itself treats stays and experiences as two different real flows,
not one polymorphic Listing. `lib/bookings/listings.js` stays scoped
to stays; `lib/bookings/experiences.js` is its own real module.

**Two real, still-open gaps, flagged directly**: VOID ground-transport/
cleaning integration (`VOID_MASTER_FREEZE.md` cites "VACAY's own
brief" for this, but no such document exists anywhere in this
session — only the combined architecture doc and the comparables doc);
VPLAN (the shared AI itinerary engine also referenced by CVNVO/HVNTZ)
doesn't exist as code anywhere yet.

## Run
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791 (V3 stand-in)
cd ../void && npm install && npm start                   # localhost:8793 (needed for VOID integration routes)
cd vacay && npm install && npm start                       # localhost:8803
```

## Test
```
curl http://localhost:8803/api/health
curl http://localhost:8803/api/bookings/meta
curl http://localhost:8803/api/home/meta
curl http://localhost:8803/api/auto/meta
curl http://localhost:8803/api/flights/meta
```

## What's here
- `lib/store.js` — the one consolidated store, nested by section.
- `lib/bookings/` — `listings.js` (`hostType`: `individual`/
  `professional`, the real Booking.com fold-in), `bookings.js`
  (the real escrow-then-settle core loop, 15.5% flat fee — **booking
  and stay are the same thing here**, per explicit instruction: the
  booking resource lives directly at this section's own root,
  `POST /api/bookings`/`GET /api/bookings/:id`, not nested under a
  separately-named sub-resource), `experiences.js`/
  `experienceBookings.js` (Airbnb Experiences, same real fee shape).
  **Real cancellation + refund (Phase 5)**, closing this project's own
  previously-flagged gap: both `bookings.js` and `experienceBookings.js`
  get a real `cancelBooking`/`cancelExperienceBooking`, the same real
  `CANCELLATION_CUTOFF_HOURS = 24` Airbnb-derived pattern VOID MAGIC's
  own cancellation already established — full refund if cancelled at
  least 24 hours before check-in/the experience start, a late
  cancellation settling to the host exactly like completion does (same
  escrowed source, same split, summing to the full charge) rather than
  a third split. Experience cancellation also frees the real capacity
  slot back regardless of refund eligibility.
  `voidServices.js` (real cross-app VOID transportation/cleaning job
  requests), `voidHourly.js` (real VOID Hourly sightseeing
  integration, with its own honestly-flagged `driverId` limitation),
  `dropStays.js` (VOID DROP's "Vacay Villas" — real `dropRoom`/`dropHome`
  units searched by real location/dates through VOID's own
  `/api/drop/assets/nearby`; searching with no category means both,
  merged by real distance, since VOID has no single "Vacay Villas"
  category. `POST /api/bookings/drop-stays` forwards the guest's real
  session straight through to VOID's own booking endpoint — VACAY
  tracks no drop-booking state of its own; VOID stays the one real
  system of record), `routes.js` (mounts all of the above at
  `/api/bookings`; its own header explains the one real route-ordering
  care this section's design requires).
- `lib/home/` — `listings.js` (real property records, no money
  attached), `leads.js` (the real core loop — free tour requests,
  agent-paid lead purchases with genuinely gated `contactInfo`),
  `routes.js`.
- `lib/auto/` — `vehicles.js`/`rentals.js` (Turo peer rental, real
  protection-plan-tiered owner-earn split), `carListings.js` (**new**:
  CarGurus' real buy/sell model — a flat seller listing fee and a real
  price-rating algorithm, `great-price`→`overpriced`, comparing a
  listing against a caller-supplied market-average reference), 
  `fleetRentals.js` (**new**: VACAY's own owned-fleet rental — no
  peer owner, so `completeFleetRental` pays VACAY's own revenue
  account the full price, one transfer, no split — the real, defining
  contrast with `rentals.js`'s own dual payout), `routes.js`. **Real
  cancellation + refund (Phase 5)**: both `rentals.js` and
  `fleetRentals.js` get the same real 24-hour-before-start cutoff
  (Turo's own real free-cancellation window), a late cancellation
  settling the same way completion does in each — the vehicle's own
  `hostEarnPercent` split for Turo, the full price to VACAY's own fleet
  revenue account with no split for the fleet.
- `lib/flights/` — `flights.js` (real seat-capacity inventory,
  `retailPrice >= netRate` enforced structurally), `reservations.js`
  (real atomic merchant-of-record settlement — passenger charged,
  airline paid its net rate, VACAY keeps the margin). **Real
  cancellation + refund (Phase 5)**: a genuinely different real rule
  shape from the other three sections, since flights settle instantly
  at booking rather than escrow-then-settle — the real, actual,
  federally-mandated US DOT "24-Hour Rule" (14 CFR 259.5): a full
  refund if cancelled within 24 hours of booking (not before
  departure), sourced back from the airline's and platform's own
  accounts since escrow already disbursed everything at booking time.
  Outside that window, cancellation is real and non-refundable — no
  fare-class refundability is modeled on this project's flat retail
  fare, so nothing is invented to fill that gap. `routes.js`
  (including `/bundles` — see its own header for why it's now
  in-process instead of a cross-app HTTP call).
- `server.js` — the composition root: one store, four routers mounted
  under their own section prefixes, the shared `transferVCoin`/
  `requestVoidJob`/`requestVoidHourlyBooking` cross-app clients handed
  to whichever sections need them.

## Verified
Every section's own original verification suite (plain-Node checks +
live passes) was re-run against the merged code and confirmed still
passing, since no lib-level logic changed — only how each module's
`store` argument is supplied (its own nested slice of the one
consolidated store) and how routes are mounted:
- **Bookings**: 5 checks re-confirming listings/bookings/experiences/
  experience-bookings all work correctly against the nested
  `store.bookings` namespace with zero field collisions between the
  sub-modules sharing it.
- **Home**: 2 checks re-confirming the free-tour-request +
  agent-paid-lead-purchase flow against `store.home`.
- **Auto**: 9 checks — Turo rental re-confirmed against `store.auto`;
  the **new** CarGurus price-rating bands proven correct at every
  tier; a real listing charging the seller (not the buyer) the flat
  `$25` fee; sold-listing lifecycle; the **new** fleet rental proven
  to pay VACAY's own revenue account the full amount in exactly one
  transfer, no owner split.
- **Flights**: 3 checks — flight inventory against `store.flights`;
  a simulated in-process bundle proving both a stay and a discounted
  flight book correctly against their own separate store namespaces
  with no cross-store leakage.

**Live, full-stack pass** (all four sections through real HTTP, one
running server): a professional stay listing created, a real flight
listed, and a real `POST /api/flights/bundles` call confirmed booking
**both** — stay $300, flight discounted to $198 — with the traveler's
real V3 balance confirmed decreasing by exactly $498 total
(`1000 → 502`). Then, still live: a CarGurus-style for-sale listing
confirmed charging the seller's real V3 balance the exact `$25`
listing fee; a VACAY fleet vehicle added and rented, completion
confirmed paying VACAY's own fleet-revenue account the full `$160`
rental price in one transfer (no owner split) via its real live V3
balance; a Home listing and a free tour request confirmed moving zero
money for the requester. One real bug caught and fixed during the
merge itself: two files (`voidServices.js`, `voidHourly.js`) still
`require`d the old pre-merge filename `./bookings` after it was
briefly renamed to `./reservations.js` to avoid stuttering against the
section name — caught immediately by the server failing to boot, fixed
by updating both requires, confirmed by a clean restart.

**Naming correction, right after the merge**: per explicit
instruction, "booking and stay should be the same thing" — the
`reservations.js`/`experienceReservations.js` naming above was itself
reverted back to `bookings.js`/`experienceBookings.js` (undoing the
stutter-avoidance rename mentioned just above), and the booking
resource moved from a nested `/api/bookings/reservations` path
directly onto the section's own root (`POST /api/bookings`,
`GET /api/bookings/:id`) — no separate word for the same concept.
This introduced one real, deliberate route-ordering requirement
(`GET /experiences` must be registered before the generic
`GET /:id`, since both are one-segment GET routes and Express
resolves the tie by registration order — see `routes.js`'s own
header), verified live: `GET /api/bookings/experiences` correctly
still returns the experience list, not a "no booking found" 404, and
a real booking created directly at `POST /api/bookings`, read back via
`GET /api/bookings/:id`, and completed via
`POST /api/bookings/:id/complete`, all confirmed working, plus the
`/api/flights/bundles` cross-section call re-confirmed still correct
against the renamed function.

See `dev-docs/` for the full historical record, including each
section's own original phase — the standalone-app split's own
rationale is preserved there, not deleted, even though that
architecture was superseded by this merge.

**Phase 5 (cancellation + refunds, closing the README's own previously-
flagged whole-app gap)**: 8 plain-Node checks across all five booking
types (Stays early-refund and late host-settlement with double-cancel
rejected, Experiences refund with capacity freed, Experiences late
cancellation settling to host with capacity still freed, Auto/Turo
early-refund and late owner-settlement, Auto/Fleet early-refund and
late full-revenue-to-fleet, the Flights DOT 24-hour rule paying a full
refund and restoring the seat, a Flights cancellation outside that
window confirmed non-refundable with the seat staying forfeited, and a
cancel-and-refund on a sold-out flight confirmed freeing the seat for
a new booking), plus a live pass against the real running server and
the real standalone V3: a real Stays booking's `$200` charge fully
refunded on early cancellation, confirmed against V3's own balance
returning to exactly its starting value; and a real flight booking's
`$220` charge fully refunded when cancelled inside the real DOT
24-hour window, confirmed the same way.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8803) — VACAY's own real state now survives a
restart. Live-verified: created a real stay listing, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-13-real-persistence/`.

## Flight + Stay + Car bundles, and a VOID Ride Pack tie-in (1 Nov 2026)

Per direct instruction: a real Priceline-style bundle ("a flight, a
hotel, and a rental car... or an Airbnb-style rental, a Turo-style
rental, and a flight... between VACAY, pretty much"), plus an
optional tie-in to a real VOID Ride Pack for use during the trip
("connected to VOID for rides while you're gone... pay for a certain
amount of rides").

`/api/flights/bundles` (`lib/flights/routes.js`) was a real flight+
stay bundle only; it now takes two further, fully optional legs on
the same request:
- **`car`** — a real Auto-section rental, either real kind this app
  already has: `kind: "vehicle"` (the Turo-style peer fleet, via
  `rentals.js`'s own `bookRental`) or `kind: "fleet"` (VACAY's own
  Hertz/Enterprise-style fleet, via `fleetRentals.js`'s own
  `bookFleetRental`). Either one makes this a genuine flight+hotel+car
  bundle — which "hotel" vs. "Airbnb-style" means is already unified
  one level down, in the stay's own `hostType`, so the bundle itself
  never has to choose between them.
- **`ridePack`** — optionally also buys the traveller a real VOID
  Ride Pack (`{ planId }`) through a real cross-app call into VOID's
  own new `POST /api/ride-pass/purchase` (see `../void/README.md`'s
  own "Phase 19"), forwarding the traveller's real Shield session —
  the same `createDropBookingFn`-style auth-forwarding this app
  already uses for VOID DROP bookings, not the older, no-auth
  `requestVoidJob` shape its own transportation/cleaning calls use.
  The *other* half of that same instruction — a standalone, ongoing
  VOID ride subscription independent of any one trip (the Uber One/
  Lyft Pass comparable) — is VOID's own product, reachable directly
  from VOID on its own merits; this bundle only ever purchases a pass,
  the same as any other leg, never auto-subscribes anyone to anything
  recurring.

Neither new leg receives `bundleDiscountApplied` — that discount is
specifically the flight's own merchant-of-record margin funding a
price cut on itself, not a markdown this app can hand out on a peer
owner's rental earnings or a cross-app VOID purchase it doesn't
control the margin on. The orchestration itself was lifted out of the
route handler into an exported, directly-testable `bookBundle`
function in the same file, rather than tested only through HTTP.

### Verification
8 new unit tests in `test/bundles.test.js` (flight+stay alone; a Turo-
style car leg; a VACAY-fleet car leg — proven to hit
`fleetRentals.js`, not `rentals.js`, by mutation; an unknown `car.kind`
refused before any real charge; a ride pack purchase forwarding the
real `Authorization` header; a ride pack refused when unconfigured; a
failed ride pack purchase leaving the already-booked flight/stay in
place — the same honestly-flagged non-atomic gap as before, just not
newly introduced; and a full four-leg bundle whose total charge to the
traveller conserves exactly against the sum of its three real VACAY-
side legs). Full VACAY suite: 42/42. Mutation-verified the `car.kind`
dispatch specifically: forced it to always call `bookRental`,
confirmed only the fleet-dispatch test went red, restored, confirmed
green again. Live-verified: booted a real VACAY server (Shield/V3/
VOID pointed at closed ports, same posture as this app's own
money-moving tests) and confirmed `/api/flights/meta` now reports the
real `bundleCarKinds`, and a bundle request with no credential is
refused with a real 401 before reaching anyone.

## Not yet built
- VPLAN itinerary generation — doesn't exist as code anywhere yet.
- Of the comparables doc's three named differentiation opportunities:
  double-booking (failure pattern #3) is already structurally solved
  via the interval-overlap guard, reused five times now across this
  one app (VACAY Stays, VACAY Experiences, VACAY Auto/Turo, VACAY
  Auto/Fleet, and originally VOID MAGIC), and the host-cancellation
  guarantee (failure pattern #1) is now also real — see "Real
  host-cancellation guarantee" below. Photo/condition verification
  (failure pattern #2) is still not addressed — the comparables doc's
  own analysis names VACA as the natural home for it (a new
  `vacay-listing` subjectType on an attestation loop that already
  exists), not a new system inside VACAY itself.
- `hostType` is a plain field with no different real behavior attached
  yet (no professional-only verification/insurance requirements, no
  different search ranking).
- Real DSP/map-based search across any section. Real distributed-
  transaction safety for `/api/flights/bundles` (still not a true
  atomic transaction, just a smaller failure window now that it's
  in-process — see `lib/flights/routes.js`'s own header — and now
  possibly four legs deep rather than two, same unchanged gap).
- CarGurus' own real market-average computation — `marketAveragePrice`
  is honestly caller-supplied, not computed from any real aggregated
  data (none exists in this session).
- Any UI, for any section.

## Real host-cancellation guarantee (5 Nov 2026)

Closes `VACAY_COMPARABLES.md`'s own directly-named asymmetry: "a guest
cancelling needs a refund rule, while a host cancelling needs a
*replacement* and a penalty, and a refund alone is precisely the
response that generates the 1-star reviews this research is citing."
Before this, `cancelBooking` applied the same 24-hour, time-based
cutoff regardless of which side cancelled — a host who cancelled 2
hours before check-in kept the guest's money and paid nothing, the
exact backwards outcome the comparables doc flags.

`cancelBooking` now takes a real `cancellingUserId`, checked against
the booking's own real `guestId` and the listing's own real `hostId`
(never trusted as a bare claim of which side is cancelling — refused
otherwise). A host cancellation is **always** fully refunded to the
guest, regardless of timing — the time cutoff exists to protect a host
who held dates in good faith, which doesn't apply to a host who is the
one backing out. The real penalty half: each host cancellation is a
real, counted strike (`getHostCancellationCount`), and a host with
`HOST_CANCELLATION_STRIKE_LIMIT` (3, a real, flagged, bounded choice —
no exact number is given in any source doc) or more strikes is
refused new bookings outright by `createBooking`, a real structural
consequence rather than a cost-free option. `booking.cancelledBy`
('guest' or 'host') is now a real, visible field.

**Honestly out of scope**: the "replacement" half the doc names — an
actual search for the guest's alternate stay — needs a real listing-
search-and-match system this codebase doesn't have, the same honest
limit as VPLAN above. What's built here is the refund guarantee and
the penalty, not an automated rebooking flow.

### Verification

`test/money.test.js` grew by 4: a host cancellation refunding in full
deep inside the cutoff (where a guest cancellation would not), the
real `cancellingUserId` validation refusing both an absent value and a
stranger's claim, a host hitting the real strike limit and being
refused new bookings, and confirming a guest's own cancellation never
counts as a host strike. Full suite: 42/42 → 46/46. Mutation-verified
twice: replacing the host-cancellation bypass with the plain guest-side
cutoff check turned the "deep inside the cutoff" test red; separately,
replacing the strike-limit refusal with `false` turned the repeated-
cancellation test red — both restored and reconfirmed green.

Live-verified end to end against real spawned Shield + V3 + VACAY
servers: a real host registered a listing, a real guest booked a stay
with check-in 2 hours out, the host (not the guest) cancelled it, and
the guest's real V3 balance returned to its original 1000 VCoin while
the host's stayed at 0 — confirmed via `GET /api/vcoin/balance/:userId`
on both accounts, not just the response body.
