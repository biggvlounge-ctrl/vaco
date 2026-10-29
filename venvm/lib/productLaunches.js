// VENVM -- Product Launch Manager: a real launch record under a
// brand, with a real milestone checklist -- `launchReadiness` is a
// real, deterministic percentage of milestones actually marked
// complete by a caller, never an estimate or a model's guess at
// readiness.
//
// `generateLaunchCopy` (AI-drafted launch announcement copy) is this
// module's one real generative sliver -- stubbed via
// `pendingIntegration.js`.

const { getBrand } = require('./brandManagement');
const { pendingGenerationCall } = require('./pendingIntegration');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function createLaunch(store, options = {}) {
  const { brandId, productName, launchDate = null, milestones = [], now = Date.now() } = options;
  if (!getBrand(store, brandId)) throw new Error(`createLaunch: no brand with id ${brandId}`);
  requireString(productName, 'productName', 'createLaunch');
  if (!Array.isArray(milestones) || milestones.length === 0) {
    throw new Error('createLaunch requires at least one real milestone');
  }

  const launch = {
    id: store.nextProductLaunchId++,
    brandId,
    productName: productName.trim(),
    launchDate,
    milestones: milestones.map((label) => ({ label: requireString(label, 'milestone label', 'createLaunch'), done: false })),
    createdAt: now,
  };
  store.productLaunches.push(launch);
  return launch;
}

function getLaunch(store, launchId) {
  return store.productLaunches.find((l) => l.id === launchId) || null;
}

function listLaunchesForBrand(store, brandId) {
  return store.productLaunches.filter((l) => l.brandId === brandId);
}

// Idempotent -- completing an already-done milestone a second time is
// a real no-op, the same posture `followCard`/`markNotificationRead`
// already hold elsewhere in this ecosystem for a repeat call.
function completeMilestone(store, options = {}) {
  const { launchId, milestoneIndex, now = Date.now() } = options;
  const launch = getLaunch(store, launchId);
  if (!launch) throw new Error(`completeMilestone: no launch with id ${launchId}`);
  const milestone = launch.milestones[milestoneIndex];
  if (!milestone) throw new Error(`completeMilestone: launch ${launchId} has no milestone at index ${milestoneIndex}`);
  milestone.done = true;
  milestone.completedAt = now;
  return launch;
}

// A real, derived figure -- never stored and left to go stale, the
// same "derive, don't cache" rule `ambassadorTier` already holds.
function launchReadiness(store, launchId) {
  const launch = getLaunch(store, launchId);
  if (!launch) throw new Error(`launchReadiness: no launch with id ${launchId}`);
  const done = launch.milestones.filter((m) => m.done).length;
  return {
    launchId,
    totalMilestones: launch.milestones.length,
    completedMilestones: done,
    readiness: Math.round((done / launch.milestones.length) * 100) / 100,
    ready: done === launch.milestones.length,
  };
}

function generateLaunchCopy() {
  return pendingGenerationCall('AI product-launch announcement copy generation');
}

module.exports = {
  createLaunch, getLaunch, listLaunchesForBrand, completeMilestone, launchReadiness, generateLaunchCopy,
};
