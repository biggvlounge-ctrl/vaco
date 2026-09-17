// A world that actually contains things.
//
// **The finding this suite guards.** With 67 statistics in the
// catalogue, a world built the only way one could be built — generate
// some NPCs, place them, tick — answered 35. Eight of the rest are
// declared gaps. The other 24 were computable and came back null, every
// one because the generator existed, was tested, and nothing ever
// called it. No code anywhere assembled a world, so every world the
// engine had ever run was a crowd of people standing in an empty field.
//
// These tests hold the two things that matter about the fix: the world
// contains one of everything the engine models, and it replays from its
// seed.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const worldgen = require('../server/worldgen.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const membership = require('../server/membership.js');
const infrastructure = require('../server/infrastructure.js');
const demographics = require('../server/demographics.js');

const w = engine.WorldState;

// **Every test here builds into `engine.WorldState`, and that is not an
// accident of convenience** — `generateNPC`, `generateOrganization` and
// `generateFamily` are the last three generators still bound to the
// module-global world, which is why `generateWorld` takes options
// rather than a world. So each test records what was there before and
// asserts on what its own call added, rather than on totals.
function delta(fn) {
  const before = {
    npcs: w.npcs.length,
    properties: w.properties.length,
    infrastructure: w.infrastructure.length,
    organizations: w.organizations.length,
    families: w.families.length,
    employment: w.employmentRecords.length,
    memberships: w.entityOrganizationMemberships.length,
    relationships: w.relationships.length,
    communities: w.communities.length,
    cities: w.cities.length,
    entityLanguages: w.entityLanguages.length,
    territoryBlocks: w.territoryBlocks.length,
    resources: w.resources.length,
  };
  const summary = fn();
  const after = {};
  for (const key of Object.keys(before)) after[key] = w[key === 'employment' ? 'employmentRecords' : key === 'memberships' ? 'entityOrganizationMemberships' : key].length - before[key];
  return { summary, added: after, before };
}

const SMALL = { communitiesPerCity: 2, populationPerCommunity: 12 };

// -- it builds one of everything ----------------------------------------

test('a generated world contains every kind of thing the engine models', () => {
  // The list is the point. Each of these was a generator that existed,
  // was tested, and had no caller.
  const { summary, added } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'contains' }));

  assert.equal(added.cities, 1);
  assert.equal(added.communities, 2);
  assert.equal(added.npcs, 24);
  assert.equal(summary.people, 24);

  for (const [what, count] of Object.entries(added)) {
    assert.ok(count > 0, `a generated world contains no ${what}`);
  }

  // And the things that are joins rather than rows.
  assert.ok(added.employment > 0, 'nobody works');
  assert.ok(added.memberships >= added.employment, 'employment did not create a membership');
  assert.ok(added.relationships > 0, 'nobody knows anybody, so the Social phase has nothing to do');
});

test('a property knows which community it is in, which is what housing statistics need', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'homes' }));
  const fresh = w.properties.slice(before.properties);
  assert.ok(fresh.length > 0);
  assert.equal(fresh.every((p) => p.community_id !== null && p.city_id !== null), true,
    'a property with no community is invisible to every housing statistic');

  // Both types, so `residential_share` is a real mix rather than 1.
  assert.ok(fresh.some((p) => p.type === 'residential'));
  assert.ok(fresh.some((p) => p.type === 'commercial'));
});

test('more homes than residents, which is what makes a vacancy rate', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'vacancy' }));
  const community = w.communities[w.communities.length - 1];
  const homes = w.properties.slice(before.properties)
    .filter((p) => p.community_id === community.id && p.type === 'residential');
  const residents = w.npcs.slice(before.npcs).filter((n) => n.communityId === community.id);
  assert.ok(homes.length > residents.length,
    'every home is occupied, so the vacancy rate can only ever be 0');
});

test('a city gets all ten infrastructure types, four of them with a capacity', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'infra' }));
  const city = w.cities[w.cities.length - 1];
  const built = w.infrastructure.slice(before.infrastructure);

  assert.deepEqual(
    built.map((i) => i.type).sort(),
    [...infrastructure.INFRASTRUCTURE_TYPES].sort(),
  );
  // Capacity where a capacity means something, null where it does not
  // — a road network has a condition and no headcount, and null is the
  // distinction `capacityOf` exists to preserve.
  assert.ok(infrastructure.capacityOf(w, city.id, 'schools') > 0);
  assert.ok(infrastructure.capacityOf(w, city.id, 'public_safety') > 0);
  assert.equal(infrastructure.capacityOf(w, city.id, 'roads'), null,
    'a road network was given a headcount');

  // Condition varies, so a statistic has something to find. A world
  // where everything starts at 100 has no variation, and one where
  // everything starts at 50 has the placeholder problem this project
  // keeps finding.
  const conditions = new Set(built.map((i) => i.condition));
  assert.ok(conditions.size > 3, 'every piece of infrastructure is in identical condition');
});

