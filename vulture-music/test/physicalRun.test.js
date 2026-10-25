// Vvltvre Music — ordering a real physical run (CDs/vinyl/cassettes,
// merch) for a release, through CVLLEX's real production-order API.
// cvllexRequestFn is a fake here — no network, matching this whole
// ecosystem's injected-cross-app-call convention.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { submitRelease, markDistributing, markLive, requestPhysicalRun } = require('../lib/releases');
const { createVultureMusicStore } = require('../lib/store');

const NOW = Date.UTC(2026, 9, 25);

function fakeSettle() {
  return async () => ({ ok: true });
}

async function liveRelease(store, artistId = 'nova') {
  const release = await submitRelease(store, {
    artistId, title: 'Cherokee Street', format: 'single', targetPlatforms: ['Spotify'], settleFn: fakeSettle(), now: NOW,
  });
  markDistributing(store, release.id);
  markLive(store, release.id);
  return release;
}

test('requestPhysicalRun refuses for a release that is not live yet', async () => {
  const store = createVultureMusicStore();
  const release = await submitRelease(store, {
    artistId: 'nova', title: 'Cherokee Street', format: 'single', targetPlatforms: ['Spotify'], settleFn: fakeSettle(), now: NOW,
  });
  await assert.rejects(
    requestPhysicalRun(store, {
      releaseId: release.id, itemType: 'cd', quantity: 100, cvllexRequestFn: async () => ({ id: 1 }),
    }),
    /expected "live"/,
  );
});

test('requestPhysicalRun calls cvllexRequestFn with the real artist as creator and a real vendorNote', async () => {
  const store = createVultureMusicStore();
  const release = await liveRelease(store);

  let seen;
  const cvllexRequestFn = async (options) => { seen = options; return { id: 55 }; };

  const result = await requestPhysicalRun(store, {
    releaseId: release.id, itemType: 'cd', quantity: 100, estimatedUnitCost: 2.5, cvllexRequestFn,
  });

  assert.strictEqual(seen.creatorId, 'nova');
  assert.strictEqual(seen.itemType, 'cd');
  assert.strictEqual(seen.quantity, 100);
  assert.strictEqual(seen.estimatedUnitCost, 2.5);
  assert.match(seen.vendorNote, /release #\d+ "Cherokee Street"/);
  assert.strictEqual(result.order.id, 55);
});

test('requestPhysicalRun records the real cvllex order id on the release', async () => {
  const store = createVultureMusicStore();
  const release = await liveRelease(store);
  await requestPhysicalRun(store, {
    releaseId: release.id, itemType: 'vinyl', quantity: 150, cvllexRequestFn: async () => ({ id: 9 }),
  });
  assert.deepEqual(release.physicalProductionOrderIds, [9]);
});

test('requestPhysicalRun can be called more than once for the same release (CD now, vinyl later)', async () => {
  const store = createVultureMusicStore();
  const release = await liveRelease(store);
  await requestPhysicalRun(store, { releaseId: release.id, itemType: 'cd', quantity: 100, cvllexRequestFn: async () => ({ id: 1 }) });
  await requestPhysicalRun(store, { releaseId: release.id, itemType: 'vinyl', quantity: 150, cvllexRequestFn: async () => ({ id: 2 }) });
  assert.deepEqual(release.physicalProductionOrderIds, [1, 2]);
});
