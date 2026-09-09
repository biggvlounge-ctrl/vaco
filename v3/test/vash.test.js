const test = require('node:test');
const assert = require('node:assert/strict');
const { createV3Store } = require('../lib/store');
const { getBalance } = require('../lib/vcoin');
const { VCOIN_TO_VASH_RATE, getVashBalance, cashout } = require('../lib/vash');

test('cashout converts VCoin to VASH at the real, flagged rate', () => {
  const store = createV3Store();
  getBalance(store, 'a'); // touch to auto-grant starting balance
  const result = cashout(store, { userId: 'a', vcoinAmount: 100 });
  assert.equal(result.vashCredited, 100 * VCOIN_TO_VASH_RATE);
  assert.equal(result.newVcoinBalance, getBalance(store, 'a'));
  assert.equal(result.newVashBalance, getVashBalance(store, 'a'));
});

test('cashout rejects an amount exceeding the real VCoin balance', () => {
  const store = createV3Store();
  assert.throws(() => cashout(store, { userId: 'a', vcoinAmount: 999999 }), /Insufficient VCoin balance/);
});

test('cashout rejects a non-positive amount', () => {
  const store = createV3Store();
  assert.throws(() => cashout(store, { userId: 'a', vcoinAmount: 0 }), /positive number/);
});

test('a real user with no VASH activity yet has a zero balance, not undefined', () => {
  const store = createV3Store();
  assert.equal(getVashBalance(store, 'never-touched'), 0);
});
