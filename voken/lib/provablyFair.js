// VAGO -- provably-fair RNG for Casino Originals (Plinko, Mines).
// Source of truth: VAGO_COMPARABLES.md's own real, named comparable --
// "Stake Originals (provably-fair instant games like Plinko, Mines,
// HILO)" -- provably-fair itself, not just "random," is the real
// named mechanic this section flags as Stake's actual differentiator.
//
// Real, standard commit-reveal scheme (the same shape Stake's own
// provably-fair system uses, simplified to one HMAC draw per random
// value rather than their exact byte-cursor spec, but the identical
// real cryptographic principle): the server generates a `serverSeed`
// and commits to it up front via `sha256(serverSeed)` -- returned to
// the caller BEFORE the outcome is determined. The outcome is then
// derived deterministically from `HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")`.
// Only after the round resolves is the real `serverSeed` revealed, so
// any player can independently recompute the exact same HMAC output
// and confirm both that the hash they were shown up front matches
// `sha256(serverSeed)` and that the announced result matches what the
// seeds actually produce -- the server cannot have picked a
// favorable serverSeed after seeing the client's choices, because it
// already committed before the round played out.

const crypto = require('crypto');

function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function hashServerSeed(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

// One real, deterministic float in [0, 1) derived from the committed
// seed pair. `cursor` lets a single round draw many independent floats
// (e.g. Mines' 25 tile positions) from the same serverSeed/clientSeed/
// nonce triple without reusing bytes.
function deriveFloat(serverSeed, clientSeed, nonce, cursor = 0) {
  const hmac = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest('hex');
  // First 8 hex chars = 32 real bits of the HMAC output, normalized
  // against 2^32 -- the same "take a fixed-width slice, divide by its
  // max value" technique real provably-fair implementations use.
  const intValue = parseInt(hmac.slice(0, 8), 16);
  return intValue / 0x100000000;
}

function deriveFloats(serverSeed, clientSeed, nonce, count) {
  const floats = [];
  for (let cursor = 0; cursor < count; cursor += 1) {
    floats.push(deriveFloat(serverSeed, clientSeed, nonce, cursor));
  }
  return floats;
}

// Real, independent verification -- anyone holding the revealed
// serverSeed can confirm the commitment they were shown before the
// round wasn't swapped out after the fact.
function verifyServerSeedHash(serverSeed, serverSeedHash) {
  return hashServerSeed(serverSeed) === serverSeedHash;
}

module.exports = {
  generateServerSeed, hashServerSeed, deriveFloat, deriveFloats, verifyServerSeedHash,
};
