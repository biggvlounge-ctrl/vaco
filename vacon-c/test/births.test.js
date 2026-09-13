// People are born — the other end of the life scale.
//
// `mortality.js` gave the world an ending and nothing gave it a
// beginning: `addFamilyMember` existed and nothing called it on its
// own, so every population could only shrink, `npcs.generation` was 1
// for every NPC in every world, and two statistics were declared
// unavailable with the same reason — there is no birth driver, so
// there is nothing to count.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const births = require('../server/births.js');
const economy = require('../server/economy.js');
const mortality = require('../server/mortality.js');
const territory = require('../server/territory.js');
const statistics = require('../server/statistics.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 70000;

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
    beliefs: [],
    nextEntityId: 1,
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  return worldState;
}

// Built with the real trait generator, so every definition an
// inherited sheet needs is actually present — standing rule 6: a
// fixture that omits a field hides the code that reads it.
function person(worldState, { communityId = null, savings = 500, age = 27, traitValue = null } = {}) {
  const id = nextId++;
  const rows = generateEntityTraits(
    id, worldState.tick, INDIVIDUAL_DEFINITIONS,
    traitValue === null ? null : () => traitValue,
  );
  worldState.entityTraits.push(...rows);
  const npc = {
    id,
    type: 'npc',
    status: 'active',
    name: `P${id}`,
    religion: null,
    generation: 1,
    communityId,
    home_property_id: null,
    createdTick: worldState.tick - Math.round(age * mortality.TICKS_PER_YEAR),
    updatedTick: worldState.tick,
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, id, { savings, tick: worldState.tick });
  return npc;
}

function couple(worldState, a, b, love = 90) {
  worldState.relationships.push({
    id: nextId++, entity_a_id: a.id, entity_b_id: b.id,
    relationship_type: 'social', love, trust: 80, conflict: 0,
  });
}

// -- the fertility curve ------------------------------------------------

test('fertility is zero below the floor, peaks, and reaches zero at the maximum', () => {
  // **The one hard gate in the file, and it is biology rather than a
  // rule about the environment.** Everything else that suppresses a
  // birth is circumstance.
  assert.equal(births.fertilityForAge(14), 0);
  assert.equal(births.fertilityForAge(births.FERTILITY_MIN_AGE - 0.01), 0);
  assert.ok(births.fertilityForAge(births.FERTILITY_MIN_AGE) >= 0);
  assert.equal(births.fertilityForAge(births.FERTILITY_PEAK_AGE), 1);
  assert.equal(births.fertilityForAge(births.FERTILITY_MAX_AGE), 0);
  assert.equal(births.fertilityForAge(60), 0);
  assert.equal(births.fertilityForAge(null), 0);

  // It declines on both sides rather than dropping off a cliff.
  assert.ok(births.fertilityForAge(20) < births.fertilityForAge(27));
  assert.ok(births.fertilityForAge(40) < births.fertilityForAge(35));
});

test('the environment suppresses births with the same inputs that kill', () => {
  // One environment driving two systems, rather than two systems each
  // inventing their own weather.
  const w = world();
  const a = person(w, { savings: 500 });
  const line = 100;

  const good = births.environmentalFertility(w, a, { scarcity: 0, pressure: 1, line });
  assert.equal(good, 1);

  const famine = births.environmentalFertility(w, a, { scarcity: 1, pressure: 1, line });
  assert.ok(famine < good, 'a total shortage should suppress births');

  const epidemic = births.environmentalFertility(w, a, { scarcity: 0, pressure: 2, line });
  assert.ok(epidemic < good);

  const destitute = person(w, { savings: 0 });
  const poor = births.environmentalFertility(w, destitute, { scarcity: 0, pressure: 1, line });
  assert.ok(poor < good && poor > 0, 'poverty should suppress births without forbidding them');

  // And nothing drives it below zero, however bad it gets.
  const collapse = births.environmentalFertility(w, destitute, { scarcity: 1, pressure: 5, line });
  assert.ok(collapse >= 0);
});

