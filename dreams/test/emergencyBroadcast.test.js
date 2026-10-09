// DREAMS -- the government's emergency broadcast override. Per direct
// instruction: "these screens can all be controlled as once by the
// government to give out one message."

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDreamsStore } = require('../lib/store');
const { registerScreen } = require('../lib/screens');
const { syncScreenCache } = require('../lib/offlineCache');
const {
  EMERGENCY_BROADCAST_TYPES, pushEmergencyBroadcast, getActiveEmergencyBroadcast,
  clearEmergencyBroadcast, listEmergencyBroadcasts, resolveScreenContent,
} = require('../lib/emergencyBroadcast');

test('pushEmergencyBroadcast requires a real type and message', () => {
  const store = createDreamsStore();
  assert.throws(
    () => pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'not-a-real-type', message: 'x' }),
    new RegExp(EMERGENCY_BROADCAST_TYPES.join(', ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
  assert.throws(
    () => pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'weather' }),
    /requires a message/,
  );
});

test('a pushed broadcast becomes the one active broadcast', () => {
  const store = createDreamsStore();
  const broadcast = pushEmergencyBroadcast(store, {
    issuedBy: 'vdp', type: 'weather', message: 'Severe storm approaching Meridian -- seek shelter.',
  });
  assert.equal(getActiveEmergencyBroadcast(store), broadcast);
  assert.equal(broadcast.clearedAt, null);
});

test('a second real push replaces the first outright -- "one message", not a queue', () => {
  const store = createDreamsStore();
  pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'weather', message: 'first' });
  const second = pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'wanted', message: 'second' });
  assert.equal(getActiveEmergencyBroadcast(store), second);
  assert.equal(listEmergencyBroadcasts(store).length, 2, 'history keeps both, even though only one is active');
});

test('clearEmergencyBroadcast ends the active broadcast and refuses when none is active', () => {
  const store = createDreamsStore();
  const broadcast = pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'missing-person', message: 'x' });
  const cleared = clearEmergencyBroadcast(store, { clearedBy: 'vdp' });
  assert.equal(cleared.id, broadcast.id);
  assert.ok(cleared.clearedAt);
  assert.equal(getActiveEmergencyBroadcast(store), null);
  assert.throws(() => clearEmergencyBroadcast(store, {}), /no active emergency broadcast/);
});

test('resolveScreenContent overrides every real screen while a broadcast is active', () => {
  const store = createDreamsStore();
  const screen = registerScreen(store, { screenOwnerId: 'own1', locationName: 'V', locationAddress: 'L' });
  // Give the screen a perfectly good, unrelated cached ad -- the
  // broadcast must still win over it.
  syncScreenCache(store, { screenId: screen.id, creatives: [{ creativeId: 1, campaignId: 1 }] });
  const broadcast = pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'off-grid-search', message: 'x' });

  const resolved = resolveScreenContent(store, { screenId: screen.id });
  assert.equal(resolved.action, 'serve-emergency-broadcast');
  assert.equal(resolved.broadcast, broadcast);
});

test('resolveScreenContent refuses an unknown screenId even while a broadcast is active -- never reports an override for a screen that was never registered', () => {
  const store = createDreamsStore();
  pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'weather', message: 'x' });
  assert.throws(
    () => resolveScreenContent(store, { screenId: 99999 }),
    /no screen with id 99999/,
  );
});

test('resolveScreenContent defers to the existing offline resolver once no broadcast is active', () => {
  const store = createDreamsStore();
  const screen = registerScreen(store, { screenOwnerId: 'own1', locationName: 'V', locationAddress: 'L' });
  syncScreenCache(store, { screenId: screen.id, creatives: [{ creativeId: 7, campaignId: 9 }] });
  pushEmergencyBroadcast(store, { issuedBy: 'vdp', type: 'weather', message: 'x' });
  clearEmergencyBroadcast(store, { clearedBy: 'vdp' });

  const resolved = resolveScreenContent(store, { screenId: screen.id });
  assert.equal(resolved.action, 'serve-cached');
  assert.equal(resolved.creative.creativeId, 7);
});
