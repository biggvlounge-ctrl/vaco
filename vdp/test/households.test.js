import test from "node:test";
import assert from "node:assert/strict";
import {
  createHouseholdsStore, householdFor, householdOf, ensureHousehold,
  addMember, removeMember, householdSize, hostGuest,
  HOST_GOOD_OUTCOME_CHANCE, HOST_NEUTRAL_OUTCOME_CHANCE,
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

// -- hosting the homeless (9 Oct 2026) -----------------------------------

test("hostGuest reuses the real addMember act and reports a real outcome", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  const result = hostGuest(store, { propertyId: 1, guestId: "guest-1", rng: () => 0 });
  assert.deepEqual(result.household.memberIds, ["alice", "guest-1"]);
  assert.ok(householdOf(store, "guest-1"));
  assert.equal(result.outcome, "good", "rng()=0 is below every real chance, so it always succeeds");
});

test("hostGuest is more likely to go well with a real shared background, matching the instruction's own 'right combination'", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  // A roll that would succeed with the shared-background chance but
  // fail the plain neutral one -- proves the two real chances are
  // actually different, not just two names for the same number.
  const roll = (HOST_GOOD_OUTCOME_CHANCE + HOST_NEUTRAL_OUTCOME_CHANCE) / 2;
  assert.ok(roll < HOST_GOOD_OUTCOME_CHANCE && roll >= HOST_NEUTRAL_OUTCOME_CHANCE);

  const shared = hostGuest(store, { propertyId: 1, guestId: "guest-shared", sharedBackground: true, rng: () => roll });
  assert.equal(shared.outcome, "good");

  ensureHousehold(store, { propertyId: 2, ownerId: "bob" });
  const unshared = hostGuest(store, { propertyId: 2, guestId: "guest-unshared", sharedBackground: false, rng: () => roll });
  assert.equal(unshared.outcome, "bad");
});

test("hostGuest can go wrong even with a real shared background -- it is a real chance, not a guarantee", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  const result = hostGuest(store, { propertyId: 1, guestId: "guest-1", sharedBackground: true, rng: () => 0.999 });
  assert.equal(result.outcome, "bad");
});

test("hostGuest refuses a guest who already belongs to a real household -- addMember's own real rule, unchanged", () => {
  const store = createHouseholdsStore();
  ensureHousehold(store, { propertyId: 1, ownerId: "alice" });
  ensureHousehold(store, { propertyId: 2, ownerId: "bob" });
  assert.throws(() => hostGuest(store, { propertyId: 2, guestId: "alice" }), /already belongs to a household/);
});
