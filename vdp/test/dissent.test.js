'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDissentStore, organizeRevolt, listActiveRevolts, revoltsInvolving, suppressRevolt,
  canOverpowerSecurity, attemptUprising, listOverpoweredRevolts,
  combinedStrength, requiredStrength,
} from '../src/lib/dissent.js';
import { getRobotType } from '../src/lib/robots.js';

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

// -- robot type + athletics (9 Oct 2026) ------------------------------------

test('combinedStrength falls back to plain headcount with no athletics scores -- the original behavior, unchanged', () => {
  const organization = { memberIds: ['a', 'b', 'c'] };
  assert.equal(combinedStrength(organization), 3);
  assert.equal(combinedStrength(organization, {}), 3);
  assert.equal(combinedStrength(null), 0);
});

test('combinedStrength gives real extra weight to a high real Athletics score, capped at one effective person', () => {
  const organization = { memberIds: ['a', 'b'] };
  const maxed = combinedStrength(organization, { athleticsScores: [100, 100] });
  assert.equal(maxed, 4, 'two members at Athletics 100 are each worth 2 effective people');
  const zero = combinedStrength(organization, { athleticsScores: [0, 0] });
  assert.equal(zero, 2, 'Athletics 0 is still a real person, worth exactly 1');
});

test('combinedStrength counts an unscored member as exactly one person, never zero', () => {
  const organization = { memberIds: ['a', 'b', 'c'] };
  const strength = combinedStrength(organization, { athleticsScores: [100] });
  assert.equal(strength, 1 + 1 + 1 + 1, 'one scored member (worth 2) plus two unscored members (worth 1 each)');
});

test('requiredStrength scales with the real robot type\'s overpowerStrength, falling back to plain robotCount', () => {
  const security = { robotCount: 2 };
  assert.equal(requiredStrength(security), 2, 'no robotType -- the original behavior, unchanged');
  assert.equal(requiredStrength(security, { robotType: getRobotType('patrol-drone') }), 2);
  assert.equal(requiredStrength(security, { robotType: getRobotType('military-robot') }), 16, '2 robots x overpowerStrength 8');
});

test('attemptUprising against military robots needs real, meaningfully more combined strength than against patrol drones', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'tech is the government' });
  const organization = { id: 9, name: 'The Resistance', memberIds: ['alice', 'bob'] };
  const security = { robotCount: 2 };

  assert.throws(
    () => attemptUprising(store, revolt.id, { organization, security, robotType: getRobotType('military-robot') }),
    /is not yet big enough/,
    'two real people cannot overpower two military robots',
  );
  // The same organization, same robot count, overpowers two patrol
  // drones just fine -- the robot TYPE is what changed the outcome.
  const result = attemptUprising(store, revolt.id, { organization, security, robotType: getRobotType('patrol-drone') });
  assert.ok(result.overpoweredAt);
});

test('attemptUprising lets real Athletics make up for a smaller real headcount', () => {
  const store = createDissentStore();
  const revolt = organizeRevolt(store, { leaderId: 'alice', reason: 'x' });
  const organization = { id: 10, name: 'Elite Few', memberIds: ['alice', 'bob'] };
  const security = { robotCount: 2 };
  const robotType = getRobotType('security-robot'); // overpowerStrength 2, so required = 4

  assert.throws(
    () => attemptUprising(store, revolt.id, { organization, security, robotType }),
    /is not yet big enough/,
    'two ordinary (unscored) people cannot reach a required strength of 4',
  );
  const result = attemptUprising(store, revolt.id, {
    organization, security, robotType, athleticsScores: [100, 100],
  });
  assert.ok(result.overpoweredAt, 'two Athletics-100 members together are worth 4 effective strength');
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
