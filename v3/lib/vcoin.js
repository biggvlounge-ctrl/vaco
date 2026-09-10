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

// Move several legs, or move none.
//
// **The defect this exists for.** Every settling module in this
// ecosystem pays its parties with consecutive `await transfer(...)`
// calls — VOID's `settleJob`, which is the single settlement path all
// 25 verticals share, does exactly this:
//
//     await transferFn(payer, provider, payout, ...);
//     if (platformFee > 0) await transferFn(payer, PLATFORM, fee, ...);
//     job.settledTotal = total;            // never reached if leg 2 threw
//
// If the second leg fails — and it can, because the first leg just
// debited the same payer — the provider has been paid, the record was
// never written, and the caller never advances the status. `petCare`'s
// `completeBooking` then still sees `status === 'confirmed'`, which is
// the exact condition it retries on. **The retry pays the provider a
// second time.** No error is logged that says so; the ledger simply
// contains two payouts and one fee.
//
// The caller cannot fix this on its own. Wrapping the two awaits in a
// try/catch and reversing leg 1 needs a reversal, and V3 deliberately
// has none — "a correction is another transfer" — which is itself a
// transfer that can fail. The only place all-or-nothing can be decided
// is here, where the balances are.
//
// **How it is atomic.** Every leg is validated against *running*
// balances first, and nothing is written until all of them pass. That
// running part is the whole trick: two legs of 600 from an account
// holding 1000 are individually affordable and jointly are not, so
// checking each against the opening balance would admit exactly the
// overdraft this is meant to refuse. Only after the whole set passes
// does anything mutate, and mutation cannot fail — it is synchronous
// arithmetic on an in-process object with no await between the writes.
//
// **Still one transaction row per leg.** Netting them into a single
// movement would lose what `settlement.js` calls out as deliberate:
// "the provider's earnings and the platform's fee stay separately
// auditable". They share a `settlementId` so the ledger can also be
// read the other way — as one event that happened together.
function settle(store, options = {}) {
  const { legs, reason = null, now = Date.now() } = options;

  if (!Array.isArray(legs) || legs.length === 0) {
    throw new Error("'legs' must be a non-empty array of { fromUserId, toUserId, amount }.");
  }

  // Same guards as `transfer`, applied to every leg before any of them
  // moves. `Number.isFinite` for the reason its own comment gives: a
  // NaN amount poisons a balance permanently and there is no reversal.
  // **Validation must not call `getBalance`.** It auto-grants
  // `STARTING_VCOIN_BALANCE` on first touch — `store.vcoinBalances[userId] =
  // ...` — so simply *checking* whether a payee could be paid creates
  // the payee's account. A refused settlement would then leave new
  // accounts behind, which is a write, and this function's whole claim
  // is that a refusal writes nothing. Caught by `settle.test.js`'s
  // "a refused leg leaves NOTHING applied", which is exactly the sort
  // of thing a balance-arithmetic assertion never notices.
  //
  // Reading with the same default and no assignment keeps the numbers
  // identical to what `getBalance` would have returned.
  const running = new Map();
  const balanceOf = (userId) => {
    if (running.has(userId)) return running.get(userId);
    const held = store.vcoinBalances[userId];
    return held === undefined ? STARTING_VCOIN_BALANCE : held;
  };

  legs.forEach((leg, i) => {
    const { fromUserId, toUserId, amount } = leg || {};
    const at = `legs[${i}]`;

    if (!fromUserId || !toUserId) throw new Error(`${at}: 'fromUserId' and 'toUserId' are required.`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${at}: 'amount' must be a positive number.`);

    const from = balanceOf(fromUserId);
    if (from < amount) {
      throw new Error(`${at}: Insufficient VCoin balance. Nothing in this settlement was applied.`);
    }
    running.set(fromUserId, round(from - amount));
    running.set(toUserId, round(balanceOf(toUserId) + amount));
  });

  // Past this line nothing can throw, which is what makes the above a
  // decision rather than a hope.
  // A store persisted before `nextSettlementId` existed shallow-merges
  // back without it (see `store.js`'s header), so this starts the
  // counter rather than producing `NaN` settlement ids forever.
  if (!Number.isFinite(store.nextSettlementId)) store.nextSettlementId = 1;
  const settlementId = store.nextSettlementId;
  store.nextSettlementId += 1;

  const transactions = legs.map((leg) => {
    const { fromUserId, toUserId, amount, reason: legReason = null } = leg;
    store.vcoinBalances[fromUserId] = round(getBalance(store, fromUserId) - amount);
    store.vcoinBalances[toUserId] = round(getBalance(store, toUserId) + amount);

    const transaction = {
      id: store.nextTransactionId++,
      fromUserId,
      toUserId,
      amount,
      reason: legReason,
      timestamp: now,
      type: 'transfer',
      // Reading the ledger as a list of transfers still works
      // unchanged; this only adds the ability to see which of them
      // happened together.
      settlementId,
      settlementReason: reason,
    };
    store.transactions.push(transaction);
    return transaction;
  });

  const balances = {};
  for (const userId of running.keys()) balances[userId] = store.vcoinBalances[userId];

  return { settlementId, reason, transactions, balances };
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
  settle,
  getTransactionHistory,
};
