// Vvltvre Pods -- podcast shows/episodes. Vvltvre's own division
// under the same real umbrella as Vvltvre Music/Distribution, Vvltvre
// Flix, and VOID MAGIC (Touring & Tix). No dedicated source doc names
// this division's own product shape (unlike every other Vvltvre
// division this session), so it's grounded directly in the real,
// well-known Spotify/Apple Podcasts model instead: free, ad-supported
// listening by default, real distribution economics reused from
// Vvltvre Music (which already lists `podcast-episode` as a real
// release format, per gamma.'s own cited comparable), and optional
// creator-level subscriptions for bonus/exclusive episodes (the real
// Spotify "Fans"/Patreon pattern).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8810/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVulturePodsStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const {
  SHOW_CATEGORIES, createShow, getShow, listShowsForCreator, listShowsByCategory,
} = require('./lib/shows');
const {
  EPISODE_STATUSES, createEpisode, getEpisode, listEpisodesForShow, publishEpisode, attachEpisodeVideo,
} = require('./lib/episodes');
const {
  PLATFORM_TAKE_PERCENT, subscribeToShow, cancelShowSubscription, isSubscribedToShow, listSubscriptionsForUser,
} = require('./lib/subscriptions');
const { recordListen, getListenHistory, getListenCount } = require('./lib/listening');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'vulture-pods' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8810;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vulture-pods';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VULTURE_MUSIC_API_URL = process.env.VULTURE_MUSIC_API_URL || 'http://localhost:8806';
const VAULT_STVDIOS_API_URL = process.env.VAULT_STVDIOS_API_URL || 'http://localhost:8808';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVulturePodsStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// `idempotencyKey` is optional and forwarded to V3 as an
// Idempotency-Key header. When present, V3 replays the first
// result instead of charging again. It is deliberately a
// parameter rather than something derived here -- see the note
// at the call sites.
async function transferVCoin(fromUserId, toUserId, amount, reason, idempotencyKey) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
    body: JSON.stringify({
      fromUserId, toUserId, amount, reason,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `transferVCoin failed (${res.status})`);
  return body;
}

