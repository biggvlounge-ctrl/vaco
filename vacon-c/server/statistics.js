// server/statistics.js
//
// One catalogue of statistics, every area answering all of it.
//
// **The requirement this is built to.** Every category, everywhere, in
// the same shape — so the same measurement can be taken of any area in
// any world and the numbers line up against each other and against the
// environment those areas sit in. That is a stronger requirement than
// "compute some statistics", and three properties follow from it that
// would not follow from the weaker one:
//
//   **1. Every area returns every key.** `profileFor` is a fixed
//   vector. A statistic that cannot be computed for an area comes back
//   as `value: null` with `known: false` and a reason — it is never
//   omitted. An object built only from the statistics that happened to
//   be computable gives a quiet block nine keys and a violent one
//   twenty, and no comparison across them lines up. This is the same
//   rule `crime.countsByCategory` follows for the eight crime
//   categories, applied to the whole catalogue.
//
//   **2. Unknown is never zero.** `Number(null)` is 0 and 0 is finite —
//   CLAUDE.md's own corollary, and the defect that shipped in
//   `moodFor()`. An area with no residents has no poverty rate; saying
//   0 says nobody there is poor, which is the opposite of what an
//   empty area means. Every statistic below returns null rather than a
//   plausible number, and `compare` drops nulls from a denominator
//   rather than averaging them in as zeroes.
//
//   **3. Counts do not compare; rates do.** A 40-person block and a
//   4,000-person district cannot be ranked on totals. Every statistic
//   carries a `unit`, and only `share`, `rate_per_1k`, `index` and
//   `years` are marked `comparable` — a `count` or a `currency` figure
//   is reported and excluded from z-scores and correlations. The test
//   asserts that split rather than trusting this comment.
//
// ---------------------------------------------------------------------
// Scope, and the honest asterisk on half the environment
//
// Each statistic declares the scope it is really measured at:
//
//   community  measured from this area's own residents, properties,
//              incidents and blocks. Genuinely local.
//   city       measured from the city this area is in, and therefore
//              **identical for every community in that city**.
//              `resources` is city-scoped in the schema, so resource
//              scarcity cannot vary block to block no matter how much a
//              neighbourhood statistic would like it to.
//   world      one number for the whole simulation — disease pressure,
//              survival scarcity, the active-condition count.
//
// This matters for exactly the use this file exists for. Correlating a
// community-scoped statistic against a city-scoped one across
// communities in one city is correlating a variable against a
// constant; do it across cities and it is real. `correlate` reports
// the scopes of both inputs so a caller can see which it got, and
// refuses outright when either side has no variance.
//
// ---------------------------------------------------------------------
// Nothing here invents a number
//
// Every `compute` reads a real record — residents, `individual_finances`,
// `employmentRecords`, `crimeIncidents`, `entityOrganizationMemberships`,
// `properties`, `ownershipRecords`, `territoryBlocks`, `resources`,
// `entityState`. A statistic with no substrate is declared with
// `unavailable` and a named reason, which makes it a first-class entry
// in the catalogue instead of a missing key: a caller asking for the
// surveillance block gets four entries saying what surveillance would
// need, not an empty object that reads as "no surveillance here".
//
// **Sixteen of the fifty-seven are declared that way, and three of
// those were written as computations first.** School capacity, clinic
// capacity and infrastructure condition all read the `infrastructure`
// table, which has the right columns and no WorldState array at all —
// nothing ever creates a row. Each summed an empty list, `per1k`
// turned that into 0.0, and every area in every world would have
// reported "no schools" as a measurement. That is the exact defect
// this catalogue exists to prevent, made by the catalogue itself
// before it was checked against the engine.
//
// §9's own constraint is carried through as one of those: the spec
// permits demographic modelling and forbids demographics determining
// "morality, criminality, intelligence, or worth", so demographic
// COMPOSITION is a legitimate area statistic and a demographic that
// predicts behaviour is not. The entry says so.

'use strict';

const areaStats = require('./areaStats.js');
const births = require('./births.js');
const households = require('./households.js');
const migration = require('./migration.js');
const crime = require('./crime.js');
const demographics = require('./demographics.js');
const economy = require('./economy.js');
const health = require('./health.js');
const competition = require('./competition.js');
const motivation = require('./motivation.js');
const membership = require('./membership.js');
const infrastructure = require('./infrastructure.js');
const mortality = require('./mortality.js');
const policing = require('./policing.js');
const property = require('./property.js');

// §9's MASTER BLOCK KEY, in its order. Every statistic belongs to one.
const CATEGORIES = [
  'population', 'demographic', 'economics', 'housing', 'crime',
  'organization', 'territory', 'surveillance', 'community',
  'environment', 'psychological',
];

// Units, and which of them can be compared across areas at all.
//
//   share        0..1
//   rate_per_1k  incidents or people per 1,000 residents
//   index        0..100, the schema's own scale for its NUMERIC columns
//   years        an age
//   count        a raw total — reported, never compared
//   currency     `individual_finances` has no denomination anywhere, so
//                a value is meaningful within one world and meaningless
//                between two
const UNITS = {
  share: { comparable: true },
  rate_per_1k: { comparable: true },
  index: { comparable: true },
  years: { comparable: true },
  count: { comparable: false },
  currency: { comparable: false },
};

const SCOPES = ['community', 'city', 'world'];

function round(value, places = 4) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function share(part, whole) {
  if (whole === 0) return null;
  return round(part / whole);
}

function per1k(count, population) {
  if (population === 0) return null;
  return round((count / population) * 1000, 2);
}

