// VXLLAGE -- X/Twitter-primary social app (Reddit/Discord/Clubhouse/
// Zoom as secondary registers, per the standing correction).
// Source of truth: VXLLAGE_CLAUDE.md, VXLLAGE_VDP_VILLAGE_DISTRICT.md,
// VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md (VXLLAGE section only -- CHOPZ
// and VACAY are separate apps documented in the same combined file).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8796/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVxllageStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const { requireSession, requireActor } = require('./lib/shieldAuth.cjs');
const {
  createPost, getPost, getReplies, getThread, likePost, unlikePost, repostPost, unrepostPost,
} = require('./lib/posts');
const { followUser, unfollowUser, isFollowing, getFollowing, getFollowers } = require('./lib/follows');
const { getFollowingFeed, getForYouFeed } = require('./lib/feed');
const { getUserProfile } = require('./lib/profiles');
const {
  createVillage, getVillage, listVillages, joinVillage, leaveVillage, getVillageMembers,
} = require('./lib/villages');
const {
  createVillageEvent, getVillageEvent, listVillageEvents, rsvpToEvent, unrsvpFromEvent, getGoingCount,
} = require('./lib/villageEvents');
const {
  ROOM_TYPES, createVillageRoom, getVillageRoom, listVillageRooms, joinRoom, leaveRoom,
} = require('./lib/villageRooms');
const {
  createChannel, getChannel, listChannelsForVillage, postChannelMessage, getChannelMessages, markChannelRead, getUnreadCount,
} = require('./lib/villageChannels');
const {
  BOOST_LEVEL_THRESHOLDS, boostVillage, getBoostStatus, createCosmeticItem, listCosmeticsForVillage, purchaseCosmetic, getOwnedCosmeticsForUser,
} = require('./lib/villageShop');
const { searchVillages, searchPosts } = require('./lib/vxllageSearch');
const {
  getAvatarCosmeticCatalog, purchaseAvatarCosmetic, getOwnedAvatarCosmetics,
  equipAvatarCosmetic, unequipAvatarCosmetic, getAvatarProfile,
} = require('./lib/avatarCosmetics');
const { settleVCoin } = require('./lib/v3Client');
const {
  publishArticle, getArticle, listArticlesForAuthor, getArticleForViewer, canViewArticle,
} = require('./lib/articles');
const {
  subscribeToNewsletter, unsubscribeFromNewsletter, getSubscribersForAuthor,
  recommendAuthor, getRecommendationsForAuthor, sendNewsletter,
} = require('./lib/newsletters');
const { SURFACE_TYPES, createSurfaceLink, getLinksForSurface } = require('./lib/surfaceLinks');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'vxllage' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8796;
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this app's store lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide. The route handlers close
// over this binding rather than a value, so they see the real store the
// moment it is installed.
//
// Without DATABASE_URL nothing changes: the same JSON file, in the same
// place, with the same guarantees.
let store = createVxllageStore();
attachStore(app, {
  appKey: 'vxllage',
  createDefault: createVxllageStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vxllage', villageRoomTypes: ROOM_TYPES, boostLevelThresholds: BOOST_LEVEL_THRESHOLDS, surfaceTypes: SURFACE_TYPES,
  });
});

