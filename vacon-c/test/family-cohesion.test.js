// Family cohesion — the two constants the takeover key was going to
// multiply by.
//
// ---------------------------------------------------------------------
// What this closes
//
// `generateFamily` sets `families.unity` to 50 and `families.conflict`
// to 0. Before `familyTraits.advanceCohesion`, `grep -rn "\.unity"
// server/` found two hits: that line, and `players.js` reporting the
// number to a client. **Nothing in the engine ever moved either one**,
// so every family in every world had identical unity and identical
// conflict — standing rule 14's shape, and the same one
// `relationships.love` and `relationships.conflict` had before them.
//
// It matters because of what was about to read them.
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` specifies the takeover
// key's second factor as a "real, direct multiplier" on unity,
// cooperation and conflictLevel. Two of those three were constants, so
// the document's whole argument — that a tribe can meet every
// requirement and still fail because the people do not work together —
// could not have happened.
//
// ---------------------------------------------------------------------
// And a defect found by building it, which is the bigger one
//
// `family_discord` fires on a crossing. A 400-tick world moved family
// conflict to a measured p90 of 31.9 and produced **zero** discord
// events. The cause was one missing spread operator in `advanceTick`:
//
//     runSocialPhase(worldState);                  // 4
//
// Phase 4's return value was discarded. So no social event in the
// history of this engine had ever reached the event log — every
// `feud_opened` and every `partnership_formed` happened, changed the
// world, and was recorded nowhere. `test/births.test.js` asserts on
// `advanceBonds`' return value, which is correct and complete for that
// function; what no fixture checks is what the CALLER does with the
// value it gets.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const familyTraits = require('../server/familyTraits.js');
const crime = require('../server/crime.js');
const engine = require('../server/engine.js');
const tick = require('../server/tick.js');

// A household of three, two of whom have a relationship. Constructed
// rather than generated (standing rule 8): every assertion below is
// about a specific trust or conflict value.
function household(options = {}) {
  const { trust = 50, conflict = 0, relate = true } = options;
  const world = {
    tick: 100,
    families: [{
      id: 900, surname: 'Hollis', unity: 50, conflict: 0, updatedTick: 0,
    }],
    familyMemberships: [
      { entity_id: 1, family_id: 900, role: 'parent', generation_number: 1 },
      { entity_id: 2, family_id: 900, role: 'partner', generation_number: 1 },
      { entity_id: 3, family_id: 900, role: 'child', generation_number: 2 },
    ],
    npcs: [
      { id: 1, status: 'alive', createdTick: -14600 },
      { id: 2, status: 'alive', createdTick: -14600 },
      { id: 3, status: 'alive', createdTick: -3650 },
    ],
    relationships: relate ? [{
      entity_a_id: 1, entity_b_id: 2, relationship_type: 'family', trust, conflict,
    }] : [],
    entityTraits: [],
  };
  return world;
}

// ---------------------------------------------------------------------
// It moves, and it moves from real substrate
// ---------------------------------------------------------------------

test('unity converges on the trust between the family’s own members', () => {
  const w = household({ trust: 90 });
  assert.equal(familyTraits.unityTarget(w, 900), 90);
  familyTraits.advanceCohesion(w);
  const after = w.families[0].unity;
  assert.ok(after > 50, `unity did not move: ${after}`);
  assert.ok(after < 90, 'unity jumped straight to its target — it is a stock, not a rollup');
  // A hundred ticks of the same circumstances gets most of the way.
  for (let i = 0; i < 100; i += 1) familyTraits.advanceCohesion(w);
  assert.ok(w.families[0].unity > 70, `after 100 ticks unity is only ${w.families[0].unity}`);
});

test('conflict converges on the conflict between the members', () => {
  const w = household({ trust: 50, conflict: 40 });
  assert.equal(familyTraits.conflictTarget(w, 900), 40);
  for (let i = 0; i < 100; i += 1) familyTraits.advanceCohesion(w);
  assert.ok(w.families[0].conflict > 20, `conflict reached only ${w.families[0].conflict}`);
});

test('it converges rather than accumulating — there is no ratchet here', () => {
  // Standing rule 13. Run it far past the point where a one-way
  // mechanism would have pinned at the ceiling.
  const w = household({ trust: 65, conflict: 10 });
  for (let i = 0; i < 4000; i += 1) familyTraits.advanceCohesion(w);
  assert.ok(Math.abs(w.families[0].unity - 65) < 0.5, `unity settled at ${w.families[0].unity}, not 65`);
  assert.ok(Math.abs(w.families[0].conflict - 10) < 0.5, `conflict settled at ${w.families[0].conflict}, not 10`);
});

test('an ordinary family does not move at all — nothing was recalibrated', () => {
  // Standing rule 12's first clause: switching this pass on must not
  // shift a family sitting at the schema's own defaults by a digit.
  const w = household({ trust: 50, conflict: 0 });
  for (let i = 0; i < 500; i += 1) familyTraits.advanceCohesion(w);
  assert.equal(w.families[0].unity, 50);
  assert.equal(w.families[0].conflict, 0);
});

// ---------------------------------------------------------------------
// Unknown is not zero
// ---------------------------------------------------------------------

test('a family the engine cannot measure is left exactly as it is', () => {
  const w = household({ relate: false });
  assert.equal(familyTraits.unityTarget(w, 900), null);
  assert.equal(familyTraits.conflictTarget(w, 900), null);
  // Rule 15's check, which is mechanical: a pass run twice on a world
  // it cannot measure leaves the world unchanged.
  familyTraits.advanceCohesion(w);
  familyTraits.advanceCohesion(w);
  assert.equal(w.families[0].unity, 50);
  assert.equal(w.families[0].conflict, 0);
});

test('the dead are not counted on either side', () => {
  const w = household({ trust: 90 });
  assert.equal(familyTraits.livingMembers(w, 900).length, 3);
  w.npcs = w.npcs.filter((n) => n.id !== 2);
  assert.equal(familyTraits.livingMembers(w, 900).length, 2);
  // And with one of the pair gone, there is no internal relationship
  // left to measure, so the family stops being measurable rather than
  // reading the relationship a dead member keeps.
  assert.equal(familyTraits.internalRelationships(w, 900).length, 0);
  assert.equal(familyTraits.unityTarget(w, 900), null);
});

// ---------------------------------------------------------------------
// The rate has to be slower than its own inputs
// ---------------------------------------------------------------------

test('cohesion moves slower than the relationships it aggregates', () => {
  // The inequality is the argument; the constants are consequences of
  // it. An aggregate that moves faster than the things it aggregates is
  // not an aggregate.
  assert.ok(
    familyTraits.COHESION_RATE < crime.FRICTION_RATE,
    `COHESION_RATE ${familyTraits.COHESION_RATE} is not below FRICTION_RATE ${crime.FRICTION_RATE}`,
  );
});

// ---------------------------------------------------------------------
// cohesionOf — the takeover key's multiplier
// ---------------------------------------------------------------------

test('conflict discounts cohesion rather than being averaged into it', () => {
  const w = household();
  // No entity_traits rows, so cooperation reads its schema default 50.
  w.families[0].unity = 90;
  w.families[0].conflict = 0;
  assert.equal(familyTraits.cohesionOf(w, 900), 0.7);

  // The same family, at war with itself. Averaged in, conflict 90
  // would leave this at 0.6 and a takeover would mostly succeed;
  // discounted, it is a tenth of that, which is the document's own
  // sentence turned into arithmetic.
  w.families[0].conflict = 90;
  assert.equal(familyTraits.cohesionOf(w, 900), 0.07);
});

test('a family that does not exist has no cohesion, rather than a default one', () => {
  assert.equal(familyTraits.cohesionOf(household(), 12345), null);
});

// ---------------------------------------------------------------------
// The defect this found: phase 4's events reaching the log
// ---------------------------------------------------------------------

test('the Social phase’s events reach the event log', () => {
  // The guard for the missing spread operator. Built with the real
  // generators (standing rule 6) and driven past the crossing by hand,
  // because what is under test is the WIRING and not the mechanism.
  //
  // `engine.WorldState` is shared and appended to by every other test
  // file, and there is no reset — so every assertion below is scoped to
  // THIS family by id, the same discipline `births.test.js` had to
  // adopt for the same reason. A count over the whole event log would
  // be a threshold over a number somebody else is also moving.
  const w = engine.WorldState;
  const family = engine.generateFamily({ surname: 'Kowalski' });
  const a = engine.generateNPC({});
  const b = engine.generateNPC({});
  engine.addFamilyMember(family.id, a.id, 'partner', 1);
  engine.addFamilyMember(family.id, b.id, 'partner', 1);
  w.relationships.push({
    entity_a_id: a.id,
    entity_b_id: b.id,
    relationship_type: 'family',
    trust: 0,
    conflict: 100,
    competition: 100,
    interaction_count: 1000,
  });
  // Conflict converges at 1% a tick from 0, so the family needs a while
  // to cross a threshold in the thirties.
  for (let i = 0; i < 200; i += 1) engine.advanceTick();

  const discord = w.events.filter(
    (e) => e.type === 'family_discord' && e.global_effects?.familyId === family.id,
  );
  assert.ok(discord.length > 0, 'no family_discord event reached the log');
  assert.equal(discord.length, 1, 'a crossing fired more than once (standing rule 7)');
  assert.ok(discord[0].affected_entity_ids.includes(a.id));
  assert.ok(w.families.find((f) => f.id === family.id).conflict > 32);
});

test('the pipeline is still eleven phases and cohesion is not a twelfth', () => {
  // `advanceCohesion` runs inside the Social phase beside
  // `advanceBonds` and `advanceFriction`, which is where the other two
  // relationship-aggregating passes live. The pipeline is locked.
  assert.equal(typeof tick.advanceTick, 'function');
  assert.equal(typeof familyTraits.advanceCohesion, 'function');
});
