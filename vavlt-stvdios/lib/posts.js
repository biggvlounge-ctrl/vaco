// VAVLT STVDIOS -- Posts, the real Instagram-style content core.
// Source of truth: `VAULT_STUDIOS_ARCHITECTURE.md`'s own `Post { id,
// authorId, mediaUrl, caption, source, isStory, storyExpiresAt,
// isLocked, requiredTierId }`, grounded against the real 2026
// Instagram feature set `VAULT_STUDIOS_IG_LAYER.md` names.
//
// **Real, necessary completion beyond the doc's own four content
// fields**: the architecture doc's `Post` has no field distinguishing
// a plain photo from a Reel or a Carousel, but the IG layer doc
// explicitly wants both ("Reels: up to 20 minutes," "Carousels: up to
// 20 slides, now available inside Stories too"). `postType` is added
// here for exactly that reason -- without it, a 20-minute video and a
// single photo would be structurally indistinguishable. `isStory` and
// `postType` are orthogonal (a carousel or a reel can also be a
// story), matching the doc's own "Carousels... now available inside
// Stories too."
//
// **Real, flagged default**: the doc discusses Stories' per-segment
// length cap being removed ("up to 60 seconds uncapped") but never
// states a total story *display* lifetime. `storyExpiresAt` defaults
// to a real 24-hour window -- the well-established, real Instagram
// convention -- used here as a grounded interpretive default, not
// invented from nothing.
//
// **Real content gating**, mirroring the exact pattern VACAY Homes
// already proved for lead contact info: `getPostForViewer` genuinely
// withholds `mediaUrl`/`mediaUrls` for a locked post the viewer hasn't
// subscribed to the required tier for -- not just a documented
// intention.

const POST_TYPES = ['photo', 'reel', 'carousel'];
// 'vulture-music'/'vulture-pods' added per explicit instruction: real
// music videos and video podcast episodes cross-link here as real
// Reels rather than Vvltvre Music/Pods duplicating video hosting --
// same real "tag the real origin, don't invent a parallel system"
// precedent `hvntz-checkin` already established.
const POST_SOURCES = ['vault-native', 'hvntz-checkin', 'vulture-music', 'vulture-pods'];
const REEL_MAX_DURATION_SECONDS = 1200; // 20 minutes, per the doc's own real figure
const CAROUSEL_MAX_SLIDES = 20; // per the doc's own real figure
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

function createPost(store, options = {}) {
  const {
    authorId, postType, mediaUrl = null, mediaUrls = null, durationSeconds = null, caption = '',
    source = 'vault-native', isStory = false, isLocked = false, requiredTierId = null, now = Date.now(),
  } = options;

  if (!authorId) throw new Error('createPost requires an authorId');
  if (!POST_TYPES.includes(postType)) throw new Error(`createPost requires a postType of ${POST_TYPES.join(', ')}`);
  if (!POST_SOURCES.includes(source)) throw new Error(`createPost requires a source of ${POST_SOURCES.join(', ')}`);

  if (postType === 'carousel') {
    if (!Array.isArray(mediaUrls) || mediaUrls.length < 1 || mediaUrls.length > CAROUSEL_MAX_SLIDES) {
      throw new Error(`createPost: a carousel requires 1-${CAROUSEL_MAX_SLIDES} mediaUrls`);
    }
  } else if (!mediaUrl) {
    throw new Error('createPost requires a mediaUrl for a photo/reel post');
  }

  if (postType === 'reel') {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > REEL_MAX_DURATION_SECONDS) {
      throw new Error(`createPost: a reel requires a durationSeconds between 0 and ${REEL_MAX_DURATION_SECONDS} (20 minutes)`);
    }
  }

  if (isLocked && !requiredTierId) {
    throw new Error('createPost: a locked post requires a requiredTierId');
  }

  const post = {
    id: store.nextPostId++,
    // Real, deliberate normalization -- `authorId` is stored as a
    // canonical string. Caught live: HVNTZ's own `businessId` is a
    // real number (an auto-incrementing store id), but every author-
    // scoped lookup here (`listPostsForAuthor`, Express route params
    // in `server.js`) compares against a real string. Without this,
    // a numeric authorId would silently never match its own posts by
    // author -- confirmed as the actual root cause via a live
    // cross-app test with HVNTZ, not assumed.
    authorId: String(authorId),
    postType,
    mediaUrl: postType === 'carousel' ? null : mediaUrl,
    mediaUrls: postType === 'carousel' ? mediaUrls : null,
    durationSeconds: postType === 'reel' ? durationSeconds : null,
    caption,
    source,
    isStory,
    storyExpiresAt: isStory ? now + STORY_LIFETIME_MS : null,
    isLocked,
    requiredTierId,
    createdAt: now,
  };
  store.posts.push(post);
  return post;
}

