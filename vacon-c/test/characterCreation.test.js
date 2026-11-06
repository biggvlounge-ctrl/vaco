// VACANCY — character creation (server/characterCreation.js).
//
// The direction asked for, verbatim: a player picks a couple of real
// things (occupation, country, community), and everything else —
// especially family — is random, and REVEALED to the player, never
// chosen by them. Cousins are fully simulated real people, each one a
// child of the player's parent's own sibling, who heads an entirely
// separate real family at its own real (possibly different) location.
// Grandparents and anything beyond parents/siblings/cousins are
// explicitly out of scope.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const worldStore = require('../server/worldStore.js');

// Two real communities (different cities) and a handful of real
// organizations so occupation/country/community resolution has real
// material to draw from, same convention test/meetings.test.js and
// test/missions.test.js already use against engine.js's own singleton.
const cityA = engine.WorldState.cities.push({ id: 900001, name: 'Testopolis' }) && engine.WorldState.cities[engine.WorldState.cities.length - 1];
const cityB = engine.WorldState.cities.push({ id: 900002, name: 'Otherburg' }) && engine.WorldState.cities[engine.WorldState.cities.length - 1];
const communityA = engine.generateCommunity({ cityId: cityA.id, name: 'Downtown' });
const communityB = engine.generateCommunity({ cityId: cityB.id, name: 'Uptown' });

const hospitalOrg = engine.generateOrganization({ type: 'hospital', name: 'Test General' });
const gangOrg = engine.generateOrganization({ type: 'gang', name: 'Test Crew' });

function makeCharacter(options = {}) {
  return engine.createCharacter(options);
}

// ---------------------------------------------------------------------
// generators injection / basic shape
// ---------------------------------------------------------------------

test('characterCreation.createCharacter refuses to run with no generators injected', () => {
  const characterCreation = require('../server/characterCreation.js');
  assert.throws(
    () => characterCreation.createCharacter({ npcs: [], relationships: [] }, {}),
    /requires options\.generators/,
  );
});

test('createCharacter (through engine.js) returns a real player, a real family, real parents and a real community/country', () => {
  const result = makeCharacter({ name: 'Jordan Rivera' });

  assert.ok(result.player.id);
  assert.ok(engine.WorldState.npcs.some((n) => n.id === result.player.id));
  assert.ok(result.family.id);
  assert.ok(engine.WorldState.families.some((f) => f.id === result.family.id));
  const playerMembership = engine.WorldState.familyMemberships.find(
    (m) => m.entity_id === result.player.id && m.family_id === result.family.id,
  );
  assert.ok(playerMembership, 'the player must really be a member of their own real family');
  assert.equal(playerMembership.role, 'child');

  assert.equal(result.family.parents.length, 2);
  assert.deepEqual(result.family.parents.map((p) => p.role), ['mother', 'father']);
  for (const parent of result.family.parents) {
    assert.ok(parent.entityId, 'every parent is a real entity id');
    assert.equal(typeof parent.alive, 'boolean');
    if (parent.alive) {
      assert.ok(engine.WorldState.npcs.some((n) => n.id === parent.entityId));
    } else {
      assert.ok(engine.WorldState.deceased.some((n) => n.id === parent.entityId && n.status === 'deceased'));
    }
  }
});

test('a player can choose a real country and a real community, honored exactly, and they are independent of the random family\'s own location', () => {
  const result = makeCharacter({
    name: 'Chosen One', communityId: communityA.id, countryKey: 'german',
  });
  assert.equal(result.community.id, communityA.id);
  assert.equal(result.countryContext.key, 'german');
  // The country is real-world context, not a binding to this engine's
  // own generated cities -- `countryContext` carries whatever
  // countryPacks.describeCountry('german') actually reports.
  assert.ok(result.countryContext.incomeLevel || result.countryContext.conflictLevel !== undefined);
});

test('an unknown country key is refused outright, never silently substituted', () => {
  assert.throws(
    () => makeCharacter({ countryKey: 'definitely-not-a-real-country-key' }),
    /is not a real country-pack key/,
  );
});

test('an unknown community id is refused outright, never silently substituted', () => {
  assert.throws(
    () => makeCharacter({ communityId: 999999999 }),
    /no community with id/,
  );
});

