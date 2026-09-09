// VOID — Moving Services.
// Source of truth: VOID_MOVING_REAL_ESTATE_MEDIA.md, real comparables
// GoShare (vehicle-tiered job matching, real bookable equipment) and
// Dolly ("helper" extra-labor vs. "hand" vehicle-owner role
// distinction). Enriches the existing `freightMoving` vertical
// (registered since Phase 3) with the real vehicle-tier/equipment/
// helper data model it was always missing, rather than registering a
// separate vertical -- Moving was never actually distinct from
// Freight/Moving in the marketplace registry, just under-specified.
//
// Real code reuse: `createMovingJob` creates an actual marketplace job
// through the existing `requestJob()` (verticalId: 'freightMoving'),
// the same "one shared loop, not a parallel system" principle applied
// throughout this project.

const { requestJob } = require('./marketplace');

const VEHICLE_TIERS = ['car', 'suv', 'pickup', 'cargo-van', 'box-truck'];
const EQUIPMENT_OPTIONS = ['lift-gate', 'appliance-dolly', 'furniture-dolly', 'lumber-rack'];

function createMovingJob(store, options = {}) {
  const {
    customerId, requiredVehicleTier, requiredEquipment = [], helpersRequested = 0, quotedPrice,
  } = options;

  if (!VEHICLE_TIERS.includes(requiredVehicleTier)) {
    throw new Error(`createMovingJob: invalid requiredVehicleTier "${requiredVehicleTier}" (expected one of ${VEHICLE_TIERS.join(', ')})`);
  }
  for (const item of requiredEquipment) {
    if (!EQUIPMENT_OPTIONS.includes(item)) {
      throw new Error(`createMovingJob: invalid equipment "${item}" (expected one of ${EQUIPMENT_OPTIONS.join(', ')})`);
    }
  }
  if (!Number.isInteger(helpersRequested) || helpersRequested < 0) {
    throw new Error('createMovingJob requires a non-negative integer helpersRequested');
  }

  const job = requestJob(store, { verticalId: 'freightMoving', customerId, quantity: 1, unitPrice: quotedPrice });

  const movingJob = {
    id: store.nextMovingJobId++,
    jobId: job.id,
    customerId,
    requiredVehicleTier,
    requiredEquipment,
    helpersRequested,
    assignedDriverId: null,
    assignedHelperIds: [],
  };
  store.movingJobs.push(movingJob);
  return movingJob;
}

function getMovingJob(store, movingJobId) {
  return store.movingJobs.find((m) => m.id === movingJobId) || null;
}

function assignMovingDriver(store, options = {}) {
  const { movingJobId, driverId } = options;
  const movingJob = getMovingJob(store, movingJobId);
  if (!movingJob) throw new Error(`assignMovingDriver: no moving job with id ${movingJobId}`);
  if (!driverId) throw new Error('assignMovingDriver requires a driverId');
  movingJob.assignedDriverId = driverId;
  return movingJob;
}

function addMovingHelper(store, options = {}) {
  const { movingJobId, helperId } = options;
  const movingJob = getMovingJob(store, movingJobId);
  if (!movingJob) throw new Error(`addMovingHelper: no moving job with id ${movingJobId}`);
  if (!helperId) throw new Error('addMovingHelper requires a helperId');
  if (movingJob.assignedHelperIds.length >= movingJob.helpersRequested) {
    throw new Error(`addMovingHelper: moving job ${movingJobId} already has its requested ${movingJob.helpersRequested} helper(s)`);
  }
  movingJob.assignedHelperIds.push(helperId);
  return movingJob;
}

module.exports = {
  VEHICLE_TIERS,
  EQUIPMENT_OPTIONS,
  createMovingJob,
  getMovingJob,
  assignMovingDriver,
  addMovingHelper,
};
