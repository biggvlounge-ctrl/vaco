// One catalogue, every area answering all of it.
//
// **What was asked for, and what follows from it.** Statistics in every
// category, in the same shape everywhere, so the same measurement can
// be taken of any area in any world and the numbers line up against
// each other and against the environment those areas sit in.
//
// That is a stronger requirement than "compute some statistics", and
// the three properties it forces are what most of this file tests:
// every area returns every key, unknown is never a zero, and counts do
// not compare while rates do. A statistic that appears for one area
// and not another, or reports 0 for something it cannot measure, or
// ranks a 40-person block against a 4,000-person district on totals,
// breaks comparability in a way no amount of correct arithmetic
// downstream can repair.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const statistics = require('../server/statistics.js');
const areaStats = require('../server/areaStats.js');
const crime = require('../server/crime.js');
const economy = require('../server/economy.js');
const infrastructure = require('../server/infrastructure.js');
const membership = require('../server/membership.js');
const mortality = require('../server/mortality.js');
const property = require('../server/property.js');
const territory = require('../server/territory.js');

let nextId = 40000;

function world({ tick = 36500 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    communities: [],
    cities: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    entityTraits: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    crimeIncidents: [],
    territoryBlocks: [],
    properties: [],
    ownershipRecords: [],
    resources: [],
    marketListings: [],
    infrastructure: [],
    languages: [],
    entityLanguages: [],
    // Property ids come from the shared entity counter so a property
    // can be an `ownership_records.entity_id` — property.js refuses to
    // generate one without it.
    beliefs: [],
    nextEntityId: 1,
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  crime.reseedIds(worldState);
  property.reseedIds(worldState);
  infrastructure.reseedIds(worldState);
  return worldState;
}

function person(worldState, { communityId = null, savings = 100, age = 30 } = {}) {
  const npc = {
    id: nextId++,
    status: 'active',
    communityId,
    home_property_id: null,
    createdTick: worldState.tick - Math.round(age * mortality.TICKS_PER_YEAR),
    updatedTick: worldState.tick,
    generation: 1,
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings, tick: worldState.tick });
  return npc;
}

// -- the shape that makes areas comparable ------------------------------

test('every area returns every key, whatever is in it', () => {
  // **The property the whole catalogue rests on.** An object built only
  // from the statistics that happened to be computable gives a quiet
  // block nine keys and a violent one twenty, and no comparison across
  // them lines up.
  const w = world();
  const busy = territory.generateCommunity(w, {});
  const empty = territory.generateCommunity(w, {});
  for (let i = 0; i < 5; i += 1) person(w, { communityId: busy.id });

  const a = statistics.profileFor(w, busy.id);
  const b = statistics.profileFor(w, empty.id);

  assert.deepEqual(Object.keys(a.statistics), Object.keys(b.statistics));
  assert.deepEqual(Object.keys(a.statistics), statistics.KEYS);
  assert.ok(statistics.KEYS.length > 40, 'the catalogue looks empty');
});

test('an empty area reports unknown, never zero', () => {
  // Reporting 0 says nobody there is poor and nobody is in a gang,
  // which is the opposite of what an empty area means.
  const w = world();
  const empty = territory.generateCommunity(w, {});
  const profile = statistics.profileFor(w, empty.id);

  for (const key of ['poverty_rate', 'employment_rate', 'mean_age', 'gang_membership_rate',
    'crime_rate_per_1k', 'violent_crime_per_1k']) {
    assert.equal(profile.statistics[key].value, null, `${key} reported a number for nobody`);
    assert.equal(profile.statistics[key].known, false);
  }
  // Population itself is a real zero — there really are no people.
  assert.equal(profile.statistics.population.value, 0);
  assert.equal(profile.statistics.population.known, true);
});

test('every entry declares a category, a unit and a scope that exist', () => {
  for (const definition of statistics.CATALOGUE) {
    assert.ok(statistics.CATEGORIES.includes(definition.category),
      `${definition.key} has category "${definition.category}"`);
    assert.ok(statistics.UNITS[definition.unit], `${definition.key} has unit "${definition.unit}"`);
    assert.ok(statistics.SCOPES.includes(definition.scope),
      `${definition.key} has scope "${definition.scope}"`);
    // Exactly one of the two: a computation or a declared absence.
    const hasCompute = typeof definition.compute === 'function';
    const hasReason = typeof definition.unavailable === 'string';
    assert.notEqual(hasCompute, hasReason,
      `${definition.key} must either compute or say why it cannot, not both or neither`);
  }
});

