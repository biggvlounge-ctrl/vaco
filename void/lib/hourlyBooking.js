// VOID — VOID Hourly, modeled on the real Uber Hourly.
// Source of truth: VOID_MASTER_FREEZE.md: book the same driver for a
// set block of time (2-8 hours), flat hourly rate plus per-mile/
// per-minute overage past an included allowance, multiple stops with
// the same driver throughout the booking. Serves both tourist/
// sightseeing and designated-driver use cases with no new dispatch
// mechanism -- just time-block pricing instead of per-trip pricing.
//
// No included-mileage-per-hour allowance number is given anywhere --
// `DEFAULT_INCLUDED_MILES_PER_HOUR` is a real, flagged, interpretive
// default (a caller can override it), not a number taken from the doc.

const MIN_BLOCK_HOURS = 2;
const MAX_BLOCK_HOURS = 8;
const DEFAULT_INCLUDED_MILES_PER_HOUR = 20;

function round(n) {
  return Math.round(n * 100) / 100;
}

function createHourlyBooking(store, options = {}) {
  const {
    riderId, driverId, blockHours, hourlyRate,
    includedMilesPerHour = DEFAULT_INCLUDED_MILES_PER_HOUR,
    overageRatePerMile, overageRatePerMinute,
  } = options;

  if (!riderId) throw new Error('createHourlyBooking requires a riderId');
  if (!driverId) throw new Error('createHourlyBooking requires a driverId');
  if (!Number.isFinite(blockHours) || blockHours < MIN_BLOCK_HOURS || blockHours > MAX_BLOCK_HOURS) {
    throw new Error(`createHourlyBooking requires blockHours between ${MIN_BLOCK_HOURS} and ${MAX_BLOCK_HOURS}`);
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    throw new Error('createHourlyBooking requires a positive hourlyRate');
  }
  if (!Number.isFinite(overageRatePerMile) || overageRatePerMile <= 0) {
    throw new Error('createHourlyBooking requires a positive overageRatePerMile');
  }
  if (!Number.isFinite(overageRatePerMinute) || overageRatePerMinute <= 0) {
    throw new Error('createHourlyBooking requires a positive overageRatePerMinute');
  }

  const booking = {
    id: store.nextHourlyBookingId++,
    riderId, driverId, blockHours, hourlyRate, includedMilesPerHour,
    overageRatePerMile, overageRatePerMinute,
    stops: [],
    createdAt: Date.now(),
  };
  store.hourlyBookings.push(booking);
  return booking;
}

function getHourlyBooking(store, bookingId) {
  return store.hourlyBookings.find((b) => b.id === bookingId) || null;
}

function addHourlyStop(store, options = {}) {
  const { bookingId, location } = options;
  const booking = getHourlyBooking(store, bookingId);
  if (!booking) throw new Error(`addHourlyStop: no booking with id ${bookingId}`);
  if (!location) throw new Error('addHourlyStop requires a location');
  const stop = { location, addedAt: Date.now() };
  booking.stops.push(stop);
  return stop;
}

// The real charge mechanic: the committed block is paid in full
// regardless; exceeding either the included mileage allowance for the
// block or the block's own time triggers real, separate overage
// charges (mirroring the doc's "per-mile/per-minute overage past an
// included allowance").
function computeHourlyCharge(store, options = {}) {
  const { bookingId, actualHours, actualMiles } = options;
  const booking = getHourlyBooking(store, bookingId);
  if (!booking) throw new Error(`computeHourlyCharge: no booking with id ${bookingId}`);
  if (!Number.isFinite(actualHours) || actualHours <= 0) {
    throw new Error('computeHourlyCharge requires a positive actualHours');
  }
  if (!Number.isFinite(actualMiles) || actualMiles < 0) {
    throw new Error('computeHourlyCharge requires a non-negative actualMiles');
  }

  const baseCharge = round(booking.blockHours * booking.hourlyRate);

  const includedMiles = booking.blockHours * booking.includedMilesPerHour;
  const overageMiles = Math.max(0, actualMiles - includedMiles);
  const mileageOverageCharge = round(overageMiles * booking.overageRatePerMile);

  const overageMinutes = Math.max(0, actualHours - booking.blockHours) * 60;
  const timeOverageCharge = round(overageMinutes * booking.overageRatePerMinute);

  const totalCharge = round(baseCharge + mileageOverageCharge + timeOverageCharge);

  return { bookingId, baseCharge, overageMiles: round(overageMiles), mileageOverageCharge, overageMinutes: round(overageMinutes), timeOverageCharge, totalCharge };
}

module.exports = {
  MIN_BLOCK_HOURS,
  MAX_BLOCK_HOURS,
  DEFAULT_INCLUDED_MILES_PER_HOUR,
  createHourlyBooking,
  getHourlyBooking,
  addHourlyStop,
  computeHourlyCharge,
};
