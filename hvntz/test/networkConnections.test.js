// HVNTZ — Connected Network Layer, Phase 1 (see lib/networkConnections.js's
// own header for scope). Every VACA call is a fake function passed in
// exactly the way server.js injects the real fetch — these tests never
// touch the network, and assert both the happy path and the two rules
// the freeze's §19/§40 name: no duplicate identity record is ever
// created, and a Network never becomes a second business model.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore, registerBusiness } = require('../lib/revenueStack');
const {
  NETWORK_NODE_STATUSES, findNetwork, findNode, createNetwork, inviteNode,
  respondToInvitation, removeNode, nodesForIdentity, networkView, networksForBusiness,
} = require('../lib/networkConnections');

function hubBusiness(store) {
  return registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
}

const fakeIdentityFetchFn = async (_subjectType, subjectId) => (
  subjectId === 'unverified-dj' ? { verified: false } : { verified: true, subjectId }
);

// -- createNetwork -----------------------------------------------------------

test('createNetwork verifies the Hub is a real business rather than trusting the id', async () => {
  const store = createHvntzStore();
  assert.throws(() => createNetwork(store, { hubBusinessId: 404, name: 'Ghost Network' }), /no business with id 404/);
});

test('createNetwork requires a name', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  assert.throws(() => createNetwork(store, { hubBusinessId: hub.id }), /requires a name/);
});

test('createNetwork does not duplicate the business model — hubBusinessId only, no copied fields', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'The Standard Rooftop Network' });
  assert.strictEqual(network.hubBusinessId, hub.id);
  assert.strictEqual(Object.keys(network).includes('ownerId'), false, 'a Network must reference the business, never copy its fields');
  assert.strictEqual(network.status, 'active');
});

// -- inviteNode (§19) ----------------------------------------------------------

test('inviteNode verifies the identity is real and VACA-verified before creating a node', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await assert.rejects(
    inviteNode(store, { networkId: network.id, invitedIdentityId: 'unverified-dj', identityFetchFn: fakeIdentityFetchFn }),
    /not VACA-verified/,
  );
  assert.strictEqual(store.networkNodes.length, 0, 'no node record for an unverified identity');
});

test('inviteNode never creates a duplicate account — it only names an existing VACA identity', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.strictEqual(node.identityId, 'dj-marcus');
  assert.strictEqual(node.status, 'invited');
  assert.strictEqual(node.respondedAt, null);
});

test('inviteNode refuses a second live invitation to the same identity on the same network', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  await assert.rejects(
    inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn }),
    /already has a live node/,
  );
});

test('inviteNode allows a re-invite after the earlier node was declined', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const first = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: first.id, response: 'declined' });
  const second = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.notStrictEqual(second.id, first.id);
});

// -- respondToInvitation — the invited person's own answer --------------------

test('every declared NETWORK_NODE_STATUSES value is reachable', () => {
  assert.deepStrictEqual(NETWORK_NODE_STATUSES, ['invited', 'active', 'declined', 'removed']);
});

test('respondToInvitation("accepted") makes the node active', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  const responded = respondToInvitation(store, { nodeId: node.id, response: 'accepted' });
  assert.strictEqual(responded.status, 'active');
  assert.ok(responded.respondedAt);
});

test('respondToInvitation("declined") never becomes an active node', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  const responded = respondToInvitation(store, { nodeId: node.id, response: 'declined' });
  assert.strictEqual(responded.status, 'declined');
});

test('respondToInvitation refuses to answer a node twice', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: node.id, response: 'accepted' });
  assert.throws(() => respondToInvitation(store, { nodeId: node.id, response: 'declined' }), /not awaiting a response/);
});

test('respondToInvitation rejects a nonsense response value', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.throws(() => respondToInvitation(store, { nodeId: node.id, response: 'maybe' }), /must be "accepted" or "declined"/);
});

// -- removeNode (§7, "who can disconnect a node") ------------------------------

test('removeNode works on a still-invited node, not only an active one', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  const removed = removeNode(store, { nodeId: node.id });
  assert.strictEqual(removed.status, 'removed');
});

test('removeNode refuses a node that is already removed', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  removeNode(store, { nodeId: node.id });
  assert.throws(() => removeNode(store, { nodeId: node.id }), /already removed/);
});

test('a removed identity can be re-invited', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  removeNode(store, { nodeId: node.id });
  const again = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.notStrictEqual(again.id, node.id);
});

// -- views ---------------------------------------------------------------------

test('networkView reports live node counts, not stored ones', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const a = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  const b = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'bartender-b', identityFetchFn: fakeIdentityFetchFn });
  respondToInvitation(store, { nodeId: a.id, response: 'accepted' });
  const view = networkView(store, network.id);
  assert.strictEqual(view.activeNodeCount, 1);
  assert.strictEqual(view.invitedNodeCount, 1);
  assert.strictEqual(view.nodes.length, 2);
  void b;
});

test('networkView returns null for an unknown id, rather than throwing', () => {
  const store = createHvntzStore();
  assert.strictEqual(networkView(store, 999999), null);
});

test('nodesForIdentity gives a person their own membership across every network — §18-style transparency', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const netA = createNetwork(store, { hubBusinessId: hub.id, name: 'Net A' });
  const otherHub = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const netB = createNetwork(store, { hubBusinessId: otherHub.id, name: 'Net B' });
  await inviteNode(store, { networkId: netA.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  await inviteNode(store, { networkId: netB.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  const mine = nodesForIdentity(store, 'dj-marcus');
  assert.strictEqual(mine.length, 2);
});

test('networksForBusiness lists only that business\'s own networks', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const otherHub = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  createNetwork(store, { hubBusinessId: hub.id, name: 'Net A' });
  createNetwork(store, { hubBusinessId: otherHub.id, name: 'Net B' });
  assert.strictEqual(networksForBusiness(store, hub.id).length, 1);
});

test('findNetwork and findNode find by id, and return null for an unknown one', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.strictEqual(findNetwork(store, network.id).id, network.id);
  assert.strictEqual(findNetwork(store, 999999), null);
  assert.strictEqual(findNode(store, node.id).id, node.id);
  assert.strictEqual(findNode(store, 999999), null);
});
