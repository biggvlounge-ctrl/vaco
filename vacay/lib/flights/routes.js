// VACAY -- Flights section routes (Expedia's merchant-of-record
// model). Mounted at /api/flights in server.js.
//
// The real point of merging everything into one app: `/bundles` now
// calls the Bookings section's own `createBooking` DIRECTLY, in the
// same process -- no more cross-app HTTP call the way the standalone
// `vacay-flights` app had to make into a separately-running `vacay`
// server. Still not a true distributed transaction (a failed flight
// booking after a successful stay booking still isn't automatically
// rolled back -- flagged honestly, same as before), but the surface
// area for that failure mode is smaller now: no network hop, no
// possibility of the two servers disagreeing about whether the other
// is even reachable.

const express = require('express');
const {
  CABIN_CLASSES, FLIGHT_STATUSES, listFlight, getFlight, searchFlights,
} = require('./flights');
const {
  VACAY_FLIGHTS_ESCROW_ACCOUNT, bookFlight, getFlightBooking, listBookingsForPassenger, cancelFlightBooking,
} = require('./reservations');
const { bookRental } = require('../auto/rentals');
const { bookFleetRental } = require('../auto/fleetRentals');

const BUNDLE_DISCOUNT_PERCENT = 0.10;
const CAR_KINDS = ['vehicle', 'fleet'];

const {
  requireActor, requireSession, requireCallingService,
} = require('../shieldAuth.cjs');

// A bundle names its actors one level down -- `flight.passengerId`,
// `stay.guestId`, and now optionally `car.renterId` -- which
// `requireActor` cannot see, since it reads top-level body fields. All
// of them must be the caller: a bundle is one person's trip, and
// letting any leg name a different person would be a way to book a
// stranger a flight (or a car, or a ride pack) on your own session.
// `ridePack` names nobody of its own -- it always rides on the same
// traveller the other legs already named.
function requireBundleActor() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const body = req.body || {};
    const named = [
      body.flight && body.flight.passengerId,
      body.stay && body.stay.guestId,
      body.car && body.car.renterId,
    ].filter(Boolean);
    if (named.length === 0) {
      return res.status(400).json({ error: 'bundles must name the traveller in flight.passengerId and stay.guestId' });
    }
    if (named.some((id) => id !== req.sessionUserId)) {
      return res.status(403).json({ error: 'a bundle must be booked for yourself: every named leg must be you' });
    }
    return next();
  });
}

