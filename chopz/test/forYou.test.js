// CHOPZ: For You ranking -- the real recommendation algorithm closing
// this project's own flagged "For You ranking" gap. See
// lib/forYou.js's own header for exactly what it claims to be (a
// real, deterministic heuristic over real engagement, recency, and
// self-reported affinity) and does not (a reconstruction of TikTok's
// own real, proprietary, undisclosed formula, or a completion-rate/
// cold-start mechanism this app has no real data for).

const test = require('node:test');
const assert = require('node:assert');

const { createChopzStore } = require('../lib/store');
const { createChopzVideo: publishVideo } = require('../lib/videos');
const { toggleLike, addComment, recordShare, recordPlay } = require('../lib/engagement');
const {
  computeEngagementScore, computeRecencyMultiplier, computeAffinityMultiplier,
  computeForYouScore, getForYouFeed, ENGAGEMENT_WEIGHTS, RECENCY_HALF_LIFE_MS, AFFINITY_MAX_MULTIPLIER,
} = require('../lib/forYou');

const NOW = Date.UTC(2026, 10, 5);

function seedVideo(store, creatorId = 'ada', now = NOW) {
  return publishVideo(store, { creatorId, mediaUrl: 'https://example.test/v.mp4', now });
}

// -- Engagement score -----------------------------------------------------

test('engagement score is the real weighted sum of plays, likes, comments, and shares -- rarer actions count for more', () => {
  const store = createChopzStore();
  const video = seedVideo(store);

  recordPlay(store, { videoId: video.id, viewerId: 'v1' });
  toggleLike(store, { videoId: video.id, userId: 'v1' });
  addComment(store, { videoId: video.id, authorId: 'v1', text: 'hi' });
  recordShare(store, { videoId: video.id, userId: 'v1' });

  const expected = ENGAGEMENT_WEIGHTS.play + ENGAGEMENT_WEIGHTS.like + ENGAGEMENT_WEIGHTS.comment + ENGAGEMENT_WEIGHTS.share;
  assert.equal(computeEngagementScore(store, video.id), expected);
  // The stated ordinal principle itself, not just the arithmetic:
  // share > comment > like > play.
  assert.ok(ENGAGEMENT_WEIGHTS.share > ENGAGEMENT_WEIGHTS.comment);
  assert.ok(ENGAGEMENT_WEIGHTS.comment > ENGAGEMENT_WEIGHTS.like);
  assert.ok(ENGAGEMENT_WEIGHTS.like > ENGAGEMENT_WEIGHTS.play);
});

test('a video with no engagement at all scores zero, honestly', () => {
  const store = createChopzStore();
  const video = seedVideo(store);
  assert.equal(computeEngagementScore(store, video.id), 0);
});

// -- Recency ---------------------------------------------------------------

test('recency multiplier is exactly 1 at the moment of posting and exactly 0.5 at one real half-life later', () => {
  assert.equal(computeRecencyMultiplier(NOW, NOW), 1);
  assert.equal(computeRecencyMultiplier(NOW, NOW + RECENCY_HALF_LIFE_MS), 0.5);
  assert.equal(computeRecencyMultiplier(NOW, NOW + RECENCY_HALF_LIFE_MS * 2), 0.25);
});

test('recency never reaches zero, however old the video -- a huge real engagement score can still win', () => {
  const tenHalfLives = NOW + RECENCY_HALF_LIFE_MS * 10;
  assert.ok(computeRecencyMultiplier(NOW, tenHalfLives) > 0);
});

// -- Affinity ---------------------------------------------------------------

test('an anonymous (no viewerId) call gets no personalization at all -- multiplier is always exactly 1', () => {
  const store = createChopzStore();
  const video = seedVideo(store, 'ada');
  toggleLike(store, { videoId: video.id, userId: 'fan' });
  assert.equal(computeAffinityMultiplier(store, null, 'ada', video.id), 1);
});

test('a viewer\'s own real prior interactions with a creator\'s OTHER videos lift that creator\'s new video', () => {
  const store = createChopzStore();
  const older = seedVideo(store, 'ada');
  const newer = seedVideo(store, 'ada');
  toggleLike(store, { videoId: older.id, userId: 'fan' });
  addComment(store, { videoId: older.id, authorId: 'fan', text: 'love this' });

  const multiplier = computeAffinityMultiplier(store, 'fan', 'ada', newer.id);
  assert.ok(multiplier > 1, 'two real prior interactions with this creator must lift the multiplier above 1');
});

test('a video is never boosted by the viewer\'s own interaction with that exact same video', () => {
  const store = createChopzStore();
  const video = seedVideo(store, 'ada');
  toggleLike(store, { videoId: video.id, userId: 'fan' });
  // The only interaction on record is on THIS video, excluded by its
  // own id -- so the multiplier must read as if the viewer had no
  // history with this creator at all, not a self-fulfilling loop.
  assert.equal(computeAffinityMultiplier(store, 'fan', 'ada', video.id), 1);
});