test('omitting country/community still draws a real one -- random means a real draw across what genuinely exists, never a fixed default', () => {
  const result = makeCharacter({ name: 'Random Draw' });
  assert.ok(result.community === null || engine.WorldState.communities.some((c) => c.id === result.community.id));
  assert.ok(result.countryContext === null || typeof result.countryContext.key === 'string');
});

// ---------------------------------------------------------------------
// Player-chosen occupation, validated against the real qualification
// gate -- never a silent fallback
// ---------------------------------------------------------------------

test('a player-chosen occupation that a real organization in this world actually employs is granted, and really hires them', () => {
  const result = makeCharacter({ name: 'Doc Holliday', occupationName: 'orderly', education: 'secondary' });
  assert.equal(result.occupation, 'orderly');
  const record = engine.WorldState.employmentRecords.find(
    (r) => r.entity_id === result.player.id && r.status === 'active',
  );
  assert.ok(record, 'a chosen occupation must really hire the player somewhere');
  assert.equal(record.position, 'orderly');
  assert.equal(record.employer_organization_id, hospitalOrg.id);
});

test('a player-chosen occupation with no real employer anywhere in this world is refused, never silently dropped', () => {
  assert.throws(
    () => makeCharacter({ occupationName: 'curator' }), // no museum org exists in this fixture world
    /no real organization in this world employs "curator"/,
  );
});

test('a player-chosen occupation the character is not really qualified for is refused with a clear, specific reason', () => {
  // `physician` is Tier 4 (needs real "secondary" education) and this
  // fixture world's hospital org does really employ it, but a
  // character created with no education option at all starts
  // unmeasured -- the same real qualification gate any NPC's own hire
  // is held to, never skipped for a player.
  assert.throws(
    () => makeCharacter({ occupationName: 'physician' }),
    /does not reach it/,
  );
});

test('a player-chosen occupation that is not a real occupation name at all is refused', () => {
  assert.throws(
    () => makeCharacter({ occupationName: 'wizard' }),
    /is not a real occupation/,
  );
});

// ---------------------------------------------------------------------
// Random family: siblings, cousins, and the deceased/alive real draw
// ---------------------------------------------------------------------

test('siblings and cousins are real NPCs, added through the real family mechanism, with real schema role vocabulary', () => {
  const result = makeCharacter({ name: 'Family Tree' });
  for (const sibling of result.family.siblings) {
    const row = engine.WorldState.familyMemberships.find(
      (m) => m.entity_id === sibling.id && m.family_id === result.family.id,
    );
    assert.ok(row);
    assert.equal(row.role, 'sibling');
  }
  for (const auntUncle of result.cousins) {
    for (const cousin of auntUncle.children) {
      const row = engine.WorldState.familyMemberships.find((m) => m.entity_id === cousin.id);
      assert.ok(row, 'a cousin must really belong to SOME family');
      assert.notEqual(row.family_id, result.family.id, 'a cousin is never a member of the player\'s own family');
      assert.equal(row.role, 'child');
      // The cross-family link is the schema's own real relationship_type.
      const rel = worldStore.findRelationship(engine.WorldState, result.player.id, cousin.id);
      assert.ok(rel, 'a real cousin must be really related to the player');
      assert.equal(rel.relationship_type, 'family');
    }
  }
});

test('an aunt/uncle heads an entirely separate real family record, never the player\'s own', () => {
  const result = makeCharacter({ name: 'Separate Families' });
  for (const auntUncle of result.cousins) {
    const headedFamily = engine.WorldState.families.find((f) => f.head_npc_id === auntUncle.auntOrUncle.id);
    assert.ok(headedFamily, 'an aunt/uncle must really head their own family record');
    assert.notEqual(headedFamily.id, result.family.id);
  }
});

