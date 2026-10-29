// VOKEN — real card follows, by direct instruction: "there will be a,
// you can follow that card and you can like that card." Genuinely
// different in shape from `cardEngagement.js`'s view/click/comment/
// like/share event log: a follow is a real, durable *relationship*
// (you either are or are not currently following a card), not a
// countable event someone can do repeatedly in one sitting the way a
// comment can. Toggling follow -> unfollow -> follow again is one
// person's unchanged real relationship to the card, not three
// separate real actions to log.

function isFollowing(store, { cardId, followerId }) {
  return store.cardFollows.some((f) => f.cardId === cardId && f.followerId === followerId);
}

// Idempotent, the same real property an actual "Follow" button has:
// following a card you already follow is a no-op, not a second real
// relationship stacked on the first.
function followCard(store, options = {}) {
  const { cardId, followerId, now = Date.now() } = options;
  if (!cardId) throw new Error('followCard requires a cardId');
  if (!followerId) throw new Error('followCard requires a followerId');

  const existing = store.cardFollows.find((f) => f.cardId === cardId && f.followerId === followerId);
  if (existing) return existing;

  const follow = { cardId, followerId, followedAt: now };
  store.cardFollows.push(follow);
  return follow;
}

// Also idempotent -- unfollowing a card you don't follow is a real
// no-op, not an error, the same posture a real "Unfollow" button has.
function unfollowCard(store, options = {}) {
  const { cardId, followerId } = options;
  if (!cardId) throw new Error('unfollowCard requires a cardId');
  if (!followerId) throw new Error('unfollowCard requires a followerId');

  const index = store.cardFollows.findIndex((f) => f.cardId === cardId && f.followerId === followerId);
  if (index === -1) return false;
  store.cardFollows.splice(index, 1);
  return true;
}

function getFollowerCount(store, cardId) {
  if (!cardId) throw new Error('getFollowerCount requires a cardId');
  return store.cardFollows.filter((f) => f.cardId === cardId).length;
}

// The real list of who, not just how many -- `cardNotifications.js`'s
// own `notifyFollowersOfNewPeak()` needs the real follower ids
// themselves to notify, the same way `getFollowerCount` already
// needed the same real underlying data for a count.
function listFollowersForCard(store, cardId) {
  if (!cardId) throw new Error('listFollowersForCard requires a cardId');
  return store.cardFollows.filter((f) => f.cardId === cardId).map((f) => f.followerId);
}

module.exports = { followCard, unfollowCard, isFollowing, getFollowerCount, listFollowersForCard };
