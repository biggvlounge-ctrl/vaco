// Per-area statistics — and the residency that had to exist first.
//
// **The finding this suite records.** Asked whether every area carries
// statistics for crime, violent crime, sex crimes, gangs, teenage
// pregnancy, school dropout and poverty. Measured, the answer was no —
// and for a reason upstream of any of those fields: **nobody lived
// anywhere.** `generateNPC` set no community and no home;
// `entities.community_id` and `npcs.home_property_id` were in the
// schema from the start, written by nothing, and `home_property_id`
// was read in exactly one place — a death's location — so it was
// always null.
//
// Per-area statistics were therefore not missing, they were
// uncomputable. These tests are about the two halves of fixing that:
// people belong somewhere, and the statistics are derived rather than
// stored.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const areaStats = require('../server/areaStats.js');
const economy = require('../server/economy.js');
const mortality = require('../server/mortality.js');
const territory = require('../server/territory.js');
const { getTraitId } = require('../server/traitDefinitions.js');

function world({ tick = 36500 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    communities: [],
    organizations: [{ id: 100, type: 'business', assets: 100000, expenses: 0 }],
    families: [],
    entityTraits: [],
    entityKnowledge: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    resources: [],
    marketListings: [],
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  return worldState;
}

let nextId = 1;
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
  // Health traits so mortality can rate them if it is ever asked to.
  worldState.entityTraits.push({
    entity_id: npc.id,
    trait_id: getTraitId('health', 'Immune Response'),
    base_value: 50,
    current_value: 50,
    key_modifier: 0,
  });
  economy.generateIndividualFinances(worldState, npc.id, { savings, tick: worldState.tick });
  return npc;
}

// -- residency ----------------------------------------------------------

test('an NPC carries a community, and the unplaced are counted separately', () => {
  // **Never assigned to an arbitrary community.** Folding the unplaced
  // into one would make that community's statistics quietly wrong
  // rather than visibly incomplete.
  const w = world();
  const community = territory.generateCommunity(w, { tier: 'neighborhood' });
  const placed = person(w, { communityId: community.id });
  const drifter = person(w);

  assert.deepEqual(areaStats.residentsOf(w, community.id).map((n) => n.id), [placed.id]);
  assert.deepEqual(areaStats.unplaced(w).map((n) => n.id), [drifter.id]);
});

test('placing somebody requires a community that exists', () => {
  const w = world();
  const npc = person(w);
  assert.throws(() => areaStats.placeInCommunity(w, {
    entityId: npc.id, communityId: 999,
  }), /no community 999/);
  assert.throws(() => areaStats.placeInCommunity(w, {
    entityId: 999, communityId: null,
  }), /not among the living/);

  const community = territory.generateCommunity(w, {});
  areaStats.placeInCommunity(w, {
    entityId: npc.id, communityId: community.id, homePropertyId: 7,
  });
  assert.equal(npc.communityId, community.id);
  assert.equal(npc.home_property_id, 7, 'home_property_id was read by mortality and set by nothing');
});

// -- poverty is relative, because the currency has no value -------------

test('the poverty line is half the world median, not a made-up number', () => {
  // No document sets a poverty line and `individual_finances` is bare
  // numbers with no denomination, so an absolute line would need a
  // currency value nobody has set. Relative also tracks a world whose
  // whole economy has moved, which is what a collapse is.
  const w = world();
  for (const savings of [10, 20, 100, 200, 300]) person(w, { savings });
  // Median of 10/20/100/200/300 is 100, so the line is 50.
  assert.equal(areaStats.povertyLine(w), 50);
});

test('the poverty line is the world\'s, not each area\'s', () => {
  // **A per-community median would make every community contain
  // exactly the same share of poor people** — the classic way to
  // compute a number that cannot vary. A poor area has to be able to
  // read as poor.
  const w = world();
  const rich = territory.generateCommunity(w, {});
  const poor = territory.generateCommunity(w, {});
  for (const savings of [1000, 1200, 1400]) person(w, { communityId: rich.id, savings });
  for (const savings of [5, 6, 7]) person(w, { communityId: poor.id, savings });

  const richStats = areaStats.statsFor(w, rich.id);
  const poorStats = areaStats.statsFor(w, poor.id);
  assert.equal(poorStats.povertyRate, 1, 'the poor area should be entirely below the line');
  assert.equal(richStats.povertyRate, 0);
});

// -- the statistics -----------------------------------------------------

test('an area with no residents has unknown statistics, not zeroed ones', () => {
  // Reporting 0 would read as an area where nobody is poor and nobody
  // is unemployed, which is the opposite of the truth about an empty
  // one.
  const w = world();
  const empty = territory.generateCommunity(w, {});
  const stats = areaStats.statsFor(w, empty.id);
  assert.equal(stats.population, 0);
  assert.equal(stats.povertyRate, null);
  assert.equal(stats.employmentRate, null);
  assert.equal(stats.meanAge, null);
});

test('employment, age and net worth are computed from the residents', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id, savings: 100, age: 20 });
  const b = person(w, { communityId: c.id, savings: 300, age: 40 });
  person(w, { communityId: c.id, savings: 200, age: 60 });
  economy.hireEntity(w, { entityId: a.id, employerOrganizationId: 100, wage: 10 });
  economy.hireEntity(w, { entityId: b.id, employerOrganizationId: 100, wage: 10 });

  const stats = areaStats.statsFor(w, c.id);
  assert.equal(stats.population, 3);
  assert.equal(stats.employmentRate, 0.6667, '2 of 3 residents employed');
  assert.equal(stats.meanAge, 40);
  assert.equal(stats.medianNetWorth, 200);
});

