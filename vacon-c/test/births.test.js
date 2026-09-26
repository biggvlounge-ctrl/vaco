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
const { INDIVIDUAL_DEFINITIONS, getTraitId } = require('../server/traitDefinitions.js');
const { generateEntityTraits, getLiveEntity } = require('../server/entityTraits.js');
const worldStore = require('../server/worldStore.js');

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

// Overwrites one already-generated trait row in place — `person()`
// builds every row through the real generator, so this changes a
// single value rather than building a fixture by hand.
function setTrait(worldState, entityId, family, name, value) {
  const traitId = getTraitId(family, name);
  const row = worldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === traitId,
  );
  if (!row) throw new Error(`setTrait: no ${family}.${name} row for entity ${entityId}`);
  row.base_value = value;
  row.temporary_modifier = 0;
  row.permanent_modifier = 0;
  row.experience_modifier = 0;
  row.environmental_modifier = 0;
  row.relationship_modifier = 0;
  row.key_modifier = 0;
  row.current_value = value;
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

test('contact still accumulates when there is nothing to reassess', () => {
  // **The regression guard for the Social phase's memory fix.** That
  // phase used to resolve Trust for every relationship every tick and
  // write a "Trust reassessed: 50 -> 50" memory even when nothing had
  // changed — 53,401 memories after 120 ticks on a generated world,
  // growing without bound. It now runs the Key only when there is
  // knowledge to reassess against.
  //
  // The risk in that fix is precisely here: `interaction_count` is
  // what `advanceBonds` reads, and if it stopped incrementing on a
  // quiet tick then no bond would ever form and nobody would be born
  // — the same class of silent break as `love` being written by
  // nothing. So contact is asserted directly.
  const engine = require('../server/engine.js');
  const worldStore = require('../server/worldStore.js');
  const areaStats = require('../server/areaStats.js');
  const territory = require('../server/territory.js');
  const ew = engine.WorldState;

  const city = territory.generateCity(ew, { name: `Contact ${nextId++}` });
  const block = territory.generateCommunity(ew, { cityId: city.id });
  const a = engine.generateNPC();
  const b = engine.generateNPC();
  for (const npc of [a, b]) {
    npc.createdTick = ew.tick - Math.round(27 * mortality.TICKS_PER_YEAR);
    areaStats.placeInCommunity(ew, { entityId: npc.id, communityId: block.id });
    economy.generateIndividualFinances(ew, npc.id, { savings: 300, tick: ew.tick });
  }
  const rel = worldStore.getOrCreateRelationship(ew, a.id, b.id, 'social');
  const before = rel.interaction_count;
  // **Counted for THESE two people, not for the whole world.** The
  // first version measured `ew.memories.length`, which is the shared
  // engine WorldState — every NPC any earlier test left in it now
  // reflects on its own situation weekly, so the total rose for
  // reasons that have nothing to do with the Social phase. A threshold
  // over a number somebody else is also moving is not a measurement.
  const mine = new Set([a.id, b.id]);
  const memoriesBefore = ew.memories.filter((m) => mine.has(m.entity_id)).length;

  for (let t = 0; t < 60; t += 1) engine.advanceTick();

  assert.ok(rel.interaction_count >= before + 60,
    'contact stopped accumulating on quiet ticks, so no bond can ever form');
  const theirs = ew.memories.filter((m) => mine.has(m.entity_id)).length - memoriesBefore;
  // Two people over sixty ticks: a weekly reflection each is about
  // seventeen. A memory per relationship per tick would be sixty.
  assert.ok(theirs < 60,
    `the Social phase wrote ${theirs} memories for two people in 60 ticks`);
});

// ---------------------------------------------------------------------
// Libido and Fidelity — added 26 Sep 2026
// ---------------------------------------------------------------------

test('both multipliers are neutral at the trait default, so an average person is unchanged', () => {
  assert.equal(births.libidoMultiplier(50), 1);
  assert.equal(births.fidelityMultiplier(50), 1);
  assert.equal(births.libidoMultiplier(undefined), 1, 'a missing value should read as the default');
  assert.equal(births.fidelityMultiplier(null), 1, 'a missing value should read as the default');
});

test('libido raises the multiplier, fidelity lowers it, at the extremes', () => {
  assert.equal(births.libidoMultiplier(0), 0.5);
  assert.equal(births.libidoMultiplier(100), 1.5);
  assert.equal(births.fidelityMultiplier(0), 1.5);
  assert.equal(births.fidelityMultiplier(100), 0.5);
});

