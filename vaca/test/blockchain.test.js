// VACA -- the real local blockchain. Verifies the genuine blockchain
// property: each block links to the real hash of the one before it,
// and tampering with any past block is detectable by recomputing the
// whole chain, not by trusting a stored flag.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVacaStore } = require('../lib/store');
const {
  GENESIS_PREVIOUS_HASH, appendBlock, getChain, getLatestBlock, getBlock, verifyChainIntegrity,
} = require('../lib/blockchain');

test('the first block links to the real genesis sentinel', () => {
  const store = createVacaStore();
  const block = appendBlock(store, { note: 'first' });
  assert.equal(block.index, 0);
  assert.equal(block.previousHash, GENESIS_PREVIOUS_HASH);
  assert.ok(block.hash);
});

test('each later block links to the real hash of the one before it', () => {
  const store = createVacaStore();
  const b0 = appendBlock(store, { note: 'first' });
  const b1 = appendBlock(store, { note: 'second' });
  const b2 = appendBlock(store, { note: 'third' });

  assert.equal(b1.previousHash, b0.hash);
  assert.equal(b2.previousHash, b1.hash);
  assert.equal(getLatestBlock(store).index, 2);
  assert.equal(getChain(store).length, 3);
  assert.equal(getBlock(store, 1).hash, b1.hash);
});

test('verifyChainIntegrity confirms a real, untampered chain', () => {
  const store = createVacaStore();
  appendBlock(store, { note: 'a' });
  appendBlock(store, { note: 'b' });
  appendBlock(store, { note: 'c' });

  const result = verifyChainIntegrity(store);
  assert.equal(result.valid, true);
  assert.equal(result.length, 3);
});

test('verifyChainIntegrity catches a tampered block\'s data', () => {
  const store = createVacaStore();
  appendBlock(store, { note: 'a' });
  appendBlock(store, { note: 'b' });

  // Tamper with a past block's real data without recomputing its
  // hash -- exactly what a real attacker (or a bug) would do.
  store.blockchainLedger[0].data.note = 'tampered';

  const result = verifyChainIntegrity(store);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 0);
});

test('verifyChainIntegrity catches a forged previousHash', () => {
  const store = createVacaStore();
  appendBlock(store, { note: 'a' });
  appendBlock(store, { note: 'b' });

  store.blockchainLedger[1].previousHash = 'f'.repeat(128);

  const result = verifyChainIntegrity(store);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAtIndex, 1);
});

test('an empty chain is honestly valid, not an error', () => {
  const store = createVacaStore();
  assert.deepEqual(verifyChainIntegrity(store), { valid: true, length: 0 });
});
