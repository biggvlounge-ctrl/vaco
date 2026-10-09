'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pairKey, createRelationships, labelFor, getRelationship,
  recordConversation, recordSharedActivity, listRelationshipsFor,
  AFFINITY_MIN, AFFINITY_MAX, shareBackground, SHARED_BACKGROUND_MULTIPLIER,
  CONVERSATION_AFFINITY_DELTA, SHARED_ACTIVITY_AFFINITY_DELTA,
  rollBiasIncident, DIFFERENT_BACKGROUND_BIAS_MULTIPLIER, BIAS_INCIDENT_CHANCE,
} from '../src/lib/relationships.js';

test('pairKey is order-independent and refuses a self-pair', () => {
  assert.equal(pairKey('alice', 'bob'), pairKey('bob', 'alice'));
  assert.throws(() => pairKey('alice', 'alice'), /no relationship with themselves/);
});

test('a never-met pair reads as a real zero-affinity stranger, not undefined', () => {
  const relationships = createRelationships();
  const result = getRelationship(relationships, 'alice', 'bob');
  assert.equal(result.affinity, 0);
  assert.equal(result.label, 'stranger');
});

test('labelFor is hysteresis-free by design but threshold-correct at the boundaries', () => {
  assert.equal(labelFor(0), 'stranger');
  assert.equal(labelFor(20), 'acquaintance');
  assert.equal(labelFor(50), 'friend');
  assert.equal(labelFor(80), 'close');
});

test('a conversation moves affinity more than passive shared activity', () => {
  const relationships = createRelationships();
  recordConversation(relationships, 'alice', 'bob');
  const afterConversation = getRelationship(relationships, 'alice', 'bob').affinity;
  recordSharedActivity(relationships, 'alice', 'carol');
  const afterActivity = getRelationship(relationships, 'alice', 'carol').affinity;
  assert.ok(afterConversation > afterActivity, 'a deliberate conversation should move affinity more than standing nearby');
});

test('a negative conversation subtracts, and affinity clamps at both ends', () => {
  const relationships = createRelationships();
  recordConversation(relationships, 'alice', 'bob', { positive: false });
  assert.ok(getRelationship(relationships, 'alice', 'bob').affinity < 0);

  for (let i = 0; i < 1000; i += 1) recordConversation(relationships, 'alice', 'dave');
  assert.equal(getRelationship(relationships, 'alice', 'dave').affinity, AFFINITY_MAX);
  for (let i = 0; i < 1000; i += 1) recordConversation(relationships, 'alice', 'eve', { positive: false });
  assert.equal(getRelationship(relationships, 'alice', 'eve').affinity, AFFINITY_MIN);
});

test('listRelationshipsFor finds a person on either side of the stored key', () => {
  const relationships = createRelationships();
  recordConversation(relationships, 'alice', 'bob');
  recordConversation(relationships, 'carol', 'alice');
  const forAlice = listRelationshipsFor(relationships, 'alice').map((r) => r.otherId).sort();
  assert.deepEqual(forAlice, ['bob', 'carol']);
});

// -- shared culture/religion/origin (9 Oct 2026) ------------------------

test('shareBackground is true when two real demographic records share a culture, religion, or origin region', () => {
  assert.equal(shareBackground({ culture: 'x' }, { culture: 'x' }), true);
  assert.equal(shareBackground({ religion: 'y' }, { religion: 'y' }), true);
  assert.equal(shareBackground({ originRegion: 'Asia' }, { originRegion: 'Asia' }), true);
  assert.equal(shareBackground({ culture: 'x' }, { culture: 'z' }), false);
  assert.equal(shareBackground(null, { culture: 'x' }), false);
});

test('shareBackground never matches on two real, shared nulls -- "neither has one" is not "the same background"', () => {
  assert.equal(shareBackground({ culture: null }, { culture: null }), false);
});

test('recordConversation/recordSharedActivity apply the real shared-background bonus only when asked', () => {
  const relationships = createRelationships();
  recordConversation(relationships, 'alice', 'bob', { sharedBackground: true });
  assert.equal(getRelationship(relationships, 'alice', 'bob').affinity, CONVERSATION_AFFINITY_DELTA * SHARED_BACKGROUND_MULTIPLIER);

  const plain = createRelationships();
  recordSharedActivity(plain, 'alice', 'bob');
  assert.equal(getRelationship(plain, 'alice', 'bob').affinity, SHARED_ACTIVITY_AFFINITY_DELTA, 'omitting sharedBackground must behave exactly as before');

  const bonus = createRelationships();
  recordSharedActivity(bonus, 'alice', 'bob', { sharedBackground: true });
  assert.equal(getRelationship(bonus, 'alice', 'bob').affinity, SHARED_ACTIVITY_AFFINITY_DELTA * SHARED_BACKGROUND_MULTIPLIER);
});

// -- rollBiasIncident / recordConversation's biasIncident: the honest counterpart to shareBackground

test('rollBiasIncident is false for a warm (positive) exchange no matter the backgrounds', () => {
  const diff = { culture: 'a' };
  const other = { culture: 'b' };
  assert.equal(rollBiasIncident({ demoA: diff, demoB: other, positive: true, rng: () => 0 }), false);
});

test('rollBiasIncident is false when both sides share a real background, even in a hostile exchange', () => {
  const sameCulture = { culture: 'shared' };
  assert.equal(rollBiasIncident({ demoA: sameCulture, demoB: sameCulture, positive: false, rng: () => 0 }), false);
});

test('rollBiasIncident is false with no real demographics on either side', () => {
  assert.equal(rollBiasIncident({ demoA: null, demoB: { culture: 'a' }, positive: false, rng: () => 0 }), false);
});

test('rollBiasIncident rolls the real flagged-interpretive chance for a hostile exchange across different backgrounds', () => {
  const demoA = { culture: 'a' };
  const demoB = { culture: 'b' };
  assert.equal(rollBiasIncident({ demoA, demoB, positive: false, rng: () => BIAS_INCIDENT_CHANCE - 0.001 }), true);
  assert.equal(rollBiasIncident({ demoA, demoB, positive: false, rng: () => BIAS_INCIDENT_CHANCE }), false);
  assert.equal(rollBiasIncident({ demoA, demoB, positive: false, rng: () => 0.99 }), false);
});

test('recordConversation applies the real bias penalty only when asked, and reports it back', () => {
  const relationships = createRelationships();
  const result = recordConversation(relationships, 'alice', 'bob', { positive: false, biasIncident: true });
  assert.equal(result.affinity, -CONVERSATION_AFFINITY_DELTA * DIFFERENT_BACKGROUND_BIAS_MULTIPLIER);
  assert.equal(result.biasIncident, true);

  const plain = createRelationships();
  const plainResult = recordConversation(plain, 'alice', 'bob', { positive: false });
  assert.equal(plainResult.affinity, -CONVERSATION_AFFINITY_DELTA, 'omitting biasIncident must behave exactly as before');
  assert.equal(plainResult.biasIncident, false);
});

test('sharedBackground and biasIncident never both apply -- shared background always wins the multiplier slot', () => {
  const relationships = createRelationships();
  const result = recordConversation(relationships, 'alice', 'bob', { positive: false, sharedBackground: true, biasIncident: true });
  assert.equal(result.affinity, -CONVERSATION_AFFINITY_DELTA * SHARED_BACKGROUND_MULTIPLIER);
});
