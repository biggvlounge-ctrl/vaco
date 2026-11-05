// CHOPZ -- For You ranking.
// Source of truth: this project's own README "Not yet built" list,
// which flagged "For You ranking (a real recommendation algorithm)"
// as a separately large build once `lib/engagement.js` closed the
// likes/comments/shares slice. This closes it.
//
// **What this honestly is, and is not.** TikTok's own real ranking
// algorithm is proprietary -- its public Dec-2020 "How TikTok
// recommends videos For You" post names the real signal categories
// ("video completion rate" as the strongest, then "comments, likes,
// shares, and plays," then weaker signals like captions/sounds) but
// publishes no exact numeric weights, because those are the product's
// own trade secret. There is nothing to cite here beyond the signal
// NAMES, so `ENGAGEMENT_WEIGHTS` below is this engine's own real,
// stated, deterministic heuristic -- not a reconstruction of the real
// formula. The one TikTok signal this file genuinely cannot use is
// completion rate itself: this app tracks a play EVENT (see
// lib/engagement.js), never a watch DURATION or whether a viewer
// finished the clip, and inventing a fake completion percentage would
// be fabricating data that was never real. Likes/comments/shares/
// plays are the real, available slice.
//
// **The weighting, stated plainly rather than hidden in a number.**
// A play is the cheapest possible signal -- it fires just from
// opening the clip. A like costs one tap. A comment costs composing
// real text. A share costs leaving the app's own feed to tell someone
// else. Each is a real, higher-effort signal than the one before it,
// so each counts for more -- the same ordinal principle TikTok's own
// public explainer confirms by grouping them together as meaningful
// signals, without this file claiming to know TikTok's own numbers.
//
// **Recency and personalization are both real, chosen, and bounded,
// never silently assumed.** A video's score decays on a real,
// documented half-life rather than disappearing at some invented
// cutoff. A signed-in viewer's own real prior likes/comments/shares/
// plays on a CREATOR's other videos lift that creator's new videos a
// real, bounded amount -- derived entirely from this store's own real
// records, never a follow graph or any external data, since this app
// has no follow mechanism (TikTok's own "For You" is explicitly NOT
// gated on following, which is what makes it distinct from a
// following feed in the first place).
//
// **One honest, named limitation.** A video with zero real engagement
// scores zero and sorts last, always, regardless of age -- there is
// no cold-start/exploration mechanism here (TikTok's real one shows a
// new video to a small test audience before scoring it against the
// wider pool). That is a real, separate, larger mechanism this file
// does not claim to solve, not a bug.

const { getLikeCount, getCommentCount, getShareCount, getPlayCount } = require('./engagement');

const ENGAGEMENT_WEIGHTS = {
  play: 1,
  like: 3,
  comment: 5,
  share: 8,
};

// A real, chosen half-life -- not cited from anywhere, stated as
// exactly what it is: a deterministic decay curve, 48 hours after
// which a video's own engagement score counts for half as much,
// a quarter after 96 hours, and so on. Never reaches zero, so an old
// video with enormous real engagement can still outrank a brand-new
// one with very little -- the same real behavior a "best of all time"
// signal has in any real feed.
const RECENCY_HALF_LIFE_MS = 48 * 60 * 60 * 1000;

// A real, bounded affinity lift -- never allowed to dominate the raw
// engagement score outright, so a superfan's own history nudges
// ranking rather than guaranteeing every one of a followed-in-
// everything-but-name creator's videos tops the feed regardless of
// how little real engagement they have.
const AFFINITY_BOOST_PER_INTERACTION = 0.05;
const AFFINITY_MAX_MULTIPLIER = 2;

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

function computeEngagementScore(store, videoId) {
  return round(
    getPlayCount(store, videoId) * ENGAGEMENT_WEIGHTS.play
    + getLikeCount(store, videoId) * ENGAGEMENT_WEIGHTS.like
    + getCommentCount(store, videoId) * ENGAGEMENT_WEIGHTS.comment
    + getShareCount(store, videoId) * ENGAGEMENT_WEIGHTS.share,
  );
}

function computeRecencyMultiplier(createdAt, now) {
  const ageMs = Math.max(0, now - createdAt);
  return 2 ** (-ageMs / RECENCY_HALF_LIFE_MS);
}

// Counts the viewer's own real interactions with this creator's OTHER
// videos -- excluding the video being scored itself, so a video is
// never boosted by the viewer's own interaction with that exact video
// (which would make a self-fulfilling loop: liking a video would make
// that same video rank higher for the person who just liked it,
// rather than reflecting real prior affinity for the creator).
function countPriorCreatorInteractions(store, viewerId, creatorId, excludeVideoId) {
  const creatorVideoIds = new Set(
    store.videos.filter((v) => v.creatorId === creatorId && v.id !== excludeVideoId).map((v) => v.id),
  );
  if (creatorVideoIds.size === 0) return 0;

  let count = 0;
  for (const like of store.likes) if (like.userId === viewerId && creatorVideoIds.has(like.videoId)) count += 1;
  for (const comment of store.comments) if (comment.authorId === viewerId && creatorVideoIds.has(comment.videoId)) count += 1;
  for (const share of store.shares) if (share.userId === viewerId && creatorVideoIds.has(share.videoId)) count += 1;
  for (const play of store.plays) if (play.viewerId === viewerId && creatorVideoIds.has(play.videoId)) count += 1;
  return count;
}

function computeAffinityMultiplier(store, viewerId, creatorId, excludeVideoId) {
  if (!viewerId) return 1; // no personalization for an anonymous/unspecified viewer
  const priorInteractions = countPriorCreatorInteractions(store, viewerId, creatorId, excludeVideoId);
  return Math.min(AFFINITY_MAX_MULTIPLIER, 1 + AFFINITY_BOOST_PER_INTERACTION * priorInteractions);
}

function computeForYouScore(store, options = {}) {
  const { videoId, viewerId = null, now = Date.now() } = options;
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) throw new Error(`computeForYouScore: no video with id ${videoId}`);

  const engagementScore = computeEngagementScore(store, videoId);
  const recencyMultiplier = computeRecencyMultiplier(video.createdAt, now);
  const affinityMultiplier = computeAffinityMultiplier(store, viewerId, video.creatorId, videoId);

  return {
    score: round(engagementScore * recencyMultiplier * affinityMultiplier),
    engagementScore,
    recencyMultiplier: round(recencyMultiplier),
    affinityMultiplier: round(affinityMultiplier),
  };
}

// The real feed this file exists to produce -- every video, scored
// and sorted, newest first on a tie so two videos with an identical
// score (most commonly two brand-new ones with zero engagement) don't
// reorder between calls depending on array iteration order alone.
function getForYouFeed(store, options = {}) {
  const { viewerId = null, limit = 20, now = Date.now() } = options;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('getForYouFeed requires a positive integer limit');
  }

  const ranked = store.videos.map((video) => {
    const breakdown = computeForYouScore(store, { videoId: video.id, viewerId, now });
    return { ...video, forYou: breakdown };
  });

  ranked.sort((a, b) => {
    if (b.forYou.score !== a.forYou.score) return b.forYou.score - a.forYou.score;
    return b.createdAt - a.createdAt;
  });

  return ranked.slice(0, limit);
}

module.exports = {
  ENGAGEMENT_WEIGHTS,
  RECENCY_HALF_LIFE_MS,
  AFFINITY_BOOST_PER_INTERACTION,
  AFFINITY_MAX_MULTIPLIER,
  computeEngagementScore,
  computeRecencyMultiplier,
  computeAffinityMultiplier,
  computeForYouScore,
  getForYouFeed,
};
