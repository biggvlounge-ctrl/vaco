// VOID DROP — eligibility, pricing, and the booking lifecycle.
//
// **Reuses the existing marketplace loop, does not fork it** (spec
// §26's own instruction, and this ecosystem's standing rule #1 in
// CLAUDE.md): a drop booking creates a real job through
// `marketplace.js`'s `requestJob`/`matchProvider`/`acceptJob`/
// `completeJob`, the same way `movingServices.js` and
// `realEstateMedia.js` already do. What is genuinely new is
// everything the generic job model has no field for: a specific
// physical asset, a date range, a multi-step physical delivery/
// deploy/retrieve/inspect/clean cycle. That lives in its own
// `dropBookings` collection with a `jobId` foreign key, same shape
// `movingJobs` already takes.
//
// **Payment settles once, at the end, on purpose.** The spec (§22)
// shows payment happening right after booking, which would mean
// charging before the unit ever moves — a real deposit/upfront-charge
// product decision this module does not invent an answer for (see
// README notes). Instead this follows the generic job convention
// already used everywhere else in VOID: `completeJob` is called once,
// when the physical rental is actually done (asset returned, inspected,
// cleaned), and that is the one moment money moves. Deposits, partial
// holds, and refunds are real gaps, flagged, not faked.
//
// **Eligibility never auto-approves** (spec §7: "final approval may
// require human/operator verification"). A real, automated check can
// only ever REJECT on a real data mismatch (declared site weight limit
// below the unit's real weight, no confirmed road access); anything
// that isn't an outright rejection comes back `pending-review` and
// needs a real human (`approveDropBooking`/`rejectDropBooking`) before
// a booking is confirmed. No zoning/permit database exists anywhere in
// this ecosystem, so this does not pretend to consult one.

const { requestJob, matchProvider, acceptJob, completeJob } = require('./marketplace');
const { getDropCategory } = require('./voidDropCategories');
const {
  getDropAsset, isBookable, setAssetStatus, moveAsset, logMaintenanceEvent,
} = require('./voidDropAssets');
const { haversineDistanceKm } = require('./geo');

const LOCATION_TYPES = [
  'residential-driveway', 'residential-yard', 'commercial-parking-lot', 'commercial-property',
  'vacant-lot', 'event-venue', 'construction-site', 'resort', 'campground', 'festival',
  'corporate-property', 'temporary-business-location', 'hospitality-property', 'other',
];

const ELIGIBILITY_STATUSES = ['pending-review', 'approved', 'rejected'];

const DROP_BOOKING_STATUSES = [
  'pending-approval', 'booked', 'delivery-scheduled', 'in-transit', 'deployed', 'active',
  'retrieval-scheduled', 'returning', 'inspection', 'cleaning', 'completed', 'cancelled', 'rejected',
];

// Flagged interpretive: no source document sets a real delivery-fee
// rate or flat setup fee. These are a visible, overridable default
// rather than a hidden assumption — real pricing data replaces them
// directly, the constant is named so nobody has to grep for a literal.
const DELIVERY_FEE_PER_KM = 3; // VCoin per km, one-way
const SETUP_FEE_FLAT = 50; // VCoin, utilities/positioning labor

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real rejections only on a real mismatch; everything else needs a
// human. See header for why this never auto-approves.
function assessEligibility(store, options = {}) {
  const {
    assetId, locationType, roadAccessConfirmed, siteMaxWeightKg = null, durationDays, intendedUse,
  } = options;

  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`assessEligibility: no asset with id ${assetId}`);
  if (!LOCATION_TYPES.includes(locationType)) {
    throw new Error(`assessEligibility: invalid locationType "${locationType}" (expected one of ${LOCATION_TYPES.join(', ')})`);
  }
  if (typeof roadAccessConfirmed !== 'boolean') {
    throw new Error('assessEligibility requires roadAccessConfirmed (boolean)');
  }
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new Error('assessEligibility requires a positive durationDays');
  }
  if (!intendedUse) throw new Error('assessEligibility requires an intendedUse');

  const reasons = [];
  if (!roadAccessConfirmed) {
    reasons.push('no confirmed road access for delivery equipment');
  }
  if (siteMaxWeightKg !== null) {
    if (!Number.isFinite(siteMaxWeightKg) || siteMaxWeightKg <= 0) {
      throw new Error('assessEligibility: siteMaxWeightKg must be a positive number when provided');
    }
    if (siteMaxWeightKg < asset.weightKg) {
      reasons.push(`the site's own declared weight limit (${siteMaxWeightKg}kg) is below this unit's real weight (${asset.weightKg}kg)`);
    }
  }

  if (reasons.length > 0) return { status: 'rejected', reasons, notes: [] };

  const category = getDropCategory(asset.category);
  const notes = [];
  if (category.zoningSensitive) {
    notes.push(`${category.label} is zoning-sensitive; a human/operator check of local zoning and permits is required regardless of the checks above`);
  }
  return { status: 'pending-review', reasons: [], notes };
}

