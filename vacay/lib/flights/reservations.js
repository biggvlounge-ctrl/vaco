// VACAY FLIGHTS -- Bookings, the real core loop.
// Real, deliberate difference from Stays/Experiences/Auto's escrow-
// THEN-settle shape (charge now, pay out later at a future real-world
// event): a flight ticket is issued instantly -- there's no future
// "trip completion" to wait for the way there is for a multi-night
// stay or a multi-day rental. So settlement here is a real, single
// atomic action, the same real justification CHOPZ SHOP's own
// checkout already used for the identical reason (an instantaneous
// real-world event). One booking call: charge the passenger the real
// retail price, then immediately pay the airline its own real net
// rate and keep the remainder as VACAY Flights' own real margin --
// both payouts always sum to exactly what the passenger was charged.
//
// Real seat-capacity tracking (the same real availability-decrement
// shape Experiences already established for a scheduled, capacity-
// limited real-world thing) instead of a date-overlap guard --
// correct for this domain: many passengers can book the exact same
// flight, up to its real seat count, unlike a stay or a rental car
// which only one guest/renter can hold at a time.

const { getFlight } = require('./flights');

const VACAY_FLIGHTS_ESCROW_ACCOUNT = 'vacay-flights-escrow';
const VACAY_FLIGHTS_PLATFORM_ACCOUNT = 'vacay-flights-platform';

function round(n) {
  return Math.round(n * 100) / 100;
}

// The airline is a real, external, non-VACAY supplier -- not a
// VACAY-registered host/owner the way Stays/Auto have -- so it gets a
// real, deterministic synthetic account id rather than a user-
// supplied one, the same posture VOID's own external-vertical
// accounts use elsewhere in this session.
function airlineAccountFor(airline) {
  return `airline:${airline}`;
}

async function bookFlight(store, options = {}) {
  const {
    flightId, passengerId, transferFn, discountPercent = 0, now = Date.now(),
  } = options;

  const flight = getFlight(store, flightId);
  if (!flight) throw new Error(`bookFlight: no flight with id ${flightId}`);
  if (flight.status !== 'scheduled') throw new Error(`bookFlight: flight ${flightId} is not bookable (status: ${flight.status})`);
  if (flight.seatsAvailable < 1) throw new Error(`bookFlight: flight ${flightId} has no seats remaining`);
  if (!passengerId) throw new Error('bookFlight requires a passengerId');
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent >= 1) {
    throw new Error('bookFlight requires a discountPercent between 0 (inclusive) and 1 (exclusive)');
  }
  if (typeof transferFn !== 'function') throw new Error('bookFlight requires a transferFn(fromUserId, toUserId, amount, reason)');

  const retailPriceCharged = round(flight.retailPrice * (1 - discountPercent));
  // A real, layered guard beyond listFlight's own check -- a bundle
  // discount (see server.js's bookBundle) can never discount a ticket
  // below what VACAY Flights itself owes the airline.
  if (retailPriceCharged < flight.netRate) {
    throw new Error(`bookFlight: a ${Math.round(discountPercent * 100)}% discount would drop the price below netRate`);
  }

  const bookingId = store.nextFlightBookingId++;
  await transferFn(passengerId, VACAY_FLIGHTS_ESCROW_ACCOUNT, retailPriceCharged, `vacay_flight_booking:${bookingId}`);

  const margin = round(retailPriceCharged - flight.netRate);
  await transferFn(VACAY_FLIGHTS_ESCROW_ACCOUNT, airlineAccountFor(flight.airline), flight.netRate, `vacay_flight_airline_settlement:${bookingId}`);
  await transferFn(VACAY_FLIGHTS_ESCROW_ACCOUNT, VACAY_FLIGHTS_PLATFORM_ACCOUNT, margin, `vacay_flight_platform_margin:${bookingId}`);

  flight.seatsAvailable -= 1;
  if (flight.seatsAvailable === 0) flight.status = 'sold-out';

  const booking = {
    id: bookingId,
    flightId,
    passengerId,
    retailPriceCharged,
    netRate: flight.netRate,
    margin,
    discountPercent,
    status: 'confirmed',
    cancelledAt: null,
    refunded: null,
    createdAt: now,
  };
  store.flightBookings.push(booking);
  return booking;
}