test('people carry the demographics the schema has columns for', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'demo' }));
  const fresh = w.npcs.slice(before.npcs);

  assert.equal(fresh.every((n) => n.religion !== null), true);
  assert.equal(fresh.every((n) => demographics.primaryLanguageOf(w, n.id) !== null), true);

  // **Education only for adults, and that is not a gap.** A child has
  // not finished any, `demographics` counts unrecorded people as
  // `unknown`, and `demographics_recorded_share` reports the coverage
  // — so a young block reads as young rather than as uneducated.
  const adults = fresh.filter((n) => (w.tick - n.createdTick) / 365 >= 18);
  const children = fresh.filter((n) => (w.tick - n.createdTick) / 365 < 18);
  assert.ok(adults.length > 0 && children.length > 0,
    'the age draw produced only one cohort, so neither births nor mortality is exercised');
  assert.equal(adults.every((n) => n.education !== null), true);
  assert.equal(children.every((n) => n.education === null), true);
});

test('a gang holds territory and has members who live there', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, populationPerCommunity: 40, gangMembershipRate: 0.3, seed: 'gangs',
  }));
  const community = w.communities[w.communities.length - 1];
  assert.ok(w.territoryBlocks.slice(before.territoryBlocks).length > 0);
  assert.ok(membership.gangMembershipRate(w, community.id) > 0,
    'factions hold blocks but nobody living there belongs to one');
});

// -- it replays ---------------------------------------------------------

test('the same seed builds the same world', () => {
  // §88: the same seed and the same rules give the same world. Until
  // this commit that could not be true even in principle —
  // `randomTraitValue()` and `generateName()` are both `Math.random()`,
  // so `generateNPC` produced a different person every time it was
  // called. `traitValueFor` is what makes a replayable world possible.
  //
  // Ids differ between the two runs because the counter keeps going,
  // so the comparison is over what was drawn rather than over
  // identity.
  function run(seed) {
    const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed }));
    return w.npcs.slice(before.npcs).map((n) => [
      n.name, n.religion, n.education, n.createdTick,
      JSON.stringify(n.traits),
    ].join('|'));
  }

  const first = run('replay');
  const second = run('replay');
  assert.ok(first.length > 0);
  assert.deepEqual(first, second, 'the same seed produced two different worlds');
});

test('a different seed builds a different world', () => {
  // The control. If this passes trivially, the seed is not reaching
  // the draws.
  function run(seed) {
    const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed }));
    return w.npcs.slice(before.npcs).map((n) => `${n.name}|${n.createdTick}`).join(',');
  }
  assert.notEqual(run('alpha'), run('beta'));
});

