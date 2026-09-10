// VAGO -- the Gold Coin ledger.
// Source of truth: VAGO_ARCHITECTURE.md's `CasinoSession.currency:
// "gold-coin" | "vcoin"` note: "Gold Coin is the REQUIRED separate,
// non-redeemable sweepstakes currency -- must be genuinely distinct
// from VCoin for the sweepstakes-compliant model to actually apply."
// VAGO_CLAUDE.md calls this "not a later migration... the structural
// requirement that keeps the sweepstakes model legally distinct from
// real-money gambling." VAGO_COMPARABLES.md confirms Stake.us's real,
// operating dual-currency sweepstakes model as genuine legal
// precedent for exactly this shape.
//
// The enforcement is architectural, not a flag: Gold Coin lives in
// its own ledger object (`store.goldCoinBalances`), entirely separate
// from VCoin (which lives in V3/venvs-mock-backend and is only ever
// moved through the injected `settleFn`, same pattern as VOID and
// VOKEN). No function anywhere in this module -- or anywhere in this
// project -- converts between the two, in either direction. That
// absence is the compliance boundary.

function getGoldCoinBalance(store, userId) {
  if (!userId) throw new Error('getGoldCoinBalance requires a userId');
  return store.goldCoinBalances[userId] || 0;
}

function creditGoldCoin(store, options = {}) {
  const { userId, amount, reason } = options;
  if (!userId) throw new Error('creditGoldCoin requires a userId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('creditGoldCoin requires a positive amount');
  if (!reason) throw new Error('creditGoldCoin requires a reason');
  store.goldCoinBalances[userId] = (store.goldCoinBalances[userId] || 0) + amount;
  return { userId, amount, reason, balance: store.goldCoinBalances[userId] };
}

function debitGoldCoin(store, options = {}) {
  const { userId, amount, reason } = options;
  if (!userId) throw new Error('debitGoldCoin requires a userId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('debitGoldCoin requires a positive amount');
  if (!reason) throw new Error('debitGoldCoin requires a reason');
  const current = store.goldCoinBalances[userId] || 0;
  if (current < amount) {
    throw new Error(`debitGoldCoin: ${userId} has ${current} Gold Coin, cannot debit ${amount}`);
  }
  store.goldCoinBalances[userId] = current - amount;
  return { userId, amount, reason, balance: store.goldCoinBalances[userId] };
}

module.exports = { getGoldCoinBalance, creditGoldCoin, debitGoldCoin };
