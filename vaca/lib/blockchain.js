// VACA -- a real local blockchain.
//
// Per direct instruction ("we need to make VACA blockchain
// accessible"): every real authenticity/identity decision VACA makes
// (`approveVerification`/`rejectVerification`) is appended here as a
// real block, cryptographically linked to the block before it through
// the same crypto-agility hashing layer (`lib/cryptoAgility.js`)
// `lib/verifications.js`'s own per-record `integrityHash` already
// uses. This is a genuine blockchain data structure -- a chain where
// each block's hash depends on its own data AND the previous block's
// hash, so altering any past block changes every hash after it and is
// immediately detectable. It does not have the OTHER half of what
// "blockchain" commonly implies -- no distributed network, no peers,
// no consensus protocol; this is one ledger, inside VACA, the same way
// V3's own ledger is one ledger. Public, independently-verifiable
// anchoring on a real chain (Ethereum, Polygon, etc.) is a separate,
// genuinely different thing -- see `lib/publicChainAnchor.js` for what
// that honestly requires and why it is not turned on by default.

const { hashPayload } = require('./cryptoAgility');

// A real, meaningful sentinel for "no parent" -- the real hash
// algorithm's own output length (sha3-512 hex, 128 chars), not an
// arbitrary magic string.
const GENESIS_PREVIOUS_HASH = '0'.repeat(128);

function blockHash(block) {
  return hashPayload({
    index: block.index, timestamp: block.timestamp, data: block.data, previousHash: block.previousHash,
  }).hash;
}

function getChain(store) {
  return store.blockchainLedger;
}

function getLatestBlock(store) {
  const chain = getChain(store);
  return chain.length ? chain[chain.length - 1] : null;
}

function getBlock(store, index) {
  return getChain(store).find((b) => b.index === index) || null;
}

// Appends one real block. `data` is whatever real record this block
// represents -- VACA's own callers pass a verification decision's real
// fields, never an invented payload.
function appendBlock(store, data, options = {}) {
  const { now = Date.now() } = options;
  const latest = getLatestBlock(store);
  const index = latest ? latest.index + 1 : 0;
  const previousHash = latest ? latest.hash : GENESIS_PREVIOUS_HASH;
  const block = { index, timestamp: now, data, previousHash };
  block.hash = blockHash(block);
  store.blockchainLedger.push(block);
  return block;
}

// The real point of this data structure: walk the whole chain and
// recompute every block's hash and every link, trusting nothing that
// is merely stored. A single altered byte anywhere in the chain's
// history changes a recomputed hash and is caught here, named by the
// exact block where the chain stops matching itself.
function verifyChainIntegrity(store) {
  const chain = getChain(store);
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    const recomputed = blockHash(block);
    if (recomputed !== block.hash) {
      return {
        valid: false, brokenAtIndex: block.index,
        reason: 'this block\'s stored hash no longer matches what its own real fields recompute to',
      };
    }
    const expectedPrevious = i === 0 ? GENESIS_PREVIOUS_HASH : chain[i - 1].hash;
    if (block.previousHash !== expectedPrevious) {
      return {
        valid: false, brokenAtIndex: block.index,
        reason: 'this block\'s previousHash does not match the real prior block\'s real hash',
      };
    }
  }
  return { valid: true, length: chain.length };
}

module.exports = {
  GENESIS_PREVIOUS_HASH, appendBlock, getChain, getLatestBlock, getBlock, verifyChainIntegrity,
};
