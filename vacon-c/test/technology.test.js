// Technology eras — §40's bottleneck chain, which was claimed twice
// before it was built.
//
// **The history matters because it is the point.** The implementation
// map first said §40 was BUILT, on the grounds that
// `technology_eras.requirements` is the dependency chain. It is — as a
// JSONB column in a table no engine code read, next to
// `civilization_technology_progress` and `civilizations`, all three
// dead. "The dependency chain exists" meant "a column exists where a
// dependency chain could go".
//
// So the assertions below are mostly about refusal: an era that is
// NOT reachable, and the reason it is not. A gate that never says no
// is not a gate, and that is exactly the state this replaces.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const technology = require('../server/technology.js');

function world({ reemergenceIndex = 100 } = {}) {
  const worldState = {
    tick: 10,
    npcs: [{ id: 1 }, { id: 2 }],
    reemergenceIndex,
    civilizations: [],
    technologyEras: [],
    civilizationTechnologyProgress: [],
  };
  technology.reseedIds(worldState);
  technology.seedTechnologyEras(worldState);
  return worldState;
}

// -- the ladder is the schema's ----------------------------------------

test('the ten eras and their order come from the schema, not from here', () => {
  // Verbatim from `technology_eras.name`'s enumeration comment. An
  // eleventh era, or a different order, would be inventing a
  // technology tree no source document specifies.
  assert.deepEqual(technology.ERA_NAMES, [
    'stone_tools', 'agriculture', 'metalworking', 'writing', 'engineering',
    'industrialization', 'electricity', 'computing', 'ai', 'advanced_robotics',
  ]);

  const w = world();
  assert.equal(w.technologyEras.length, 10);
  assert.deepEqual(w.technologyEras.map((e) => e.era_order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(w.technologyEras[0].name, 'stone_tools');
  assert.equal(w.technologyEras.at(-1).name, 'advanced_robotics');
});

test('seeding twice does not duplicate the ladder', () => {
  // A world that is restored and then seeded again is a real
  // sequence — `persistence.js` loads before `app.listen`, and a
  // second seed there would give every era two rows and two ids.
  const w = world();
  technology.seedTechnologyEras(w);
  assert.equal(w.technologyEras.length, 10);
  assert.equal(new Set(w.technologyEras.map((e) => e.id)).size, 10);
});

test('the first era requires nothing, so a collapsed world can start', () => {
  const w = world();
  assert.deepEqual(w.technologyEras[0].requirements.eras, []);
  assert.equal(w.technologyEras[0].requirements.minReemergence, 0);
  // And each later era requires exactly the one before it.
  for (let i = 1; i < 10; i += 1) {
    assert.deepEqual(w.technologyEras[i].requirements.eras, [technology.ERA_NAMES[i - 1]]);
  }
});

// -- civilizations ------------------------------------------------------

test('a civilization needs a name, a finite stability and a real era or null', () => {
  const w = world();
  assert.throws(() => technology.foundCivilization(w, {}), /requires a name/);
  assert.throws(() => technology.foundCivilization(w, {
    name: 'A', stabilityIndex: Number.NaN,
  }), /finite stabilityIndex/);
  // Free-text era would put a second, disagreeing answer next to
  // `civilization_technology_progress`.
  assert.throws(() => technology.foundCivilization(w, {
    name: 'A', era: 'steam',
  }), /era must be null or one of/);

  const civ = technology.foundCivilization(w, { name: 'Ozark Reach' });
  assert.equal(civ.era, null, 'a new civilization has reached no era yet');
  assert.equal(civ.stability_index, 50);
});

// -- the gate says no, and says why ------------------------------------

test('an era with an unmet prerequisite is refused, and names what is missing', () => {
  // **This is §40.** Before this module, nothing anywhere gated a
  // technology on anything.
  const w = world({ reemergenceIndex: 100 });
  const civ = technology.foundCivilization(w, { name: 'Ozark Reach' });

  const check = technology.canUnlock(w, { civilizationId: civ.id, eraName: 'writing' });
  assert.equal(check.ok, false);
  assert.match(check.reason, /requires metalworking/);
  assert.deepEqual(check.missingEras, ['metalworking']);
  assert.throws(() => technology.unlockEra(w, {
    civilizationId: civ.id, eraName: 'writing',
  }), /requires metalworking/);
  assert.equal(w.civilizationTechnologyProgress.length, 0);
});

test('a population that cannot sustain an era is refused, with the numbers', () => {
  // The world condition half of the gate. A bottleneck you cannot see
  // the reason for is not one anybody can act on, so the refusal
  // carries what was needed and what there was.
  const w = world({ reemergenceIndex: 15 });
  const civ = technology.foundCivilization(w, { name: 'Ozark Reach' });
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'stone_tools' });
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'agriculture' });

  const check = technology.canUnlock(w, { civilizationId: civ.id, eraName: 'metalworking' });
  assert.equal(check.ok, false);
  assert.match(check.reason, /reemergence 15 below the 20 this era needs/);
  assert.equal(check.needed, 20);
  assert.equal(check.have, 15);
});

