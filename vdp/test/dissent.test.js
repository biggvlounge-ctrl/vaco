'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDissentStore, organizeRevolt, listActiveRevolts, revoltsInvolving, suppressRevolt,
  canOverpowerSecurity, attemptUprising, listOverpoweredRevolts,
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

test('canOverpowerSecurity is true once the real organization is as big as the real robot count', () => {
  const security = { name: 'Elevated', robotCount: 2 };
  assert.equal(canOverpowerSecurity({ memberIds: ['a', 'b'] }, security), true);
  assert.equal(canOverpowerSecurity({ memberIds: ['a'] }, security), false);
  assert.equal(canOverpowerSecurity(null, security), false);
});

test('attemptUprising overpowers security once the leader\'s real organization is big enough', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'tech is the government' });
  const organization = { id: 7, name: 'The Free Tribe', memberIds: ['alice', 'bob'] };
  const security = { robotCount: 2 };
  const result = attemptUprising(store, revolt.id, { organization, security });
  assert.ok(result.overpoweredAt);
  assert.equal(result.overpoweredByOrganizationId, 7);
  assert.deepEqual(listOverpoweredRevolts(store), [result]);
});

test('attemptUprising refuses a revolt whose real organization is not yet big enough', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'x' });
  const organization = { id: 1, name: 'Tiny Tribe', memberIds: ['alice'] };
  assert.throws(
    () => attemptUprising(store, revolt.id, { organization, security: { robotCount: 4 } }),
    /not yet big enough/,
  );
});

test('attemptUprising requires a real organization and a real security tier', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'x' });
  assert.throws(
    () => attemptUprising(store, revolt.id, { security: { robotCount: 1 } }),
    /requires the leader's real organization/,
  );
  assert.throws(
    () => attemptUprising(store, revolt.id, { organization: { memberIds: ['alice'] } }),
    /requires the real current security tier/,
  );
});

test('a suppressed revolt cannot be overpowered, and an overpowered revolt cannot be suppressed', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'x' });
  suppressRevolt(store, revolt.id, { suppressedBy: 'patrol-1' });
  assert.throws(
    () => attemptUprising(store, revolt.id, { organization: { memberIds: ['alice'] }, security: { robotCount: 1 } }),
    /already suppressed/,
  );

  const store2 = createDissentStore();
  const revolt2 = organizeRevolt(store2, { leaderId: 'bob', reason: 'x' });
  const organization = { id: 2, name: 'Big Tribe', memberIds: ['bob', 'carol'] };
  attemptUprising(store2, revolt2.id, { organization, security: { robotCount: 2 } });
  assert.throws(() => suppressRevolt(store2, revolt2.id, { suppressedBy: 'patrol-1' }), /cannot be suppressed/);
});
