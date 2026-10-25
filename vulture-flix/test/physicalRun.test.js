// Vvltvre Flix — ordering a real physical run (posters, a physical
// collectible edition) for a studio-produced title, through CVLLEX's
// real production-order API. cvllexRequestFn is a fake here — no
// network, matching this ecosystem's injected-cross-app-call
// convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createVultureFlixStore } = require('../lib/store');
const {
  registerStudioProducedTitle, markStreaming, acquireExclusiveTitle, requestPhysicalRun,
} = require('../lib/titles');

const NOW = Date.UTC(2026, 9, 25);

function fakeSettle() {
  return async () => ({ ok: true });
}

function studioTitle(store) {
  const record = registerStudioProducedTitle(store, {
    studioId: 'vulture-studios-1', studioProjectId: 'proj-9', title: 'Gateway Signal', type: 'film', now: NOW,
  });
  markStreaming(store, record.id);
  return record;
}

test('requestPhysicalRun refuses for a title that is not streaming yet', async () => {
  const store = createVultureFlixStore();
  const record = registerStudioProducedTitle(store, {
    studioId: 'vulture-studios-1', studioProjectId: 'proj-9', title: 'Gateway Signal', type: 'film', now: NOW,
  });
  await assert.rejects(
    requestPhysicalRun(store, { titleId: record.id, itemType: 'poster', quantity: 50, cvllexRequestFn: async () => ({ id: 1 }) }),
    /expected "streaming"/,
  );
});

test('requestPhysicalRun refuses for an acquired (licensed) title — no merchandising rights held', async () => {
  const store = createVultureFlixStore();
  const record = await acquireExclusiveTitle(store, {
    creatorId: 'nova', title: 'The Long Dark', type: 'film',
    acquisitionFee: 500, exclusivityWindowDays: 365, settleFn: fakeSettle(), now: NOW,
  });
  markStreaming(store, record.id);
  await assert.rejects(
    requestPhysicalRun(store, { titleId: record.id, itemType: 'poster', quantity: 50, cvllexRequestFn: async () => ({ id: 1 }) }),
    /this app does not hold merchandising rights/,
  );
});

test('requestPhysicalRun calls cvllexRequestFn with the real studio as creator and a real vendorNote', async () => {
  const store = createVultureFlixStore();
  const record = studioTitle(store);

  let seen;
  const cvllexRequestFn = async (options) => { seen = options; return { id: 88 }; };

  const result = await requestPhysicalRun(store, {
    titleId: record.id, itemType: 'poster', quantity: 50, estimatedUnitCost: 1.25, cvllexRequestFn,
  });

  assert.strictEqual(seen.creatorId, 'vulture-studios-1');
  assert.strictEqual(seen.itemType, 'poster');
  assert.strictEqual(seen.quantity, 50);
  assert.strictEqual(seen.estimatedUnitCost, 1.25);
  assert.match(seen.vendorNote, /title #\d+ "Gateway Signal"/);
  assert.strictEqual(result.order.id, 88);
});

test('requestPhysicalRun records the real cvllex order id on the title', async () => {
  const store = createVultureFlixStore();
  const record = studioTitle(store);
  await requestPhysicalRun(store, {
    titleId: record.id, itemType: 'poster', quantity: 50, cvllexRequestFn: async () => ({ id: 3 }),
  });
  assert.deepEqual(record.physicalProductionOrderIds, [3]);
});