// -- who can bear ------------------------------------------------------

test('a partnership needs a bond, two living people, and one in the window', () => {
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 30 });
  const acquaintance = person(w, { age: 28 });
  const elder = person(w, { age: 70 });
  const otherElder = person(w, { age: 72 });

  couple(w, a, b);
  couple(w, a, acquaintance, births.PARTNER_BOND_FLOOR - 1);   // not a partnership
  couple(w, elder, otherElder);                                 // nobody in the window

  const pairs = births.fertilePartnerships(w);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].bearer.id, a.id, 'the more fertile of the two bears');
  assert.equal(pairs[0].other.id, b.id);
});

test('a dead partner ends the partnership', () => {
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 29 });
  couple(w, a, b);
  assert.equal(births.fertilePartnerships(w).length, 1);

  mortality.recordDeath(w, { entityId: b.id, cause: 'disease', tick: w.tick });
  assert.equal(births.fertilePartnerships(w).length, 0);
});

// -- the birth ----------------------------------------------------------

test('a child inherits its parents\' live traits rather than rolling fresh', () => {
  // **Standing rule 9.** `npc.traits` is a sheet built once at
  // generation and frozen; the live values are the entity_traits rows
  // every tick phase writes to. A child inheriting the frozen sheet
  // from a parent who has lived forty years inherits a stranger — and
  // a child rolling fresh makes lineage decorative.
  const w = world();
  const a = person(w, { age: 27, traitValue: 90 });
  const b = person(w, { age: 28, traitValue: 90 });
  const { child } = births.bearChild(w, { bearerId: a.id, otherParentId: b.id });

  const values = Object.values(child.traits).flatMap((family) => Object.values(family));
  assert.ok(values.length > 100, 'the child has no trait sheet');
  const low = values.filter((v) => v < 90 - births.INHERITANCE_DEVIATION);
  const high = values.filter((v) => v > 90 + births.INHERITANCE_DEVIATION);
  assert.deepEqual([low.length, high.length], [0, 0],
    'a child of two 90s landed outside the inheritance band');
  // And it is not a copy — siblings differ.
  assert.ok(new Set(values).size > 1, 'every inherited trait is identical; nothing varies');
});

test('a birth advances the generation, which was 1 forever', () => {
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 28 });
  const first = births.bearChild(w, { bearerId: a.id, otherParentId: b.id }).child;
  assert.equal(first.generation, 2);

  // And it compounds down a line rather than being a flag.
  first.createdTick = w.tick - Math.round(27 * mortality.TICKS_PER_YEAR);
  const partner = person(w, { age: 26 });
  const second = births.bearChild(w, { bearerId: first.id, otherParentId: partner.id }).child;
  assert.equal(second.generation, 3);
});

test('a child joins the bearing parent\'s family and community', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id, age: 27 });
  const b = person(w, { age: 28 });
  w.families.push({ id: 900, surname: 'Vance', total_members: 1, generation: 1 });
  w.familyMemberships.push({ entity_id: a.id, family_id: 900, role: 'parent' });

  const { child } = births.bearChild(w, { bearerId: a.id, otherParentId: b.id });
  assert.equal(child.communityId, c.id);
  const membership = w.familyMemberships.find((m) => m.entity_id === child.id);
  assert.equal(membership.family_id, 900);
  assert.equal(membership.role, 'child');
  assert.equal(w.families[0].total_members, 2);
});

test('a birth with no family creates none', () => {
  // Creating one means deciding a surname, a founder and a generation,
  // and those are decisions for whoever builds the world, not for a
  // birth.
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 28 });
  births.bearChild(w, { bearerId: a.id, otherParentId: b.id });
  assert.equal(w.families.length, 0);
  assert.equal(w.familyMemberships.length, 0);
});

