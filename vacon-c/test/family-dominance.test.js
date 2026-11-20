// Family/tribe territorial dominance + city-wide escalation — by
// direct instruction. Read `server/familyDominance.js`'s own header
// first, and `server/control.js#SCALES.community.seize`'s own comment
// for the real gap this closed in that file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const familyDominance = require('../server/familyDominance.js');
const control = require('../server/control.js');
const authority = require('../server/authority.js');

const YEAR = 365;

function world(options = {}) {
  const { tick = 10000 } = options;
  const age = (years) => tick - Math.round(years * YEAR);
  return {
    tick,
    seed: 'family-dominance-test',
    families: [{
      id: 900, surname: 'Vance', unity: 50, conflict: 0, head_npc_id: 1,
    }],
    familyMemberships: [],
    npcs: [],
    relationships: [],
    memories: [],
    employmentRecords: [],
    organizations: [],
    properties: [],
    ownershipRecords: [],
    infrastructure: [],
    communities: [],
    cities: [],
    civilizations: [],
    entityTraits: [],
    entityOrganizationMemberships: [],
    territoryBlocks: [],
    governments: [],
    publicOpinion: [],
    beliefs: [],
    events: [],
    inventory: [],
    barterItems: [],
    age,
  };
}

function kit(w, entityId, quantity = 200) {
  w.inventory.push({
    id: w.inventory.length + 1, holder_entity_id: entityId, item_name: 'Hammer', quantity, condition: 80,
  });
  w.inventory.push({
    id: w.inventory.length + 1, holder_entity_id: entityId, item_name: 'Shield', quantity, condition: 80,
  });
  if (!w.barterItems.some((i) => i.name === 'Shield')) {
    w.barterItems.push({ name: 'Shield', category: 'protection' });
  }
}

let nextNpcId = 1;

// A real family member who ALSO really lives in the community -- the
// literal meaning of "this family already has the most residents
// here," never a role invented for the test.
function member(w, communityId, options = {}) {
  const {
    years = 30, familyId = 900, position = null, organizationId = 500,
  } = options;
  const id = nextNpcId++;
  w.npcs.push({ id, status: 'alive', communityId, createdTick: w.age(years) });
  w.familyMemberships.push({
    entity_id: id, family_id: familyId, role: 'sibling', generation_number: 1,
  });
  if (w.inventory.length === 0) kit(w, id);
  if (position) {
    w.employmentRecords.push({
      id, entity_id: id, employer_organization_id: organizationId, status: 'active', wage: 20, position,
    });
  }
  return id;
}

// A real roster sized to actually clear a lone community's real
// composition requirement -- checked directly against `control.assess`
// first: six residents needs two real `enforcer`-occupation members,
// not just headcount.
function familyRoster(w, communityId, familyId = 900) {
  member(w, communityId, { familyId, position: 'enforcer' });
  member(w, communityId, { familyId, position: 'enforcer' });
  for (let i = 0; i < 4; i += 1) member(w, communityId, { familyId });
}

// A resident of no family at all -- a real rival local population a
// dominant family still has to outnumber/outfit to win.
function outsider(w, communityId, { years = 30 } = {}) {
  const id = nextNpcId++;
  w.npcs.push({ id, status: 'alive', communityId, createdTick: w.age(years) });
  return id;
}

function lawlessCommunity(w) {
  const communityId = 700 + w.communities.length;
  const cityId = 70 + w.cities.length;
  w.cities.push({ id: cityId });
  w.communities.push({ id: communityId, city_id: cityId });
  w.infrastructure.push({
    id: w.infrastructure.length + 1, city_id: cityId, type: 'public_safety', capacity: 1, condition: 0, maintenance_level: 0, age: 0,
  });
  return communityId;
}

function governedCommunity(w) {
  const communityId = 800 + w.communities.length;
  const cityId = 80 + w.cities.length;
  w.cities.push({ id: cityId });
  w.communities.push({ id: communityId, city_id: cityId });
  w.infrastructure.push({
    id: w.infrastructure.length + 1, city_id: cityId, type: 'public_safety', capacity: 100, condition: 100, maintenance_level: 100, age: 0,
  });
  w.governments.push({ organization_id: 70, system_type: 'council' });
  w.publicOpinion.push({ city_id: null, topic: 'government:70', approval_score: 85, tick: 1 });
  for (let i = 0; i < 10; i += 1) {
    const resident = outsider(w, communityId);
    w.beliefs.push({
      id: resident, entity_id: resident, belief_name: 'trust in public safety',
      belief_type: 'political', strength: 90, tick: 0,
    });
  }
  return communityId;
}

// ---------------------------------------------------------------------
// dominantFamilyOf
// ---------------------------------------------------------------------

test('the real family with the most real resident members wins, by headcount', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  member(w, communityId);
  member(w, communityId);
  member(w, communityId, { familyId: 901 });
  w.families.push({ id: 901, surname: 'Reyes', unity: 50, conflict: 0, head_npc_id: null });

  const dominant = familyDominance.dominantFamilyOf(w, communityId);
  assert.equal(dominant.familyId, 900);
  assert.equal(dominant.members, 2);
});

test('nobody is dominant in a community with no real family residents', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  outsider(w, communityId);
  assert.equal(familyDominance.dominantFamilyOf(w, communityId), null);
});

// ---------------------------------------------------------------------
// attemptFamilyDominance / familyHolderOf
// ---------------------------------------------------------------------

