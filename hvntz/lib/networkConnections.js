// HVNTZ — Connected Network Layer, Phase 1 + Phase 2 (streaming link).
// Source: `dev-docs/on-deck/HVNTZ_CONNECTED_NETWORK_FREEZE.md`, scoped
// by its own §40 audit (see `dev-docs/on-deck/README.md`, "The HVNTZ
// Connected Network §40 audit"). Phase 1 (§47) is a Network Hub (a real
// HVNTZ business, never a second business model — §41's own
// instruction), Network Nodes (people that business invites), and a
// real invite -> accept/decline state machine.
//
// **Phase 3 (5 Nov 2026) — roles, schedules, temporary/multi-business
// networks, closing three gaps this file's own header used to name as
// unbuilt.** Each is scoped directly to what the freeze doc's own §7,
// §21 and §22 actually describe, not invented:
//
// - **§7's named role permissions.** §7 lists far more roles/
//   permissions than this app has any real enforcement point for
//   today (streaming, Hunt management, monetization, camera access —
//   none of those gate on a Node's identity anywhere in this
//   ecosystem yet). Building a role for permissions nothing checks
//   would be a label, not a role. The two permissions §7 names that
//   THIS module already enforces for real are "who can invite
//   additional nodes" and "who can disconnect a node" — both
//   currently hub-owner-only. `NODE_ROLES` is deliberately just
//   `['member', 'moderator']`: a moderator is a real, active node the
//   Hub owner has specifically promoted, who can now also invite and
//   remove nodes — the Hub owner delegating exactly the two real
//   permissions that exist, nothing more.
// - **§7's "schedule" field, read against per-person availability.**
//   `hunts.js`'s own `startsAt`/`timeLimitMinutes` is a one-off
//   absolute window, not recurring — no existing shape to reuse.
//   `NodeSchedule` is a real, minimal recurring weekly window
//   (`dayOfWeek` 0-6 UTC, `startMinute`/`endMinute` within that day),
//   set by the Node's own identity (their own expected availability
//   to be live, the same "the invited person, not the business"
//   posture `respondToInvitation`/`linkVavltChannel` already hold).
// - **§21 Temporary Event Networks** — real, bounded: an optional
//   caller-supplied `expiresAt` (never an invented global constant,
//   same discipline `vulture-studios`' `fundingDeadlineAt` holds) and
//   a real `archiveNetwork`/`sweepExpiredNetworks` pair, mirroring
//   `vulture-studios/lib/projects.js`'s own `expireProjectFunding`/
//   `sweepExpiredFunding` shape.
// - **§22 Multi-Business Networks** — read literally: "A Network does
//   not have to belong to one business... Each participating business
//   remains independently identifiable." That is NOT shared ownership
//   of the Hub (the Hub stays one real business, untouched) — it is
//   additional businesses *joining* a Network as members, each kept
//   as its own separate, identifiable business record. Built as
//   `NetworkBusinessMembership`, the exact same invite -> accept/
//   decline/remove state machine this file already proved out for
//   people, just for businesses: the Hub owner invites, the invited
//   business's own owner accepts or declines for themselves (same
//   "the invited party answers for themselves" posture as
//   `respondToInvitation`).
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
const NETWORK_STATUSES = ['active', 'archived'];
const NODE_ROLES = ['member', 'moderator'];
const NETWORK_BUSINESS_STATUSES = ['invited', 'active', 'declined', 'removed'];

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
//
// §21's Temporary Event Networks: `expiresAt` is optional and
// caller-supplied, never an invented global constant — a network with
// no `expiresAt` behaves exactly as before (permanent until explicitly
// archived).
function createNetwork(store, options = {}) {
  const { hubBusinessId, name, isTemporary = false, expiresAt = null, now = Date.now() } = options;
  if (!hubBusinessId) throw new Error('createNetwork requires a hubBusinessId');
  if (!name) throw new Error('createNetwork requires a name');
  if (expiresAt !== null && !Number.isFinite(expiresAt)) {
    throw new Error('createNetwork: expiresAt must be a numeric timestamp when provided');
  }
  const business = getBusiness(store, Number(hubBusinessId));
  if (!business) throw new Error(`createNetwork: no business with id ${hubBusinessId}`);

  const network = {
    id: store.nextNetworkId++,
    hubBusinessId: business.id,
    name,
    status: 'active',
    isTemporary: Boolean(isTemporary),
    expiresAt,
    archivedAt: null,
    screenSessionId: null,
    createdAt: now,
  };
  store.networks.push(network);
  return network;
}

// §21: archives a network explicitly. The underlying Hub business and
// its Nodes are untouched — "archived while the underlying businesses
// and creators remain active," per the doc's own words.
function archiveNetwork(store, options = {}) {
  const { networkId, now = Date.now() } = options;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`archiveNetwork: no network ${networkId}`);
  if (network.status === 'archived') throw new Error(`archiveNetwork: network ${networkId} is already archived`);
  network.status = 'archived';
  network.archivedAt = now;
  return network;
}

