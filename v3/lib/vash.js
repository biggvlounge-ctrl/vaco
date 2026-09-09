// V3 -- the real VASH ledger.
// Same extraction discipline as `lib/vcoin.js`: preserved byte-for-
// byte from `venvs-mock-backend/server.js`'s own real, already-tested
// VASH cashout contract, including the real inferred conversion rate
// -- flagged there and flagged here, not silently promoted to "the
// real rate" just because it now lives in its own dedicated service.

const { getBalance: getVcoinBalance } = require('./vcoin');

const VCOIN_TO_VASH_RATE = 0.01; // inferred, not specified anywhere -- flagged, preserved as-is from the mock

function round(n) {
  return Math.round(n * 100) / 100;
}

function getVashBalance(store, userId) {
  return store.vashBalances[userId] || 0;
}

// **A cashout is a ledger entry, not just two balance writes.**
//
// It was the second for a long time. `store.transactions` was only ever
// written by `vcoin.transfer()`, so VCoin left an account on cashout and
// `GET /api/vcoin/transactions/:userId` showed nothing -- the money was
// gone from the balance with no record that it had moved. One cashout of
// 500 put the stored balance 500 below what the history could account
// for, and `vcoin.reconcile()` now exists to say so out loud.
//
// The entry has `toUserId: null` because a cashout genuinely has no
// counterparty inside this ledger: VCoin is destroyed and VASH is
// credited. That asymmetry is real and is recorded rather than faked
// with a house account that does not exist.
function cashout(store, options = {}) {
  const { userId, vcoinAmount, now = Date.now() } = options;

  if (!userId) throw new Error("'userId' is required.");
  // Number.isFinite, for the same reason as vcoin.js's transfer: NaN
  // passes both `typeof x === 'number'` and `x <= 0`, and would poison
  // the VCoin *and* VASH balance in one call — a cashout is the one
  // operation that touches both.
  if (!Number.isFinite(vcoinAmount) || vcoinAmount <= 0) throw new Error("'vcoinAmount' must be a positive number.");

  const currentVcoin = getVcoinBalance(store, userId);
  if (currentVcoin < vcoinAmount) throw new Error('Insufficient VCoin balance for cashout.');

  const vashAmount = round(vcoinAmount * VCOIN_TO_VASH_RATE);
  store.vcoinBalances[userId] = round(currentVcoin - vcoinAmount);
  store.vashBalances[userId] = round(getVashBalance(store, userId) + vashAmount);

  store.transactions.push({
    id: store.nextTransactionId++,
    fromUserId: userId,
    toUserId: null,
    amount: vcoinAmount,
    reason: 'vash cashout',
    timestamp: now,
    type: 'cashout',
    vashCredited: vashAmount,
    rate: VCOIN_TO_VASH_RATE,
  });

  return {
    userId,
    vcoinDeducted: vcoinAmount,
    vashCredited: vashAmount,
    rate: VCOIN_TO_VASH_RATE,
    newVcoinBalance: store.vcoinBalances[userId],
    newVashBalance: store.vashBalances[userId],
  };
}

module.exports = {
  VCOIN_TO_VASH_RATE,
  getVashBalance,
  cashout,
};
