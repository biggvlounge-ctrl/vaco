// HVNTZ — Connected Network Growth Analytics, §18. See
// lib/networkAnalytics.js's own header for exactly which of the
// thirteen named metrics are real here and why the rest are honestly
// absent rather than approximated.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createHvntzStore, registerBusiness, registerLocation,
} = require('../lib/revenueStack');
const { createNetwork, inviteNode, respondToInvitation, linkVavltChannel } = require('../lib/networkConnections');
const { createHunt, addCheckpoint, checkInAtCheckpoint } = require('../lib/hunts');
const { createRevenueShareAgreement, distributeRevenue } = require('../lib/revenueShareAgreements');
const { networkGrowthAnalytics } = require('../lib/networkAnalytics');

const fakeIdentityFetchFn = async () => ({ verified: true });
const fakeChannelFetchFn = async (channelId) => (
  channelId === 501 ? { id: 501, ownerId: 'dj-marcus', name: 'DJ Marcus Live', streamUrl: 'https://stream.example/marcus' } : null
);

function recorder() {
  const legs = [];
  const fn = async (settlementLegs) => { legs.push(...settlementLegs); return { id: 'settlement-1' }; };
  fn.legs = legs;
  return fn;
}

function hubNetwork(store) {
  const business = registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
  const network = createNetwork(store, { hubBusinessId: business.id, name: 'The Standard Rooftop Network' });
  return { business, network };
}

test('networkGrowthAnalytics throws for an unknown network id', () => {
  const store = createHvntzStore();
  assert.throws(() => networkGrowthAnalytics(store, 999999), /no network with id 999999/);
});

test('networkGrowthAnalytics counts network size and active nodes correctly', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const a = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  await inviteNode(store, { networkId: network.id, invitedIdentityId: 'bartender-b', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: a.id, response: 'accepted' });

  const analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.networkSize, 2, 'both invited and pending nodes count toward network size');
  assert.strictEqual(analytics.activeNodeCount, 1, 'only the accepted node is active');
});

test('networkGrowthAnalytics counts active creators/streams only for active nodes with a real linked channel', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: node.id, response: 'accepted' });

  let analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.activeStreamCount, 0, 'active but not yet streaming');

  await linkVavltChannel(store, { nodeId: node.id, vavltChannelId: 501, channelFetchFn: fakeChannelFetchFn });
  analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.activeCreatorCount, 1);
  assert.strictEqual(analytics.activeStreamCount, 1);
});

test('networkGrowthAnalytics counts real Hunt participation only through checkpoints connected to this network', async () => {
  const store = createHvntzStore();
  const { business, network } = hubNetwork(store);
  const location = registerLocation(store, {
    businessId: business.id, locationType: 'hub', address: '1 Rooftop Way, St. Louis, MO', lat: 38.6247, lng: -90.1848,
  });
  const hunt = createHunt(store, { title: 'Downtown Night Crawl', sponsorId: 'sponsor-1', totalBudget: 500 });
  const connectedCheckpoint = addCheckpoint(store, {
    huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 20, hostFee: 8, clue: 'Find it.', networkId: network.id,
  });
  const unconnectedCheckpoint = addCheckpoint(store, {
    huntId: hunt.id, businessId: business.id, locationId: location.id, bountyAmount: 20, hostFee: 8, clue: 'Find the other one.',
  });

  await checkInAtCheckpoint(store, { huntId: hunt.id, checkpointId: connectedCheckpoint.id, userId: 'hunter-1', settleFn: recorder() });
  await checkInAtCheckpoint(store, { huntId: hunt.id, checkpointId: unconnectedCheckpoint.id, userId: 'hunter-1', settleFn: recorder() });

  const analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.huntParticipationCount, 1, 'only the check-in at the connected checkpoint counts toward this network');
});

test('networkGrowthAnalytics reports real total revenue and per-payee revenue from actual distributions', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const agreement = createRevenueShareAgreement(store, {
    networkId: network.id,
    name: 'Split',
    splitType: 'percentage',
    shares: [{ role: 'business', payeeId: 'owner-1', value: 80 }, { role: 'dj', payeeId: 'dj-marcus', value: 20 }],
  });
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 100, payerId: 'owner-1', settleFn: recorder() });
  await distributeRevenue(store, { agreementId: agreement.id, totalAmount: 50, payerId: 'owner-1', settleFn: recorder() });

  const analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.distributionCount, 2);
  assert.strictEqual(analytics.totalRevenueDistributed, 150);
  assert.strictEqual(analytics.revenueByPayee['dj-marcus'], 30, '20% of 100 plus 20% of 50');
});

test('networkGrowthAnalytics reports zeroes, not errors, for a real but entirely quiet network', async () => {
  const store = createHvntzStore();
  const { network } = hubNetwork(store);
  const analytics = networkGrowthAnalytics(store, network.id);
  assert.strictEqual(analytics.networkSize, 0);
  assert.strictEqual(analytics.totalRevenueDistributed, 0);
  assert.deepStrictEqual(analytics.revenueByPayee, {});
});