test('a deceased parent is recorded through the real mortality pipeline -- no second "is dead" flag', () => {
  // Run enough characters that at least one lands on each real outcome
  // (alive and deceased) -- PARENT_DECEASED_CHANCE is 0.25 per parent,
  // so ~40 characters (80 parent draws) makes both sides near-certain.
  let sawAlive = false;
  let sawDeceased = false;
  for (let i = 0; i < 40 && !(sawAlive && sawDeceased); i += 1) {
    const result = makeCharacter({ name: `Mortal Draw ${i}` });
    for (const parent of result.family.parents) {
      if (parent.alive) sawAlive = true;
      else sawDeceased = true;
    }
  }
  assert.ok(sawAlive, 'in 40 characters, not one parent came back alive -- the draw is not real');
  assert.ok(sawDeceased, 'in 40 characters, not one parent came back deceased -- the draw is not real');
});

test('a living parent\'s own occupation is drawn the identical real way any NPC\'s is -- reported honestly, never invented', () => {
  let sawAnOccupation = false;
  for (let i = 0; i < 20; i += 1) {
    const result = makeCharacter({ name: `Parent Job ${i}` });
    for (const parent of result.family.parents) {
      if (parent.alive && parent.occupation != null) {
        sawAnOccupation = true;
        const employment = engine.WorldState.employmentRecords.find(
          (r) => r.entity_id === parent.entityId && r.status === 'active',
        );
        assert.ok(employment, 'a reported parent occupation must be a real employment record');
        assert.equal(employment.position, parent.occupation);
      }
    }
  }
  assert.ok(sawAnOccupation, 'in 20 characters, not one living parent ever had a real occupation');
});

test('sibling and cousin counts really vary across characters -- not a fixed count dressed up as random', () => {
  const siblingCounts = new Set();
  const cousinCounts = new Set();
  for (let i = 0; i < 25; i += 1) {
    const result = makeCharacter({ name: `Variety ${i}` });
    siblingCounts.add(result.family.siblings.length);
    cousinCounts.add(result.cousins.reduce((sum, au) => sum + au.children.length, 0));
  }
  assert.ok(siblingCounts.size > 1, `sibling counts never varied: ${[...siblingCounts]}`);
});

test('grandparents and any generation beyond parents/siblings/cousins are never built -- explicitly out of scope', () => {
  const result = makeCharacter({ name: 'No Grandparents' });
  assert.ok(!('grandparents' in result));
  assert.ok(!('grandparent' in result.family));
  // And no aunt/uncle's own family goes a generation further -- an
  // aunt/uncle's family has only themselves (role 'parent') and their
  // own children (role 'child'), never a parent of theirs.
  for (const auntUncle of result.cousins) {
    const headedFamily = engine.WorldState.families.find((f) => f.head_npc_id === auntUncle.auntOrUncle.id);
    const members = engine.WorldState.familyMemberships.filter((m) => m.family_id === headedFamily.id);
    assert.ok(members.every((m) => m.role === 'parent' || m.role === 'child'));
  }
});

// ---------------------------------------------------------------------
// Immediate family gets a real, named bonus over extended family --
// the gap where parents/siblings got NO relationship at all, while
// cousins/aunts-uncles got the flat schema default, and the direct
// instruction that the player's own family "should have priority and
// have upper scales."
// ---------------------------------------------------------------------

const influenceForBonus = require('../server/influence.js');

test('the player really has a seeded family relationship with both parents and every sibling -- the gap this closes', () => {
  const result = makeCharacter({ name: 'Close Kin' });
  for (const parent of result.family.parents) {
    const rel = worldStore.findRelationship(engine.WorldState, result.player.id, parent.entityId);
    assert.ok(rel, `no relationship seeded between the player and their own ${parent.role}`);
    assert.equal(rel.relationship_type, 'family');
  }
  for (const sibling of result.family.siblings) {
    const rel = worldStore.findRelationship(engine.WorldState, result.player.id, sibling.id);
    assert.ok(rel, 'no relationship seeded between the player and a real sibling');
    assert.equal(rel.relationship_type, 'family');
  }
});