test('every category §9 names has at least one entry', () => {
  // A category with no entries would read as "we have nothing to say
  // about surveillance here", which is different from "surveillance is
  // unmodelled and here is what it would need".
  const covered = new Set(statistics.CATALOGUE.map((s) => s.category));
  for (const category of statistics.CATEGORIES) {
    assert.ok(covered.has(category), `no statistic belongs to the "${category}" block`);
  }
});

test('no key appears twice', () => {
  assert.equal(new Set(statistics.KEYS).size, statistics.KEYS.length);
});

// -- the honest absences ------------------------------------------------

test('every unavailable statistic names its missing substrate', () => {
  const missing = statistics.unavailable();

  // **This used to assert `> 8`, an arbitrary floor meant to catch an
  // emptied list, and it started failing as gaps were closed** — which
  // is a test punishing the work it exists to support. The real
  // invariant is consistency: `unavailable()` reports exactly the
  // entries the catalogue declares, no more and no fewer, so neither
  // can drift from the other.
  const declaredInCatalogue = statistics.CATALOGUE
    .filter((d) => d.unavailable)
    .map((d) => d.key)
    .sort();
  assert.deepEqual(missing.map((e) => e.key).sort(), declaredInCatalogue);
  for (const entry of missing) {
    assert.ok(entry.reason.length > 60, `${entry.key} has no real explanation`);
  }
  // §9's constraint travels with the entry rather than living only in
  // a header nobody reads at the call site. Two entries have carried it
  // in turn and both are gone: `demographic_composition` first, because
  // language, religion and education are computed now, and then
  // `race_and_ethnicity_composition`, whose own declaration said adding
  // the field was "a decision to take explicitly" — the owner took it
  // on 17 Sep 2026.
  //
  // **So the clause is no longer a reason string at all, and that is
  // the point.** It is `test/ethnicity.test.js`, which asserts that no
  // module deciding whether somebody offends, is caught, works, earns,
  // dies, or is capable of anything reads the field. A declared absence
  // was the weaker guarantee; this is the stronger one.
  assert.equal(missing.some((e) => e.key === 'race_and_ethnicity_composition'), false,
    'the ethnicity gap is declared again — if the field was removed, the §9 firewall in '
    + 'test/ethnicity.test.js needs to go with it');

  // The clause still has to be written down beside something. It is on
  // `body_composition` now, which is the live deliberate absence: the
  // reason it is declared is that the index buildable from this
  // engine's substrate splits a population at the employment line.
  const body = missing.find((e) => e.key === 'body_composition');
  assert.ok(body, 'nothing in the catalogue carries §9\'s demographic clause any more');
  assert.match(body.reason, /demographic clause/);
});

test('infrastructure capacity is null when nothing exists, not zero', () => {
  // **This test used to assert the opposite and the opposite was
  // right.** `infrastructure` was a schema-only table with no
  // WorldState array, so these three summed an empty list, got 0
  // capacity, and every area in every world reported "no schools" as a
  // measurement. server/infrastructure.js is the array; what survives
  // is the distinction the original defect collapsed — a city with no
  // schools and a city whose schools have no stated capacity are both
  // unknown, and neither is zero.
  const w = world();
  const city = territory.generateCity(w, { name: 'Testbed' });
  const c = territory.generateCommunity(w, { cityId: city.id });
  for (let i = 0; i < 10; i += 1) person(w, { communityId: c.id });

  let s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.school_capacity_per_1k.value, null, 'a city with no schools reported a rate');
  assert.equal(s.infrastructure_condition.value, null);

  // Exists, no capacity recorded: still unknown.
  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools', condition: 80 });
  s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.school_capacity_per_1k.value, null, 'a school with no stated capacity reported one');
  assert.equal(s.infrastructure_condition.value, 80, 'condition is known even when capacity is not');

  // Stated: a real rate.
  infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'schools', capacity: 400, condition: 60,
  });
  s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.school_capacity_per_1k.value, 40000, '400 places for 10 residents');
  assert.equal(s.infrastructure_condition.value, 70);
});

