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
  `routes.js` (mounts all of the above at `/api/bookings`; its own
  header explains the one real route-ordering care this section's
  design requires).
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

## Not yet built
- VPLAN itinerary generation — doesn't exist as code anywhere yet.
- The real, evidence-based differentiation opportunities the
  comparables doc names directly: a stronger host-cancellation
  guarantee and photo/condition verification (failure pattern #3,
  double-booking, is already structurally solved via the interval-
  overlap guard, reused five times now across this one app: VACAY
  Stays, VACAY Experiences, VACAY Auto/Turo, VACAY Auto/Fleet, and
  originally VOID MAGIC).
- `hostType` is a plain field with no different real behavior attached
  yet (no professional-only verification/insurance requirements, no
  different search ranking).
- Real DSP/map-based search across any section. Real distributed-
  transaction safety for `/api/flights/bundles` (still not a true
  atomic transaction, just a smaller failure window now that it's
  in-process — see `lib/flights/routes.js`'s own header).
- CarGurus' own real market-average computation — `marketAveragePrice`
  is honestly caller-supplied, not computed from any real aggregated
  data (none exists in this session).
- Any UI, for any section.
