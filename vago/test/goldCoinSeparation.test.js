// VAGO -- the Gold Coin / VCoin separation.
//
// This is the compliance boundary that makes VAGO a sweepstakes
// operator rather than a real-money gambling operator. Gold Coin is
// non-redeemable and lives in its own ledger; VCoin lives in V3 and is
// only ever reached through the injected `settleFn`. Nothing
// converts between them, in either direction.
//
// **The boundary is an absence**, which is what makes it fragile. It
// holds because no conversion function exists — not because a check
// rejects one. Nobody would deliberately delete a compliance control,
// but somebody could easily add a helpful `convertGoldCoinToVCoin`, or
// let a gold-coin session fall through to the VCoin branch during a
// refactor. Neither would fail any existing test, and both would
// change what VAGO legally is.
//
// So these tests assert the absence directly, and assert that each
// currency branch never touches the other's ledger.

const test = require('node:test');
const assert = require('node:assert');

const goldCoin = require('../lib/goldCoin');
const { startCasinoSession, CASINO_CURRENCIES } = require('../lib/casinoSession');
const { createVagoStore } = require('../lib/store');

const { getGoldCoinBalance, creditGoldCoin, debitGoldCoin } = goldCoin;

// -- the absence, asserted --------------------------------------------

test('the Gold Coin module exports NO conversion function', () => {
  // The whole compliance argument rests on this. If a future commit
  // adds a converter, this fails and the reviewer is forced to think
  // about what it means rather than merging a convenience helper.
  const exported = Object.keys(goldCoin).sort();
  assert.deepStrictEqual(exported, ['creditGoldCoin', 'debitGoldCoin', 'getGoldCoinBalance']);

  for (const name of exported) {
    assert.doesNotMatch(
      name, /convert|redeem|exchange|cashout|withdraw|toVcoin|toVCoin/i,
      `${name} looks like a conversion or redemption path`,
    );
  }
});

test('the Gold Coin ledger is a distinct store object from any VCoin balance', () => {
  const store = createVagoStore();
  assert.ok(store.goldCoinBalances, 'goldCoinBalances must exist');
  // VAGO holds no VCoin ledger at all — VCoin lives in V3 and is
  // reached only through the injected settleFn. A local vcoin
  // balance object appearing here would be the first step toward the
  // two becoming interchangeable.
  assert.strictEqual(store.vcoinBalances, undefined);
  assert.strictEqual(store.vashBalances, undefined);
});

// -- ordinary ledger behavior -----------------------------------------

test('Gold Coin credits and debits move only the Gold Coin ledger', () => {
  const store = createVagoStore();
  creditGoldCoin(store, { userId: 'alice', amount: 1000, reason: 'amoe-free-entry' });
  assert.strictEqual(getGoldCoinBalance(store, 'alice'), 1000);

  debitGoldCoin(store, { userId: 'alice', amount: 250, reason: 'casino-stake' });
  assert.strictEqual(getGoldCoinBalance(store, 'alice'), 750);
});

test('Gold Coin cannot go negative', () => {
  const store = createVagoStore();
  creditGoldCoin(store, { userId: 'alice', amount: 100, reason: 'amoe-free-entry' });
  assert.throws(() => debitGoldCoin(store, { userId: 'alice', amount: 101, reason: 'casino-stake' }));
  assert.strictEqual(getGoldCoinBalance(store, 'alice'), 100);
});

test('an unknown user has zero Gold Coin, not undefined', () => {
  const store = createVagoStore();
  assert.strictEqual(getGoldCoinBalance(store, 'nobody'), 0);
});

// -- the routing enforcement point ------------------------------------

test('both currencies are recognised, and only those two', () => {
  assert.deepStrictEqual([...CASINO_CURRENCIES].sort(), ['gold-coin', 'vcoin']);
});

test('a gold-coin session NEVER calls settleFn', async () => {
  // This is the structural claim in casinoSession.js's own header,
  // turned into a test: the sweepstakes currency must not be able to
  // reach V3, because reaching V3 is what "real money" means here.
  const store = createVagoStore();
  creditGoldCoin(store, { userId: 'alice', amount: 1000, reason: 'amoe-free-entry' });

  let transferCalls = 0;
  await startCasinoSession(store, {
    userId: 'alice',
    gameType: 'originals',
    currency: 'gold-coin',
    stakeAmount: 100,
    settleFn: async () => { transferCalls += 1; },
  });

  assert.strictEqual(transferCalls, 0, 'a gold-coin session must never reach V3');
  assert.strictEqual(getGoldCoinBalance(store, 'alice'), 900, 'it must debit the Gold Coin ledger');
});

test('a vcoin session NEVER touches the Gold Coin ledger', async () => {
  // The mirror image, and equally important: VCoin play must not be
  // able to spend or create sweepstakes currency.
  const store = createVagoStore();
  creditGoldCoin(store, { userId: 'alice', amount: 1000, reason: 'amoe-free-entry' });

  let transferCalls = 0;
  await startCasinoSession(store, {
    userId: 'alice',
    gameType: 'originals',
    currency: 'vcoin',
    stakeAmount: 100,
    settleFn: async () => { transferCalls += 1; },
  });

  assert.strictEqual(transferCalls, 1, 'a vcoin session settles through V3');
  assert.strictEqual(getGoldCoinBalance(store, 'alice'), 1000, 'Gold Coin must be untouched');
});

test('an unrecognised currency is refused rather than defaulting', async () => {
  // A typo must not fall into either branch.
  const store = createVagoStore();
  await assert.rejects(() => startCasinoSession(store, {
    userId: 'alice', gameType: 'originals', currency: 'goldcoin', stakeAmount: 100,
    settleFn: async () => {},
  }));
});
