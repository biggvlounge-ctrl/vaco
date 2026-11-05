// CHOPZ -- Engagement: likes, comments, shares, plays.
// Source of truth: this project's own README "Not yet built" list,
// which named "likes/comments/shares/duets/For You ranking" as
// everything else TikTok's own feed has beyond a bare video record.
// This closed the smallest real slice of that first (likes/comments/
// shares), deliberately leaving duets (a real video-composition
// feature) and For You ranking (a real recommendation algorithm) as
// their own, separately large builds -- the same "smallest real slice
// first" scoping `videos.js`'s own header already used for this app.
// `recordPlay`/`getPlayCount` joined the original three (5 Nov 2026)
// specifically to give `lib/forYou.js`'s real ranking a real "plays"
// signal to read -- TikTok's own public engagement list, not this
// file's invention.
//
// A like is a real toggle, not a counter a caller can push past 1 for
// the same user -- one real (videoId, userId) pair, present or not.
// A comment is permanent (no edit/delete modeled, same posture most
// of this ecosystem's other comment-shaped features take at this
// phase). A share and a play are both fire-and-forget events: TikTok's
// own share sheet does not ask "are you sure," and rewatching a clip
// is a second real play -- neither has real state a repeat from the
// same person would conflict with, so neither is deduplicated the way
// a like is.

function requireVideo(store, videoId, action) {
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) throw new Error(`${action}: no video with id ${videoId}`);
  return video;
}

function toggleLike(store, options = {}) {
  const { videoId, userId } = options;
  if (!userId) throw new Error('toggleLike requires a userId');
  requireVideo(store, videoId, 'toggleLike');

  const existingIndex = store.likes.findIndex((l) => l.videoId === videoId && l.userId === userId);
  if (existingIndex >= 0) {
    store.likes.splice(existingIndex, 1);
    return { liked: false, likeCount: getLikeCount(store, videoId) };
  }
  store.likes.push({ videoId, userId, createdAt: options.now ?? Date.now() });
  return { liked: true, likeCount: getLikeCount(store, videoId) };
}

function hasLiked(store, videoId, userId) {
  return store.likes.some((l) => l.videoId === videoId && l.userId === userId);
}

function getLikeCount(store, videoId) {
  return store.likes.filter((l) => l.videoId === videoId).length;
}

function addComment(store, options = {}) {
  const { videoId, authorId, text, now = Date.now() } = options;
  if (!authorId) throw new Error('addComment requires an authorId');
  if (!text) throw new Error('addComment requires text');
  requireVideo(store, videoId, 'addComment');

  const comment = {
    id: store.nextCommentId++,
    videoId,
    authorId,
    text,
    createdAt: now,
  };
  store.comments.push(comment);
  return comment;
}

// Newest first -- the same read order this ecosystem's other
// comment-shaped feeds (e.g. vxllage's own community threads) already
// use for a list meant to be read as "what's been said lately."
function listComments(store, videoId) {
  return store.comments
    .filter((c) => c.videoId === videoId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getCommentCount(store, videoId) {
  return store.comments.filter((c) => c.videoId === videoId).length;
}

function recordShare(store, options = {}) {
  const { videoId, userId } = options;
  if (!userId) throw new Error('recordShare requires a userId');
  requireVideo(store, videoId, 'recordShare');

  store.shares.push({ videoId, userId, createdAt: options.now ?? Date.now() });
  return { shareCount: getShareCount(store, videoId) };
}

function getShareCount(store, videoId) {
  return store.shares.filter((s) => s.videoId === videoId).length;
}

// A play, same fire-and-forget shape as a share -- rewatching a clip
// is a second real play, not a toggle. Recorded by the caller (see
// server.js's own `/play` route) only once a viewer was actually
// handed a real, ready playback credential, never on a bare click
// against media that isn't there yet.
function recordPlay(store, options = {}) {
  const { videoId, viewerId } = options;
  if (!viewerId) throw new Error('recordPlay requires a viewerId');
  requireVideo(store, videoId, 'recordPlay');

  store.plays.push({ videoId, viewerId, createdAt: options.now ?? Date.now() });
  return { playCount: getPlayCount(store, videoId) };
}

function getPlayCount(store, videoId) {
  return store.plays.filter((p) => p.videoId === videoId).length;
}

// The real feed-card shape a browse view actually needs -- one call
// rather than four round trips per video. `playCount` joined the other
// three (5 Nov 2026) once a real play event existed to count.
function getEngagementSummary(store, videoId) {
  return {
    likeCount: getLikeCount(store, videoId),
    commentCount: getCommentCount(store, videoId),
    shareCount: getShareCount(store, videoId),
    playCount: getPlayCount(store, videoId),
  };
}

module.exports = {
  toggleLike,
  hasLiked,
  getLikeCount,
  addComment,
  listComments,
  getCommentCount,
  recordShare,
  getShareCount,
  recordPlay,
  getPlayCount,
  getEngagementSummary,
};
