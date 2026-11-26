// server/plays.js -- coordinated strategist playbooks (tasks #184 and
// #225). Read that file's own header first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const plays = require('../server/plays.js');
const membership = require('../server/membership.js');
const { getTraitId } = require('../server/traitDefinitions.js');

let nextId = 970000;

function world() {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    relationships: [],
    entityTraits: [],
    employmentRecords: [],
    properties: [],
    players: [],
    plays: [],
  };
}

function person(w) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active' });
  return id;
}

function organization(w, { leaderId, type = 'business', influenceScore = 0 } = {}) {
  const id = nextId++;
  w.organizations.push({
    id, name: `Org ${id}`, type, leader_id: leaderId, isFaction: false,
    influence: influenceScore, assets: 0,
  });
  return id;
}

function family(w, { headId } = {}) {
  const id = nextId++;
  w.families.push({ id, head_npc_id: headId, unity: 50, conflict: 0 });
  return id;
}

function joinOrg(w, entityId, organizationId) {
  membership.joinOrganization(w, { entityId, organizationId, tick: w.tick });
}

function joinFamily(w, entityId, familyId) {
  w.familyMemberships.push({ id: nextId++, entity_id: entityId, family_id: familyId });
}

function setLoyalty(w, leaderId, subordinateId, loyalty) {
  w.relationships.push({
    id: nextId++, entity_a_id: leaderId, entity_b_id: subordinateId,
    relationship_type: 'social', loyalty, influence: 0,
  });
}

function property(w, name = 'the back door') {
  const id = nextId++;
  w.properties.push({ id, name, community_id: 1 });
  return id;
}

function maxSocialTraits(w, entityId) {
  for (const name of ['Charisma', 'Persuasion', 'Network Reach', 'Reputation']) {
    w.entityTraits.push({
      id: w.entityTraits.length + 1, entity_id: entityId,
      trait_id: getTraitId('social', name), current_value: 100,
    });
  }
}

// `influenceRatingOf`'s five components (occupation tier, real org
// leadership scaled by member count, real social traits, real
// word-of-mouth/fame aura -- task #235, and real local prominence --
// task #150) weight to at most 25/40/25/7/3 -- maxing only three of
// the five (as `maxSocialTraits` plus a maxed organization already
// do) still leaves real headroom below 100. This pushes the
// occupation component to its own real maximum too (occupations.js's
// one real tier-7 occupation), the only way to actually reach the
// real cap.
function maxOccupation(w, entityId) {
  w.employmentRecords.push({
    entity_id: entityId, status: 'active', position: 'polymath',
  });
}

// Task #235's real aura component -- `Notoriety`, not one of
// `maxSocialTraits`' four.
function maxAura(w, entityId) {
  w.entityTraits.push({
    id: w.entityTraits.length + 1, entity_id: entityId,
    trait_id: getTraitId('reputation', 'Notoriety'), current_value: 100,
  });
}

// Task #150's real local-prominence component needs a real, tiny
// community to scale against -- this leader already leads a real
// organization (`hasOrgLeadership`), so placing them in one small
// enough to hit `LOCAL_PROMINENCE_CAP` is the only piece still
// missing.
function placeInTinyCommunity(w, entityId) {
  const communityId = nextId++;
  w.communities = w.communities || [];
  w.communities.push({ id: communityId });
  w.npcs.find((n) => n.id === entityId).communityId = communityId;
}

test('capacityFor is low for an ordinary, untraited leader and reaches MAX_PLAY_SIZE for a highly influential one', () => {
  const w = world();
  const ordinaryLeader = person(w);
  const influentialLeader = person(w);
  maxSocialTraits(w, influentialLeader);
  maxOccupation(w, influentialLeader);
  maxAura(w, influentialLeader);
  organization(w, { leaderId: influentialLeader, influenceScore: 100 });
  for (let i = 0; i < 20; i += 1) joinOrg(w, person(w), w.organizations[0].id);
  placeInTinyCommunity(w, influentialLeader);

  const low = plays.capacityFor(w, ordinaryLeader);
  const high = plays.capacityFor(w, influentialLeader);
  assert.ok(low < plays.MAX_PLAY_SIZE, 'an untraited, org-less leader reached the real cap');
  assert.equal(high, plays.MAX_PLAY_SIZE, 'a maximally influential leader did not reach the real cap');
});

