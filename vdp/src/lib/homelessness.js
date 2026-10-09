// VDP — Homelessness: a real status derived from real housing facts
// and real income, never stored as its own flag.
//
// Per direct instruction (9 Oct 2026): "a lot of people who don't have
// the income, they migrate through. There will be some homelessness
// as well, too, that the government can't control." Real, derived --
// the same "a stored flag and the underlying facts can disagree, so
// compute it" discipline `worldExpansion.js`'s own `realGrowthSignal`
// already uses, read fresh off `property.js`'s own `homeOwnedBy` and
// `households.js`'s own `householdOf` (direct imports: both are pure
// reads with no side effect of their own, the same footing
// `npcs.js`'s own direct import of `world.js`'s `DISTRICTS` stands
// on) rather than a second, stored boolean this module could let go
// stale.
//
// **"That the government can't control" is read literally: this
// module computes the real fact and stops.** No function here moves
// anyone, assigns housing, or forces a fix -- the real remedies
// (`property.js`'s `purchaseHome`/`rentHome`, a household's own real
// `addMember`) are each already a real, player-initiated act
// elsewhere; nothing here substitutes a government decision for them.

import { homeOwnedBy } from './property.js';
import { householdOf } from './households.js';
import { getIncomeLevel } from './demographics.js';

// Real and housed: either owns/rents a real home, or lives in a real
// household someone else's property anchors.
export function isHoused(propertyStore, householdsStore, entityId) {
  return Boolean(homeOwnedBy(propertyStore, entityId) || householdOf(householdsStore, entityId));
}

export function isHomeless(propertyStore, householdsStore, entityId) {
  return !isHoused(propertyStore, householdsStore, entityId);
}

// Whether a real income tier can afford even the cheapest real unit
// (`property.js`'s own Studio, level 1) -- an unknown income level
// name affords nothing, never silently treated as able to.
export function canAffordAnyHousing(incomeLevelName) {
  const level = getIncomeLevel(incomeLevelName);
  return Boolean(level && level.maxAffordablePropertyLevel >= 1);
}

// The real, combined condition the instruction actually names: housed
// nowhere AND real income cannot change that by simply buying or
// renting. A brand-new arrival who has a real income but has not
// bought a home yet is not this -- "at risk" means income is the
// actual, structural blocker, not timing.
export function isHomelessDueToIncome(propertyStore, householdsStore, entityId, incomeLevelName) {
  return isHomeless(propertyStore, householdsStore, entityId) && !canAffordAnyHousing(incomeLevelName);
}
