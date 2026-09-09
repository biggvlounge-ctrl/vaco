// VOID — VOID Dedicated Lanes (freight/packages), modeled on the real
// DAT/Truckstop freight load boards.
// Source of truth: VOID_MASTER_FREEZE.md: real freight load boards
// distinguish spot-market one-off loads (post/find/book a single load,
// one-click "Book It Now") from Dedicated Lanes -- a carrier commits
// to running the same origin-destination lane repeatedly for a
// shipper, on a recurring schedule, rather than re-bidding every time.
// VOID offers both, as two genuinely distinct real mechanisms, not one
// blended model.

const RECURRENCE_SCHEDULES = ['daily', 'weekly'];

function createDedicatedLane(store, options = {}) {
  const { shipperId, originHubId, destinationHubId, recurrenceSchedule, ratePerRun } = options;
  if (!shipperId) throw new Error('createDedicatedLane requires a shipperId');
  if (!originHubId) throw new Error('createDedicatedLane requires an originHubId');
  if (!destinationHubId) throw new Error('createDedicatedLane requires a destinationHubId');
  if (!RECURRENCE_SCHEDULES.includes(recurrenceSchedule)) {
    throw new Error(`createDedicatedLane: invalid recurrenceSchedule "${recurrenceSchedule}" (expected one of ${RECURRENCE_SCHEDULES.join(', ')})`);
  }
  if (!Number.isFinite(ratePerRun) || ratePerRun <= 0) {
    throw new Error('createDedicatedLane requires a positive ratePerRun');
  }
  const lane = {
    id: store.nextDedicatedLaneId++,
    shipperId, originHubId, destinationHubId, recurrenceSchedule, ratePerRun,
    carrierId: null,
    status: 'open',
    createdAt: Date.now(),
  };
  store.dedicatedLanes.push(lane);
  return lane;
}

function getDedicatedLane(store, laneId) {
  return store.dedicatedLanes.find((l) => l.id === laneId) || null;
}

// A carrier commits to the whole recurring relationship -- exclusive,
// one carrier per lane at a time, matching the real DAT/Truckstop
// model (this isn't a re-bid-every-time spot load).
function claimDedicatedLane(store, options = {}) {
  const { laneId, carrierId } = options;
  const lane = getDedicatedLane(store, laneId);
  if (!lane) throw new Error(`claimDedicatedLane: no lane with id ${laneId}`);
  if (lane.status !== 'open') {
    throw new Error(`claimDedicatedLane: lane ${laneId} is "${lane.status}", not open`);
  }
  if (!carrierId) throw new Error('claimDedicatedLane requires a carrierId');
  lane.carrierId = carrierId;
  lane.status = 'committed';
  return lane;
}

function releaseDedicatedLane(store, laneId) {
  const lane = getDedicatedLane(store, laneId);
  if (!lane) throw new Error(`releaseDedicatedLane: no lane with id ${laneId}`);
  if (lane.status !== 'committed') {
    throw new Error(`releaseDedicatedLane: lane ${laneId} is "${lane.status}", not committed`);
  }
  lane.carrierId = null;
  lane.status = 'open';
  return lane;
}

// The genuinely separate mechanism: a one-off spot load, no recurring
// commitment, real "Book It Now" one-click accept.
function postSpotLoad(store, options = {}) {
  const { shipperId, originHubId, destinationHubId, payout } = options;
  if (!shipperId) throw new Error('postSpotLoad requires a shipperId');
  if (!originHubId) throw new Error('postSpotLoad requires an originHubId');
  if (!destinationHubId) throw new Error('postSpotLoad requires a destinationHubId');
  if (!Number.isFinite(payout) || payout <= 0) {
    throw new Error('postSpotLoad requires a positive payout');
  }
  const load = {
    id: store.nextSpotLoadId++,
    shipperId, originHubId, destinationHubId, payout,
    carrierId: null,
    status: 'available',
    createdAt: Date.now(),
  };
  store.spotLoads.push(load);
  return load;
}

function getSpotLoad(store, loadId) {
  return store.spotLoads.find((l) => l.id === loadId) || null;
}

function bookSpotLoad(store, options = {}) {
  const { loadId, carrierId } = options;
  const load = getSpotLoad(store, loadId);
  if (!load) throw new Error(`bookSpotLoad: no spot load with id ${loadId}`);
  if (load.status !== 'available') {
    throw new Error(`bookSpotLoad: spot load ${loadId} is "${load.status}", not available`);
  }
  if (!carrierId) throw new Error('bookSpotLoad requires a carrierId');
  load.carrierId = carrierId;
  load.status = 'booked';
  return load;
}

module.exports = {
  RECURRENCE_SCHEDULES,
  createDedicatedLane,
  getDedicatedLane,
  claimDedicatedLane,
  releaseDedicatedLane,
  postSpotLoad,
  getSpotLoad,
  bookSpotLoad,
};
