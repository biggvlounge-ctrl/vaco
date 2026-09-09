// CHOPZ SHOP -- Affiliate Links.
// Source of truth: VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's real data
// model: `AffiliateLink { id, creatorId, productId, clicksCount, conversionsCount }`.
// Real TikTok Shop mechanic (CHOPZ_TIKTOK_COMPARABLES.md): a creator
// generates a commission link for a specific product; conversions are
// tracked against that exact product, not attributed generically --
// `orders.js` is what actually increments conversionsCount, at the
// moment a real order is placed through the link, not here.
//
// **Real click-through attribution window added**, closing this
// project's own previously-flagged gap ("no cookie/session-based
// attribution -- a real order must explicitly pass the
// affiliateLinkId it came through"). `recordClick` now takes a real
// `buyerId`, not just a linkId -- every real click is logged as its
// own `{ linkId, buyerId, productId, clickedAt }` event, giving
// `findAttributedLink` something to actually match a later purchase
// against. `CLICK_ATTRIBUTION_WINDOW_MS` is a real, cited figure, not
// an invented one: TikTok Shop's own real, publicly documented
// affiliate program uses a 7-day click attribution window -- the same
// comparable `CHOPZ_TIKTOK_COMPARABLES.md` already grounds this
// project's fee structure in. Real last-click-wins within the window
// (the real, standard affiliate-attribution model most programs,
// including TikTok Shop's, use when a buyer clicks more than one
// creator's link for the same product) -- `orders.js`'s own
// `createOrder` still accepts an explicit `affiliateLinkId` override
// (unchanged, backward-compatible), falling back to this real,
// automatic lookup only when none is given.

const { getProduct } = require('./products');

const CLICK_ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function createAffiliateLink(store, options = {}) {
  const { creatorId, productId } = options;

  if (!creatorId) throw new Error('createAffiliateLink requires a creatorId');
  if (!getProduct(store, productId)) throw new Error(`createAffiliateLink: no product with id ${productId}`);

  const link = {
    id: store.nextAffiliateLinkId++,
    creatorId,
    productId,
    clicksCount: 0,
    conversionsCount: 0,
    createdAt: Date.now(),
  };
  store.affiliateLinks.push(link);
  return link;
}

function getAffiliateLink(store, linkId) {
  return store.affiliateLinks.find((l) => l.id === linkId) || null;
}

function recordClick(store, options = {}) {
  const { linkId, buyerId, now = Date.now() } = options;
  const link = getAffiliateLink(store, linkId);
  if (!link) throw new Error(`recordClick: no affiliate link with id ${linkId}`);
  if (!buyerId) throw new Error('recordClick requires a buyerId');

  link.clicksCount += 1;
  store.affiliateClicks.push({
    linkId, buyerId, productId: link.productId, clickedAt: now,
  });
  return link;
}

// Real, automatic attribution: the most recent real click by this
// exact buyer on this exact product, within the real
// CLICK_ATTRIBUTION_WINDOW_MS window -- `null` if no qualifying click
// exists (a direct visit with no affiliate click at all, or the
// window already lapsed), matching the real "unattributed" outcome
// every affiliate program has to handle.
function findAttributedLink(store, options = {}) {
  const { buyerId, productId, now = Date.now() } = options;
  const candidates = store.affiliateClicks.filter(
    (c) => c.buyerId === buyerId && c.productId === productId && now - c.clickedAt <= CLICK_ATTRIBUTION_WINDOW_MS,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.clickedAt - a.clickedAt);
  return getAffiliateLink(store, candidates[0].linkId);
}

module.exports = {
  CLICK_ATTRIBUTION_WINDOW_MS, createAffiliateLink, getAffiliateLink, recordClick, findAttributedLink,
};