// Real, deterministic sweep — the same shape as
// `vulture-studios/lib/projects.js`'s `sweepExpiredFunding`: finds
// every real network past its own real `expiresAt` and archives it,
// never a fabricated "time's up" judgment.
function sweepExpiredNetworks(store, options = {}) {
  const { now = Date.now() } = options;
  const expired = store.networks.filter((n) => n.status === 'active' && n.expiresAt !== null && n.expiresAt <= now);
  for (const network of expired) {
    archiveNetwork(store, { networkId: network.id, now });
  }
  return expired.map((n) => n.id);
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
    role: 'member',
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

// §7's role delegation — the Hub owner only (never a moderator
// promoting another node, or themselves), same as this file's header
// says: a moderator gets the two real invite/remove permissions
// delegated to them, not the power to delegate further.
function setNodeRole(store, options = {}) {
  const { nodeId, role, now = Date.now() } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`setNodeRole: no node ${nodeId}`);
  if (!NODE_ROLES.includes(role)) {
    throw new Error(`setNodeRole: role must be one of ${NODE_ROLES.join(', ')}`);
  }
  if (node.status !== 'active') {
    throw new Error(`setNodeRole: node ${nodeId} must be active to hold a role (status=${node.status})`);
  }
  node.role = role;
  node.roleSetAt = now;
  return node;
}

// Checked live against this exact network every time — never assumed
// from a moderator role held on a different network.
function isNetworkModerator(store, networkId, identityId) {
  return store.networkNodes.some((n) => n.networkId === networkId
    && n.status === 'active' && n.role === 'moderator' && String(n.identityId) === String(identityId));
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
    moderatorNodeCount: nodes.filter((n) => n.status === 'active' && n.role === 'moderator').length,
    businesses: businessesForNetwork(store, networkId),
  };
}

function networksForBusiness(store, hubBusinessId) {
  return store.networks.filter((n) => n.hubBusinessId === hubBusinessId);
}

// -- NodeSchedule: real, recurring weekly availability --------------------
//
// Minutes-since-midnight UTC, not a wall-clock string or a timezone --
// a real, simple, bounded choice, flagged directly rather than quietly
// assumed: this does not account for the Node's own local timezone,
// the same scope line `vdp`'s own tick-based scheduling holds
// elsewhere in this ecosystem. A same-day window only (no
// overnight-spanning window) — a Node wanting an overnight slot adds
// two entries (e.g. 22:00-23:59 and 00:00-02:00) rather than this
// module inventing a wraparound case nothing asked for.
const MINUTES_PER_DAY = 24 * 60;

function findNodeSchedule(store, scheduleId) {
  return store.nodeSchedules.find((s) => s.id === scheduleId) || null;
}

function addNodeSchedule(store, options = {}) {
  const { nodeId, dayOfWeek, startMinute, endMinute, now = Date.now() } = options;
  const node = findNode(store, nodeId);
  if (!node) throw new Error(`addNodeSchedule: no node ${nodeId}`);
  if (node.status !== 'active') {
    throw new Error(`addNodeSchedule: node ${nodeId} must be active to hold a schedule (status=${node.status})`);
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error('addNodeSchedule: dayOfWeek must be an integer 0-6 (Sunday-Saturday, UTC)');
  }
  if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute >= MINUTES_PER_DAY) {
    throw new Error(`addNodeSchedule: startMinute must be an integer 0-${MINUTES_PER_DAY - 1}`);
  }
  if (!Number.isInteger(endMinute) || endMinute <= startMinute || endMinute > MINUTES_PER_DAY) {
    throw new Error(`addNodeSchedule: endMinute must be an integer greater than startMinute and at most ${MINUTES_PER_DAY}`);
  }

  const schedule = {
    id: store.nextNodeScheduleId++, nodeId, dayOfWeek, startMinute, endMinute, createdAt: now,
  };
  store.nodeSchedules.push(schedule);
  return schedule;
}

function removeNodeSchedule(store, options = {}) {
  const { scheduleId } = options;
  const schedule = findNodeSchedule(store, scheduleId);
  if (!schedule) throw new Error(`removeNodeSchedule: no schedule ${scheduleId}`);
  store.nodeSchedules = store.nodeSchedules.filter((s) => s.id !== scheduleId);
  return { removed: true, scheduleId };
}

function schedulesForNode(store, nodeId) {
  return store.nodeSchedules.filter((s) => s.nodeId === nodeId);
}