test('the record names both parents and both parents remember it', () => {
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 28 });
  const { child } = births.bearChild(w, { bearerId: a.id, otherParentId: b.id });

  const record = births.birthRecordFor(w, child.id);
  assert.deepEqual(record.who, [child.id, a.id, b.id]);
  assert.equal(record.what, 'birth');
  assert.ok(Number.isInteger(record.id), 'a record with no id cannot be migrated');

  // Unlike a killing, where only the killer has further decisions to
  // make, a birth is written back to both.
  assert.equal(w.memories.filter((m) => m.entity_id === a.id).length, 1);
  assert.equal(w.memories.filter((m) => m.entity_id === b.id).length, 1);
});

test('a child needs the shared entity counter, and says so', () => {
  const w = world();
  const a = person(w, { age: 27 });
  delete w.nextEntityId;
  assert.throws(() => births.bearChild(w, { bearerId: a.id }), /nextEntityId is not a number/);
});

// -- the pass -----------------------------------------------------------

test('a comfortable world bears children and a collapsing one does not', () => {
  // The control matters more than the positive case: if the collapsing
  // world still bears, the generator is not reading the environment.
  function run({ scarcity }) {
    const w = world();
    const c = territory.generateCommunity(w, {});
    for (let i = 0; i < 20; i += 1) {
      const a = person(w, { communityId: c.id, age: 27 });
      const b = person(w, { communityId: c.id, age: 29 });
      couple(w, a, b);
    }
    if (scarcity) {
      economy.generateResource(w, { resourceType: 'food', supply: 1, demand: 1000 });
      economy.generateResource(w, { resourceType: 'water', supply: 1, demand: 1000 });
      economy.generateResource(w, { resourceType: 'medicine', supply: 1, demand: 1000 });
    }
    for (let t = 1; t <= 730; t += 1) {
      w.tick = w.tick + 1;
      births.runBirths(w, w.tick);
    }
    return births.birthsIn(w, c.id).length;
  }

  const plenty = run({ scarcity: false });
  const famine = run({ scarcity: true });
  assert.ok(plenty > 0, 'twenty couples over two good years bore nobody');
  assert.ok(famine < plenty, `famine bore ${famine}, plenty bore ${plenty}`);
});

test('the same world and the same tick bear the same children', () => {
  // §88's replay guarantee. A birth generator on Math.random() makes
  // every world unreproducible.
  function run() {
    nextId = 80000;
    const w = world();
    const c = territory.generateCommunity(w, {});
    for (let i = 0; i < 10; i += 1) {
      const a = person(w, { communityId: c.id, age: 27 });
      const b = person(w, { communityId: c.id, age: 29 });
      couple(w, a, b);
    }
    for (let t = 1; t <= 400; t += 1) {
      w.tick += 1;
      births.runBirths(w, w.tick);
    }
    return births.birthsIn(w, c.id).map((n) => `${n.createdTick}:${n.id}`);
  }
  const first = run();
  const second = run();
  assert.ok(first.length > 0);
  assert.deepEqual(first, second);
  nextId = 90000;
});

test('nobody is born to a parent who died earlier in the same tick', () => {
  // The ordering claim the tick pipeline rests on: births run after
  // mortality in the cross-cutting slot. `fertilePartnerships` reads
  // the living, so a dead parent cannot appear in the list.
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 29 });
  couple(w, a, b);
  mortality.recordDeath(w, { entityId: a.id, cause: 'violence', tick: w.tick });

  const { births: born } = births.runBirths(w, w.tick);
  assert.equal(born.length, 0);
});

// -- what this unlocks --------------------------------------------------

test('a founder is not counted as a birth', () => {
  // A world seeded with 400 people did not give birth to them, and
  // counting them would report an enormous birth rate on tick 0.
  const w = world();
  const c = territory.generateCommunity(w, {});
  for (let i = 0; i < 5; i += 1) person(w, { communityId: c.id });
  assert.equal(births.birthsIn(w, c.id).length, 0);
  assert.equal(statistics.profileFor(w, c.id).statistics.birth_rate.value, 0);
});

