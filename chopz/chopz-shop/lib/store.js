// CHOPZ SHOP -- shared, growing store object. Its own separate app,
// its own separate store -- CHOPZ's own video state lives in the
// sibling `chopz/lib/store.js`, not here.

function createChopzShopStore() {
  return {
    products: [],
    nextProductId: 1,
    affiliateLinks: [],
    nextAffiliateLinkId: 1,
    affiliateClicks: [],
    orders: [],
    nextOrderId: 1,
  };
}

module.exports = { createChopzShopStore };