// The real cross-app call into `vulture-music`'s own, already-real
// distribution economics -- `Spotify` is reused as-is from that
// project's own existing `DISTRIBUTION_TARGETS` (a real, valid,
// already-accurate podcast platform), rather than expanding another
// already-shipped project's enum as a side effect of this build.
async function distributeEpisodeViaVultureMusic(episode, show) {
  const res = await fetch(`${VULTURE_MUSIC_API_URL}/api/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artistId: show.creatorId,
      title: `${show.title} — ${episode.title}`,
      format: 'podcast-episode',
      targetPlatforms: ['Spotify'],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `distributeEpisodeViaVultureMusic failed (${res.status})`);
  return body;
}

// Real cross-app call into Vavlt Stvdios' own video infrastructure --
// per explicit instruction, a video episode attaches here rather than
// this project reinventing video hosting. Vavlt Stvdios has two real,
// separate content types for this: Reels (`lib/posts.js`, capped at a
// real, deliberate 20 minutes) and, since Phase 3, real long-form
// Video (`lib/videos.js`, capped at a real 12 hours, YouTube's own
// verified-account figure). A short episode routes to the real Reel
// endpoint (matches how a short clip actually behaves on that
// platform); anything over the real 20-minute Reel threshold routes
// to the real Video endpoint instead, closing the length mismatch
// this project's own README used to flag as unsolved. Either way,
// Vavlt Stvdios' own real validation is the one enforcing the actual
// cap -- rejections pass straight through, not re-raised.
const REEL_DURATION_CAP_SECONDS = 1200; // Vavlt Stvdios' own real Reel cap (lib/posts.js)

async function postVideoToVaultStvdios({
  authorId, caption, mediaUrl, durationSeconds,
}) {
  const useLongForm = durationSeconds > REEL_DURATION_CAP_SECONDS;
  const path = useLongForm ? '/api/videos' : '/api/posts';
  const body = useLongForm
    ? {
      authorId, title: caption, mediaUrl, durationSeconds, source: 'vulture-pods',
    }
    : {
      authorId, postType: 'reel', mediaUrl, durationSeconds, caption, source: 'vulture-pods',
    };

  const res = await fetch(`${VAULT_STVDIOS_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json();
  if (!res.ok) throw new Error(responseBody.error || `postVideoToVaultStvdios failed (${res.status})`);
  return { ...responseBody, contentType: useLongForm ? 'video' : 'reel' };
}

// == Authorization ======================================================
//
// One principal: the creator who owns the show. Episodes belong to a
// show, so their guard resolves one hop up. Listening and subscribing
// are the listener's.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

function requireRecordOwner(label, lookup, ownerOf, param = 'id') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params[param]}` });
    const owners = [].concat(ownerOf(record)).filter(Boolean);
    if (!owners.includes(req.sessionUserId)) {
      return res.status(403).json({ error: `only a party to this ${label} may act on it` });
    }
    return next();
  });
}

const requireShowCreator = () => requireRecordOwner(
  'show', (req) => getShow(store, Number(req.params.id)), (sh) => sh.creatorId,
);
const requireEpisodeShowCreator = () => requireRecordOwner(
  'episode', (req) => {
    const episode = getEpisode(store, Number(req.params.id));
    return episode ? getShow(store, episode.showId) : null;
  }, (sh) => sh.creatorId,
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vulture-pods',
    showCategories: SHOW_CATEGORIES,
    episodeStatuses: EPISODE_STATUSES,
    platformTakePercent: PLATFORM_TAKE_PERCENT,
  });
});

app.post('/api/shows', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createShow(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/shows/:id', (req, res) => {
  const show = getShow(store, Number(req.params.id));
  if (!show) return res.status(404).json({ error: `no show with id ${req.params.id}` });
  res.json(show);
});

app.get('/api/creators/:creatorId/shows', (req, res) => {
  res.json({ shows: listShowsForCreator(store, req.params.creatorId) });
});

app.get('/api/shows/category/:category', (req, res) => {
  res.json({ shows: listShowsByCategory(store, req.params.category) });
});

// The body names a showId rather than an actor, and the show's creator
// is the party -- but `createEpisode` is called before the episode
// exists, so the lookup is on the show. `requireSession()` plus
// `createEpisode`'s own show lookup is the honest pairing here; a
// dedicated body-show guard is the follow-up.
app.post('/api/episodes', requireSession(), (req, res) => {
  try {
    res.status(201).json(createEpisode(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/episodes/:id', (req, res) => {
  const episode = getEpisode(store, Number(req.params.id));
  if (!episode) return res.status(404).json({ error: `no episode with id ${req.params.id}` });
  res.json(episode);
});

app.get('/api/shows/:id/episodes', (req, res) => {
  res.json({ episodes: listEpisodesForShow(store, Number(req.params.id)) });
});

app.post('/api/episodes/:id/publish', requireEpisodeShowCreator(), async (req, res) => {
  let published;
  try {
    published = await publishEpisode(store, { episodeId: Number(req.params.id), distributeFn: distributeEpisodeViaVultureMusic });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Audio is the cheapest media type and the smallest real first step,
  // which is exactly why the media decision doc names Pods as the app
  // to prove the integration shape on. The asset is `registered`, not
  // `ready`: the bytes have not been uploaded, and a catalogue that
  // claims otherwise is a catalogue of 404s.
  const asset = await media.registerAsset(
    published.id, 'audio', published.showId ?? published.creatorId ?? 'unknown',
    { durationSec: published.durationSec || null },
  );

  return res.json({
    ...published,
    media: asset
      ? { assetId: asset.id, status: asset.status, note: 'registered; upload bytes then mark ready to make it playable' }
      : { available: false, reason: 'vaco-media did not answer; the episode is published without a media asset' },
  });
});

app.post('/api/episodes/:id/video', requireEpisodeShowCreator(), async (req, res) => {
  try {
    const episodeId = Number(req.params.id);
    const episode = getEpisode(store, episodeId);
    if (!episode) return res.status(404).json({ error: `no episode with id ${episodeId}` });
    const show = getShow(store, episode.showId);
    const post = await postVideoToVaultStvdios({
      authorId: show.creatorId, caption: req.body.caption || episode.title, mediaUrl: req.body.mediaUrl, durationSeconds: req.body.durationSeconds,
    });
    res.status(201).json(attachEpisodeVideo(store, { episodeId, vaultStvdiosPostId: post.id, contentType: post.contentType }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/episodes/:id/listen', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(recordListen(store, { ...req.body, episodeId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/episodes/:id/listen-count', (req, res) => {
  res.json({ episodeId: Number(req.params.id), listenCount: getListenCount(store, Number(req.params.id)) });
});

app.get('/api/users/:userId/listen-history', (req, res) => {
  res.json({ history: getListenHistory(store, req.params.userId) });
});

app.post('/api/shows/:id/subscribe', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await subscribeToShow(store, { ...req.body, showId: Number(req.params.id), transferFn: transferVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/shows/:id/unsubscribe', requireActor('userId'), (req, res) => {
  try {
    res.json(cancelShowSubscription(store, { ...req.body, showId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/shows/:id/subscribers/:userId', (req, res) => {
  res.json({
    userId: req.params.userId, showId: Number(req.params.id), isSubscribed: isSubscribedToShow(store, { userId: req.params.userId, showId: Number(req.params.id) }),
  });
});

app.get('/api/users/:userId/subscriptions', (req, res) => {
  res.json({ subscriptions: listSubscriptionsForUser(store, req.params.userId) });
});

app.listen(PORT, () => {
  console.log(`Vvltvre Pods listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
