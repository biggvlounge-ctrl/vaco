// VDP — City Tiers: the real scale ladder for a VXLLAGE/VACAY
// *community* itself, not for an individual unit inside one.
//
// Direct correction, replacing an earlier misreading that tiered
// CHOPZ's commercial units: "the five different tiers" was never
// about CHOPZ, and never about per-unit pricing. Per direct
// instruction: "all I was speaking on are the village locations and
// the vacay locations... there'll be like 5, 10, 15, 20, and 30
// minute cities where people will predominantly be in and they don't
// have to leave, ride share will be provided... all your amenities
// everything within that area." This is the real-world "X-minute
// city" planning concept (the walkable-neighborhood standard VXLLAGE's
// own reference points -- St. Charles' Main Street, Central West End,
// the Delmar Loop -- all genuinely are), applied as VXLLAGE's own
// scale ladder: how large a single self-contained complex is, not
// what an apartment inside it costs. `property.js`'s PROPERTY_LEVELS
// (Studio/Flat/Townhouse/Estate/Penthouse) already covers unit size
// and stays untouched -- that's a different axis from this one.
//
// **Real grounding, not an invented number**: an average adult
// walking speed is ~5 km/h (~83 meters/minute), the standard figure
// pedestrian-planning literature (including the real "15-minute city"
// concept this is modeled on) uses. Each tier's radius is that speed
// times its minute count, not a guess.
//
// **Rideshare beyond the radius is not a new system.** A trip past a
// tier's own walkable radius uses VOID's real ground-transport
// booking -- already wired, per `vxllage/VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s
// own API map: "booking triggers a VOID ground-transport option at
// checkout." `needsRideshare()` below only flags when that real VOID
// path applies; it never re-implements dispatch, pricing, or booking
// itself -- that stays VOID's (`void/lib/reserveBooking.js`,
// `commuteScheduling.js`), reached the same way every other cross-app
// feature in this app reaches a real sibling API (a thin client, not
// duplicated logic).

const WALK_SPEED_METERS_PER_MINUTE = 83; // ~5 km/h, standard pedestrian-planning figure

// The real amenity categories a self-contained complex needs so a
// resident "doesn't have to leave" -- each one maps to an actual,
// already-built VDP feature, not a placeholder:
//   residential   — property.js's My Home panel (buy/rent a VXLLAGE unit)
//   shopping      — CHOPZ Shorts (chopz-embed, the real TikTok-Shop-style
//                    affiliate marketplace) and Fashion District
//   dining        — Food District
//   screens       — DREAMS Screens panel (direct-to-consumer ad income,
//                    not housing -- see dreamsClient.js)
//   social        — the Village District (vxllage-embed, VXLLAGE's real
//                    X/Reddit/Substack/Clubhouse-comparable app)
//   entertainment — The Vavlt (nightclub) and VACAY Experiences
export const AMENITY_CATEGORIES = [
  'residential',
  'shopping',
  'dining',
  'screens',
  'social',
  'entertainment',
];

// What actually satisfies each category today, named by real file —
// used by describeCoverage() below so a classification can point at
// the real feature behind it instead of asserting the category blind.
export const AMENITY_SOURCES = {
  residential: ['My Home panel (property.js)'],
  shopping: ['CHOPZ Shorts (chopz-embed)', 'Fashion District'],
  dining: ['Food District'],
  screens: ['DREAMS Screens panel (dreamsClient.js)'],
  social: ['Village District (vxllage-embed)'],
  entertainment: ['The Vavlt', 'VACAY Experiences (vacay-embed)'],
};