test('a crime category nothing generates carries a caveat on its zero', () => {
  // The zero is real — no incidents of that category were recorded —
  // and it cannot be read as a measurement, because nothing in the
  // engine could ever produce one. Both facts have to travel together.
  const w = world();
  const c = territory.generateCommunity(w, {});
  person(w, { communityId: c.id });
  const profile = statistics.profileFor(w, c.id);

  // `gun` used to be the example here, then `drug`, then `fraud` — all
  // three are generated now, so the caveat moved to the one category
  // that is deliberately and permanently ungenerated rather than
  // waiting on an object to falsify or hold. The point of the test is
  // unchanged: a zero that means "nobody did it" and a zero that means
  // "we do not model this" have to be distinguishable.
  assert.equal(profile.statistics.sex_offense_crime_per_1k.value, 0);
  assert.match(profile.statistics.sex_offense_crime_per_1k.caveat, /nothing in the engine generates/);
  assert.equal(profile.statistics.violent_crime_per_1k.caveat, undefined,
    'violent crime IS generated and should carry no caveat');
  assert.equal(profile.statistics.gun_crime_per_1k.caveat, undefined,
    'gun crime is generated now that inventory exists');
  assert.equal(profile.statistics.drug_crime_per_1k.caveat, undefined,
    'drug crime is generated now that server/drugs.js exists');
  assert.equal(profile.statistics.fraud_crime_per_1k.caveat, undefined,
    'fraud is generated now that a falsified position claim exists');
  assert.equal(profile.statistics.drug_crime_per_1k.caveat, undefined,
    'drug crime is generated now that server/drugs.js exists');
});

test('informal_economy_share is null with nothing moving, and real once something does', () => {
  const w = world();
  w.informalTransactions = [];
  const c = territory.generateCommunity(w, {});
  const seller = person(w, { communityId: c.id });
  const buyer = person(w, { communityId: c.id });

  // Nobody employed and nothing informal has moved — a share of
  // nothing is not a measurement.
  assert.equal(statistics.profileFor(w, c.id).statistics.informal_economy_share.value, null);

  const employer = { id: nextId++, type: 'business', assets: 100000, expenses: 0 };
  w.organizations.push(employer);
  economy.hireEntity(w, { entityId: seller.id, employerOrganizationId: employer.id, wage: 80 });

  w.informalTransactions.push({ id: 1, sellerId: seller.id, buyerId: buyer.id, amount: 20, tick: w.tick });

  const share = statistics.profileFor(w, c.id).statistics.informal_economy_share.value;
  // 20 informal against 80 formal wage = 20/(20+80) = 0.2.
  assert.equal(share, 0.2);
});

test('informal_economy_share only counts a resident’s own transactions, and only recent ones', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const resident = person(w, { communityId: c.id });
  const outsider1 = person(w, {});
  const outsider2 = person(w, {});

  w.informalTransactions = [
    // Neither side is a resident of this community.
    { id: 1, sellerId: outsider1.id, buyerId: outsider2.id, amount: 999, tick: w.tick },
    // A resident, but far outside the statistic's own window.
    { id: 2, sellerId: resident.id, buyerId: outsider1.id, amount: 999, tick: w.tick - 10000 },
    // A resident, recent — the one that should count.
    { id: 3, sellerId: resident.id, buyerId: outsider1.id, amount: 20, tick: w.tick },
  ];

  const share = statistics.profileFor(w, c.id).statistics.informal_economy_share.value;
  // No formal wages at all, so an entirely informal economy reads as 1.
  assert.equal(share, 1);
});

test('the crime entries come from crime.js, so the two cannot disagree', () => {
  const fromCatalogue = statistics.CATALOGUE
    .filter((s) => s.category === 'crime' && s.key.endsWith('_crime_per_1k'))
    .map((s) => s.key.replace('_crime_per_1k', ''))
    .sort();
  assert.deepEqual(fromCatalogue, [...crime.CRIME_CATEGORIES].sort());
});

// -- the statistics themselves ------------------------------------------

