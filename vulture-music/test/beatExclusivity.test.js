// Vvltvre Music — an exclusive licence is sold exactly once.
//
// **Measured before the fix.** `purchaseBeat` settled, recorded the
// purchase, and only then set `sold-exclusive`. Five concurrent buyers
// of one *exclusive* beat all passed the status check, all paid, and
// all got a purchase record: **one exclusive licence sold to 5 buyers
// for 250 VCoin**.
//
// That is a rights problem before it is a money problem. Five people
// each hold a contract stating nobody else has the beat, and no ledger
// correction undoes that.
//
// **The control matters as much as the bug.** A non-exclusive beat is
// *supposed* to sell many times, and a fix that serialised those would
// be a worse defect than the one it fixed. The first probe of this
// actually hit that case by accident — it picked the licence type with
// a regex that matched "non-exclusive" first, saw five sales, and
// reported a bug that was correct behaviour. Both cases are asserted
// here so the distinction cannot be lost.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const beats = require('../lib/beatMarketplace');
const { createVultureMusicStore } = require('../lib/store');

function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.total = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

const list = (store, licenseType, price = 50) => beats.listBeat(store,
  { producerId: 'prod1', title: 'B', price, licenseType });

test('an exclusive beat cannot be sold to two buyers at once', async () => {
  const store = createVultureMusicStore();
  const beat = list(store, 'exclusive');
  const fn = ledger();

  await Promise.allSettled(Array.from({ length: 5 }, (_, i) => beats.purchaseBeat(store,
    { beatId: beat.id, buyerId: `buyer${i}`, settleFn: fn })));

  assert.equal(store.beatPurchases.length, 1,
    `one exclusive licence was sold to ${store.beatPurchases.length} buyers for ${fn.total()} VCoin`);
  assert.equal(store.beats.find((b) => b.id === beat.id).status, 'sold-exclusive');
});

test('a non-exclusive beat still sells to everyone who wants it', async () => {
  // The whole point of the licence. If this ever fails, the fix above
  // has started serialising sales it has no business serialising.
  const store = createVultureMusicStore();
  const beat = list(store, 'non-exclusive', 10);
  const fn = ledger();

  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => beats.purchaseBeat(store,
    { beatId: beat.id, buyerId: `buyer${i}`, settleFn: fn })));

  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5,
    'a non-exclusive beat refused a concurrent buyer — many sales is the licence, not a bug');
  assert.equal(store.beatPurchases.length, 5);
  assert.equal(store.beats.find((b) => b.id === beat.id).status, 'listed',
    'a non-exclusive beat was marked sold');
});

test('a failed payment leaves an exclusive beat still for sale', async () => {
  const store = createVultureMusicStore();
  const beat = list(store, 'exclusive');
  const fn = ledger({ failFirstCall: true, delayMs: 0 });

  await assert.rejects(() => beats.purchaseBeat(store,
    { beatId: beat.id, buyerId: 'buyer1', settleFn: fn }), /V3 unreachable/);

  assert.equal(store.beats.find((b) => b.id === beat.id).status, 'listed',
    'a failed payment took the beat off the market without selling it');
  assert.equal(store.beatPurchases.length, 0, 'a failed payment recorded a purchase');

  await beats.purchaseBeat(store, { beatId: beat.id, buyerId: 'buyer1', settleFn: fn });
  assert.equal(store.beatPurchases.length, 1);
});
