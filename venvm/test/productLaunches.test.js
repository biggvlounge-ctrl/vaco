// Product Launch Manager -- a real launch with a real milestone
// checklist and a real, derived readiness percentage.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const {
  createLaunch, getLaunch, listLaunchesForBrand, completeMilestone, launchReadiness, generateLaunchCopy,
} = require('../lib/productLaunches');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

function mkBrand(store) {
  return createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
}

test('createLaunch requires at least one real milestone', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  assert.throws(() => createLaunch(store, { brandId: brand.id, productName: 'X', milestones: [] }), /at least one real milestone/);
});

test('createLaunch creates a real launch with every milestone starting undone', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const launch = createLaunch(store, { brandId: brand.id, productName: 'X', milestones: ['Press kit', 'Trailer'] });
  assert.strictEqual(getLaunch(store, launch.id).productName, 'X');
  assert.ok(launch.milestones.every((m) => m.done === false));
  assert.strictEqual(listLaunchesForBrand(store, brand.id).length, 1);
});

test('completeMilestone is idempotent and refuses an unknown index', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const launch = createLaunch(store, { brandId: brand.id, productName: 'X', milestones: ['A'] });
  completeMilestone(store, { launchId: launch.id, milestoneIndex: 0 });
  completeMilestone(store, { launchId: launch.id, milestoneIndex: 0 });
  assert.strictEqual(launch.milestones[0].done, true);
  assert.throws(() => completeMilestone(store, { launchId: launch.id, milestoneIndex: 5 }), /no milestone at index 5/);
});

test('launchReadiness is a real, derived percentage, never stored and left to go stale', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const launch = createLaunch(store, { brandId: brand.id, productName: 'X', milestones: ['A', 'B', 'C', 'D'] });
  completeMilestone(store, { launchId: launch.id, milestoneIndex: 0 });
  let readiness = launchReadiness(store, launch.id);
  assert.strictEqual(readiness.readiness, 0.25);
  assert.strictEqual(readiness.ready, false);

  completeMilestone(store, { launchId: launch.id, milestoneIndex: 1 });
  completeMilestone(store, { launchId: launch.id, milestoneIndex: 2 });
  completeMilestone(store, { launchId: launch.id, milestoneIndex: 3 });
  readiness = launchReadiness(store, launch.id);
  assert.strictEqual(readiness.readiness, 1);
  assert.strictEqual(readiness.ready, true);
});

test('generateLaunchCopy is an honest, labeled pending integration point', () => {
  assert.throws(() => generateLaunchCopy(), PendingIntegrationError);
});
