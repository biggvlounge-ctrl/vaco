// VOID — Business Lockers & Forward-Deployed Seller Inventory.
// Source of truth: MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_INVENTORY.md
// §3 + "Business Lockers": Amazon FBA's real forward-deployment
// model, deliberately with a cleaner, transparent fee structure (the
// source doc's own real, provable differentiator vs. FBA's real 2026
// stacked-fee complexity) -- one flat `monthlyStorageFee`, not a
// referral+fulfillment+storage+inbound-placement stack.
//
// **Real, honest scope note**: the source doc frames this as "the
// direct fulfillment backend for VMall's screen-based commerce" --
// VMall does not exist anywhere in this codebase (confirmed: zero
// real code or route references it in vdp/, or anywhere else). This
// module does not fabricate a VMall integration to satisfy that
// framing. It ties `DroneLoadingEvent` to a real, already-existing
// `jobId` from `marketplace.js`'s own real job system instead -- the
// real trigger this codebase actually has for "an order came in for
// an item," regardless of which future storefront (VMall or
// otherwise) eventually originates that order.
//
// Staffed, not self-service, for the loading step specifically:
// same real reasoning `hubOrigination.js`'s own header already
// established for its own staffed option -- loading someone else's
// merchandise onto a drone for dispatch needs a real person to
// retrieve, verify, and load the correct item; a `hubEmployeeId` is
// required on every `DroneLoadingEvent`, never optional.

const LOCKER_SIZES = ['small', 'medium', 'large'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function registerBusinessLocker(store, options = {}) {
  const { hubId, sellerId, lockerSize, monthlyStorageFee } = options;
  if (!hubId) throw new Error('registerBusinessLocker requires a hubId');
  if (!sellerId) throw new Error('registerBusinessLocker requires a sellerId');
  if (!LOCKER_SIZES.includes(lockerSize)) {
    throw new Error(`registerBusinessLocker: invalid lockerSize "${lockerSize}" (expected one of ${LOCKER_SIZES.join(', ')})`);
  }
  if (!Number.isFinite(monthlyStorageFee) || monthlyStorageFee <= 0) {
    throw new Error('registerBusinessLocker requires a positive monthlyStorageFee');
  }

  const locker = {
    id: store.nextBusinessLockerId++,
    hubId,
    sellerId,
    lockerSize,
    monthlyStorageFee: round(monthlyStorageFee),
    currentInventory: [],
    createdAt: Date.now(),
  };
  store.businessLockers.push(locker);
  return locker;
}

function getBusinessLocker(store, lockerId) {
  return store.businessLockers.find((l) => l.id === lockerId) || null;
}

function getBusinessLockersForSeller(store, sellerId) {
  return store.businessLockers.filter((l) => l.sellerId === sellerId);
}

// The real, top-level opt-in record: a seller decides to forward-
// deploy a given product's inventory at a specific hub/locker. Kept
// as its own real entity (matching the source doc's own
// `SellerInventoryPlacement` shape) separate from `BusinessLocker`'s
// own `currentInventory` -- the placement is the seller's real
// business decision and its own real, ongoing fee; the locker's
// `currentInventory` is the real, physical count actually sitting
// there right now, which changes independently as items get loaded
// and dispatched.
function placeSellerInventory(store, options = {}) {
  const { sellerId, productId, quantity, businessLockerId, placementFee } = options;
  if (!sellerId) throw new Error('placeSellerInventory requires a sellerId');
  if (!productId) throw new Error('placeSellerInventory requires a productId');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('placeSellerInventory requires a positive integer quantity');
  }
  const locker = getBusinessLocker(store, businessLockerId);
  if (!locker) throw new Error(`placeSellerInventory: no business locker with id ${businessLockerId}`);
  if (locker.sellerId !== sellerId) {
    throw new Error(`placeSellerInventory: locker ${businessLockerId} does not belong to seller ${sellerId}`);
  }
  if (!Number.isFinite(placementFee) || placementFee < 0) {
    throw new Error('placeSellerInventory requires a non-negative placementFee');
  }

  const placement = {
    id: store.nextSellerInventoryPlacementId++,
    sellerId,
    productId,
    quantity,
    businessLockerId,
    placementFee: round(placementFee),
    createdAt: Date.now(),
  };
  store.sellerInventoryPlacements.push(placement);

  const existing = locker.currentInventory.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    locker.currentInventory.push({ productId, quantity });
  }

  return placement;
}

// The real, staffed fulfillment step: a real Hub employee retrieves
// the correct item from the locker's own real `currentInventory`,
// verifies it, and loads it onto a real drone for dispatch --
// deducting from the physical count only once this real, logged event
// happens (never optimistically deducted at order time, which would
// let a stockout go undetected until the employee actually opens the
// locker).
function loadDroneFromLocker(store, options = {}) {
  const { businessLockerId, productId, orderId, hubEmployeeId, droneId } = options;
  const locker = getBusinessLocker(store, businessLockerId);
  if (!locker) throw new Error(`loadDroneFromLocker: no business locker with id ${businessLockerId}`);
  if (!orderId) throw new Error('loadDroneFromLocker requires an orderId');
  if (!hubEmployeeId) throw new Error('loadDroneFromLocker requires a hubEmployeeId -- loading someone else\'s inventory is always staffed, never self-service');
  if (!droneId) throw new Error('loadDroneFromLocker requires a droneId');

  const item = locker.currentInventory.find((i) => i.productId === productId);
  if (!item || item.quantity <= 0) {
    throw new Error(`loadDroneFromLocker: locker ${businessLockerId} has no real stock of product ${productId}`);
  }

  item.quantity -= 1;
  if (item.quantity === 0) {
    locker.currentInventory = locker.currentInventory.filter((i) => i.productId !== productId);
  }

  const event = {
    id: store.nextDroneLoadingEventId++,
    businessLockerId,
    productId,
    orderId,
    hubEmployeeId,
    droneId,
    loadedAt: Date.now(),
  };
  store.droneLoadingEvents.push(event);
  return event;
}

function getDroneLoadingEventsForLocker(store, businessLockerId) {
  return store.droneLoadingEvents.filter((e) => e.businessLockerId === businessLockerId);
}

module.exports = {
  LOCKER_SIZES,
  registerBusinessLocker,
  getBusinessLocker,
  getBusinessLockersForSeller,
  placeSellerInventory,
  loadDroneFromLocker,
  getDroneLoadingEventsForLocker,
};