test('nothing in the generated world came from Math.random', () => {
  // Held structurally, because the seeded path is easy to bypass by
  // omitting one option. `worldgen.js` must draw only through
  // `seeded.js`.
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../server/worldgen.js'), 'utf8');
  const body = src.slice(src.indexOf("'use strict'"))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.equal(body.includes('Math.random'), false);

  // And every generator that could roll its own traits is handed a
  // value function instead.
  const calls = body.match(/engine\.generate(NPC|Organization|Family|Faction)\(/g) || [];
  assert.ok(calls.length >= 4, 'the world is not built from the engine\'s own generators');
  assert.equal((body.match(/traitValueFor/g) || []).length >= calls.length, true,
    'a generator was called without traitValueFor, so part of the world cannot replay');
});

// -- it is the thing the catalogue was waiting for -----------------------

test('a generated world answers most of the catalogue, where an empty one answered half', () => {
  // **The regression guard for the whole point of this module.** The
  // measurement that prompted it: 35 of 67 answered, 24 computable and
  // silent, 8 structurally declared.
  delta(() => worldgen.generateWorld({ communitiesPerCity: 3, populationPerCommunity: 20, seed: 'coverage' }));

  const structural = new Set(statistics.unavailable().map((e) => e.key));
  const profiles = statistics.profileAll(w);
  const answered = statistics.CATALOGUE.filter(
    (d) => !structural.has(d.key) && profiles.some((p) => p.statistics[d.key].known),
  );

  assert.ok(answered.length >= 56,
    `only ${answered.length} of ${statistics.KEYS.length} statistics answer; `
    + 'a generated world should populate nearly all of them');

  // **8 until 16 Sep 2026, when `migration_rate` stopped being one.**
  // Its declaration was exactly right about why it could not be
  // answered — "no destination is chosen and no residency is
  // rewritten, so there is no arrival or departure to count" — and
  // `server/migration.js` does both. This number is asserted rather
  // than read so that a gap QUIETLY appearing, which is the failure
  // that matters, cannot pass.
  assert.equal(structural.size, 7, 'the declared-gap count moved without this test being updated');
});

test('a fresh world has routines, and running it engages the Behavior Engine', () => {
  // **This test used to assert the opposite and was right to.** It
  // held that nothing in the tick pipeline applies stress —
  // `applyStress` was reachable only through the API, `runBehavior`
  // decays what is there and creates nothing, and nothing ever added a
  // schedule. Measured: `entity_state`, `habits` and `schedule_events`
  // were all three 0 after 300 ticks of a 150-person world. The
  // Behavior Engine was complete and never engaged.
  //
  // Both halves are now fed: `worldgen.seedRoutine` gives people the
  // routine their situation implies, and the tick applies both what
  // happened to them (events) and what they are living through
  // (conditions).
  const engine = require('../server/engine.js');
  const behavior = require('../server/behavior.js');
  const before = {
    schedules: w.scheduleEvents.length,
    habits: w.habits.length,
    state: w.entityState.length,
  };
  worldgen.generateWorld({ ...SMALL, seed: 'behaviour' });

  assert.ok(w.scheduleEvents.length > before.schedules,
    'a generated world has no routines, so no habit can ever form');

  for (let t = 0; t < 60; t += 1) engine.advanceTick();
  assert.ok(w.habits.length > before.habits, 'no habit formed in 60 ticks of kept routine');
  assert.ok(w.entityState.length > before.state, 'nobody was affected by anything');

  // And the moods that come out are a spread rather than a binary.
  // Flat stress decay against a steady load is a step function — any
  // load above the recovery rate ratchets to 100 and any below it
  // falls to 0 — which measured as 142 people at exactly 0 and six
  // pinned at 97. Recovery is proportional for that reason.
  const moods = new Set(w.npcs
    .map((n) => behavior.getEntityState(w, n.id))
    .filter(Boolean)
    .map((s) => s.currentMood));
  assert.ok(moods.size >= 2, `every observed person is "${[...moods][0]}" — there is no spread`);
});

test('a generated world starts in rough balance, not starving', () => {
  // **The other half of the same defect.** Supply and demand were
  // drawn independently from one range, so about half of every world's
  // resources sat in permanent deficit — and `survivalScarcity` takes
  // the WORST of food, water and medicine, so three independent draws
  // almost always produced a starving world. Measured at 0.74, which
  // is a settlement three quarters of the way to total famine on the
  // day it is founded.
  //
  // A world should START in balance and become scarce because
  // something happened to it. Scarcity is an event the simulation
  // produces, not the ground state.
  const mortality = require('../server/mortality.js');
  for (const seed of ['balance-a', 'balance-b', 'balance-c']) {
    worldgen.generateWorld({ ...SMALL, seed });
    const scarcity = mortality.survivalScarcity(w);
    assert.ok(scarcity < 0.25,
      `a freshly generated world has survival scarcity ${scarcity.toFixed(2)} — `
      + 'it is starving before anything has happened to it');
  }

  // And the essentials are the ones held closest to balance: a world
  // short of timber is an economic problem, a world short of water is
  // a mortality one.
  const city = w.cities[w.cities.length - 1];
  const essentials = w.resources.filter(
    (r) => r.city_id === city.id && mortality.SURVIVAL_RESOURCES.includes(r.resource_type),
  );
  assert.equal(essentials.length, 3);
  assert.equal(essentials.every((r) => r.demand / r.supply <= 1.2), true);
});

test('every family has a head, or nothing can ever succeed to it', () => {
  // `generateFamily` leaves `head_npc_id` null unless told, and
  // `succession.settleEstate` advances a family's generation only when
  // its HEAD dies. Without this, every family in every generated world
  // stayed on generation 1 no matter how many members were buried —
  // measured at 400 ticks: two deaths, thirty families, all still
  // generation 1.
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'heads' }));
  const fresh = w.families.slice(before.families);
  assert.ok(fresh.length > 0);

  const living = new Set(w.npcs.map((n) => n.id));
  for (const family of fresh) {
    const members = w.familyMemberships.filter((m) => m.family_id === family.id);
    if (members.length === 0) continue;
    assert.ok(family.head_npc_id, `family ${family.id} has members and no head`);
    assert.ok(living.has(family.head_npc_id), 'a family is headed by somebody who is not there');
  }
});
