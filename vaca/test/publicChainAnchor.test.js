// VACA -- real public-blockchain anchoring. Confirms the honest,
// unconfigured-by-default posture: no real credentials means a real,
// specific refusal, never a fabricated transaction hash.

const test = require('node:test');
const assert = require('node:assert/strict');

test('isConfigured is honestly false with no real chain credentials set', () => {
  delete process.env.VACA_CHAIN_RPC_URL;
  delete process.env.VACA_CHAIN_PRIVATE_KEY;
  const { isConfigured } = require('../lib/publicChainAnchor');
  assert.equal(isConfigured(), false);
});

test('describeChainPosture reports the real, honest reason it is not configured', () => {
  delete process.env.VACA_CHAIN_RPC_URL;
  delete process.env.VACA_CHAIN_PRIVATE_KEY;
  const { describeChainPosture } = require('../lib/publicChainAnchor');
  const posture = describeChainPosture();
  assert.equal(posture.configured, false);
  assert.match(posture.note, /not configured/i);
});

test('anchorHash refuses to fabricate a transaction when no real chain is configured', async () => {
  delete process.env.VACA_CHAIN_RPC_URL;
  delete process.env.VACA_CHAIN_PRIVATE_KEY;
  const { anchorHash } = require('../lib/publicChainAnchor');
  await assert.rejects(anchorHash('deadbeef'), /no real chain is configured/);
});

test('anchorHash refuses with a real wallet but no RPC url', async () => {
  delete process.env.VACA_CHAIN_RPC_URL;
  process.env.VACA_CHAIN_PRIVATE_KEY = '0x' + '1'.repeat(64);
  const { anchorHash } = require('../lib/publicChainAnchor');
  await assert.rejects(anchorHash('deadbeef'), /no real chain is configured/);
  delete process.env.VACA_CHAIN_PRIVATE_KEY;
});
