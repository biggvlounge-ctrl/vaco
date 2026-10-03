import test from "node:test";
import assert from "node:assert/strict";
import {
  createVavltStore, checkIn, checkOut, listPresent, COVER_CHARGE, VENUE_NAME,
} from "../src/lib/vavlt.js";

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error("transfer failed");
    return { ok: true };
  };
}

test("checkIn charges the real cover and lists the venue name", async () => {
  const store = createVavltStore();
  const calls = [];
  const result = await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer(calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, COVER_CHARGE);
  assert.equal(result.venue, VENUE_NAME);
  assert.deepEqual(result.present, ["alice"]);
});

test("a failed check-in rolls the claim back -- no presence left on the books", async () => {
  const store = createVavltStore();
  await assert.rejects(
    checkIn(store, { ownerId: "alice", transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.deepEqual(listPresent(store), []);
});

test("checkIn refuses someone already checked in", async () => {
  const store = createVavltStore();
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer([]) });
  await assert.rejects(
    checkIn(store, { ownerId: "alice", transferFn: fakeTransfer([]) }),
    /already checked in/,
  );
});

test("listPresent shows everyone currently inside, real-time", async () => {
  const store = createVavltStore();
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer([]) });
  await checkIn(store, { ownerId: "bob", transferFn: fakeTransfer([]) });
  assert.deepEqual(listPresent(store).sort(), ["alice", "bob"]);
});

test("presence expires after the real duration, without an explicit check-out", async () => {
  const store = createVavltStore();
  const calls = [];
  const start = Date.now();
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer(calls), now: start });
  assert.deepEqual(listPresent(store, start + 10 * 60 * 1000), ["alice"]);
  assert.deepEqual(listPresent(store, start + 31 * 60 * 1000), [], "alice must have aged out of the room");
});

test("checkOut removes someone immediately, with no refund modeled", async () => {
  const store = createVavltStore();
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer([]) });
  checkOut(store, { ownerId: "alice" });
  assert.deepEqual(listPresent(store), []);
});

test("checkOut refuses someone who was never checked in", () => {
  const store = createVavltStore();
  assert.throws(() => checkOut(store, { ownerId: "ghost" }), /is not checked in/);
});

test("checking back in after checking out is allowed and charges cover again", async () => {
  const store = createVavltStore();
  const calls = [];
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer(calls) });
  checkOut(store, { ownerId: "alice" });
  await checkIn(store, { ownerId: "alice", transferFn: fakeTransfer(calls) });
  assert.equal(calls.length, 2, "a second visit is a second real cover charge");
});
