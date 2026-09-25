// HVNTZ — Connected Network Layer, Phase 1 foundation.
// Source: `dev-docs/on-deck/HVNTZ_CONNECTED_NETWORK_FREEZE.md`, scoped
// by its own §40 audit (see `dev-docs/on-deck/README.md`, "The HVNTZ
// Connected Network §40 audit") to the narrowest real slice of §47's
// PHASE 1: a Network Hub (a real HVNTZ business, never a second
// business model — §41's own instruction), Network Nodes (people that
// business invites), and a real invite -> accept/decline state
// machine. No streaming, no camera/screen linking, no revenue-sharing
// engine, and no role system beyond hub-owner vs. invited member — the
// audit found no substrate for any of those anywhere in the repo, and
// each is its own undertaking, not a Phase 1 detail.
//
// **Not a second identity system.** §19's own rule: "Do not create
// duplicate accounts if the person already exists in VACA." Inviting a
// Node never creates a user record — `identityFetchFn` is VACA's real
// `GET /api/identity-status/:subjectType/:subjectId` (the same
// dedup pattern `cvnvo`, `void` and `vash-tap` already use), and a
// Network Node names an existing verified identity, nothing more.
//
// **A genuinely new state machine.** The on-deck audit found no real
// invitation accept/decline flow anywhere in the repo — VAGO Group
// Wagers' `invitedUserIds` is a static allow-list with no state, and
// VOKEN's Cvltvre Card application is reviewer-driven, not
// invitee-driven. `respondToInvitation` below is the first place in
// this ecosystem where the INVITED PERSON resolves their own
// invitation, not a business or a reviewer.

'use strict';

const { getBusiness } = require('./revenueStack');

const NETWORK_NODE_STATUSES = ['invited', 'active', 'declined', 'removed'];

function findNetwork(store, networkId) {
  return store.networks.find((n) => n.id === networkId) || null;
}

function findNode(store, nodeId) {
  return store.networkNodes.find((n) => n.id === nodeId) || null;
}

// The Hub is a real, existing HVNTZ business — verified against the
// same store `registerBusiness` already writes to, not assumed from an
// id. §41's own instruction: "First inspect the current... database
// architecture. Reuse existing... Business... where applicable."
function createNetwork(store, options = {}) {
  const { hubBusinessId, name, now = Date.now() } = options;
  if (!hubBusinessId) throw new Error('createNetwork requires a hubBusinessId');
  if (!name) throw new Error('createNetwork requires a name');
  const business = getBusiness(store, Number(hubBusinessId));
  if (!business) throw new Error(`createNetwork: no business with id ${hubBusinessId}`);

  const network = {
    id: store.nextNetworkId++,
    hubBusinessId: business.id,
    name,
    status: 'active',
    createdAt: now,
  };
  store.networks.push(network);
  return network;
}

// §19's node invitation, VACA-deduped. Refuses a second live
// (non-declined, non-removed) node for the same identity on the same
// network rather than accumulating duplicate invitations.
async function inviteNode(store, options = {}) {
  const {
    networkId, invitedIdentityId, invitedBy = null, identityFetchFn, now = Date.now(),
  } = options;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`inviteNode: no network ${networkId}`);
  if (!invitedIdentityId) throw new Error('inviteNode requires an invitedIdentityId');
  if (typeof identityFetchFn !== 'function') {
    throw new Error('inviteNode requires identityFetchFn(subjectType, subjectId)');
  }

  const status = await identityFetchFn('hvntz-network-member', invitedIdentityId);
  if (!status || !status.verified) {
    throw new Error(`inviteNode: identity ${invitedIdentityId} is not VACA-verified`);
  }

  const alreadyLive = store.networkNodes.some((n) => n.networkId === networkId
    && n.identityId === invitedIdentityId && n.status !== 'declined' && n.status !== 'removed');
  if (alreadyLive) {
    throw new Error(`inviteNode: ${invitedIdentityId} already has a live node on network ${networkId}`);
  }

  const node = {
    id: store.nextNetworkNodeId++,
    networkId,
    identityId: invitedIdentityId,
    status: 'invited',
    invitedBy,
    invitedAt: now,
    respondedAt: null,
  };
  store.networkNodes.push(node);
  return node;
}

// The invited person's own answer — not a business decision, per the
// module header above.
function respondToInvitation(store, options = {}) {
  const { nodeId, response, now = Date.now() } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`respondToInvitation: no node ${nodeId}`);
  if (node.status !== 'invited') {
    throw new Error(`respondToInvitation: node ${nodeId} is not awaiting a response (status=${node.status})`);
  }
  if (response !== 'accepted' && response !== 'declined') {
    throw new Error('respondToInvitation: response must be "accepted" or "declined"');
  }
  node.status = response === 'accepted' ? 'active' : 'declined';
  node.respondedAt = now;
  return node;
}

// §7's "who can disconnect a node" — the Hub business owner, at any
// point in a node's life (still invited, or already active).
function removeNode(store, options = {}) {
  const { nodeId, now = Date.now() } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`removeNode: no node ${nodeId}`);
  if (node.status === 'removed') throw new Error(`removeNode: node ${nodeId} is already removed`);
  node.status = 'removed';
  node.respondedAt = node.respondedAt ?? now;
  return node;
}

function nodesForNetwork(store, networkId) {
  return store.networkNodes.filter((n) => n.networkId === networkId);
}

// A person's own membership across every network they've ever been
// invited to — the same "the spender should have complete visibility
// into THEIR OWN activity" transparency principle VASH TAP's §18
// established for money, applied here to network membership.
function nodesForIdentity(store, identityId) {
  return store.networkNodes.filter((n) => n.identityId === identityId);
}

function networkView(store, networkId) {
  const network = findNetwork(store, networkId);
  if (!network) return null;
  const nodes = nodesForNetwork(store, networkId);
  return {
    ...network,
    nodes,
    activeNodeCount: nodes.filter((n) => n.status === 'active').length,
    invitedNodeCount: nodes.filter((n) => n.status === 'invited').length,
  };
}

function networksForBusiness(store, hubBusinessId) {
  return store.networks.filter((n) => n.hubBusinessId === hubBusinessId);
}

module.exports = {
  NETWORK_NODE_STATUSES,
  findNetwork,
  findNode,
  createNetwork,
  inviteNode,
  respondToInvitation,
  removeNode,
  nodesForNetwork,
  nodesForIdentity,
  networkView,
  networksForBusiness,
};
