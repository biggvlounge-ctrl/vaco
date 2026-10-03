// VDP — player housing.
//
// One unit type to start (`residential`), since VDP has no commercial/
// industrial/agricultural districts to attach the other nine of
// VACON-C's `PROPERTY_TYPES` to. `lifecycle` is VACON-C's own
// `server/property.js` stage list, reused verbatim rather than
// reinvented — a VDP home starts in `planning` the same way a VACON-C
// building does, and moves through the same real stages.
//
// Rent/buy pays through V3 (`v3Client.js`), with the same
// claim-before-pay ordering `degvchi.js`'s `purchaseWearable` already
// proved: the ownership row is pushed before the transfer is awaited,
// and rolled back if the transfer fails — so a declined charge never
// leaves a home on the books with nobody having paid for it.

export const PROPERTY_TYPES = ['residential'];

// Verbatim from vacon-c/server/property.js's own LIFECYCLE list.
export const LIFECYCLE = [
  'planning', 'construction', 'operation', 'maintenance',
  'renovation', 'expansion', 'historical_legacy',
];

export const OWNER_TYPES = ['individual'];

export const HOME_PRICE = 500;

export function createPropertyStore() {
  return { properties: [], nextPropertyId: 1 };
}

export function listHomes(store) {
  return store.properties;
}

export function homeOwnedBy(store, ownerId) {
  return store.properties.find((p) => p.ownerId === ownerId) || null;
}

// `transferFn` is injected, the same decoupling `catalog.js`'s
// `purchaseBook` uses, so this stays runnable/testable without
// importing `v3Client.js` (which needs Vite's `import.meta.env`).
export async function purchaseHome(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('purchaseHome requires an ownerId');
  if (homeOwnedBy(store, ownerId)) {
    throw new Error(`purchaseHome: "${ownerId}" already owns a home`);
  }
  if (typeof transferFn !== 'function') throw new Error('purchaseHome requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: 'residential',
    ownerId,
    ownerType: 'individual',
    lifecycleStage: 'operation',
    purchasedAt: now,
  };
  // Claim before pay: the row exists the instant it's committed to,
  // so a crash between the push and the transfer resolving can only
  // ever look like "paid for but not yet confirmed," never "charged
  // with no record of what for."
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: HOME_PRICE, reason: 'vdp-home-purchase' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }

  return property;
}

export function advanceLifecycle(property) {
  const idx = LIFECYCLE.indexOf(property.lifecycleStage);
  if (idx === -1 || idx === LIFECYCLE.length - 1) return property;
  property.lifecycleStage = LIFECYCLE[idx + 1];
  return property;
}