test('otherPartnersOf finds every other partner above the floor and excludes the one named', () => {
  const w = world();
  const a = person(w, { age: 30 });
  const b = person(w, { age: 30 });
  const c = person(w, { age: 30 });
  const d = person(w, { age: 30 }); // below the floor, not a partner
  couple(w, a, b, births.PARTNER_BOND_FLOOR);
  couple(w, a, c, births.PARTNER_BOND_FLOOR + 5);
  couple(w, a, d, births.PARTNER_BOND_FLOOR - 10);

  assert.deepEqual(new Set(births.otherPartnersOf(w, a.id, b.id)), new Set([c.id]));
  assert.deepEqual(new Set(births.otherPartnersOf(w, a.id, null)), new Set([b.id, c.id]));
});

test('a high-libido pair bonds faster than an ordinary pair under identical conditions', () => {
  const w = world();
  const hot1 = person(w, { age: 30 });
  const hot2 = person(w, { age: 30 });
  setTrait(w, hot1.id, 'emotional', 'Libido', 100);
  setTrait(w, hot2.id, 'emotional', 'Libido', 100);
  w.relationships.push({
    id: nextId++, entity_a_id: hot1.id, entity_b_id: hot2.id, relationship_type: 'social',
    love: 0, trust: 50, conflict: 0, interaction_count: births.BOND_CONTACT_FLOOR,
  });

  const cold1 = person(w, { age: 30 });
  const cold2 = person(w, { age: 30 });
  setTrait(w, cold1.id, 'emotional', 'Libido', 50);
  setTrait(w, cold2.id, 'emotional', 'Libido', 50);
  w.relationships.push({
    id: nextId++, entity_a_id: cold1.id, entity_b_id: cold2.id, relationship_type: 'social',
    love: 0, trust: 50, conflict: 0, interaction_count: births.BOND_CONTACT_FLOOR,
  });

  for (let t = 1; t <= 5; t += 1) births.advanceBonds(w, t);

  const hotLove = w.relationships.find((r) => r.entity_a_id === hot1.id).love;
  const coldLove = w.relationships.find((r) => r.entity_a_id === cold1.id).love;
  assert.ok(hotLove > coldLove, `high libido (${hotLove}) did not outgrow the ordinary pair (${coldLove})`);
});

test('high fidelity slows growing a second bond; low fidelity speeds it up', () => {
  function trial(fidelityValue) {
    const w = world();
    const a = person(w, { age: 30 });
    const existingPartner = person(w, { age: 30 });
    const rival = person(w, { age: 30 });
    setTrait(w, a.id, 'emotional', 'Fidelity', fidelityValue);
    setTrait(w, a.id, 'emotional', 'Libido', 50);
    setTrait(w, rival.id, 'emotional', 'Libido', 50);
    setTrait(w, rival.id, 'psychological', 'Paranoia', 0);
    setTrait(w, existingPartner.id, 'psychological', 'Paranoia', 0);
    // An already-established partnership, well above the floor.
    couple(w, a, existingPartner, 90);
    // A second relationship, just starting to grow.
    w.relationships.push({
      id: nextId++, entity_a_id: a.id, entity_b_id: rival.id, relationship_type: 'social',
      love: 0, trust: 50, conflict: 0, interaction_count: births.BOND_CONTACT_FLOOR,
    });
    for (let t = 1; t <= 5; t += 1) births.advanceBonds(w, t);
    return w.relationships.find((r) => r.entity_a_id === a.id && r.entity_b_id === rival.id).love;
  }

  const faithful = trial(100);
  const unfaithful = trial(0);
  assert.ok(unfaithful > faithful,
    `low fidelity (${unfaithful}) did not grow a second bond faster than high fidelity (${faithful})`);
});

