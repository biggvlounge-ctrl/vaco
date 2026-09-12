// server/areaStats.js
//
// Per-area statistics, computed from the people who live there.
//
// **The question this answers, and the answer it had to start with.**
// Asked whether every area carries statistics for crime, violent
// crime, sex crimes, gangs, teenage pregnancy, school dropout rate,
// poverty rate and demographics — §9's MASTER BLOCK KEY and §47's
// twenty NEIGHBOURHOOD OUTCOME VARIABLES. Measured, the honest answer
// was no, and for a reason upstream of any of those fields:
//
// **nobody lived anywhere.** `generateNPC` set no community and no
// home. `entities.community_id` and `npcs.home_property_id` were both
// in the schema from the start and written by nothing;
// `home_property_id` was READ in exactly one place — a death's
// location in `mortality.js` — and was therefore always null. So
// per-area statistics were not missing fields, they were
// **uncomputable**: no person was associated with an area.
//
// Residency is fixed at the source (`generateNPC`, migrate, restore).
// This module is what that unlocks.
//
// ---------------------------------------------------------------------
// Computed, not stored — and the drift that makes the point
//
// `communities` carries `crime`, `safety`, `employment`, `education`,
// `housing` and `reputation` as NUMERIC columns, and
// `generateCommunity` defaults them to 50 (crime to 0). **Those are
// seed placeholders that nothing updates.** A community reads
// `employment: 50` because 50 is the default, not because half of it
// works — and `getCommunityHealth` averages those placeholders into a
// health score.
//
// Standing rule 3 forbids duplicating a computable rollup, so nothing
// here writes to those columns. Instead `describeDrift` reports the
// stored figure beside the computed one, because the gap between them
// is the most useful number in this file: it says which of a
// community's statistics are measurements and which are still
// furniture.
//
// ---------------------------------------------------------------------
// What is computable today, and what is not
//
// Computable, and built below: population, age profile, poverty rate,
// employment rate, death rate and causes of death, household size.
// Each reads real per-entity records — `individual_finances`,
// `employmentRecords`, `historicalRecords`, `npcs`, `deceased`.
//
// **Not computable, and the reason is named rather than filled with a
// plausible number:**
//
//   crime BY TYPE      `communities.crime` and
//   (violent, sex,     `territory_blocks.crime_rate` are single
//    drug, property,   aggregate numbers. §9 lists seven crime
//    fraud, theft)     categories and `runSecurityPhase` produces no
//                      typed crime record at all, so there is nothing
//                      to break down. This needs a crime event with a
//                      type on it — see the README note.
//
//   gang presence      `territory_blocks.faction_id` says which
//                      faction holds a block, so faction CONTROL is
//                      real. Gang membership per area is not: nothing
//                      links a resident to a faction by geography.
//
//   teenage pregnancy  There is no birth driver. `addFamilyMember`
//                      exists and nothing calls it on its own, so no
//                      birth happens unless code asks for one. A rate
//                      needs births to count and an age structure to
//                      count them against — the age structure now
//                      exists (`mortality.ageInYears`), the births do
//                      not.
//
//   school dropout     `communities.education` is one number and there
//                      are no schools, no students and no enrolment.
//                      A dropout rate needs somebody to drop out OF.
//                      §25's knowledge tiers are the natural substrate
//                      and are unbuilt.
//
//   demographics       No demographic fields exist on an NPC at all.
//                      **And §9 sets a constraint on this that is
//                      worth keeping:** "The system supports
//                      demographic modeling without making
//                      demographics determine an NPC's morality,
//                      criminality, intelligence, or worth." So
//                      demographic composition as an area statistic is
//                      legitimate; a demographic that predicts
//                      behaviour is what the spec forbids, and any
//                      implementation should keep that split.

'use strict';

const economy = require('./economy.js');
const mortality = require('./mortality.js');

//: Flagged interpretive. No document sets a poverty line, and the
//: economy has no currency denomination — `individual_finances` is
//: bare numbers. So poverty is defined RELATIVELY: below half the
//: median net worth of everybody in the world.
//:
//: Relative rather than absolute on purpose. An absolute line would
//: need a currency value nobody has set, and would be meaningless
//: across a collapse and a recovery — half the median tracks a world
//: whose whole economy has moved, which is the situation this
//: simulation is actually about.
const POVERTY_MEDIAN_FRACTION = 0.5;

// -- residency ----------------------------------------------------------

function residentsOf(worldState, communityId) {
  return worldState.npcs.filter((n) => n.communityId === communityId);
}

// **The unplaced are counted separately, never assigned.** A world can
// generate people before it has anywhere to put them, and folding them
// into an arbitrary community would make that community's statistics
// quietly wrong rather than visibly incomplete.
function unplaced(worldState) {
  return worldState.npcs.filter((n) => n.communityId === null || n.communityId === undefined);
}

function placeInCommunity(worldState, options = {}) {
  const { entityId, communityId, homePropertyId = undefined } = options;
  const npc = worldState.npcs.find((n) => n.id === entityId);
  if (!npc) throw new Error(`placeInCommunity: ${entityId} is not among the living`);
  if (communityId !== null && !worldState.communities.some((c) => c.id === communityId)) {
    throw new Error(`placeInCommunity: no community ${communityId}`);
  }
  npc.communityId = communityId;
  if (homePropertyId !== undefined) npc.home_property_id = homePropertyId;
  npc.updatedTick = worldState.tick ?? 0;
  return npc;
}

