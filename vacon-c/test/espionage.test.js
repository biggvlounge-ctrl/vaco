// server/espionage.js — sending a spy to listen, infiltrate or watch
// a real community. See that file's own header for the full design:
// sponsored through the identical real seat-of-authority and
// compliance draw `assignRole` already established, aptitude a real
// composite of `criminal.Stealth`/`criminal.Deception`/`social.
// 'Network Reach'`, detection a real, bounded probability, and a
// successful, undetected return recording real service for the spy.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const espionage = require('../server/espionage.js');
const leadership = require('../server/leadership.js');
const heat = require('../server/heat.js');
const membership = require('../server/membership.js');
const worldStore = require('../server/worldStore.js');

const w = engine.WorldState;

let nextId = 950001;

function person(traitValueFor) {
  return engine.generateNPC({ traitValueFor });
}

function flatTraits(value) {
  return () => value;
}

function organization(leaderId, type = 'business') {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type, leaderId });
}

function family(headId) {
  const id = nextId += 1;
  w.families.push({ id, surname: 'Spy', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick });
  w.familyMemberships.push({ entity_id: headId, family_id: id, role: 'parent', generation_number: 1 });
  return w.families[w.families.length - 1];
}

function addToFamily(fam, entityId) {
  w.familyMemberships.push({ entity_id: entityId, family_id: fam.id, role: 'child', generation_number: 1 });
}

function targetCommunity() {
  const id = nextId += 1;
  w.communities.push({ id, city_id: null, name: `Target ${id}`, population: 10 });
  return w.communities[w.communities.length - 1];
}

// ---------------------------------------------------------------------
// espionageAptitudeOf / detectionChanceFor
// ---------------------------------------------------------------------

test('espionageAptitudeOf: a real, weighted composite of Stealth/Deception/Network Reach', () => {
  const spy = person((def) => {
    if (def.family === 'criminal' && def.name === 'Stealth') return 80;
    if (def.family === 'criminal' && def.name === 'Deception') return 60;
    if (def.family === 'social' && def.name === 'Network Reach') return 40;
    return 50;
  });
  const expected = 0.4 * 80 + 0.3 * 60 + 0.3 * 40;
  assert.equal(espionage.espionageAptitudeOf(w, spy.id), expected);
});

test('espionageAptitudeOf: an unmeasured spy reads the trait scale\'s own neutral centre, not zero', () => {
  const spy = person(flatTraits(50));
  assert.equal(espionage.espionageAptitudeOf(w, spy.id), 50);
});

test('detectionChanceFor: closer range and deeper infiltration both raise risk; higher aptitude lowers it', () => {
  const safe = espionage.detectionChanceFor(50, 'far', 'low_profile');
  const risky = espionage.detectionChanceFor(50, 'close', 'deep_infiltration');
  assert.ok(risky > safe);

  const skilled = espionage.detectionChanceFor(90, 'mid', 'close_watch');
  const unskilled = espionage.detectionChanceFor(10, 'mid', 'close_watch');
  assert.ok(skilled < unskilled);
});

test('detectionChanceFor is always bounded, never 0 and never 1', () => {
  for (const range of espionage.RANGES) {
    for (const stance of espionage.STANCES) {
      for (const aptitude of [0, 50, 100]) {
        const chance = espionage.detectionChanceFor(aptitude, range, stance);
        assert.ok(chance >= 0.02 && chance <= 0.9, `${range}/${stance}/${aptitude} -> ${chance}`);
      }
    }
  }
});

// ---------------------------------------------------------------------
// sendSpy — validation
// ---------------------------------------------------------------------

test('sendSpy: real validation errors, not silent nulls', () => {
  const leader = person(flatTraits(50));
  const spy = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: spy.id, organizationId: org.id });
  const community = targetCommunity();

  assert.throws(
    () => espionage.sendSpy(w, leader.id, {
      organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id, range: 'medium',
    }),
    /not a real range/,
  );
  assert.throws(
    () => espionage.sendSpy(w, leader.id, {
      organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id, stance: 'ambush',
    }),
    /not a real stance/,
  );
  assert.throws(
    () => espionage.sendSpy(w, leader.id, {
      organizationId: org.id, spyEntityId: leader.id, targetCommunityId: community.id,
    }),
    /cannot send themselves/,
  );
  assert.throws(
    () => espionage.sendSpy(w, leader.id, { spyEntityId: spy.id, targetCommunityId: community.id }),
    /requires exactly one of organizationId or familyId/,
  );
  assert.throws(
    () => espionage.sendSpy(w, leader.id, {
      organizationId: org.id, familyId: 1, spyEntityId: spy.id, targetCommunityId: community.id,
    }),
    /requires exactly one of organizationId or familyId/,
  );

  const impostor = person(flatTraits(50));
  assert.throws(
    () => espionage.sendSpy(w, impostor.id, {
      organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id,
    }),
    /does not lead organization/,
  );

  const stranger = person(flatTraits(50));
  assert.throws(
    () => espionage.sendSpy(w, leader.id, {
      organizationId: org.id, spyEntityId: stranger.id, targetCommunityId: community.id,
    }),
    /is not a member of organization/,
  );
});

// ---------------------------------------------------------------------
// sendSpy — compliance
// ---------------------------------------------------------------------