test('a neighbouring area\'s residents are not counted', () => {
  const w = world();
  const here = territory.generateCommunity(w, {});
  const there = territory.generateCommunity(w, {});
  const local = person(w, { communityId: here.id });
  person(w, { communityId: there.id });
  person(w, { communityId: there.id });
  economy.hireEntity(w, { entityId: local.id, employerOrganizationId: 100, wage: 10 });

  assert.equal(areaStats.statsFor(w, here.id).population, 1);
  assert.equal(areaStats.statsFor(w, here.id).employmentRate, 1);
  assert.equal(areaStats.statsFor(w, there.id).employmentRate, 0);
});

test('deaths are counted per area, with their causes, from world history', () => {
  // The dead have left `worldState.npcs`, so their residency comes off
  // the corpse in `deceased` — and the cause comes from the historical
  // record rather than from a field on the body.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id, age: 90 });
  const b = person(w, { communityId: c.id, age: 30 });
  person(w, { communityId: c.id, age: 25 });

  mortality.recordDeath(w, { entityId: a.id, cause: 'age', tick: 36500 });
  mortality.killEntity(w, { entityId: b.id, killerId: null, tick: 36501 });

  const stats = areaStats.statsFor(w, c.id);
  assert.equal(stats.population, 1, 'the dead should have left the living count');
  assert.equal(stats.deaths, 2);
  assert.deepEqual(stats.causesOfDeath, { age: 1, violence: 1 });
  assert.equal(stats.deathRate, round4(2 / 3));
});

function round4(n) { return Math.round(n * 10000) / 10000; }

test('statsForAll covers every community and computes the line once', () => {
  const w = world();
  const a = territory.generateCommunity(w, {});
  const b = territory.generateCommunity(w, {});
  person(w, { communityId: a.id, savings: 10 });
  person(w, { communityId: b.id, savings: 1000 });

  const all = areaStats.statsForAll(w);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((s) => s.communityId), [a.id, b.id]);
  assert.equal(all[0].povertyRate, 1);
  assert.equal(all[1].povertyRate, 0);
});

// -- stored versus computed ---------------------------------------------

test('the stored community figures are placeholders, and the drift says so', () => {
  // **This is the finding, as a test.** `generateCommunity` defaults
  // `employment` to 50 and `population` to 0, and nothing updates
  // either — so a community reports half its people employed because
  // 50 is the default, not because half of it works.
  const w = world();
  const c = territory.generateCommunity(w, {});
  assert.equal(c.employment, 50, 'the placeholder default');
  assert.equal(c.population, 0);

  for (let i = 0; i < 4; i += 1) person(w, { communityId: c.id });
  economy.hireEntity(w, { entityId: w.npcs[0].id, employerOrganizationId: 100, wage: 10 });

  // Four residents, one employed: really 25%, stored 50%.
  const drift = areaStats.describeDrift(w, c.id);
  const employment = drift.find((r) => r.field === 'employment');
  assert.equal(employment.stored, 50);
  assert.equal(employment.computed, 25);
  assert.equal(employment.drifted, true);

  const population = drift.find((r) => r.field === 'population');
  assert.equal(population.stored, 0);
  assert.equal(population.computed, 4);
  assert.equal(population.drifted, true);

  // **And nothing wrote the computed value back.** Standing rule 3: a
  // rollup that can be computed must not be stored, and `communities`
  // having these columns at all is a tension in the schema rather than
  // a licence to duplicate.
  assert.equal(c.employment, 50, 'describeDrift wrote back to the stored column');
  assert.equal(c.population, 0);
});

// -- what is honestly unavailable ---------------------------------------

test('every statistic this cannot compute names its missing substrate', () => {
  // A plausible number would be worse than an absence here. Each entry
  // says what is missing rather than that something is missing — crime
  // by type needs a typed crime record, a dropout rate needs somebody
  // to drop out of.
  const keys = Object.keys(areaStats.UNAVAILABLE);
  assert.deepEqual(keys.sort(), [
    'crimeByType', 'demographics', 'gangMembership', 'schoolDropout', 'teenagePregnancy',
  ]);
  for (const [key, reason] of Object.entries(areaStats.UNAVAILABLE)) {
    assert.ok(reason.length > 60, `${key} has no real explanation`);
  }

  // And the one that carries a constraint rather than only a gap:
  // §9 permits demographic modelling and forbids demographics
  // determining morality, criminality, intelligence or worth.
  assert.match(areaStats.UNAVAILABLE.demographics, /morality, criminality, intelligence or worth/);
});

test('no per-area statistic is silently invented', () => {
  // The shape of `statsFor` is the contract: if a key appears here it
  // is computed from real records. Anything in UNAVAILABLE must NOT
  // appear as a field, or a caller would read a number that does not
  // mean what its name says.
  const w = world();
  const c = territory.generateCommunity(w, {});
  person(w, { communityId: c.id });
  const stats = areaStats.statsFor(w, c.id);

  for (const forbidden of Object.keys(areaStats.UNAVAILABLE)) {
    assert.equal(forbidden in stats, false,
      `statsFor reports ${forbidden}, which UNAVAILABLE says cannot be computed`);
  }
  assert.deepEqual(Object.keys(stats).sort(), [
    'causesOfDeath', 'communityId', 'deathRate', 'deaths', 'employmentRate',
    'meanAge', 'medianNetWorth', 'population', 'povertyRate',
  ]);
});
