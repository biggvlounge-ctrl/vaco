// VOID — VOID Reserve (rides), modeled on the real Uber Reserve.
// Source of truth: VOID_MASTER_FREEZE.md: book up to 90 days in
// advance; the system attempts driver matching before the scheduled
// pickup time (not last-minute dispatch at the appointed hour); a
// clear cancellation-fee window applies (free up to 60 minutes before
// pickup).

const MAX_ADVANCE_BOOKING_DAYS = 90;
const FREE_CANCELLATION_WINDOW_MINUTES = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

function createReserveBooking(store, options = {}) {
  const { riderId, pickupTime, pickupLocation, dropoffLocation, estimatedFare, now = Date.now() } = options;

  if (!riderId) throw new Error('createReserveBooking requires a riderId');
  if (!Number.isFinite(pickupTime)) throw new Error('createReserveBooking requires a numeric pickupTime (ms epoch)');
  if (pickupTime <= now) throw new Error('createReserveBooking: pickupTime must be in the future');
  if (pickupTime - now > MAX_ADVANCE_BOOKING_DAYS * MS_PER_DAY) {
    throw new Error(`createReserveBooking: pickupTime cannot be more than ${MAX_ADVANCE_BOOKING_DAYS} days out`);
  }
  if (!pickupLocation) throw new Error('createReserveBooking requires a pickupLocation');
  if (!dropoffLocation) throw new Error('createReserveBooking requires a dropoffLocation');
  if (!Number.isFinite(estimatedFare) || estimatedFare <= 0) {
    throw new Error('createReserveBooking requires a positive estimatedFare');
  }

  const booking = {
    id: store.nextReserveBookingId++,
    riderId,
    pickupTime,
    pickupLocation,
    dropoffLocation,
    estimatedFare,
    status: 'scheduled',
    matchedDriverId: null,
    matchedAt: null,
    cancelledAt: null,
    createdAt: now,
  };
  store.reserveBookings.push(booking);
  return booking;
}

function getReserveBooking(store, bookingId) {
  return store.reserveBookings.find((b) => b.id === bookingId) || null;
}

// The real mechanic: attempted before the scheduled pickup time, not a
// last-minute dispatch at the appointed hour.
function matchReserveDriver(store, options = {}) {
  const { bookingId, driverId, now = Date.now() } = options;
  const booking = getReserveBooking(store, bookingId);
  if (!booking) throw new Error(`matchReserveDriver: no booking with id ${bookingId}`);
  if (booking.status !== 'scheduled') {
    throw new Error(`matchReserveDriver: booking ${bookingId} is "${booking.status}", expected "scheduled"`);
  }
  if (!driverId) throw new Error('matchReserveDriver requires a driverId');
  if (now >= booking.pickupTime) {
    throw new Error('matchReserveDriver: matching must happen before the scheduled pickup time, not at or after it');
  }
  booking.matchedDriverId = driverId;
  booking.status = 'matched';
  booking.matchedAt = now;
  return booking;
}

// The real cancellation-fee window: free up to 60 minutes before
// pickup, a fee applies inside that window.
function cancelReserveBooking(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = getReserveBooking(store, bookingId);
  if (!booking) throw new Error(`cancelReserveBooking: no booking with id ${bookingId}`);
  if (booking.status === 'cancelled') {
    throw new Error(`cancelReserveBooking: booking ${bookingId} is already cancelled`);
  }
  const minutesUntilPickup = (booking.pickupTime - now) / MS_PER_MINUTE;
  const cancellationFeeApplies = minutesUntilPickup < FREE_CANCELLATION_WINDOW_MINUTES;

  booking.status = 'cancelled';
  booking.cancelledAt = now;
  return { booking, cancellationFeeApplies };
}

module.exports = {
  MAX_ADVANCE_BOOKING_DAYS,
  FREE_CANCELLATION_WINDOW_MINUTES,
  createReserveBooking,
  getReserveBooking,
  matchReserveDriver,
  cancelReserveBooking,
};
