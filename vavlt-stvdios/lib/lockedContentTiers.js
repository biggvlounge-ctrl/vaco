// VAVLT STVDIOS -- Locked Content Tiers, the real Patreon/OnlyFans-
// model layer. Source of truth: `VAULT_STUDIOS_ARCHITECTURE.md`'s own
// `LockedContentTier { id, creatorId, tierName, priceVCoin, benefits,
// subscribers }`, and `VAULT_STUDIOS_IG_LAYER.md`'s own "extends it
// explicitly to business owners specifically, not just individual
// creators. Revenue split follows the same 80/20 creator-favor anchor
// already established ecosystem-wide" -- `creatorId` is explicitly
// either an individual OR an HVNTZ-onboarded business, so no
// individual-vs-business branch exists anywhere in this module; a
// tier's `creatorId` is just an account id either way, the same
// posture VAVLT STVDIOS' own tips already take for
// `recipientPersonId`.
//
// Real, direct application of the doc's own named 80/20 split: a real
// two-way VCoin payout on every subscription charge, summing exactly
// to `priceVCoin` -- the platform's own account gets the 20%, the
// creator gets the 80%, proven via the transfer calls' own arguments
// in verification.

const VAVLT_STVDIOS_PLATFORM_ACCOUNT = 'vavlt-stvdios-platform';
const CREATOR_SPLIT_PERCENT = 0.80;

function round(n) {
  return Math.round(n * 100) / 100;
}

function createTier(store, options = {}) {
  const {
    creatorId, tierName, priceVCoin, benefits = [], now = Date.now(),
  } = options;

  if (!creatorId) throw new Error('createTier requires a creatorId');
  if (!tierName) throw new Error('createTier requires a tierName');
  if (!Number.isFinite(priceVCoin) || priceVCoin <= 0) throw new Error('createTier requires a positive priceVCoin');
  if (!Array.isArray(benefits)) throw new Error('createTier requires a benefits array');

  const tier = {
    id: store.nextTierId++, creatorId, tierName, priceVCoin, benefits, subscribers: [], createdAt: now,
  };
  store.lockedContentTiers.push(tier);
  return tier;
}

function getTier(store, tierId) {
  return store.lockedContentTiers.find((t) => t.id === tierId) || null;
}

function listTiersForCreator(store, creatorId) {
  return store.lockedContentTiers.filter((t) => t.creatorId === creatorId);
}

function isSubscribed(store, tierId, userId) {
  const tier = getTier(store, tierId);
  return !!tier && tier.subscribers.includes(userId);
}

// The real gated-access check `posts.js`'s own `getPostForViewer`
// caller uses -- a post's `requiredTierId` maps directly to a real
// subscriber list here.
function canAccessLockedContent(store, requiredTierId, userId) {
  return isSubscribed(store, requiredTierId, userId);
}

async function subscribeTier(store, options = {}) {
  const { tierId, userId, transferFn } = options;
  const tier = getTier(store, tierId);
  if (!tier) throw new Error(`subscribeTier: no tier with id ${tierId}`);
  if (!userId) throw new Error('subscribeTier requires a userId');
  if (typeof transferFn !== 'function') throw new Error('subscribeTier requires a transferFn(fromUserId, toUserId, amount, reason)');
  if (tier.subscribers.includes(userId)) throw new Error(`subscribeTier: ${userId} is already subscribed to tier ${tierId}`);

  const creatorShare = round(tier.priceVCoin * CREATOR_SPLIT_PERCENT);
  const platformShare = round(tier.priceVCoin - creatorShare);

  await transferFn(userId, tier.creatorId, creatorShare, `vavlt_stvdios_tier_subscription:${tierId}`);
  await transferFn(userId, VAVLT_STVDIOS_PLATFORM_ACCOUNT, platformShare, `vavlt_stvdios_tier_platform_share:${tierId}`);

  tier.subscribers.push(userId);
  return {
    tier, creatorShare, platformShare,
  };
}

module.exports = {
  VAVLT_STVDIOS_PLATFORM_ACCOUNT,
  CREATOR_SPLIT_PERCENT,
  createTier,
  getTier,
  listTiersForCreator,
  isSubscribed,
  canAccessLockedContent,
  subscribeTier,
};
