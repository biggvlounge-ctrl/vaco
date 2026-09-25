// HVNTZ — Hunts (the original core mechanic).
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, stream #1: "Hunt
// participation revenue — the original HVNTZ model: real sponsor
// budgets and VCoin bounty participation from being a scavenger hunt
// checkpoint." Also the worked example: a real hunt combining Cahokia
// Mounds, the Gateway Arch, and the Confluence of the Missouri and
// Mississippi Rivers, woven with participating local restaurants —
// used directly below as the seeded demo hunt, matching the doc's own
// concrete illustration and this project's established St. Louis
// anchor (world-layer's own UNESCO import used Cahokia Mounds too).
//
// Everything built in Phases 1-2 was the business-revenue layer
// *around* hunts (Franchise List, Digital Twin, participation tiers)
// — this is the actual hunt mechanic those streams describe. Checking
// in at a checkpoint triggers TWO distinct real payouts: a VCoin
// bounty to the hunter (sponsor -> hunter) and a real
// 'hunt-participation' revenue event for the checkpoint's host
// business (sponsor -> business, via Phase 1's recordRevenueEvent) --
// both funded from the same real sponsor budget, matching the doc's
// framing of hunt participation as a genuine revenue stream for the
// host, not just a bounty system for hunters.
//
// **HVNTZ Connected Network, Phase 3 (§11/§14).** A checkpoint's
// `networkId` connects it to its own host business's real Network
// (`lib/networkConnections.js`) — never a second join entity, never
// another business's Network. `checkpointLiveNetwork` surfaces that
// Network's live nodes/streams both before check-in (§11's "LIVE
// NETWORK... select an available stream") and after it (§14's "You're
// now at a Network location", folded into `checkInAtCheckpoint`'s own
// return value) — the same real data both times, not two views.

const { getBusiness, getLocation, recordRevenueEvent } = require('./revenueStack');
const { haversineDistanceKm } = require('./neighborProgram');
const { findNetwork, networkView } = require('./networkConnections');

const HUNT_INTENSITY_LEVELS = ['leisurely', 'moderate', 'action-based'];

function createHunt(store, options = {}) {
  const { title, sponsorId, totalBudget, intensityLevel = 'moderate' } = options;
  if (!title) {
    throw new Error('createHunt requires a title');
  }
  if (!sponsorId) {
    throw new Error('createHunt requires a sponsorId');
  }
  if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
    throw new Error('createHunt requires a positive totalBudget');
  }
  if (!HUNT_INTENSITY_LEVELS.includes(intensityLevel)) {
    throw new Error(`createHunt: invalid intensityLevel "${intensityLevel}" (expected one of ${HUNT_INTENSITY_LEVELS.join(', ')})`);
  }

  const hunt = {
    id: store.nextHuntId++,
    title,
    sponsorId,
    totalBudget,
    remainingBudget: totalBudget,
    intensityLevel,
    checkpoints: [],
    nextCheckpointId: 1,
    participations: [], // { checkpointId, userId, checkedInAt }
  };
  store.hunts.push(hunt);
  return hunt;
}

function getHunt(store, huntId) {
  return store.hunts.find((h) => h.id === huntId) || null;
}

// §41's own instruction: "First inspect the current... database
// architecture... First inspect the current Prisma/database
// architecture. Reuse existing." A checkpoint's Network is not a new
// join entity — a checkpoint already carries the `businessId` it's
// hosted by, and §14's own worked example only ever connects a
// checkpoint to *its own host business's* Network, never another
// business's. `networkId` on a checkpoint enforces exactly that.
function resolveCheckpointNetworkId(store, networkId, businessId) {
  if (networkId === null || networkId === undefined) return null;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`no network with id ${networkId}`);
  if (network.hubBusinessId !== businessId) {
    throw new Error(`network ${networkId} does not belong to this checkpoint's own business (${businessId})`);
  }
  return networkId;
}

function addCheckpoint(store, options = {}) {
  const {
    huntId, businessId, locationId, bountyAmount, hostFee, clue, lat = null, lng = null, networkId = null,
  } = options;
  const hunt = getHunt(store, huntId);
  if (!hunt) {
    throw new Error(`addCheckpoint: no hunt with id ${huntId}`);
  }
  if (!getBusiness(store, businessId)) {
    throw new Error(`addCheckpoint: no business with id ${businessId}`);
  }
  if (!getLocation(store, locationId)) {
    throw new Error(`addCheckpoint: no location with id ${locationId}`);
  }
  if (!Number.isFinite(bountyAmount) || bountyAmount <= 0) {
    throw new Error('addCheckpoint requires a positive bountyAmount');
  }
  if (!Number.isFinite(hostFee) || hostFee <= 0) {
    throw new Error('addCheckpoint requires a positive hostFee');
  }
  if (!clue) {
    throw new Error('addCheckpoint requires a clue');
  }
  let resolvedNetworkId;
  try {
    resolvedNetworkId = resolveCheckpointNetworkId(store, networkId, businessId);
  } catch (err) {
    throw new Error(`addCheckpoint: ${err.message}`);
  }

  const checkpoint = {
    id: hunt.nextCheckpointId++,
    huntId,
    businessId,
    locationId,
    bountyAmount,
    hostFee,
    clue,
    lat,
    lng,
    networkId: resolvedNetworkId,
  };
  hunt.checkpoints.push(checkpoint);
  return checkpoint;
}

