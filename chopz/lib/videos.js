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

function createChopzVideo(store, options = {}) {
  const { creatorId, mediaUrl, linkedProductId = null } = options;

  if (!creatorId) throw new Error('createChopzVideo requires a creatorId');
  if (!mediaUrl) throw new Error('createChopzVideo requires a mediaUrl');

  const video = {
    id: store.nextVideoId++,
    creatorId,
    mediaUrl,
    linkedProductId,
    linkedProductVerified: false,
    createdAt: Date.now(),
  };
  store.videos.push(video);
  return video;
}

function getChopzVideo(store, videoId) {
  return store.videos.find((v) => v.id === videoId) || null;
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

module.exports = { createChopzVideo, getChopzVideo, verifyLinkedProduct };
