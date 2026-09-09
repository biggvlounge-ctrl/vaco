// CVNVO -- Gift Dating, the real, deliberate replacement for a "sugar
// dating" feature this project's own source doc explicitly recommends
// against building.
// Source of truth: `CVNVO_ARCHITECTURE.md`'s own `GiftDatingThreshold
// { userId, minGiftValueVCoin }` and `CVNVO_DATING_COMPARABLES.md`'s
// own compliance flag: "Seeking.com... explicitly prohibits sugar
// dating... because Apple's App Store explicitly does not support
// sugar dating apps... The Gift Dating feature already documented
// above covers the underlying spirit... without inheriting the
// transactional-relationship framing." Built exactly as that section
// recommends, nothing more.
//
// Real, direct mechanic: a recipient sets their own real minimum gift
// value; a date request must be accompanied by a real VCoin gift
// meeting or exceeding that threshold before it's even created -- "a
// creator setting a minimum-tip gate," per the doc's own framing, not
// an impulse-gift feature. Runs on real VCoin via the same injected
// `transferFn` pattern as every other VCoin-moving module this
// session.

function setGiftThreshold(store, options = {}) {
  const { userId, minGiftValueVCoin } = options;
  if (!userId) throw new Error('setGiftThreshold requires a userId');
  if (!Number.isFinite(minGiftValueVCoin) || minGiftValueVCoin < 0) {
    throw new Error('setGiftThreshold requires a non-negative minGiftValueVCoin');
  }

  const existing = store.giftDatingThresholds.find((t) => t.userId === userId);
  if (existing) {
    existing.minGiftValueVCoin = minGiftValueVCoin;
    return existing;
  }
  const threshold = { userId, minGiftValueVCoin };
  store.giftDatingThresholds.push(threshold);
  return threshold;
}

function getGiftThreshold(store, userId) {
  return store.giftDatingThresholds.find((t) => t.userId === userId) || null;
}

// The real, gated request: a real VCoin gift must be sent, and it must
// genuinely meet the recipient's own real threshold, before the
// request record is ever created -- the threshold is enforced here,
// not just documented as the recipient's preference.
async function requestDateWithGift(store, options = {}) {
  const {
    requesterId, recipientId, giftValueVCoin, transferFn, now = Date.now(),
  } = options;
  if (!requesterId || !recipientId) throw new Error('requestDateWithGift requires requesterId and recipientId');
  if (requesterId === recipientId) throw new Error('requestDateWithGift: requesterId and recipientId must differ');
  if (!Number.isFinite(giftValueVCoin) || giftValueVCoin <= 0) throw new Error('requestDateWithGift requires a positive giftValueVCoin');
  if (typeof transferFn !== 'function') throw new Error('requestDateWithGift requires a transferFn(fromUserId, toUserId, amount, reason)');

  const threshold = getGiftThreshold(store, recipientId);
  const minRequired = threshold ? threshold.minGiftValueVCoin : 0;
  if (giftValueVCoin < minRequired) {
    throw new Error(`requestDateWithGift: ${recipientId} requires a minimum gift of ${minRequired} VCoin (received ${giftValueVCoin})`);
  }

  await transferFn(requesterId, recipientId, giftValueVCoin, `cvnvo_gift_dating_request:${requesterId}:${recipientId}`);

  const request = {
    id: store.nextGiftDateRequestId++, requesterId, recipientId, giftValueVCoin, createdAt: now,
  };
  store.giftDateRequests.push(request);
  return request;
}

function getGiftRequestsForUser(store, userId) {
  return store.giftDateRequests.filter((r) => r.recipientId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  setGiftThreshold, getGiftThreshold, requestDateWithGift, getGiftRequestsForUser,
};