test('fidelity does not slow anybody down before they have an existing partner', () => {
  const w = world();
  const a = person(w, { age: 30 });
  const b = person(w, { age: 30 });
  setTrait(w, a.id, 'emotional', 'Fidelity', 100);
  setTrait(w, a.id, 'emotional', 'Libido', 50);
  setTrait(w, b.id, 'emotional', 'Libido', 50);
  // A fixed, known attraction match (both at the trait default) so the
  // expected growth is computable rather than random — `Sexuality` and
  // `Gender Expression` matching exactly is a real, above-average
  // compatibility (see MEASURED_MEAN_COMPATIBILITY), not 1x, and the
  // test computes that expectation through the real function instead of
  // assuming it away.
  for (const [id, family, name] of [
    [a.id, 'emotional', 'Gender Expression'], [a.id, 'emotional', 'Sexuality'],
    [b.id, 'emotional', 'Gender Expression'], [b.id, 'emotional', 'Sexuality'],
  ]) setTrait(w, id, family, name, 50);
  w.relationships.push({
    id: nextId++, entity_a_id: a.id, entity_b_id: b.id, relationship_type: 'social',
    love: 0, trust: 50, conflict: 0, interaction_count: births.BOND_CONTACT_FLOOR,
  });
  const expectedCompatibility = births.attractionCompatibility(
    getLiveEntity(w, a.id), getLiveEntity(w, b.id),
  );
  births.advanceBonds(w, 1);
  const love = w.relationships.find((r) => r.entity_a_id === a.id).love;
  assert.equal(love, births.BOND_GROWTH * expectedCompatibility,
    'fidelity applied even with no existing partner to be unfaithful to');
});

// `BOND_GROWTH` (0.25/tick) times the multipliers below crosses one
// point in two or three ticks, not one — so every trial here runs
// several ticks and asks whether a crossing (and therefore a discovery
// chance) happened ANYWHERE in the run, not on the first tick alone.
const DISCOVERY_TRIAL_TICKS = 10;

function setUpAffair(w, { existingPartnerParanoia }) {
  const unfaithful = person(w, { age: 30 });
  const existingPartner = person(w, { age: 30 });
  const rival = person(w, { age: 30 });
  setTrait(w, existingPartner.id, 'psychological', 'Paranoia', existingPartnerParanoia);
  setTrait(w, unfaithful.id, 'emotional', 'Libido', 100);
  setTrait(w, unfaithful.id, 'emotional', 'Fidelity', 0); // strays as fast as this model allows
  setTrait(w, rival.id, 'emotional', 'Libido', 100);
  couple(w, unfaithful, existingPartner, 90);
  w.relationships.push({
    id: nextId++, entity_a_id: unfaithful.id, entity_b_id: rival.id, relationship_type: 'social',
    love: births.PARTNER_BOND_FLOOR - 1, trust: 50, conflict: 0,
    interaction_count: births.BOND_CONTACT_FLOOR,
  });
  return { unfaithful, existingPartner, rival };
}

test('a partner with high paranoia discovers a new bond far more often than one with none', () => {
  function trialsDiscovering(paranoia, count) {
    let discovered = 0;
    for (let i = 0; i < count; i += 1) {
      const w = world();
      setUpAffair(w, { existingPartnerParanoia: paranoia });
      let anyDiscovered = false;
      for (let t = 1; t <= DISCOVERY_TRIAL_TICKS; t += 1) {
        const events = births.advanceBonds(w, i * DISCOVERY_TRIAL_TICKS + t);
        if (events.some((e) => e.type === 'infidelity_discovered')) anyDiscovered = true;
      }
      if (anyDiscovered) discovered += 1;
    }
    return discovered;
  }

  const paranoidDiscoveries = trialsDiscovering(100, 60);
  const trustingDiscoveries = trialsDiscovering(0, 60);
  assert.ok(paranoidDiscoveries > trustingDiscoveries,
    `a paranoid partner (${paranoidDiscoveries}/60) did not discover more than a trusting one (${trustingDiscoveries}/60)`);
  assert.ok(trustingDiscoveries < 60, 'even a floor chance should not discover every single time');
});

test('discovery costs the existing partnership real trust, love and conflict', () => {
  const w = world();
  const { unfaithful, existingPartner } = setUpAffair(w, { existingPartnerParanoia: 100 });
  const before = { ...worldStore.getOrCreateRelationship(w, unfaithful.id, existingPartner.id, 'social') };

  let discovered = false;
  for (let t = 1; t <= DISCOVERY_TRIAL_TICKS && !discovered; t += 1) {
    const events = births.advanceBonds(w, t);
    if (events.some((e) => e.type === 'infidelity_discovered')) discovered = true;
  }
  assert.ok(discovered, 'a fully paranoid partner failed to discover an infidelity');

  const after = worldStore.getOrCreateRelationship(w, unfaithful.id, existingPartner.id, 'social');
  assert.ok(after.trust < before.trust);
  assert.ok(after.love < before.love);
  assert.ok(after.conflict > before.conflict);
});

