// VOKEN -- real card follows, by direct instruction: "there will be a,
// you can follow that card and you can like that card." The failure
// this file exists to catch: following a card twice stacking up as
// two real relationships, or an unfollow failing to actually drop the
// real follower count.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { followCard, unfollowCard, isFollowing, getFollowerCount } = require('../lib/cardFollows');

test('a card starts with zero real followers', () => {
  const store = createVokenStore();
  assert.equal(getFollowerCount(store, 1), 0);
  assert.equal(isFollowing(store, { cardId: 1, followerId: 'ada' }), false);
});

test('followCard creates a real following relationship', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ada' });
  assert.equal(isFollowing(store, { cardId: 1, followerId: 'ada' }), true);
  assert.equal(getFollowerCount(store, 1), 1);
});

test('following a card twice is a real no-op, not a second real relationship', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ada' });
  followCard(store, { cardId: 1, followerId: 'ada' });
  followCard(store, { cardId: 1, followerId: 'ada' });
  assert.equal(getFollowerCount(store, 1), 1, 'one real follower, no matter how many times they press follow');
});

test('unfollowCard removes the real relationship, and is itself a real no-op when not following', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ada' });
  const removed = unfollowCard(store, { cardId: 1, followerId: 'ada' });
  assert.equal(removed, true);
  assert.equal(isFollowing(store, { cardId: 1, followerId: 'ada' }), false);
  assert.equal(getFollowerCount(store, 1), 0);

  const removedAgain = unfollowCard(store, { cardId: 1, followerId: 'ada' });
  assert.equal(removedAgain, false, 'unfollowing someone not following is a real no-op, not an error');
});

test('several distinct real followers each count independently, and across different cards', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ada' });
  followCard(store, { cardId: 1, followerId: 'ben' });
  followCard(store, { cardId: 2, followerId: 'ada' });
  assert.equal(getFollowerCount(store, 1), 2);
  assert.equal(getFollowerCount(store, 2), 1);
});

test('followCard and unfollowCard require real cardId and followerId', () => {
  const store = createVokenStore();
  assert.throws(() => followCard(store, { followerId: 'ada' }), /requires a cardId/);
  assert.throws(() => followCard(store, { cardId: 1 }), /requires a followerId/);
  assert.throws(() => unfollowCard(store, { followerId: 'ada' }), /requires a cardId/);
  assert.throws(() => unfollowCard(store, { cardId: 1 }), /requires a followerId/);
});
