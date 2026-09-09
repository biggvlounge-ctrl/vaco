// VOKEN — peer-to-peer Trading.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: "real, direct
// peer-to-peer trading between users -- a fundamental, expected
// feature for any genuine card-collecting platform." Real ownership
// verification before any swap happens -- both sides of a proposed
// trade are checked against actual current edition ownership at
// accept time, not just trusted from the proposal.

const { getCultureCard, transferEditionOwnership } = require('./cultureCards');

const TRADE_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'];

function validateItems(store, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('a trade requires at least one item on each side');
  }
  for (const item of items) {
    if (!getCultureCard(store, item.cardId)) {
      throw new Error(`no card with id ${item.cardId}`);
    }
    if (!Number.isInteger(item.editionNumber) || item.editionNumber < 1) {
      throw new Error('every trade item requires a positive integer editionNumber');
    }
    if (item.format !== 'digital' && item.format !== 'physical') {
      throw new Error('every trade item requires format "digital" or "physical"');
    }
  }
}

function proposeTrade(store, options = {}) {
  const { fromUserId, toUserId, cardIdsOffered = [], cardIdsRequested = [] } = options;
  if (!fromUserId) throw new Error('proposeTrade requires a fromUserId');
  if (!toUserId) throw new Error('proposeTrade requires a toUserId');
  validateItems(store, cardIdsOffered);
  validateItems(store, cardIdsRequested);

  const trade = {
    tradeId: store.nextTradeId++,
    fromUserId,
    toUserId,
    cardIdsOffered,
    cardIdsRequested,
    status: 'pending',
    createdAt: Date.now(),
  };
  store.trades.push(trade);
  return trade;
}

function getTrade(store, tradeId) {
  return store.trades.find((t) => t.tradeId === tradeId) || null;
}

function findEdition(card, editionNumber, format) {
  return card.editions.find((e) => e.editionNumber === editionNumber && e.format === format);
}

// The real check: every offered item must genuinely still belong to
// fromUserId, and every requested item to toUserId, at accept time --
// not just when the trade was first proposed.
function acceptTrade(store, options = {}) {
  const { tradeId } = options;
  const trade = getTrade(store, tradeId);
  if (!trade) throw new Error(`acceptTrade: no trade with id ${tradeId}`);
  if (trade.status !== 'pending') {
    throw new Error(`acceptTrade: trade ${tradeId} is "${trade.status}", not pending`);
  }

  for (const item of trade.cardIdsOffered) {
    const card = getCultureCard(store, item.cardId);
    const edition = findEdition(card, item.editionNumber, item.format);
    if (!edition || edition.ownerId !== trade.fromUserId) {
      throw new Error(`acceptTrade: fromUserId no longer owns offered card ${item.cardId} edition ${item.editionNumber} (${item.format})`);
    }
  }
  for (const item of trade.cardIdsRequested) {
    const card = getCultureCard(store, item.cardId);
    const edition = findEdition(card, item.editionNumber, item.format);
    if (!edition || edition.ownerId !== trade.toUserId) {
      throw new Error(`acceptTrade: toUserId no longer owns requested card ${item.cardId} edition ${item.editionNumber} (${item.format})`);
    }
  }

  for (const item of trade.cardIdsOffered) {
    transferEditionOwnership(store, { cardId: item.cardId, editionNumber: item.editionNumber, format: item.format, fromOwnerId: trade.fromUserId, toOwnerId: trade.toUserId });
  }
  for (const item of trade.cardIdsRequested) {
    transferEditionOwnership(store, { cardId: item.cardId, editionNumber: item.editionNumber, format: item.format, fromOwnerId: trade.toUserId, toOwnerId: trade.fromUserId });
  }

  trade.status = 'accepted';
  return trade;
}

function rejectTrade(store, tradeId) {
  const trade = getTrade(store, tradeId);
  if (!trade) throw new Error(`rejectTrade: no trade with id ${tradeId}`);
  if (trade.status !== 'pending') {
    throw new Error(`rejectTrade: trade ${tradeId} is "${trade.status}", not pending`);
  }
  trade.status = 'rejected';
  return trade;
}

function cancelTrade(store, options = {}) {
  const { tradeId, requestedByUserId } = options;
  const trade = getTrade(store, tradeId);
  if (!trade) throw new Error(`cancelTrade: no trade with id ${tradeId}`);
  if (trade.status !== 'pending') {
    throw new Error(`cancelTrade: trade ${tradeId} is "${trade.status}", not pending`);
  }
  if (requestedByUserId !== trade.fromUserId) {
    throw new Error('cancelTrade: only the proposer can cancel a pending trade');
  }
  trade.status = 'cancelled';
  return trade;
}

module.exports = { TRADE_STATUSES, proposeTrade, getTrade, acceptTrade, rejectTrade, cancelTrade };
