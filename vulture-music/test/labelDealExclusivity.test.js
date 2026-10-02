// Vvltvre Music — a label deal's exclusivity is claimed before the
// advance moves, and its settlement key is unique per deal.
//
// **Two bugs, one shape.** `signLabelDeal` checked exclusivity
// (`findActiveBlanketDeal` / `findActiveDealForRelease`) synchronously,
// then awaited a real cross-service VCoin advance, and only after that
// await resolved did it build and push the deal record. Nothing
// claimed the slot before the await:
//
//   1. Two concurrent signings for the same artist (same blanket deal,
//      or the same release) both passed the exclusivity check while no
//      deal existed yet, both paid a real advance, and both pushed a
//      record -- two simultaneously-"active" deals that were supposed
//      to be mutually exclusive. Only one of them is ever recoupable
//      through `getActiveLabelDealForRelease`'s plain `.find()`.
//   2. The settlement reason -- which doubles as V3's idempotency key,
//      see server.js's settleVCoin -- carried no per-deal scoping at
//      all: `Label advance: ${dealType} deal`, identical for every
//      blanket deal ever signed and every per-release deal ever
//      signed. The second deal of a given type signed anywhere, for
//      any artist or label, collided with the first's key and was
//      refused by V3 outright.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { submitRelease, markDistributing, markLive } = require('../lib/releases');
const { signLabelDeal } = require('../lib/labelDeals');
const { createVultureMusicStore } = require('../lib/store');

const NOW = Date.UTC(2026, 8, 1);

function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  return fn;
}

// Reproduces V3's real idempotency behavior -- a reused key whose body
// differs is refused (422), not replayed -- which is exactly the gap
// a plain call-recording mock leaves open.
function idempotentLedger() {
  const seen = new Map();
  const fn = async (settlementLegs, meta = {}) => {
    const fingerprint = JSON.stringify(settlementLegs);
    if (meta.reason) {
      const prior = seen.get(meta.reason);
      if (prior !== undefined && prior !== fingerprint) {
        throw new Error(`Idempotency-Key "settle:${meta.reason}" was already used for a different request.`);
      }
      seen.set(meta.reason, fingerprint);
    }
    fn.legs.push(...settlementLegs);
    return { ok: true };
  };
  fn.legs = [];
  return fn;
}

async function liveRelease(store, settleFn, artistId = 'nova') {
  const release = await submitRelease(store, {
    artistId, title: 'Cherokee Street', format: 'single', targetPlatforms: ['Spotify'], settleFn, now: NOW,
  });
  markDistributing(store, release.id);
  markLive(store, release.id);
  return release;
}

test('an artist cannot be signed to two concurrent blanket deals', async () => {
  const store = createVultureMusicStore();
  const fn = ledger();

  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => signLabelDeal(store, {
    labelId: `label${i}`, artistId: 'nova', dealType: 'blanket', advanceAmount: 1000, settleFn: fn,
  })));

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'only one blanket deal may win for one artist');
  assert.equal(fn.legs.length, 1, 'only one real advance may be paid');
  assert.equal(store.labelDeals.filter((d) => d.artistId === 'nova').length, 1,
    'no losing attempt may leave a deal record behind');
});

test('an artist cannot be signed to two concurrent per-release deals on the same release', async () => {
  const store = createVultureMusicStore();
  const fn = ledger();
  const release = await liveRelease(store, ledger({ delayMs: 0 }));

  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => signLabelDeal(store, {
    labelId: `label${i}`, artistId: 'nova', dealType: 'per-release', release, advanceAmount: 500, settleFn: fn,
  })));

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'only one per-release deal may win for one release');
  assert.equal(fn.legs.length, 1, 'only one real advance may be paid');
  assert.equal(store.labelDeals.filter((d) => d.releaseId === release.id).length, 1);
});

test('a non-conflicting pair -- a blanket deal for one artist and a per-release deal for another -- both succeed', async () => {
  // The control: the fix must not serialise unrelated deals.
  const store = createVultureMusicStore();
  const fn = ledger({ delayMs: 0 });
  const release = await liveRelease(store, ledger({ delayMs: 0 }), 'kai');

  const [blanket, perRelease] = await Promise.all([
    signLabelDeal(store, { labelId: 'label1', artistId: 'nova', dealType: 'blanket', advanceAmount: 1000, settleFn: fn }),
    signLabelDeal(store, { labelId: 'label2', artistId: 'kai', dealType: 'per-release', release, advanceAmount: 500, settleFn: fn }),
  ]);

  assert.equal(blanket.status, 'active');
  assert.equal(perRelease.status, 'active');
  assert.equal(fn.legs.length, 2);
});

test('a failed advance leaves no deal behind, so the artist can be signed again', async () => {
  const store = createVultureMusicStore();
  const fn = ledger({ failFirstCall: true, delayMs: 0 });

  await assert.rejects(() => signLabelDeal(store, {
    labelId: 'label1', artistId: 'nova', dealType: 'blanket', advanceAmount: 1000, settleFn: fn,
  }), /V3 unreachable/);

  assert.equal(store.labelDeals.length, 0, 'a refused advance must not leave a half-signed deal behind');

  const retried = await signLabelDeal(store, {
    labelId: 'label1', artistId: 'nova', dealType: 'blanket', advanceAmount: 1000, settleFn: fn,
  });
  assert.equal(retried.status, 'active');
  assert.equal(fn.legs.length, 1, 'the retry paid twice');
});

test('two different artists can each sign a blanket deal -- the key is not a bare dealType literal', async () => {
  const store = createVultureMusicStore();
  const fn = idempotentLedger();

  // Pre-fix, this is exactly the sequence that broke: both deals share
  // the identical reason "Label advance: blanket deal", so the second
  // signing -- a different label/artist/amount -- collides with the
  // first's idempotency key and is refused outright.
  const dealA = await signLabelDeal(store, {
    labelId: 'label1', artistId: 'nova', dealType: 'blanket', advanceAmount: 1000, settleFn: fn,
  });
  const dealB = await signLabelDeal(store, {
    labelId: 'label2', artistId: 'kai', dealType: 'blanket', advanceAmount: 2500, settleFn: fn,
  });

  assert.equal(dealA.status, 'active');
  assert.equal(dealB.status, 'active', 'the second blanket deal signed anywhere must not be refused');
  assert.equal(fn.legs.length, 2);
});