function getCheckpoint(hunt, checkpointId) {
  return hunt.checkpoints.find((c) => c.id === checkpointId) || null;
}

// §41's Hunt Builder addition ("NETWORK — Select Network") as an
// editable field, not creation-only — a checkpoint is often built
// before its host business has a Network yet.
function linkCheckpointNetwork(store, options = {}) {
  const { huntId, checkpointId, networkId } = options;
  const hunt = getHunt(store, huntId);
  if (!hunt) throw new Error(`linkCheckpointNetwork: no hunt with id ${huntId}`);
  const checkpoint = getCheckpoint(hunt, checkpointId);
  if (!checkpoint) throw new Error(`linkCheckpointNetwork: no checkpoint ${checkpointId} on hunt ${huntId}`);
  if (!networkId) throw new Error('linkCheckpointNetwork requires a networkId');
  try {
    checkpoint.networkId = resolveCheckpointNetworkId(store, networkId, checkpoint.businessId);
  } catch (err) {
    throw new Error(`linkCheckpointNetwork: ${err.message}`);
  }
  return checkpoint;
}

function unlinkCheckpointNetwork(store, options = {}) {
  const { huntId, checkpointId } = options;
  const hunt = getHunt(store, huntId);
  if (!hunt) throw new Error(`unlinkCheckpointNetwork: no hunt with id ${huntId}`);
  const checkpoint = getCheckpoint(hunt, checkpointId);
  if (!checkpoint) throw new Error(`unlinkCheckpointNetwork: no checkpoint ${checkpointId} on hunt ${huntId}`);
  checkpoint.networkId = null;
  return checkpoint;
}

// §11 ("LIVE NETWORK... a user can select an available stream") and
// §14 ("You're now at a Network location") are the same real data —
// a checkpoint's connected Network's live nodes, each an optional
// real Vault Studios stream reference — surfaced both BEFORE check-in
// (this function, standalone) and immediately AFTER it (folded into
// `checkInAtCheckpoint`'s own return value below). Returns null, not
// an error, for a checkpoint with no connected Network — that is the
// ordinary case, not a failure.
function checkpointLiveNetwork(store, hunt, checkpointId) {
  const checkpoint = getCheckpoint(hunt, checkpointId);
  if (!checkpoint) throw new Error(`checkpointLiveNetwork: no checkpoint ${checkpointId} on hunt ${hunt.id}`);
  if (!checkpoint.networkId) return null;
  return networkView(store, checkpoint.networkId);
}

function hasCheckedIn(hunt, checkpointId, userId) {
  return hunt.participations.some((p) => p.checkpointId === checkpointId && p.userId === userId);
}

