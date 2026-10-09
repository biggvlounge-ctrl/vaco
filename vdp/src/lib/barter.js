// VDP — Barter: direct trade of exotic, smuggled old-world goods.
//
// Per direct instruction (9 Oct 2026): "this is also where the barter
// system comes into play, because people will also want things from
// the old world that are exotic, that are being smuggled in. So we
// need to do an inventory and things like that as well." A real,
// separate ledger from V3's VCoin on purpose -- barter is explicitly
// an item-for-item trade, not a priced sale; `proposeTrade`/
// `acceptTrade` never touch a `transferFn` at all, unlike every other
// money-moving module in this directory.
//
// `itemName` is free text, same discipline as `immigration.js`'s own
// `smuggledGoods` -- a smuggled item this app actually knows about is
// whatever a migrant's own arrival record already names
// (`seedFromSmuggledGoods` below reads that real list rather than a
// second invented catalog), not a closed enum this module invents.

export function createBarterStore() {
  return { inventories: {}, trades: [], nextTradeId: 1 };
}

function inventoryOf(store, entityId) {
  if (!store.inventories[entityId]) store.inventories[entityId] = {};
  return store.inventories[entityId];
}

export function inventoryFor(store, entityId) {
  return { ...(store.inventories[entityId] || {}) };
}

export function addExoticGood(store, entityId, itemName, quantity = 1) {
  if (!entityId) throw new Error('addExoticGood requires an entityId');
  if (!itemName) throw new Error('addExoticGood requires an itemName');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('addExoticGood requires a positive integer quantity');
  const inventory = inventoryOf(store, entityId);
  inventory[itemName] = (inventory[itemName] || 0) + quantity;
  return inventoryFor(store, entityId);
}

export function removeExoticGood(store, entityId, itemName, quantity = 1) {
  const inventory = inventoryOf(store, entityId);
  const have = inventory[itemName] || 0;
  if (have < quantity) {
    throw new Error(`removeExoticGood: "${entityId}" only has ${have} "${itemName}", not ${quantity}`);
  }
  inventory[itemName] = have - quantity;
  return inventoryFor(store, entityId);
}

// The real link to where an exotic good actually comes from --
// `immigration.js`'s own real `smuggledGoods` list on an arrival,
// passed in by the caller rather than imported, the same
// decoupled-by-injection shape every cross-module call in this
// directory already uses. One unit per real named good smuggled in.
export function seedFromSmuggledGoods(store, entityId, smuggledGoods = []) {
  for (const itemName of smuggledGoods) {
    addExoticGood(store, entityId, itemName, 1);
  }
  return inventoryFor(store, entityId);
}

function requireHas(store, entityId, items, fnName) {
  const inventory = inventoryOf(store, entityId);
  for (const { itemName, quantity } of items) {
    if ((inventory[itemName] || 0) < quantity) {
      throw new Error(`${fnName}: "${entityId}" does not have ${quantity} "${itemName}" to offer`);
    }
  }
}

// A real, two-sided proposal -- `offer`/`request` are each a list of
// `{ itemName, quantity }`, checked for real at propose time (an
// empty-handed proposal is refused outright) and checked AGAIN at
// accept time (either side's inventory may have genuinely changed in
// between), never assumed still true.
export function proposeTrade(store, { fromId, toId, offer = [], request = [], now = Date.now() } = {}) {
  if (!fromId) throw new Error('proposeTrade requires a fromId');
  if (!toId) throw new Error('proposeTrade requires a toId');
  if (offer.length === 0 || request.length === 0) {
    throw new Error('proposeTrade requires at least one real item on each side');
  }
  requireHas(store, fromId, offer, 'proposeTrade');

  const trade = {
    id: store.nextTradeId++,
    fromId,
    toId,
    offer: [...offer],
    request: [...request],
    status: 'open',
    proposedAt: now,
    resolvedAt: null,
  };
  store.trades.push(trade);
  return trade;
}

// Real claim-before-pay ordering, same discipline every other
// settlement in this app already uses: the trade is claimed
// `accepted` before either side's inventory is touched, so a crash
// mid-swap cannot be retried into a double trade.
export function acceptTrade(store, tradeId, { now = Date.now() } = {}) {
  const trade = store.trades.find((t) => t.id === tradeId);
  if (!trade) throw new Error(`acceptTrade: no trade #${tradeId}`);
  if (trade.status !== 'open') throw new Error(`acceptTrade: trade #${tradeId} is not open (status: ${trade.status})`);
  requireHas(store, trade.fromId, trade.offer, 'acceptTrade');
  requireHas(store, trade.toId, trade.request, 'acceptTrade');

  trade.status = 'accepted';
  trade.resolvedAt = now;

  for (const { itemName, quantity } of trade.offer) {
    removeExoticGood(store, trade.fromId, itemName, quantity);
    addExoticGood(store, trade.toId, itemName, quantity);
  }
  for (const { itemName, quantity } of trade.request) {
    removeExoticGood(store, trade.toId, itemName, quantity);
    addExoticGood(store, trade.fromId, itemName, quantity);
  }
  return trade;
}

export function cancelTrade(store, tradeId, { now = Date.now() } = {}) {
  const trade = store.trades.find((t) => t.id === tradeId);
  if (!trade) throw new Error(`cancelTrade: no trade #${tradeId}`);
  if (trade.status !== 'open') throw new Error(`cancelTrade: trade #${tradeId} is not open (status: ${trade.status})`);
  trade.status = 'cancelled';
  trade.resolvedAt = now;
  return trade;
}

export function listOpenTrades(store) {
  return store.trades.filter((t) => t.status === 'open');
}

export function tradesInvolving(store, entityId) {
  return store.trades.filter((t) => t.fromId === entityId || t.toId === entityId);
}
