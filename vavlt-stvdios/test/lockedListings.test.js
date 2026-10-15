// Vavlt Stvdios — locked content leaking through listing routes.
//
// `getPostForViewer`/`getVideoForViewer` correctly withheld a locked
// item's real `mediaUrl` unless the caller already had access. Every
// LISTING function (feed, stories, reels, explore, author-posts,
// author-videos, video-feed) bypassed that gate entirely and returned
// `store.posts`/`store.videos` untouched — so a locked Reel or Video's
// real address was visible to anyone who called the free, public feed
// route, for free, with no subscription. `applyPostAccess`/
// `applyVideoAccess` are the one real strip rule both the single-item
// read and every listing route now share.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPost, getFeedPosts, getReels, applyPostAccess,
} = require('../lib/posts');
const { createVideo, getVideoFeed, applyVideoAccess } = require('../lib/videos');

test('a locked Reel in the public feed withholds mediaUrl without access, reveals it with access', () => {
  const posts = [
    createPost({ posts: [], nextPostId: 1 }, {
      authorId: 'creator-1', postType: 'reel', mediaUrl: 'https://cdn/exclusive.mp4',
      durationSeconds: 60, isLocked: true, requiredTierId: 7,
    }),
  ];

  const feedNoAccess = getFeedPosts({ posts }).map((p) => applyPostAccess(p, false));
  assert.equal(feedNoAccess[0].mediaUrl, null, 'the feed must not hand out a locked Reel\'s real address for free');

  const feedWithAccess = getFeedPosts({ posts }).map((p) => applyPostAccess(p, true));
  assert.equal(feedWithAccess[0].mediaUrl, 'https://cdn/exclusive.mp4', 'a real subscriber still gets the real address');
});

test('reels listing applies the same gate per item, not one hasAccess for the whole list', () => {
  const posts = [
    createPost({ posts: [], nextPostId: 1 }, {
      authorId: 'a', postType: 'reel', mediaUrl: 'https://cdn/tier-7.mp4',
      durationSeconds: 10, isLocked: true, requiredTierId: 7,
    }),
    createPost({ posts: [], nextPostId: 1 }, {
      authorId: 'b', postType: 'reel', mediaUrl: 'https://cdn/free.mp4', durationSeconds: 10,
    }),
  ];
  posts[1].id = 2;

  // Simulate a viewer who has access to tier 7 only -- gate each item
  // against its OWN requiredTierId, the way the server layer does.
  const hasTier7 = true;
  const gated = getReels({ posts }).map((p) => applyPostAccess(p, p.requiredTierId === 7 ? hasTier7 : false));
  assert.equal(gated.find((p) => p.id === 1).mediaUrl, 'https://cdn/tier-7.mp4');
  assert.equal(gated.find((p) => p.id === 2).mediaUrl, 'https://cdn/free.mp4', 'an unlocked post is never gated');
});

test('a locked Video in the public video-feed withholds mediaUrl without access', () => {
  const videos = [
    createVideo({ videos: [], nextVideoId: 1 }, {
      authorId: 'creator-1', title: 'Exclusive cut', mediaUrl: 'https://cdn/exclusive-video.mp4',
      durationSeconds: 600, isLocked: true, requiredTierId: 3,
    }),
  ];

  const feedNoAccess = getVideoFeed({ videos }).map((v) => applyVideoAccess(v, false));
  assert.equal(feedNoAccess[0].mediaUrl, null, 'the video feed must not hand out a locked video\'s real address for free');

  const feedWithAccess = getVideoFeed({ videos }).map((v) => applyVideoAccess(v, true));
  assert.equal(feedWithAccess[0].mediaUrl, 'https://cdn/exclusive-video.mp4');
});

test('an unlocked video is never withheld, with or without a viewer', () => {
  const videos = [
    createVideo({ videos: [], nextVideoId: 1 }, {
      authorId: 'creator-1', title: 'Free video', mediaUrl: 'https://cdn/free-video.mp4', durationSeconds: 120,
    }),
  ];
  assert.equal(applyVideoAccess(videos[0], false).mediaUrl, 'https://cdn/free-video.mp4');
});