// Delivery fee is real distance-based pricing, not a flat guess, when
// both the asset's home location and the drop location are known;
// `distanceKm: null` (fee 0) when either is missing rather than
// inventing a number from nothing.
function computeDropPrice(store, options = {}) {
  const { assetId, durationDays, deliveryLat = null, deliveryLng = null } = options;
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`computeDropPrice: no asset with id ${assetId}`);
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new Error('computeDropPrice requires a positive durationDays');
  }

  const rentalPrice = round(asset.dailyRate * durationDays);

  let distanceKm = null;
  let deliveryFee = 0;
  if (Number.isFinite(asset.homeLat) && Number.isFinite(asset.homeLng)
    && Number.isFinite(deliveryLat) && Number.isFinite(deliveryLng)) {
    distanceKm = round(haversineDistanceKm(asset.homeLat, asset.homeLng, deliveryLat, deliveryLng));
    deliveryFee = round(distanceKm * DELIVERY_FEE_PER_KM);
  }

  const totalPrice = round(rentalPrice + deliveryFee + SETUP_FEE_FLAT);
  return {
    rentalPrice, deliveryFee, setupFee: SETUP_FEE_FLAT, distanceKm, totalPrice,
  };
}

// No overlap, checked against every non-cancelled/non-rejected booking
// for this asset, regardless of its current dropStatus -- a completed
// historical booking's dates are already in the past for any real
// future request, so this stays correct without extra filtering.
function isAssetAvailable(store, options = {}) {
  const { assetId, startDate, endDate, excludeBookingId = null } = options;
  return !store.dropBookings.some((b) => b.assetId === assetId
    && b.id !== excludeBookingId
    && !['cancelled', 'rejected'].includes(b.status)
    && startDate < b.endDate && b.startDate < endDate);
}

function createDropBooking(store, options = {}) {
  const {
    customerId, assetId, category, rentalModel, startDate, endDate,
    locationType, deliveryLat, deliveryLng, roadAccessConfirmed, siteMaxWeightKg = null,
    intendedUse, now = Date.now(),
  } = options;

  if (!customerId) throw new Error('createDropBooking requires a customerId');
  const asset = getDropAsset(store, assetId);
  if (!asset) throw new Error(`createDropBooking: no asset with id ${assetId}`);
  if (asset.category !== category) {
    throw new Error(`createDropBooking: asset ${assetId} is category "${asset.category}", not "${category}"`);
  }
  const categoryConfig = getDropCategory(category);
  if (!categoryConfig.supportedRentalModels.includes(rentalModel)) {
    throw new Error(`createDropBooking: "${rentalModel}" is not a supported rental model for ${categoryConfig.label} (supported: ${categoryConfig.supportedRentalModels.join(', ')})`);
  }
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate) || endDate <= startDate) {
    throw new Error('createDropBooking requires a numeric startDate before endDate');
  }
  if (!isBookable(store, assetId)) {
    throw new Error(`createDropBooking: asset ${assetId} is not currently bookable (status or open maintenance issue)`);
  }
  if (!isAssetAvailable(store, { assetId, startDate, endDate })) {
    throw new Error(`createDropBooking: asset ${assetId} is already booked for an overlapping date range`);
  }

  const durationDays = (endDate - startDate) / MS_PER_DAY;
  const eligibility = assessEligibility(store, {
    assetId, locationType, roadAccessConfirmed, siteMaxWeightKg, durationDays, intendedUse,
  });
  if (eligibility.status === 'rejected') {
    throw new Error(`createDropBooking: location is not eligible -- ${eligibility.reasons.join('; ')}`);
  }

  const pricing = computeDropPrice(store, { assetId, durationDays, deliveryLat, deliveryLng });

  const booking = {
    id: store.nextDropBookingId++,
    customerId,
    assetId,
    category,
    rentalModel,
    startDate,
    endDate,
    durationDays,
    locationType,
    deliveryLat,
    deliveryLng,
    intendedUse,
    eligibilityStatus: eligibility.status,
    eligibilityNotes: eligibility.notes,
    pricing,
    status: 'pending-approval',
    jobId: null,
    rentalStartedAt: null,
    rentalEndedAt: null,
    createdAt: now,
  };
  store.dropBookings.push(booking);
  return booking;
}

