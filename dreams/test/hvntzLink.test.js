// DREAMS -- the real cross-link between a DREAMS screen and an actual
// HVNTZ business location, closing this project's own flagged gap:
// "the two systems are integrated at the revenue-share concept
// level... but not at the data level yet." hvntzLocationFetchFn is a
// fake here -- no network, matching this ecosystem's injected-cross-
// app-call convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createDreamsStore } = require('../lib/store');
const { registerScreen, linkHvntzBusinessLocation, unlinkHvntzBusinessLocation } = require('../lib/screens');

function screen(store) {
  return registerScreen(store, { screenOwnerId: 'owner-1', locationName: 'Lobby Screen', locationAddress: '1 Main St' });
}

test('a newly registered screen has no HVNTZ link', () => {
  const store = createDreamsStore();
  const s = screen(store);
  assert.strictEqual(s.hvntzBusinessId, null);
  assert.strictEqual(s.hvntzLocationId, null);
});

test('linkHvntzBusinessLocation requires a hvntzLocationFetchFn', async () => {
  const store = createDreamsStore();
  const s = screen(store);
  await assert.rejects(
    linkHvntzBusinessLocation(store, { screenId: s.id, hvntzLocationId: 7 }),
    /requires a hvntzLocationFetchFn/,
  );
});

test('linkHvntzBusinessLocation refuses for an unknown screen', async () => {
  const store = createDreamsStore();
  await assert.rejects(
    linkHvntzBusinessLocation(store, { screenId: 999, hvntzLocationId: 7, hvntzLocationFetchFn: async () => ({ id: 7, businessId: 3 }) }),
    /no screen with id 999/,
  );
});

test('linkHvntzBusinessLocation refuses when HVNTZ returns no location', async () => {
  const store = createDreamsStore();
  const s = screen(store);
  await assert.rejects(
    linkHvntzBusinessLocation(store, { screenId: s.id, hvntzLocationId: 404, hvntzLocationFetchFn: async () => null }),
    /HVNTZ returned no location for id 404/,
  );
});

test('linkHvntzBusinessLocation stores the real businessId read live from HVNTZ, not a caller-declared one', async () => {
  const store = createDreamsStore();
  const s = screen(store);
  let seenLocationId;
  const result = await linkHvntzBusinessLocation(store, {
    screenId: s.id,
    hvntzLocationId: 7,
    hvntzLocationFetchFn: async (locationId) => { seenLocationId = locationId; return { id: 7, businessId: 3, address: 'Real Rooftop' }; },
  });
  assert.strictEqual(seenLocationId, 7);
  assert.strictEqual(result.hvntzLocationId, 7);
  assert.strictEqual(result.hvntzBusinessId, 3);
  assert.strictEqual(s.hvntzBusinessId, 3);
});

test('linkHvntzBusinessLocation ignores a caller-declared hvntzBusinessId and uses the real one read live from HVNTZ', async () => {
  const store = createDreamsStore();
  const s = screen(store);
  const result = await linkHvntzBusinessLocation(store, {
    screenId: s.id,
    hvntzLocationId: 7,
    hvntzBusinessId: 999, // a bogus, caller-declared value -- must be ignored
    hvntzLocationFetchFn: async () => ({ id: 7, businessId: 3 }),
  });
  assert.strictEqual(result.hvntzBusinessId, 3);
});

test('unlinkHvntzBusinessLocation clears both real fields', async () => {
  const store = createDreamsStore();
  const s = screen(store);
  await linkHvntzBusinessLocation(store, { screenId: s.id, hvntzLocationId: 7, hvntzLocationFetchFn: async () => ({ id: 7, businessId: 3 }) });
  assert.strictEqual(s.hvntzBusinessId, 3);

  const result = unlinkHvntzBusinessLocation(store, { screenId: s.id });
  assert.strictEqual(result.hvntzBusinessId, null);
  assert.strictEqual(result.hvntzLocationId, null);
});

test('unlinkHvntzBusinessLocation refuses for an unknown screen', () => {
  const store = createDreamsStore();
  assert.throws(() => unlinkHvntzBusinessLocation(store, { screenId: 999 }), /no screen with id 999/);
});