// -- the context every statistic reads ----------------------------------
//
// Built once per area rather than per statistic. The poverty line is a
// sweep of the whole world's net worth; computing it inside each of
// four economic statistics would make a profile of 30 areas do it 120
// times for one answer.
function contextFor(worldState, communityId, shared = {}) {
  const tick = shared.tick ?? worldState.tick ?? 0;
  const residents = areaStats.residentsOf(worldState, communityId);
  const community = worldState.communities.find((c) => c.id === communityId) || null;
  const cityId = community?.city_id ?? null;
  const ids = new Set(residents.map((n) => n.id));

  return {
    worldState,
    communityId,
    community,
    cityId,
    tick,
    residents,
    ids,
    population: residents.length,
    line: shared.line !== undefined ? shared.line : areaStats.povertyLine(worldState),
    scarcity: shared.scarcity !== undefined ? shared.scarcity : mortality.survivalScarcity(worldState),
    pressure: shared.pressure !== undefined ? shared.pressure : mortality.diseasePressure(worldState),
  };
}

// Properties this area contains.
//
// **This is the read that makes `properties.community_id` load-bearing.**
// `schema-extensions.sql` has carried a note since it was written
// saying that column is "set by property.js#generateProperty and read
// by nothing", with `test/restore.test.js` holding it as a
// self-checking exemption: the moment anything reads it, the exemption
// stops being true. That moment is here — every housing statistic in
// this file needs to know which properties are in an area, and no
// other path exists, because the base schema gives a property no city,
// community or block.
function propertiesIn(ctx) {
  return (ctx.worldState.properties || []).filter((p) => p.community_id === ctx.communityId);
}

function ageValues(ctx) {
  return ctx.residents
    .map((n) => mortality.ageInYears(ctx.worldState, n, ctx.tick))
    .filter((a) => a !== null);
}

// -- the catalogue ------------------------------------------------------

