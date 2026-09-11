// CHOPZ -- the ecosystem's short-form video/social app. The primary
// surface: videos, the core content-creation loop.
// CHOPZ SHOP (`chopz-shop/`) is a separate, standalone app for the
// TikTok-Shop-model commerce layer (products, native checkout,
// affiliate links, VOID fulfillment) -- run and tested independently,
// per explicit instruction.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's CHOPZ
// section.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8800/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createChopzStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const { createChopzVideo, getChopzVideo, verifyLinkedProduct } = require('./lib/videos');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'chopz' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const { traceMiddleware } = require('./lib/tracing.cjs');
// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8800;
const CHOPZ_SHOP_API_URL = process.env.CHOPZ_SHOP_API_URL || 'http://localhost:8801';
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
let store = createChopzStore();
attachStore(app, {
  appKey: 'chopz',
  createDefault: createChopzStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// Real, live cross-app call into CHOPZ SHOP's own real product lookup
// -- videos.js's own header explains why this is deferred, opt-in
// verification rather than forced into video creation itself.
async function fetchChopzShopProduct(productId) {
  const res = await fetch(`${CHOPZ_SHOP_API_URL}/chopz-shop/products/${productId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchChopzShopProduct failed (${res.status})`);
  return body;
}

const { requireActor, requireSession } = require('./lib/shieldAuth.cjs');

// A video's creator is the only person who may re-verify its linked
// product -- the verification result is a claim attached to their
// content, and a stranger re-running it against a changed product is a
// way to invalidate somebody's shoppable link.
function requireVideoCreator() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const video = getChopzVideo(store, Number(req.params.id));
    if (!video) return res.status(404).json({ error: `no video with id ${req.params.id}` });
    if (video.creatorId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the video\'s creator may verify its linked product' });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'chopz' });
});

app.post('/chopz/videos', requireActor('creatorId'), async (req, res) => {
  let video;
  try {
    video = createChopzVideo(store, req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Short-form: small files, high volume. The linked-product
  // verification CHOPZ already does is unaffected -- this only gives
  // the clip somewhere to live.
  const asset = await media.registerAsset(video.id, 'short', video.creatorId, {
    durationSec: video.durationSec || null,
  });

  return res.status(201).json({
    ...video,
    media: asset
      ? { assetId: asset.id, status: asset.status }
      : { available: false, reason: 'vaco-media did not answer; the video record exists without an asset' },
  });
});

// Listing. The resource could be created and fetched by id but never
// enumerated, so no browsable surface could exist without already
// knowing an id. Same gap found in five apps on this pass.
app.get('/chopz/videos', (_req, res) => {
  res.json({ videos: store.videos });
});

app.get('/chopz/videos/:id', (req, res) => {
  const video = getChopzVideo(store, Number(req.params.id));
  if (!video) return res.status(404).json({ error: `no video with id ${req.params.id}` });
  res.json(video);
});

app.post('/chopz/videos/:id/verify-linked-product', requireVideoCreator(), async (req, res) => {
  try {
    res.json(await verifyLinkedProduct(store, { videoId: Number(req.params.id), chopzShopFetchFn: fetchChopzShopProduct }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CHOPZ listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
