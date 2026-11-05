// HVNTZ — Connected Network Layer, Phase 3 (see
// lib/networkConnections.js's own header for exactly what this closes
// and why each piece is scoped the way it is): §7 role delegation
// (invite/remove only — the two real permission dimensions this app
// actually enforces), §7 recurring per-person schedules, §21 Temporary
// Event Networks, and §22 Multi-Business Networks.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore, registerBusiness } = require('../lib/revenueStack');
const {
  NODE_ROLES, NETWORK_STATUSES, NETWORK_BUSINESS_STATUSES,
  createNetwork, archiveNetwork, sweepExpiredNetworks,
  inviteNode, respondToInvitation, removeNode, setNodeRole, isNetworkModerator,
  addNodeSchedule, removeNodeSchedule, schedulesForNode, isNodeScheduledNow,
  inviteBusinessToNetwork, respondToBusinessInvitation, removeBusinessFromNetwork, businessesForNetwork,
  networkView,
} = require('../lib/networkConnections');

function hubBusiness(store) {
  return registerBusiness(store, { name: 'The Standard Rooftop', ownerId: 'owner-1' });
}

const fakeIdentityFetchFn = async (_subjectType, subjectId) => ({ verified: true, subjectId });

async function activeNode(store, network, identityId = 'dj-marcus') {
  const node = await inviteNode(store, { networkId: network.id, invitedIdentityId: identityId, identityFetchFn: fakeIdentityFetchFn });
  return respondToInvitation(store, { nodeId: node.id, response: 'accepted' });
}

// -- NODE_ROLES / setNodeRole / isNetworkModerator ---------------------------

test('NODE_ROLES is bounded to the two permissions this app actually enforces', () => {
  assert.deepStrictEqual(NODE_ROLES, ['member', 'moderator']);
});

test('a node starts as a plain member, never a moderator by default', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  assert.strictEqual(node.role, 'member');
  assert.strictEqual(isNetworkModerator(store, network.id, node.identityId), false);
});

test('setNodeRole promotes an active node to moderator, and isNetworkModerator reflects it live', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  const promoted = setNodeRole(store, { nodeId: node.id, role: 'moderator' });
  assert.strictEqual(promoted.role, 'moderator');
  assert.strictEqual(isNetworkModerator(store, network.id, node.identityId), true);
});

test('setNodeRole rejects a role outside NODE_ROLES', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  assert.throws(() => setNodeRole(store, { nodeId: node.id, role: 'super-admin' }), /role must be one of/);
});

test('setNodeRole refuses a node that is not yet active', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const invited = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.throws(() => setNodeRole(store, { nodeId: invited.id, role: 'moderator' }), /must be active to hold a role/);
});

test('removing a moderator node revokes its moderator standing — isNetworkModerator is checked live, not cached', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  setNodeRole(store, { nodeId: node.id, role: 'moderator' });
  removeNode(store, { nodeId: node.id });
  assert.strictEqual(isNetworkModerator(store, network.id, node.identityId), false);
});

test('isNetworkModerator is checked against this exact network — a moderator on one network is a plain member on another', async () => {
  const store = createHvntzStore();
  const hubA = hubBusiness(store);
  const netA = createNetwork(store, { hubBusinessId: hubA.id, name: 'Net A' });
  const hubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const netB = createNetwork(store, { hubBusinessId: hubB.id, name: 'Net B' });
  const nodeA = await activeNode(store, netA, 'dj-marcus');
  await activeNode(store, netB, 'dj-marcus');
  setNodeRole(store, { nodeId: nodeA.id, role: 'moderator' });
  assert.strictEqual(isNetworkModerator(store, netA.id, 'dj-marcus'), true);
  assert.strictEqual(isNetworkModerator(store, netB.id, 'dj-marcus'), false);
});

test('networkView reports a real moderatorNodeCount', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  await activeNode(store, network, 'bartender-b');
  setNodeRole(store, { nodeId: node.id, role: 'moderator' });
  assert.strictEqual(networkView(store, network.id).moderatorNodeCount, 1);
});

