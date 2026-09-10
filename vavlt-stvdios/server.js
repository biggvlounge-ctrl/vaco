// VAVLT STVDIOS (Vavlt Stvdios) -- the ecosystem's creator streaming
// platform. Phase 1 built the real multi-channel architecture at its
// structural core -- Channel, ChannelChat, ChannelGroup, ChannelTip.
// Phase 2 adds the real Instagram-style content layer -- Posts (photo/
// reel/carousel/story/locked), Follows, Notes, Highlights, Locked
// Content Tiers (real 80/20 split), Map Search, Profile Cards. No
// video/photo capture infrastructure, no VENVS/VAGO casino broadcast
// layer yet -- see README.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8808/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVavltStvdiosStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const {
  GROUPING_TYPES, createChannelGroup, getChannelGroup, createChannel, getChannel,
  listChannelsInGroup, listLiveChannels, goLive, endStream,
} = require('./lib/channels');
const { getChannelChat, postMessage, getMessages } = require('./lib/channelChat');
const { tipChannel, getTipsForChannel, getTotalTipsForPerson } = require('./lib/channelTips');
const {
  POST_TYPES, POST_SOURCES, createPost, getPost, getPostForViewer, getFeedPosts, getActiveStories,
  getReels, getExplorePosts, listPostsForAuthor, createHighlight, listHighlightsForAuthor,
} = require('./lib/posts');
const { followUser, unfollowUser, isFollowing, getFollowedIds } = require('./lib/follows');
const { addNote, getActiveNotesForPost } = require('./lib/notes');
const {
  createTier, getTier, listTiersForCreator, canAccessLockedContent, subscribeTier,
} = require('./lib/lockedContentTiers');
const { createListing, getListing, searchNearby } = require('./lib/mapSearch');
const { createOrUpdateProfileCard, getProfileCard } = require('./lib/profileCards');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const {
  MAX_SCREENS, createScreenSession, getScreenSession, addScreenToSession, removeScreenFromSession,
  listScreenSessionsForOwner, getScreenSessionWithChannels,
} = require('./lib/screenSessions');
const {
  VIDEO_SOURCES, MAX_VIDEO_DURATION_SECONDS, createVideo, getVideo, getVideoForViewer, listVideosForAuthor, getVideoFeed,
} = require('./lib/videos');
const {
  REFERRAL_TIERS, SPIN_PRIZES, getReferralProgress, recordReferral, spinWheel,
} = require('./lib/referralGrowth');
const {
  EVENT_TYPES, EVENT_STATUSES, createCasinoEvent, getCasinoEvent, listCasinoEvents, getCasinoEventWithDetail,
  goLiveCasinoEvent, endCasinoEvent, joinCasinoEvent, leaveCasinoEvent, listAttendees,
} = require('./lib/casinoEvents');
const { seedDemoData } = require('./lib/seedDemoData');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'vavlt-stvdios' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8808;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vavlt-stvdios';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVavltStvdiosStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Atomic settlement: every leg moves, or none does.
//
// **Every multi-party payment in this app used to be consecutive
// transfers.** The second leg can fail on its own -- often precisely
// because the first just drew down the account it pays from -- and the
// record that would mark the work done is written afterwards. So a
// partial failure left one party paid, another not, and a retry that
// paid the first one again.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass. `settleVCoin` is
// removed rather than kept beside it: a working single-transfer helper
// is what the next money path gets written with, and consecutive calls
// to it are the defect.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names what is being
      // settled, so it doubles as the idempotency key: a retried
      // settlement replays V3's first answer rather than paying
      // twice. Atomicity stops a *partial* settlement; this stops
      // a *duplicate* one.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// == Authorization ======================================================
//
// **One principal, mostly: the creator who owns the record.** A
// channel, a post, a video, a highlight, a tier, a screen session and a
// casino event each have exactly one owner, and 25 of 26 mutating
// routes let anyone act on any of them — go live on somebody's channel,
// end their stream, post as them, price their subscription tier.
//
// The one to look at twice is **tipping**. `tipChannel` moves VCoin
// from a tipper to a `recipientPersonId` the *request body* names,
// rather than to the channel's owner. That is deliberate in the lib —
// a channel can be a venue with several performers, and the tip is
// aimed at one of them — but it means the tipper must be the session,
// or anyone can spend anyone's balance.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

