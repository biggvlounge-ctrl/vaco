import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrganizationsStore, foundOrganization, getOrganization, organizationOf,
  addMember, removeMember, recordActivity, fadeCohesion, listOrganizations,
  ORG_TYPES, STARTING_COHESION, COHESION_GAIN,
} from "../src/lib/organizations.js";

test("foundOrganization creates a real org with the founder as its first member", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "The Nakamura Line", type: "family", founderId: "alice" });
  assert.equal(org.name, "The Nakamura Line");
  assert.equal(org.type, "family");
  assert.deepEqual(org.memberIds, ["alice"]);
  assert.equal(org.cohesion, STARTING_COHESION);
});

test("foundOrganization refuses an unknown type, a missing name, and a second org for the same founder", () => {
  const store = createOrganizationsStore();
  assert.throws(
    () => foundOrganization(store, { name: "x", type: "cabal", founderId: "alice" }),
    /not a known type/,
  );
  assert.throws(
    () => foundOrganization(store, { name: "", type: "tribe", founderId: "alice" }),
    /requires a name/,
  );
  foundOrganization(store, { name: "Tribe A", type: "tribe", founderId: "alice" });
  assert.throws(
    () => foundOrganization(store, { name: "Tribe B", type: "tribe", founderId: "alice" }),
    /already belongs to an organization/,
  );
});

test("ORG_TYPES is exactly family, tribe, cult, religious-institution", () => {
  assert.deepEqual(ORG_TYPES, ["family", "tribe", "cult", "religious-institution"]);
});

test('foundOrganization lets a real NPC found a religious institution, never the government', () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: 'The Lantern Circle', type: 'religious-institution', founderId: 'npc-7' });
  assert.equal(org.type, 'religious-institution');
  assert.equal(org.founderId, 'npc-7');
});

test("addMember mixes a real player and an NPC id freely, and organizationOf finds either", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "The Hollow Moon", type: "cult", founderId: "alice" });
  addMember(store, { organizationId: org.id, memberId: "bob" });
  addMember(store, { organizationId: org.id, memberId: "npc-7" });

  assert.deepEqual(org.memberIds, ["alice", "bob", "npc-7"]);
  assert.equal(organizationOf(store, "bob").id, org.id);
  assert.equal(organizationOf(store, "npc-7").id, org.id);
});

test("addMember refuses someone who already belongs to an organization", () => {
  const store = createOrganizationsStore();
  const a = foundOrganization(store, { name: "A", type: "family", founderId: "alice" });
  foundOrganization(store, { name: "B", type: "tribe", founderId: "bob" });
  assert.throws(
    () => addMember(store, { organizationId: a.id, memberId: "bob" }),
    /already belongs to an organization/,
  );
});

test("removeMember lets a member leave without dissolving the group", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "A", type: "family", founderId: "alice" });
  addMember(store, { organizationId: org.id, memberId: "bob" });
  removeMember(store, { organizationId: org.id, memberId: "bob" });

  assert.deepEqual(org.memberIds, ["alice"]);
  assert.equal(organizationOf(store, "bob"), null, "bob must be free to join another organization");
  assert.equal(listOrganizations(store).length, 1, "the organization survives losing a non-last member");
});

test("removeMember refuses to empty the organization to zero, even for the founder", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "A", type: "family", founderId: "alice" });
  assert.throws(
    () => removeMember(store, { organizationId: org.id, memberId: "alice" }),
    /never emptied to zero/,
  );
});

test("recordActivity bumps cohesion by the real gain amount and clamps at 100", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "A", type: "tribe", founderId: "alice" });
  assert.equal(recordActivity(store, org.id), STARTING_COHESION + COHESION_GAIN);
  org.cohesion = 99;
  assert.equal(recordActivity(store, org.id), 100);
});

test("fadeCohesion moves every organization toward zero, and never below it", () => {
  const store = createOrganizationsStore();
  const org = foundOrganization(store, { name: "A", type: "family", founderId: "alice" });
  const before = org.cohesion;
  fadeCohesion(store);
  assert.ok(org.cohesion < before);
  org.cohesion = 0;
  fadeCohesion(store);
  assert.ok(org.cohesion >= 0);
});