test('the computed statistics read real records', () => {
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  const c = territory.generateCommunity(w, { cityId: city.id });

  const a = person(w, { communityId: c.id, savings: 100, age: 20 });
  const b = person(w, { communityId: c.id, savings: 300, age: 40 });
  const kid = person(w, { communityId: c.id, savings: 0, age: 10 });
  const elder = person(w, { communityId: c.id, savings: 200, age: 70 });

  const employer = { id: nextId++, name: 'Mill', type: 'business', assets: 100000, expenses: 0, influence: 60 };
  w.organizations.push(employer);
  economy.hireEntity(w, { entityId: a.id, employerOrganizationId: employer.id, wage: 10 });
  economy.hireEntity(w, { entityId: b.id, employerOrganizationId: employer.id, wage: 30 });
  membership.joinOrganization(w, { entityId: a.id, organizationId: employer.id });

  crime.recordCrime(w, { category: 'violent', perpetratorId: b.id, victimId: a.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: kid.id, victimId: elder.id });

  const s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.population.value, 4);
  assert.equal(s.mean_age.value, 35);
  assert.equal(s.employment_rate.value, 0.5);
  assert.equal(s.median_wage.value, 20);
  assert.equal(s.minor_share.value, 0.25);
  assert.equal(s.elder_share.value, 0.25);
  assert.equal(s.crime_rate_per_1k.value, 500);
  assert.equal(s.violent_crime_per_1k.value, 250);
  assert.equal(s.theft_crime_per_1k.value, 250);
  assert.equal(s.business_density_per_1k.value, 250);
  assert.equal(s.max_organization_influence.value, 60);
});

test('housing statistics read a property\'s community, which nothing read before', () => {
  // `properties.community_id` was set by `generateProperty` and read by
  // nothing — `schema-extensions.sql` recorded it as considered and
  // deliberately not added, with the reason stated as a condition: the
  // bar is a field the engine READS. This is the read that spent it.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  const here = territory.generateCommunity(w, { cityId: city.id });
  const there = territory.generateCommunity(w, { cityId: city.id });

  const home = property.generateProperty(w, {
    type: 'residential', value: 1000, condition: 80, landSize: 500,
    lifecycleStage: 'operation', communityId: here.id, cityId: city.id,
  });
  property.generateProperty(w, {
    type: 'residential', value: 1000, condition: 40, landSize: 100,
    lifecycleStage: 'operation', communityId: here.id, cityId: city.id,
  });
  property.generateProperty(w, {
    type: 'commercial', value: 5000, condition: 100,
    lifecycleStage: 'operation', communityId: there.id, cityId: city.id,
  });

  const resident = person(w, { communityId: here.id });
  resident.home_property_id = home.id;
  property.recordOwnership(w, {
    entityId: home.id, ownerEntityId: resident.id, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: w.tick,
  });

  const s = statistics.profileFor(w, here.id).statistics;
  assert.equal(s.housing_condition.value, 60, 'the neighbouring block\'s property leaked in');
  assert.equal(s.residential_share.value, 1);
  assert.equal(s.mean_land_size.value, 300);
  assert.equal(s.vacancy_rate.value, 0.5, 'two standing homes, one lived in');
  assert.equal(s.home_ownership_rate.value, 1);

  assert.equal(statistics.profileFor(w, there.id).statistics.residential_share.value, 0);
});

test('mean stress speaks only for people who have been observed, and says how many', () => {
  // `Number(null)` is 0 and 0 is finite — the corollary that shipped
  // wrong in `moodFor()`. An unobserved resident folded in as 0 reports
  // a calm neighbourhood because nothing has happened to anybody in it.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const watched = person(w, { communityId: c.id });
  for (let i = 0; i < 3; i += 1) person(w, { communityId: c.id });
  w.entityState.push({ entity_id: watched.id, stress_level: 80, tick: w.tick });

  const s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.mean_stress.value, 80, 'the three unobserved residents were counted as calm');
  assert.equal(s.observed_share.value, 0.25);
});

// -- comparison ---------------------------------------------------------