function requireRecordOwner(label, lookup, ownerOf, param = 'id') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params[param]}` });
    if (ownerOf(record) !== req.sessionUserId) {
      return res.status(403).json({ error: `only the owner of this ${label} may act on it` });
    }
    return next();
  });
}

const requireChannelOwner = () => requireRecordOwner(
  'channel', (req) => getChannel(store, Number(req.params.id)), (c) => c.ownerId,
);
const requirePostAuthor = () => requireRecordOwner(
  'post', (req) => getPost(store, Number(req.params.id)), (p) => p.authorId,
);
const requireScreenSessionOwner = () => requireRecordOwner(
  'screen session', (req) => getScreenSession(store, Number(req.params.id)), (sess) => sess.ownerId,
);
const requireCasinoEventHost = () => requireRecordOwner(
  'casino event', (req) => getCasinoEvent(store, Number(req.params.id)), (e) => e.hostId,
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vavlt-stvdios', groupingTypes: GROUPING_TYPES, postTypes: POST_TYPES, postSources: POST_SOURCES, maxScreens: MAX_SCREENS,
    videoSources: VIDEO_SOURCES, maxVideoDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
    referralTiers: REFERRAL_TIERS, spinPrizes: SPIN_PRIZES,
    casinoEventTypes: EVENT_TYPES, casinoEventStatuses: EVENT_STATUSES,
  });
});

app.post('/api/channel-groups', requireSession(), (req, res) => {
  try {
    res.status(201).json(createChannelGroup(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listing groups. A group could be fetched by id and its channels
// listed, but there was no way to discover which groups exist — so the
// eight-screen wall, which is this app's signature mechanic, had no
// entry point that did not require already knowing an id.
app.get('/api/channel-groups', (_req, res) => {
  res.json({ groups: store.channelGroups });
});

app.get('/api/channel-groups/:id', (req, res) => {
  const group = getChannelGroup(store, Number(req.params.id));
  if (!group) return res.status(404).json({ error: `no channel group with id ${req.params.id}` });
  res.json(group);
});

app.get('/api/channel-groups/:id/channels', (req, res) => {
  try {
    res.json({ channels: listChannelsInGroup(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/channels', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(createChannel(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/live', (_req, res) => {
  res.json({ channels: listLiveChannels(store) });
});

app.get('/api/channels/:id', (req, res) => {
  const channel = getChannel(store, Number(req.params.id));
  if (!channel) return res.status(404).json({ error: `no channel with id ${req.params.id}` });
  res.json(channel);
});

app.post('/api/channels/:id/live', requireChannelOwner(), (req, res) => {
  try {
    res.json(goLive(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/channels/:id/end', requireChannelOwner(), (req, res) => {
  try {
    res.json(endStream(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/channels/:id/chat', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(postMessage(store, { ...req.body, channelId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/chat', (req, res) => {
  try {
    res.json({ messages: getMessages(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The tipper is the actor, not the recipient: `tipChannel` debits
// `tipperId` and credits a `recipientPersonId` the body names
// separately, so guarding the wrong one would let anyone spend anyone's
// balance on a performer of their choosing.
app.post('/api/channels/:id/tips', requireActor('tipperId'), async (req, res) => {
  try {
    res.status(201).json(await tipChannel(store, { ...req.body, channelId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/tips', (req, res) => {
  res.json({ tips: getTipsForChannel(store, Number(req.params.id)) });
});

app.get('/api/people/:personId/tips', (req, res) => {
  res.json({ personId: req.params.personId, totalTipsVCoin: getTotalTipsForPerson(store, req.params.personId) });
});

// -- Posts / Feed / Stories / Reels / Explore --

app.post('/api/posts', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(createPost(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/posts/:id', (req, res) => {
  const viewerId = req.query.viewerId || null;
  const post = getPost(store, Number(req.params.id));
  if (!post) return res.status(404).json({ error: `no post with id ${req.params.id}` });
  const hasAccess = post.isLocked && viewerId ? canAccessLockedContent(store, post.requiredTierId, viewerId) : !post.isLocked;
  res.json(getPostForViewer(store, post.id, hasAccess));
});

app.get('/api/feed', (_req, res) => {
  res.json({ posts: getFeedPosts(store) });
});

app.get('/api/stories', (_req, res) => {
  res.json({ stories: getActiveStories(store) });
});

app.get('/api/reels', (_req, res) => {
  res.json({ reels: getReels(store) });
});

app.get('/api/explore', (req, res) => {
  const viewerId = req.query.viewerId;
  if (!viewerId) return res.status(400).json({ error: 'explore requires a viewerId query param' });
  res.json({ posts: getExplorePosts(store, { viewerId, followedIds: getFollowedIds(store, viewerId) }) });
});

app.get('/api/authors/:authorId/posts', (req, res) => {
  res.json({ posts: listPostsForAuthor(store, req.params.authorId) });
});

app.post('/api/videos', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(createVideo(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/videos/:id', (req, res) => {
  const viewerId = req.query.viewerId || null;
  const video = getVideo(store, Number(req.params.id));
  if (!video) return res.status(404).json({ error: `no video with id ${req.params.id}` });
  const hasAccess = video.isLocked && viewerId ? canAccessLockedContent(store, video.requiredTierId, viewerId) : !video.isLocked;
  res.json(getVideoForViewer(store, video.id, hasAccess));
});

app.get('/api/authors/:authorId/videos', (req, res) => {
  res.json({ videos: listVideosForAuthor(store, req.params.authorId) });
});

app.get('/api/video-feed', (_req, res) => {
  res.json({ videos: getVideoFeed(store) });
});

app.post('/api/highlights', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(createHighlight(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/authors/:authorId/highlights', (req, res) => {
  res.json({ highlights: listHighlightsForAuthor(store, req.params.authorId) });
});

// -- Follows --

app.post('/api/follows', requireActor('followerId'), (req, res) => {
  try {
    res.status(201).json(followUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/follows/remove', requireActor('followerId'), (req, res) => {
  try {
    res.json(unfollowUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/follows/status', (req, res) => {
  const { followerId, followedId } = req.query;
  res.json({ isFollowing: isFollowing(store, followerId, followedId) });
});

// -- Notes --

app.post('/api/posts/:id/notes', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(addNote(store, { ...req.body, postId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/posts/:id/notes', (req, res) => {
  res.json({ notes: getActiveNotesForPost(store, Number(req.params.id)) });
});

// -- Locked Content Tiers --

// A creator prices their own subscription tier. Open, this let anyone
// create a tier under someone else's name and collect the
// subscriptions — the money lands wherever `creatorId` says.
app.post('/api/tiers', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createTier(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tiers/:id', (req, res) => {
  const tier = getTier(store, Number(req.params.id));
  if (!tier) return res.status(404).json({ error: `no tier with id ${req.params.id}` });
  res.json(tier);
});

app.get('/api/creators/:creatorId/tiers', (req, res) => {
  res.json({ tiers: listTiersForCreator(store, req.params.creatorId) });
});

app.post('/api/tiers/:id/subscribe', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await subscribeTier(store, { ...req.body, tierId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Map Search --

// Business listings sync from HVNTZ, which owns the businessId
// namespace. No end-user session owns a business here.
app.post('/api/map-listings', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createListing(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/map-listings/:id', (req, res) => {
  const listing = getListing(store, Number(req.params.id));
  if (!listing) return res.status(404).json({ error: `no map listing with id ${req.params.id}` });
  res.json(listing);
});

app.get('/api/map-search', (req, res) => {
  try {
    res.json({
      results: searchNearby(store, {
        lat: Number(req.query.lat), lng: Number(req.query.lng), radiusKm: Number(req.query.radiusKm), category: req.query.category,
      }),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Profile Cards --

app.post('/api/profile-cards', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(createOrUpdateProfileCard(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/profile-cards/:userId', (req, res) => {
  const card = getProfileCard(store, req.params.userId);
  if (!card) return res.status(404).json({ error: `no profile card for ${req.params.userId}` });
  res.json(card);
});

// -- Screen Sessions (up to 8 interactive screens) --

app.post('/api/screen-sessions', requireActor('ownerId'), async (req, res) => {
  let session;
  try {
    session = createScreenSession(store, req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // `wall` rather than `room`: many simultaneous inbound feeds, which
  // is a different transport shape from a conversation. Recordable --
  // this is the one consumer that genuinely needs it, and asking for
  // it here means consent is given when the session is created rather
  // than sprung on people mid-stream.
  const mediaSession = await media.openSession(session.id, 'wall', { recordable: true });
  const invite = mediaSession
    ? await media.inviteParticipant(mediaSession.id, (req.body || {}).ownerId, { role: 'publisher' })
    : null;

  return res.status(201).json({
    ...session,
    media: invite
      ? { sessionId: mediaSession.id, recordable: true, joinCredential: invite.credential, joinAt: '/api/join' }
      : { available: false, reason: 'vaco-media did not answer; the session exists without feeds' },
  });
});

app.get('/api/screen-sessions/:id', (req, res) => {
  const session = getScreenSessionWithChannels(store, Number(req.params.id));
  if (!session) return res.status(404).json({ error: `no screen session with id ${req.params.id}` });
  res.json(session);
});

app.post('/api/screen-sessions/:id/screens', requireScreenSessionOwner(), (req, res) => {
  try {
    res.status(201).json(addScreenToSession(store, Number(req.params.id), req.body.channelId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/screen-sessions/:id/screens/:channelId', requireScreenSessionOwner(), (req, res) => {
  try {
    res.json(removeScreenFromSession(store, Number(req.params.id), Number(req.params.channelId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/owners/:ownerId/screen-sessions', (req, res) => {
  res.json({ sessions: listScreenSessionsForOwner(store, req.params.ownerId) });
});

app.post('/api/referrals', requireActor('referrerId'), async (req, res) => {
  try {
    res.status(201).json(await recordReferral(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/referrals/:userId/progress', (req, res) => {
  res.json(getReferralProgress(store, req.params.userId));
});

// The spin pays out VCoin against a provably-fair client seed, so the
// person spinning must be the person credited. Same as VOKEN's.
app.post('/api/referrals/:userId/spin', requireParamActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await spinWheel(store, { ...req.body, userId: req.params.userId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino-events', requireActor('hostId'), (req, res) => {
  try {
    res.status(201).json(createCasinoEvent(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/casino-events', (req, res) => {
  res.json({ events: listCasinoEvents(store, req.query) });
});

app.get('/api/casino-events/:id', (req, res) => {
  const event = getCasinoEventWithDetail(store, Number(req.params.id));
  if (!event) return res.status(404).json({ error: `no casino event with id ${req.params.id}` });
  res.json(event);
});

app.post('/api/casino-events/:id/go-live', requireCasinoEventHost(), (req, res) => {
  try {
    res.json(goLiveCasinoEvent(store, { eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino-events/:id/end', requireCasinoEventHost(), (req, res) => {
  try {
    res.json(endCasinoEvent(store, { eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino-events/:id/join', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(joinCasinoEvent(store, { ...req.body, eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino-events/:id/leave', requireActor('userId'), (req, res) => {
  try {
    res.json(leaveCasinoEvent(store, { ...req.body, eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/casino-events/:id/attendees', (req, res) => {
  res.json({ attendees: listAttendees(store, Number(req.params.id)) });
});

// Real demo seed data, gated on a genuinely empty store -- checked via
// `store.channels.length`, the app's own real, structural array, so a
// second boot against an already-populated `data/store.json` never
// double-seeds, and a persisted store loaded from disk with real
// production data is never clobbered.
async function start() {
  if (store.channels.length === 0) {
    await seedDemoData(store);
  }
  app.listen(PORT, () => {
    console.log(`VAVLT STVDIOS listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
}

start();