// -- the computed statistics --------------------------------------------

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// The line, computed over the whole world rather than per area — a
// community is poor relative to the world, not relative to itself. A
// per-community median would make every community contain exactly the
// same share of poor people, which is the classic way to compute a
// number that cannot vary.
function povertyLine(worldState) {
  const worths = worldState.npcs
    .map((n) => economy.getNetWorth(worldState, n.id))
    .filter((w) => Number.isFinite(w));
  const mid = median(worths);
  return mid === null ? null : mid * POVERTY_MEDIAN_FRACTION;
}

// Every statistic for one area. `null` throughout means unknown rather
// than zero — an area with no residents has no poverty rate, and
// reporting 0 would read as an area where nobody is poor.
function statsFor(worldState, communityId, options = {}) {
  const { tick = worldState.tick ?? 0, line = povertyLine(worldState) } = options;
  const residents = residentsOf(worldState, communityId);
  const population = residents.length;

  if (population === 0) {
    return {
      communityId,
      population: 0,
      povertyRate: null,
      employmentRate: null,
      meanAge: null,
      medianNetWorth: null,
      deaths: 0,
      causesOfDeath: {},
      deathRate: null,
    };
  }

  const ids = new Set(residents.map((n) => n.id));

  const worths = residents
    .map((n) => economy.getNetWorth(worldState, n.id))
    .filter((w) => Number.isFinite(w));
  const poor = line === null
    ? null
    : worths.filter((w) => w < line).length;

  const employed = worldState.employmentRecords.filter(
    (r) => r.status === 'active' && ids.has(r.entity_id),
  ).length;

  const ages = residents
    .map((n) => mortality.ageInYears(worldState, n, tick))
    .filter((a) => a !== null);

  // Deaths are counted from world history, which is where they live —
  // and the dead have left `worldState.npcs`, so their residency comes
  // off the corpse in `deceased`.
  const deadHere = (worldState.deceased || []).filter((n) => n.communityId === communityId);
  const causes = {};
  for (const corpse of deadHere) {
    const record = mortality.deathRecordFor(worldState, corpse.id);
    const cause = record?.why ?? 'unknown';
    causes[cause] = (causes[cause] || 0) + 1;
  }

  return {
    communityId,
    population,
    // Share of residents below the world's poverty line.
    povertyRate: poor === null || worths.length === 0 ? null : round(poor / worths.length),
    employmentRate: round(employed / population),
    meanAge: ages.length === 0 ? null : round(ages.reduce((a, b) => a + b, 0) / ages.length, 2),
    medianNetWorth: worths.length === 0 ? null : median(worths),
    deaths: deadHere.length,
    causesOfDeath: causes,
    // Deaths as a share of everybody who has ever lived here, which is
    // the only denominator available without a time window — stated
    // rather than presented as an annual rate it is not.
    deathRate: round(deadHere.length / (population + deadHere.length)),
  };
}

function statsForAll(worldState, options = {}) {
  const line = povertyLine(worldState);
  const tick = options.tick ?? worldState.tick ?? 0;
  return worldState.communities.map((c) => statsFor(worldState, c.id, { tick, line }));
}

// -- stored versus computed ---------------------------------------------

// **The most useful output in this file.** `communities.employment` and
// `communities.crime` are stored NUMERIC columns seeded to 50 and 0 by
// `generateCommunity`, and nothing updates them — so a community
// reports half its people employed because 50 is the default. This
// puts the stored figure beside the computed one and names the gap.
//
// Nothing here writes the computed value back. Standing rule 3: a
// rollup that can be computed must not be stored, and `communities`
// having those columns at all is a tension in the schema rather than a
// licence to duplicate.
function describeDrift(worldState, communityId, options = {}) {
  const community = worldState.communities.find((c) => c.id === communityId);
  if (!community) throw new Error(`describeDrift: no community ${communityId}`);
  const stats = statsFor(worldState, communityId, options);

  const rows = [
    {
      field: 'population',
      stored: community.population ?? null,
      computed: stats.population,
    },
    {
      field: 'employment',
      // The column is 0..100; the computed rate is 0..1.
      stored: community.employment ?? null,
      computed: stats.employmentRate === null ? null : round(stats.employmentRate * 100, 2),
    },
  ];

  return rows.map((row) => ({
    ...row,
    drifted: row.stored !== null && row.computed !== null
      && Math.abs(Number(row.stored) - Number(row.computed)) > 0.01,
  }));
}

// What this module cannot answer, in a form a caller can show a user
// rather than a comment only a developer reads. Every entry names the
// missing substrate, not just the missing number.
const UNAVAILABLE = {
  crimeByType: 'communities.crime and territory_blocks.crime_rate are single aggregate '
    + 'numbers. §9 lists seven crime categories and runSecurityPhase produces no typed '
    + 'crime record, so there is nothing to break down.',
  gangMembership: 'territory_blocks.faction_id gives faction CONTROL of a block. Nothing '
    + 'links a resident to a faction by geography, so membership per area is not derivable.',
  teenagePregnancy: 'there is no birth driver — addFamilyMember exists and nothing calls it '
    + 'on its own. A rate needs births to count; the age structure to count them against '
    + 'now exists.',
  schoolDropout: 'communities.education is one number. There are no schools, students or '
    + 'enrolment, so there is nothing to drop out of. §25 knowledge tiers are the substrate.',
  demographics: 'no demographic fields exist on an NPC. §9 permits demographic modelling and '
    + 'forbids demographics determining morality, criminality, intelligence or worth — so '
    + 'composition is legitimate and prediction is not.',
};

module.exports = {
  POVERTY_MEDIAN_FRACTION,
  UNAVAILABLE,
  residentsOf,
  unplaced,
  placeInCommunity,
  povertyLine,
  statsFor,
  statsForAll,
  describeDrift,
};
