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

// `game` and `crop` joined 8 Oct 2026, for `jobs.js`'s frontier
// hunter/farmer shifts — real yields, not something `digForResources`
// turns up. Digging is earth and stone; a hunt or a harvest is a
// different real activity with its own job, so `YIELD_TABLE` below
// deliberately stays digging-only rather than growing to match.
//
// `water` joined the same day, per direct instruction: "the government
// will establish a clean water process," and "everything is actually
// done through a process from water." It is the one resource with no
// job that merely FINDS it — nobody digs or hunts for clean water, a
// real `water-treatment-worker` shift (`jobs.js`) produces it, the
// real plumber's work `occupations.js`'s own `INFRASTRUCTURE_POST`
// already names (`water_systems: 'plumber'`). It is also the one
// resource other jobs can require as a real INPUT rather than only
// ever yield — see `jobs.js`'s `consumes`, starting with `farmer`
// (irrigation), the one link universal enough not to be a guess about
// any specific process.
export const RESOURCE_TYPES = ['wood', 'stone', 'clay', 'ore', 'game', 'crop', 'water'];

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
    // Cumulative, settlement-wide, across every type — see
    // "Exotic value" below. Only ever goes up; it is the real history
    // of how much of each resource this world has ever produced, not a
    // current-stock figure (selling one back does not un-produce it).
    totalProduced: zeroMaterials(),
  };
}

// **Exotic value (8 Oct 2026), per direct instruction**: "there will be
// an exotic value of things that are least accessible -- those things
// will be more valuable until they increase in this new world." A
// real, deterministic scarcity-price formula, not an invented
// probability or threshold -- the inverse relationship between supply
// and value is the real economic principle the instruction names, and
// `totalProduced` is the real, running count of how accessible each
// resource has actually become so far, not a guessed-at rarity tier.
// `BASE_EXOTIC_VALUE` is a flagged interpretive number, the same
// footing `STARTING_OLD_WORLD_STOCK` and every other unspecified
// constant in this file already stands on -- no document gives VDP a
// real resource price schedule.
//
// A resource nobody has produced yet (`totalProduced[type] === 0`) is
// worth the full base value; every real unit anyone anywhere produces
// of that type nudges its value down for everyone, permanently -- "until
// they increase" is read literally: the value only ever falls as the
// world's own accumulated production of that thing rises, it never
// recovers on its own the way a per-player stock could.
export const BASE_EXOTIC_VALUE = 50;

export function exoticValueFor(store, type) {
  const produced = (store.totalProduced && store.totalProduced[type]) || 0;
  return BASE_EXOTIC_VALUE / (1 + produced);
}

// The real counterpart account to `property.js`'s `'vdp-property-office'`
// -- the governors' own real buyer of last resort for a resource
// someone wants to convert back to VCoin, at today's real exotic value.
export const RESOURCE_EXCHANGE_ACCOUNT = 'vdp-resource-exchange';

// Sells only real, already-held LOCAL materials -- deliberately not
// `spendMaterials`' shared-old-world-stock fallback: there is nothing
// to sell if a player's own stock is short, old-world import or not.
// Same claim-before-pay/rollback ordering as every other paid action in
// this directory: the materials are deducted before the transfer is
// attempted, and restored if it fails.
export async function sellMaterials(store, { entityId, type, amount, transferFn, now = Date.now() } = {}) {
  if (!entityId) throw new Error('sellMaterials requires an entityId');
  if (!RESOURCE_TYPES.includes(type)) {
    throw new Error(`sellMaterials: "${type}" is not a known resource type (expected one of ${RESOURCE_TYPES.join(', ')})`);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('sellMaterials requires a positive integer amount');
  }
  if (typeof transferFn !== 'function') throw new Error('sellMaterials requires a transferFn');

  const have = (store.materials[entityId] || {})[type] || 0;
  if (have < amount) {
    throw new Error(`sellMaterials: "${entityId}" only has ${have} ${type} on hand, not ${amount}`);
  }

  const unitValue = exoticValueFor(store, type);
  const payout = Math.round(unitValue * amount);

  store.materials[entityId][type] -= amount;

  try {
    await transferFn({
      fromUserId: RESOURCE_EXCHANGE_ACCOUNT, toUserId: entityId, amount: payout, reason: `vdp-sell-${type}`,
    });
  } catch (err) {
    store.materials[entityId][type] += amount;
    throw err;
  }

  return { type, amount, unitValue, payout, materials: materialsFor(store, entityId), soldAt: now };
}

export function materialsFor(store, entityId) {
  return { ...(store.materials[entityId] || zeroMaterials()) };
}

// A real, produced yield -- `jobs.js`'s lumberjack/farmer/hunter
// shifts call this on a successful payout, the inverse of
// `spendMaterials`' local half. Unlike `oldWorldStock`, a player's own
// `materials` legitimately goes up this way (and by digging); only the
// shared import stock carries the one-way invariant.
export function grantMaterials(store, entityId, requested = {}) {
  if (!store.materials[entityId]) store.materials[entityId] = zeroMaterials();
  if (!store.totalProduced) store.totalProduced = zeroMaterials();
  for (const type of RESOURCE_TYPES) {
    const amount = requested[type] || 0;
    if (amount === 0) continue;
    store.materials[entityId][type] = (store.materials[entityId][type] || 0) + amount;
    store.totalProduced[type] = (store.totalProduced[type] || 0) + amount;
  }
  return materialsFor(store, entityId);
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
  if (!store.totalProduced) store.totalProduced = zeroMaterials();
  store.materials[entityId][picked.type] += amount;
  store.totalProduced[picked.type] = (store.totalProduced[picked.type] || 0) + amount;
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