test('a child who dies is still a birth that happened', () => {
  // A birth rate that silently drops infant deaths would make a lethal
  // world look like a barren one, which are opposite findings.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id, age: 27 });
  const b = person(w, { communityId: c.id, age: 29 });
  const { child } = births.bearChild(w, { bearerId: a.id, otherParentId: b.id });

  assert.equal(births.birthsIn(w, c.id).length, 1);
  mortality.recordDeath(w, { entityId: child.id, cause: 'disease', tick: w.tick + 1 });
  assert.equal(births.birthsIn(w, c.id).length, 1, 'the birth stopped counting when the child died');
});

test('the teenage birth statistics read the bearing parent\'s real age', () => {
  // **This is what makes the statistic a measurement rather than an
  // invention.** The parent's age at the birth is two subtractions
  // over fields that already exist — the child's `createdTick` and the
  // parent's — found through the historical record, which is the only
  // place a parent is named.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const young = person(w, { communityId: c.id, age: 17 });
  const youngPartner = person(w, { communityId: c.id, age: 19 });
  const older = person(w, { communityId: c.id, age: 30 });
  const olderPartner = person(w, { communityId: c.id, age: 32 });
  for (let i = 0; i < 6; i += 1) person(w, { communityId: c.id, age: 40 });

  const teen = births.bearChild(w, { bearerId: young.id, otherParentId: youngPartner.id }).child;
  births.bearChild(w, { bearerId: older.id, otherParentId: olderPartner.id });

  assert.equal(Math.round(births.bearerAgeAt(w, teen.id)), 17);
  assert.equal(births.bearerAgeAt(w, young.id), null, 'a founder has no birth record');

  const s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.birth_rate.known, true);
  assert.equal(s.teenage_birth_share.value, 0.5, 'one of the two births was to a teenager');
  assert.ok(s.teenage_birth_rate.value > 0);
});

test('the two statistics that were declared unavailable now answer', () => {
  // They were declared with the same reason — "there is no birth
  // driver" — and that reason is what changed. An UNAVAILABLE entry
  // that outlives the gap it names tells a caller not to ask for
  // something that works.
  const declared = statistics.unavailable().map((e) => e.key);
  assert.equal(declared.includes('birth_rate'), false);
  assert.equal(declared.includes('teenage_pregnancy_rate'), false);
  assert.ok(statistics.KEYS.includes('teenage_birth_rate'));
  assert.ok(statistics.KEYS.includes('teenage_birth_share'));
});

test('mean generation moves once a world has borne anybody', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id, age: 27 });
  const b = person(w, { communityId: c.id, age: 29 });
  assert.equal(statistics.profileFor(w, c.id).statistics.mean_generation.value, 1);

  births.bearChild(w, { bearerId: a.id, otherParentId: b.id });
  assert.equal(statistics.profileFor(w, c.id).statistics.mean_generation.value, 1.33);
});

// -- the test the fixtures could not be -------------------------------

