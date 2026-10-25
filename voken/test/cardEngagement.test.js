// VOKEN -- real card engagement tracking, focused on the new `share`
// engagement type (added by direct instruction, beyond the source
// doc's original four). The failure this file exists to catch: a
// share event recorded but silently dropped from the real counts
// `computeEngagementStats` reports.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { ENGAGEMENT_TYPES, recordEngagementEvent, computeEngagementStats } = require('../lib/cardEngagement');

test('share is a real, accepted engagement type alongside the original four', () => {
  assert.deepEqual(ENGAGEMENT_TYPES, ['view', 'click', 'comment', 'like', 'share']);
});

test('recordEngagementEvent accepts a real share event', () => {
  const store = createVokenStore();
  const event = recordEngagementEvent(store, { cardId: 1, type: 'share' });
  assert.equal(event.type, 'share');
  assert.equal(event.cardId, 1);
});

test('recordEngagementEvent still refuses a type that is not real', () => {
  const store = createVokenStore();
  assert.throws(
    () => recordEngagementEvent(store, { cardId: 1, type: 'retweet' }),
    /invalid type "retweet"/,
  );
});

test('computeEngagementStats counts real shares separately from likes, not folded into them', () => {
  const store = createVokenStore();
  recordEngagementEvent(store, { cardId: 1, type: 'like' });
  recordEngagementEvent(store, { cardId: 1, type: 'share' });
  recordEngagementEvent(store, { cardId: 1, type: 'share' });

  const stats = computeEngagementStats(store, { cardId: 1 });
  assert.equal(stats.likes, 1);
  assert.equal(stats.shares, 2);
});

test('computeEngagementStats reports zero real shares for a card with none, not undefined', () => {
  const store = createVokenStore();
  recordEngagementEvent(store, { cardId: 1, type: 'view' });
  const stats = computeEngagementStats(store, { cardId: 1 });
  assert.equal(stats.shares, 0);
});
