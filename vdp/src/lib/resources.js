// VDP — local materials and the old-world import stock.
//
// Per direct instruction: Meridian's settlers brought limited goods
// from the world they migrated from ("the old world"), and as the
// settlement builds and grows, it should rely increasingly on what
// THIS world actually has — wood and other materials found in the
// area, discovered by digging — rather than drawing down what was
// imported. That is two distinct stocks, not one scale, because they
// are not the same kind of thing: imported goods are what is left of
// a one-time shipment and can only ever go down; dug materials are a
// real, repeatable yield of the land itself. Same shape as this
// repo's other one-way-vs-renewable pairs (VACON-C's `resources.supply`
// needing a real ledger rather than one more depletion).
//
// No document anywhere names a real import manifest or a real local
// resource table, so both are built from the instruction alone, same
// footing `settlement.js`'s own header already stands on for Meridian's
// founding. `oldWorldStock`'s starting figure is a flagged interpretive
// placeholder — nothing specifies the real number — chosen small enough
// to matter and revisited once a real building cost schedule exists.
//
// Injected `rng` (defaulting to `Math.random`), the same convention
// `npcs.js` already uses throughout this directory, rather than
// VACON-C's string-seeded `seededDraw` — VDP has never used that
// convention and introducing a second randomness discipline in one
// file would be its own kind of inconsistency.

export const RESOURCE_TYPES = ['wood', 'stone', 'clay', 'ore'];

// Wood is the one material the instruction named directly, so it is
// the common case; the rest are "different materials... in the area",
// weighted rarer the more worked a real settlement would find them —
// stone and clay before ore.
const YIELD_TABLE = [
  { type: 'wood', weight: 50, min: 2, max: 5 },
  { type: 'stone', weight: 30, min: 1, max: 3 },
  { type: 'clay', weight: 15, min: 1, max: 2 },
  { type: 'ore', weight: 5, min: 1, max: 1 },
];

const TOTAL_WEIGHT = YIELD_TABLE.reduce((sum, row) => sum + row.weight, 0);

// A dig takes real time to recover from — not a per-click infinite
// tap. Named and overridable, same convention as this directory's
// other "nothing specified this number" constants (e.g. `jobs.js`'s
// `payPerShift`).
export const DIG_COOLDOWN_MS = 5 * 60 * 1000;

// Flagged interpretive placeholder — see header.
export const STARTING_OLD_WORLD_STOCK = 500;

function zeroMaterials() {
  return Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0]));
}

export function createResourcesStore() {
  return {
    materials: {}, // per entityId: { wood, stone, clay, ore }
    lastDigAt: {}, // per entityId: timestamp
    // Shared across the whole settlement, not per player — everybody
    // drew from the same one shipment, same as a real founding party
    // would have. Only ever goes down; nothing in this module adds to it.
    oldWorldStock: STARTING_OLD_WORLD_STOCK,
  };
}

export function materialsFor(store, entityId) {
  return { ...(store.materials[entityId] || zeroMaterials()) };
}

export function canDig(store, entityId, now = Date.now()) {
  const last = store.lastDigAt[entityId];
  return last === undefined || now - last >= DIG_COOLDOWN_MS;
}

export function digForResources(store, { entityId, now = Date.now(), rng = Math.random } = {}) {
  if (!entityId) throw new Error('digForResources requires an entityId');
  if (!canDig(store, entityId, now)) {
    const last = store.lastDigAt[entityId];
    const waitMs = DIG_COOLDOWN_MS - (now - last);
    throw new Error(`digForResources: "${entityId}" must wait ${Math.ceil(waitMs / 1000)}s before digging again`);
  }

  let roll = rng() * TOTAL_WEIGHT;
  let picked = YIELD_TABLE[YIELD_TABLE.length - 1];
  for (const row of YIELD_TABLE) {
    if (roll < row.weight) { picked = row; break; }
    roll -= row.weight;
  }
  const amount = picked.min + Math.floor(rng() * (picked.max - picked.min + 1));

  if (!store.materials[entityId]) store.materials[entityId] = zeroMaterials();
  store.materials[entityId][picked.type] += amount;
  store.lastDigAt[entityId] = now;

  return { type: picked.type, amount, materials: materialsFor(store, entityId) };
}

// Spends a player's own dug materials first; only draws down the
// shared old-world stock for whatever shortfall remains, and only
// while that stock has anything left. "Limit import" means the import
// is a shrinking fallback a build can still fail to find, not a
// second currency nothing ever runs out of.
//
// `perType` records exactly where each unit came from, local vs.
// old-world — not for the caller to read in the ordinary case, but so
// a paired payment that fails afterward (property.js's `upgradeHome`,
// which charges VCoin for the same upgrade) can undo precisely this
// spend via `undoSpend` rather than guessing at a refund.
export function spendMaterials(store, entityId, requested = {}) {
  const have = store.materials[entityId] || zeroMaterials();
  let totalShortfall = 0;
  for (const type of RESOURCE_TYPES) {
    const need = requested[type] || 0;
    totalShortfall += Math.max(0, need - (have[type] || 0));
  }

  if (totalShortfall > store.oldWorldStock) {
    throw new Error(
      `spendMaterials: "${entityId}" is short ${totalShortfall} unit(s) and the old-world `
      + `stock only has ${store.oldWorldStock} left`,
    );
  }

  if (!store.materials[entityId]) store.materials[entityId] = zeroMaterials();
  const perType = {};
  for (const type of RESOURCE_TYPES) {
    const need = requested[type] || 0;
    if (need === 0) continue;
    const fromLocal = Math.min(need, store.materials[entityId][type] || 0);
    store.materials[entityId][type] -= fromLocal;
    perType[type] = { fromLocal, fromOldWorld: need - fromLocal };
  }
  store.oldWorldStock -= totalShortfall;

  return {
    spent: requested,
    perType,
    fromOldWorldStock: totalShortfall,
    oldWorldStockRemaining: store.oldWorldStock,
  };
}

// **Rollback only — undoes exactly the spend `spendMaterials` just
// returned, never a top-up.** The only real caller is a transaction
// whose other half failed after this spend already committed
// (`property.js`'s `upgradeHome`, which also charges VCoin for the
// same upgrade): the spend must not survive a payment that never went
// through. This is precise because `perType` already recorded exactly
// where each unit came from — it restores local materials and the
// shared old-world stock to exactly what they were, never inventing a
// top-up `oldWorldStock` did not actually have.
export function undoSpend(store, entityId, spendResult) {
  if (!store.materials[entityId]) store.materials[entityId] = zeroMaterials();
  let restoredFromOldWorld = 0;
  for (const [type, { fromLocal, fromOldWorld }] of Object.entries(spendResult.perType || {})) {
    store.materials[entityId][type] = (store.materials[entityId][type] || 0) + fromLocal;
    restoredFromOldWorld += fromOldWorld;
  }
  store.oldWorldStock += restoredFromOldWorld;
}