// ---------------------------------------------------------------------
// Gender Expression and Sexuality — added 26 Sep 2026
// ---------------------------------------------------------------------

test('attraction is at its floor and no lower at the far end of the scale', () => {
  assert.equal(births.attractionOf(0, 100), births.ATTRACTION_FLOOR);
  assert.equal(births.attractionOf(100, 0), births.ATTRACTION_FLOOR);
});

test('attraction peaks when a partner sits exactly where sexuality points', () => {
  assert.equal(births.attractionOf(50, 50), 1);
  assert.equal(births.attractionOf(0, 0), 1);
  assert.equal(births.attractionOf(100, 100), 1);
});

test('the whole spectrum is one continuum: nothing here assigns an orientation label', () => {
  // Drawn to people like yourself, drawn to people unlike yourself, and
  // everything between are the same formula at different inputs — the
  // point of building it this way rather than as an enum.
  const drawnToSimilar = births.attractionOf(/* sexuality */ 80, /* partner's expression */ 80);
  const drawnToOpposite = births.attractionOf(/* sexuality */ 80, /* partner's expression */ 20);
  const drawnBroadly = births.attractionOf(/* sexuality */ 50, /* partner's expression */ 70);
  assert.ok(drawnToSimilar > drawnToOpposite);
  assert.ok(drawnBroadly > births.ATTRACTION_FLOOR);
});

test('an average pairing bonds at exactly the rate this file always used, before either trait existed', () => {
  // The population mean, not a specific value — this is the twelfth
  // standing rule's discipline applied to a trait PAIR rather than one
  // trait, and MEASURED_MEAN_COMPATIBILITY is what makes it hold: a
  // pairing at that exact measured average compatibility should
  // land back on a 1x multiplier once normalised.
  const w = world();
  const a = person(w, { age: 30 });
  const b = person(w, { age: 30 });
  setTrait(w, a.id, 'emotional', 'Libido', 50);
  setTrait(w, b.id, 'emotional', 'Libido', 50);
  // Construct a pairing whose raw compatibility equals the measured
  // population mean exactly, by placing the distance so that
  // 1 - distance/100 == MEASURED_MEAN_COMPATIBILITY in both directions.
  const distance = Math.round((1 - births.MEASURED_MEAN_COMPATIBILITY) * 100);
  setTrait(w, a.id, 'emotional', 'Sexuality', 50);
  setTrait(w, a.id, 'emotional', 'Gender Expression', 50);
  setTrait(w, b.id, 'emotional', 'Sexuality', 50 + distance);
  setTrait(w, b.id, 'emotional', 'Gender Expression', 50 + distance);
  const liveA = getLiveEntity(w, a.id);
  const liveB = getLiveEntity(w, b.id);
  const compatibility = births.attractionCompatibility(liveA, liveB);
  assert.ok(Math.abs(compatibility - 1) < 0.02,
    `a mean-compatibility pairing should normalise to ~1x, got ${compatibility}`);
});

test('a well-matched pairing bonds faster than a poorly-matched one, all else equal', () => {
  function trial(aSexuality, aExpression, bSexuality, bExpression) {
    const w = world();
    const a = person(w, { age: 30 });
    const b = person(w, { age: 30 });
    setTrait(w, a.id, 'emotional', 'Libido', 50);
    setTrait(w, b.id, 'emotional', 'Libido', 50);
    setTrait(w, a.id, 'emotional', 'Sexuality', aSexuality);
    setTrait(w, a.id, 'emotional', 'Gender Expression', aExpression);
    setTrait(w, b.id, 'emotional', 'Sexuality', bSexuality);
    setTrait(w, b.id, 'emotional', 'Gender Expression', bExpression);
    w.relationships.push({
      id: nextId++, entity_a_id: a.id, entity_b_id: b.id, relationship_type: 'social',
      love: 0, trust: 50, conflict: 0, interaction_count: births.BOND_CONTACT_FLOOR,
    });
    births.advanceBonds(w, 1);
    return w.relationships.find((r) => r.entity_a_id === a.id).love;
  }

  // A drawn to B's expression exactly, and B drawn to A's exactly.
  const wellMatched = trial(70, 70, 70, 70);
  // A drawn to the opposite of what B presents, and vice versa.
  const poorlyMatched = trial(70, 70, 0, 0);
  assert.ok(wellMatched > poorlyMatched,
    `a well-matched pair (${wellMatched}) did not outgrow a poorly-matched one (${poorlyMatched})`);
});