test('sendSpy: a refused assignment (zero loyalty) returns no report and leaves no trace', () => {
  const leader = person(flatTraits(50));
  const spy = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: spy.id, organizationId: org.id });
  const community = targetCommunity();
  worldStore.getOrCreateRelationship(w, leader.id, spy.id, 'social').loyalty = 0;

  const before = leadership.serviceRecordOf(w, spy.id);
  const result = espionage.sendSpy(w, leader.id, {
    organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id,
  });
  assert.equal(result.complied, false);
  assert.equal(result.report, null);
  assert.equal(result.detected, false);
  assert.equal(leadership.serviceRecordOf(w, spy.id), before, 'a refusal is not usage');
});

test('sendSpy: a full-loyalty spy complies and brings back a real report', () => {
  const leader = person(flatTraits(50));
  const spy = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: spy.id, organizationId: org.id });
  const community = targetCommunity();
  worldStore.getOrCreateRelationship(w, leader.id, spy.id, 'social').loyalty = 100;

  const result = espionage.sendSpy(w, leader.id, {
    organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id, range: 'far', stance: 'low_profile',
  });
  assert.equal(result.complied, true);
  assert.ok(result.report);
  assert.equal(result.report.communityId, community.id);
  assert.ok(['governed', 'contested', 'lawless', null].includes(result.report.regime));
  assert.ok(['detailed', 'partial', 'thin'].includes(result.report.fidelity));
});

test('sendSpy: deep_infiltration against a named organization adds real target detail; any other stance does not', () => {
  const leader = person(flatTraits(50));
  const spy = person(flatTraits(50));
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: spy.id, organizationId: org.id });
  const community = targetCommunity();
  worldStore.getOrCreateRelationship(w, leader.id, spy.id, 'social').loyalty = 100;

  const targetOrg = organization(null, 'gang');
  targetOrg.influence = 42;

  const shallow = espionage.sendSpy(w, leader.id, {
    organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id,
    targetOrganizationId: targetOrg.id, stance: 'close_watch',
  });
  assert.equal(shallow.report.targetOrganization, undefined, 'only deep_infiltration reveals real target detail');

  const deep = espionage.sendSpy(w, leader.id, {
    organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id,
    targetOrganizationId: targetOrg.id, stance: 'deep_infiltration',
  });
  assert.ok(deep.report.targetOrganization);
  assert.equal(deep.report.targetOrganization.organizationId, targetOrg.id);
  assert.equal(deep.report.targetOrganization.influence, 42);
  assert.equal(deep.report.targetOrganization.realMemberCount, membership.memberCount(w, targetOrg.id));
});

test('sendSpy: detection raises real heat with the specific target organization, and records no service', () => {
  const leader = person(flatTraits(50));
  // Stealth/Deception/Network Reach all at 0 -- the worst possible real
  // aptitude -- plus the riskiest real combination (close/deep) to make
  // detection the overwhelmingly likely outcome across repeated ticks.
  const spy = person((def) => {
    if (def.family === 'criminal' && (def.name === 'Stealth' || def.name === 'Deception')) return 0;
    if (def.family === 'social' && def.name === 'Network Reach') return 0;
    return 50;
  });
  const org = organization(leader.id);
  membership.joinOrganization(w, { entityId: spy.id, organizationId: org.id });
  const community = targetCommunity();
  worldStore.getOrCreateRelationship(w, leader.id, spy.id, 'social').loyalty = 100;
  const targetOrg = organization(null, 'gang');

  let detections = 0;
  let undetected = 0;
  const servicesBefore = leadership.serviceRecordOf(w, spy.id);
  for (let tick = 0; tick < 40; tick += 1) {
    const result = espionage.sendSpy(w, leader.id, {
      organizationId: org.id, spyEntityId: spy.id, targetCommunityId: community.id,
      targetOrganizationId: targetOrg.id, range: 'close', stance: 'deep_infiltration', tick,
    });
    if (result.detected) {
      detections += 1;
      assert.equal(result.caughtBy, targetOrg.id);
    } else {
      undetected += 1;
    }
  }
  assert.ok(detections > 0, 'the worst real aptitude at the riskiest real combination must be caught at least once in 40 tries');
  assert.ok(heat.heatWith(w, spy.id, targetOrg.id) > 0, 'a real detection really raises heat with the specific org that caught them');
  assert.equal(
    leadership.serviceRecordOf(w, spy.id), servicesBefore + undetected,
    'service is recorded exactly once per real undetected return, never on a detected one',
  );
});

// ---------------------------------------------------------------------
// sendSpy — the family path
// ---------------------------------------------------------------------

test('sendSpy: a family head can send a real family member the identical way an organization leader can', () => {
  const head = person(flatTraits(50));
  const kid = person(flatTraits(50));
  const fam = family(head.id);
  addToFamily(fam, kid.id);
  const community = targetCommunity();
  worldStore.getOrCreateRelationship(w, head.id, kid.id, 'social').loyalty = 100;

  const result = espionage.sendSpy(w, head.id, {
    familyId: fam.id, spyEntityId: kid.id, targetCommunityId: community.id,
  });
  assert.equal(result.complied, true);
  assert.ok(result.report);
});

test('sendSpy (family path): refuses a non-head sponsor and a non-member spy', () => {
  const head = person(flatTraits(50));
  const kid = person(flatTraits(50));
  const fam = family(head.id);
  addToFamily(fam, kid.id);
  const community = targetCommunity();
  const impostor = person(flatTraits(50));

  assert.throws(
    () => espionage.sendSpy(w, impostor.id, { familyId: fam.id, spyEntityId: kid.id, targetCommunityId: community.id }),
    /does not head family/,
  );

  const stranger = person(flatTraits(50));
  assert.throws(
    () => espionage.sendSpy(w, head.id, { familyId: fam.id, spyEntityId: stranger.id, targetCommunityId: community.id }),
    /is not a member of family/,
  );
});
