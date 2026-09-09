// VOID — VOID Commute (recurring carpool), modeled on the real Scoop.
// Source of truth: VOID_MASTER_FREEZE.md: separate morning/evening
// scheduling windows with a deadline-based batch match (the matching
// algorithm runs once at the deadline, not continuously), and a
// backup on-demand ride guarantee if no carpool match is found (Scoop
// does this via a Lyft fallback; VOID can do it natively since Ride is
// already the same platform).
//
// Real matching, reusing this project's own Haversine helper: at the
// deadline, submitted riders are grouped by real geographic proximity
// into carpool groups up to MAX_CARPOOL_SIZE -- a real, simple
// nearest-neighbor clustering, not an invented placeholder. No source
// doc specifies a group size cap, so 3 is used as a flagged,
// interpretive default (driver + 2 riders, a common real carpool
// size).

const { haversineDistanceKm } = require('./geo');

const WINDOWS = ['morning', 'evening'];
const MAX_CARPOOL_SIZE = 3;
const CARPOOL_PROXIMITY_KM = 5; // flagged, interpretive: riders must be within this of each other to group

function openCommuteBatch(store, options = {}) {
  const { window, deadline } = options;
  if (!WINDOWS.includes(window)) {
    throw new Error(`openCommuteBatch: invalid window "${window}" (expected one of ${WINDOWS.join(', ')})`);
  }
  if (!Number.isFinite(deadline)) {
    throw new Error('openCommuteBatch requires a numeric deadline (ms epoch)');
  }
  const batch = { id: store.nextCommuteBatchId++, window, deadline, status: 'accepting', requests: [], carpoolGroups: [], unmatchedRiders: [] };
  store.commuteBatches.push(batch);
  return batch;
}

function getCommuteBatch(store, batchId) {
  return store.commuteBatches.find((b) => b.id === batchId) || null;
}

function submitCommuteRequest(store, options = {}) {
  const { batchId, riderId, pickupLat, pickupLng, now = Date.now() } = options;
  const batch = getCommuteBatch(store, batchId);
  if (!batch) throw new Error(`submitCommuteRequest: no batch with id ${batchId}`);
  if (batch.status !== 'accepting') {
    throw new Error(`submitCommuteRequest: batch ${batchId} is "${batch.status}", no longer accepting requests`);
  }
  if (now > batch.deadline) {
    throw new Error(`submitCommuteRequest: batch ${batchId}'s deadline has passed`);
  }
  if (!riderId) throw new Error('submitCommuteRequest requires a riderId');
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
    throw new Error('submitCommuteRequest requires numeric pickupLat and pickupLng');
  }
  const request = { riderId, pickupLat, pickupLng };
  batch.requests.push(request);
  return request;
}

// The real mechanic: runs once at the deadline, not continuously.
// Real nearest-neighbor grouping by proximity; anyone left ungrouped
// (or without a close-enough match) gets the real backup on-demand
// guarantee rather than being left with nothing.
function runBatchMatch(store, options = {}) {
  const { batchId, now = Date.now() } = options;
  const batch = getCommuteBatch(store, batchId);
  if (!batch) throw new Error(`runBatchMatch: no batch with id ${batchId}`);
  if (batch.status !== 'accepting') {
    throw new Error(`runBatchMatch: batch ${batchId} is "${batch.status}", already matched`);
  }
  if (now < batch.deadline) {
    throw new Error('runBatchMatch: cannot run before the batch deadline');
  }

  const remaining = [...batch.requests];
  const carpoolGroups = [];

  while (remaining.length > 0) {
    const seed = remaining.shift();
    const group = [seed];
    // Pull in the nearest still-remaining riders within proximity,
    // up to the group size cap.
    while (group.length < MAX_CARPOOL_SIZE && remaining.length > 0) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDistanceKm(seed.pickupLat, seed.pickupLng, remaining[i].pickupLat, remaining[i].pickupLng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestDist <= CARPOOL_PROXIMITY_KM) {
        group.push(remaining.splice(bestIdx, 1)[0]);
      } else {
        break;
      }
    }
    carpoolGroups.push(group);
  }

  // A "group" of exactly one rider found no real match -- the backup
  // on-demand guarantee applies.
  const unmatchedRiders = [];
  const realGroups = [];
  for (const group of carpoolGroups) {
    if (group.length === 1) {
      unmatchedRiders.push({ ...group[0], backupOnDemandGuaranteed: true });
    } else {
      realGroups.push(group);
    }
  }

  batch.carpoolGroups = realGroups;
  batch.unmatchedRiders = unmatchedRiders;
  batch.status = 'matched';
  return { carpoolGroups: realGroups, unmatchedRiders };
}

module.exports = {
  WINDOWS,
  MAX_CARPOOL_SIZE,
  CARPOOL_PROXIMITY_KM,
  openCommuteBatch,
  getCommuteBatch,
  submitCommuteRequest,
  runBatchMatch,
};
