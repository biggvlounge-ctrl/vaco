// VOID — Staffing (formalized) + HUNT Staffing.
// Source of truth: QUICK_INNOVATION_THREAD.md §2-3. §2 confirms VOID's
// staffing vertical was "already established earlier in this
// project, with Instawork as the real comparable" -- true: `staffing`
// already exists in `verticals.js` (`hourly`, 20% take rate) as one
// entry in the generic vertical list. This module formalizes that
// into its own real, richer entity (position type, employment type,
// urgency) rather than a second, parallel payment system -- every
// real position still runs through the exact same
// request -> match -> accept -> complete -> pay -> rate marketplace
// loop (`marketplace.js`) with `verticalId: 'staffing'`, matching
// `VOID_SERVICE_VERTICALS_COMPARABLES.md`'s own central claim that
// every vertical shares one backend loop.
//
// §3's HUNT Staffing is a real, thin cross-app layer on top of this,
// not a separate hiring platform: an HVNTZ business is verified live
// (the same real `hvntzFetchFn` pattern `externalIntegration.js`
// already established) and its open position is filled through this
// same real VOID Staffing marketplace -- `filledViaVoidStaffing` is
// true precisely because nothing new was built to fill it.

const { requestJob } = require('./marketplace');

const EMPLOYMENT_TYPES = ['temporary', 'seasonal', 'on-demand', 'permanent'];
const URGENCY_LEVELS = ['immediate', 'scheduled'];
const STAFFING_VERTICAL_ID = 'staffing';

// A real staffing position is a real marketplace job (customerId = the
// hiring business) plus the richer, staffing-specific fields the
// generic `Job` shape doesn't carry on its own.
function postStaffingPosition(store, options = {}) {
  const { businessId, positionType, employmentType, hourlyRate, quantity = 1 } = options;
  if (!businessId) throw new Error('postStaffingPosition requires a businessId');
  if (!positionType) throw new Error('postStaffingPosition requires a positionType');
  if (!EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new Error(`postStaffingPosition: invalid employmentType "${employmentType}" (expected one of ${EMPLOYMENT_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    throw new Error('postStaffingPosition requires a positive hourlyRate');
  }

  const job = requestJob(store, {
    verticalId: STAFFING_VERTICAL_ID, customerId: businessId, quantity, unitPrice: hourlyRate,
  });

  const position = {
    id: store.nextStaffingPositionId++,
    jobId: job.id,
    businessId,
    positionType,
    employmentType,
    hourlyRate,
    createdAt: Date.now(),
  };
  store.staffingPositions.push(position);
  return position;
}

function getStaffingPosition(store, positionId) {
  return store.staffingPositions.find((p) => p.id === positionId) || null;
}

function getStaffingPositionsForBusiness(store, businessId) {
  return store.staffingPositions.filter((p) => p.businessId === businessId);
}

// The real, thin HUNT Staffing layer: verifies the HVNTZ business is
// real (same injected-fetch pattern the Affiliate Network already
// uses), then posts the exact same real staffing position above --
// `filledViaVoidStaffing` records that this request was routed
// through VOID Staffing's real existing network, not a separate
// hiring mechanism built just for HVNTZ.
async function requestHuntStaffing(store, options = {}) {
  const { hvntzBusinessId, positionType, employmentType, urgency, hourlyRate, hvntzFetchFn } = options;
  if (!hvntzBusinessId) throw new Error('requestHuntStaffing requires an hvntzBusinessId');
  if (!URGENCY_LEVELS.includes(urgency)) {
    throw new Error(`requestHuntStaffing: invalid urgency "${urgency}" (expected one of ${URGENCY_LEVELS.join(', ')})`);
  }
  if (typeof hvntzFetchFn !== 'function') {
    throw new Error('requestHuntStaffing requires an hvntzFetchFn(hvntzBusinessId)');
  }

  const business = await hvntzFetchFn(hvntzBusinessId);
  if (!business) throw new Error(`requestHuntStaffing: HVNTZ has no real business with id ${hvntzBusinessId}`);

  const position = postStaffingPosition(store, {
    businessId: `hvntz:${hvntzBusinessId}`, positionType, employmentType, hourlyRate,
  });

  const request = {
    id: store.nextHuntStaffingRequestId++,
    businessId: hvntzBusinessId,
    positionType,
    employmentType,
    urgency,
    filledViaVoidStaffing: true,
    staffingPositionId: position.id,
    createdAt: Date.now(),
  };
  store.huntStaffingRequests.push(request);
  return request;
}

function getHuntStaffingRequest(store, requestId) {
  return store.huntStaffingRequests.find((r) => r.id === requestId) || null;
}

module.exports = {
  EMPLOYMENT_TYPES,
  URGENCY_LEVELS,
  STAFFING_VERTICAL_ID,
  postStaffingPosition,
  getStaffingPosition,
  getStaffingPositionsForBusiness,
  requestHuntStaffing,
  getHuntStaffingRequest,
};