const CATALOGUE = [
  // ---- population ----------------------------------------------------
  {
    key: 'population', category: 'population', unit: 'count', scope: 'community',
    compute: (ctx) => ctx.population,
  },
  {
    key: 'population_share_of_world', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => share(ctx.population, ctx.worldState.npcs.length),
  },
  {
    key: 'mean_age', category: 'population', unit: 'years', scope: 'community',
    compute: (ctx) => round(mean(ageValues(ctx)), 2),
  },
  {
    key: 'median_age', category: 'population', unit: 'years', scope: 'community',
    compute: (ctx) => round(median(ageValues(ctx)), 2),
  },
  {
    key: 'minor_share', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => {
      const ages = ageValues(ctx);
      //: Flagged interpretive. No document sets an age of majority;
      //: 18 is the conventional one and is used only to slice a
      //: distribution, never to gate a behaviour.
      return share(ages.filter((a) => a < 18).length, ages.length);
    },
  },
  {
    key: 'elder_share', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => {
      const ages = ageValues(ctx);
      return share(ages.filter((a) => a >= 65).length, ages.length);
    },
  },
  {
    key: 'death_rate', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => areaStats.statsFor(ctx.worldState, ctx.communityId, {
      tick: ctx.tick, line: ctx.line,
    }).deathRate,
  },
  {
    key: 'mean_household_size', category: 'population', unit: 'count', scope: 'community',
    // **This measured FAMILY size and called it household size**, which
    // is a different quantity rather than an approximation of the same
    // one. Somebody living alone next door to their brother is one
    // family and two households; a lodger is a household member and no
    // relation at all. `households` had no store at the time, so family
    // membership was the only grouping available and the entry said so.
    // `server/households.js` made the real thing available.
    compute: (ctx) => households.meanSizeIn(ctx.worldState, ctx.communityId),
  },
  {
    // What family membership could not produce at all: somebody with a
    // large family who lives by themselves is a one-person household.
    key: 'solo_household_share', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => households.soloShareIn(ctx.worldState, ctx.communityId),
  },
  // **Both of these were declared unavailable and are now computed.**
  // The reason given was the same for each — "there is no birth
  // driver" — and `server/births.js` is that driver. Nothing about
  // the entries changed except that they can answer.
  {
    key: 'birth_rate', category: 'population', unit: 'rate_per_1k', scope: 'community',
    compute: (ctx) => per1k(births.birthsIn(ctx.worldState, ctx.communityId).length, ctx.population),
  },
  {
    key: 'teenage_birth_rate', category: 'population', unit: 'rate_per_1k', scope: 'community',
    // Births to a parent under 20, per 1,000 residents. **Named
    // `teenage_birth_rate` rather than `teenage_pregnancy_rate`**
    // because that is what it measures: this engine records births,
    // not pregnancies, and the two differ by every pregnancy that does
    // not end in one. A name that promised the wider figure would
    // report the narrower one under it forever.
    compute: (ctx) => {
      const born = births.birthsIn(ctx.worldState, ctx.communityId);
      const teenage = born.filter((n) => {
        const age = births.bearerAgeAt(ctx.worldState, n.id);
        return age !== null && age < 20;
      });
      return per1k(teenage.length, ctx.population);
    },
  },
  {
    key: 'teenage_birth_share', category: 'population', unit: 'share', scope: 'community',
    // The same count against births rather than against population,
    // which is the figure that actually compares across areas of
    // different age structure — a block of forty-year-olds has few
    // births of any kind and would otherwise read as having solved
    // something.
    compute: (ctx) => {
      const born = births.birthsIn(ctx.worldState, ctx.communityId);
      if (born.length === 0) return null;
      const teenage = born.filter((n) => {
        const age = births.bearerAgeAt(ctx.worldState, n.id);
        return age !== null && age < 20;
      });
      return share(teenage.length, born.length);
    },
  },
  {
    key: 'mean_generation', category: 'population', unit: 'count', scope: 'community',
    // `npcs.generation` was 1 for every NPC in every world because
    // nothing could advance it. It moves now, and how far a population
    // has moved from its founders is the thing §51's legacy is about.
    compute: (ctx) => round(mean(ctx.residents
      .map((n) => Number(n.generation))
      .filter((g) => Number.isFinite(g))), 2),
  },
  {
    key: 'migration_rate', category: 'population', unit: 'rate_per_1k', scope: 'community',
    // **Declared unavailable and now computed**, and the declaration
    // was exactly right about why: "`runMigrationPhase` computes a
    // migration RISK signal and nobody moves — no destination is chosen
    // and no residency is rewritten, so there is no arrival or
    // departure to count." `server/migration.js` chooses destinations
    // and rewrites residency, so there is.
    //
    // NET, and over a rolling year: positive means people are arriving.
    // A cumulative count is not a rate, which is the same reasoning
    // `crime.dangerByCommunity` records.
    compute: (ctx) => migration.netRatePer1k(ctx.worldState, ctx.communityId, { tick: ctx.tick }),
  },

  // ---- population: health --------------------------------------------
  // **The `health` trait family had exactly one reader in the whole
  // engine** — `mortality.vitalityOf`, which folds all four traits into
  // a single multiplier on the chance of dying. Generated on every NPC
  // since traits existed, migrated, restored, and visible nowhere. The
  // eleventh standing rule's shape: a generator that nothing reads is
  // indistinguishable from one that does not exist.
  //
  // These live in `population` rather than in a category of their own
  // because §9's block key is fixed at its eleven and these are facts
  // about the people in an area, siblings of the death rate. See
  // server/health.js — in particular its header on why obesity is
  // declared below rather than computed here.
  {
    key: 'mean_nutrition_status', category: 'population', unit: 'index', scope: 'community',
    compute: (ctx) => health.meanHealthTrait(ctx.worldState, ctx.residents, 'Nutrition Status'),
  },
  {
    key: 'mean_sleep_quality', category: 'population', unit: 'index', scope: 'community',
    compute: (ctx) => health.meanHealthTrait(ctx.worldState, ctx.residents, 'Sleep Quality'),
  },
  {
    key: 'mean_immune_response', category: 'population', unit: 'index', scope: 'community',
    compute: (ctx) => health.meanHealthTrait(ctx.worldState, ctx.residents, 'Immune Response'),
  },
  {
    key: 'chronic_condition_rate', category: 'population', unit: 'share', scope: 'community',
    compute: (ctx) => health.chronicConditionShare(ctx.worldState, ctx.residents),
  },
  {
    key: 'mean_athleticism', category: 'population', unit: 'index', scope: 'community',
    // **The caveat this carried was that nothing ever held a contest.**
    // `server/contest.js` was a complete, tested resolver the tick
    // pipeline never called, so the `sports` family had a reader on
    // paper and no world had ever used it. `server/competition.js` is
    // the occasion, and the caveat below is the one that is true now.
    caveat: 'settlements hold games and competing does grow Speed and Coordination, but the '
      + 'drift is slow by design — the same world run twice off one seed, differing only in '
      + 'whether games are held, moved this from 48.92 to 49.10 over 600 ticks. Over runs of '
      + 'that length this is still mostly a reading of what a population was born with. '
      + 'contests_per_1k and competitor_share are the readings of what it does',
    compute: (ctx) => health.meanAthleticism(ctx.worldState, ctx.residents),
  },
  {
    key: 'contests_per_1k', category: 'population', unit: 'rate_per_1k', scope: 'community',
    // Over a rolling year, the same window `crime.dangerByCommunity`
    // uses and for the same reason: a rate over all time only ever
    // rises, so a place that held games a decade ago and none since
    // would read as sporting forever.
    compute: (ctx) => competition.contestRatePer1k(ctx.worldState, ctx.communityId,
      { tick: ctx.tick }),
  },
  {
    key: 'competitor_share', category: 'population', unit: 'share', scope: 'community',
    // The participation half. A hundred games between the same two
    // people is a different settlement from a hundred games across a
    // hundred, and the rate above cannot tell them apart.
    compute: (ctx) => competition.competitorShare(ctx.worldState, ctx.communityId,
      { tick: ctx.tick }),
  },
  {
    key: 'mean_physical_exertion', category: 'population', unit: 'index', scope: 'community',
    // How much physical work a population's life contains: a kept
    // `work` routine and what the `sports` traits say about moving.
    // Reported under its own name and not folded into a body reading —
    // 50 of 127 people hold a work routine, so this splits a population
    // at the same line employment does, which is honest when it is
    // called exertion and misleading when it is called anything else.
    compute: (ctx) => health.meanExertion(ctx.worldState, ctx.residents),
  },
  {
    key: 'health_measured_share', category: 'population', unit: 'share', scope: 'community',
    // What the six readings above actually speak for. `observed_share`
    // does the same job for `mean_stress` and for the same reason.
    compute: (ctx) => health.measuredShare(ctx.worldState, ctx.residents),
  },
  {
    key: 'body_composition', category: 'population', unit: 'index', scope: 'community',
    unavailable: 'no weight, height or body-composition column exists anywhere in the schema, '
      + 'and the two sides of the balance that could stand in for one do not support it. '
      + 'Intake comes from `motivation`\'s food need, which converges on the CITY\'s food '
      + 'availability — a real reading of a place, not of a person. Exertion comes from '
      + 'holding a `work` routine, which 50 of 127 people do, so it splits a population at '
      + 'the employment line: an index built on it reports "not employed" in medical '
      + 'language, which §9\'s demographic clause is there to prevent. Measured across '
      + 'several worlds, the obese band held nobody and could not be reached. What would '
      + 'close it: a per-person consumption record. `inventory.js` can already hold food and '
      + 'nothing consumes it — the moment somebody eats from a holding rather than from a '
      + 'city average, intake becomes a fact about a person.',
  },

  // ---- demographic ---------------------------------------------------
  // **This block said "no demographic fields exist on an NPC at all",
  // which was true of the fields people usually mean and not true of
  // three the schema already carried**: `languages` + `entity_languages`
  // (two tables with zero lines of code), `npcs.religion` and
  // `npcs.education`. See server/demographics.js — and note what is
  // deliberately still absent: race and ethnicity have no column, no
  // document asks for one, and §9's clause makes inventing one a
  // decision to take explicitly rather than as a side effect of
  // wanting a composition statistic.
  //
  // A distribution cannot be z-scored, so each attribute contributes
  // two comparable scalars: Simpson diversity and the dominant share.
  // `demographics.compositionOf` returns the full distribution for
  // anything that wants to show it.
  {
    key: 'linguistic_diversity', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents).language.diversity,
  },
  {
    key: 'dominant_language_share', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents).language.dominantShare,
  },
  {
    key: 'religious_diversity', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents).religion.diversity,
  },
  {
    key: 'dominant_religion_share', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents).religion.dominantShare,
  },
  {
    key: 'educational_attainment', category: 'demographic', unit: 'index', scope: 'community',
    // The one composition here whose values have a direction, so a
    // mean is meaningful in a way a mean religion would not be.
    // Reported on 0..100 rather than as a band index so it shares a
    // scale with every other `index` statistic.
    compute: (ctx) => {
      const mean = demographics.compositionOf(ctx.worldState, ctx.residents).education.meanLevel;
      if (mean === null) return null;
      return round((mean / (demographics.EDUCATION_LEVELS.length - 1)) * 100, 2);
    },
  },
  {
    key: 'demographics_recorded_share', category: 'demographic', unit: 'share', scope: 'community',
    // **How much of the area the three statistics above speak for.**
    // A diversity index drawn from four residents out of four hundred
    // is not wrong, it is thin, and the difference is invisible unless
    // something reports it — the same reason `observed_share` sits
    // beside `mean_stress`.
    compute: (ctx) => {
      if (ctx.population === 0) return null;
      const recorded = ctx.residents.filter(
        (n) => demographics.primaryLanguageOf(ctx.worldState, n.id) !== null
          || n.religion || n.education,
      ).length;
      return share(recorded, ctx.population);
    },
  },
  {
    // **Declared deliberately absent, and now built — because the
    // declaration named exactly what it was waiting for.** It read:
    // "§9 permits demographic modelling while forbidding demographics
    // determining an NPC's morality, criminality, intelligence or worth
    // — which makes adding one a decision to take explicitly, not a
    // side effect of wanting a composition statistic." The owner took
    // that decision on 17 Sep 2026.
    //
    // Measured exactly like language, religion and education. The
    // forbidden half is enforced by `test/ethnicity.test.js` rather
    // than by intention: no generator of crime, policing, employment,
    // wages, mortality or trait values may read the field.
    key: 'ethnic_diversity', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents).ethnicity.diversity,
  },
  {
    key: 'dominant_ethnicity_share', category: 'demographic', unit: 'share', scope: 'community',
    compute: (ctx) => demographics.compositionOf(ctx.worldState, ctx.residents)
      .ethnicity.dominantShare,
  },

  // ---- economics -----------------------------------------------------
  {
    key: 'poverty_rate', category: 'economics', unit: 'share', scope: 'community',
    compute: (ctx) => areaStats.statsFor(ctx.worldState, ctx.communityId, {
      tick: ctx.tick, line: ctx.line,
    }).povertyRate,
  },
  {
    key: 'employment_rate', category: 'economics', unit: 'share', scope: 'community',
    compute: (ctx) => areaStats.statsFor(ctx.worldState, ctx.communityId, {
      tick: ctx.tick, line: ctx.line,
    }).employmentRate,
  },
  {
    key: 'median_net_worth', category: 'economics', unit: 'currency', scope: 'community',
    compute: (ctx) => median(ctx.residents
      .map((n) => economy.getNetWorth(ctx.worldState, n.id))
      .filter((w) => Number.isFinite(w))),
  },
  {
    key: 'median_wage', category: 'economics', unit: 'currency', scope: 'community',
    compute: (ctx) => median((ctx.worldState.employmentRecords || [])
      .filter((r) => r.status === 'active' && ctx.ids.has(r.entity_id))
      .map((r) => Number(r.wage))
      .filter((w) => Number.isFinite(w))),
  },
  {
    key: 'home_ownership_rate', category: 'economics', unit: 'share', scope: 'community',
    compute: (ctx) => {
      if (ctx.population === 0) return null;
      let owners = 0;
      for (const npc of ctx.residents) {
        if (npc.home_property_id === null || npc.home_property_id === undefined) continue;
        const owner = property.getCurrentOwner(ctx.worldState, npc.home_property_id);
        if (owner && owner.owner_entity_id === npc.id) owners += 1;
      }
      return share(owners, ctx.population);
    },
  },
  {
    key: 'business_density_per_1k', category: 'economics', unit: 'rate_per_1k', scope: 'community',
    compute: (ctx) => per1k(
      membership.organizationPresence(ctx.worldState, ctx.communityId)
        .filter((o) => o.type === 'business' || o.type === 'corporation').length,
      ctx.population,
    ),
  },
  {
    key: 'informal_economy_share', category: 'economics', unit: 'share', scope: 'community',
    unavailable: 'every movement of value is recorded the same way — payroll, production and '
      + 'barter.exchange all write individual_finances or organizations. Nothing is off the '
      + 'books, because there are no books to be off: an informal economy needs a formal one '
      + 'to be outside of, and a way to transact without being recorded.',
  },

  // ---- housing -------------------------------------------------------
  {
    key: 'housing_condition', category: 'housing', unit: 'index', scope: 'community',
    compute: (ctx) => round(mean(propertiesIn(ctx)
      .map((p) => Number(p.condition))
      .filter((c) => Number.isFinite(c))), 2),
  },
  {
    key: 'mean_property_value', category: 'housing', unit: 'currency', scope: 'community',
    compute: (ctx) => round(mean(propertiesIn(ctx)
      .map((p) => property.currentValue(p))
      .filter((v) => Number.isFinite(v))), 2),
  },
  {
    key: 'vacancy_rate', category: 'housing', unit: 'share', scope: 'community',
    compute: (ctx) => {
      // A standing home nobody lives in. `properties.lifecycle_stage`
      // has no 'abandoned' value, so vacancy is read from occupancy —
      // a residential property in `operation` that no living resident
      // calls home.
      const standing = propertiesIn(ctx).filter(
        (p) => p.lifecycle_stage === 'operation' && p.type === 'residential',
      );
      if (standing.length === 0) return null;
      const lived = new Set(ctx.worldState.npcs
        .map((n) => n.home_property_id)
        .filter((id) => id !== null && id !== undefined));
      return share(standing.filter((p) => !lived.has(p.id)).length, standing.length);
    },
  },
  {
    key: 'residential_share', category: 'housing', unit: 'share', scope: 'community',
    compute: (ctx) => {
      const all = propertiesIn(ctx);
      return share(all.filter((p) => p.type === 'residential').length, all.length);
    },
  },
  {
    key: 'mean_land_size', category: 'housing', unit: 'count', scope: 'community',
    compute: (ctx) => round(mean(propertiesIn(ctx)
      .map((p) => Number(p.land_size))
      .filter((s) => Number.isFinite(s))), 2),
  },

  // ---- crime ---------------------------------------------------------
  {
    key: 'crime_rate_per_1k', category: 'crime', unit: 'rate_per_1k', scope: 'community',
    compute: (ctx) => crime.ratePer1k(ctx.worldState, ctx.communityId),
  },
  // One entry per category, generated from crime.js's own list so the
  // two can never disagree about what the categories are.
  ...crime.CRIME_CATEGORIES.map((category) => ({
    key: `${category}_crime_per_1k`,
    category: 'crime',
    unit: 'rate_per_1k',
    scope: 'community',
    compute: (ctx) => per1k(
      crime.countsByCategory(ctx.worldState, ctx.communityId)[category],
      ctx.population,
    ),
    // A category nothing generates still reports a real 0 — no
    // incidents of it were recorded — and the note says why that 0
    // cannot be read as a measurement.
    caveat: crime.CATEGORIES[category].generated
      ? undefined
      : `nothing in the engine generates this category: ${crime.CATEGORIES[category].substrate}`,
  })),

  {
    key: 'clearance_rate', category: 'crime', unit: 'share', scope: 'community',
    // **Over INVESTIGATED cases, not over all of them.** A case
    // committed yesterday has not been solved and has not been failed;
    // counting it as unsolved would make an area's clearance rate a
    // function of how recently somebody looked.
    compute: (ctx) => policing.clearanceRate(ctx.worldState, ctx.communityId),
  },
  {
    key: 'open_cases_per_1k', category: 'crime', unit: 'rate_per_1k', scope: 'community',
    compute: (ctx) => per1k(
      policing.caseload(ctx.worldState, ctx.communityId).open, ctx.population,
    ),
  },

  // ---- organization --------------------------------------------------
  {
    key: 'organizations_present', category: 'organization', unit: 'count', scope: 'community',
    compute: (ctx) => membership.organizationPresence(ctx.worldState, ctx.communityId).length,
  },
  {
    key: 'gang_membership_rate', category: 'organization', unit: 'share', scope: 'community',
    compute: (ctx) => membership.gangMembershipRate(ctx.worldState, ctx.communityId),
  },
  {
    key: 'max_organization_influence', category: 'organization', unit: 'index', scope: 'community',
    compute: (ctx) => {
      const values = membership.organizationPresence(ctx.worldState, ctx.communityId)
        .map((o) => Number(o.influence))
        .filter((v) => Number.isFinite(v));
      return values.length === 0 ? null : Math.max(...values);
    },
  },

  // ---- territory -----------------------------------------------------
  {
    key: 'blocks_held', category: 'territory', unit: 'count', scope: 'community',
    compute: (ctx) => (ctx.worldState.territoryBlocks || [])
      .filter((b) => b.community_id === ctx.communityId).length,
  },
  {
    key: 'contested_block_share', category: 'territory', unit: 'share', scope: 'community',
    compute: (ctx) => {
      const blocks = (ctx.worldState.territoryBlocks || [])
        .filter((b) => b.community_id === ctx.communityId);
      return share(blocks.filter((b) => b.status === 'contested').length, blocks.length);
    },
  },
  {
    key: 'factions_holding_territory', category: 'territory', unit: 'count', scope: 'community',
    compute: (ctx) => new Set((ctx.worldState.territoryBlocks || [])
      .filter((b) => b.community_id === ctx.communityId)
      .map((b) => b.faction_id)).size,
  },

  // ---- surveillance --------------------------------------------------
  {
    key: 'camera_coverage', category: 'surveillance', unit: 'share', scope: 'community',
    unavailable: 'no camera, sensor or observation device exists anywhere in the schema.',
  },
  {
    key: 'patrol_frequency', category: 'surveillance', unit: 'rate_per_1k', scope: 'community',
    // **This was the reason the whole SURVEILLANCE block read zero.**
    // The declared gap said "the policing half of runSecurityPhase does
    // nothing", and server/policing.js is that half. Read from the
    // public_safety capacity that actually does the investigating,
    // rather than from a second number that could disagree with it.
    compute: (ctx) => policing.patrolsPer1k(ctx.worldState, ctx.communityId),
  },
  {
    key: 'street_lighting', category: 'surveillance', unit: 'index', scope: 'community',
    unavailable: '`infrastructure.type` enumerates ten kinds and lighting is not one. The '
      + 'nearest is `electricity`, which is supply rather than street-level coverage.',
  },
  {
    key: 'private_security_presence', category: 'surveillance', unit: 'share', scope: 'community',
    unavailable: 'organizations have a `security` NUMERIC trait, which is an organization\'s '
      + 'own defensive capacity, not a service it sells into an area. Nothing sells one.',
  },

  // ---- community facilities ------------------------------------------
  // **These three were declared unavailable and are now computed.**
  // The reason was the same for each — `infrastructure` is a
  // schema-only table with no WorldState array, so nothing ever
  // created a row, summing an empty list gave 0 capacity, and every
  // area in every world reported "no schools" as a measurement.
  // `server/infrastructure.js` is the array and the generator.
  //
  // `capacityOf` returns null rather than 0 both when nothing of a
  // type exists and when it exists with no stated capacity, which is
  // the distinction the original defect collapsed.
  {
    key: 'school_capacity_per_1k', category: 'community', unit: 'rate_per_1k', scope: 'city',
    compute: (ctx) => {
      if (ctx.cityId === null) return null;
      const capacity = infrastructure.capacityOf(ctx.worldState, ctx.cityId, 'schools');
      return capacity === null ? null : per1k(capacity, ctx.population);
    },
  },
  {
    key: 'hospital_capacity_per_1k', category: 'community', unit: 'rate_per_1k', scope: 'city',
    compute: (ctx) => {
      if (ctx.cityId === null) return null;
      const capacity = infrastructure.capacityOf(ctx.worldState, ctx.cityId, 'hospitals');
      return capacity === null ? null : per1k(capacity, ctx.population);
    },
  },
  {
    key: 'public_safety_capacity_per_1k', category: 'community', unit: 'rate_per_1k', scope: 'city',
    compute: (ctx) => {
      if (ctx.cityId === null) return null;
      const capacity = infrastructure.capacityOf(ctx.worldState, ctx.cityId, 'public_safety');
      return capacity === null ? null : per1k(capacity, ctx.population);
    },
  },
  {
    key: 'infrastructure_condition', category: 'community', unit: 'index', scope: 'city',
    compute: (ctx) => (ctx.cityId === null
      ? null
      : infrastructure.cityCondition(ctx.worldState, ctx.cityId)),
  },
  {
    key: 'infrastructure_failure_risk', category: 'community', unit: 'share', scope: 'city',
    // The worst thing standing, not the average — a city whose water
    // system is about to fail is not reassured by its roads. Same
    // reasoning `mortality.survivalScarcity` uses for essentials.
    compute: (ctx) => {
      if (ctx.cityId === null) return null;
      const risks = infrastructure.infrastructureIn(ctx.worldState, ctx.cityId)
        .map((row) => infrastructure.failureRisk(row))
        .filter((r) => r !== null);
      return risks.length === 0 ? null : Math.max(...risks);
    },
  },
  // ---- environment ---------------------------------------------------
  {
    key: 'resource_scarcity', category: 'environment', unit: 'index', scope: 'city',
    compute: (ctx) => {
      if (ctx.cityId === null) return null;
      const local = (ctx.worldState.resources || []).filter((r) => r.city_id === ctx.cityId);
      if (local.length === 0) return null;
      return round(mean(local.map((r) => economy.getScarcity(r))), 2);
    },
  },
  {
    key: 'survival_scarcity', category: 'environment', unit: 'share', scope: 'world',
    compute: (ctx) => round(ctx.scarcity),
  },
  {
    key: 'disease_pressure', category: 'environment', unit: 'index', scope: 'world',
    compute: (ctx) => round(ctx.pressure, 3),
  },
  {
    key: 'active_conditions', category: 'environment', unit: 'count', scope: 'world',
    compute: (ctx) => (ctx.worldState.activeConditions || []).length,
  },
  {
    key: 'pollution', category: 'environment', unit: 'index', scope: 'community',
    unavailable: '`environment_state` is a schema-only table with weather, climate and '
      + 'disasters and no pollution column; `cities` has none either. Nothing emits.',
  },
  {
    key: 'terrain_and_water', category: 'environment', unit: 'share', scope: 'community',
    unavailable: '§9 asks for woods, rivers, lakes and flood zones. `regions.geography_key` '
      + 'and `regions.climate_key` are the only geography in the schema, both TEXT, both '
      + 'written by nothing. dev-docs/LAND_AND_MAP_DATA.md names the real sources — USGS '
      + '3DEP, the National Hydrography Dataset, NLCD and FEMA flood zones.',
  },

  // ---- psychological -------------------------------------------------
  {
    key: 'mean_stress', category: 'psychological', unit: 'index', scope: 'community',
    compute: (ctx) => {
      // Only people who have actually been observed. An unobserved
      // resident counted as 0 would report a calm neighbourhood
      // because nothing has happened to anybody in it yet — the
      // unknown-is-not-a-zero rule, in the exact place it shipped
      // wrong once already.
      const levels = ctx.residents
        .map((n) => (ctx.worldState.entityState || []).find((s) => s.entity_id === n.id))
        .filter((s) => s && s.stress_level !== null && s.stress_level !== undefined)
        .map((s) => Number(s.stress_level))
        .filter((v) => Number.isFinite(v));
      return round(mean(levels), 2);
    },
  },
  {
    key: 'observed_share', category: 'psychological', unit: 'share', scope: 'community',
    compute: (ctx) => {
      // How much of the area `mean_stress` is actually speaking for.
      // A mood figure drawn from 3 of 400 residents is not wrong, it
      // is thin, and the difference is invisible unless something
      // reports it.
      const observed = ctx.residents.filter(
        (n) => (ctx.worldState.entityState || []).some((s) => s.entity_id === n.id),
      ).length;
      return share(observed, ctx.population);
    },
  },
  {
    key: 'public_safety_trust', category: 'psychological', unit: 'index', scope: 'community',
    // The declared gap said `beliefs` could carry this attitude and
    // the institution it would be about did not exist. It does now,
    // and this reads the belief rather than deriving one: a formula
    // over the clearance rate would be the clearance rate under a name
    // promising something else. Null where nothing has happened yet —
    // unknown, not neutral.
    compute: (ctx) => policing.trustIn(ctx.worldState, ctx.communityId),
  },
  {
    key: 'harmful_habit_share', category: 'psychological', unit: 'share', scope: 'community',
    // Substance use, as this engine actually models it. `habits.harmful`
    // is the schema's own flag — the architecture document's "addiction
    // = harmful habit, not a separate table" — and `behavior.js` forms
    // one out of sustained stress.
    //
    // **Psychological rather than crime**, because that is where it
    // comes from here: nothing in this engine makes a harmful habit an
    // offence, and filing it under crime would import a claim the model
    // does not make. It sits beside `mean_stress`, which is what
    // produces it.
    caveat: 'formed from sustained stress in server/behavior.js, which peaks near 55 against a '
      + 'threshold of 60 — so a settled world produces very few (4.9% measured) and this '
      + 'reading is bounded by the stress model rather than by anything about substances',
    compute: (ctx) => health.harmfulHabitShare(ctx.worldState, ctx.residents),
  },
  {
    key: 'mean_need_satisfaction', category: 'psychological', unit: 'index', scope: 'community',
    // How well this settlement is meeting what its people actually
    // want, across all fifteen needs. `server/motivation.js` built the
    // needs, the values and the goals, and nothing measured any of them
    // — the same shape the health family was in.
    compute: (ctx) => motivation.meanNeedLevel(ctx.worldState, ctx.residents.map((n) => n.id)),
  },
  {
    key: 'mean_food_security', category: 'psychological', unit: 'index', scope: 'community',
    // Singled out from the fifteen because it is the one need with a
    // resource behind it, and because it is the closest this engine can
    // honestly come to the nutrition question `body_composition`
    // declines to answer. It moves with both halves: the city's food
    // supply, and whether this person keeps the routine.
    compute: (ctx) => {
      const levels = ctx.residents
        .map((n) => motivation.needOf(ctx.worldState, n.id, 'food'))
        .filter((row) => row !== null)
        .map((row) => Number(row.current_level))
        .filter(Number.isFinite);
      return round(mean(levels), 2);
    },
  },
];

