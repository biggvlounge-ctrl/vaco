// server/tribeWealth.js — real property + real inventory + a real
// notable-people roster for an organization or family. See that
// file's own header for the full design: additive to
// economy.getNetWorth, never a replacement; never a single invented
// composite score.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const tribeWealth = require('../server/tribeWealth.js');
const membership = require('../server/membership.js');
const inventory = require('../server/inventory.js');
const economy = require('../server/economy.js');

const w = engine.WorldState;

let nextId = 980001;

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
  w.families.push({ id, surname: 'Wealth', generation: 1, total_members: 1, head_npc_id: headId, updatedTick: w.tick });
  w.familyMemberships.push({ entity_id: headId, family_id: id, role: 'parent', generation_number: 1 });
  return w.families[w.families.length - 1];
}

function addToFamily(fam, entityId, role, generationNumber) {
  w.familyMemberships.push({
    entity_id: entityId, family_id: fam.id, role: role ?? null, generation_number: generationNumber ?? 1,
  });
}

function registerItem(name, value) {
  w.barterItems = w.barterItems || [];
  if (!w.barterItems.some((i) => i.name === name)) {
    w.barterItems.push({ name, category: 'tools', origin: 'crafted', baseValue: value });
  }
}

test('tribeWealthOf: requires exactly one of organizationId/familyId', () => {
  assert.throws(() => tribeWealth.tribeWealthOf(w, {}), /requires exactly one/);
  assert.throws(
    () => tribeWealth.tribeWealthOf(w, { organizationId: 1, familyId: 1 }),
    /requires exactly one/,
  );
});

test('tribeWealthOf: inventory value sums real held inventory across every real member, leader included', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const member = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: member.id, organizationId: org.id });

  registerItem('Tribe Test Widget', 100);
  inventory.give(w, { entityId: leader.id, itemName: 'Tribe Test Widget', quantity: 1 });
  inventory.give(w, { entityId: member.id, itemName: 'Tribe Test Widget', quantity: 2 });

  const result = tribeWealth.tribeWealthOf(w, { organizationId: org.id });
  assert.equal(result.inventoryValue, 300);
  assert.equal(result.memberCount, 2);
});

test('tribeWealthOf: notablePeople names the real leader and real notable occupations, never a composite score', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id, 'hospital');
  const doctor = person(flatTraits(50));
  const ordinary = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: doctor.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: ordinary.id, organizationId: org.id });
  economy.hireEntity(w, {
    entityId: doctor.id, employerOrganizationId: org.id, wage: 80, position: 'physician', tick: 0,
  });

  const result = tribeWealth.tribeWealthOf(w, { organizationId: org.id });
  assert.ok(!('score' in result) && !('wealthScore' in result), 'no invented composite score field');
  const leaderEntry = result.notablePeople.find((p) => p.entityId === leader.id);
  assert.ok(leaderEntry && leaderEntry.reasons.includes('leadership'));
  const doctorEntry = result.notablePeople.find((p) => p.entityId === doctor.id);
  assert.ok(doctorEntry && doctorEntry.reasons.includes('occupation:physician'));
  assert.ok(!result.notablePeople.some((p) => p.entityId === ordinary.id), 'an ordinary member with no notable fact is not listed');
});

test('tribeWealthOf (family): elders are the family\'s own real oldest generation, never a fixed age cutoff', () => {
  const head = person(flatTraits(50));
  const fam = family(head.id);
  const grandparent = person(flatTraits(50));
  const parent = person(flatTraits(50));
  const child = person(flatTraits(50));
  addToFamily(fam, grandparent.id, null, 0);
  addToFamily(fam, parent.id, null, 1);
  addToFamily(fam, child.id, null, 2);

  const result = tribeWealth.tribeWealthOf(w, { familyId: fam.id });
  const grandparentEntry = result.notablePeople.find((p) => p.entityId === grandparent.id);
  assert.ok(grandparentEntry && grandparentEntry.reasons.includes('elder'));
  assert.ok(!result.notablePeople.some((p) => p.entityId === child.id && p.reasons.includes('elder')));
});

test('tribeWealthOf (family): a single-generation family has no elder distinct from anyone else', () => {
  const head = person(flatTraits(50));
  const fam = family(head.id);
  const sibling = person(flatTraits(50));
  addToFamily(fam, sibling.id, null, 1);

  const result = tribeWealth.tribeWealthOf(w, { familyId: fam.id });
  assert.ok(!result.notablePeople.some((p) => p.reasons.includes('elder')));
});

test('tribeWealthOf (family): a real assigned family role (protector/caregiver/guardian/mentor) is named', () => {
  const head = person(flatTraits(50));
  const fam = family(head.id);
  const protector = person(flatTraits(50));
  addToFamily(fam, protector.id, 'protector', 1);

  const result = tribeWealth.tribeWealthOf(w, { familyId: fam.id });
  const entry = result.notablePeople.find((p) => p.entityId === protector.id);
  assert.ok(entry && entry.reasons.includes('family-role:protector'));
});

test('tribeWealthOf: never touches economy.getNetWorth -- a leader with zero cash and real property/inventory reads correctly in both', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  registerItem('Tribe Test Widget 2', 50);
  inventory.give(w, { entityId: leader.id, itemName: 'Tribe Test Widget 2', quantity: 1 });

  const netWorthBefore = engine.getNetWorth(leader.id);
  const result = tribeWealth.tribeWealthOf(w, { organizationId: org.id });
  const netWorthAfter = engine.getNetWorth(leader.id);
  assert.equal(netWorthBefore, netWorthAfter, 'reading tribe wealth has no side effect on individual net worth');
  assert.ok(result.inventoryValue >= 50);
});
