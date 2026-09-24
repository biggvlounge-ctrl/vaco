// Tribe Growth & Mission Unlock — the document's own mechanic.
//
// ---------------------------------------------------------------------
// What this closes
// ---------------------------------------------------------------------
// `dev-docs/PLAYTEST_19_SEP_2026.md` finding 2: `mAvail 3, mDone 0`,
// constant across 600 ticks. `generateMission` had exactly one caller
// in the whole engine — `worldgen.js`, at tick 0 — so no world had
// ever had a fourth mission. The eleventh standing rule with the
// generator called precisely once at the beginning of time.
//
// The tests below are in two halves. The first holds the mechanic on
// hand-made fixtures, where the match can be constructed exactly. The
// second runs a REAL generated world, because the eleventh rule's whole
// point is that a fixture builds the rows the code under test reads and
// therefore cannot see a mechanism nothing reaches.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const tribeMissions = require('../server/tribeMissions.js');
const missions = require('../server/missions.js');
const occupations = require('../server/occupations.js');
const economy = require('../server/economy.js');

let nextId = 9000;

function world() {
  const w = {
    tick: 0,
    npcs: [], organizations: [], properties: [], communities: [], cities: [],
    families: [], familyMemberships: [], employmentRecords: [],
    artifacts: [], missions: [], events: [], entityTraits: [],
    seed: 'tribe-missions-test',
  };
  missions.reseedIds(w);
  economy.reseedIds(w);
  return w;
}

// A community, an organization that runs a building in it, and a tribe
// whose member holds the occupation that organization's type defines.
function scene(options = {}) {
  const { orgType = 'hospital', memberPosition = 'physician', sameCommunity = true } = options;
  const w = world();
  w.communities.push({ id: 1, city_id: 1 }, { id: 2, city_id: 1 });
  w.cities.push({ id: 1, name: 'Testburg' });

  const org = { id: nextId += 1, type: orgType, name: 'The Infirmary', assets: 10000 };
  w.organizations.push(org);

  const property = {
    id: nextId += 1, type: 'commercial', name: 'The Infirmary', community_id: 1,
    city_id: 1, lifecycle_stage: 'operation', operating_organization_id: org.id,
    occupants: [], condition: 80,
  };
  w.properties.push(property);

  const member = { id: nextId += 1, status: 'active', communityId: sameCommunity ? 1 : 2, createdTick: -10000 };
  w.npcs.push(member);
  w.families.push({ id: 77, unity: 50, conflict: 0 });
  w.familyMemberships.push({ entity_id: member.id, family_id: 77, role: 'member', generation_number: 1 });
  if (memberPosition) {
    economy.hireEntity(w, {
      entityId: member.id, employerOrganizationId: org.id, wage: 10, position: memberPosition,
    });
  }
  return { w, org, property, member };
}

// -- what a location asks for --------------------------------------------

test('a location asks for whatever its operator\'s type defines, and nothing otherwise', () => {
  // Read from `occupations.DEFINING_POST` rather than restated here —
  // this project keeps finding the same list spelled three ways in
  // three files, which is the third standing rule at the level of a
  // vocabulary.
  const { w, property } = scene({ orgType: 'hospital' });
  assert.equal(tribeMissions.requirementFor(w, property), occupations.postFor('hospital'));
  assert.equal(tribeMissions.requirementFor(w, property), 'physician');

  // A building nobody operates asks for nobody. This is the state 189
  // of 206 properties in a generated world are in, so it is the common
  // case rather than an edge one.
  const orphan = { id: 1, community_id: 1, operating_organization_id: null };
  assert.equal(tribeMissions.requirementFor(w, orphan), null);

  // And `business` defines no post on purpose — `occupations.js` argues
  // a business is not defined by one trade. A location run by one is
  // never unlocked this way, and that is the taxonomy's answer rather
  // than a gap here.
  const { w: bw, property: shop } = scene({ orgType: 'business' });
  assert.equal(tribeMissions.requirementFor(bw, shop), null);
});

// -- the match ------------------------------------------------------------

