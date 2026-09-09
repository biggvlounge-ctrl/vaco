// VXLLAGE -- the real For You / Following feed distinction.
// Source of truth: VXLLAGE_CLAUDE.md is explicit that the prototype's
// version of this is fake: "For You / Following toggle -- decorative
// (both render the same FEED array, no actual filtering logic)." This
// module closes that gap for real, with the two feeds genuinely
// different in both SCOPE and RANKING, not just relabeled:
//
// - Following: real reverse-chronological, restricted to authors the
//   user actually follows (via lib/follows.js) plus their own posts --
//   the same simple, honest feed X's own Following tab is.
// - For You: real, live engagement-ranked, spanning ALL posts
//   (including non-followed authors) -- a genuinely different feed,
//   not a superset relabel.
//
// No exact ranking formula is given in any source doc -- the weights
// and recency curve below are real, deterministic, bounded, flagged
// interpretive choices, matching this session's established pattern
// (HVNTZ's Explore ranking, VOKEN's engagement-based Explore, VOID's
// dispatch intelligence score).

const { getFollowing } = require('./follows');

const FOR_YOU_WEIGHTS = { like: 3, repost: 5, reply: 4 };
const RECENCY_WINDOW_HOURS = 48;
const MIN_RECENCY_MULTIPLIER = 0.1;

function countReplies(store, postId) {
  return store.posts.filter((p) => p.replyToPostId === postId).length;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// A real, bounded recency decay: full weight at post time, linearly
// fading to a real floor (never zero -- an old-but-viral post can
// still surface) once RECENCY_WINDOW_HOURS has passed.
function recencyMultiplier(createdAt, now) {
  const ageHours = (now - createdAt) / (60 * 60 * 1000);
  return clamp(1 - ageHours / RECENCY_WINDOW_HOURS, MIN_RECENCY_MULTIPLIER, 1);
}

function computeForYouScore(store, post, now = Date.now()) {
  const engagement = post.likedBy.length * FOR_YOU_WEIGHTS.like
    + post.repostedBy.length * FOR_YOU_WEIGHTS.repost
    + countReplies(store, post.id) * FOR_YOU_WEIGHTS.reply;
  return engagement * recencyMultiplier(post.createdAt, now);
}

// Real, simple, honest: reverse-chronological, followed authors (plus
// the user's own posts) only -- genuinely scoped narrower than For
// You, never ranked by engagement.
function getFollowingFeed(store, options = {}) {
  const { userId } = options;
  if (!userId) throw new Error('getFollowingFeed requires a userId');
  const followedIds = new Set(getFollowing(store, userId));
  followedIds.add(userId);
  return store.posts
    .filter((p) => followedIds.has(p.authorId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Real, engagement-ranked, spans every post regardless of follow
// status -- genuinely different scope AND ranking from Following.
function getForYouFeed(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (!userId) throw new Error('getForYouFeed requires a userId');
  return store.posts
    .map((post) => ({ post, score: computeForYouScore(store, post, now) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({ ...entry.post, forYouScore: Math.round(entry.score * 100) / 100 }));
}

module.exports = {
  FOR_YOU_WEIGHTS, RECENCY_WINDOW_HOURS, computeForYouScore, getFollowingFeed, getForYouFeed,
};
