import test from "node:test";
import assert from "node:assert/strict";
import {
  createHouseholdsStore, householdFor, householdOf, ensureHousehold,
  addMember, removeMember, householdSize,
} from "../src/lib/households.js";

test("ensureHousehold creates a household with the owner as its first member", () => {
  const store = createHouseholdsStore();
  const household = ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  assert.deepEqual(household.memberIds, ["alice"]);
  assert.equal(household.propertyId, 1);
});

test("ensureHousehold is idempotent -- a second call returns the same household", () => {
  const store = createHouseholdsStore();
  const first = ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  const second = ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  assert.equal(first.id, second.id);
  assert.equal(store.households.length, 1);
});

test("addMember adds a real roommate, and householdOf finds them by id", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  addMember(store, { propertyId: 1, memberId: "bob" });

  assert.deepEqual(householdFor(store, 1).memberIds, ["alice", "bob"]);
  assert.equal(householdOf(store, "bob").propertyId, 1);
  assert.equal(householdSize(store, 1), 2);
});

test("addMember refuses someone who already belongs to a household", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  ensureHousehold(store, { propertyId: 2, ownerId: "bob" });
  assert.throws(
    () => addMember(store, { propertyId: 1, memberId: "bob" }),
    /already belongs to a household/,
  );
});

test("addMember refuses a property with no household yet", () => {
  const store = createHouseholdsStore();
  assert.throws(
    () => addMember(store, { propertyId: 99, memberId: "bob" }),
    /no household for property/,
  );
});

test("removeMember lets a roommate move out without disturbing the rest", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  addMember(store, { propertyId: 1, memberId: "bob" });
  removeMember(store, { propertyId: 1, memberId: "bob" });

  assert.deepEqual(householdFor(store, 1).memberIds, ["alice"]);
  assert.equal(householdOf(store, "bob"), null, "bob must be free to join another household");
});

test("removeMember refuses to empty the last resident out", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  assert.throws(
    () => removeMember(store, { propertyId: 1, memberId: "alice" }),
    /never emptied to zero/,
  );
});

test("removeMember refuses someone who does not live there", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  assert.throws(
    () => removeMember(store, { propertyId: 1, memberId: "carol" }),
    /does not live there/,
  );
});

test("householdSize is 0 for a property with no household", () => {
  const store = createHouseholdsStore();
  assert.equal(householdSize(store, 404), 0);
});