test('a tribe unlocks a nearby location its roster can staff', () => {
  const { w, property, member } = scene();
  const view = tribeMissions.unlockedFor(w, 77);
  assert.deepEqual(view.currentMemberOccupations, ['physician']);
  assert.equal(view.unlocked.length, 1);
  assert.equal(view.unlocked[0].locationId, property.id);
  assert.equal(view.unlocked[0].occupation, 'physician');
  assert.equal(view.unlocked[0].suggestedBy, member.id);
  // The document's enum has three sources and only one is honestly
  // reportable here; the other two would need a role model the family
  // sheet does not carry.
  assert.equal(view.unlocked[0].suggestionSource, 'the-new-member-themselves');
});

test('a tribe with the right trade in the wrong place unlocks nothing', () => {
  // The document says a NEARBY location, and the engine's unit of
  // nearness is the community — the same one `control.js` uses when it
  // says "the engineers three cities away are not going to help take
  // this building."
  const { w } = scene({ sameCommunity: false });
  assert.deepEqual(tribeMissions.unlockedFor(w, 77).unlocked, []);
});

test('a tribe with no trade at all unlocks nothing', () => {
  const { w } = scene({ memberPosition: null });
  const view = tribeMissions.unlockedFor(w, 77);
  assert.deepEqual(view.currentMemberOccupations, []);
  assert.deepEqual(view.unlocked, []);
});

test('the wrong trade does not open the door', () => {
  const { w } = scene({ memberPosition: 'cook' });
  assert.deepEqual(tribeMissions.unlockedFor(w, 77).unlocked, []);
});

test('a dead member staffs nothing', () => {
  // `occupationOf` reads an active employment record, which outlives
  // its holder in `worldState` until something ends it — so the living
  // check has to be here rather than assumed.
  const { w, member } = scene();
  assert.equal(tribeMissions.unlockedFor(w, 77).unlocked.length, 1);
  w.npcs = w.npcs.filter((n) => n.id !== member.id);
  assert.deepEqual(tribeMissions.unlockedFor(w, 77).unlocked, []);
});

// -- the pass -------------------------------------------------------------

test('the unlock opens a mission, and opens it exactly once', () => {
  // **The seventh standing rule.** A pass firing on the CONDITION
  // rather than the CROSSING puts an identical row in the log every
  // tick for as long as the condition holds. The memory here is the
  // mission itself — durable state the engine already keeps, not a
  // flag invented to remember a crossing.
  const { w, property } = scene();
  const first = tribeMissions.runTribeMissions(w, { tick: 1 });
  assert.equal(first.length, 1);
  assert.equal(first[0].type, 'mission_unlocked');
  assert.equal(w.missions.length, 1);
  assert.equal(w.missions[0].location_property_id, property.id);

  for (const tick of [2, 3, 50, 400]) {
    assert.deepEqual(tribeMissions.runTribeMissions(w, { tick }), [],
      `the unlock fired again at tick ${tick} — it is reading the condition, not the crossing`);
  }
  assert.equal(w.missions.length, 1);
});

test('two tribes qualifying for one building is one mission, not two', () => {
  // A mission belongs to a PLACE. That a hospital can be taken is a
  // fact about the hospital, and two tribes finding out separately does
  // not make two hospitals.
  const { w, member } = scene();
  const second = { id: nextId += 1, status: 'active', communityId: 1, createdTick: -10000 };
  w.npcs.push(second);
  w.families.push({ id: 78, unity: 50, conflict: 0 });
  w.familyMemberships.push({ entity_id: second.id, family_id: 78, role: 'member', generation_number: 1 });
  economy.hireEntity(w, {
    entityId: second.id, employerOrganizationId: w.organizations[0].id, wage: 10, position: 'physician',
  });
  assert.equal(tribeMissions.unlockedFor(w, 77).unlocked.length, 1);
  assert.equal(tribeMissions.unlockedFor(w, 78).unlocked.length, 1);
  assert.notEqual(member.id, second.id);

  assert.equal(tribeMissions.runTribeMissions(w, { tick: 1 }).length, 1);
  assert.equal(w.missions.length, 1);
});

