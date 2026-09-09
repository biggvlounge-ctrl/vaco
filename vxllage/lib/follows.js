// VXLLAGE -- the real follow graph.
// Source of truth: VXLLAGE_CLAUDE.md's flagged gap -- "For You /
// Following toggle -- decorative (both render the same FEED array, no
// actual filtering logic)". A real Following feed needs a real follow
// graph to filter against; this module is that graph.

function followUser(store, options = {}) {
  const { followerId, followeeId } = options;
  if (!followerId || !followeeId) throw new Error('followUser requires followerId and followeeId');
  if (followerId === followeeId) throw new Error('followUser: cannot follow yourself');
  if (store.follows.some((f) => f.followerId === followerId && f.followeeId === followeeId)) {
    throw new Error(`followUser: ${followerId} already follows ${followeeId}`);
  }
  const follow = { followerId, followeeId, createdAt: Date.now() };
  store.follows.push(follow);
  return follow;
}

function unfollowUser(store, options = {}) {
  const { followerId, followeeId } = options;
  const existing = store.follows.find((f) => f.followerId === followerId && f.followeeId === followeeId);
  if (!existing) throw new Error(`unfollowUser: ${followerId} does not follow ${followeeId}`);
  store.follows = store.follows.filter((f) => f !== existing);
  return { followerId, followeeId };
}

function isFollowing(store, followerId, followeeId) {
  return store.follows.some((f) => f.followerId === followerId && f.followeeId === followeeId);
}

function getFollowing(store, userId) {
  return store.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
}

function getFollowers(store, userId) {
  return store.follows.filter((f) => f.followeeId === userId).map((f) => f.followerId);
}

module.exports = { followUser, unfollowUser, isFollowing, getFollowing, getFollowers };