test('comparison gives each area a z-score against the world, and drops unknowns', () => {
  const w = world();
  const poor = territory.generateCommunity(w, {});
  const middle = territory.generateCommunity(w, {});
  const rich = territory.generateCommunity(w, {});
  const empty = territory.generateCommunity(w, {});

  for (let i = 0; i < 5; i += 1) person(w, { communityId: poor.id, savings: 1 });
  for (let i = 0; i < 5; i += 1) person(w, { communityId: middle.id, savings: 100 });
  for (let i = 0; i < 5; i += 1) person(w, { communityId: rich.id, savings: 1000 });

  const rows = statistics.compare(w, { keys: ['poverty_rate'] });
  const row = rows.poverty_rate;

  assert.equal(row.n, 3, 'the empty area has no poverty rate and must not be counted as 0');
  const byArea = new Map(row.areas.map((a) => [a.communityId, a]));
  assert.equal(byArea.has(empty.id), false);
  assert.equal(byArea.get(poor.id).value, 1);
  assert.equal(byArea.get(rich.id).value, 0);
  assert.ok(byArea.get(poor.id).z > byArea.get(rich.id).z);
  assert.equal(byArea.get(poor.id).percentile, 1);
  assert.equal(byArea.get(rich.id).percentile, 0);
});

test('a count is reported and never given a z-score', () => {
  // **A 40-person block and a 4,000-person district cannot be ranked
  // on totals.** The unit is what carries that rule, not each caller
  // remembering it.
  const w = world();
  for (let i = 0; i < 3; i += 1) {
    const c = territory.generateCommunity(w, {});
    for (let j = 0; j <= i; j += 1) person(w, { communityId: c.id });
  }

  const rows = statistics.compare(w, { keys: ['population', 'population_share_of_world'] });
  assert.equal(rows.population.comparable, false);
  assert.equal(rows.population.areas.every((a) => a.z === null), true);
  assert.equal(rows.population.mean, 2, 'a count is still reported, just not ranked');

  assert.equal(rows.population_share_of_world.comparable, true);
  assert.equal(rows.population_share_of_world.areas.some((a) => a.z !== null), true);
});

test('one area, or a world where every area is identical, has no z-score', () => {
  // A z of 0 says "exactly average". With nothing to be average
  // against, that is a claim the data cannot support.
  const w = world();
  const only = territory.generateCommunity(w, {});
  person(w, { communityId: only.id, savings: 100 });
  const rows = statistics.compare(w, { keys: ['poverty_rate'] });
  assert.equal(rows.poverty_rate.n, 1);
  assert.equal(rows.poverty_rate.areas[0].z, null);
  assert.equal(rows.poverty_rate.areas[0].percentile, null);
});

test('comparing an unknown statistic is refused rather than silently empty', () => {
  const w = world();
  assert.throws(() => statistics.compare(w, { keys: ['literacy_rate'] }),
    /no statistic "literacy_rate"/);
});

// -- correlation, which is the "against the environment" read ------------

test('correlation finds a relationship that is really in the world', () => {
  // Areas built so poverty and theft move together on purpose: the
  // point is that the catalogue can SEE it across areas, from the same
  // keys, without anybody hand-picking two blocks.
  const w = world();
  const areas = [];
  for (let i = 0; i < 6; i += 1) {
    const c = territory.generateCommunity(w, {});
    areas.push(c);
    // **The SHARE of poor residents rises across the six, not
    // everybody's wealth.** The first version of this fixture lowered
    // every resident's savings area by area and got r = 0.65, which
    // looked like a weak correlation and was not: the poverty line is
    // the world median, so a uniform slide leaves five areas at a
    // poverty rate of exactly 0 and one at 1 — a step function, not a
    // gradient. Standing rule 8's shape, in a fixture rather than a
    // random trait: the test was measuring something other than what
    // it claimed.
    for (let j = 0; j < 10; j += 1) {
      person(w, { communityId: c.id, savings: j < i * 2 ? 1 : 1000 });
    }
  }
  // And thefts rise with the poverty, recorded explicitly rather than
  // generated, so the test is about the correlation and not about the
  // generator's rate.
  areas.forEach((c, i) => {
    const residents = areaStats.residentsOf(w, c.id);
    for (let k = 0; k < i; k += 1) {
      crime.recordCrime(w, {
        category: 'theft', perpetratorId: residents[0].id, victimId: residents[1].id,
      });
    }
  });

  const result = statistics.correlate(w, 'poverty_rate', 'theft_crime_per_1k');
  assert.equal(result.n, 6);
  assert.ok(result.r > 0.8, `expected a strong positive correlation, got ${result.r}`);
  assert.equal(result.scopeA, 'community');
  assert.equal(result.scopeB, 'community');
});