// The actual mechanic: a real bounty to the hunter, a real
// hunt-participation revenue event for the host business, both funded
// from the same sponsor budget.
//
// **Real Vavlt Stvdios integration**: per `VAULT_STUDIOS_IG_LAYER.md`'s
// own "Hunt checkpoint photo-proof posts route through Vavlt Stvdios'
// post/story system, tagged to the relevant business's... profile --
// not a separate HVNTZ-owned photo feature." Checked directly against
// this function's own previous shape and confirmed no photo-proof
// mechanic existed here at all before this change, on either side.
// `photoUrl` is real and optional -- when supplied (along with a real,
// injected `postToVavltStvdios` function, the same cross-app pattern
// established throughout this session), a real Post is created on the
// checkpoint's own business profile (`authorId: checkpoint.businessId`,
// `source: 'hvntz-checkin'`), not the individual hunter's, matching
// the doc's own "tagged to the business['s]... profile." Real, flagged
// interpretive choice: posted as a story (`isStory: true`) since a
// photo-proof check-in is a real-time "happening now" moment, not a
// curated permanent post -- the doc doesn't specify either way.
async function checkInAtCheckpoint(store, options = {}) {
  const {
    huntId, checkpointId, userId, settleFn, photoUrl = null, postToVavltStvdios = null,
  } = options;
  const hunt = getHunt(store, huntId);
  if (!hunt) {
    throw new Error(`checkInAtCheckpoint: no hunt with id ${huntId}`);
  }
  const checkpoint = getCheckpoint(hunt, checkpointId);
  if (!checkpoint) {
    throw new Error(`checkInAtCheckpoint: no checkpoint with id ${checkpointId} in hunt ${huntId}`);
  }
  if (!userId) {
    throw new Error('checkInAtCheckpoint requires a userId');
  }
  if (hasCheckedIn(hunt, checkpointId, userId)) {
    throw new Error(`checkInAtCheckpoint: ${userId} has already checked in at checkpoint ${checkpointId}`);
  }
  const totalCost = checkpoint.bountyAmount + checkpoint.hostFee;
  if (totalCost > hunt.remainingBudget) {
    throw new Error(`checkInAtCheckpoint: hunt ${huntId} does not have enough remaining budget (needs ${totalCost}, has ${hunt.remainingBudget})`);
  }
  if (typeof settleFn !== 'function') {
    throw new Error('checkInAtCheckpoint requires a settleFn(legs, meta)');
  }
  if (photoUrl && typeof postToVavltStvdios !== 'function') {
    throw new Error('checkInAtCheckpoint: photoUrl was supplied but no postToVavltStvdios function was injected');
  }

  await settleFn(
    [{ fromUserId: hunt.sponsorId, toUserId: userId, amount: checkpoint.bountyAmount, reason: `hvntz_hunt_bounty:${huntId}:${checkpointId}` }],
    { reason: `hvntz_hunt_bounty:${huntId}:${checkpointId}` },
  );
  const revenueEvent = await recordRevenueEvent(store, {
    locationId: checkpoint.locationId,
    eventType: 'hunt-participation',
    amountEarned: checkpoint.hostFee,
    payerId: hunt.sponsorId,
    settleFn,
  });

  hunt.remainingBudget = Math.round((hunt.remainingBudget - totalCost) * 100) / 100;
  hunt.participations.push({ checkpointId, userId, checkedInAt: Date.now() });

  let vavltStvdiosPost = null;
  if (photoUrl) {
    vavltStvdiosPost = await postToVavltStvdios({
      authorId: checkpoint.businessId,
      postType: 'photo',
      mediaUrl: photoUrl,
      caption: `Checkpoint completed — ${hunt.title}`,
      source: 'hvntz-checkin',
      isStory: true,
    });
  }

  return {
    checkpoint,
    bountyPaid: checkpoint.bountyAmount,
    hostFeeEvent: revenueEvent,
    remainingBudget: hunt.remainingBudget,
    vavltStvdiosPost,
    // §14's own worked example, literally: "They complete the
    // checkpoint. The Hunt can show: You're now at a Network
    // location." Same real data `checkpointLiveNetwork` exposes
    // pre-check-in for §11 — not a second, separate view.
    liveNetwork: checkpointLiveNetwork(store, hunt, checkpointId),
  };
}

function getHuntProgress(store, huntId, userId) {
  const hunt = getHunt(store, huntId);
  if (!hunt) {
    throw new Error(`getHuntProgress: no hunt with id ${huntId}`);
  }
  const visited = hunt.participations.filter((p) => p.userId === userId);
  const totalEarned = Math.round(
    visited.reduce((sum, p) => sum + getCheckpoint(hunt, p.checkpointId).bountyAmount, 0) * 100
  ) / 100;
  return {
    huntId,
    userId,
    checkpointsVisited: visited.length,
    totalCheckpoints: hunt.checkpoints.length,
    totalEarned,
    complete: visited.length === hunt.checkpoints.length && hunt.checkpoints.length > 0,
  };
}

// HVNTER proactively recommends a break on action-based hunts,
// surfacing nearby hunt-affiliated businesses -- real distance from
// the hunter's current position where checkpoint coordinates exist.
function recommendBreak(store, options = {}) {
  const { huntId, userId, currentLat, currentLng } = options;
  const hunt = getHunt(store, huntId);
  if (!hunt) {
    throw new Error(`recommendBreak: no hunt with id ${huntId}`);
  }
  if (hunt.intensityLevel !== 'action-based') {
    return null;
  }

  const visitedCheckpointIds = new Set(hunt.participations.filter((p) => p.userId === userId).map((p) => p.checkpointId));
  const unvisited = hunt.checkpoints.filter((c) => !visitedCheckpointIds.has(c.id));

  const nearbyAffiliatedBusinesses = unvisited
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c) => ({
      businessId: c.businessId,
      distanceFromCurrentStop:
        typeof currentLat === 'number' && typeof currentLng === 'number'
          ? Math.round(haversineDistanceKm(currentLat, currentLng, c.lat, c.lng) * 100) / 100
          : null,
    }))
    .sort((a, b) => (a.distanceFromCurrentStop ?? Infinity) - (b.distanceFromCurrentStop ?? Infinity));

  return {
    huntId,
    userId,
    huntIntensityLevel: hunt.intensityLevel,
    recommendedAt: Date.now(),
    nearbyAffiliatedBusinesses,
  };
}

module.exports = {
  HUNT_INTENSITY_LEVELS,
  createHunt,
  getHunt,
  addCheckpoint,
  getCheckpoint,
  linkCheckpointNetwork,
  unlinkCheckpointNetwork,
  checkpointLiveNetwork,
  hasCheckedIn,
  checkInAtCheckpoint,
  getHuntProgress,
  recommendBreak,
};