function getDropBooking(store, bookingId) {
  return store.dropBookings.find((b) => b.id === bookingId) || null;
}

function listDropBookingsForUser(store, customerId) {
  return store.dropBookings.filter((b) => b.customerId === customerId);
}

function requireBookingInStatus(store, bookingId, expected, action) {
  const booking = getDropBooking(store, bookingId);
  if (!booking) throw new Error(`${action}: no drop booking with id ${bookingId}`);
  if (booking.status !== expected) {
    throw new Error(`${action}: booking ${bookingId} is "${booking.status}", expected "${expected}"`);
  }
  return booking;
}

// The real human sign-off eligibility never gives itself (see header).
// Only now does this reach into the shared marketplace loop and
// reserve the real asset -- an approval that never happened must never
// have moved a physical unit or touched the job system.
function approveDropBooking(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'pending-approval', 'approveDropBooking');

  const asset = getDropAsset(store, booking.assetId);
  const job = requestJob(store, {
    verticalId: 'voidDrop', customerId: booking.customerId, quantity: 1, unitPrice: booking.pricing.totalPrice,
    scheduledFor: booking.startDate, lat: booking.deliveryLat, lng: booking.deliveryLng, durationMinutes: null, now,
  });
  matchProvider(store, { jobId: job.id, providerId: asset.operatorId, now });
  acceptJob(store, job.id);

  booking.jobId = job.id;
  booking.eligibilityStatus = 'approved';
  booking.status = 'booked';
  setAssetStatus(store, { assetId: booking.assetId, status: 'reserved', now });
  return booking;
}

function rejectDropBooking(store, options = {}) {
  const { bookingId, reason, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'pending-approval', 'rejectDropBooking');
  if (!reason) throw new Error('rejectDropBooking requires a reason');
  booking.status = 'rejected';
  booking.eligibilityStatus = 'rejected';
  booking.rejectionReason = reason;
  booking.rejectedAt = now;
  return booking;
}

function scheduleDelivery(store, options = {}) {
  const { bookingId, deliveryWindowStart, deliveryWindowEnd } = options;
  const booking = requireBookingInStatus(store, bookingId, 'booked', 'scheduleDelivery');
  if (!Number.isFinite(deliveryWindowStart) || !Number.isFinite(deliveryWindowEnd) || deliveryWindowEnd <= deliveryWindowStart) {
    throw new Error('scheduleDelivery requires a numeric deliveryWindowStart before deliveryWindowEnd');
  }
  booking.deliveryWindowStart = deliveryWindowStart;
  booking.deliveryWindowEnd = deliveryWindowEnd;
  booking.status = 'delivery-scheduled';
  return booking;
}

function dispatchDelivery(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'delivery-scheduled', 'dispatchDelivery');
  setAssetStatus(store, { assetId: booking.assetId, status: 'in-transit', now });
  booking.status = 'in-transit';
  return booking;
}

// The unit has physically arrived and is being positioned/connected --
// the "Unit is positioned / Utilities connected" step of spec §1.
function markArrivedAndDeploying(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'in-transit', 'markArrivedAndDeploying');
  setAssetStatus(store, { assetId: booking.assetId, status: 'deploying', now });
  moveAsset(store, { assetId: booking.assetId, lat: booking.deliveryLat, lng: booking.deliveryLng });
  booking.status = 'deployed';
  return booking;
}

// "Customer receives access / rental period begins" (spec §1) -- the
// one real moment this module calls the rental clock started.
function startRental(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'deployed', 'startRental');
  setAssetStatus(store, { assetId: booking.assetId, status: 'active-rental', now });
  booking.status = 'active';
  booking.rentalStartedAt = now;
  return booking;
}

function scheduleRetrieval(store, options = {}) {
  const { bookingId, retrievalWindowStart, retrievalWindowEnd } = options;
  const booking = requireBookingInStatus(store, bookingId, 'active', 'scheduleRetrieval');
  if (!Number.isFinite(retrievalWindowStart) || !Number.isFinite(retrievalWindowEnd) || retrievalWindowEnd <= retrievalWindowStart) {
    throw new Error('scheduleRetrieval requires a numeric retrievalWindowStart before retrievalWindowEnd');
  }
  booking.retrievalWindowStart = retrievalWindowStart;
  booking.retrievalWindowEnd = retrievalWindowEnd;
  booking.status = 'retrieval-scheduled';
  return booking;
}

