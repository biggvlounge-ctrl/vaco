// People actually moving.
//
// **What was here before.** `runMigrationPhase` computed a "migration
// risk" from Volatility and Resource Hoarding, emitted an event whose
// own text said "no relocation system built yet", and nobody ever went
// anywhere. `migration_events` and `regions` were both tables with no
// store, and `migration_rate` was a declared statistics gap whose
// reason named exactly this.
//
// The old risk was a reading of who somebody IS, which is the model §9
// forbids for crime. It was also inert for the same reason that makes
// it wrong: traits barely move, so the same people were "at risk" on
// tick 1 and every tick after — which is what made migration the
// largest single source of noise in the event log before a crossing was
// bolted on.
//
// Two structural errors shaped what is here, both found by running a
// world rather than by an assertion:
//
//   1. **A pull that did not answer the push.** The first destination
//      score read danger only, so somebody pushed out by unmet INCOME
//      moved somewhere safer, arrived with no more work, and was pushed
//      again.
//   2. **A push that survives the action it motivates.** Even with work
//      in the score, a move changes where somebody is and not whether
//      they have a job — 993 relocations in 300 ticks for a hundred
//      people, about ten each. Any model with that shape churns.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = require('../server/migration.js');
const motivation = require('../server/motivation.js');
const households = require('../server/households.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

const SCHEMA = fs.readFileSync(
  path.join(__dirname, '..', 'VACANCY_POSTGRESQL_SCHEMA.sql'), 'utf8',
);

let nextId = 300000;

function world(extra = {}) {
  const w = {
    tick: 1000,
    npcs: [], communities: [], cities: [], properties: [], regions: [],
    migrationEvents: [], needs: [], entityTraits: [], organizations: [],
    families: [], crimeIncidents: [], employmentRecords: [], households: [],
    ...extra,
  };
  migration.reseedIds(w);
  return w;
}

function community(w, id, cityId = 1) {
  w.communities.push({ id, city_id: cityId });
  return id;
}

function home(w, communityId) {
  const id = nextId += 1;
  w.properties.push({ id, type: 'residential', community_id: communityId, occupants: [] });
  return id;
}

function person(w, communityId, homeId = null) {
  const id = nextId += 1;
  w.npcs.push({ id, status: 'active', communityId, home_property_id: homeId });
  return id;
}

// -- the vocabulary -------------------------------------------------------

test('every migration type is the schema\'s own, and three are declared unmodelled', () => {
  for (const type of migration.MIGRATION_TYPES) {
    assert.ok(SCHEMA.includes(type), `migration_events has no "${type}" in its enumeration`);
  }
  assert.equal(migration.MIGRATION_TYPES.length, 7);

  // The absence is data: each unmodelled type says what substrate it
  // would need, so a later system knows what building it unlocks.
  for (const [type, reason] of Object.entries(migration.TYPES_NOT_MODELLED)) {
    assert.ok(migration.MIGRATION_TYPES.includes(type), `"${type}" is not a type at all`);
    assert.ok(reason.length > 20, `"${type}" is declared unmodelled without saying why`);
  }
  assert.equal(migration.TYPES_MODELLED.length + Object.keys(migration.TYPES_NOT_MODELLED).length,
    migration.MIGRATION_TYPES.length);
});

test('an unmodelled type is refused rather than written', () => {
  // A `seasonal` row would be a kind of movement this engine cannot
  // have produced, and a later reader would have no way to tell.
  const w = world();
  assert.throws(() => migration.record(w, { entityId: 1, migrationType: 'seasonal' }),
    /is not modelled/);
  assert.throws(() => migration.record(w, { entityId: 1, migrationType: 'holiday' }),
    /is not a type/);
  assert.throws(() => migration.record(w, { migrationType: 'economic' }),
    /requires an entityId/);
});

// -- push comes from circumstances ---------------------------------------

test('an unmet need pushes, and a met one does not', () => {
  const w = world();
  community(w, 1);
  const id = person(w, 1, home(w, 1));
  motivation.generateNeeds(w, id, { levelFor: () => 90 });

  assert.equal(migration.pushFor(w, id), null, 'a comfortable person is being pushed out');

  motivation.needOf(w, id, 'income').current_level = 5;
  const push = migration.pushFor(w, id);
  assert.equal(push.need, 'income');
  assert.equal(push.type, 'economic');
  assert.ok(push.pressure > 0.5);
});

test('losing your housing is forced, chasing income is economic', () => {
  // The type comes from what the word means rather than a third list.
  const w = world();
  community(w, 1);
  const id = person(w, 1, home(w, 1));
  motivation.generateNeeds(w, id, { levelFor: () => 90 });

  motivation.needOf(w, id, 'housing').current_level = 0;
  assert.equal(migration.pushFor(w, id).type, 'forced');
});

test('somebody with no needs recorded is not read as content', () => {
  const w = world();
  community(w, 1);
  assert.equal(migration.pushFor(w, person(w, 1)), null);
});

// -- pull answers push ----------------------------------------------------

test('a destination with no vacancy is not a destination', () => {
  const w = world();
  community(w, 1);
  community(w, 2);
  const shared = {
    danger: new Map([[1, 0.9], [2, 0]]),
    vacancies: migration.vacanciesByCommunity(w),
    work: new Map([[1, 0], [2, 1]]),
  };
  assert.equal(migration.desirability(w, 2, shared), null,
    'a community with nowhere to live scored as somewhere to move to');
});

test('work is half the score, so an income move goes somewhere with jobs', () => {
  // **Structural error 1.** A score that read danger only sent
  // income-pushed people somewhere safer and no richer, and they were
  // pushed again on arrival.
  const w = world();
  community(w, 1);
  community(w, 2);
  home(w, 1);
  home(w, 2);
  const shared = {
    danger: new Map([[1, 0], [2, 0]]),
    vacancies: migration.vacanciesByCommunity(w),
    work: new Map([[1, 0], [2, 1]]),
  };
  assert.ok(migration.desirability(w, 2, shared) > migration.desirability(w, 1, shared),
    'two equally safe communities scored the same when only one has work');
});

test('an empty community is unknown on work, not jobless', () => {
  const w = world();
  community(w, 1);
  person(w, 1);
  const share = migration.workByCommunity(w);
  assert.equal(share.get(2), undefined, 'a community with nobody in it was scored');
  assert.equal(share.get(1), 0, 'a community with people and no jobs should be 0');
});

// -- who goes -------------------------------------------------------------

test('willingness is centred, so an ordinary person is ordinary', () => {
  // The twelfth standing rule: traits decide WHO moves under equal
  // pressure, and must not move the base rate for everybody.
  const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
  const { generateEntityTraits } = require('../server/entityTraits.js');
  const w = world();
  community(w, 1);
  const id = person(w, 1);
  w.entityTraits.push(...generateEntityTraits(id, w.tick, INDIVIDUAL_DEFINITIONS, () => 50));

  assert.equal(migration.willingness(w, id), 1,
    'an ordinary person is more or less willing to move than the base rate');
  assert.equal(migration.willingness(w, 999999), 0, 'a nonexistent person is willing');
});

// -- the move -------------------------------------------------------------

test('relocating rewrites residency and records why', () => {
  const w = world();
  community(w, 1);
  community(w, 2);
  const there = home(w, 2);
  const id = person(w, 1, home(w, 1));

  const row = migration.relocate(w, {
    entityId: id, toCommunityId: 2, toPropertyId: there,
    migrationType: 'economic', reason: 'unmet income', tick: 50,
  });

  const npc = w.npcs.find((n) => n.id === id);
  assert.equal(npc.communityId, 2);
  assert.equal(npc.home_property_id, there);
  assert.equal(row.from_location_id, 1);
  assert.equal(row.to_location_id, 2);
  assert.equal(row.reason, 'unmet income');

  // And the household follows, with no coupling between the two
  // modules — households reads where people live.
  households.syncHouseholds(w, { tick: 50 });
  assert.equal(households.householdOf(w, id).property_id, there);
});

test('a rate is net and over a window, not a running total', () => {
  const w = world();
  community(w, 1);
  community(w, 2);
  for (let i = 0; i < 10; i += 1) person(w, 2);

  migration.record(w, { entityId: 1, fromLocationId: 1, toLocationId: 2, migrationType: 'economic', tick: 990 });
  migration.record(w, { entityId: 2, fromLocationId: 2, toLocationId: 1, migrationType: 'economic', tick: 995 });
  // Long ago, and outside the window.
  migration.record(w, { entityId: 3, fromLocationId: 1, toLocationId: 2, migrationType: 'economic', tick: 1 });

  // One in, one out, inside the year: net zero.
  assert.equal(migration.netRatePer1k(w, 2, { tick: 1000 }), 0);
  assert.equal(migration.netRatePer1k(w, 99, { tick: 1000 }), null,
    'an area with nobody in it produced a rate');
});

// -- the churn --------------------------------------------------------

test('somebody who just moved stays put', () => {
  // **Structural error 2, and the fix for it.** A move changes where
  // somebody is and not whether they have work, so an income-pushed
  // mover arrives still pushed. Without a settling period the model
  // produced about ten relocations per person.
  const w = world();
  community(w, 1);
  community(w, 2);
  home(w, 2);
  home(w, 2);
  const id = person(w, 1, home(w, 1));
  motivation.generateNeeds(w, id, { levelFor: (n) => (n === 'income' ? 0 : 90) });
  migration.record(w, { entityId: id, toLocationId: 1, migrationType: 'economic', tick: 995 });

  // Inside the settling period, however hard they are pushed.
  for (let t = 996; t < 1000 + migration.SETTLING_TICKS - 10; t += 1) {
    migration.runMigration(w, { tick: t, seed: 'churn' });
  }
  assert.equal(w.migrationEvents.length, 1, 'somebody moved again while still settling in');
});

// -- the real pipeline ----------------------------------------------------

test('a running world moves people, at most occasionally', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 4, populationPerCommunity: 25, seed: 'move' });
  assert.ok(w.regions.length > 0, 'a generated world has no region');
  assert.equal(w.cities[0].region_id, w.regions[0].id, 'a city belongs to no region');

  for (let t = 0; t < 300; t += 1) engine.advanceTick();

  assert.ok(w.migrationEvents.length > 0,
    'a world ran for 300 ticks and nobody moved — the relocation system is inert again');

  // Nobody relocates ten times in ten months.
  const per = new Map();
  for (const row of w.migrationEvents) {
    per.set(row.entity_id, (per.get(row.entity_id) ?? 0) + 1);
  }
  const most = Math.max(...per.values());
  assert.ok(most <= 2, `somebody moved ${most} times in 300 ticks — the churn is back`);

  // Only types this engine can actually observe the cause of.
  for (const row of w.migrationEvents) {
    assert.ok(migration.TYPES_MODELLED.includes(row.migration_type),
      `a ${row.migration_type} move was recorded, which nothing here can produce`);
    assert.ok(row.reason, `migration ${row.id} records no reason`);
  }
});

test('the migration_rate statistic can finally answer', () => {
  // It was declared unavailable, and the declaration was exactly right
  // about why: "no destination is chosen and no residency is rewritten,
  // so there is no arrival or departure to count."
  const statistics = require('../server/statistics.js');
  const w = engine.WorldState;

  const declared = new Set(statistics.unavailable().map((e) => e.key));
  assert.equal(declared.has('migration_rate'), false,
    'migration_rate is still declared unavailable');

  const profile = statistics.profileFor(w, w.communities[0].id);
  assert.equal(profile.statistics.migration_rate.known, true);
});

test('ids survive a reseed', () => {
  const w = world();
  w.migrationEvents.push({ id: 5, entity_id: 1, tick: 1 });
  w.regions.push({ id: 2, name: 'x' });
  assert.deepEqual(migration.reseedIds(w), { nextMigrationId: 6, nextRegionId: 3 });
});