const KEYS = CATALOGUE.map((s) => s.key);
const BY_KEY = new Map(CATALOGUE.map((s) => [s.key, s]));

// -- the profile --------------------------------------------------------

// Every statistic for one area, in a fixed shape. Same keys, always,
// in the same order — that is the property that makes two areas
// comparable and makes this catalogue portable to any world.
function profileFor(worldState, communityId, shared = {}) {
  const ctx = contextFor(worldState, communityId, shared);
  const statistics = {};

  for (const definition of CATALOGUE) {
    if (definition.unavailable) {
      statistics[definition.key] = {
        value: null,
        known: false,
        unit: definition.unit,
        category: definition.category,
        scope: definition.scope,
        reason: definition.unavailable,
      };
      continue;
    }
    const value = definition.compute(ctx);
    statistics[definition.key] = {
      // `undefined` would serialise away entirely and read as a
      // missing key rather than an unknown value, so it is normalised.
      value: value === undefined ? null : value,
      known: value !== null && value !== undefined,
      unit: definition.unit,
      category: definition.category,
      scope: definition.scope,
      ...(definition.caveat ? { caveat: definition.caveat } : {}),
    };
  }

  return { communityId, tick: ctx.tick, population: ctx.population, statistics };
}

// Every area, with the world-level work done once.
function profileAll(worldState, options = {}) {
  const shared = {
    tick: options.tick ?? worldState.tick ?? 0,
    line: areaStats.povertyLine(worldState),
    scarcity: mortality.survivalScarcity(worldState),
    pressure: mortality.diseasePressure(worldState),
  };
  return worldState.communities.map((c) => profileFor(worldState, c.id, shared));
}