function dispatchRetrieval(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'retrieval-scheduled', 'dispatchRetrieval');
  setAssetStatus(store, { assetId: booking.assetId, status: 'in-transit', now });
  booking.status = 'returning';
  return booking;
}

// Back at base. Inspection is logged as a real maintenance event
// (spec §10's own record), not a side-channel boolean, so
// `getMaintenanceHistory` genuinely reflects it.
function markReturnedForInspection(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'returning', 'markReturnedForInspection');
  setAssetStatus(store, { assetId: booking.assetId, status: 'inspection', now });
  booking.rentalEndedAt = now;
  booking.status = 'inspection';
  logMaintenanceEvent(store, { assetId: booking.assetId, type: 'inspection', notes: 'post-rental inspection', now });
  return booking;
}

// A failed inspection takes the asset out of rotation (`damaged`) and
// leaves the maintenance event open (see hasOpenMaintenanceIssue) --
// the booking itself still completed (the customer's rental is over),
// but the asset cannot be rebooked until that issue is resolved.
function recordInspectionResult(store, options = {}) {
  const { bookingId, passed, notes = '', now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'inspection', 'recordInspectionResult');
  if (typeof passed !== 'boolean') throw new Error('recordInspectionResult requires passed (boolean)');

  const inspectionEvent = store.dropMaintenanceEvents
    .filter((e) => e.assetId === booking.assetId && e.type === 'inspection' && e.resolvedAt === null)
    .sort((a, b) => b.loggedAt - a.loggedAt)[0];
  if (inspectionEvent) {
    inspectionEvent.notes = notes || inspectionEvent.notes;
    if (passed) inspectionEvent.resolvedAt = now;
  }

  if (passed) {
    setAssetStatus(store, { assetId: booking.assetId, status: 'cleaning', now });
    booking.status = 'cleaning';
  } else {
    setAssetStatus(store, { assetId: booking.assetId, status: 'damaged', now });
    booking.status = 'completed';
  }
  return booking;
}

// The one moment money moves (see header). Cleaning done, asset back
// in the available fleet for the next customer (spec §9).
async function completeCleaningAndClose(store, options = {}) {
  const { bookingId, settleFn, now = Date.now() } = options;
  const booking = requireBookingInStatus(store, bookingId, 'cleaning', 'completeCleaningAndClose');

  await completeJob(store, { jobId: booking.jobId, settleFn });

  setAssetStatus(store, { assetId: booking.assetId, status: 'available', now });
  booking.status = 'completed';
  // `resolved: true` -- this logs a cleaning that already happened,
  // not an open issue; see logMaintenanceEvent's own header for why
  // that default matters here.
  logMaintenanceEvent(store, { assetId: booking.assetId, type: 'cleaning', notes: 'post-rental cleaning complete', now, resolved: true });
  return booking;
}

function cancelDropBooking(store, options = {}) {
  const { bookingId, now = Date.now() } = options;
  const booking = getDropBooking(store, bookingId);
  if (!booking) throw new Error(`cancelDropBooking: no drop booking with id ${bookingId}`);
  if (!['pending-approval', 'booked'].includes(booking.status)) {
    throw new Error(`cancelDropBooking: booking ${bookingId} is "${booking.status}" and can no longer be cancelled -- the unit has already been dispatched`);
  }
  if (booking.status === 'booked') {
    setAssetStatus(store, { assetId: booking.assetId, status: 'available', now });
  }
  booking.status = 'cancelled';
  booking.cancelledAt = now;
  return booking;
}

module.exports = {
  LOCATION_TYPES,
  ELIGIBILITY_STATUSES,
  DROP_BOOKING_STATUSES,
  DELIVERY_FEE_PER_KM,
  SETUP_FEE_FLAT,
  assessEligibility,
  computeDropPrice,
  isAssetAvailable,
  createDropBooking,
  getDropBooking,
  listDropBookingsForUser,
  approveDropBooking,
  rejectDropBooking,
  scheduleDelivery,
  dispatchDelivery,
  markArrivedAndDeploying,
  startRental,
  scheduleRetrieval,
  dispatchRetrieval,
  markReturnedForInspection,
  recordInspectionResult,
  completeCleaningAndClose,
  cancelDropBooking,
};
