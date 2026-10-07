import { populationTier, DEFAULT_TIERS } from './population.js';

// VDP — Settlement: Meridian starts as one inhabited district, not
// twenty-five at once. Per direct instruction: "this is a growing
// world that's newly inhabited... we can start with... whatever the
// district holds enough people mixed with houses in the area to
// create the area, and then the rest of the area will be inhabited --
// this is how the game will grow." No founding-storyline document
// exists anywhere in this repo (checked directly, not assumed) --
// this is built from that instruction alone, not invented lore.
//
// **The seed, per direct instruction**: the Village District
// (`village`, VXLLAGE's real social hub, vxllage-embed) -- "houses
// mixed with people" is the literal phrase, and it's already where a
// new player's own avatar and home panel live. Every other district
// physically exists in `world.js` (its building is real and
// walkable -- this does not touch geometry, entry radius, or any of
// `world.test.js`'s own coverage) but is **unsettled** until Meridian's
// real population, per direct instruction ("real population
// threshold"), crosses the threshold its tier names.
//
// **Growth uses the population tiers that already exist**
// (`population.js`'s own `DEFAULT_TIERS`), not a second invented
// scale. Honest about the real numbers: `population.js`'s own
// `createNpcWorld()` seeds 14 NPCs by default, so a freshly booted
// Meridian is already past Hamlet (min 10) the moment it starts --
// Hamlet is the real, if largely theoretical, pre-NPC-seeding state.
// Real growth past Village (50, Town's threshold) depends on real
// players joining, same as it should: NPCs alone settling the world
// would make "people started to integrate to it" meaningless.
//
// **Unlock order is a real, stated editorial choice, not arbitrary**:
// districts covering daily needs (dining, shopping, dating,
// entertainment) unlock before travel/logistics/nightlife, which
// unlock before the media/entertainment cluster, which unlocks before
// the long tail of specialized single-purpose districts -- the same
// "amenity depth before breadth" progression `cityTiers.js` already
// uses for its own 5-minute-to-30-minute ladder, applied here to
// *which* districts exist rather than how large one is.
const TIER_ORDER = DEFAULT_TIERS.map((t) => t.name);

export const DISTRICT_UNLOCK_TIER = {
  village: 'Hamlet',

  food: 'Village',
  fashion: 'Village',
  'dating-village': 'Village',
  vago: 'Village',

  vacay: 'Town',
  void: 'Town',
  vavlt: 'Town',
  'combat-sports': 'Town',
  commons: 'Town',

  chopz: 'City',
  stage: 'City',
  publisher: 'City',
  hvntz: 'City',
  'vulture-music': 'City',
  'vulture-pods': 'City',
  'vulture-flix': 'City',

  vex: 'Metropolis',
  vado: 'Metropolis',
  venvm: 'Metropolis',
  'vaco-analytics': 'Metropolis',
  'beat-marketplace': 'Metropolis',
  'vulture-studios': 'Metropolis',
  vacancy: 'Metropolis',
  'vaco-merch': 'Metropolis',
};

function tierRank(tierName) {
  const rank = TIER_ORDER.indexOf(tierName);
  if (rank === -1) throw new Error(`settlement: unknown tier "${tierName}"`);
  return rank;
}

// Refuses an unmapped district rather than defaulting it open or
// closed -- a district added to world.js without a real settlement
// classification is a gap to close, not a silent guess either way.
export function requiredTierFor(districtId) {
  const tier = DISTRICT_UNLOCK_TIER[districtId];
  if (!tier) throw new Error(`settlement: district "${districtId}" has no real unlock tier assigned`);
  return tier;
}

export function isDistrictUnlocked(districtId, realPopulation) {
  const currentTier = populationTier(realPopulation).tier;
  return tierRank(currentTier) >= tierRank(requiredTierFor(districtId));
}

export function getUnlockedDistrictIds(realPopulation, districtIds) {
  return districtIds.filter((id) => isDistrictUnlocked(id, realPopulation));
}
