'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pairKey, createRelationships, labelFor, getRelationship,
  recordConversation, recordSharedActivity, listRelationshipsFor,
  AFFINITY_MIN, AFFINITY_MAX,
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