// -- comparison ---------------------------------------------------------

function standardDeviation(values, m) {
  if (values.length < 2) return null;
  const variance = values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Where each area sits against every other, per statistic.
//
// **Nulls are dropped, never zeroed.** An area with no residents has
// no poverty rate; folding it in as 0 would drag the world mean down
// and make every inhabited area look poorer by comparison than it is.
// `n` reports how many areas each statistic could actually be computed
// for, so a z-score drawn from three areas is visibly not one drawn
// from three hundred.
//
// A `count` or `currency` statistic is reported with its values and no
// z-scores: totals cannot rank areas of different sizes, and this
// world's currency has no denomination.
function compare(worldState, options = {}) {
  const profiles = options.profiles ?? profileAll(worldState, options);
  const keys = options.keys ?? KEYS;
  const rows = {};

  for (const key of keys) {
    const definition = BY_KEY.get(key);
    if (!definition) throw new Error(`compare: no statistic "${key}"`);

    const values = [];
    for (const profile of profiles) {
      const cell = profile.statistics[key];
      if (cell && cell.known) values.push({ communityId: profile.communityId, value: cell.value });
    }

    const numbers = values.map((v) => v.value);
    const m = mean(numbers);
    const sd = standardDeviation(numbers, m ?? 0);
    const comparable = UNITS[definition.unit].comparable;

    rows[key] = {
      unit: definition.unit,
      category: definition.category,
      scope: definition.scope,
      comparable,
      n: numbers.length,
      mean: round(m, 4),
      median: round(median(numbers), 4),
      min: numbers.length ? Math.min(...numbers) : null,
      max: numbers.length ? Math.max(...numbers) : null,
      stdev: round(sd, 4),
      areas: values.map((v) => ({
        communityId: v.communityId,
        value: v.value,
        // **Null rather than 0 when there is nothing to compare
        // against.** A z of 0 says "exactly average"; one area, or a
        // world where every area is identical, has no average to be at.
        z: comparable && sd !== null && sd > 0 ? round((v.value - m) / sd, 3) : null,
        percentile: comparable && numbers.length > 1
          ? round(numbers.filter((x) => x < v.value).length / (numbers.length - 1), 3)
          : null,
      })),
    };
  }

  return rows;
}

// Pearson correlation between two statistics across areas.
//
// **This is the "compare the stats to the environment" read.** Ask
// whether poverty tracks violent crime, whether resource scarcity
// tracks the death rate, whether school capacity tracks employment —
// across every area in the world, from the same catalogue, so the
// answer is about the world rather than about two hand-picked blocks.
//
// Three refusals, each of which would otherwise produce a number that
// looks like evidence:
//
//   * a non-comparable unit on either side — a raw count against a
//     share is a comparison between an area's size and its character;
//   * fewer than three areas with both values known;
//   * zero variance on either side, where the correlation is undefined
//     and the naive formula divides by zero.
//
// And it reports both scopes. Correlating a community-scoped statistic
// against a city-scoped one across communities in ONE city is
// correlating a variable against a constant — which the zero-variance
// refusal catches — but across several cities it is real, and the
// caller should be able to see which situation they are in.
function correlate(worldState, keyA, keyB, options = {}) {
  const a = BY_KEY.get(keyA);
  const b = BY_KEY.get(keyB);
  if (!a) throw new Error(`correlate: no statistic "${keyA}"`);
  if (!b) throw new Error(`correlate: no statistic "${keyB}"`);

  const base = {
    a: keyA, b: keyB, scopeA: a.scope, scopeB: b.scope, n: 0, r: null,
  };

  if (!UNITS[a.unit].comparable || !UNITS[b.unit].comparable) {
    return { ...base, refused: `${keyA} is ${a.unit} and ${keyB} is ${b.unit}; only `
      + `${Object.keys(UNITS).filter((u) => UNITS[u].comparable).join('/')} statistics compare` };
  }

  const profiles = options.profiles ?? profileAll(worldState, options);
  const pairs = [];
  for (const profile of profiles) {
    const cellA = profile.statistics[keyA];
    const cellB = profile.statistics[keyB];
    if (cellA?.known && cellB?.known) pairs.push([cellA.value, cellB.value]);
  }

  if (pairs.length < 3) {
    return { ...base, n: pairs.length, refused: 'fewer than three areas have both values' };
  }

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) {
    return {
      ...base,
      n: pairs.length,
      refused: `${dx === 0 ? keyA : keyB} is the same in every area, so there is no `
        + 'variance to correlate against',
    };
  }

  return { ...base, n: pairs.length, r: round(num / Math.sqrt(dx * dy), 4) };
}