test('drawPlay refuses more assignments than this leader\'s real capacity supports', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const subs = [person(w), person(w), person(w), person(w), person(w)];
  for (const s of subs) joinOrg(w, s, orgId);
  const door = property(w);

  const capacity = plays.capacityFor(w, leaderId);
  const tooMany = Array.from({ length: capacity + 1 }, (_, i) => ({
    subordinateEntityId: subs[i % subs.length],
    locationPropertyId: door,
    aggression: 'light',
    intent: 'defense',
  }));

  assert.throws(
    () => plays.drawPlay(w, leaderId, { name: 'Overreach', organizationId: orgId, assignments: tooMany }),
    /real influence only supports/,
  );
});

test('drawPlay refuses someone who does not actually lead the named organization', () => {
  const w = world();
  const realLeader = person(w);
  const impostor = person(w);
  const orgId = organization(w, { leaderId: realLeader });
  const sub = person(w);
  joinOrg(w, sub, orgId);
  const door = property(w);

  assert.throws(
    () => plays.drawPlay(w, impostor, {
      name: 'Not Yours', organizationId: orgId,
      assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'light', intent: 'defense' }],
    }),
    /does not lead organization/,
  );
});

test('drawPlay refuses a real but fake aggression level or intent, and a non-existent property', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const sub = person(w);
  joinOrg(w, sub, orgId);
  const door = property(w);

  assert.throws(
    () => plays.drawPlay(w, leaderId, {
      name: 'Bad Aggression', organizationId: orgId,
      assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'furious', intent: 'defense' }],
    }),
    /not a real aggression level/,
  );
  assert.throws(
    () => plays.drawPlay(w, leaderId, {
      name: 'Bad Intent', organizationId: orgId,
      assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'light', intent: 'sabotage' }],
    }),
    /not a real intent/,
  );
  assert.throws(
    () => plays.drawPlay(w, leaderId, {
      name: 'Nowhere', organizationId: orgId,
      assignments: [{ subordinateEntityId: sub, locationPropertyId: 999999, aggression: 'light', intent: 'defense' }],
    }),
    /no real property/,
  );
});

test('a drawn play is retained -- playsOf finds it by its real organization, unrelated to any other org', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const otherOrgId = organization(w, { leaderId: person(w) });
  const sub = person(w);
  joinOrg(w, sub, orgId);
  const door = property(w);

  const play = plays.drawPlay(w, leaderId, {
    name: 'Two Doors', organizationId: orgId,
    assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'medium', intent: 'offense' }],
  });

  assert.deepEqual(plays.playsOf(w, { organizationId: orgId }).map((p) => p.id), [play.id]);
  assert.deepEqual(plays.playsOf(w, { organizationId: otherOrgId }), []);
});

test('runPlay reports full compliance when every assignee is fully loyal, and raises influence', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const subs = [person(w), person(w)];
  for (const s of subs) { joinOrg(w, s, orgId); setLoyalty(w, leaderId, s, 100); }
  const doorA = property(w, 'door 1');
  const doorB = property(w, 'door 2');

  const play = plays.drawPlay(w, leaderId, {
    name: 'Hold The Line', organizationId: orgId,
    assignments: [
      { subordinateEntityId: subs[0], locationPropertyId: doorA, aggression: 'light', intent: 'defense' },
      { subordinateEntityId: subs[1], locationPropertyId: doorB, aggression: 'aggressive', intent: 'offense' },
    ],
  });

  const outcome = plays.runPlay(w, leaderId, play.id);
  assert.equal(outcome.allComplied, true);
  assert.equal(outcome.results.length, 2);
  assert.ok(outcome.results.every((r) => r.complied === true));
  assert.equal(play.timesRun, 1);
  assert.equal(play.timesSucceeded, 1);

  const rel = w.relationships.find((r) => r.entity_a_id === leaderId && r.entity_b_id === subs[0]);
  assert.ok(Number(rel.influence) > 0, 'a fully-complied play never raised real influence');
});

