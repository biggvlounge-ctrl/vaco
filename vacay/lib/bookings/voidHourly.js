// VACAY -- VOID Hourly for sightseeing (Phase 4).
// Source of truth: `VOID_MASTER_FREEZE.md`'s cross-app map: "VACAY |
// VOID Hourly for sightseeing/Experiences tab | New" -- a distinct,
// separate real integration point from Phase 3's ground-transport/
// cleaning work (that entry was marked "already documented," this one
// is explicitly marked "New").
//
// A real, honest limitation, checked directly against VOID's own
// actual code (`void/lib/hourlyBooking.js`) before building this,
// same discipline already applied to CVNVO's own VOID ride
// integration: VOID Hourly's real `createHourlyBooking` requires a
// `driverId` directly at creation time -- there is no request/match
// dispatch flow for it the way VOID's job marketplace has
// (`requestJob` -> `matchProvider`). This module is therefore built
// exactly to that real shape: a guest's sightseeing booking requires
// an already-known `driverId`, flagged here and in the README rather
// than papered over with an invented matching step VOID doesn't
// actually have yet.

const { getBooking } = require('./bookings');

async function requestSightseeing(store, options = {}) {
  const {
    bookingId, driverId, blockHours, hourlyRate, overageRatePerMile, overageRatePerMinute,
    voidHourlyRequestFn, now = Date.now(),
  } = options;

  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`requestSightseeing: no booking with id ${bookingId}`);
  if (!driverId) {
    throw new Error('requestSightseeing requires a driverId -- VOID Hourly has no anonymous request/match dispatch flow yet, unlike VOID\'s job marketplace');
  }
  if (typeof voidHourlyRequestFn !== 'function') {
    throw new Error('requestSightseeing requires a voidHourlyRequestFn(riderId, driverId, blockHours, hourlyRate, overageRatePerMile, overageRatePerMinute)');
  }

  const hourlyBooking = await voidHourlyRequestFn(
    booking.guestId,
    driverId,
    blockHours,
    hourlyRate,
    overageRatePerMile,
    overageRatePerMinute,
  );

  const request = {
    id: store.nextSightseeingRequestId++,
    bookingId,
    guestId: booking.guestId,
    driverId,
    voidHourlyBookingId: hourlyBooking.id,
    createdAt: now,
  };
  store.sightseeingRequests.push(request);
  return request;
}

function getSightseeingRequest(store, requestId) {
  return store.sightseeingRequests.find((r) => r.id === requestId) || null;
}

function listSightseeingRequests(store, bookingId) {
  if (!getBooking(store, bookingId)) throw new Error(`listSightseeingRequests: no booking with id ${bookingId}`);
  return store.sightseeingRequests.filter((r) => r.bookingId === bookingId);
}

module.exports = { requestSightseeing, getSightseeingRequest, listSightseeingRequests };
