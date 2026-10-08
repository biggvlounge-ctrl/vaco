'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDissentStore, organizeRevolt, listActiveRevolts, revoltsInvolving, suppressRevolt,
} from '../src/lib/dissent.js';

test('organizeRevolt records a real, named collective action against the government', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, {
    leaderId: 'alice', participantIds: ['bob', 'carol'], reason: 'against AI rule',
  });
  assert.equal(revolt.leaderId, 'alice');
  assert.deepEqual(revolt.participantIds, ['alice', 'bob', 'carol']);
  assert.equal(revolt.suppressedAt, null);
  assert.deepEqual(listActiveRevolts(store), [revolt]);
});

test('organizeRevolt never double-lists the leader if also named a participant', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', participantIds: ['alice', 'bob'], reason: 'x' });
  assert.deepEqual(revolt.participantIds, ['alice', 'bob']);
});

test('organizeRevolt requires a leaderId and a reason', () => {
  const store = createDissentStore();
  assert.throws(() => organizeRevolt(store, { reason: 'x' }), /requires a leaderId/);
  assert.throws(() => organizeRevolt(store, { leaderId: 'alice' }), /requires a reason/);
});

test('revoltsInvolving finds a real revolt by any real participant, not just the leader', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', participantIds: ['bob'], reason: 'x' });
  assert.deepEqual(revoltsInvolving(store, 'bob'), [revolt]);
  assert.deepEqual(revoltsInvolving(store, 'carol'), []);
});

test('suppressRevolt records a real end to the revolt, once', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'x' });
  const suppressed = suppressRevolt(store, revolt.id, { suppressedBy: 'patrol-1' });
  assert.ok(suppressed.suppressedAt);
  assert.equal(listActiveRevolts(store).length, 0);
  assert.throws(() => suppressRevolt(store, revolt.id), /already suppressed/);
});

test('suppressRevolt refuses an unknown revolt', () => {
  const store = createDissentStore();
  assert.throws(() => suppressRevolt(store, 9999), /no revolt/);
});
