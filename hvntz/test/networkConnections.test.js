// HVNTZ — Connected Network Layer, Phase 1 + Phase 2 (see
// lib/networkConnections.js's own header for scope). Every VACA/Vault
// Studios call is a fake function passed in exactly the way server.js
// injects the real fetch — these tests never touch the network, and
// assert both the happy path and the rules the freeze's §4/§8/§19/§40
// name: no duplicate identity record is ever created, a Network never
// becomes a second business model, and a Node's stream is always a
// reference to that same real person's own Vault Studios channel.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore, registerBusiness } = require('../lib/revenueStack');
const {
  NETWORK_NODE_STATUSES, findNetwork, findNode, createNetwork, inviteNode,
  respondToInvitation, removeNode, linkVavltChannel, unlinkVavltChannel,
  linkNetworkScreenSession, unlinkNetworkScreenSession,
  nodesForIdentity, networkView, networksForBusiness,
} = require('../lib/networkConnections');

function hubBusiness(store) {
  return registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
}

const fakeIdentityFetchFn = async (_subjectType, subjectId) => (
  subjectId === 'unverified-dj' ? { verified: false } : { verified: true, subjectId }
);

// Channel 501 is owned by 'dj-marcus' -- the same identity used to
// invite a node throughout this file's other tests, so ownership
// checks below have a real match to test against.
const fakeChannelFetchFn = async (channelId) => {
  if (channelId === 501) return { id: 501, ownerId: 'dj-marcus', name: 'DJ Marcus Live', streamUrl: 'https://stream.example/marcus' };
  if (channelId === 502) return { id: 502, ownerId: 'someone-else', name: 'Not Marcus', streamUrl: 'https://stream.example/other' };
  return null;
};

// Session 701 is a real 'viewer' session owned by 'owner-1' -- the
// same ownerId `hubBusiness` below registers the Hub business under,
// so the ownership-match check has a real match to test against.
const fakeSessionFetchFn = async (screenSessionId) => {
  if (screenSessionId === 701) return { id: 701, sessionType: 'viewer', ownerId: 'owner-1', channelIds: [501, 502] };
  if (screenSessionId === 702) return { id: 702, sessionType: 'broadcaster', ownerId: 'owner-1', channelIds: [501] };
  if (screenSessionId === 703) return { id: 703, sessionType: 'viewer', ownerId: 'someone-else', channelIds: [501] };
  return null;
};

async function activeNode(store, network) {
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  return respondToInvitation(store, { nodeId: node.id, response: 'accepted' });
}

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

// -- linkVavltChannel / unlinkVavltChannel (§4/§8, Phase 2) -------------------

test('linkVavltChannel verifies the channel is real rather than trusting the id', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  await assert.rejects(
    linkVavltChannel(store, { nodeId: node.id, vavltChannelId: 404, channelFetchFn: fakeChannelFetchFn }),
    /no Vault Studios channel with id 404/,
  );
  assert.strictEqual(node.vavltChannelId, null);
});

test('linkVavltChannel refuses a channel owned by a different identity — a Node cannot borrow someone else\'s stream', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  await assert.rejects(
    linkVavltChannel(store, { nodeId: node.id, vavltChannelId: 502, channelFetchFn: fakeChannelFetchFn }),
    /not owned by this node's own identity/,
  );
});

test('linkVavltChannel references the real channel by id, without duplicating its fields', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  const linked = await linkVavltChannel(store, { nodeId: node.id, vavltChannelId: 501, channelFetchFn: fakeChannelFetchFn });
  assert.strictEqual(linked.vavltChannelId, 501);
  assert.strictEqual(Object.keys(linked).includes('streamUrl'), false, 'a Node must not absorb the channel\'s own fields');
});

test('linkVavltChannel refuses a node that is not yet active — still-invited or declined/removed', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const invited = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  await assert.rejects(
    linkVavltChannel(store, { nodeId: invited.id, vavltChannelId: 501, channelFetchFn: fakeChannelFetchFn }),
    /must be active to carry a stream/,
  );
  const declined = respondToInvitation(store, { nodeId: invited.id, response: 'declined' });
  await assert.rejects(
    linkVavltChannel(store, { nodeId: declined.id, vavltChannelId: 501, channelFetchFn: fakeChannelFetchFn }),
    /must be active to carry a stream/,
  );
});

test('unlinkVavltChannel clears the reference', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  await linkVavltChannel(store, { nodeId: node.id, vavltChannelId: 501, channelFetchFn: fakeChannelFetchFn });
  const unlinked = unlinkVavltChannel(store, { nodeId: node.id });
  assert.strictEqual(unlinked.vavltChannelId, null);
});

// -- linkNetworkScreenSession / unlinkNetworkScreenSession (§3/§39) -----------

test('linkNetworkScreenSession verifies the session is real rather than trusting the id', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await assert.rejects(
    linkNetworkScreenSession(store, { networkId: network.id, screenSessionId: 404, sessionFetchFn: fakeSessionFetchFn }),
    /no Vault Studios screen session with id 404/,
  );
  assert.strictEqual(network.screenSessionId, null);
});

test('linkNetworkScreenSession refuses a broadcaster session — a Network can only ever compose a viewer session', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await assert.rejects(
    linkNetworkScreenSession(store, { networkId: network.id, screenSessionId: 702, sessionFetchFn: fakeSessionFetchFn }),
    /must be a 'viewer' session \(got 'broadcaster'\)/,
  );
});

test('linkNetworkScreenSession refuses a session not owned by this network\'s own business owner', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await assert.rejects(
    linkNetworkScreenSession(store, { networkId: network.id, screenSessionId: 703, sessionFetchFn: fakeSessionFetchFn }),
    /is not owned by this network's own business owner/,
  );
});

test('linkNetworkScreenSession references the real session by id, without duplicating its channelIds', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const linked = await linkNetworkScreenSession(store, { networkId: network.id, screenSessionId: 701, sessionFetchFn: fakeSessionFetchFn });
  assert.strictEqual(linked.screenSessionId, 701);
  assert.strictEqual(Object.keys(linked).includes('channelIds'), false, 'a Network must not absorb the session\'s own channel list');
});

test('unlinkNetworkScreenSession clears the reference', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  await linkNetworkScreenSession(store, { networkId: network.id, screenSessionId: 701, sessionFetchFn: fakeSessionFetchFn });
  const unlinked = unlinkNetworkScreenSession(store, { networkId: network.id });
  assert.strictEqual(unlinked.screenSessionId, null);
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