test('an uncomputed reemergence index blocks rather than reading as zero', () => {
  // A world that has not ticked has an unknown capability, not none.
  // Treating null as 0 would be the same `Number(null)` mistake
  // `moodFor()` shipped.
  //
  // **This test found a real defect rather than confirming a fix.**
  // The first version of `canUnlock` checked the index whenever a
  // requirement was finite — and `stone_tools` requires 0, so an
  // un-ticked world was refused its FIRST era, which is the one thing
  // that zero exists to permit. A requirement of zero is not a
  // requirement.
  const w = world({ reemergenceIndex: null });
  const civ = technology.foundCivilization(w, { name: 'A' });
  assert.equal(technology.canUnlock(w, {
    civilizationId: civ.id, eraName: 'stone_tools',
  }).ok, true, 'an un-ticked world cannot even start');
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'stone_tools' });

  // Everything above the first era does need a known index.
  const check = technology.canUnlock(w, { civilizationId: civ.id, eraName: 'agriculture' });
  assert.equal(check.ok, false);
  assert.match(check.reason, /not computed yet/);
});

test('the first era is reachable from nothing, even at zero reemergence', () => {
  const w = world({ reemergenceIndex: 0 });
  const civ = technology.foundCivilization(w, { name: 'A' });
  assert.equal(technology.canUnlock(w, {
    civilizationId: civ.id, eraName: 'stone_tools',
  }).ok, true);
});

test('an unknown era or civilization is refused, and force does not help', () => {
  const w = world();
  const civ = technology.foundCivilization(w, { name: 'A' });
  assert.throws(() => technology.unlockEra(w, {
    civilizationId: civ.id, eraName: 'steam_power', force: true,
  }), /no era "steam_power"/);
  assert.throws(() => technology.unlockEra(w, {
    civilizationId: 999, eraName: 'stone_tools', force: true,
  }), /no civilization 999/);

  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'stone_tools' });
  assert.throws(() => technology.unlockEra(w, {
    civilizationId: civ.id, eraName: 'stone_tools', force: true,
  }), /already unlocked/);
  assert.equal(w.civilizationTechnologyProgress.length, 1, 'a duplicate progress row was written');
});

test('force skips a prerequisite, which is what a mid-ladder scenario needs', () => {
  // Named rather than implicit, so a forced unlock is visible at the
  // call site instead of being an emergent property of some flag.
  const w = world({ reemergenceIndex: 0 });
  const civ = technology.foundCivilization(w, { name: 'A' });
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'electricity', force: true });
  assert.equal(technology.unlockedEras(w, civ.id).length, 1);
  assert.equal(civ.era, 'electricity');
});

// -- unlocking ----------------------------------------------------------

