// VDP — Elite: a real, reserved neighborhood, and a real personal
// security detail, for the elite and the people who run the
// government.
//
// Per direct instruction (9 Oct 2026): "there also will be a
// neighborhood with new houses or small community for the elite and
// the people who run the government... a lot of the skyscraper and
// penthouses in the villages will be set for the elite... autonomous
// cars set aside for the elite... small security forces depending on
// who it is. Different attitudes in the elite."
//
// **Additive, not restrictive.** `property.js`'s own 5-tier
// residential ladder (Studio through Penthouse) already lets any real
// player who earns enough reach the top tier -- a real,
// already-tested economic mechanic (`upgradeHome`, every level a real
// price a player's own real income climbs toward). Gating that
// existing ladder behind an "elite" check would mean an ordinary
// player's own earned wealth can no longer buy what it already could.
// Instead, this is a real, SEPARATE neighborhood -- `elite-enclave` is
// its own new `property.js` type, parallel to how `commercial` is
// already its own independent slot alongside `residential` rather
// than a replacement for it. "A lot of the... penthouses... will be
// set for the elite" is read as: the elite enclave is priced and
// gated above even a Penthouse, not as a retroactive lock on the
// ladder everyone already uses.
//
// `isElite` is real and derived, not a flag a caller can just set:
// true for a real government liaison (`npcs.js`'s own
// `GOVERNMENT_LIAISON_ROLE` -- "the people who run the government",
// the one real, visible role this world already ties to government
// work) OR a real player who already owns the top real residential
// tier (`property.js`'s own real top `PROPERTY_LEVELS` entry) --
// demonstrated real wealth, the same real fact the neighborhood's own
// instruction names as who else belongs there.
//
// **"Autonomous cars set aside for the elite"** is named here, flagged
// open rather than guessed at: VOID's own real autonomous-van request
// flow (`VoidView.jsx`, per `VDP_FOUNDING.md`'s own "new-world
// technology" section) has no reservation/priority concept of its own
// today, and building one would be VOID's own real dispatch change,
// not a VDP-side guess. Recorded as open, not silently assumed built.
//
// **"Small security forces depending on who it is... different
// attitudes in the elite"** needs no new mechanic --
// `robots.js`'s own real `deployRobot` already supports a robot
// `controlledBy` any one real person; `assignPersonalSecurity` below
// is a thin, named wrapper so which real robot TYPE an elite person
// gets (a lighter Patrol Drone for one, a real Military Robot for
// another) is a real, inspectable choice per person -- "different
// attitudes" read as a real different type picked per person, not a
// single fixed guard-type this module invents for everyone.

import { GOVERNMENT_LIAISON_ROLE } from './npcs.js';
import { PROPERTY_LEVELS } from './property.js';
import { deployRobot } from './robots.js';

export const ELITE_ENCLAVE_TYPE = 'elite-enclave';

const TOP_RESIDENTIAL_LEVEL = PROPERTY_LEVELS[PROPERTY_LEVELS.length - 1].level;

// Flagged interpretive: priced above even a real Penthouse, the same
// footing every other unspecified price in `property.js` already
// stands on.
export const ELITE_ENCLAVE_PRICE = Math.round(PROPERTY_LEVELS[PROPERTY_LEVELS.length - 1].price * 1.5);

export function isElite({ npc, ownedPropertyLevel } = {}) {
  if (npc && npc.role === GOVERNMENT_LIAISON_ROLE) return true;
  if (Number.isInteger(ownedPropertyLevel) && ownedPropertyLevel >= TOP_RESIDENTIAL_LEVEL) return true;
  return false;
}

export function eliteEnclaveOwnedBy(store, ownerId) {
  return store.properties.find((p) => p.type === ELITE_ENCLAVE_TYPE && p.ownerId === ownerId) || null;
}

// Same claim-before-pay ordering every other purchase in `property.js`
// already uses -- the row exists, unpaid, before the transfer is
// attempted, and is rolled back if the transfer fails.
export async function purchaseEliteEnclaveUnit(store, { ownerId, eliteContext, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('purchaseEliteEnclaveUnit requires an ownerId');
  if (!isElite(eliteContext)) {
    throw new Error(`purchaseEliteEnclaveUnit: "${ownerId}" is not elite -- this neighborhood is reserved for the elite and the people who run the government`);
  }
  if (eliteEnclaveOwnedBy(store, ownerId)) {
    throw new Error(`purchaseEliteEnclaveUnit: "${ownerId}" already owns a unit in the elite enclave`);
  }
  if (typeof transferFn !== 'function') throw new Error('purchaseEliteEnclaveUnit requires a transferFn');

  const property = {
    id: store.nextPropertyId++,
    type: ELITE_ENCLAVE_TYPE,
    ownerId,
    ownerType: 'individual',
    ownershipType: 'owned',
    lifecycleStage: 'operation',
    authorized: true,
    purchasedAt: now,
  };
  store.properties.push(property);

  try {
    await transferFn({ fromUserId: ownerId, amount: ELITE_ENCLAVE_PRICE, reason: 'vdp-elite-enclave-purchase' });
  } catch (err) {
    const idx = store.properties.indexOf(property);
    if (idx !== -1) store.properties.splice(idx, 1);
    throw err;
  }
  return property;
}

// A real, named security detail -- see header for why this is a thin
// wrapper rather than a second robot-deployment mechanic.
export function assignPersonalSecurity(robotsStore, { protectedPersonId, typeId } = {}) {
  if (!protectedPersonId) throw new Error('assignPersonalSecurity requires a protectedPersonId');
  return deployRobot(robotsStore, { typeId, controlledBy: protectedPersonId });
}
