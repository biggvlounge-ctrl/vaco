// VOID — Apartment/University Smart Locker Network.
// Source of truth: VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md. Real,
// mature, already-proven industry (Parcel Pending/Quadient, Luxer One,
// Smiota). `VoidLocker` is kept as its own entity, optionally linked
// to a `stationId` (nullable) rather than merged into `VoidStation` --
// a locker can exist at a location with no drone Port capability at
// all (a pure apartment lobby), and PMS-integration/compartment
// concerns are genuinely locker-specific, not station-specific. This
// is a real, deliberate resolution of the ambiguity the source doc
// itself left open (it describes VoidLocker as its own struct with
// its own `id`, but also says its technology choice "maps onto"
// VoidStation's fields) -- documented here as the chosen shape, not
// silently picked.
//
// Compartment auto-selection: "system auto-selects the correctly-
// sized compartment" -- real best-fit logic (smallest available
// compartment that's still large enough), not just the first one
// found, matching how real locker systems avoid wasting a large
// compartment on a small package.

const LOCKER_LOCATION_TYPES = ['apartment', 'university', 'hvntz-business'];
const PMS_OPTIONS = ['yardi', 'entrata', 'appfolio', 'realpage', 'buildium'];
const COMPARTMENT_SIZES = ['small', 'medium', 'large'];
const COMPARTMENT_SIZE_RANK = { small: 1, medium: 2, large: 3 };

function registerLocker(store, options = {}) {
  const {
    stationId = null, locationType, propertyManagementSoftware = null,
    courierAgnostic = true, compartmentSizes = ['small', 'medium', 'large'],
    supportsFoodSecurityProgram = false,
  } = options;

  if (!LOCKER_LOCATION_TYPES.includes(locationType)) {
    throw new Error(`registerLocker: invalid locationType "${locationType}" (expected one of ${LOCKER_LOCATION_TYPES.join(', ')})`);
  }
  if (propertyManagementSoftware !== null && !PMS_OPTIONS.includes(propertyManagementSoftware)) {
    throw new Error(`registerLocker: invalid propertyManagementSoftware "${propertyManagementSoftware}" (expected one of ${PMS_OPTIONS.join(', ')}, or null)`);
  }
  if (typeof courierAgnostic !== 'boolean') {
    throw new Error('registerLocker requires a boolean courierAgnostic');
  }
  if (!Array.isArray(compartmentSizes) || compartmentSizes.length === 0) {
    throw new Error('registerLocker requires at least one compartment size');
  }
  for (const size of compartmentSizes) {
    if (!COMPARTMENT_SIZES.includes(size)) {
      throw new Error(`registerLocker: invalid compartment size "${size}" (expected one of ${COMPARTMENT_SIZES.join(', ')})`);
    }
  }

  const locker = {
    id: store.nextLockerId++,
    stationId,
    locationType,
    propertyManagementSoftware,
    courierAgnostic,
    supportsFoodSecurityProgram,
    compartments: compartmentSizes.map((size, i) => ({ id: i + 1, size, isOccupied: false, assignedRecipientId: null })),
    createdAt: Date.now(),
  };
  store.voidLockers.push(locker);
  return locker;
}

function getLocker(store, lockerId) {
  return store.voidLockers.find((l) => l.id === lockerId) || null;
}

// Real best-fit selection: the smallest unoccupied compartment that's
// still large enough for the package, not just the first free one.
function depositPackage(store, options = {}) {
  const { lockerId, recipientId, size } = options;
  const locker = getLocker(store, lockerId);
  if (!locker) throw new Error(`depositPackage: no locker with id ${lockerId}`);
  if (!recipientId) throw new Error('depositPackage requires a recipientId');
  if (!COMPARTMENT_SIZES.includes(size)) {
    throw new Error(`depositPackage: invalid size "${size}" (expected one of ${COMPARTMENT_SIZES.join(', ')})`);
  }

  const candidates = locker.compartments
    .filter((c) => !c.isOccupied && COMPARTMENT_SIZE_RANK[c.size] >= COMPARTMENT_SIZE_RANK[size])
    .sort((a, b) => COMPARTMENT_SIZE_RANK[a.size] - COMPARTMENT_SIZE_RANK[b.size]);

  if (candidates.length === 0) {
    throw new Error(`depositPackage: no available compartment at locker ${lockerId} fits size "${size}"`);
  }

  const compartment = candidates[0];
  compartment.isOccupied = true;
  compartment.assignedRecipientId = recipientId;
  return compartment;
}

function retrievePackage(store, options = {}) {
  const { lockerId, compartmentId, recipientId } = options;
  const locker = getLocker(store, lockerId);
  if (!locker) throw new Error(`retrievePackage: no locker with id ${lockerId}`);
  const compartment = locker.compartments.find((c) => c.id === compartmentId);
  if (!compartment) throw new Error(`retrievePackage: no compartment with id ${compartmentId} at locker ${lockerId}`);
  if (!compartment.isOccupied) {
    throw new Error(`retrievePackage: compartment ${compartmentId} is not occupied`);
  }
  if (compartment.assignedRecipientId !== recipientId) {
    throw new Error(`retrievePackage: recipientId does not match the compartment's assigned recipient`);
  }
  compartment.isOccupied = false;
  compartment.assignedRecipientId = null;
  return compartment;
}

module.exports = {
  LOCKER_LOCATION_TYPES,
  PMS_OPTIONS,
  COMPARTMENT_SIZES,
  registerLocker,
  getLocker,
  depositPackage,
  retrievePackage,
};
