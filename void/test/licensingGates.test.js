// VOID -- the licensing gates.
//
// Two of VOID's 25 verticals cannot legally operate without real
// licensing: cannabis delivery and medical transportation. Both are
// marked `licensingGated: true`, and `requestJob` refuses them.
//
// The standing instruction is that these must not be relaxed. The way
// they would get relaxed is not by someone editing the refusal — it is
// by someone adding a vertical and forgetting the flag, or flipping a
// flag while adding an unrelated field to the table. Neither produces
// an error. Both would put VOID into a regulated line of business by
// accident.
//
// So these tests pin the flags themselves, not just the refusal.

const test = require('node:test');
const assert = require('node:assert');

const { VERTICALS } = require('../lib/verticals');
const { requestJob } = require('../lib/marketplace');
const { createVoidStore } = require('../lib/store');

// The exact set that must stay gated. Named literally rather than
// derived from VERTICALS, because deriving it from the same table it
// is checking would make the test agree with any change to that table
// — including the change this test exists to catch.
const MUST_STAY_GATED = ['cannabisDelivery', 'medicalTransportation'];

test('exactly the two regulated verticals are licensing-gated', () => {
  const gated = Object.entries(VERTICALS)
    .filter(([, v]) => v.licensingGated)
    .map(([id]) => id)
    .sort();
  assert.deepStrictEqual(gated, [...MUST_STAY_GATED].sort());
});

test('each regulated vertical carries the flag individually', () => {
  for (const id of MUST_STAY_GATED) {
    assert.ok(VERTICALS[id], `${id} must still exist in VERTICALS`);
    assert.strictEqual(VERTICALS[id].licensingGated, true, `${id} must stay licensing-gated`);
  }
});

test('requesting a job in a gated vertical is refused', () => {
  const store = createVoidStore();
  for (const id of MUST_STAY_GATED) {
    assert.throws(
      () => requestJob(store, {
        verticalId: id, customerId: 'alice', quantity: 1, unitPrice: 50,
      }),
      /licensing-gated/,
      `${id} must refuse job requests`,
    );
  }
});

test('the gate is checked before any other validation', () => {
  // Ordering matters. If the customerId check ran first, a malformed
  // request would produce a different error and hide whether the gate
  // is consulted at all — which is exactly how a dropped gate check
  // passes review.
  const store = createVoidStore();
  assert.throws(
    () => requestJob(store, { verticalId: 'cannabisDelivery' }),
    /licensing-gated/,
  );
});

test('no job record is created when a gated request is refused', () => {
  const store = createVoidStore();
  const before = store.jobs.length;
  assert.throws(() => requestJob(store, {
    verticalId: 'medicalTransportation', customerId: 'alice', quantity: 1, unitPrice: 50,
  }));
  assert.strictEqual(store.jobs.length, before);
});

test('an ungated vertical still works -- the gate is specific, not blanket', () => {
  // The counterweight test. A gate that refused everything would pass
  // every check above while breaking the whole marketplace.
  const store = createVoidStore();
  const job = requestJob(store, {
    verticalId: 'laundry', customerId: 'alice', quantity: 10, unitPrice: 2,
  });
  assert.ok(job);
  assert.strictEqual(store.jobs.length, 1);
});

test('an unknown vertical is rejected rather than defaulting to ungated', () => {
  // A typo must not fall through into an unguarded path.
  const store = createVoidStore();
  assert.throws(() => requestJob(store, {
    verticalId: 'cannabis-delivery', customerId: 'alice', quantity: 1, unitPrice: 50,
  }), /unknown verticalId/);
});

test('every vertical declares licensingGated explicitly', () => {
  // `undefined` is falsy, so a vertical added without the field would
  // be silently ungated. Requiring a real boolean makes that a test
  // failure instead of a live regulated launch.
  for (const [id, v] of Object.entries(VERTICALS)) {
    assert.strictEqual(
      typeof v.licensingGated, 'boolean',
      `${id} must declare licensingGated explicitly, got ${typeof v.licensingGated}`,
    );
  }
});
