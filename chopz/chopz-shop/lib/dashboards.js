// CHOPZ SHOP -- Creator and Seller Dashboards, and real product
// discovery.
//
// Per a direct batch instruction asking for the "optimal blend" of
// the Amazon Influencer Program and the TikTok Shop Creator Program,
// including "creator dashboards," "business dashboards" and "product
// discovery." Checked directly before building anything: the real
// affiliate commerce engine this asks for already exists --
// `affiliateLinks.js` (real click attribution, a real cited 7-day
// window) and `orders.js` (real commission splits, "no upfront cost
// to the brand, performance-only," per `CHOPZ_TIKTOK_COMPARABLES.md`)
// were both already built and already real. What was missing is this
// file: nothing aggregated that real per-order/per-link data into a
// creator's or a seller's own real performance numbers, and no route
// answered "what's selling" at all.
//
// **Every number here is a real aggregation over `store.orders` and
// `store.affiliateLinks` — nothing invented, nothing from an outside
// model.** "AI product recommendations," named in the same batch
// instruction, is NOT built here: this session's environment has no
// generative-AI API key configured at all (checked directly), so a
// real personalized recommendation model is out of reach this pass.
// `trendingProducts` is the honest, real substitute available without
// one — real products ranked by real order count/revenue, the same
// "most purchased" signal every storefront already surfaces, not a
// personalization model pretending to be one.

const { getProduct } = require('./products');

// A creator's own real affiliate performance: every link they hold,
// real clicks, real conversions, and real commission actually paid
// out (read from `orders.js`'s own recorded `affiliateCommission`,
// never recomputed from the product's rate -- a rate can change after
// an order settles, and the order's own figure is what was actually
// paid).
function creatorDashboard(store, creatorId) {
  const links = store.affiliateLinks.filter((l) => l.creatorId === creatorId);
  const linkIds = new Set(links.map((l) => l.id));
  const earningOrders = store.orders.filter((o) => o.affiliateLinkId !== null && linkIds.has(o.affiliateLinkId));

  const totalClicks = links.reduce((sum, l) => sum + l.clicksCount, 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversionsCount, 0);
  const totalCommissionEarned = round(earningOrders.reduce((sum, o) => sum + o.affiliateCommission, 0));

  const byLink = links.map((link) => {
    const linkOrders = earningOrders.filter((o) => o.affiliateLinkId === link.id);
    return {
      linkId: link.id,
      productId: link.productId,
      clicksCount: link.clicksCount,
      conversionsCount: link.conversionsCount,
      // A real rate, not assumed -- zero clicks is "unknown," not "0%,"
      // the same "unmeasured is not a measured zero" rule this whole
      // registry's sibling projects already hold (see VACON-C's own
      // `dominantShareOf`/`diversityOf`).
      conversionRate: link.clicksCount > 0 ? round(link.conversionsCount / link.clicksCount) : null,
      commissionEarned: round(linkOrders.reduce((sum, o) => sum + o.affiliateCommission, 0)),
    };
  }).sort((a, b) => b.commissionEarned - a.commissionEarned);

  return {
    creatorId,
    linkCount: links.length,
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? round(totalConversions / totalClicks) : null,
    totalCommissionEarned,
    byLink,
    topLink: byLink[0] ?? null,
  };
}

// A seller's own real storefront performance: every completed order
// against one of their products, real revenue, real platform fees
// paid, and the real share of sales that came through an affiliate
// (the one number that tells a seller whether the affiliate program
// is actually moving product for them).
function sellerDashboard(store, sellerId) {
  const sellerOrders = store.orders.filter((o) => o.sellerId === sellerId);
  const totalRevenue = round(sellerOrders.reduce((sum, o) => sum + o.sellerPayout, 0));
  const totalPlatformFees = round(sellerOrders.reduce((sum, o) => sum + o.platformFee, 0));
  const affiliateOrders = sellerOrders.filter((o) => o.affiliateLinkId !== null);
  const totalAffiliateCommissionPaid = round(sellerOrders.reduce((sum, o) => sum + o.affiliateCommission, 0));

  const byProduct = {};
  for (const order of sellerOrders) {
    if (!byProduct[order.productId]) byProduct[order.productId] = { productId: order.productId, orderCount: 0, revenue: 0 };
    byProduct[order.productId].orderCount += 1;
    byProduct[order.productId].revenue += order.sellerPayout;
  }
  const topProducts = Object.values(byProduct)
    .map((p) => ({ ...p, revenue: round(p.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    sellerId,
    orderCount: sellerOrders.length,
    totalRevenue,
    totalPlatformFees,
    totalAffiliateCommissionPaid,
    affiliateOrderCount: affiliateOrders.length,
    // Unknown (null) with no orders at all -- a seller with zero sales
    // has no real affiliate SHARE to report, which is a different fact
    // from a real, measured 0%.
    affiliateOrderShare: sellerOrders.length > 0 ? round(affiliateOrders.length / sellerOrders.length) : null,
    topProducts,
  };
}

// Real product discovery: every listed product ranked by real,
// completed-order signal -- not personalized, not an invented
// popularity score, and said so in the header above.
function trendingProducts(store, { limit = 10 } = {}) {
  const byProduct = {};
  for (const order of store.orders) {
    if (!byProduct[order.productId]) byProduct[order.productId] = { productId: order.productId, orderCount: 0, revenue: 0 };
    byProduct[order.productId].orderCount += 1;
    byProduct[order.productId].revenue += order.price;
  }
  return Object.values(byProduct)
    .map((p) => {
      const product = getProduct(store, p.productId);
      return { ...p, revenue: round(p.revenue), product: product ?? null };
    })
    // A product that was deleted/unlisted after being ordered is real
    // sales history, not a product to recommend browsing to today --
    // excluded from discovery, not from the raw count.
    .filter((p) => p.product !== null)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { creatorDashboard, sellerDashboard, trendingProducts };
