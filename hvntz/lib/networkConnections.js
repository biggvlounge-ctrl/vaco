// HVNTZ — Connected Network Layer, Phase 1 + Phase 2 (streaming link).
// Source: `dev-docs/on-deck/HVNTZ_CONNECTED_NETWORK_FREEZE.md`, scoped
// by its own §40 audit (see `dev-docs/on-deck/README.md`, "The HVNTZ
// Connected Network §40 audit"). Phase 1 (§47) is a Network Hub (a real
// HVNTZ business, never a second business model — §41's own
// instruction), Network Nodes (people that business invites), and a
// real invite -> accept/decline state machine. No revenue-sharing
// engine, and no role system beyond hub-owner vs. invited member — the
// audit found no substrate for either anywhere in the repo, and each
// is its own undertaking, not this module's job.
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
//
// **Phase 2: not a second streaming platform.** §8's own rule: "Vault
// Studios remains the streaming infrastructure. Do NOT create another
// streaming platform." The audit confirmed Vault Studios
// (`vavlt-stvdios/lib/channels.js`) already models exactly what §4
// wants — one real Channel per PERSON, not one combined stream per
// business — so a Node's stream is a *reference* to that person's own
// real Channel (`channelFetchFn`, the same verify-don't-duplicate
// pattern `registerTap`/`inviteNode` already use), never a copy of it.
// `linkVavltChannel` also verifies the channel's `ownerId` matches the
// node's own `identityId`, so a Node can only carry a stream the same
// real person actually owns.
//
// **§3/§39, the 8-camera/screen session layer — a link, not a
// creation.** `vavlt-stvdios/lib/screenSessions.js` already extends
// `MAX_SCREENS = 8` into exactly the shape §2's own worked example
// wants — a `'viewer'` session freely combining up to 8 channels from
// unrelated owners (a DJ's, a bartender's, a host's — each a
// different real person). But its own `POST /api/screen-sessions` is
// `requireActor('ownerId')`, a real Shield session with no service-
// credential path, so HVNTZ cannot create one on a business's behalf
// server-to-server. `linkNetworkScreenSession` follows the same
// verify-and-reference shape as `linkVavltChannel` instead: the
// business creates the real `'viewer'` session directly in Vault
// Studios, then links its id here — never a second grouping model,
// never a copy of the session's own channel list.

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
    screenSessionId: null,
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
    vavltChannelId: null,
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

// §4/§8's person-based streaming: a Node's stream is a reference to
// that same real person's own Vault Studios Channel, not a copy of it
// — see this file's header. Scoped to `status === 'active'`: an
// invitation still pending has no place showing a live stream to the
// Network, and a removed/declined node obviously carries none either.
async function linkVavltChannel(store, options = {}) {
  const { nodeId, vavltChannelId, channelFetchFn } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`linkVavltChannel: no node ${nodeId}`);
  if (node.status !== 'active') {
    throw new Error(`linkVavltChannel: node ${nodeId} must be active to carry a stream (status=${node.status})`);
  }
  if (!vavltChannelId) throw new Error('linkVavltChannel requires a vavltChannelId');
  if (typeof channelFetchFn !== 'function') {
    throw new Error('linkVavltChannel requires channelFetchFn(vavltChannelId)');
  }
  const channel = await channelFetchFn(vavltChannelId);
  if (!channel) throw new Error(`linkVavltChannel: no Vault Studios channel with id ${vavltChannelId}`);
  if (String(channel.ownerId) !== String(node.identityId)) {
    throw new Error(`linkVavltChannel: channel ${vavltChannelId} is not owned by this node's own identity`);
  }
  node.vavltChannelId = vavltChannelId;
  return node;
}

function unlinkVavltChannel(store, options = {}) {
  const { nodeId } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`unlinkVavltChannel: no node ${nodeId}`);
  node.vavltChannelId = null;
  return node;
}

// §3/§39: verifies the real Vault Studios `'viewer'` screen session
// is owned by this Network's own Hub business owner — the same
// ownership-match discipline `linkVavltChannel` already holds for a
// Node's own channel, applied at the business level instead. A
// `'broadcaster'` session is refused outright: Vault Studios' own
// validation would never let one include channels from more than one
// owner in the first place, so a Network (whose Nodes are always
// independently owned) can only ever compose a `'viewer'` session.
async function linkNetworkScreenSession(store, options = {}) {
  const { networkId, screenSessionId, sessionFetchFn, now = Date.now() } = options;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`linkNetworkScreenSession: no network ${networkId}`);
  if (!screenSessionId) throw new Error('linkNetworkScreenSession requires a screenSessionId');
  if (typeof sessionFetchFn !== 'function') {
    throw new Error('linkNetworkScreenSession requires sessionFetchFn(screenSessionId)');
  }
  const business = getBusiness(store, network.hubBusinessId);

  const session = await sessionFetchFn(screenSessionId);
  if (!session) throw new Error(`linkNetworkScreenSession: no Vault Studios screen session with id ${screenSessionId}`);
  if (session.sessionType !== 'viewer') {
    throw new Error(`linkNetworkScreenSession: screen session ${screenSessionId} must be a 'viewer' session (got '${session.sessionType}')`);
  }
  if (String(session.ownerId) !== String(business.ownerId)) {
    throw new Error(`linkNetworkScreenSession: screen session ${screenSessionId} is not owned by this network's own business owner`);
  }
  network.screenSessionId = screenSessionId;
  network.screenSessionLinkedAt = now;
  return network;
}

function unlinkNetworkScreenSession(store, options = {}) {
  const { networkId } = options;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`unlinkNetworkScreenSession: no network ${networkId}`);
  network.screenSessionId = null;
  return network;
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
  linkVavltChannel,
  unlinkVavltChannel,
  linkNetworkScreenSession,
  unlinkNetworkScreenSession,
  nodesForNetwork,
  nodesForIdentity,
  networkView,
  networksForBusiness,
};
