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

const BUNDLE_DISCOUNT_PERCENT = 0.10;

const {
  requireActor, requireSession, requireCallingService,
} = require('../shieldAuth.cjs');

// A bundle names its actors one level down -- `flight.passengerId` and
// `stay.guestId` -- which `requireActor` cannot see, since it reads
// top-level body fields. Both must be the caller: a bundle is one
// person's trip, and letting the two halves name different people would
// be a way to book a stranger a flight on your own session.
function requireBundleActor() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const body = req.body || {};
    const named = [body.flight && body.flight.passengerId, body.stay && body.stay.guestId].filter(Boolean);
    if (named.length === 0) {
      return res.status(400).json({ error: 'bundles must name the traveller in flight.passengerId and stay.guestId' });
    }
    if (named.some((id) => id !== req.sessionUserId)) {
      return res.status(403).json({ error: 'a bundle must be booked for yourself: flight.passengerId and stay.guestId must both be you' });
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
    store, bookingsStore, settleVCoin, createBooking,
  } = deps;
  const router = express.Router();

  router.get('/meta', (_req, res) => {
    res.json({
      cabinClasses: CABIN_CLASSES, flightStatuses: FLIGHT_STATUSES, escrowAccount: VACAY_FLIGHTS_ESCROW_ACCOUNT, bundleDiscountPercent: BUNDLE_DISCOUNT_PERCENT,
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
  router.post('/bundles', requireBundleActor(), async (req, res) => {
    const { flight, stay } = req.body || {};
    if (!flight || !flight.flightId || !flight.passengerId) {
      return res.status(400).json({ error: 'bundles requires flight: { flightId, passengerId }' });
    }
    if (!stay || !stay.listingId || !stay.guestId || !stay.checkIn || !stay.checkOut) {
      return res.status(400).json({ error: 'bundles requires stay: { listingId, guestId, checkIn, checkOut }' });
    }

    try {
      const stayBooking = await createBooking(bookingsStore, {
        listingId: stay.listingId, guestId: stay.guestId, checkIn: stay.checkIn, checkOut: stay.checkOut, settleFn: settleVCoin,
      });
      const flightBooking = await bookFlight(store, {
        flightId: flight.flightId, passengerId: flight.passengerId, discountPercent: BUNDLE_DISCOUNT_PERCENT, settleFn: settleVCoin,
      });
      res.status(201).json({
        stayBooking, flightBooking, bundleDiscountApplied: BUNDLE_DISCOUNT_PERCENT,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createFlightsRouter };