// -- NodeSchedule: real, recurring weekly availability -----------------------

test('addNodeSchedule stores a real recurring weekly window', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  const schedule = addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 5, startMinute: 20 * 60, endMinute: 23 * 60 });
  assert.strictEqual(schedule.dayOfWeek, 5);
  assert.strictEqual(schedule.startMinute, 1200);
  assert.strictEqual(schedule.endMinute, 1380);
  assert.strictEqual(schedulesForNode(store, node.id).length, 1);
});

test('addNodeSchedule refuses a node that is not active', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const invited = await inviteNode(store, { networkId: network.id, invitedIdentityId: 'dj-marcus', identityFetchFn: fakeIdentityFetchFn });
  assert.throws(
    () => addNodeSchedule(store, { nodeId: invited.id, dayOfWeek: 5, startMinute: 0, endMinute: 60 }),
    /must be active to hold a schedule/,
  );
});

test('addNodeSchedule rejects an out-of-range dayOfWeek', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  assert.throws(() => addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 7, startMinute: 0, endMinute: 60 }), /dayOfWeek must be/);
});

test('addNodeSchedule rejects an endMinute at or before startMinute — no invented overnight wraparound', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  assert.throws(() => addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 0, startMinute: 600, endMinute: 600 }), /endMinute must be/);
  assert.throws(() => addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 0, startMinute: 600, endMinute: 100 }), /endMinute must be/);
});

test('isNodeScheduledNow is real and live-evaluated against UTC day/minute-of-day', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 3, startMinute: 20 * 60, endMinute: 22 * 60 }); // Wed 20:00-22:00 UTC

  const insideWindow = Date.UTC(2026, 10, 4, 21, 0); // 2026-11-04 is a Wednesday
  const outsideWindow = Date.UTC(2026, 10, 4, 10, 0);
  const wrongDay = Date.UTC(2026, 10, 5, 21, 0); // Thursday

  assert.strictEqual(isNodeScheduledNow(store, node.id, insideWindow), true);
  assert.strictEqual(isNodeScheduledNow(store, node.id, outsideWindow), false);
  assert.strictEqual(isNodeScheduledNow(store, node.id, wrongDay), false);
});

test('removeNodeSchedule deletes the entry, and a node with no schedule is never "scheduled now"', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  const node = await activeNode(store, network);
  const schedule = addNodeSchedule(store, { nodeId: node.id, dayOfWeek: 3, startMinute: 0, endMinute: 1440 });
  removeNodeSchedule(store, { scheduleId: schedule.id });
  assert.strictEqual(schedulesForNode(store, node.id).length, 0);
  assert.strictEqual(isNodeScheduledNow(store, node.id, Date.UTC(2026, 10, 4, 12, 0)), false);
});

// -- §21 Temporary Event Networks ---------------------------------------------

test('NETWORK_STATUSES is real and bounded', () => {
  assert.deepStrictEqual(NETWORK_STATUSES, ['active', 'archived']);
});

test('createNetwork with no expiresAt behaves exactly as before — permanent until explicitly archived', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  assert.strictEqual(network.isTemporary, false);
  assert.strictEqual(network.expiresAt, null);
  assert.strictEqual(network.status, 'active');
});

test('createNetwork rejects a non-numeric expiresAt — never a fabricated deadline', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  assert.throws(
    () => createNetwork(store, { hubBusinessId: hub.id, name: 'Festival', expiresAt: 'soon' }),
    /expiresAt must be a numeric timestamp/,
  );
});

test('archiveNetwork sets status/archivedAt, and refuses to archive twice', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net', now: 1000 });
  const archived = archiveNetwork(store, { networkId: network.id, now: 2000 });
  assert.strictEqual(archived.status, 'archived');
  assert.strictEqual(archived.archivedAt, 2000);
  assert.throws(() => archiveNetwork(store, { networkId: network.id }), /already archived/);
});

