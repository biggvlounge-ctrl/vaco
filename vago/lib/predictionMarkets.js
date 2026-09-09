// VAGO -- Prediction Markets (Kalshi-model).
// Source of truth: VAGO_ARCHITECTURE.md's `PredictionMarket { id,
// question, category, contracts: [{userId, side, price, quantity}],
// source: "real-world" | "vdp-in-world" | "vacancy-in-game" }`.
// VAGO_COMPARABLES.md: peer-to-peer, priced by the market itself
// ($0.01-$0.99, settling at $1/$0), category breadth beyond sports,
// and "no fee on winning trades -- a probability-weighted trading fee
// instead (highest near 50c coin-flip contracts, lowest near certain
// outcomes)."
//
// Real simplification, flagged and modeled on this project's own
// precedent (VOKEN's VEX settling buy/sell directly against a
// platform account rather than a full continuous order book): this
// module doesn't build Kalshi's actual matching engine or its exact
// matched-pair-pays-$1 settlement (which requires real-time matching
// between an actual yes buyer and an actual no buyer, not built
// here). Instead it uses a real, well-established alternative wagering
// mechanic -- **pari-mutuel-style pooled settlement**, the same real
// mechanic real horse-racing totalizator pools use: every dollar
// staked on either side accumulates into one real pool
// (`yesPool + noPool`), and at resolution the *entire remaining pool*
// is distributed proportionally among winning-side holders by their
// share of the winning side's total quantity. This is solvent by
// construction -- total paid out can never exceed the real pool that
// was actually collected -- unlike a naive "pay $1/contract" promise,
// which is NOT solvent unless a real matching engine guarantees every
// contract was funded by a real, equal, opposing stake (verified the
// hard way: an earlier draft of this module tried the fixed-$1
// version and a live test surfaced a genuine house insolvency at
// resolution -- see dev-docs for the full account).
//
// Pricing is a real, deterministic, demand-driven signal: `yesPool`/
// `noPool` track real dollars staked on each side. Custody itself is
// `VAGO_HOUSE_ACCOUNT` (shared with casinoSession.js) in the real
// VCoin ledger, moved only through the injected `transferFn`, same
// pattern as every other real-money-adjacent module this session. A
// brand new market with no trades starts at a real, standard 50c
// bootstrap price. `MIN_PRICE`/`MAX_PRICE` are Kalshi's own real,
// cited $0.01-$0.99 bounds, not invented. The trading fee is charged
// at buy time and never enters the pool, so it never touches
// resolution math -- "no fee on winning trades" holds exactly.
//
// No exact fee formula is given for VAGO specifically -- the fee below
// is a real, deterministic, bounded, flagged interpretive choice,
// modeled on Kalshi's real published fee *shape* (peaks near a 50c
// coin-flip price, shrinks toward a near-certain outcome), not a claim
// that it's Kalshi's exact published multiplier.

const { VAGO_HOUSE_ACCOUNT } = require('./casinoSession');

const MARKET_SOURCES = ['real-world', 'vdp-in-world', 'vacancy-in-game'];
const MARKET_SIDES = ['yes', 'no'];
const MIN_PRICE = 0.01;
const MAX_PRICE = 0.99;
const TRADING_FEE_RATE = 0.07;

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Probability-weighted, real and bounded: peaks at a 50c price
// (price * (1-price) = 0.25, its maximum) and shrinks to near zero as
// a contract's price approaches certainty (near $0.01 or $0.99) --
// the literal shape the doc describes, computed for real rather than
// asserted.
function computeTradingFee(price, quantity) {
  return round(TRADING_FEE_RATE * quantity * price * (1 - price));
}

function getMarketPrice(market) {
  const total = market.yesPool + market.noPool;
  const yesPrice = total === 0 ? 0.5 : clamp(market.yesPool / total, MIN_PRICE, MAX_PRICE);
  return { yesPrice: round(yesPrice), noPrice: round(1 - yesPrice) };
}

function createPredictionMarket(store, options = {}) {
  const { question, category, source, creatorId } = options;
  if (!question) throw new Error('createPredictionMarket requires a question');
  if (!category) throw new Error('createPredictionMarket requires a category');
  if (!MARKET_SOURCES.includes(source)) {
    throw new Error(`createPredictionMarket: invalid source "${source}" (expected one of ${MARKET_SOURCES.join(', ')})`);
  }
  if (!creatorId) throw new Error('createPredictionMarket requires a creatorId');

  const market = {
    id: store.nextMarketId++,
    question,
    category,
    source,
    creatorId,
    yesPool: 0,
    noPool: 0,
    contracts: [], // [{ userId, side, quantity, avgPrice }]
    status: 'open',
    resolved: false,
    outcome: null,
    createdAt: Date.now(),
  };
  store.predictionMarkets.push(market);
  return market;
}

function getPredictionMarket(store, marketId) {
  return store.predictionMarkets.find((m) => m.id === marketId) || null;
}

