// CHOPZ: likes, comments, shares -- the real engagement primitives,
// closing the smallest real slice of this project's own flagged
// "everything else TikTok's own feed has beyond a bare video record"
// gap. See lib/engagement.js's own header for the scoping decision.

const test = require('node:test');
const assert = require('node:assert');

const { createChopzStore } = require('../lib/store');
const { createChopzVideo: publishVideo } = require('../lib/videos');
const {
  toggleLike, hasLiked, getLikeCount,
  addComment, listComments, getCommentCount,
  recordShare, getShareCount,
  recordPlay, getPlayCount,
  getEngagementSummary,
} = require('../lib/engagement');

function seedVideo(store) {
  return publishVideo(store, { creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4' });
}

// -- Likes: a real toggle, not a counter --------------------------------

test('liking a video records it, and liking again un-likes it', () => {
  const store = createChopzStore();
  const video = seedVideo(store);

  const first = toggleLike(store, { videoId: video.id, userId: 'reader-1' });
  assert.equal(first.liked, true);
  assert.equal(first.likeCount, 1);
  assert.equal(hasLiked(store, video.id, 'reader-1'), true);

  const second = toggleLike(store, { videoId: video.id, userId: 'reader-1' });
  assert.equal(second.liked, false);
  assert.equal(second.likeCount, 0);
  assert.equal(hasLiked(store, video.id, 'reader-1'), false);
});

test('a like is scoped to one (video, user) pair -- it does not leak to another user or another video', () => {
  const store = createChopzStore();
  const videoA = seedVideo(store);
  const videoB = seedVideo(store);

  toggleLike(store, { videoId: videoA.id, userId: 'reader-1' });
  toggleLike(store, { videoId: videoA.id, userId: 'reader-2' });

  assert.equal(getLikeCount(store, videoA.id), 2);
  assert.equal(getLikeCount(store, videoB.id), 0);
  assert.equal(hasLiked(store, videoB.id, 'reader-1'), false);
});

test('liking a video with no userId, or a video that does not exist, is refused', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.throws(() => toggleLike(store, { videoId: video.id }), /userId/);
  assert.throws(() => toggleLike(store, { videoId: 9999, userId: 'reader-1' }), /no video/i);
});

// -- Comments -------------------------------------------------------------

test('a comment is recorded and retrievable, newest first', () => {
  const store = createChopzStore();
  const video = seedVideo(store);

  addComment(store, { videoId: video.id, authorId: 'reader-1', text: 'first', now: 1000 });
  addComment(store, { videoId: video.id, authorId: 'reader-2', text: 'second', now: 2000 });

  const comments = listComments(store, video.id);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].text, 'second', 'the newest comment must read first');
  assert.equal(comments[1].text, 'first');
  assert.equal(getCommentCount(store, video.id), 2);
});

test('comments are scoped to their own video', () => {
  const store = createChopzStore();
  const videoA = seedVideo(store);
  const videoB = seedVideo(store);
  addComment(store, { videoId: videoA.id, authorId: 'reader-1', text: 'on A' });
  assert.equal(listComments(store, videoB.id).length, 0);
});

test('a comment with no authorId, no text, or an unknown video is refused', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.throws(() => addComment(store, { videoId: video.id, text: 'x' }), /authorId/);
  assert.throws(() => addComment(store, { videoId: video.id, authorId: 'reader-1' }), /text/);
  assert.throws(() => addComment(store, { videoId: 9999, authorId: 'reader-1', text: 'x' }), /no video/i);
  assert.equal(listComments(store, video.id).length, 0, 'a refused comment was still stored');
});

// -- Shares: fire-and-forget, not deduplicated like a like ----------------

test('a share is recorded, and the same user sharing twice counts twice -- unlike a like', () => {
  const store = createChopzStore();
  const video = seedVideo(store);

  const first = recordShare(store, { videoId: video.id, userId: 'reader-1' });
  assert.equal(first.shareCount, 1);
  const second = recordShare(store, { videoId: video.id, userId: 'reader-1' });
  assert.equal(second.shareCount, 2, 'a share is not a toggle -- sharing again is a second real share');
  assert.equal(getShareCount(store, video.id), 2);
});

test('sharing with no userId, or a video that does not exist, is refused', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.throws(() => recordShare(store, { videoId: video.id }), /userId/);
  assert.throws(() => recordShare(store, { videoId: 9999, userId: 'reader-1' }), /no video/i);
});

// -- The combined summary a feed card actually reads -----------------------

test('getEngagementSummary reports real, independent counts for likes, comments, shares, and plays', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  toggleLike(store, { videoId: video.id, userId: 'reader-1' });
  toggleLike(store, { videoId: video.id, userId: 'reader-2' });
  addComment(store, { videoId: video.id, authorId: 'reader-1', text: 'nice' });
  recordShare(store, { videoId: video.id, userId: 'reader-1' });
  recordPlay(store, { videoId: video.id, viewerId: 'reader-1' });

  assert.deepStrictEqual(getEngagementSummary(store, video.id), {
    likeCount: 2, commentCount: 1, shareCount: 1, playCount: 1,
  });
});

test('a fresh video has an honest, zeroed-out engagement summary, not an absent one', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.deepStrictEqual(getEngagementSummary(store, video.id), {
    likeCount: 0, commentCount: 0, shareCount: 0, playCount: 0,
  });
});

// -- Plays: fire-and-forget, same shape as a share ------------------------

test('a play is recorded, and the same viewer playing twice counts twice -- a real rewatch', () => {
  const store = createChopzStore();
  const video = seedVideo(store);

  const first = recordPlay(store, { videoId: video.id, viewerId: 'reader-1' });
  assert.equal(first.playCount, 1);
  const second = recordPlay(store, { videoId: video.id, viewerId: 'reader-1' });
  assert.equal(second.playCount, 2, 'a play is not a toggle -- a rewatch is a second real play');
  assert.equal(getPlayCount(store, video.id), 2);
});

test('playing with no viewerId, or a video that does not exist, is refused', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.throws(() => recordPlay(store, { videoId: video.id }), /viewerId/);
  assert.throws(() => recordPlay(store, { videoId: 9999, viewerId: 'reader-1' }), /no video/i);
});