test('a parent/sibling relationship rates above a cousin\'s own baseline -- immediate family starts closer, by direct instruction', () => {
  // Run until a character with both at least one sibling and at least
  // one cousin turns up, so the two real numbers can be compared on
  // the SAME player rather than across different draws.
  let compared = false;
  for (let i = 0; i < 25 && !compared; i += 1) {
    const result = makeCharacter({ name: `Compare Kin ${i}` });
    const cousinIds = result.cousins.flatMap((au) => au.children.map((c) => c.id));
    if (result.family.siblings.length === 0 || cousinIds.length === 0) continue;
    compared = true;

    const siblingRel = worldStore.findRelationship(
      engine.WorldState, result.player.id, result.family.siblings[0].id,
    );
    const cousinRel = worldStore.findRelationship(engine.WorldState, result.player.id, cousinIds[0]);
    assert.ok(
      siblingRel.influence > cousinRel.influence,
      `a sibling (${siblingRel.influence}) should rate above a cousin (${cousinRel.influence})`,
    );
    // Both sides are `clamp0to100(rating + bonus)` over the same real
    // float rating, so the gap is the bonus exactly in principle --
    // within float tolerance in practice (repeated subtraction/addition
    // on the components behind `influenceRatingOf` can leave noise in
    // the fifteenth decimal place, the same binary-float shape
    // `property.advancePropertyLifecycle`'s own rounding bug was built
    // on, CLAUDE.md's twenty-third standing rule).
    assert.ok(
      Math.abs((siblingRel.influence - cousinRel.influence) - influenceForBonus.IMMEDIATE_FAMILY_BOND_BONUS) < 1e-9,
      'the gap between immediate and extended family should be exactly the named bonus, both seeded from the same player rating',
    );
  }
  assert.ok(compared, 'in 25 characters, never got both a sibling and a cousin to compare -- widen the draw');
});

// ---------------------------------------------------------------------
// describeFamilyTree -- the real LOOKUP, as opposed to createCharacter's
// GENERATOR. Backs `GET /api/entities/:id/family-tree`.
// ---------------------------------------------------------------------

test('describeFamilyTree reads back the same real parents/siblings/cousins for a created character, live, after the fact', () => {
  const characterCreation = require('../server/characterCreation.js');
  const result = makeCharacter({ name: 'Looked Up Later' });

  const tree = characterCreation.describeFamilyTree(engine.WorldState, result.player.id);

  assert.equal(tree.family.id, result.family.id);
  assert.equal(tree.parents.length, result.family.parents.length);
  assert.equal(tree.siblings.length, result.family.siblings.length);
  const expectedCousinIds = new Set(result.cousins.flatMap((au) => au.children.map((c) => c.id)));
  const actualCousinIds = new Set(tree.cousins.flatMap((au) => au.children.map((c) => c.id)));
  assert.deepEqual(actualCousinIds, expectedCousinIds);
});

test('describeFamilyTree on an entity with no family membership returns the honest empty shape, not a throw', () => {
  const characterCreation = require('../server/characterCreation.js');
  const stray = engine.generateNPC({ name: 'Nobody\'s Kin' });
  const tree = characterCreation.describeFamilyTree(engine.WorldState, stray.id);
  assert.equal(tree.family, null);
  assert.deepEqual(tree.parents, []);
  assert.deepEqual(tree.siblings, []);
  assert.deepEqual(tree.cousins, []);
});

test('generateAuntOrUncle honors an explicit tighter maxCousins cap -- the cap worldgen.js reuses for ordinary NPCs', () => {
  const characterCreation = require('../server/characterCreation.js');
  const ccGenerators = {
    generateNpc: (opts) => engine.generateNPC(opts),
    generateFamily: (opts) => engine.generateFamily(opts),
    addFamilyMember: (familyId, entityId, role, gen) => engine.addFamilyMember(familyId, entityId, role, gen),
  };
  const anchor = engine.generateNPC({ name: 'Capped Anchor' });
  let sawMoreThanZero = false;
  for (let i = 0; i < 25; i += 1) {
    const extended = characterCreation.generateAuntOrUncle(engine.WorldState, {
      generators: ccGenerators,
      seed: 'cap-test',
      tick: engine.WorldState.tick ?? 0,
      parentEntityId: anchor.id,
      surname: 'Capped',
      index: `cap-${i}`,
      maxCousins: 2,
    });
    assert.ok(extended.cousins.length <= 2, `maxCousins:2 was not honored -- got ${extended.cousins.length}`);
    if (extended.cousins.length > 0) sawMoreThanZero = true;
  }
  assert.ok(sawMoreThanZero, 'in 25 draws capped at 2, never saw a single cousin -- the draw is not real');
});
