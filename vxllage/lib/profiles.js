// VXLLAGE -- real profile pages.
// Source of truth: VXLLAGE_CLAUDE.md's §0 gap list: "real profile
// pages" alongside real posting/threads/quote-posts. A real profile
// is a computed aggregation over real posts/follows data, not a
// separately-stored, cache-able-to-go-stale record.

const { getFollowing, getFollowers } = require('./follows');

function getUserProfile(store, options = {}) {
  const { userId } = options;
  if (!userId) throw new Error('getUserProfile requires a userId');

  const posts = store.posts
    .filter((p) => p.authorId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    userId,
    postCount: posts.length,
    followingCount: getFollowing(store, userId).length,
    followerCount: getFollowers(store, userId).length,
    posts,
  };
}

module.exports = { getUserProfile };