test('a mission is about a thing or a place, and never about nothing', () => {
  // `missions.artifact_id` is nullable in the base schema and
  // `generateMission` refused a null anyway, on the stated grounds that
  // a mission is always FROM an artifact. That was right while the only
  // mission was "Recover it" and stopped being right when the takeover
  // mission arrived. The invariant worth keeping is the one underneath.
  const { w, property } = scene();
  assert.throws(() => missions.generateMission(w, { objective: 'Do something' }),
    /artifactId or a locationId/);
  assert.throws(() => missions.generateMission(w, { locationId: 999999 }),
    /no property with id/);
  const m = missions.generateMission(w, { locationId: property.id, objective: 'Take it' });
  assert.equal(m.artifact_id, null);
  assert.equal(m.location_property_id, property.id);
});

test('an artifact found at the location makes it a recovery instead', () => {
  const { w, property } = scene();
  const relic = missions.generateArtifact(w, { name: 'Brass Astrolabe', locationId: property.id });
  tribeMissions.runTribeMissions(w, { tick: 1 });
  assert.equal(w.missions.length, 1);
  assert.equal(w.missions[0].artifact_id, relic.id);
  assert.equal(w.missions[0].location_property_id, property.id);
  assert.match(w.missions[0].objective, /Recover Brass Astrolabe/);
});

test('rewards vary, because seededUnit takes a number and seededDraw takes parts', () => {
  // **This is standing rule 6 in the shape `environment.js` already
  // recorded.** `seededUnit(seed, 'mission-reward', id)` passes a
  // STRING as the seed; `'x' || 1` keeps the string, the bitwise ops
  // coerce it to 0, and the function returns 0 forever. Every reward
  // came out at exactly the floor. `environment.js` lost 200 ticks of
  // weather to the identical call and `migration.js` had it twice.
  const rewards = new Set();
  for (let i = 0; i < 6; i += 1) {
    const { w } = scene();
    // Distinct location ids across scenes, which is what the draw keys on.
    tribeMissions.runTribeMissions(w, { tick: 1 });
    for (const m of w.missions) rewards.add(Number(m.reward));
  }
  assert.ok(rewards.size > 1,
    `every reward came out the same (${[...rewards]}) — the seeded draw is returning a constant`);
  for (const r of rewards) {
    assert.ok(r >= tribeMissions.REWARD_FLOOR && r <= tribeMissions.REWARD_CEILING,
      `reward ${r} is outside the stated band`);
  }
});

// -- a real world ---------------------------------------------------------

test('a generated world unlocks missions, and the guard can fail', () => {
  // The eleventh standing rule: a fixture builds exactly the rows the
  // code under test reads, so it cannot see a mechanism nothing
  // reaches. This one runs the real generator.
  worldgen.generateWorld({ seed: 'tribe-missions' });
  const w = engine.WorldState;
  const before = w.missions.length;

  const atGeneration = tribeMissions.describeUnlocks(w);
  // **The substrate check that caught the real defect.** Before the
  // institutions were given buildings, exactly ONE property in a
  // generated world had an operator whose type defines a post — the
  // government seat — so the whole mechanic had one location it could
  // ever fire on, and the hospital was not it. The school, the
  // infirmary, the reading room, the press and both gangs had no
  // building anywhere.
  assert.ok(atGeneration.locationsAskingForSomebody >= 5,
    `only ${atGeneration.locationsAskingForSomebody} locations in a generated world ask for a `
    + 'specialist — the institutions are not being housed, so the mechanic has nowhere to fire');
  assert.ok(atGeneration.occupationsAskedFor.length >= 4,
    `only ${atGeneration.occupationsAskedFor.length} distinct occupations are asked for anywhere`);

  for (let i = 0; i < 20; i += 1) engine.advanceTick();

  const after = tribeMissions.describeUnlocks(w);
  assert.ok(w.missions.length > before,
    `missions went ${before} -> ${w.missions.length}: no world has ever had a fourth mission, `
    + 'which is what this file exists to change');
  assert.ok(after.tribesWithAnyUnlock > 0, 'no tribe can staff anything — the mechanic is inert');
  // A door open to everybody is not a door. The other way for this to
  // mean nothing.
  assert.ok(after.tribesWithAnyUnlock < after.tribes,
    'every tribe unlocks something, which makes the unlock carry no information');
});
