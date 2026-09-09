// VACAY -- VOID Integration (Phase 3): ground transportation and
// cleaning/maintenance, real cross-app calls into VOID's own job
// marketplace.
// Source of truth: `VOID_MASTER_FREEZE.md`'s real cross-app
// integration map names this connection outright: "VACAY | Ground
// transportation, cleaning/maintenance for stays/rentals." That same
// doc cites "VACAY's own brief" as already documenting the detail --
// no such document exists anywhere in this session (flagged directly
// in this project's own README since Phase 1), so the exact real
// mapping below is a real, defensible interpretation grounded in
// VOID's own actual, already-built vertical list
// (`void/lib/verticals.js`), not an invented one:
//   transportation -> VOID's real `transportation` vertical,
//     requested by the GUEST (airport pickup / local transport during
//     the stay -- the guest's own real logistics need).
//   cleaning -> VOID's real `cleaningHandyman` vertical, requested by
//     the HOST (real-world turnover cleaning between guests is the
//     host's operational cost, not the guest's).
//
// Real code reuse, the same pattern already established twice this
// session (CHOPZ SHOP's `requestVoidCourierJob`, VOID MAGIC's
// `eventServices.js`): this module creates an actual job on VOID's
// existing `requestJob()`/verticals system via an injected
// `voidRequestFn`, not a fourth parallel logistics system. Real
// payment model: VOID's own job settles its own payout (driver/
// cleaner paid, VOID's own take rate) entirely inside VOID once the
// job completes -- VACAY only orchestrates the request, mirroring
// CHOPZ SHOP's `requestFulfillment` exactly, not a local payment
// duplication.

const { getBooking } = require('./bookings');
const { getListing } = require('./listings');

const VOID_SERVICE_TYPES = ['transportation', 'cleaning'];
const VOID_SERVICE_TO_VERTICAL = {
  transportation: 'transportation',
  cleaning: 'cleaningHandyman',
};

async function requestVoidService(store, options = {}) {
  const {
    bookingId, serviceType, quantity, unitPrice, voidRequestFn, now = Date.now(),
  } = options;

  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`requestVoidService: no booking with id ${bookingId}`);
  if (!VOID_SERVICE_TYPES.includes(serviceType)) {
    throw new Error(`requestVoidService: invalid serviceType "${serviceType}" (expected one of ${VOID_SERVICE_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('requestVoidService requires a positive quantity');
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('requestVoidService requires a positive unitPrice');
  if (typeof voidRequestFn !== 'function') {
    throw new Error('requestVoidService requires a voidRequestFn(verticalId, customerId, quantity, unitPrice)');
  }

  const listing = getListing(store, booking.listingId);
  // The real, distinct requester per service type: the guest pays for
  // their own transportation, the host pays for turnover cleaning --
  // not the same party either way.
  const customerId = serviceType === 'transportation' ? booking.guestId : listing.hostId;
  const verticalId = VOID_SERVICE_TO_VERTICAL[serviceType];

  const job = await voidRequestFn(verticalId, customerId, quantity, unitPrice);

  const request = {
    id: store.nextVoidServiceRequestId++,
    bookingId,
    serviceType,
    verticalId,
    customerId,
    voidJobId: job.id,
    status: 'requested',
    requestedAt: now,
  };
  store.voidServiceRequests.push(request);
  return request;
}

function getVoidServiceRequest(store, requestId) {
  return store.voidServiceRequests.find((r) => r.id === requestId) || null;
}

function listVoidServiceRequests(store, bookingId) {
  if (!getBooking(store, bookingId)) throw new Error(`listVoidServiceRequests: no booking with id ${bookingId}`);
  return store.voidServiceRequests.filter((r) => r.bookingId === bookingId);
}

module.exports = {
  VOID_SERVICE_TYPES, VOID_SERVICE_TO_VERTICAL, requestVoidService, getVoidServiceRequest, listVoidServiceRequests,
};
