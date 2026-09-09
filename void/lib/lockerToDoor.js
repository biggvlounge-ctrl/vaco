// VOID — Locker-to-Door: final-mile assist from an existing locker.
// Source of truth: VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md's
// security design, worth building correctly from the start: the
// driver does NOT use the customer's own original QR code/access
// credential -- a separate, temporary, single-use access grant is
// generated instead, tied to that one delivery request and expiring
// after use. Same real "scoped credential, not a shared primary one"
// discipline already used elsewhere in this project (e.g. VOID
// Direct's per-business apiKey).

const crypto = require('crypto');
const { getLocker, retrievePackage } = require('./voidLocker');

const LOCKER_TO_DOOR_STATUSES = ['requested', 'driver-assigned', 'retrieved', 'delivered'];
const ACCESS_CODE_VALID_HOURS = 2; // flagged, interpretive -- no doc-given expiry window

function requestLockerToDoor(store, options = {}) {
  const { lockerId, compartmentId, customerId, finalDeliveryAddress, now = Date.now() } = options;

  const locker = getLocker(store, lockerId);
  if (!locker) throw new Error(`requestLockerToDoor: no locker with id ${lockerId}`);
  const compartment = locker.compartments.find((c) => c.id === compartmentId);
  if (!compartment) throw new Error(`requestLockerToDoor: no compartment with id ${compartmentId} at locker ${lockerId}`);
  if (!compartment.isOccupied || compartment.assignedRecipientId !== customerId) {
    throw new Error('requestLockerToDoor: only the recipient of an occupied compartment can request this service');
  }
  if (!finalDeliveryAddress) throw new Error('requestLockerToDoor requires a finalDeliveryAddress');

  const request = {
    id: store.nextLockerToDoorId++,
    lockerId,
    compartmentId,
    customerId,
    assignedDriverId: null,
    driverAccessCode: crypto.randomBytes(12).toString('hex'), // separate, temporary -- never the customer's own code
    driverAccessExpiresAt: now + ACCESS_CODE_VALID_HOURS * 60 * 60 * 1000,
    finalDeliveryAddress,
    status: 'requested',
    createdAt: now,
  };
  store.lockerToDoorRequests.push(request);
  return request;
}

function getLockerToDoorRequest(store, requestId) {
  return store.lockerToDoorRequests.find((r) => r.id === requestId) || null;
}

function assignDriverToLockerRequest(store, options = {}) {
  const { requestId, driverId } = options;
  const request = getLockerToDoorRequest(store, requestId);
  if (!request) throw new Error(`assignDriverToLockerRequest: no request with id ${requestId}`);
  if (request.status !== 'requested') {
    throw new Error(`assignDriverToLockerRequest: request ${requestId} is "${request.status}", expected "requested"`);
  }
  if (!driverId) throw new Error('assignDriverToLockerRequest requires a driverId');
  request.assignedDriverId = driverId;
  request.status = 'driver-assigned';
  return request;
}

// The real security check: the provided code must match the
// separate, generated access grant -- not the customer's own
// credential -- and must not be expired.
function retrieveWithDriverAccess(store, options = {}) {
  const { requestId, providedAccessCode, now = Date.now() } = options;
  const request = getLockerToDoorRequest(store, requestId);
  if (!request) throw new Error(`retrieveWithDriverAccess: no request with id ${requestId}`);
  if (request.status !== 'driver-assigned') {
    throw new Error(`retrieveWithDriverAccess: request ${requestId} is "${request.status}", expected "driver-assigned"`);
  }
  if (now > request.driverAccessExpiresAt) {
    throw new Error(`retrieveWithDriverAccess: access code for request ${requestId} has expired`);
  }
  if (providedAccessCode !== request.driverAccessCode) {
    throw new Error('retrieveWithDriverAccess: invalid access code');
  }

  retrievePackage(store, { lockerId: request.lockerId, compartmentId: request.compartmentId, recipientId: request.customerId });
  request.status = 'retrieved';
  return request;
}

function completeLockerToDoorDelivery(store, requestId) {
  const request = getLockerToDoorRequest(store, requestId);
  if (!request) throw new Error(`completeLockerToDoorDelivery: no request with id ${requestId}`);
  if (request.status !== 'retrieved') {
    throw new Error(`completeLockerToDoorDelivery: request ${requestId} is "${request.status}", expected "retrieved"`);
  }
  request.status = 'delivered';
  return request;
}

module.exports = {
  LOCKER_TO_DOOR_STATUSES,
  ACCESS_CODE_VALID_HOURS,
  requestLockerToDoor,
  getLockerToDoorRequest,
  assignDriverToLockerRequest,
  retrieveWithDriverAccess,
  completeLockerToDoorDelivery,
};