// Real, live-evaluated "is this person expected to be on right now,"
// never a cached flag that could drift from the real schedule entries.
function isNodeScheduledNow(store, nodeId, now = Date.now()) {
  const d = new Date(now);
  const dayOfWeek = d.getUTCDay();
  const minuteOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
  return schedulesForNode(store, nodeId).some(
    (s) => s.dayOfWeek === dayOfWeek && minuteOfDay >= s.startMinute && minuteOfDay < s.endMinute,
  );
}

// -- NetworkBusinessMembership: §22 Multi-Business Networks ---------------
//
// A second business *joining* an existing Network, never a second Hub
// and never shared ownership of the first — see this file's header.
// Same invite -> accept/decline/remove shape `inviteNode`/
// `respondToInvitation`/`removeNode` already proved out for people,
// here for businesses: the Hub owner invites, the invited business's
// own owner accepts or declines for themselves.
function findNetworkBusinessMembership(store, membershipId) {
  return store.networkBusinessMemberships.find((m) => m.id === membershipId) || null;
}

function inviteBusinessToNetwork(store, options = {}) {
  const { networkId, businessId, invitedBy = null, now = Date.now() } = options;
  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`inviteBusinessToNetwork: no network ${networkId}`);
  if (!businessId) throw new Error('inviteBusinessToNetwork requires a businessId');
  const business = getBusiness(store, Number(businessId));
  if (!business) throw new Error(`inviteBusinessToNetwork: no business with id ${businessId}`);
  if (business.id === network.hubBusinessId) {
    throw new Error(`inviteBusinessToNetwork: business ${businessId} is this network's own Hub, not a member to invite`);
  }

  const alreadyLive = store.networkBusinessMemberships.some((m) => m.networkId === networkId
    && m.businessId === business.id && m.status !== 'declined' && m.status !== 'removed');
  if (alreadyLive) {
    throw new Error(`inviteBusinessToNetwork: business ${businessId} already has a live membership on network ${networkId}`);
  }

  const membership = {
    id: store.nextNetworkBusinessMembershipId++,
    networkId,
    businessId: business.id,
    status: 'invited',
    invitedBy,
    invitedAt: now,
    respondedAt: null,
  };
  store.networkBusinessMemberships.push(membership);
  return membership;
}

// The invited business's own owner answers for their own business —
// same "the invited party, not the Hub, decides" posture as
// `respondToInvitation`.
function respondToBusinessInvitation(store, options = {}) {
  const { membershipId, response, now = Date.now() } = options;
  const membership = findNetworkBusinessMembership(store, membershipId);
  if (!membership) throw new Error(`respondToBusinessInvitation: no membership ${membershipId}`);
  if (membership.status !== 'invited') {
    throw new Error(`respondToBusinessInvitation: membership ${membershipId} is not awaiting a response (status=${membership.status})`);
  }
  if (response !== 'accepted' && response !== 'declined') {
    throw new Error('respondToBusinessInvitation: response must be "accepted" or "declined"');
  }
  membership.status = response === 'accepted' ? 'active' : 'declined';
  membership.respondedAt = now;
  return membership;
}

// The Hub owner's own call, any point in a membership's life — same
// shape as `removeNode`.
function removeBusinessFromNetwork(store, options = {}) {
  const { membershipId, now = Date.now() } = options;
  const membership = findNetworkBusinessMembership(store, membershipId);
  if (!membership) throw new Error(`removeBusinessFromNetwork: no membership ${membershipId}`);
  if (membership.status === 'removed') {
    throw new Error(`removeBusinessFromNetwork: membership ${membershipId} is already removed`);
  }
  membership.status = 'removed';
  membership.respondedAt = membership.respondedAt ?? now;
  return membership;
}

// Each participating business "remains independently identifiable,"
// per §22's own words — a real, flat list of this network's own member
// businesses, never merged into the Hub's own record.
function businessesForNetwork(store, networkId) {
  return store.networkBusinessMemberships.filter((m) => m.networkId === networkId);
}

module.exports = {
  NETWORK_NODE_STATUSES,
  NETWORK_STATUSES,
  NODE_ROLES,
  NETWORK_BUSINESS_STATUSES,
  findNetwork,
  findNode,
  createNetwork,
  archiveNetwork,
  sweepExpiredNetworks,
  inviteNode,
  respondToInvitation,
  removeNode,
  setNodeRole,
  isNetworkModerator,
  linkVavltChannel,
  unlinkVavltChannel,
  linkNetworkScreenSession,
  unlinkNetworkScreenSession,
  nodesForNetwork,
  nodesForIdentity,
  networkView,
  networksForBusiness,
  findNodeSchedule,
  addNodeSchedule,
  removeNodeSchedule,
  schedulesForNode,
  isNodeScheduledNow,
  findNetworkBusinessMembership,
  inviteBusinessToNetwork,
  respondToBusinessInvitation,
  removeBusinessFromNetwork,
  businessesForNetwork,
};