test('unlocking records the tick and sets the civilization to its highest era', () => {
  const w = world({ reemergenceIndex: 100 });
  const civ = technology.foundCivilization(w, { name: 'A' });
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'stone_tools', tick: 11 });
  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'agriculture', tick: 12 });

  const unlocked = technology.unlockedEras(w, civ.id);
  assert.deepEqual(unlocked.map((p) => p.era.name), ['stone_tools', 'agriculture']);
  assert.equal(unlocked[1].unlocked_tick, 12);
  // Kept consistent here rather than left to callers, which is what
  // would put two disagreeing answers in the world.
  assert.equal(civ.era, 'agriculture');
});

test('nextEraFor answers "why is this world stuck"', () => {
  const w = world({ reemergenceIndex: 5 });
  const civ = technology.foundCivilization(w, { name: 'A' });

  let next = technology.nextEraFor(w, civ.id);
  assert.equal(next.eraName, 'stone_tools');
  assert.equal(next.blocked, false);

  technology.unlockEra(w, { civilizationId: civ.id, eraName: 'stone_tools' });
  next = technology.nextEraFor(w, civ.id);
  assert.equal(next.eraName, 'agriculture');
  assert.equal(next.blocked, true);
  assert.equal(next.needed, 10);
  assert.equal(next.have, 5);
});

test('a fully advanced civilization reports nothing left rather than blocking', () => {
  const w = world({ reemergenceIndex: 100 });
  const civ = technology.foundCivilization(w, { name: 'A' });
  for (const eraName of technology.ERA_NAMES) {
    technology.unlockEra(w, { civilizationId: civ.id, eraName });
  }
  const next = technology.nextEraFor(w, civ.id);
  assert.equal(next.eraName, null);
  assert.equal(next.blocked, false);
  assert.match(next.reason, /every era is unlocked/);
});

// -- the tick -----------------------------------------------------------

test('a tick advances one era at most, not every era it qualifies for', () => {
  // **The case this guards.** A world that sat below a threshold for a
  // hundred ticks and then crossed it should not jump from stone tools
  // to computing because the index rose — the ladder is a history, not
  // a lookup.
  const w = world({ reemergenceIndex: 100 });
  const civ = technology.foundCivilization(w, { name: 'A' });

  const first = technology.runTechnology(w, 11);
  assert.equal(first.unlocks.length, 1);
  assert.equal(first.events[0].type, 'technology_era_unlocked');
  assert.equal(first.events[0].era, 'stone_tools');
  assert.equal(civ.era, 'stone_tools');

  technology.runTechnology(w, 12);
  assert.equal(technology.unlockedEras(w, civ.id).length, 2);
  assert.equal(civ.era, 'agriculture');
});

test('a blocked world advances nothing and emits nothing', () => {
  const w = world({ reemergenceIndex: 5 });
  const civ = technology.foundCivilization(w, { name: 'A' });
  technology.runTechnology(w, 11); // stone_tools, free
  const blocked = technology.runTechnology(w, 12);
  assert.deepEqual(blocked.unlocks, []);
  assert.deepEqual(blocked.events, []);
  assert.equal(civ.era, 'stone_tools');
});

test('two civilizations climb independently', () => {
  const w = world({ reemergenceIndex: 100 });
  const a = technology.foundCivilization(w, { name: 'A' });
  const b = technology.foundCivilization(w, { name: 'B' });
  technology.runTechnology(w, 11);
  technology.unlockEra(w, { civilizationId: a.id, eraName: 'agriculture', tick: 11 });

  assert.equal(technology.unlockedEras(w, a.id).length, 2);
  assert.equal(technology.unlockedEras(w, b.id).length, 1);
  assert.equal(a.era, 'agriculture');
  assert.equal(b.era, 'stone_tools');
});

test('ids survive a reseed', () => {
  const w = world();
  const civ = technology.foundCivilization(w, { name: 'A' });
  const seeded = technology.reseedIds(w);
  assert.equal(seeded.nextCivilizationId, civ.id + 1);
  assert.equal(seeded.nextTechnologyEraId, 11, 'ten eras, so the next id is 11');
  assert.notEqual(technology.foundCivilization(w, { name: 'B' }).id, civ.id);
});
