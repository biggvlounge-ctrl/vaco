// V3 — the ledger refuses amounts that are not finite numbers.
//
// **This is a regression suite for a real bug, not a hypothetical.**
//
// The original guard on both `transfer` and `cashout` was
//
//   if (typeof amount !== 'number' || amount <= 0) throw ...
//
// and **NaN walks straight through it**: `typeof NaN === 'number'` is
// true, and `NaN <= 0` is false. So is the insufficient-balance check
// immediately after — `fromBalance < NaN` is also false. Nothing in the
// path stopped it.
//
// The consequence was not one bad transaction. Both balances become
// NaN; NaN propagates through every later arithmetic operation on those
// accounts; `round(NaN)` is NaN; and V3 has **no reversal endpoint by
// design**, so the documented correction — another transfer — reads the
// poisoned balance and stays poisoned. A single NaN permanently
// destroys two accounts and every total they appear in.
//
// **How it was found**, because the route matters more than the bug: a
// VEX compliance-gate test passed `pricePerUnit: NaN` to
// `placeTradeOrder`, which computes `quantity * pricePerUnit` and hands
// the result here. That is the realistic path — not somebody typing
// NaN, but ordinary arithmetic on a field that arrived as `undefined`,
// an empty form input, or a string that failed to parse. Every one of
// those produces NaN silently.
//
// The fix is `Number.isFinite`, which also closes Infinity. These tests
// exist so a future "tidy up the validation" pass cannot reopen it.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { STARTING_VCOIN_BALANCE, getBalance, transfer } = require('../lib/vcoin');
const { cashout, getVashBalance } = require('../lib/vash');

// Every value that satisfies `typeof x === 'number'` but is not a real
// amount. The first two are the ones the old guard let through.
const NOT_REAL_AMOUNTS = [NaN, Infinity, -Infinity];

test('transfer refuses NaN, and both balances survive intact', () => {
  const store = createV3Store();
  getBalance(store, 'ada');
  getBalance(store, 'rio');

  assert.throws(() => transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount: NaN }),
    /must be a positive number/);

  // The assertion that matters. A poisoned balance is not merely wrong,
  // it is unrecoverable: NaN cannot be transferred back out.
  assert.equal(getBalance(store, 'ada'), STARTING_VCOIN_BALANCE);
  assert.equal(getBalance(store, 'rio'), STARTING_VCOIN_BALANCE);
  assert.ok(Number.isFinite(getBalance(store, 'ada')));
  assert.ok(Number.isFinite(getBalance(store, 'rio')));
});

test('transfer refuses every non-finite amount', () => {
  for (const amount of NOT_REAL_AMOUNTS) {
    const store = createV3Store();
    assert.throws(() => transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount }),
      /must be a positive number/, `amount ${String(amount)} must be refused`);
    assert.equal(store.transactions.length, 0, `${String(amount)} must not record a transaction`);
    assert.equal(store.nextTransactionId, 1, `${String(amount)} must not burn a transaction id`);
  }
});

test('a NaN transfer does not slip past the insufficient-balance check either', () => {
  const store = createV3Store();
  // 1000 starting balance, and NaN is neither more nor less than it.
  // `fromBalance < NaN` is false, which is why the balance check was
  // never a second line of defence here.
  assert.equal(STARTING_VCOIN_BALANCE < NaN, false, 'documenting why one guard was not enough');
  assert.throws(() => transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount: NaN }),
    /must be a positive number/);
});

test('the ledger total is unchanged by a refused transfer', () => {
  const store = createV3Store();
  getBalance(store, 'ada');
  getBalance(store, 'rio');
  const total = () => Object.values(store.vcoinBalances).reduce((a, b) => a + b, 0);
  const opening = total();

  for (const amount of [...NOT_REAL_AMOUNTS, 0, -50, '100', null, undefined, {}]) {
    assert.throws(() => transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount }));
  }

  assert.equal(total(), opening, 'not one refusal moved a single VCoin');
  assert.ok(Number.isFinite(total()), 'and the total is still a number at all');
});

test('a real transfer still works after all of that', () => {
  const store = createV3Store();
  assert.throws(() => transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount: NaN }));

  // The guard must refuse the bad amount without becoming so strict it
  // refuses ordinary money. Fractional amounts are normal here — every
  // platform fee produces one.
  const result = transfer(store, { fromUserId: 'ada', toUserId: 'rio', amount: 12.34 });
  assert.equal(result.fromBalance, STARTING_VCOIN_BALANCE - 12.34);
  assert.equal(result.toBalance, STARTING_VCOIN_BALANCE + 12.34);
});

test('cashout refuses non-finite amounts — it would poison two balances at once', () => {
  for (const vcoinAmount of NOT_REAL_AMOUNTS) {
    const store = createV3Store();
    assert.throws(() => cashout(store, { userId: 'ada', vcoinAmount }),
      /must be a positive number/, `vcoinAmount ${String(vcoinAmount)} must be refused`);
  }

  const store = createV3Store();
  assert.throws(() => cashout(store, { userId: 'ada', vcoinAmount: NaN }));
  // A cashout is the one operation touching both currencies, so a NaN
  // here corrupts the VCoin balance and the VASH balance in one call.
  assert.equal(getBalance(store, 'ada'), STARTING_VCOIN_BALANCE);
  assert.equal(getVashBalance(store, 'ada'), 0);
  assert.ok(Number.isFinite(getVashBalance(store, 'ada')));
});

test('cashout still works for a real amount', () => {
  const store = createV3Store();
  assert.throws(() => cashout(store, { userId: 'ada', vcoinAmount: Infinity }));

  const result = cashout(store, { userId: 'ada', vcoinAmount: 100 });
  assert.ok(Number.isFinite(result.vashBalance ?? getVashBalance(store, 'ada')));
  assert.equal(getBalance(store, 'ada'), STARTING_VCOIN_BALANCE - 100);
  assert.ok(getVashBalance(store, 'ada') > 0);
});