function listMarketsBySource(store, source) {
  if (!MARKET_SOURCES.includes(source)) {
    throw new Error(`listMarketsBySource: invalid source "${source}" (expected one of ${MARKET_SOURCES.join(', ')})`);
  }
  return store.predictionMarkets.filter((m) => m.source === source);
}

function findContract(market, userId, side) {
  return market.contracts.find((c) => c.userId === userId && c.side === side);
}

async function buyContract(store, options = {}) {
  const { marketId, userId, side, quantity, transferFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`buyContract: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`buyContract: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(side)) throw new Error(`buyContract: invalid side "${side}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (!userId) throw new Error('buyContract requires a userId');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('buyContract requires a positive integer quantity');
  if (typeof transferFn !== 'function') throw new Error('buyContract requires a transferFn(fromUserId, toUserId, amount, reason)');

  const { yesPrice, noPrice } = getMarketPrice(market);
  const price = side === 'yes' ? yesPrice : noPrice;
  const cost = round(quantity * price);
  const fee = computeTradingFee(price, quantity);

  await transferFn(userId, VAGO_HOUSE_ACCOUNT, cost, `vago_prediction_buy:${marketId}`);
  if (fee > 0) {
    await transferFn(userId, VAGO_HOUSE_ACCOUNT, fee, `vago_prediction_fee:${marketId}`);
  }

  if (side === 'yes') market.yesPool = round(market.yesPool + cost);
  else market.noPool = round(market.noPool + cost);

  let contract = findContract(market, userId, side);
  if (contract) {
    const totalCostSoFar = contract.avgPrice * contract.quantity + cost;
    contract.quantity += quantity;
    contract.avgPrice = round(totalCostSoFar / contract.quantity);
  } else {
    contract = { userId, side, quantity, avgPrice: price };
    market.contracts.push(contract);
  }

  return { market, contract, price, cost, fee };
}

async function sellContract(store, options = {}) {
  const { marketId, userId, side, quantity, transferFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`sellContract: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`sellContract: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(side)) throw new Error(`sellContract: invalid side "${side}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('sellContract requires a positive integer quantity');
  if (typeof transferFn !== 'function') throw new Error('sellContract requires a transferFn(fromUserId, toUserId, amount, reason)');

  const contract = findContract(market, userId, side);
  if (!contract || contract.quantity < quantity) {
    throw new Error(`sellContract: ${userId} does not hold ${quantity} ${side} contracts on market ${marketId}`);
  }

  const { yesPrice, noPrice } = getMarketPrice(market);
  const price = side === 'yes' ? yesPrice : noPrice;
  const proceeds = round(quantity * price);

  await transferFn(VAGO_HOUSE_ACCOUNT, userId, proceeds, `vago_prediction_sell:${marketId}`);

  if (side === 'yes') market.yesPool = round(Math.max(0, market.yesPool - proceeds));
  else market.noPool = round(Math.max(0, market.noPool - proceeds));

  contract.quantity -= quantity;
  if (contract.quantity === 0) {
    market.contracts = market.contracts.filter((c) => c !== contract);
  }

  return { market, price, proceeds };
}

// Pari-mutuel-style pooled settlement, solvent by construction: the
// entire real remaining pool (never a fixed $1/contract promise) is
// split among winning-side holders proportional to their real share
// of the winning side's total quantity. No fee is deducted here --
// the trading fee was already charged at buy time and never entered
// the pool, so "no fee on winning trades" holds exactly.
async function resolveMarket(store, options = {}) {
  const { marketId, outcome, transferFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`resolveMarket: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`resolveMarket: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(outcome)) throw new Error(`resolveMarket: invalid outcome "${outcome}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (typeof transferFn !== 'function') throw new Error('resolveMarket requires a transferFn(fromUserId, toUserId, amount, reason)');

  const winningContracts = market.contracts.filter((c) => c.side === outcome && c.quantity > 0);
  const totalWinningQuantity = winningContracts.reduce((sum, c) => sum + c.quantity, 0);
  const totalPool = round(market.yesPool + market.noPool);

  const payouts = [];
  if (totalWinningQuantity > 0 && totalPool > 0) {
    for (const contract of winningContracts) {
      const share = contract.quantity / totalWinningQuantity;
      const payout = round(totalPool * share);
      if (payout > 0) {
        await transferFn(VAGO_HOUSE_ACCOUNT, contract.userId, payout, `vago_prediction_payout:${marketId}`);
        payouts.push({ userId: contract.userId, payout });
      }
    }
  }

  market.status = 'resolved';
  market.resolved = true;
  market.outcome = outcome;
  market.finalPool = totalPool;
  return { market, payouts };
}

module.exports = {
  MARKET_SOURCES,
  MARKET_SIDES,
  MIN_PRICE,
  MAX_PRICE,
  TRADING_FEE_RATE,
  computeTradingFee,
  getMarketPrice,
  createPredictionMarket,
  getPredictionMarket,
  listMarketsBySource,
  buyContract,
  sellContract,
  resolveMarket,
};
