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
// VCoin ledger, moved only through the injected `settleFn`, same
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

// **Virtual liquidity, and the risk-free money pump it closes.**
//
// The price used to be `yesPool / (yesPool + noPool)`, bootstrapped at
// 50c when both pools were empty. That is correct at volume and badly
// wrong at zero, because the *first* trade in a market sets the price
// to an extreme on its own:
//
//   alice buys 10 yes at 0.50        -> pays 5, yesPool = 5, noPool = 0
//   price is now 5/5 = 1.00          -> clamped to 0.99
//   alice sells the same 10 at 0.99  -> receives 9.90
//
// Net: **+4.72 VCoin risk-free** after the fee, from a market with no
// other participant, repeatable until the house account is empty.
// Measured, not reasoned about. The pool clamps to zero, so the loss
// lands on the house rather than on another trader, which is how it
// stayed invisible.
//
// This is the same insolvency class the header above describes being
// fixed at resolution. It had simply moved to `sell`.
//
// The fix is a virtual stake `k` at the market's opening price, mixed
// into the *displayed* price only:
//
//   yes = (yesPool + k*p0) / (yesPool + noPool + k)
//
// A new market prices at p0. Real stake moves it from there, and its
// influence grows as real volume grows, so the first trade no longer
// swings the price to a bound. That is a Bayesian prior with `k` as
// its weight, and it is the standard answer to this cold-start shape.
//
// **`k` is virtual and must stay that way.** It never enters `yesPool`
// or `noPool`, so `resolveMarket` still distributes exactly the real
// stake collected and remains solvent by construction. Adding `k` to
// the pools instead would promise money nobody paid in — which is the
// original bug wearing a new hat.
const VIRTUAL_LIQUIDITY = 25;
const DEFAULT_OPENING_PRICE = 0.5;

function openingPriceOf(market) {
  // Markets created before opening prices existed carry none. 50c is
  // what they were bootstrapped at, so that is what they keep.
  const p = market.openingYesPrice;
  return Number.isFinite(p) ? clamp(p, MIN_PRICE, MAX_PRICE) : DEFAULT_OPENING_PRICE;
}

function getMarketPrice(market) {
  const k = VIRTUAL_LIQUIDITY;
  const p0 = openingPriceOf(market);
  const total = market.yesPool + market.noPool + k;
  const yesPrice = clamp((market.yesPool + k * p0) / total, MIN_PRICE, MAX_PRICE);
  return { yesPrice: round(yesPrice), noPrice: round(1 - yesPrice) };
}