test('a world left running forms bonds and bears children by itself', () => {
  // **This is the test that was missing, and its absence hid a broken
  // system.** Every test above builds its couples by writing `love`
  // into a relationship directly — and `relationships.love` is
  // initialised to 0 by `getOrCreateRelationship` and was written by
  // NOTHING, so `PARTNER_BOND_FLOOR` could never be reached and no
  // child could ever be born in a running world. Eighteen passing
  // tests said otherwise because all eighteen set the field the engine
  // could not.
  //
  // So this one touches no relationship. It seeds people, runs the
  // real tick pipeline, and looks at what the world did on its own.
  const engine = require('../server/engine.js');
  const areaStats = require('../server/areaStats.js');
  const territory = require('../server/territory.js');
  const w = engine.WorldState;

  const city = territory.generateCity(w, { name: `Bondtest ${nextId++}` });
  const block = territory.generateCommunity(w, { cityId: city.id });
  const seeded = [];
  for (let i = 0; i < 20; i += 1) {
    const npc = engine.generateNPC();
    // Everybody is of an age to bear, so the only thing being tested
    // is whether a bond can form at all.
    npc.createdTick = w.tick - Math.round(26 * mortality.TICKS_PER_YEAR);
    areaStats.placeInCommunity(w, { entityId: npc.id, communityId: block.id });
    economy.generateIndividualFinances(w, npc.id, { savings: 400, tick: w.tick });
    seeded.push(npc);
  }
  // Relationships with no love — exactly what the engine creates.
  for (let i = 0; i < seeded.length - 1; i += 2) {
    const rel = require('../server/worldStore.js')
      .getOrCreateRelationship(w, seeded[i].id, seeded[i + 1].id, 'social');
    assert.equal(rel.love, 0, 'getOrCreateRelationship no longer starts love at 0');
    // Trust high enough that the Social phase's bond can take hold;
    // trust IS written by resolveTrust, so this is a head start rather
    // than the thing under test.
    // Left at the engine's own default. The first version of this
    // fixture set trust to 75 as a "head start", which would have
    // hidden that trust is an accelerator and not a gate.
    assert.equal(rel.trust, 50);
  }

  const before = w.npcs.length;
  for (let t = 0; t < 2000; t += 1) engine.advanceTick();

  const bonded = w.relationships.filter((r) => (r.love ?? 0) >= births.PARTNER_BOND_FLOOR);
  assert.ok(bonded.length > 0, 'no bond formed in 2000 ticks; love is still written by nothing');

  const born = w.npcs.filter((n) => births.birthRecordFor(w, n.id) !== null);
  assert.ok(born.length > 0,
    `bonds formed but nobody was born in 2000 ticks (population ${before} -> ${w.npcs.length})`);
  assert.ok(born.every((n) => n.generation === 2));
});

test('a person bears, not a partnership', () => {
  // **Measured, not reasoned.** The first version drew once for every
  // fertile partnership, and a bond forms on contact alone — so a
  // well-connected person drew several times a tick and a 2,000-tick
  // world grew 21% in 2.2 simulated years, a crude birth rate near
  // 9.6% against a real pre-modern 4%.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const bearer = person(w, { communityId: c.id, age: 27 });
  const partners = [];
  for (let i = 0; i < 5; i += 1) {
    const p = person(w, { communityId: c.id, age: 30 });
    couple(w, bearer, p);
    partners.push(p);
  }
  assert.equal(births.fertilePartnerships(w).length, 5, 'the fixture has five partnerships');

  // Five partnerships, and the bearer is the same person in all five,
  // so at most one child can come of a tick.
  let ticks = 0;
  let born = 0;
  while (ticks < 4000 && born < 3) {
    ticks += 1;
    w.tick += 1;
    born += births.runBirths(w, w.tick).births.length;
  }
  assert.ok(born > 0, 'five partnerships produced nothing in 4000 ticks');

  const bornHere = births.birthsIn(w, c.id);
  const spacing = bornHere.map((n) => n.createdTick).sort((a, b) => a - b);
  for (let i = 1; i < spacing.length; i += 1) {
    assert.ok(spacing[i] - spacing[i - 1] >= births.GESTATION_TICKS,
      `two children ${spacing[i] - spacing[i - 1]} ticks apart, inside gestation`);
  }
});

test('gestation is read from world history, not from a field on the parent', () => {
  // Same discipline as `deathRecordFor`: the historical record is the
  // durable answer, so nothing has to keep a `last_borne_tick` column
  // correct.
  const w = world();
  const a = person(w, { age: 27 });
  const b = person(w, { age: 29 });
  assert.equal(births.lastBorneTick(w, a.id), null, 'somebody who has never borne has no date');

  births.bearChild(w, { bearerId: a.id, otherParentId: b.id, tick: 500 });
  assert.equal(births.lastBorneTick(w, a.id), 500);
  // The other parent did not bear, and must not be blocked by it.
  assert.equal(births.lastBorneTick(w, b.id), null);
});