test('affinity is bounded -- it never climbs past the real stated cap, however many real prior interactions exist', () => {
  const store = createChopzStore();
  const older = seedVideo(store, 'ada');
  const newer = seedVideo(store, 'ada');
  for (let i = 0; i < 100; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- not async, plain loop
    recordPlay(store, { videoId: older.id, viewerId: 'superfan' });
  }
  const multiplier = computeAffinityMultiplier(store, 'superfan', 'ada', newer.id);
  assert.equal(multiplier, AFFINITY_MAX_MULTIPLIER);
});

// -- The combined score -----------------------------------------------------

test('computeForYouScore multiplies engagement by recency by affinity, and reports the real breakdown', () => {
  const store = createChopzStore();
  const video = seedVideo(store, 'ada', NOW);
  toggleLike(store, { videoId: video.id, userId: 'v1' });

  const breakdown = computeForYouScore(store, { videoId: video.id, viewerId: null, now: NOW });
  assert.equal(breakdown.engagementScore, ENGAGEMENT_WEIGHTS.like);
  assert.equal(breakdown.recencyMultiplier, 1);
  assert.equal(breakdown.affinityMultiplier, 1);
  assert.equal(breakdown.score, ENGAGEMENT_WEIGHTS.like);
});

test('computeForYouScore refuses an unknown video', () => {
  const store = createChopzStore();
  assert.throws(() => computeForYouScore(store, { videoId: 9999 }), /no video/i);
});

// -- The feed ---------------------------------------------------------------

test('getForYouFeed ranks real engagement over raw post order', () => {
  const store = createChopzStore();
  const quiet = seedVideo(store, 'ada', NOW);
  const loud = seedVideo(store, 'rio', NOW);
  recordShare(store, { videoId: loud.id, userId: 'v1' });
  recordShare(store, { videoId: loud.id, userId: 'v2' });

  const feed = getForYouFeed(store, { now: NOW });
  assert.equal(feed[0].id, loud.id, 'the far more engaged video must rank first despite posting order');
  assert.equal(feed[1].id, quiet.id);
});

test('getForYouFeed breaks an exact score tie by newest first, deterministically', () => {
  const store = createChopzStore();
  const first = seedVideo(store, 'ada', NOW);
  const second = seedVideo(store, 'ada', NOW + 1000);
  // Both have zero engagement -- an identical score (0) -- so the
  // ordering must fall back to real creation time, not array order.
  const feed = getForYouFeed(store, { now: NOW + 1000 });
  assert.equal(feed[0].id, second.id);
  assert.equal(feed[1].id, first.id);
});

test('getForYouFeed respects a real limit and refuses a non-positive one', () => {
  const store = createChopzStore();
  seedVideo(store, 'ada', NOW);
  seedVideo(store, 'rio', NOW);
  seedVideo(store, 'kai', NOW);

  assert.equal(getForYouFeed(store, { now: NOW, limit: 2 }).length, 2);
  assert.throws(() => getForYouFeed(store, { now: NOW, limit: 0 }), /positive integer limit/);
  assert.throws(() => getForYouFeed(store, { now: NOW, limit: -1 }), /positive integer limit/);
});

test('getForYouFeed personalizes for a real signed-in viewer and leaves an anonymous call unaffected', () => {
  const store = createChopzStore();
  const favoriteCreatorOld = seedVideo(store, 'ada', NOW);
  const favoriteCreatorNew = seedVideo(store, 'ada', NOW);
  const strangerVideo = seedVideo(store, 'rio', NOW);
  // Identical real engagement on the two contenders -- one share each
  // -- so without personalization they'd tie and break on recency/id.
  recordShare(store, { videoId: favoriteCreatorNew.id, userId: 'x' });
  recordShare(store, { videoId: strangerVideo.id, userId: 'x' });
  // The viewer's own real prior history with ada, via her OTHER video.
  toggleLike(store, { videoId: favoriteCreatorOld.id, userId: 'fan' });
  addComment(store, { videoId: favoriteCreatorOld.id, authorId: 'fan', text: 'yes' });

  const personalized = getForYouFeed(store, { viewerId: 'fan', now: NOW });
  assert.equal(personalized[0].id, favoriteCreatorNew.id, 'real prior affinity for the creator must break the tie');

  const anonymous = getForYouFeed(store, { viewerId: null, now: NOW });
  const anonScores = new Set(anonymous.filter((v) => v.id !== favoriteCreatorOld.id).map((v) => v.forYou.score));
  assert.equal(anonScores.size, 1, 'without a viewerId, the tied videos must score identically');
});
