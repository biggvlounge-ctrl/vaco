// VDP — Demographics: real-world-weighted origin, income tiers, and a
// real consciousness-state scale, mixed into every NPC and player.
//
// Per direct instruction (9 Oct 2026): "people coming from all across,
// all around the world, different nationalities, religions, incomes.
// Make sure that's inserted in all the NPCs." Before this module,
// `npcs.js`'s `createNpc` carried none of this -- only
// `immigration.js`'s own arrival record had `originRegion`/`religion`,
// and only for a real migrant, never for the ordinary founding
// population or a player.
//
// **Region weights are real, not invented.** `WORLD_REGIONS`' shares
// are the broadly-cited real continental population distribution (UN
// population estimates, approximate): Asia ~59%, Africa ~18%, Europe
// ~9%, Latin America & the Caribbean ~8%, North America ~5%, Oceania
// ~0.5% -- "go to the whole globe and get a good percentage" read
// literally, not a uniform or arbitrary split. Flagged as approximate:
// no document in this repo supplies an exact figure, and these are
// rounded for a weighted draw, not asserted as precise.
//
// **`consciousnessLevel` is this module's one real interpretive
// call, named outright.** The instruction says "poor state of minds
// ... which we'll use through the Hawking scale... mixed in with
// everything else, morality." No scale named "Hawking" exists in any
// real, checkable source. The real, well-known scale this almost
// certainly means is David R. Hawkins' **Scale of Consciousness**
// (*Power vs. Force*, 1995) -- a real, named, logarithmic 0-1000 scale
// of emotional/moral states from Shame (20) up through Enlightenment
// (700+), with Courage (200) as Hawkins' own named threshold between
// destructive and constructive states. Used here as that real scale,
// under its real name and real level values -- flagged clearly so a
// mis-hearing can be corrected rather than silently built around.
//
// `religion`/`culture` stay free text, same discipline
// `immigration.js`'s own `originRegion`/`religion` already use --
// "different nationalities, religions" is the instruction's own open
// phrasing, never a closed list this module invents.

export const WORLD_REGIONS = [
  { name: 'Asia', share: 0.59 },
  { name: 'Africa', share: 0.18 },
  { name: 'Europe', share: 0.09 },
  { name: 'Latin America and the Caribbean', share: 0.08 },
  { name: 'North America', share: 0.05 },
  { name: 'Oceania', share: 0.01 },
];

// David R. Hawkins' real, named Scale of Consciousness (*Power vs.
// Force*, 1995) -- see header for why "Hawking" is read as "Hawkins."
// Real level names and real approximate values, in their real order.
export const HAWKINS_SCALE = [
  { name: 'Shame', value: 20 },
  { name: 'Guilt', value: 30 },
  { name: 'Apathy', value: 50 },
  { name: 'Grief', value: 75 },
  { name: 'Fear', value: 100 },
  { name: 'Desire', value: 125 },
  { name: 'Anger', value: 150 },
  { name: 'Pride', value: 175 },
  { name: 'Courage', value: 200 },
  { name: 'Neutrality', value: 250 },
  { name: 'Willingness', value: 310 },
  { name: 'Acceptance', value: 350 },
  { name: 'Reason', value: 400 },
  { name: 'Love', value: 500 },
  { name: 'Joy', value: 540 },
  { name: 'Peace', value: 600 },
  { name: 'Enlightenment', value: 700 },
];

// Hawkins' own real named threshold: 200 (Courage) is where a state
// stops being destructive and starts being constructive -- the real
// number this module reads, never a second invented cutoff.
export const COURAGE_THRESHOLD = 200;

export function isConstructiveState(value) {
  return value >= COURAGE_THRESHOLD;
}

// Real income tiers, ordered low to high, each naming the real
// `property.js` level it can actually afford to start in -- "a lot of
// people will have to start off in one-bedroom apartments,
// two-bedroom apartments, till they can move up." `property.js`'s
// real Studio/Flat read as the real one-/two-bedroom starter units the
// instruction names; Penthouse stays out of reach until real income
// (or `property.js`'s own `upgradeHome`) says otherwise.
export const INCOME_LEVELS = [
  { name: 'low', maxAffordablePropertyLevel: 0 },
  { name: 'lower-middle', maxAffordablePropertyLevel: 1 },
  { name: 'middle', maxAffordablePropertyLevel: 2 },
  { name: 'upper-middle', maxAffordablePropertyLevel: 3 },
  { name: 'affluent', maxAffordablePropertyLevel: 5 },
];

function weightedPick(weighted, rng) {
  const total = weighted.reduce((sum, w) => sum + w.share, 0);
  let roll = rng() * total;
  for (const w of weighted) {
    if (roll < w.share) return w;
    roll -= w.share;
  }
  return weighted[weighted.length - 1];
}

// A real, globally-weighted origin draw -- `rng` injectable, same
// convention every other draw in this directory already uses.
export function drawOriginRegion(rng = Math.random) {
  return weightedPick(WORLD_REGIONS, rng).name;
}

// Uniform among real income tiers -- no document weights these by
// anything real, unlike region, so an even draw is the honest default
// rather than a guessed skew.
export function drawIncomeLevel(rng = Math.random) {
  return INCOME_LEVELS[Math.floor(rng() * INCOME_LEVELS.length)].name;
}

export function getIncomeLevel(name) {
  return INCOME_LEVELS.find((l) => l.name === name) || null;
}

// A real draw across Hawkins' own real level set -- "mixed in with
// everything else, morality and everything else" read as: every real
// state on the scale is possible, not only the low ("poor state of
// mind") ones the instruction specifically names as present.
export function drawConsciousnessLevel(rng = Math.random) {
  return HAWKINS_SCALE[Math.floor(rng() * HAWKINS_SCALE.length)];
}

// The one real, combined demographic record every NPC/player now
// carries -- `religion`/`culture` stay free text (see header), so this
// module itself invents no closed list for either.
export function drawDemographics({ religion = null, culture = null, rng = Math.random } = {}) {
  const consciousness = drawConsciousnessLevel(rng);
  return {
    originRegion: drawOriginRegion(rng),
    religion,
    culture,
    incomeLevel: drawIncomeLevel(rng),
    consciousnessLevel: consciousness.name,
    consciousnessValue: consciousness.value,
  };
}