// The environment an area sits in, beside its statistics.
//
// Separate from the profile on purpose: these are conditions rather
// than measurements of the area, and most of them are shared with
// every other area in the same city or world. Presenting them inside
// the profile would invite exactly the mistake the scope field exists
// to prevent.
function environmentFor(worldState, communityId) {
  const ctx = contextFor(worldState, communityId);
  const city = ctx.cityId === null
    ? null
    : (worldState.cities || []).find((c) => c.id === ctx.cityId) || null;

  return {
    communityId,
    cityId: ctx.cityId,
    cityName: city?.name ?? null,
    // The only real-world geographic reference the schema carries. It
    // is set by `territory.generateCity` from an option and is null in
    // every generated world — which is the honest state of geography
    // here and the reason the land/map document exists.
    realWorldGeoRef: city?.real_world_geo_ref ?? null,
    reemergenceIndex: city?.reemergence_index ?? null,
    survivalScarcity: round(ctx.scarcity),
    diseasePressure: round(ctx.pressure, 3),
    activeConditions: (worldState.activeConditions || []).map((c) => ({
      type: c.type, resourceType: c.resourceType, ticksRemaining: c.ticksRemaining,
    })),
    resources: (worldState.resources || [])
      .filter((r) => ctx.cityId !== null && r.city_id === ctx.cityId)
      .map((r) => ({
        type: r.resource_type,
        scarcity: round(economy.getScarcity(r), 2),
        supply: r.supply,
        demand: r.demand,
      })),
  };
}

// What this catalogue cannot answer and why, as one list rather than
// scattered through the entries. Useful to a dashboard that wants to
// show the gaps as gaps.
function unavailable() {
  return CATALOGUE
    .filter((s) => s.unavailable)
    .map((s) => ({ key: s.key, category: s.category, reason: s.unavailable }));
}

module.exports = {
  CATEGORIES,
  UNITS,
  SCOPES,
  CATALOGUE,
  KEYS,
  profileFor,
  profileAll,
  compare,
  correlate,
  environmentFor,
  unavailable,
};
