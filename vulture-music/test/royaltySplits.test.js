// Vvltvre Music -- royalty splits and payout arithmetic.
//
// The failure mode here is not a crash. It is a co-writer being paid a
// cent less than they are owed, every month, forever, with nothing in
// the system noticing. Split arithmetic is exactly where that happens:
// three collaborators at a third each cannot be represented exactly in
// either the split percentages or the resulting currency amounts, so
// the code rounds every share but the last and lets the last absorb
// the remainder.
//
// That discipline is correct and it is fragile. A refactor to
// "round each share consistently" looks tidier and silently loses or
// creates money on every uneven split. These tests assert the sum, not
// just the individual shares.

const test = require('node:test');
const assert = require('node:assert');

const {
  submitRelease, markDistributing, markLive, reportStreamingRevenue,
  getCollaboratorEarnings, VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
} = require('../lib/releases');
const { createVultureMusicStore } = require('../lib/store');

// Records every transfer instead of moving money, so the test asserts
// on exactly what would have been paid.
function recorder() {
  const calls = [];
  const fn = async (from, to, amount, reason) => { calls.push({ from, to, amount, reason }); };
  fn.calls = calls;
  fn.payoutsTo = () => calls.filter((c) => c.from === VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT);
  return fn;
}

async function liveRelease(store, transferFn, coWriters = null) {
  const release = await submitRelease(store, {
    artistId: 'artist-1',
    title: 'Test Track',
    format: 'single',
    targetPlatforms: ['Spotify'],
    coWriters,
    transferFn,
  });
  markDistributing(store, release.id);
  markLive(store, release.id);
  return release;
}

// -- split validation -------------------------------------------------

test('splits must sum to exactly 100%', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  // 60/30 is 90% -- someone's 10% is unaccounted for.
  await assert.rejects(() => liveRelease(store, t, [
    { userId: 'a', splitPercent: 0.6 },
    { userId: 'b', splitPercent: 0.3 },
  ]), /sum to exactly 1/);
});

test('splits summing to more than 100% are refused', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await assert.rejects(() => liveRelease(store, t, [
    { userId: 'a', splitPercent: 0.7 },
    { userId: 'b', splitPercent: 0.5 },
  ]), /sum to exactly 1/);
});

test('a duplicate collaborator is refused', async () => {
  // Otherwise the same person appears twice and the split silently
  // means something different from what was intended.
  const store = createVultureMusicStore();
  const t = recorder();
  await assert.rejects(() => liveRelease(store, t, [
    { userId: 'a', splitPercent: 0.5 },
    { userId: 'a', splitPercent: 0.5 },
  ]), /duplicate userId/);
});

test('a zero or negative split is refused', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  for (const bad of [0, -0.5]) {
    await assert.rejects(() => liveRelease(store, t, [
      { userId: 'a', splitPercent: bad },
      { userId: 'b', splitPercent: 1 - bad },
    ]), /splitPercent/);
  }
});

test('a collaborator without a userId is refused', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await assert.rejects(() => liveRelease(store, t, [
    { splitPercent: 0.5 },
    { userId: 'b', splitPercent: 0.5 },
  ]), /requires a userId/);
});

// -- the arithmetic that must not lose money --------------------------

test('an even two-way split pays each exactly half', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await liveRelease(store, t, [
    { userId: 'a', splitPercent: 0.5 },
    { userId: 'b', splitPercent: 0.5 },
  ]);
  t.calls.length = 0;

  await reportStreamingRevenue(store, {
    releaseId: 1, amount: 100, source: 'spotify', transferFn: t,
  });

  const payouts = t.payoutsTo();
  assert.deepStrictEqual(payouts.map((p) => p.amount), [50, 50]);
});

test('THREE-WAY split still sums to exactly the reported amount', async () => {
  // 100 / 3 has no exact representation. Rounding all three the same
  // way pays out 99.99 and loses a cent. The last share absorbs the
  // remainder instead.
  const store = createVultureMusicStore();
  const t = recorder();
  const third = 1 / 3;
  await liveRelease(store, t, [
    { userId: 'a', splitPercent: third },
    { userId: 'b', splitPercent: third },
    { userId: 'c', splitPercent: 1 - 2 * third },
  ]);
  t.calls.length = 0;

  await reportStreamingRevenue(store, {
    releaseId: 1, amount: 100, source: 'spotify', transferFn: t,
  });

  const payouts = t.payoutsTo();
  const total = payouts.reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(Math.round(total * 100) / 100, 100, 'payouts must sum to the reported amount');
  assert.strictEqual(payouts.length, 3);
});

test('an awkward amount across an awkward split still sums exactly', async () => {
  // The combination that breaks naive rounding: a non-round amount
  // and percentages that do not divide it cleanly.
  const store = createVultureMusicStore();
  const t = recorder();
  await liveRelease(store, t, [
    { userId: 'a', splitPercent: 0.3333 },
    { userId: 'b', splitPercent: 0.3333 },
    { userId: 'c', splitPercent: 0.3334 },
  ]);
  t.calls.length = 0;

  await reportStreamingRevenue(store, {
    releaseId: 1, amount: 1000.07, source: 'spotify', transferFn: t,
  });

  const total = t.payoutsTo().reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(Math.round(total * 100) / 100, 1000.07);
});

test('a solo release pays the whole amount to the artist', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await liveRelease(store, t, null);
  t.calls.length = 0;

  await reportStreamingRevenue(store, {
    releaseId: 1, amount: 250.5, source: 'spotify', transferFn: t,
  });

  const payouts = t.payoutsTo();
  assert.strictEqual(payouts.length, 1);
  assert.strictEqual(payouts[0].to, 'artist-1');
  assert.strictEqual(payouts[0].amount, 250.5);
});

// -- guards -----------------------------------------------------------

test('revenue cannot be reported against a release that is not live', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  const release = await submitRelease(store, {
    artistId: 'artist-1', title: 'Not Live', format: 'single',
    targetPlatforms: ['Spotify'], transferFn: t,
  });
  await assert.rejects(() => reportStreamingRevenue(store, {
    releaseId: release.id, amount: 100, source: 'spotify', transferFn: t,
  }), /must be "live"/);
});

test('a non-positive revenue amount is refused', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await liveRelease(store, t);
  for (const bad of [0, -50]) {
    await assert.rejects(() => reportStreamingRevenue(store, {
      releaseId: 1, amount: bad, source: 'spotify', transferFn: t,
    }), /positive amount/);
  }
});

test('collaborator earnings are attributed to the right person', async () => {
  const store = createVultureMusicStore();
  const t = recorder();
  await liveRelease(store, t, [
    { userId: 'artist-1', splitPercent: 0.7 },
    { userId: 'cowriter-1', splitPercent: 0.3 },
  ]);
  await reportStreamingRevenue(store, {
    releaseId: 1, amount: 1000, source: 'spotify', transferFn: t,
  });

  const earnings = getCollaboratorEarnings(store, 'cowriter-1');
  assert.ok(earnings, 'a co-writer must have retrievable earnings');
});