test('correlation refuses a count, too few areas, and a constant', () => {
  // Each refusal is a number that would otherwise look like evidence.
  const w = world();
  for (let i = 0; i < 4; i += 1) {
    const c = territory.generateCommunity(w, {});
    for (let j = 0; j < 3; j += 1) person(w, { communityId: c.id, savings: 100 });
  }

  const count = statistics.correlate(w, 'population', 'poverty_rate');
  assert.equal(count.r, null);
  assert.match(count.refused, /is count/);

  // Every area identical: poverty rate is the same everywhere, so
  // there is no variance to correlate against.
  const constant = statistics.correlate(w, 'poverty_rate', 'mean_age');
  assert.equal(constant.r, null);
  assert.match(constant.refused, /same in every area/);

  const thin = world();
  const one = territory.generateCommunity(thin, {});
  person(thin, { communityId: one.id });
  const few = statistics.correlate(thin, 'poverty_rate', 'mean_age');
  assert.equal(few.r, null);
  assert.match(few.refused, /fewer than three areas/);
});

test('correlating an unknown statistic is refused', () => {
  const w = world();
  assert.throws(() => statistics.correlate(w, 'poverty_rate', 'vibes'), /no statistic "vibes"/);
});

// -- the environment an area sits in ------------------------------------

test('the environment is reported beside the statistics, not inside them', () => {
  // Conditions rather than measurements of the area, and most of them
  // are shared with every other area in the same city or world.
  // Presenting them inside the profile would invite exactly the
  // mistake the scope field exists to prevent.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton', realWorldGeoRef: 'US-MO-STL' });
  const c = territory.generateCommunity(w, { cityId: city.id });
  person(w, { communityId: c.id });
  economy.generateResource(w, { cityId: city.id, resourceType: 'food', supply: 10, demand: 90 });
  mortality.addDiseaseOutbreak(w, { name: 'fever', mortalityMultiplier: 2, ticksRemaining: 5 });

  const env = statistics.environmentFor(w, c.id);
  assert.equal(env.cityId, city.id);
  assert.equal(env.cityName, 'Riverton');
  assert.equal(env.realWorldGeoRef, 'US-MO-STL');
  assert.equal(env.resources.length, 1);
  assert.equal(env.resources[0].type, 'food');
  assert.ok(env.resources[0].scarcity > 50, 'demand far exceeds supply');
  assert.ok(env.diseasePressure > 1, 'an outbreak should raise pressure above baseline');

  // And none of it leaked into the area's own statistics.
  const profile = statistics.profileFor(w, c.id);
  assert.equal('cityName' in profile.statistics, false);
});

test('a community with no city reports what it can and null for the rest', () => {
  const w = world();
  const orphan = territory.generateCommunity(w, {});
  person(w, { communityId: orphan.id });

  const env = statistics.environmentFor(w, orphan.id);
  assert.equal(env.cityId, null);
  assert.equal(env.realWorldGeoRef, null);
  assert.deepEqual(env.resources, []);
  assert.equal(statistics.profileFor(w, orphan.id).statistics.resource_scarcity.value, null);
});

// -- the whole world at once --------------------------------------------

test('profileAll covers every community and does the world work once', () => {
  const w = world();
  const a = territory.generateCommunity(w, {});
  const b = territory.generateCommunity(w, {});
  person(w, { communityId: a.id, savings: 10 });
  person(w, { communityId: b.id, savings: 1000 });

  const all = statistics.profileAll(w);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((p) => p.communityId), [a.id, b.id]);
  assert.equal(all[0].statistics.poverty_rate.value, 1);
  assert.equal(all[1].statistics.poverty_rate.value, 0);

  // The same profiles can be handed to compare and correlate rather
  // than recomputed, which is the only reason a 300-area world is
  // affordable to analyse.
  const rows = statistics.compare(w, { profiles: all, keys: ['poverty_rate'] });
  assert.equal(rows.poverty_rate.n, 2);
});
