// server/craftingAdvisor.js — a real, trait-gated "what can we make"
// suggestion over a group's own real, pooled inventory. See that
// file's own header for the full design: `readyNow` (one real member
// personally qualifies and personally holds enough) and
// `possibleIfPooled` (the group's own real holdings, summed, would be
// enough, but nobody has moved the materials together yet) are kept
// as two distinct, honest facts, never collapsed into one claim.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const craftingAdvisor = require('../server/craftingAdvisor.js');
const membership = require('../server/membership.js');
const produce = require('../server/produce.js');
const salvage = require('../server/salvage.js');
const inventory = require('../server/inventory.js');

const w = engine.WorldState;

let nextId = 991001;

function person(traitValueFor) {
  return engine.generateNPC({ traitValueFor });
}

function flatTraits(value) {
  return () => value;
}

function organization(leaderId, type = 'business') {
  return engine.generateOrganization({ name: `Org ${nextId += 1}`, type, leaderId });
}

function give(entityId, itemName, quantity) {
  produce.registerItems(w);
  salvage.registerItems(w);
  inventory.give(w, { entityId, itemName, quantity });
}

test('suggestCrafting: requires exactly one of organizationId/familyId, and a real organization', () => {
  assert.throws(() => craftingAdvisor.suggestCrafting(w, {}), /requires exactly one/);
  assert.throws(
    () => craftingAdvisor.suggestCrafting(w, { organizationId: 999999 }),
    /no organization with id/,
  );
});

test('suggestCrafting: readyNow names a real member who personally qualifies and personally holds enough -- granola bars from the request\'s own named example (excess cereal/wheat)', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const cook = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: cook.id, organizationId: org.id });
  give(cook.id, 'wheat', 2);

  const result = craftingAdvisor.suggestCrafting(w, { organizationId: org.id });
  const granola = result.suggestions.find((s) => s.product === 'granola_bar');
  assert.ok(granola, 'granola_bar must be suggested');
  assert.deepEqual(granola.readyNow, [cook.id]);
  assert.equal(granola.possibleIfPooled, false, 'already ready now -- not reported as only possible if pooled');
});

test('suggestCrafting: orange_juice from the request\'s own named example (excess oranges)', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const cook = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: cook.id, organizationId: org.id });
  give(cook.id, 'oranges', 3);

  const result = craftingAdvisor.suggestCrafting(w, { organizationId: org.id });
  const juice = result.suggestions.find((s) => s.product === 'orange_juice');
  assert.ok(juice);
  assert.deepEqual(juice.readyNow, [cook.id]);
});

test('suggestCrafting: possibleIfPooled is true when the GROUP\'s own real holdings, summed across members, are enough -- but no single member holds enough alone', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const memberA = person(flatTraits(50));
  const memberB = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: memberA.id, organizationId: org.id });
  membership.joinOrganization(w, { entityId: memberB.id, organizationId: org.id });
  give(memberA.id, 'oranges', 2);
  give(memberB.id, 'oranges', 1);

  const result = craftingAdvisor.suggestCrafting(w, { organizationId: org.id });
  const juice = result.suggestions.find((s) => s.product === 'orange_juice');
  assert.ok(juice, 'the pooled total (3) is enough even though neither member alone holds 3');
  assert.deepEqual(juice.readyNow, []);
  assert.equal(juice.possibleIfPooled, true);
});

test('suggestCrafting: a product nobody can make and nothing is pooled toward is not suggested at all', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const result = craftingAdvisor.suggestCrafting(w, { organizationId: org.id });
  assert.deepEqual(result.suggestions, []);
});

test('suggestCrafting: aluminum/glass scrap into an existing real product (blade) is already real -- no second mechanism needed', () => {
  const leader = person(flatTraits(50));
  const org = organization(leader.id);
  const crafter = person(flatTraits(50));
  membership.joinOrganization(w, { entityId: crafter.id, organizationId: org.id });
  give(crafter.id, 'glass', 1);
  give(crafter.id, 'cloth', 1);

  const result = craftingAdvisor.suggestCrafting(w, { organizationId: org.id });
  const blade = result.suggestions.find((s) => s.product === 'blade');
  assert.ok(blade);
  assert.deepEqual(blade.readyNow, [crafter.id]);
});

test('suggestCrafting: the family path works the identical way an organization does', () => {
  const head = person(flatTraits(50));
  const fam = { id: nextId += 1, surname: 'Crafters', generation: 1, total_members: 1, head_npc_id: head.id, updatedTick: w.tick };
  w.families.push(fam);
  w.familyMemberships.push({ entity_id: head.id, family_id: fam.id, role: 'parent', generation_number: 1 });
  const kid = person(flatTraits(50));
  w.familyMemberships.push({ entity_id: kid.id, family_id: fam.id, role: 'child', generation_number: 1 });
  give(kid.id, 'wheat', 2);

  const result = craftingAdvisor.suggestCrafting(w, { familyId: fam.id });
  const granola = result.suggestions.find((s) => s.product === 'granola_bar');
  assert.ok(granola);
  assert.deepEqual(granola.readyNow, [kid.id]);
});