app.post('/api/posts', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(createPost(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/posts/:id', (req, res) => {
  const post = getPost(store, Number(req.params.id));
  if (!post) return res.status(404).json({ error: `no post with id ${req.params.id}` });
  res.json(post);
});

app.get('/api/posts/:id/replies', (req, res) => {
  res.json({ replies: getReplies(store, Number(req.params.id)) });
});

app.get('/api/posts/:id/thread', (req, res) => {
  try {
    res.json(getThread(store, Number(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/posts/:id/like', requireActor('userId'), (req, res) => {
  try {
    res.json(likePost(store, { ...req.body, postId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/unlike', requireActor('userId'), (req, res) => {
  try {
    res.json(unlikePost(store, { ...req.body, postId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/repost', requireActor('userId'), (req, res) => {
  try {
    res.json(repostPost(store, { ...req.body, postId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/unrepost', requireActor('userId'), (req, res) => {
  try {
    res.json(unrepostPost(store, { ...req.body, postId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/follow', requireActor('followerId'), (req, res) => {
  try {
    res.status(201).json(followUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/unfollow', requireActor('followerId'), (req, res) => {
  try {
    res.json(unfollowUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/follow-status/:followerId/:followeeId', (req, res) => {
  res.json({ following: isFollowing(store, req.params.followerId, req.params.followeeId) });
});

app.get('/api/following/:userId', (req, res) => {
  res.json({ userId: req.params.userId, following: getFollowing(store, req.params.userId) });
});

app.get('/api/followers/:userId', (req, res) => {
  res.json({ userId: req.params.userId, followers: getFollowers(store, req.params.userId) });
});

app.get('/api/feed/following/:userId', (req, res) => {
  try {
    res.json({ feed: getFollowingFeed(store, { userId: req.params.userId }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/feed/for-you/:userId', (req, res) => {
  try {
    res.json({ feed: getForYouFeed(store, { userId: req.params.userId }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/profile/:userId', (req, res) => {
  try {
    res.json(getUserProfile(store, { userId: req.params.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/villages', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(createVillage(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/villages', (_req, res) => {
  res.json({ villages: listVillages(store) });
});

app.get('/api/villages/:id', (req, res) => {
  const village = getVillage(store, Number(req.params.id));
  if (!village) return res.status(404).json({ error: `no village with id ${req.params.id}` });
  res.json(village);
});

app.post('/api/villages/:id/join', requireActor('userId'), (req, res) => {
  try {
    res.json(joinVillage(store, { ...req.body, villageId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/villages/:id/leave', requireActor('userId'), (req, res) => {
  try {
    res.json(leaveVillage(store, { ...req.body, villageId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/villages/:id/members', (req, res) => {
  try {
    res.json({ members: getVillageMembers(store, Number(req.params.id)) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// -- Ownership-lookup guards ------------------------------------------
//
// `requireActor` covers routes whose body names the acting user. These
// four do not: they name a *thing* — a village, an article, a surface —
// and the acting party is whoever the stored record says owns it.
//
// Until now all four sat on `requireSession()` alone, which is
// authentication without authorization: any signed-in user could create
// an event in anyone's village, add a channel to it, or send another
// author's newsletter to their subscribers.
//
// `dev-docs/AUTH_HARDENING.md` §4 recorded them as a known limitation
// rather than counting them done. This closes them, using the same
// shape VOKEN's trade routes needed.

// Village events: any **member** may create one. Membership is the real
// boundary — a non-member scheduling events in your community is the
// abuse. Deliberately not owner-only: villages are participatory, and
// owner-only would foreclose the ordinary case.
function requireVillageMember() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const villageId = Number((req.body || {}).villageId);
    const village = store.villages.find((v) => v.id === villageId);
    if (!village) return res.status(404).json({ error: `no village with id ${villageId}` });
    if (!village.members.some((m) => m.userId === req.sessionUserId)) {
      return res.status(403).json({ error: 'only a member of this village may do this' });
    }
    return next();
  });
}

// Channels: **owner only**. A channel is village configuration rather
// than participation — the structural counterpart to scheduling an
// event — so it sits one notch tighter than the member check above.
function requireVillageOwner() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const villageId = Number((req.body || {}).villageId);
    const village = store.villages.find((v) => v.id === villageId);
    if (!village) return res.status(404).json({ error: `no village with id ${villageId}` });
    if (village.ownerId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the village owner may do this' });
    }
    return next();
  });
}

// Sending a newsletter mails an article to every subscriber. Only its
// author may do that — otherwise anyone can spend another author's
// credibility with their own audience.
function requireArticleAuthor() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const articleId = Number((req.body || {}).articleId);
    const article = store.articles.find((a) => a.id === articleId);
    if (!article) return res.status(404).json({ error: `no article with id ${articleId}` });
    if (article.authorId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the article’s author may send it' });
    }
    return next();
  });
}

// A surface link attaches one surface to another, so the actor must own
// the **source**. All three surface types resolve to an owner: posts and
// articles by `authorId`, village rooms by `ownerId`. An unknown type is
// refused rather than allowed — a new surface type must be taught to
// this resolver before it can be linked from.
function requireSourceSurfaceOwner() {
  const session = requireSession();
  const RESOLVERS = {
    post: (id) => store.posts.find((x) => String(x.id) === id)?.authorId,
    article: (id) => store.articles.find((x) => String(x.id) === id)?.authorId,
    'village-room': (id) => store.villageRooms.find((x) => String(x.id) === id)?.ownerId,
  };
  return (req, res, next) => session(req, res, () => {
    const { sourceType, sourceId } = req.body || {};
    const resolve = RESOLVERS[sourceType];
    if (!resolve) {
      return res.status(400).json({ error: `cannot check ownership of sourceType "${sourceType}"` });
    }
    const ownerId = resolve(String(sourceId));
    if (ownerId === undefined) {
      return res.status(404).json({ error: `no ${sourceType} with id ${sourceId}` });
    }
    if (ownerId !== req.sessionUserId) {
      return res.status(403).json({ error: `only the owner of that ${sourceType} may link from it` });
    }
    return next();
  });
}

app.post('/api/village-events', requireVillageMember(), (req, res) => {
  try {
    res.status(201).json(createVillageEvent(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/village-events/:id', (req, res) => {
  const event = getVillageEvent(store, Number(req.params.id));
  if (!event) return res.status(404).json({ error: `no event with id ${req.params.id}` });
  res.json({ ...event, goingCount: getGoingCount(store, event.id) });
});

app.get('/api/villages/:id/events', (req, res) => {
  res.json({ events: listVillageEvents(store, Number(req.params.id)) });
});

app.post('/api/village-events/:id/rsvp', requireActor('userId'), (req, res) => {
  try {
    res.json(rsvpToEvent(store, { ...req.body, eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/village-events/:id/unrsvp', requireActor('userId'), (req, res) => {
  try {
    res.json(unrsvpFromEvent(store, { ...req.body, eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/village-rooms', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(createVillageRoom(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/village-rooms/:id', (req, res) => {
  const room = getVillageRoom(store, Number(req.params.id));
  if (!room) return res.status(404).json({ error: `no room with id ${req.params.id}` });
  res.json(room);
});

app.get('/api/villages/:id/rooms', (req, res) => {
  res.json({ rooms: listVillageRooms(store, Number(req.params.id)) });
});

app.post('/api/village-rooms/:id/join', requireActor('userId'), async (req, res) => {
  let joined;
  try {
    joined = joinRoom(store, { ...req.body, roomId: Number(req.params.id) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // The room is real either way -- membership, ownership and the
  // recurrence schedule are all VXLLAGE's and all already worked. What
  // vaco-media adds is transport, and a null here means the room still
  // exists and just cannot carry audio yet.
  const roomId = Number(req.params.id);
  const session = await media.openSession(roomId, 'room');
  const invite = session
    ? await media.inviteParticipant(session.id, (req.body || {}).userId)
    : null;

  return res.json({
    ...joined,
    media: invite
      ? { sessionId: session.id, joinCredential: invite.credential, joinAt: '/api/join' }
      : { available: false, reason: 'vaco-media did not answer; the room is open without audio/video' },
  });
});

app.post('/api/village-rooms/:id/leave', requireActor('userId'), (req, res) => {
  try {
    res.json(leaveRoom(store, { ...req.body, roomId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Channels --

app.post('/api/channels', requireVillageOwner(), (req, res) => {
  try {
    res.status(201).json(createChannel(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/villages/:id/channels', (req, res) => {
  res.json({ channels: listChannelsForVillage(store, Number(req.params.id)) });
});

app.get('/api/channels/:id', (req, res) => {
  const channel = getChannel(store, Number(req.params.id));
  if (!channel) return res.status(404).json({ error: `no channel with id ${req.params.id}` });
  res.json(channel);
});

app.post('/api/channels/:id/messages', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(postChannelMessage(store, { ...req.body, channelId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/messages', (req, res) => {
  try {
    res.json({ messages: getChannelMessages(store, Number(req.params.id)) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/channels/:id/read', requireActor('userId'), (req, res) => {
  try {
    res.json(markChannelRead(store, { ...req.body, channelId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/unread/:userId', (req, res) => {
  try {
    res.json({ unreadCount: getUnreadCount(store, { channelId: Number(req.params.id), userId: req.params.userId }) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// -- Village Shop: boost + cosmetics --

app.post('/api/villages/:id/boost', requireActor('boosterId'), async (req, res) => {
  try {
    res.status(201).json(await boostVillage(store, { ...req.body, villageId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/villages/:id/boost', (req, res) => {
  try {
    res.json(getBoostStatus(store, Number(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/villages/:id/cosmetics', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createCosmeticItem(store, { ...req.body, villageId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/villages/:id/cosmetics', (req, res) => {
  res.json({ cosmetics: listCosmeticsForVillage(store, Number(req.params.id)) });
});

app.post('/api/cosmetics/:id/purchase', requireActor('buyerId'), async (req, res) => {
  try {
    res.status(201).json(await purchaseCosmetic(store, { ...req.body, itemId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users/:userId/cosmetics', (req, res) => {
  res.json({ cosmetics: getOwnedCosmeticsForUser(store, req.params.userId) });
});

// -- Avatar Cosmetics: the personal, cross-village shop --

app.get('/api/avatar-cosmetics/catalog', (_req, res) => {
  res.json({ catalog: getAvatarCosmeticCatalog() });
});

app.post('/api/avatar-cosmetics/purchase', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await purchaseAvatarCosmetic(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/avatar-cosmetics/equip', requireActor('userId'), (req, res) => {
  try {
    res.json(equipAvatarCosmetic(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/avatar-cosmetics/unequip', requireActor('userId'), (req, res) => {
  res.json(unequipAvatarCosmetic(store, (req.body || {}).userId));
});

app.get('/api/users/:userId/avatar-profile', (req, res) => {
  res.json(getAvatarProfile(store, req.params.userId));
});

// -- Search --

app.get('/api/search/villages', (req, res) => {
  try {
    res.json({ results: searchVillages(store, req.query.q) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/search/posts', (req, res) => {
  try {
    res.json({ results: searchPosts(store, req.query.q) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Articles --

app.post('/api/articles', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(publishArticle(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  const article = getArticle(store, Number(req.params.id));
  if (!article) return res.status(404).json({ error: `no article with id ${req.params.id}` });
  try {
    const viewerId = req.query.viewerId || null;
    const hasAccess = await canViewArticle(article, viewerId);
    res.json(getArticleForViewer(article, hasAccess));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/authors/:authorId/articles', (req, res) => {
  res.json({ articles: listArticlesForAuthor(store, req.params.authorId) });
});

// -- Newsletters + cross-publication recommendations --

app.post('/api/newsletters/subscribe', requireActor('subscriberId'), (req, res) => {
  try {
    res.status(201).json(subscribeToNewsletter(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/newsletters/unsubscribe', requireActor('subscriberId'), (req, res) => {
  try {
    res.json(unsubscribeFromNewsletter(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/authors/:authorId/subscribers', (req, res) => {
  res.json({ subscribers: getSubscribersForAuthor(store, req.params.authorId) });
});

app.post('/api/authors/:authorId/recommendations', requireActor('authorId'), (req, res) => {
  try {
    res.status(201).json(recommendAuthor(store, { ...req.body, authorId: req.params.authorId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/authors/:authorId/recommendations', (req, res) => {
  res.json({ recommendedAuthors: getRecommendationsForAuthor(store, req.params.authorId) });
});

app.post('/api/newsletters/send', requireArticleAuthor(), (req, res) => {
  try {
    res.status(201).json(sendNewsletter(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Surface links --

app.post('/api/surface-links', requireSourceSurfaceOwner(), (req, res) => {
  try {
    res.status(201).json(createSurfaceLink(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/surface-links', (req, res) => {
  res.json({ links: getLinksForSurface(store, { sourceType: req.query.sourceType, sourceId: req.query.sourceId }) });
});

app.listen(PORT, () => {
  console.log(`VXLLAGE listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