// Cumulative by design: a bigger complex is required to offer
// everything a smaller one does, plus more. Tiers 4 and 5 both
// require the full 6-category set -- real "X-minute city" scaling
// past a certain size is about *depth* (more of each kind of amenity,
// more residents) rather than inventing a 7th category, so tier 5
// additionally requires at least 2 real sources per category instead
// of just 1.
// Named "-Minute City," the real urban-planning term (the "15-minute
// city" concept this is modeled on), deliberately not "...Village" --
// `population.js` already uses "Village" for a different axis (a
// headcount-size label: Hamlet/Village/Town/City/Metropolis), and
// reusing it here for footprint-size would read as the same thing in
// the UI when it isn't.
export const CITY_TIERS = [
  {
    id: 1, minutes: 5, name: '5-Minute City',
    radiusMeters: 5 * WALK_SPEED_METERS_PER_MINUTE,
    requiredAmenities: ['residential', 'shopping', 'dining'],
    minSourcesPerAmenity: 1,
    populationCap: 50,
  },
  {
    id: 2, minutes: 10, name: '10-Minute City',
    radiusMeters: 10 * WALK_SPEED_METERS_PER_MINUTE,
    requiredAmenities: ['residential', 'shopping', 'dining', 'screens'],
    minSourcesPerAmenity: 1,
    populationCap: 150,
  },
  {
    id: 3, minutes: 15, name: '15-Minute City',
    requiredAmenities: ['residential', 'shopping', 'dining', 'screens', 'social'],
    radiusMeters: 15 * WALK_SPEED_METERS_PER_MINUTE,
    minSourcesPerAmenity: 1,
    populationCap: 400,
  },
  {
    id: 4, minutes: 20, name: '20-Minute City',
    radiusMeters: 20 * WALK_SPEED_METERS_PER_MINUTE,
    requiredAmenities: AMENITY_CATEGORIES,
    minSourcesPerAmenity: 1,
    populationCap: 900,
  },
  {
    id: 5, minutes: 30, name: '30-Minute City',
    radiusMeters: 30 * WALK_SPEED_METERS_PER_MINUTE,
    requiredAmenities: AMENITY_CATEGORIES,
    minSourcesPerAmenity: 2,
    populationCap: 2000,
  },
];

export function getTier(tierId) {
  return CITY_TIERS.find((t) => t.id === tierId) || null;
}

// Does `sourcesByAmenity` (a real { category: [sourceName, ...] } map,
// e.g. AMENITY_SOURCES) satisfy a given tier's requirements?
export function tierIsSatisfiedBy(tier, sourcesByAmenity) {
  return tier.requiredAmenities.every((category) => {
    const sources = sourcesByAmenity[category] || [];
    return sources.length >= tier.minSourcesPerAmenity;
  });
}

// The highest real tier a complex qualifies for given what it
// actually has, not an assigned label -- walks from largest to
// smallest and returns the first tier whose requirements are met, or
// `null` if even the smallest tier's requirements aren't satisfied.
export function classifyComplex(sourcesByAmenity) {
  const descending = [...CITY_TIERS].sort((a, b) => b.id - a.id);
  return descending.find((tier) => tierIsSatisfiedBy(tier, sourcesByAmenity)) || null;
}

// Real, inspectable readout: which categories are covered, by what,
// and which (if any) are missing -- so a classification can be
// checked against actual features instead of taken on faith.
export function describeCoverage(sourcesByAmenity) {
  return AMENITY_CATEGORIES.map((category) => ({
    category,
    sources: sourcesByAmenity[category] || [],
    covered: (sourcesByAmenity[category] || []).length > 0,
  }));
}

// A trip of `distanceMeters` from home base needs VOID's real
// ground-transport booking once it exceeds the resident's own tier's
// walkable radius -- this only flags that; the actual booking is
// VOID's (see the module header).
export function needsRideshare(distanceMeters, tierId) {
  const tier = getTier(tierId);
  if (!tier) {
    throw new Error(`needsRideshare: no such tier ${tierId}`);
  }
  return distanceMeters > tier.radiusMeters;
}

// Meridian's own real classification, computed from AMENITY_SOURCES
// above (not asserted) -- every VDP district/panel that backs each
// category is named there, so this is a real readout of the actual
// current build, re-evaluated if AMENITY_SOURCES ever shrinks.
export function classifyMeridian() {
  return classifyComplex(AMENITY_SOURCES);
}