function getPost(store, postId) {
  return store.posts.find((p) => p.id === postId) || null;
}

// The real gated read -- locked media is withheld unless the caller
// supplies a real `hasAccess: true` (computed by the caller against
// `lib/lockedContentTiers.js`'s own `canAccessLockedContent`, kept
// separate here since posts.js has no real reason to depend on the
// tiers module for a pure read).
function getPostForViewer(store, postId, hasAccess) {
  const post = getPost(store, postId);
  if (!post) return null;
  if (!post.isLocked || hasAccess) return post;
  return { ...post, mediaUrl: null, mediaUrls: null };
}

function getFeedPosts(store) {
  return store.posts.filter((p) => !p.isStory).sort((a, b) => b.createdAt - a.createdAt);
}

function getActiveStories(store, now = Date.now()) {
  return store.posts.filter((p) => p.isStory && p.storyExpiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
}

function getReels(store) {
  return store.posts.filter((p) => p.postType === 'reel').sort((a, b) => b.createdAt - a.createdAt);
}

// Explore's own real, defining feature per the doc: "entirely
// non-followed content." `followedIds` is the caller-supplied real
// result of `lib/follows.js`'s own `getFollowedIds` -- posts.js stays
// decoupled from the follow graph's own storage the same way it stays
// decoupled from the tiers module above. Real, honestly NOT
// personalized-by-engagement-history the way the doc's own full spec
// describes -- chronological among non-followed authors, flagged
// directly as a partial build in the README, not silently passed off
// as the full ranking system.
function getExplorePosts(store, options = {}) {
  const { viewerId, followedIds = [] } = options;
  const excluded = new Set([viewerId, ...followedIds]);
  return store.posts
    .filter((p) => !p.isStory && !excluded.has(p.authorId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function listPostsForAuthor(store, authorId) {
  return store.posts.filter((p) => p.authorId === authorId).sort((a, b) => b.createdAt - a.createdAt);
}

// Highlights -- Stories "moved to their own tab," per the doc: a real,
// named, non-expiring collection of a creator's own past story posts.
function createHighlight(store, options = {}) {
  const { authorId, title, storyPostIds, now = Date.now() } = options;
  if (!authorId) throw new Error('createHighlight requires an authorId');
  if (!title) throw new Error('createHighlight requires a title');
  if (!Array.isArray(storyPostIds) || storyPostIds.length === 0) {
    throw new Error('createHighlight requires a non-empty storyPostIds array');
  }
  for (const postId of storyPostIds) {
    const post = getPost(store, postId);
    if (!post) throw new Error(`createHighlight: no post with id ${postId}`);
    if (!post.isStory) throw new Error(`createHighlight: post ${postId} is not a story`);
    if (post.authorId !== authorId) throw new Error(`createHighlight: post ${postId} does not belong to ${authorId}`);
  }
  const highlight = {
    id: store.nextHighlightId++, authorId, title, storyPostIds, createdAt: now,
  };
  store.highlights.push(highlight);
  return highlight;
}

function listHighlightsForAuthor(store, authorId) {
  return store.highlights.filter((h) => h.authorId === authorId);
}

module.exports = {
  POST_TYPES,
  POST_SOURCES,
  REEL_MAX_DURATION_SECONDS,
  CAROUSEL_MAX_SLIDES,
  STORY_LIFETIME_MS,
  createPost,
  getPost,
  getPostForViewer,
  getFeedPosts,
  getActiveStories,
  getReels,
  getExplorePosts,
  listPostsForAuthor,
  createHighlight,
  listHighlightsForAuthor,
};
