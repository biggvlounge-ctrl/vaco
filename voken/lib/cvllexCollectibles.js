// VOKEN — the real filter on a creator's CVLLEX production orders
// before they're shown as "collectibles" anywhere on a card's page.
//
// **Real bug this closes.** `fetchRealCreatorCollectibles()` in
// `server.js` used to return every real order CVLLEX had on file for
// a creator, including ones still `ordered` or `in-production`, even
// `cancelled` ones (see CVLLEX's own `PRODUCTION_ORDER_STATUSES` in
// `../cvllex/lib/physicalProduction.js`). Showing an order that
// hasn't actually shipped as a real "collectible" to sell or promote
// is a genuine false claim about something that doesn't exist yet —
// only a real, finished `produced` order is a real collectible.
//
// Kept as its own pure function (not inlined in the fetch wrapper)
// so the real business rule — what counts as a shown collectible —
// is directly testable with no network mock, the same split
// `cardFullDetail.js` already uses for its own injected fetch.
function filterProducedOrders(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.filter((o) => o.status === 'produced');
}

module.exports = { filterProducedOrders };