test('runPlay reports a real partial refusal -- one assignee with zero loyalty never complies, the other still does', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const loyalSub = person(w);
  const disloyalSub = person(w);
  joinOrg(w, loyalSub, orgId);
  joinOrg(w, disloyalSub, orgId);
  setLoyalty(w, leaderId, loyalSub, 100);
  setLoyalty(w, leaderId, disloyalSub, 0);
  const doorA = property(w, 'door 1');
  const doorB = property(w, 'door 2');

  const play = plays.drawPlay(w, leaderId, {
    name: 'Mixed Crew', organizationId: orgId,
    assignments: [
      { subordinateEntityId: loyalSub, locationPropertyId: doorA, aggression: 'light', intent: 'defense' },
      { subordinateEntityId: disloyalSub, locationPropertyId: doorB, aggression: 'light', intent: 'defense' },
    ],
  });

  const outcome = plays.runPlay(w, leaderId, play.id);
  assert.equal(outcome.allComplied, false);
  const loyalResult = outcome.results.find((r) => r.subordinateEntityId === loyalSub);
  const disloyalResult = outcome.results.find((r) => r.subordinateEntityId === disloyalSub);
  assert.equal(loyalResult.complied, true);
  assert.equal(disloyalResult.complied, false);
  assert.equal(play.timesRun, 1);
  assert.equal(play.timesSucceeded, 0);
});

test('a play can be run more than once, and timesRun/timesSucceeded are real, reported track records', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const sub = person(w);
  joinOrg(w, sub, orgId);
  setLoyalty(w, leaderId, sub, 100);
  const door = property(w);

  const play = plays.drawPlay(w, leaderId, {
    name: 'Reusable', organizationId: orgId,
    assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'light', intent: 'defense' }],
  });

  plays.runPlay(w, leaderId, play.id, { tick: 1 });
  plays.runPlay(w, leaderId, play.id, { tick: 2 });
  plays.runPlay(w, leaderId, play.id, { tick: 3 });

  assert.equal(play.timesRun, 3);
  assert.equal(play.timesSucceeded, 3);
});

test('a family head can draw and run a play for real family members, the same as an organization leader', () => {
  const w = world();
  const headId = person(w);
  const familyId = family(w, { headId });
  const sub = person(w);
  joinFamily(w, sub, familyId);
  setLoyalty(w, headId, sub, 100);
  const door = property(w);

  const play = plays.drawPlay(w, headId, {
    name: 'Family Watch', familyId,
    assignments: [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'medium', intent: 'education' }],
  });
  const outcome = plays.runPlay(w, headId, play.id);
  assert.equal(outcome.allComplied, true);
});

test('drawPlay requires exactly one of organizationId or familyId', () => {
  const w = world();
  const leaderId = person(w);
  const orgId = organization(w, { leaderId });
  const familyId = family(w, { headId: leaderId });
  const sub = person(w);
  joinOrg(w, sub, orgId);
  const door = property(w);
  const oneAssignment = [{ subordinateEntityId: sub, locationPropertyId: door, aggression: 'light', intent: 'defense' }];

  assert.throws(
    () => plays.drawPlay(w, leaderId, { name: 'Neither', assignments: oneAssignment }),
    /exactly one of organizationId or familyId/,
  );
  assert.throws(
    () => plays.drawPlay(w, leaderId, { name: 'Both', organizationId: orgId, familyId, assignments: oneAssignment }),
    /exactly one of organizationId or familyId/,
  );
});

test('the real aggression and intent vocabularies are exactly the user\'s own named terms', () => {
  assert.deepEqual(plays.AGGRESSION_LEVELS, ['light', 'medium', 'aggressive']);
  assert.deepEqual(plays.INTENTS, ['education', 'defense', 'offense']);
});