function requireFlightPassenger(getBooking) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const booking = getBooking(Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no flight booking with id ${req.params.id}` });
    if (booking.passengerId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the passenger may cancel this flight booking' });
    }
    return next();
  });
}

function createFlightsRouter(deps) {
  const {
    store, bookingsStore, autoStore, settleVCoin, createBooking, purchaseVoidRidePackFn,
  } = deps;
  const router = express.Router();

  router.get('/meta', (_req, res) => {
    res.json({
      cabinClasses: CABIN_CLASSES, flightStatuses: FLIGHT_STATUSES, escrowAccount: VACAY_FLIGHTS_ESCROW_ACCOUNT, bundleDiscountPercent: BUNDLE_DISCOUNT_PERCENT, bundleCarKinds: CAR_KINDS,
    });
  });

  // Airline inventory that VACAY resells as merchant of record -- not a
  // user's property, and there is no actor whose session could own it.
  // Operator surface, guarded as a service call.
  router.post('/flights', requireCallingService(), (req, res) => {
    try {
      res.status(201).json(listFlight(store, req.body || {}));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/flights/:id', (req, res) => {
    const flight = getFlight(store, Number(req.params.id));
    if (!flight) return res.status(404).json({ error: `no flight with id ${req.params.id}` });
    res.json(flight);
  });

  router.get('/flights', (req, res) => {
    res.json({ flights: searchFlights(store, { origin: req.query.origin, destination: req.query.destination }) });
  });

  router.post('/flight-bookings', requireActor('passengerId'), async (req, res) => {
    try {
      res.status(201).json(await bookFlight(store, { ...req.body, settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/flight-bookings/:id', (req, res) => {
    const booking = getFlightBooking(store, Number(req.params.id));
    if (!booking) return res.status(404).json({ error: `no flight booking with id ${req.params.id}` });
    res.json(booking);
  });

  router.post('/flight-bookings/:id/cancel', requireFlightPassenger((id) => getFlightBooking(store, id)), async (req, res) => {
    try {
      res.json(await cancelFlightBooking(store, { bookingId: Number(req.params.id), settleFn: settleVCoin }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/passengers/:passengerId/flight-bookings', (req, res) => {
    res.json({ bookings: listBookingsForPassenger(store, req.params.passengerId) });
  });

  // Real, in-process cross-section bundle -- see this file's own
  // header for why it's no longer a cross-app HTTP call.
  //
  // Two real, optional legs on top of the original flight+stay pair,
  // per direct instruction ("a flight, a hotel, and a rental car...
  // or an Airbnb-style rental, a Turo-style rental, and a flight...
  // between vacay, pretty much"):
  //   `car`    -- a real Auto-section rental, either kind VACAY
  //               already has (`kind: "vehicle"` for the Turo-style
  //               peer fleet via bookRental, `kind: "fleet"` for
  //               VACAY's own Hertz-style fleet via bookFleetRental).
  //               Genuinely either one makes this a real Priceline-
  //               style flight+hotel+car bundle -- which "hotel" vs.
  //               "Airbnb-style" means is already unified one level
  //               down, in `stay.listingId`'s own `hostType`.
  //   `ridePack` -- optionally also buys the traveller a real VOID
  //               Ride Pass for use during the trip ("connected to
  //               VOID for rides while you're gone"), a real
  //               cross-app call into VOID's own new
  //               `POST /api/ride-pass/purchase` (see void/lib/
  //               ridePass.js). The *other* half of that same
  //               instruction -- a standalone, ongoing VOID ride
  //               subscription, independent of any one trip, the
  //               Uber One/Lyft Pass comparable -- is VOID's own
  //               product, not a VACAY one, and is reachable on its
  //               own merits directly from VOID; this bundle only
  //               ever purchases a pass, exactly like any other leg,
  //               never auto-subscribes anybody to anything recurring.
  //
  // Neither new leg gets BUNDLE_DISCOUNT_PERCENT applied -- that
  // discount is specifically the flight's own merchant-of-record
  // margin funding a price cut on itself (see bookFlight's own
  // `discountPercent`), not a markdown VACAY can hand out on a peer
  // owner's rental earnings or a cross-app VOID purchase it does not
  // control the margin on. Same honestly-flagged gap as before,
  // unchanged by adding more legs: this still is not a true
  // distributed transaction -- a failure partway through leaves
  // whichever earlier legs already succeeded booked, not rolled back.
  router.post('/bundles', requireBundleActor(), async (req, res) => {
    try {
      const result = await bookBundle(
        { bookingsStore, store, autoStore, settleVCoin, createBooking, purchaseVoidRidePackFn },
        req.body || {},
        req.headers.authorization,
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  return router;
}

// Lifted out of the route handler above so it's directly testable
// without an Express request/response -- same validation, same real
// calls, same response shape, just not reaching into `req`/`res`
// itself. `deps` is the same shape `createFlightsRouter` builds its
// router from, plus `bookRental`/`bookFleetRental`, which this
// function needs directly rather than through the router's closure.
function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

async function bookBundle(deps, body, authHeader) {
  const {
    bookingsStore, store, autoStore, settleVCoin, createBooking, purchaseVoidRidePackFn,
  } = deps;
  const { flight, stay, car, ridePack } = body;

  if (!flight || !flight.flightId || !flight.passengerId) {
    throw badRequest('bundles requires flight: { flightId, passengerId }');
  }
  if (!stay || !stay.listingId || !stay.guestId || !stay.checkIn || !stay.checkOut) {
    throw badRequest('bundles requires stay: { listingId, guestId, checkIn, checkOut }');
  }
  if (car) {
    if (!CAR_KINDS.includes(car.kind)) {
      throw badRequest(`bundles.car requires a kind of ${CAR_KINDS.join(' or ')}`);
    }
    if (!car.vehicleId || !car.renterId || !Number.isInteger(car.startDate) || !Number.isInteger(car.endDate)) {
      throw badRequest('bundles.car requires { kind, vehicleId, renterId, startDate, endDate }');
    }
  }
  if (ridePack && !ridePack.planId) {
    throw badRequest('bundles.ridePack requires { planId }');
  }
  if (ridePack && typeof purchaseVoidRidePackFn !== 'function') {
    throw badRequest('bundles.ridePack is not available -- this server has no purchaseVoidRidePackFn configured');
  }

  const stayBooking = await createBooking(bookingsStore, {
    listingId: stay.listingId, guestId: stay.guestId, checkIn: stay.checkIn, checkOut: stay.checkOut, settleFn: settleVCoin,
  });
  const flightBooking = await bookFlight(store, {
    flightId: flight.flightId, passengerId: flight.passengerId, discountPercent: BUNDLE_DISCOUNT_PERCENT, settleFn: settleVCoin,
  });

  let carBooking = null;
  if (car) {
    const bookCar = car.kind === 'fleet' ? bookFleetRental : bookRental;
    carBooking = await bookCar(autoStore, {
      vehicleId: car.vehicleId, renterId: car.renterId, startDate: car.startDate, endDate: car.endDate, settleFn: settleVCoin,
    });
  }

  let ridePackPurchase = null;
  if (ridePack) {
    ridePackPurchase = await purchaseVoidRidePackFn(
      { customerId: flight.passengerId, planId: ridePack.planId },
      authHeader,
    );
  }

  return {
    stayBooking, flightBooking, carBooking, ridePack: ridePackPurchase, bundleDiscountApplied: BUNDLE_DISCOUNT_PERCENT,
  };
}

module.exports = { createFlightsRouter, bookBundle };
