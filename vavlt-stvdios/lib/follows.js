// VAVLT STVDIOS -- Follows.
// A real, minimal completion this phase genuinely needs, not
// specified by name in either source doc: `VAULT_STUDIOS_IG_LAYER.md`
// describes Explore as "entirely non-followed content," which is
// meaningless without a real follow graph underneath it -- without
// this, Explore would just be an identical copy of Feed. This module
// is exactly as small as that one requirement demands: follow/
// unfollow and a real followed-id lookup, nothing else (no follower
// counts, no suggested-follows, no notifications).

function followUser(store, options = {}) {
  const { followerId, followedId, now = Date.now() } = options;
  if (!followerId) throw new Error('followUser requires a followerId');
  if (!followedId) throw new Error('followUser requires a followedId');
  if (followerId === followedId) throw new Error('followUser: cannot follow yourself');
  if (store.follows.some((f) => f.followerId === followerId && f.followedId === followedId)) {
    throw new Error(`followUser: ${followerId} already follows ${followedId}`);
  }
  const follow = {
    id: store.nextFollowId++, followerId, followedId, createdAt: now,
  };
  store.follows.push(follow);
  return follow;
}

function unfollowUser(store, options = {}) {
  const { followerId, followedId } = options;
  const idx = store.follows.findIndex((f) => f.followerId === followerId && f.followedId === followedId);
  if (idx === -1) throw new Error(`unfollowUser: ${followerId} does not follow ${followedId}`);
  store.follows.splice(idx, 1);
  return { followerId, followedId };
}

function isFollowing(store, followerId, followedId) {
  return store.follows.some((f) => f.followerId === followerId && f.followedId === followedId);
}

function getFollowedIds(store, followerId) {
  return store.follows.filter((f) => f.followerId === followerId).map((f) => f.followedId);
}

module.exports = {
  followUser, unfollowUser, isFollowing, getFollowedIds,
};