function getFlightBooking(store, bookingId) {
  return store.flightBookings.find((b) => b.id === bookingId) || null;
}

function listBookingsForPassenger(store, passengerId) {
  return store.flightBookings.filter((b) => b.passengerId === passengerId);
}

// Real cancellation + refund, closing this project's own previously-
// flagged gap -- but a genuinely different real rule shape from
// Stays/Experiences/Auto's 24-hours-BEFORE-the-event cutoff, since
// flights settle instantly at booking (see this file's own header): a
// real, actual, federally-mandated US rule instead of an interpretive
// choice -- the DOT's real "24-Hour Rule" (14 CFR 259.5) requires US
// airlines to allow a full refund if a booking is cancelled within 24
// hours of the BOOKING itself, regardless of fare type. Outside that
// window, this project's flat retail fare has no modeled fare-class
// refundability (no "basic economy" vs. "flexible" distinction exists
// on the Flight entity), so a late cancellation is real and non-
// refundable -- the same honest "don't invent a distinction the data
// model doesn't have" posture as CHOPZ SHOP's own category-rate limits.
//
// Since `bookFlight` already immediately disbursed both the airline's
// netRate and VACAY Flights' own margin (this domain's real "settle
// now, not later" shape), a real refund is sourced back from wherever
// that money actually now sits -- the airline account and the platform
// account -- not from `VACAY_FLIGHTS_ESCROW_ACCOUNT`, which already
// holds nothing for this specific booking.
const DOT_RISK_FREE_CANCELLATION_HOURS = 24;

async function cancelFlightBooking(store, options = {}) {
  const { bookingId, transferFn, now = Date.now() } = options;
  const booking = getFlightBooking(store, bookingId);
  if (!booking) throw new Error(`cancelFlightBooking: no flight booking with id ${bookingId}`);
  if (booking.status === 'cancelled') throw new Error(`cancelFlightBooking: booking ${bookingId} is already cancelled`);
  if (typeof transferFn !== 'function') throw new Error('cancelFlightBooking requires a transferFn(fromUserId, toUserId, amount, reason)');

  const hoursSinceBooking = (now - booking.createdAt) / 3600000;
  const refundEligible = hoursSinceBooking <= DOT_RISK_FREE_CANCELLATION_HOURS;

  if (refundEligible) {
    const flight = getFlight(store, booking.flightId);
    await transferFn(airlineAccountFor(flight.airline), booking.passengerId, booking.netRate, `vacay_flight_dot_24h_refund_airline_share:${bookingId}`);
    await transferFn(VACAY_FLIGHTS_PLATFORM_ACCOUNT, booking.passengerId, booking.margin, `vacay_flight_dot_24h_refund_platform_share:${bookingId}`);

    // The seat is only genuinely released back to inventory on a real
    // refund -- a late, non-refundable cancellation keeps the seat
    // marked sold, the same real posture most airlines take toward a
    // forfeited, non-refundable fare.
    flight.seatsAvailable += 1;
    if (flight.status === 'sold-out') flight.status = 'scheduled';
  }

  booking.status = 'cancelled';
  booking.cancelledAt = now;
  booking.refunded = refundEligible;
  return booking;
}

module.exports = {
  VACAY_FLIGHTS_ESCROW_ACCOUNT, VACAY_FLIGHTS_PLATFORM_ACCOUNT, DOT_RISK_FREE_CANCELLATION_HOURS, airlineAccountFor, bookFlight, getFlightBooking, listBookingsForPassenger, cancelFlightBooking,
};