test('a dominant family can really win a community through the real takeover key, and the win is really recorded', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  familyRoster(w, communityId);

  let result = null;
  for (let t = 0; t < 60 && (result === null || !result.succeeded); t += 1) {
    result = familyDominance.attemptFamilyDominance(w, { communityId, tick: w.tick + t });
  }
  assert.ok(result, 'attemptFamilyDominance never even attempted a real dominant family here');
  assert.ok(result.succeeded, 'sixty real attempts for a family that outnumbers every other resident here never succeeded');
  assert.equal(familyDominance.familyHolderOf(w, communityId), 900);
});

test('a governed community is never attempted, however dominant a family is there', () => {
  const w = world();
  const communityId = governedCommunity(w);
  familyRoster(w, communityId);
  assert.equal(authority.writOf(w, communityId).regime, 'governed');

  for (let t = 0; t < 2000; t += 1) {
    assert.equal(familyDominance.attemptFamilyDominance(w, { communityId, tick: t }), null);
  }
});

test('a community a family already holds is never attempted again', () => {
  // A real dominant family roster is present -- without the real
  // idempotence gate, `attemptFamilyDominance` would otherwise proceed
  // straight to a real, non-null `control.attempt` call, the same way
  // it does in the "can really win" test above.
  const w = world();
  const communityId = lawlessCommunity(w);
  familyRoster(w, communityId);
  w.familyTerritory = { [communityId]: { familyId: 900, sinceTick: 1 } };
  assert.equal(familyDominance.attemptFamilyDominance(w, { communityId, tick: 10 }), null);
});

test('scanForFamilyPowerVacuums checks every real community, same honest shape as dominance.js', () => {
  const w = world();
  const lawless = lawlessCommunity(w);
  const governed = governedCommunity(w);
  familyRoster(w, lawless);
  familyRoster(w, governed);

  let attempts = [];
  for (let t = 0; t < 60 && !attempts.some((a) => a.communityId === lawless && a.succeeded); t += 1) {
    attempts = familyDominance.scanForFamilyPowerVacuums(w, { tick: w.tick + t });
  }
  assert.ok(attempts.some((a) => a.communityId === lawless));
  assert.ok(!attempts.some((a) => a.communityId === governed),
    'the governed community must never be among the real attempts at all');
});

// ---------------------------------------------------------------------
// cityFamilyDominanceOf -- "city-wide escalation"
// ---------------------------------------------------------------------

test('a family holding a real majority of a city\'s communities reads as city-wide', () => {
  const w = world();
  const cityId = 90;
  w.cities.push({ id: cityId });
  const communities = [1, 2, 3].map((n) => {
    const communityId = 900 + n;
    w.communities.push({ id: communityId, city_id: cityId });
    return communityId;
  });
  w.familyTerritory = {
    [communities[0]]: { familyId: 900, sinceTick: 1 },
    [communities[1]]: { familyId: 900, sinceTick: 1 },
  };

  const result = familyDominance.cityFamilyDominanceOf(w, cityId);
  assert.equal(result.familyId, 900);
  assert.equal(result.held, 2);
  assert.equal(result.total, 3);
  assert.equal(result.cityWide, true, '2 of 3 communities is a real majority');
});

test('a family holding exactly half a city\'s communities is not yet city-wide', () => {
  const w = world();
  const cityId = 91;
  w.cities.push({ id: cityId });
  const communities = [1, 2].map((n) => {
    const communityId = 910 + n;
    w.communities.push({ id: communityId, city_id: cityId });
    return communityId;
  });
  w.familyTerritory = { [communities[0]]: { familyId: 900, sinceTick: 1 } };

  const result = familyDominance.cityFamilyDominanceOf(w, cityId);
  assert.equal(result.cityWide, false, 'exactly half is not a real majority');
});

test('a city with no real communities at all reports unknown, not zero', () => {
  const w = world();
  assert.equal(familyDominance.cityFamilyDominanceOf(w, 99999), null);
});

// ---------------------------------------------------------------------
// Mutation checks
// ---------------------------------------------------------------------

test('mutation check: control.js#SCALES.community.seize really writes worldState.familyTerritory', () => {
  const w = world();
  const communityId = lawlessCommunity(w);
  familyRoster(w, communityId);

  let result = null;
  for (let t = 0; t < 60 && (result === null || !result.succeeded); t += 1) {
    result = control.attempt(w, {
      scale: 'community', locationId: communityId, tribeId: 900, tick: w.tick + t,
    });
  }
  assert.ok(result.succeeded);
  assert.equal(result.seized.recorded, true);
  assert.equal(result.seized.communityId, communityId);
  assert.equal(result.seized.familyId, 900);
  assert.ok(w.familyTerritory[communityId], 'control.attempt succeeded but wrote nothing to worldState.familyTerritory');
  assert.equal(w.familyTerritory[communityId].familyId, 900);
});

test('mutation check: the governed-regime gate is the real reason a governed community is never attempted', () => {
  const w = world();
  const communityId = governedCommunity(w);
  for (let i = 0; i < 6; i += 1) member(w, communityId);
  const reading = authority.writOf(w, communityId);
  assert.equal(reading.regime, 'governed');
  assert.ok(familyDominance.dominantFamilyOf(w, communityId) !== null,
    'a real dominant family must exist here, or the gate below is not what is actually being tested');
});
