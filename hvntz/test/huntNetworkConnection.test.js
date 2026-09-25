// HVNTZ — Connected Network Layer, Phase 3 (§11/§14): a Hunt
// checkpoint connected to its own host business's real Network. See
// lib/hunts.js's own Phase 3 header for scope.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createHvntzStore, registerBusiness, registerLocation,
} = require('../lib/revenueStack');
const {
  createHunt, addCheckpoint, checkInAtCheckpoint, linkCheckpointNetwork, unlinkCheckpointNetwork, checkpointLiveNetwork,
} = require('../lib/hunts');
const { createNetwork, inviteNode, respondToInvitation } = require('../lib/networkConnections');

const fakeIdentityFetchFn = async () => ({ verified: true });

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { ok: true }; };
  fn.legs = legs;
  return fn;
}

function hostBusinessAndLocation(store) {
  const business = registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
  const location = registerLocation(store, {
    businessId: business.id, locationType: 'hub', address: '1 Rooftop Way, St. Louis, MO', lat: 38.6247, lng: -90.1848,
  });
  return { business, location };
}

async function checkpointFixture(store, { networkId = null } = {}) {
  const { business, location } = hostBusinessAndLocation(store);
  const hunt = createHunt(store, { title: 'Downtown Night Crawl', sponsorId: 'sponsor-1', totalBudget: 500 });
  const checkpoint = addCheckpoint(store, {
    huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 20, hostFee: 8, clue: 'Find the rooftop.', networkId,
  });
  return { business, location, hunt, checkpoint };
}

// -- addCheckpoint's networkId ------------------------------------------------

test('addCheckpoint accepts no networkId at all — a checkpoint with no connected Network is the ordinary case', async () => {
  const store = createHvntzStore();
  const { checkpoint } = await checkpointFixture(store);
  assert.strictEqual(checkpoint.networkId, null);
});

test('addCheckpoint verifies the network is real rather than trusting the id', async () => {
  const store = createHvntzStore();
  const { business, location } = hostBusinessAndLocation(store);
  const hunt = createHunt(store, { title: 'Hunt', sponsorId: 'sponsor-1', totalBudget: 100 });
  assert.throws(
    () => addCheckpoint(store, {
      huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 10, hostFee: 5, clue: 'x', networkId: 404,
    }),
    /no network with id 404/,
  );
});

test('addCheckpoint refuses a network that belongs to a different business — never another business\'s Network', async () => {
  const store = createHvntzStore();
  const { business, location } = hostBusinessAndLocation(store);
  const otherBusiness = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const otherNetwork = createNetwork(store, { hubBusinessId: otherBusiness.id, name: 'Club B Network' });
  const hunt = createHunt(store, { title: 'Hunt', sponsorId: 'sponsor-1', totalBudget: 100 });
  assert.throws(
    () => addCheckpoint(store, {
      huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 10, hostFee: 5, clue: 'x', networkId: otherNetwork.id,
    }),
    /does not belong to this checkpoint's own business/,
  );
});

test('addCheckpoint accepts a real networkId belonging to the same business', async () => {
  const store = createHvntzStore();
  const { business, location } = hostBusinessAndLocation(store);
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'The Standard Rooftop Network' });
  const hunt = createHunt(store, { title: 'Hunt', sponsorId: 'sponsor-1', totalBudget: 100 });
  const checkpoint = addCheckpoint(store, {
    huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 10, hostFee: 5, clue: 'x', networkId: network.id,
  });
  assert.strictEqual(checkpoint.networkId, network.id);
});

// -- linkCheckpointNetwork / unlinkCheckpointNetwork ---------------------------

test('linkCheckpointNetwork connects an existing checkpoint to its business\'s Network, created after the checkpoint', async () => {
  const store = createHvntzStore();
  const { business, hunt, checkpoint } = await checkpointFixture(store);
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'The Standard Rooftop Network' });
  const linked = linkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id, networkId: network.id });
  assert.strictEqual(linked.networkId, network.id);
});

test('linkCheckpointNetwork refuses a network belonging to a different business', async () => {
  const store = createHvntzStore();
  const { hunt, checkpoint } = await checkpointFixture(store);
  const otherBusiness = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const otherNetwork = createNetwork(store, { hubBusinessId: otherBusiness.id, name: 'Club B Network' });
  assert.throws(
    () => linkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id, networkId: otherNetwork.id }),
    /does not belong to this checkpoint's own business/,
  );
});

test('unlinkCheckpointNetwork clears the connection', async () => {
  const store = createHvntzStore();
  const { business, hunt, checkpoint } = await checkpointFixture(store);
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'Net' });
  linkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id, networkId: network.id });
  const unlinked = unlinkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id });
  assert.strictEqual(unlinked.networkId, null);
});

// -- checkpointLiveNetwork (§11) and checkInAtCheckpoint's liveNetwork (§14) --

test('checkpointLiveNetwork returns null for a checkpoint with no connected Network, not an error', async () => {
  const store = createHvntzStore();
  const { hunt, checkpoint } = await checkpointFixture(store);
  assert.strictEqual(checkpointLiveNetwork(store, hunt, checkpoint.id), null);
});

test('checkpointLiveNetwork surfaces the connected Network\'s live nodes — §11 "LIVE NETWORK"', async () => {
  const store = createHvntzStore();
  const { business, hunt, checkpoint } = await checkpointFixture(store);
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'Net' });
  linkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id, networkId: network.id });
  const dj = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: dj.id, response: 'accepted' });

  const live = checkpointLiveNetwork(store, hunt, checkpoint.id);
  assert.strictEqual(live.id, network.id);
  assert.strictEqual(live.activeNodeCount, 1);
});

test('checkInAtCheckpoint folds the same live-network data into its own response — §14 "You\'re now at a Network location"', async () => {
  const store = createHvntzStore();
  const { business, hunt, checkpoint } = await checkpointFixture(store);
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'Net' });
  linkCheckpointNetwork(store, { huntId: hunt.id, checkpointId: checkpoint.id, networkId: network.id });

  const settleFn = recorder();
  const result = await checkInAtCheckpoint(store, {
    huntId: hunt.id, checkpointId: checkpoint.id, userId: 'hunter-1', settleFn,
  });
  assert.strictEqual(result.liveNetwork.id, network.id);
});

test('checkInAtCheckpoint reports liveNetwork:null for a checkpoint with no connected Network', async () => {
  const store = createHvntzStore();
  const { hunt, checkpoint } = await checkpointFixture(store);
  const settleFn = recorder();
  const result = await checkInAtCheckpoint(store, {
    huntId: hunt.id, checkpointId: checkpoint.id, userId: 'hunter-1', settleFn,
  });
  assert.strictEqual(result.liveNetwork, null);
});
