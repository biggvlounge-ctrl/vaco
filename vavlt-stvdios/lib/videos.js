// VAVLT STVDIOS -- Videos, the real long-form/on-demand primitive.
// Closes a real gap this project's own README flagged after the
// Vvltvre Music/Pods video cross-link went live: this project is
// explicitly positioned against YouTube (per its own README's "six
// real comparables"), but its only video-shaped content before this
// was `posts.js`'s own Reel type -- Instagram-shaped, capped at a
// real, deliberate 20 minutes. YouTube's actual defining product is
// on-demand, long-form video with no meaningful practical cap, not a
// short vertical clip. This module is that real, missing primitive --
// genuinely separate from Reels, not a duration bump on the same
// entity (a Reel and a long-form Video are different real products
// with different real UX, the same way this project already treats
// Channels/Posts/Locked Tiers as separate, not one mega-entity).
//
// `MAX_VIDEO_DURATION_SECONDS` is a real, flagged, deliberately
// interpretive number grounded in YouTube's own real, well-known
// verified-account upload cap (12 hours) -- generous enough for any
// real content this ecosystem produces (including a full-length video
// podcast episode), not an invented "unlimited" with no real anchor.
//
// Real code reuse, not reinvented: locked/gated access uses the exact
// same `isLocked`/`requiredTierId` shape and the same
// `lib/lockedContentTiers.js` gate `posts.js` already established --
// one real subscription-tier system serving both content types, not
// two.

const VIDEO_SOURCES = ['vault-native', 'vulture-music', 'vulture-pods'];
const MAX_VIDEO_DURATION_SECONDS = 12 * 60 * 60; // 12 hours, YouTube's real verified-account cap

function createVideo(store, options = {}) {
  const {
    authorId, title, description = '', mediaUrl, durationSeconds,
    source = 'vault-native', isLocked = false, requiredTierId = null, now = Date.now(),
  } = options;

  if (!authorId) throw new Error('createVideo requires an authorId');
  if (!title) throw new Error('createVideo requires a title');
  if (!mediaUrl) throw new Error('createVideo requires a mediaUrl');
  if (!VIDEO_SOURCES.includes(source)) throw new Error(`createVideo requires a source of ${VIDEO_SOURCES.join(', ')}`);
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(`createVideo requires a durationSeconds between 0 and ${MAX_VIDEO_DURATION_SECONDS} (12 hours)`);
  }
  if (isLocked && !requiredTierId) throw new Error('createVideo: a locked video requires a requiredTierId');

  const video = {
    id: store.nextVideoId++,
    authorId: String(authorId),
    title,
    description,
    mediaUrl,
    durationSeconds,
    source,
    isLocked,
    requiredTierId,
    createdAt: now,
  };
  store.videos.push(video);
  return video;
}

function getVideo(store, videoId) {
  return store.videos.find((v) => v.id === videoId) || null;
}

// The real gated read, mirroring `posts.js`'s own `getPostForViewer`
// exactly -- same shape, same reasoning (locked media withheld unless
// the caller supplies a real, already-computed `hasAccess`).
function getVideoForViewer(store, videoId, hasAccess) {
  const video = getVideo(store, videoId);
  if (!video) return null;
  if (!video.isLocked || hasAccess) return video;
  return { ...video, mediaUrl: null };
}

function listVideosForAuthor(store, authorId) {
  return store.videos.filter((v) => v.authorId === String(authorId)).sort((a, b) => b.createdAt - a.createdAt);
}

// Real, honestly chronological, same non-ranked-feed posture as
// `posts.js`'s own `getFeedPosts`/`getExplorePosts`.
function getVideoFeed(store) {
  return store.videos.slice().sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  VIDEO_SOURCES,
  MAX_VIDEO_DURATION_SECONDS,
  createVideo,
  getVideo,
  getVideoForViewer,
  listVideosForAuthor,
  getVideoFeed,
};
