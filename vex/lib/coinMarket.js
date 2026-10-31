// VEX -- VXC, a new tradeable digital coin, deliberately separate
// from VCoin.
//
// **Why a new coin, and why not just let VCoin float.** VCoin is
// documented elsewhere (v3/VASH_BAAS_VCOIN_ADVANCEMENT.md) as a
// deliberately stable, auditable unit of account -- the thing every
// other app already prices real goods and services in. Letting VCoin
// itself swing on trade flow would undo that stability for every app
// that settles through it, not just this one. VXC is a second,
// independent asset that trades FOR VCoin (VCoin is this market's
// quote currency, the way USD quotes BTC on a real exchange) and
// moves on its own, leaving VCoin's own peg untouched.
//
// **Why this needs its own pricing mechanism at all.** VOKEN's
// Cvltvre Cards get a real market-relative price from an external
// signal -- each card's own real-world fame score, read against every
// other card's score (lib/cardMarketPrice.js). VXC has no such
// external signal: it is not a record of anyone's real-world
// standing, so there is nothing outside this market to price it
// against. Its price has to come from trading itself.
//
// **The mechanism: a constant-product automated market maker.** The
// same real, well-understood design real decentralized exchanges use
// (Uniswap's x*y=k): a platform-held pool holds some VXC and some
// VCoin; price is simply vcoinReserve / coinReserve; every trade moves
// both reserves so that their product stays constant, and a larger
// trade moves its own price more (real slippage) -- not a quoted,
// static price per unit. This is deliberately NOT the order-matching
// a real stock exchange or Vex's own card brokerage (lib/brokerage.js)
// does: there is no peer-to-peer limit order book here, trades settle
// against the pool the same way Vex's card trades already settle
// against VEX_PLATFORM_ACCOUNT, not against another user directly.
//
// **Every constant below is a flagged, deterministic, invented
// seed -- never a claim about what VXC "should" be worth.** No source
// document specifies one; the same discipline every other invented
// constant in this session already carries.

const { isComplianceCleared } = require('./complianceGate');

const COIN_SYMBOL = 'VXC';
const ORDER_TYPES = ['buy', 'sell'];
const VEX_PLATFORM_ACCOUNT = 'vex-platform';

// Seed liquidity: 1,000,000 VXC against 10,000 VCoin, so VXC opens at
// 0.01 VCoin each. Round, invented, not sourced from anywhere.
const INITIAL_COIN_RESERVE = 1_000_000;
const INITIAL_VCOIN_RESERVE = 10_000;

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function getCoinPrice(store) {
  const { coinReserve, vcoinReserve } = store.coinMarket;
  return round6(vcoinReserve / coinReserve);
}

function getCoinHolding(store, userId) {
  return store.coinHoldings[userId] || 0;
}

function getCoinOrder(store, orderId) {
  return store.coinOrders.find((o) => o.id === orderId) || null;
}

// Buy: caller names how much VXC they want OUT of the pool.
// Sell: caller names how much VXC they are putting IN to the pool.
// Either way the OTHER side (how much VCoin moves) is computed from
// the constant-product invariant, not quoted up front -- this is the
// real source of slippage: a large order moves its own price.
function quoteCoinTrade(store, orderType, coinAmount) {
  const { coinReserve, vcoinReserve } = store.coinMarket;
  const k = coinReserve * vcoinReserve;

  if (orderType === 'buy') {
    if (coinAmount >= coinReserve) {
      throw new Error(`quoteCoinTrade: the pool only holds ${coinReserve} ${COIN_SYMBOL}, cannot buy ${coinAmount}`);
    }
    const newCoinReserve = coinReserve - coinAmount;
    const newVcoinReserve = k / newCoinReserve;
    const vcoinAmount = round2(newVcoinReserve - vcoinReserve);
    return { vcoinAmount, newCoinReserve, newVcoinReserve };
  }

  // sell
  const newCoinReserve = coinReserve + coinAmount;
  const newVcoinReserve = k / newCoinReserve;
  const vcoinAmount = round2(vcoinReserve - newVcoinReserve);
  return { vcoinAmount, newCoinReserve, newVcoinReserve };
}

async function placeCoinOrder(store, options = {}) {
  const { accountId, userId, orderType, coinAmount, settleFn } = options;

  if (!isComplianceCleared(store, 'vex-coin-trading')) {
    throw new Error('placeCoinOrder: VXC trading is held pending real compliance review -- not cleared to move money yet');
  }
  if (!userId) throw new Error('placeCoinOrder requires a userId');
  if (!ORDER_TYPES.includes(orderType)) {
    throw new Error(`placeCoinOrder: invalid orderType "${orderType}" (expected one of ${ORDER_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    throw new Error('placeCoinOrder requires a positive coinAmount');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('placeCoinOrder requires a settleFn(legs, meta)');
  }

  const roundedCoinAmount = round6(coinAmount);

  // Refused, never partly applied: a sell with insufficient real VXC
  // on hand is rejected before anything -- reserves, holdings, money --
  // moves, the same discipline this ecosystem's other packs/orders
  // hold themselves to.
  if (orderType === 'sell') {
    const held = getCoinHolding(store, userId);
    if (held < roundedCoinAmount) {
      throw new Error(`placeCoinOrder: holder owns only ${held} ${COIN_SYMBOL}, cannot sell ${roundedCoinAmount}`);
    }
  }

  const { vcoinAmount, newCoinReserve, newVcoinReserve } = quoteCoinTrade(store, orderType, roundedCoinAmount);

  const orderId = store.nextCoinOrderId++;
  // Scoped by this order's own id for the same reason brokerage.js's
  // card orders are: two distinct orders at the same shape (same
  // direction, same coinAmount, ordinary repeat trades at a live
  // price) must never fingerprint identically to V3's settlement
  // idempotency key, or the second trade replays the first's result
  // without moving new money while this function has already moved
  // the pool and the holder's balance for it.
  const reason = `vex_coin_${orderType}:${COIN_SYMBOL}:${orderId}`;

  if (orderType === 'buy') {
    await settleFn(
      [{ fromUserId: userId, toUserId: VEX_PLATFORM_ACCOUNT, amount: vcoinAmount, reason }],
      { reason },
    );
    store.coinMarket.coinReserve = round6(newCoinReserve);
    store.coinMarket.vcoinReserve = round2(newVcoinReserve);
    store.coinHoldings[userId] = round6(getCoinHolding(store, userId) + roundedCoinAmount);
  } else {
    store.coinHoldings[userId] = round6(getCoinHolding(store, userId) - roundedCoinAmount);
    store.coinMarket.coinReserve = round6(newCoinReserve);
    store.coinMarket.vcoinReserve = round2(newVcoinReserve);
    await settleFn(
      [{ fromUserId: VEX_PLATFORM_ACCOUNT, toUserId: userId, amount: vcoinAmount, reason }],
      { reason },
    );
  }

  const order = {
    id: orderId,
    accountId,
    userId,
    symbol: COIN_SYMBOL,
    orderType,
    coinAmount: roundedCoinAmount,
    vcoinAmount,
    priceAfter: getCoinPrice(store),
    status: 'filled',
    createdAt: Date.now(),
  };
  store.coinOrders.push(order);
  return order;
}

module.exports = {
  COIN_SYMBOL,
  ORDER_TYPES,
  VEX_PLATFORM_ACCOUNT,
  INITIAL_COIN_RESERVE,
  INITIAL_VCOIN_RESERVE,
  getCoinPrice,
  getCoinHolding,
  getCoinOrder,
  quoteCoinTrade,
  placeCoinOrder,
};
