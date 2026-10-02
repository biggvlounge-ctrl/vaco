// VEX -- Robinhood-style Cvltvre Card trading, extracted from VOKEN's
// own lib/vex.js (Phase 4 there). Same real net-capital model
// ("introducing-broker"), same real broker-dealer compliance gate,
// same real mechanic: a buy mints/acquires `quantity` real digital
// editions for the account's owner, paying the real platform account;
// a sell requires the account to genuinely already hold `quantity`
// editions, transferring them to the platform and paying the account.
//
// The one real change from the in-process version: card reads/writes
// now go through vokenClient.js's real HTTP calls into VOKEN (Cvltvre
// Cards stay VOKEN's own product), so this module's card operations
// are async where the original wasn't.

const { getCultureCard, mintAdditionalEdition, transferEditionOwnership } = require('./vokenClient');
const { isComplianceCleared } = require('./complianceGate');

const NET_CAPITAL_MODELS = ['introducing-broker'];
const ORDER_TYPES = ['buy', 'sell'];
const ORDER_STATUSES = ['filled'];
const VEX_PLATFORM_ACCOUNT = 'vex-platform';

function round(n) {
  return Math.round(n * 100) / 100;
}

function openBrokerAccount(store, options = {}) {
  const { userId, netCapitalModel = 'introducing-broker' } = options;
  if (!userId) throw new Error('openBrokerAccount requires a userId');
  if (!NET_CAPITAL_MODELS.includes(netCapitalModel)) {
    throw new Error(`openBrokerAccount: invalid netCapitalModel "${netCapitalModel}" (expected one of ${NET_CAPITAL_MODELS.join(', ')})`);
  }
  const account = { id: store.nextBrokerAccountId++, userId, netCapitalModel, createdAt: Date.now() };
  store.brokerAccounts.push(account);
  return account;
}

function getBrokerAccount(store, accountId) {
  return store.brokerAccounts.find((a) => a.id === accountId) || null;
}

async function placeTradeOrder(store, options = {}) {
  const { accountId, cardId, orderType, quantity, pricePerUnit, settleFn } = options;

  if (!isComplianceCleared(store, 'vex-brokerage')) {
    throw new Error('placeTradeOrder: VEX brokerage trading is held pending real broker-dealer compliance review -- not cleared to move money yet');
  }

  const account = getBrokerAccount(store, accountId);
  if (!account) throw new Error(`placeTradeOrder: no broker account with id ${accountId}`);
  const card = await getCultureCard(cardId);
  if (!card) throw new Error(`placeTradeOrder: no card with id ${cardId}`);
  if (!ORDER_TYPES.includes(orderType)) {
    throw new Error(`placeTradeOrder: invalid orderType "${orderType}" (expected one of ${ORDER_TYPES.join(', ')})`);
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('placeTradeOrder requires a positive integer quantity');
  }
  // Number.isFinite rather than `typeof === 'number'`: NaN satisfies
  // the typeof check and fails `<= 0`, so a NaN price used to walk
  // through this guard, produce `totalAmount = NaN`, and be handed to
  // the ledger. V3 had the same hole and now refuses it too — but a
  // brokerage should not be relying on its ledger to catch a price it
  // never validated. Refuse it before the order exists.
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    throw new Error('placeTradeOrder requires a positive pricePerUnit');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('placeTradeOrder requires a settleFn(legs, meta)');
  }

  const totalAmount = round(quantity * pricePerUnit);

  // Reserved before settlement, not assigned after, so the settlement
  // reason below can carry it. The reason doubles as V3's idempotency
  // key (see server.js's settleVCoin) -- without a per-order component
  // it was only `vex_buy:${cardId}` / `vex_sell:${cardId}`, so two
  // genuinely distinct orders for the same card, direction, quantity
  // and price (an ordinary repeat trade at a stable market price)
  // fingerprinted identically. V3 replayed the first settlement's
  // cached success for the second order without moving any new money,
  // and this function doesn't look at the settlement result -- it
  // mints editions (or releases them to the platform on a sell)
  // unconditionally once settleFn resolves. A buyer could place the
  // same-shaped buy order repeatedly and receive a free mint on every
  // order after the first; the mirror sell gave away a real edition
  // for a payout that was a stale replay. Scoping the reason by this
  // order's own id makes every order's key unique by construction.
  const orderId = store.nextTradeOrderId++;

  if (orderType === 'buy') {
    await settleFn(
      [{ fromUserId: account.userId, toUserId: VEX_PLATFORM_ACCOUNT, amount: totalAmount, reason: `vex_buy:${cardId}:${orderId}` }],
      { reason: `vex_buy:${cardId}:${orderId}` },
    );
    for (let i = 0; i < quantity; i++) {
      await mintAdditionalEdition({ cardId, format: 'digital', ownerId: account.userId });
    }
  } else {
    const ownedEditions = card.editions.filter((e) => e.format === 'digital' && e.ownerId === account.userId);
    if (ownedEditions.length < quantity) {
      throw new Error(`placeTradeOrder: account ${accountId} owns only ${ownedEditions.length} digital editions of card ${cardId}, cannot sell ${quantity}`);
    }
    for (let i = 0; i < quantity; i++) {
      await transferEditionOwnership({
        cardId, editionNumber: ownedEditions[i].editionNumber, format: 'digital',
        fromOwnerId: account.userId, toOwnerId: VEX_PLATFORM_ACCOUNT,
      });
    }
    await settleFn(
      [{ fromUserId: VEX_PLATFORM_ACCOUNT, toUserId: account.userId, amount: totalAmount, reason: `vex_sell:${cardId}:${orderId}` }],
      { reason: `vex_sell:${cardId}:${orderId}` },
    );
  }

  const order = {
    id: orderId, accountId, cardId, orderType, quantity, pricePerUnit, totalAmount,
    status: 'filled', createdAt: Date.now(),
  };
  store.tradeOrders.push(order);
  return order;
}

function getTradeOrder(store, orderId) {
  return store.tradeOrders.find((o) => o.id === orderId) || null;
}

module.exports = {
  NET_CAPITAL_MODELS,
  ORDER_TYPES,
  ORDER_STATUSES,
  VEX_PLATFORM_ACCOUNT,
  openBrokerAccount,
  getBrokerAccount,
  placeTradeOrder,
  getTradeOrder,
};