test('sweepExpiredNetworks archives only real, active networks genuinely past their own expiresAt', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const expired = createNetwork(store, { hubBusinessId: hub.id, name: 'Summer Festival', isTemporary: true, expiresAt: 1000 });
  const notYet = createNetwork(store, { hubBusinessId: hub.id, name: 'Still Running', isTemporary: true, expiresAt: 9000 });
  const permanent = createNetwork(store, { hubBusinessId: hub.id, name: 'Permanent Net' });

  const archivedIds = sweepExpiredNetworks(store, { now: 5000 });
  assert.deepStrictEqual(archivedIds, [expired.id]);
  assert.strictEqual(expired.status, 'archived');
  assert.strictEqual(notYet.status, 'active');
  assert.strictEqual(permanent.status, 'active');
});

test('archiving an event network leaves its real Nodes and their Hub business untouched — only the Network is archived', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Summer Festival', isTemporary: true, expiresAt: 1000 });
  const node = await activeNode(store, network);
  archiveNetwork(store, { networkId: network.id, now: 2000 });
  assert.strictEqual(node.status, 'active', 'the underlying Node/creator stays active, per §21\'s own words');
});

// -- §22 Multi-Business Networks ----------------------------------------------

test('NETWORK_BUSINESS_STATUSES mirrors the Node invite/accept/decline/remove shape', () => {
  assert.deepStrictEqual(NETWORK_BUSINESS_STATUSES, ['invited', 'active', 'declined', 'removed']);
});

test('inviteBusinessToNetwork verifies the business is real rather than trusting the id', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  await assert.rejects(
    async () => inviteBusinessToNetwork(store, { networkId: network.id, businessId: 404 }),
    /no business with id 404/,
  );
});

test('inviteBusinessToNetwork refuses inviting the network\'s own Hub business as a member', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Net' });
  assert.throws(
    () => inviteBusinessToNetwork(store, { networkId: network.id, businessId: hub.id }),
    /is this network's own Hub, not a member to invite/,
  );
});

test('inviteBusinessToNetwork refuses a second live invitation to the same business', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  const clubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  assert.throws(
    () => inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id }),
    /already has a live membership/,
  );
});

test('respondToBusinessInvitation("accepted") makes the membership active; "declined" never does', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  const clubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const membership = inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  const accepted = respondToBusinessInvitation(store, { membershipId: membership.id, response: 'accepted' });
  assert.strictEqual(accepted.status, 'active');

  const restaurant = registerBusiness(store, { name: 'Restaurant C', ownerId: 'owner-3' });
  const membership2 = inviteBusinessToNetwork(store, { networkId: network.id, businessId: restaurant.id });
  const declined = respondToBusinessInvitation(store, { membershipId: membership2.id, response: 'declined' });
  assert.strictEqual(declined.status, 'declined');
});

test('removeBusinessFromNetwork sets removed, and a re-invite is allowed afterward', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  const clubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const membership = inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  respondToBusinessInvitation(store, { membershipId: membership.id, response: 'accepted' });
  const removed = removeBusinessFromNetwork(store, { membershipId: membership.id });
  assert.strictEqual(removed.status, 'removed');
  const again = inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  assert.notStrictEqual(again.id, membership.id);
});

test('businessesForNetwork lists every participating business, each independently identifiable — per §22\'s own words', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  const clubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  const restaurant = registerBusiness(store, { name: 'Restaurant C', ownerId: 'owner-3' });
  inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  inviteBusinessToNetwork(store, { networkId: network.id, businessId: restaurant.id });

  const memberships = businessesForNetwork(store, network.id);
  assert.strictEqual(memberships.length, 2);
  const businessIds = memberships.map((m) => m.businessId).sort();
  assert.deepStrictEqual(businessIds, [clubB.id, restaurant.id].sort());
});

test('networkView surfaces the real businesses list alongside nodes', async () => {
  const store = createHvntzStore();
  const hub = hubBusiness(store);
  const network = createNetwork(store, { hubBusinessId: hub.id, name: 'Downtown Nightlife' });
  const clubB = registerBusiness(store, { name: 'Club B', ownerId: 'owner-2' });
  inviteBusinessToNetwork(store, { networkId: network.id, businessId: clubB.id });
  assert.strictEqual(networkView(store, network.id).businesses.length, 1);
});
