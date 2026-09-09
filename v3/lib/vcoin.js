// V3 -- the real VCoin ledger.
// Extracted directly from `venvs-mock-backend/server.js`'s own real,
// already-running, already-relied-upon VCoin contract -- not a
// redesign. Every route, every response shape, and the real
// `STARTING_VCOIN_BALANCE` auto-grant behavior below are preserved
// byte-for-byte on purpose: this is the exact real contract every
// other app in this ecosystem's `transferVCoin`/`V3_API_URL` client
// code already speaks, and drop-in compatibility (repoint the env
// var, change no application code) is the entire real point of
// splitting this out of the mock into its own standalone service.
//
// `venvs-mock-backend/server.js`'s own header is honest that its
// contract is INFERRED, not copied from a real V3 spec -- neither
// V3's nor Shield's real source exists anywhere in this session. That
// caveat carries over here unchanged: this is a real, working,
// carefully-preserved implementation of the same inferred contract,
// not a newly-discovered real spec.
//
// `STARTING_VCOIN_BALANCE = 1000` auto-grants on first touch (not a
// real onboarding bonus mechanic, just this ledger's own real default
// for a never-seen account) -- dozens of already-shipped live tests
// across this ecosystem assert against this exact number, so it's
// preserved exactly, not just "similar."

const STARTING_VCOIN_BALANCE = 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

function getBalance(store, userId) {
  if (!(userId in store.vcoinBalances)) {
    store.vcoinBalances[userId] = STARTING_VCOIN_BALANCE;
  }
  return store.vcoinBalances[userId];
}

function transfer(store, options = {}) {
  const { fromUserId, toUserId, amount, reason = null, now = Date.now() } = options;

  if (!fromUserId || !toUserId) throw new Error("'fromUserId' and 'toUserId' are required.");
  // `Number.isFinite`, not `typeof amount === 'number'`. The old guard
  // was `typeof amount !== 'number' || amount <= 0`, and NaN walks
  // straight through it: `typeof NaN === 'number'` is true and
  // `NaN <= 0` is false. So is the insufficient-balance check below —
  // `fromBalance < NaN` is also false.
  //
  // The consequence was not a bad transaction, it was a **permanently
  // poisoned ledger**: both balances become NaN, NaN propagates through
  // every later sum on those accounts, and V3 has no reversal endpoint
  // by design, so the correction would be another transfer — which
  // reads the NaN balance and stays NaN.
  //
  // Found by a VEX gate test passing `pricePerUnit: NaN`, which reached
  // here through `quantity * pricePerUnit`. That is the realistic route:
  // not a hand-typed NaN, but arithmetic on a field that arrived as a
  // string, undefined, or an empty form input.
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("'amount' must be a positive number.");

  const fromBalance = getBalance(store, fromUserId);
  if (fromBalance < amount) throw new Error('Insufficient VCoin balance.');

  store.vcoinBalances[fromUserId] = round(fromBalance - amount);
  store.vcoinBalances[toUserId] = round(getBalance(store, toUserId) + amount);

  const transaction = {
    id: store.nextTransactionId++, fromUserId, toUserId, amount, reason, timestamp: now,
    // Added alongside cashout recording. Additive on purpose: every
    // existing consumer reads fromUserId/toUserId/amount and is
    // unaffected, but the ledger can no longer be read as "everything
    // in here is a transfer between two users" -- because it is not.
    type: 'transfer',
  };
  store.transactions.push(transaction);

  return {
    transaction,
    fromBalance: store.vcoinBalances[fromUserId],
    toBalance: store.vcoinBalances[toUserId],
  };
}

function getTransactionHistory(store, userId) {
  return store.transactions.filter((t) => t.fromUserId === userId || t.toUserId === userId);
}

// ---------------------------------------------------------------------------
// reconcile() -- does the ledger explain the balances?
// ---------------------------------------------------------------------------
// The question any banking partner, auditor, or BaaS underwriter asks
// first, and until now this ledger could not answer it.
//
// `store.vcoinBalances` is authoritative and `store.transactions` is
// written alongside it. Nothing forced the two to agree, and they did
// not: `vash.cashout()` moved VCoin out of an account and recorded no
// entry at all, so a single cashout of 500 left the stored balance 500
// below anything the history could account for. Found by running it,
// not by reading it.
//
// This is the same failure the property engine's standing rule exists
// to prevent -- a stored number drifting from the inputs that should
// derive it -- except that in a ledger the stored number is money.
//
// Balances are NOT converted to derived-on-read here. That would be a
// real rewrite of a contract dozens of shipped tests across this
// ecosystem assert against. What changes is that drift is now
// *detectable* rather than silent, and that the one operation creating
// it no longer does.
//
// STARTING_VCOIN_BALANCE is the opening entry: an account auto-grants
// 1000 on first touch and that grant is not a transaction, so the
// expected balance is the grant plus everything the ledger says
// happened since.
function reconcile(store) {
  const accounts = new Set(Object.keys(store.vcoinBalances || {}));
  for (const t of store.transactions || []) {
    if (t.fromUserId) accounts.add(t.fromUserId);
    if (t.toUserId) accounts.add(t.toUserId);
  }

  const discrepancies = [];
  for (const userId of accounts) {
    let expected = STARTING_VCOIN_BALANCE;
    for (const t of store.transactions || []) {
      if (t.fromUserId === userId) expected -= t.amount;
      if (t.toUserId === userId) expected += t.amount;
    }
    expected = round(expected);
    const actual = round(store.vcoinBalances[userId] ?? STARTING_VCOIN_BALANCE);
    if (expected !== actual) {
      discrepancies.push({ userId, expected, actual, drift: round(actual - expected) });
    }
  }

  return {
    accounts: accounts.size,
    entries: (store.transactions || []).length,
    balanced: discrepancies.length === 0,
    discrepancies,
  };
}

module.exports = {
  STARTING_VCOIN_BALANCE,
  reconcile,
  getBalance,
  transfer,
  getTransactionHistory,
};
