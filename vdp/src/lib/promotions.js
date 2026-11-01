// VDP — Promotions: the ownership ladder over a sports team, from a
// real owner down to independent fighters with no team at all.
//
// Per direct instruction: "add in wrestling teams, wrestling
// organizations from top to bottom, where you have like a similar to
// how baseball has its owners, all the way down to independent
// wrestlers, to people in gangs. Gangs can have a wrestling team.
// Gangs can have any sports team. Organizations can. Tribes can have
// representatives. It can almost be a tribal organizational. It could
// be racial, ethnic, to where they all can have their fighter for
// their culture, zone, or city, town."
//
// **Not `teamSports.js`'s `createTeam`.** That function builds the
// real roster/headcount a single game needs and nothing about who
// owns it -- checked directly, `createTeam` has no owner field at
// all, confirming the gap this module closes. A promotion here is the
// *franchise*: who owns it and who is signed to it, independent of
// any one game or match. `teamSports.js`'s own `teamId` can be a
// promotion's roster given to a game, but this module never reaches
// into that one, the same decoupled-by-reference split `conflicts.js`
// already takes from `combatSports.js`.
//
// **`ownerId` stays a generic, unvalidated id, on purpose.** The
// direct instruction names four genuinely different kinds of owner --
// an individual player, a gang, a tribe/organization, and (by
// extension) a civilization representing a zone/city/town's own
// culture. Rather than import `organizations.js`/`civilizations.js`
// and validate against them (coupling this module to both, and to
// every future kind of real group this ecosystem ever adds),
// `ownerType` is a free label the caller supplies for display, the
// same posture `conflicts.js`'s own `groupId` already takes for a
// tribe/gang/city id it never looks up either.
export const OWNER_TYPES = ['player', 'organization', 'civilization', 'independent'];

export class PromotionError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PromotionError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

export function createPromotionsStore() {
  return { promotions: [] };
}

export function listPromotions(store) {
  return store.promotions;
}

export function getPromotion(store, promotionId) {
  return store.promotions.find((p) => p.promotionId === promotionId) || null;
}

// The one real question "is this fighter independent" needs answered
// without scanning every promotion's own roster by hand at every call
// site -- the same real reason `combatSports.assertBookable` exists
// rather than leaving every caller to re-derive "who is busy" itself.
export function promotionFor(store, fighterId) {
  return store.promotions.find((p) => p.rosterIds.includes(fighterId)) || null;
}

export function isIndependent(store, fighterId) {
  return promotionFor(store, fighterId) === null;
}

export function createPromotion(store, options = {}) {
  const a = 'createPromotion';
  const {
    promotionId, name, ownerId, ownerType = 'player', sport, rosterIds = [],
  } = options;
  const id = requireString(promotionId, 'promotionId', a);
  const promotionName = requireString(name, 'name', a);
  const owner = requireString(ownerId, 'ownerId', a);
  if (!OWNER_TYPES.includes(ownerType)) {
    throw new PromotionError(`${a}: ownerType must be one of ${OWNER_TYPES.join(', ')}`);
  }
  const sportName = requireString(sport, 'sport', a).toLowerCase();
  if (getPromotion(store, id)) {
    throw new PromotionError(`${a}: promotion "${id}" already exists`);
  }
  if (!Array.isArray(rosterIds)) throw new PromotionError(`${a}: rosterIds must be an array`);
  const roster = rosterIds.map((f) => requireString(String(f ?? ''), 'rosterIds entry', a));
  const unique = new Set(roster);
  if (unique.size !== roster.length) {
    throw new PromotionError(`${a}: the same fighter appears twice on the roster`);
  }
  // A fighter already signed elsewhere cannot be double-booked onto a
  // second promotion's roster at creation time either -- the same
  // real exclusivity `signFighter` below enforces one at a time.
  for (const fighterId of roster) {
    const existing = promotionFor(store, fighterId);
    if (existing) {
      throw new PromotionError(`${a}: ${fighterId} is already signed to "${existing.promotionId}"`);
    }
  }

  const promotion = {
    promotionId: id, name: promotionName, ownerId: owner, ownerType, sport: sportName, rosterIds: roster,
  };
  store.promotions.push(promotion);
  return promotion;
}

// A fighter can be signed to exactly one promotion at a time -- the
// real exclusivity a "team" implies, and what makes "independent"
// mean something rather than being purely cosmetic.
export function signFighter(store, promotionId, fighterId) {
  const a = 'signFighter';
  const promotion = getPromotion(store, promotionId);
  if (!promotion) throw new PromotionError(`${a}: no promotion "${promotionId}"`);
  const existing = promotionFor(store, fighterId);
  if (existing) {
    throw new PromotionError(`${a}: ${fighterId} is already signed to "${existing.promotionId}"`);
  }
  promotion.rosterIds.push(fighterId);
  return promotion;
}

// Releasing a fighter makes them real-independent again -- not
// deleted, just no longer on any roster, the same real state
// `promotionFor` already reads as "independent."
export function releaseFighter(store, promotionId, fighterId) {
  const a = 'releaseFighter';
  const promotion = getPromotion(store, promotionId);
  if (!promotion) throw new PromotionError(`${a}: no promotion "${promotionId}"`);
  const index = promotion.rosterIds.indexOf(fighterId);
  if (index === -1) {
    throw new PromotionError(`${a}: ${fighterId} is not signed to "${promotionId}"`);
  }
  promotion.rosterIds.splice(index, 1);
  return promotion;
}

// Baseball-style ownership change -- "similar to how baseball has its
// owners." A promotion's roster and identity survive a sale; only who
// sits at the top of the ladder changes.
export function transferOwnership(store, promotionId, newOwnerId, newOwnerType = 'player') {
  const a = 'transferOwnership';
  const promotion = getPromotion(store, promotionId);
  if (!promotion) throw new PromotionError(`${a}: no promotion "${promotionId}"`);
  const owner = requireString(newOwnerId, 'newOwnerId', a);
  if (!OWNER_TYPES.includes(newOwnerType)) {
    throw new PromotionError(`${a}: newOwnerType must be one of ${OWNER_TYPES.join(', ')}`);
  }
  promotion.ownerId = owner;
  promotion.ownerType = newOwnerType;
  return promotion;
}

// A real win/loss record for the promotion ITSELF, derived fresh from
// its own roster's individual `leaderboards.js` records every call --
// never stored redundantly, the same "read the real result, never
// recompute and cache it" posture this codebase already draws
// elsewhere (`leaderboards.js`'s own header, `taxes.js` against
// `property.js`). `leaderboardsStore` is injected rather than
// imported, the same decoupled-by-injection shape every cross-module
// read in this directory already takes.
export function promotionRecord(store, promotionId, leaderboardsStore, recordForFn) {
  const a = 'promotionRecord';
  const promotion = getPromotion(store, promotionId);
  if (!promotion) throw new PromotionError(`${a}: no promotion "${promotionId}"`);
  let wins = 0;
  let losses = 0;
  for (const fighterId of promotion.rosterIds) {
    const record = recordForFn(leaderboardsStore, fighterId);
    if (record) {
      wins += record.wins;
      losses += record.losses;
    }
  }
  return {
    promotionId: promotion.promotionId, name: promotion.name, rosterSize: promotion.rosterIds.length, wins, losses,
  };
}

export function promotionsByOwner(store, ownerId) {
  return store.promotions.filter((p) => p.ownerId === ownerId);
}
