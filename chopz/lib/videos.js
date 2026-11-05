// CHOPZ -- Videos (the primary short-form video/social surface).
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `ChopzVideo { id, creatorId, mediaUrl, linkedProductId: string | null }`.
// A product can be shoppable directly from a video, or a video can
// carry no product at all (pure entertainment/social content, same as
// any other short-form clip).
//
// Real architectural note, per explicit instruction: CHOPZ SHOP is
// its own separate app (`chopz-shop/`, own server/port), not a local
// module here -- so `linkedProductId` is NOT validated at creation
// time against a local product list the way it briefly was before the
// split, and still isn't synchronously validated against CHOPZ SHOP's
// live API either: forcing every video upload to round-trip to
// another app would block the primary content-creation path on a
// dependency it doesn't strictly need at creation time -- TikTok
// itself doesn't synchronously validate shop links at upload time
// either.
//
// **Real, deferred verification added (Phase 2)**: `verifyLinkedProduct`
// is the real, separate, opt-in check this file's own header already
// named as "the real next step" -- called after creation (mirroring
// CVNVO's own `voidFetchFn`/Hunts Dates pattern: validate live, store
// the real response, never trust the caller's bare claim), not forced
// into the upload path itself.
//
// **Duets (added 5 Nov 2026), and exactly what this app can honestly
// claim about them.** A real TikTok Duet is a new video the real
// TikTok CLIENT composites client-side (split-screen, the original
// playing alongside the new recording) before it is ever uploaded --
// by the time a Duet reaches TikTok's own servers, it is already one
// ordinary video file. This app has no real video-composition
// pipeline (and, per `vaco-media`'s own posture across this whole
// ecosystem, never pretends to), so it does not fabricate one either
// -- a Duet here is the same real thing a Duet is everywhere else in
// this codebase's own media story: an ordinary `ChopzVideo`, with
// `mediaUrl` pointing at whatever file the creator's own tooling
// already produced, plus one new, real, honest relationship field
// (`duetOfVideoId`) recording which existing video it duets. UNLIKE
// `linkedProductId` (a genuinely cross-app reference this app
// deliberately does not validate synchronously), `duetOfVideoId`
// references this SAME app's own local store, so there is no reason
// to defer the check the way there is for CHOPZ SHOP -- it is
// validated synchronously, the same as any other local foreign-key
// reference in this codebase.

function createChopzVideo(store, options = {}) {
  const { creatorId, mediaUrl, linkedProductId = null, duetOfVideoId = null, now = Date.now() } = options;

  if (!creatorId) throw new Error('createChopzVideo requires a creatorId');
  if (!mediaUrl) throw new Error('createChopzVideo requires a mediaUrl');
  if (duetOfVideoId !== null && !getChopzVideo(store, duetOfVideoId)) {
    throw new Error(`createChopzVideo: no video with id ${duetOfVideoId} to duet`);
  }

  const video = {
    id: store.nextVideoId++,
    creatorId,
    mediaUrl,
    linkedProductId,
    linkedProductVerified: false,
    duetOfVideoId,
    createdAt: now,
  };
  store.videos.push(video);
  return video;
}

function getChopzVideo(store, videoId) {
  return store.videos.find((v) => v.id === videoId) || null;
}

// Real TikTok feature: "View X duets" on the original's own card.
// Newest first, the same read order this ecosystem's other
// comment-shaped feeds already use for "what's happened to this
// lately."
function getDuetsOf(store, videoId) {
  return store.videos
    .filter((v) => v.duetOfVideoId === videoId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function verifyLinkedProduct(store, options = {}) {
  const { videoId, chopzShopFetchFn } = options;
  const video = getChopzVideo(store, videoId);
  if (!video) throw new Error(`verifyLinkedProduct: no video with id ${videoId}`);
  if (!video.linkedProductId) throw new Error(`verifyLinkedProduct: video ${videoId} has no linkedProductId to verify`);
  if (typeof chopzShopFetchFn !== 'function') throw new Error('verifyLinkedProduct requires a chopzShopFetchFn(productId)');

  const product = await chopzShopFetchFn(video.linkedProductId);
  if (!product) throw new Error(`verifyLinkedProduct: CHOPZ SHOP has no real product with id ${video.linkedProductId}`);

  video.linkedProductVerified = true;
  video.linkedProductSellerId = product.sellerId;
  video.linkedProductPrice = product.price;
  return video;
}

module.exports = { createChopzVideo, getChopzVideo, getDuetsOf, verifyLinkedProduct };