// `openingYesPrice` is the market's starting probability, and the whole
// point of it is that somebody can supply one that is better than a
// coin flip. `sportsbook.js` derives it from the house line on the same
// event, so a paired market opens at the bookmaker's own number instead
// of at 50c on a game nobody thinks is even. Omit it and a market opens
// at 50c exactly as before.
//
// It is a *starting* price only. Real stake moves it immediately, and
// it never enters a pool, so it cannot affect what anybody is paid.
function createPredictionMarket(store, options = {}) {
  const { question, category, source, creatorId, openingYesPrice, linkedEventId } = options;
  if (!question) throw new Error('createPredictionMarket requires a question');
  if (!category) throw new Error('createPredictionMarket requires a category');
  if (!MARKET_SOURCES.includes(source)) {
    throw new Error(`createPredictionMarket: invalid source "${source}" (expected one of ${MARKET_SOURCES.join(', ')})`);
  }
  if (!creatorId) throw new Error('createPredictionMarket requires a creatorId');
  if (openingYesPrice !== undefined) {
    if (!Number.isFinite(openingYesPrice) || openingYesPrice < MIN_PRICE || openingYesPrice > MAX_PRICE) {
      throw new Error(`createPredictionMarket: openingYesPrice must be between ${MIN_PRICE} and ${MAX_PRICE}`);
    }
  }

  const market = {
    id: store.nextMarketId++,
    question,
    category,
    source,
    creatorId,
    openingYesPrice: openingYesPrice === undefined ? DEFAULT_OPENING_PRICE : round(openingYesPrice),
    // Set when this market was opened alongside a sportsbook event, so
    // the two can be shown together. Null for a standalone market.
    linkedEventId: linkedEventId || null,
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
  const { marketId, userId, side, quantity, settleFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`buyContract: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`buyContract: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(side)) throw new Error(`buyContract: invalid side "${side}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (!userId) throw new Error('buyContract requires a userId');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('buyContract requires a positive integer quantity');
  if (typeof settleFn !== 'function') throw new Error('buyContract requires a settleFn(legs, meta)');

  const { yesPrice, noPrice } = getMarketPrice(market);
  const price = side === 'yes' ? yesPrice : noPrice;
  const cost = round(quantity * price);
  const fee = computeTradingFee(price, quantity);

  // **One settlement, not two.** The cost and the trading fee both
  // leave the buyer's account, and the market pools and the contract
  // record below are only written after both. Split, the fee leg could
  // fail after the cost leg had moved -- the buyer paid and held
  // nothing, no pool grew, no contract existed -- and the retry charged
  // the cost a second time.
  //
  // They stay two legs rather than one netted movement because the buy
  // and the fee are separately auditable, which is the same rule every
  // other settlement in this ecosystem follows.
  const legs = [
    { fromUserId: userId, toUserId: VAGO_HOUSE_ACCOUNT, amount: cost, reason: `vago_prediction_buy:${marketId}` },
  ];
  if (fee > 0) {
    legs.push({ fromUserId: userId, toUserId: VAGO_HOUSE_ACCOUNT, amount: fee, reason: `vago_prediction_fee:${marketId}` });
  }
  await settleFn(legs, { reason: `vago_prediction_purchase:${marketId}:${userId}` });

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
  const { marketId, userId, side, quantity, settleFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`sellContract: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`sellContract: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(side)) throw new Error(`sellContract: invalid side "${side}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('sellContract requires a positive integer quantity');
  if (typeof settleFn !== 'function') throw new Error('sellContract requires a settleFn(legs, meta)');

  const contract = findContract(market, userId, side);
  if (!contract || contract.quantity < quantity) {
    throw new Error(`sellContract: ${userId} does not hold ${quantity} ${side} contracts on market ${marketId}`);
  }

  const { yesPrice, noPrice } = getMarketPrice(market);
  const price = side === 'yes' ? yesPrice : noPrice;

  // **A sell can never pay out more than that side's pool holds.**
  //
  // Virtual liquidity above stops the price swinging to a bound on the
  // first trade, which removes the large risk-free round trip. It does
  // not make the payout *bounded*, and an unbounded payout against a
  // finite pool is a house loss waiting for someone to find the right
  // sequence. `Math.max(0, pool - proceeds)` clamped the bookkeeping
  // while the money had already left — the pool read zero and the house
  // was simply short.
  //
  // So the proceeds are capped at the real stake on that side. Same
  // principle `resolveMarket` already follows: you can only ever pay
  // out what was actually collected. A seller asking for more than the
  // pool holds gets the pool, and the market says so rather than
  // quietly paying a different number than the price implies.
  const sidePool = side === 'yes' ? market.yesPool : market.noPool;
  const requested = round(quantity * price);
  const proceeds = round(Math.min(requested, sidePool));

  if (proceeds > 0) {
    await settleFn(
      [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: userId, amount: proceeds, reason: `vago_prediction_sell:${marketId}` }],
      { reason: `vago_prediction_sell:${marketId}` },
    );
  }

  if (side === 'yes') market.yesPool = round(Math.max(0, market.yesPool - proceeds));
  else market.noPool = round(Math.max(0, market.noPool - proceeds));

  contract.quantity -= quantity;
  if (contract.quantity === 0) {
    market.contracts = market.contracts.filter((c) => c !== contract);
  }

  return { market, price, proceeds, requested, capped: proceeds < requested };
}

// Pari-mutuel-style pooled settlement, solvent by construction: the
// entire real remaining pool (never a fixed $1/contract promise) is
// split among winning-side holders proportional to their real share
// of the winning side's total quantity. No fee is deducted here --
// the trading fee was already charged at buy time and never entered
// the pool, so "no fee on winning trades" holds exactly.
async function resolveMarket(store, options = {}) {
  const { marketId, outcome, settleFn } = options;
  const market = getPredictionMarket(store, marketId);
  if (!market) throw new Error(`resolveMarket: no market with id ${marketId}`);
  if (market.status !== 'open') throw new Error(`resolveMarket: market ${marketId} is not open (status: ${market.status})`);
  if (!MARKET_SIDES.includes(outcome)) throw new Error(`resolveMarket: invalid outcome "${outcome}" (expected one of ${MARKET_SIDES.join(', ')})`);
  if (typeof settleFn !== 'function') throw new Error('resolveMarket requires a settleFn(legs, meta)');

  const winningContracts = market.contracts.filter((c) => c.side === outcome && c.quantity > 0);
  const totalWinningQuantity = winningContracts.reduce((sum, c) => sum + c.quantity, 0);
  const totalPool = round(market.yesPool + market.noPool);

  const payouts = [];
  if (totalWinningQuantity > 0 && totalPool > 0) {
    for (const contract of winningContracts) {
      const share = contract.quantity / totalWinningQuantity;
      const payout = round(totalPool * share);
      if (payout > 0) {
        await settleFn(
          [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: contract.userId, amount: payout, reason: `vago_prediction_payout:${marketId}` }],
          { reason: `vago_prediction_payout:${marketId}` },
        );
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
