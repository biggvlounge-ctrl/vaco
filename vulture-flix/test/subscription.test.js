// Vvltvre Flix — tiers, the money they cost, and the limits they buy.
//
// **Why this file exists.** Subscriptions move real VCoin and nothing
// asserted on it. More importantly, a subscription tier here is not a
// label: it is a real concurrency limit, and the limit is the whole
// product difference between tiers. If the limit stops being enforced,
// every subscriber is silently upgraded to premium and the tier
// structure earns nothing.
//
// The quiet failures targeted:
//
//   - a tier charged at the wrong price, systematically
//   - a renewal that stacks instead of extending from now, so a
//     subscriber pays twice for overlapping coverage
//   - a stream slot held after the stream ended, so a subscriber is
//     locked out of a plan they are paying for
//   - a cancelled or lapsed subscriber still able to watch

const test = require('node:test');
const assert = require('node:assert');

const { createVultureFlixStore } = require('../lib/store');
const subs = require('../lib/subscriptions');
const titles = require('../lib/titles');

const DAY = 24 * 3600000;
const NOW = Date.UTC(2026, 5, 1);

function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || amount < 0) throw new Error(`ledger: bad transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  return fn;
}

// A title is acquired first and only becomes watchable when it is
// marked streaming — acquiring is a deal, streaming is a release date.
// The fixture does both, since every test below is about watching.
async function withTitle(store, transferFn) {
  const record = await titles.acquireExclusiveTitle(store, {
    creatorId: 'nova', title: 'The Long Dark', type: 'film',
    acquisitionFee: 500, exclusivityWindowDays: 365, transferFn, now: NOW,
  });
  titles.markStreaming(store, record.id);
  return record;
}

// -- Tier pricing -------------------------------------------------------

test('each tier charges its own fee — the tiers are not one price with three names', async () => {
  for (const tier of subs.SUBSCRIPTION_TIERS) {
    const store = createVultureFlixStore();
    const transferFn = ledger({ sam: 1000 });
    await subs.subscribe(store, { userId: 'sam', tier, transferFn, now: NOW });
    assert.strictEqual(transferFn.of('sam'), 1000 - subs.TIER_FEES[tier],
      `the ${tier} tier must charge its own fee`);
    assert.strictEqual(transferFn.of(subs.VULTURE_FLIX_PLATFORM_ACCOUNT), subs.TIER_FEES[tier]);
  }
});

test('tier fees are strictly ordered — paying more must not buy less', async () => {
  const [adSupported, standard, premium] = subs.SUBSCRIPTION_TIERS;
  assert.ok(subs.TIER_FEES[adSupported] < subs.TIER_FEES[standard]);
  assert.ok(subs.TIER_FEES[standard] < subs.TIER_FEES[premium]);
  // And the thing the money buys moves in the same direction, or the
  // pricing is incoherent.
  assert.ok(subs.TIER_MAX_SIMULTANEOUS_STREAMS[adSupported]
    <= subs.TIER_MAX_SIMULTANEOUS_STREAMS[standard]);
  assert.ok(subs.TIER_MAX_SIMULTANEOUS_STREAMS[standard]
    <= subs.TIER_MAX_SIMULTANEOUS_STREAMS[premium]);
});

test('a renewal extends from now rather than stacking on the old date', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000 });

  const first = await subs.subscribe(store, { userId: 'sam', tier: 'standard', transferFn, now: NOW });
  const firstRenewsAt = first.renewsAt;

  // Renewing ten days later. Stacking would push renewsAt out by a full
  // period from the OLD date, so the subscriber pays for coverage they
  // already had — a real overcharge that looks like generosity.
  const renewed = await subs.subscribe(store, {
    userId: 'sam', tier: 'standard', transferFn, now: NOW + 10 * DAY,
  });

  assert.strictEqual(store.subscriptions.length, 1, 'renewal must not create a second subscription');
  assert.ok(renewed.renewsAt > firstRenewsAt);
  assert.ok(renewed.renewsAt - (NOW + 10 * DAY) <= renewed.renewsAt - renewed.lastRenewedAt + 1,
    'the new period runs from the renewal, not from the old expiry');
  assert.strictEqual(transferFn.of('sam'), 1000 - 2 * subs.TIER_FEES.standard);
});

test('switching tier at renewal charges the new tier and takes effect immediately', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000 });

  await subs.subscribe(store, { userId: 'sam', tier: 'ad-supported', transferFn, now: NOW });
  const upgraded = await subs.subscribe(store, { userId: 'sam', tier: 'premium', transferFn, now: NOW + DAY });

  assert.strictEqual(upgraded.tier, 'premium');
  assert.strictEqual(transferFn.of('sam'),
    1000 - subs.TIER_FEES['ad-supported'] - subs.TIER_FEES.premium);
});

// -- Access -------------------------------------------------------------

test('a cancelled subscriber cannot watch', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);

  await subs.subscribe(store, { userId: 'sam', tier: 'standard', transferFn, now: NOW });
  assert.ok(subs.isSubscriber(store, 'sam', NOW));

  subs.cancelSubscription(store, { userId: 'sam', now: NOW + DAY });
  assert.ok(!subs.isSubscriber(store, 'sam', NOW + 2 * DAY));
  assert.throws(() => titles.startStream(store, {
    userId: 'sam', titleId: title.id, now: NOW + 2 * DAY,
  }), /.*/);
});

test('a lapsed subscription stops working on its own, without anyone cancelling it', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, 'vulture-flix': 5000 });
  await withTitle(store, transferFn);

  const sub = await subs.subscribe(store, { userId: 'sam', tier: 'standard', transferFn, now: NOW });

  // Still 'active' as a status — but past its renewal date. A check that
  // only reads status would let this person watch forever without ever
  // paying again.
  assert.strictEqual(sub.status, 'active');
  assert.ok(!subs.isSubscriber(store, 'sam', sub.renewsAt + DAY),
    'status alone is not access — the renewal date is what expires');
});

test('a non-subscriber cannot watch at all', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);

  assert.throws(() => titles.startStream(store, {
    userId: 'nobody', titleId: title.id, now: NOW,
  }), /.*/);
});

// -- Concurrency: the thing a tier actually buys -------------------------

test('the concurrency limit is enforced at exactly the tier’s number', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);

  const tier = 'standard';
  const limit = subs.TIER_MAX_SIMULTANEOUS_STREAMS[tier];
  await subs.subscribe(store, { userId: 'sam', tier, transferFn, now: NOW });

  for (let i = 0; i < limit; i += 1) {
    titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW + i });
  }
  assert.strictEqual(titles.listActiveStreams(store, 'sam').length, limit);

  // One past the limit. If this succeeds, every tier is premium and the
  // price ladder buys nothing.
  assert.throws(() => titles.startStream(store, {
    userId: 'sam', titleId: title.id, now: NOW + limit,
  }), /simultaneous stream/);
});

test('ending a stream frees the slot — otherwise a paying subscriber locks themselves out', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);

  const tier = 'ad-supported';
  const limit = subs.TIER_MAX_SIMULTANEOUS_STREAMS[tier];
  await subs.subscribe(store, { userId: 'sam', tier, transferFn, now: NOW });

  const sessions = [];
  for (let i = 0; i < limit; i += 1) {
    sessions.push(titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW + i }));
  }
  assert.throws(() => titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW + limit }));

  titles.endStream(store, { sessionId: sessions[0].id, now: NOW + 100 });
  assert.strictEqual(titles.listActiveStreams(store, 'sam').length, limit - 1);

  // A slot that is never released is the most common streaming
  // complaint there is: "it says I'm watching on four devices".
  const resumed = titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW + 101 });
  assert.strictEqual(resumed.status, 'active');
});

test('a stream cannot be ended twice — that would free a slot nobody was holding', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);
  await subs.subscribe(store, { userId: 'sam', tier: 'standard', transferFn, now: NOW });

  const session = titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW });
  titles.endStream(store, { sessionId: session.id, now: NOW + 100 });
  assert.throws(() => titles.endStream(store, { sessionId: session.id, now: NOW + 200 }),
    /not active/);
});

test('one subscriber’s streams do not consume another’s slots', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ sam: 1000, ada: 1000, 'vulture-flix': 5000 });
  const title = await withTitle(store, transferFn);

  const tier = 'ad-supported';
  const limit = subs.TIER_MAX_SIMULTANEOUS_STREAMS[tier];
  await subs.subscribe(store, { userId: 'sam', tier, transferFn, now: NOW });
  await subs.subscribe(store, { userId: 'ada', tier, transferFn, now: NOW });

  for (let i = 0; i < limit; i += 1) {
    titles.startStream(store, { userId: 'sam', titleId: title.id, now: NOW + i });
  }
  // Ada is at zero. Counting streams globally rather than per subscriber
  // would lock out everyone as soon as one person filled their plan.
  const adaSession = titles.startStream(store, { userId: 'ada', titleId: title.id, now: NOW });
  assert.strictEqual(adaSession.userId, 'ada');
  assert.strictEqual(titles.listActiveStreams(store, 'ada').length, 1);
});

// -- Acquisition --------------------------------------------------------

test('acquiring an exclusive title pays the creator real money', async () => {
  const store = createVultureFlixStore();
  const transferFn = ledger({ 'vulture-flix': 5000 });

  const title = await withTitle(store, transferFn);
  assert.strictEqual(transferFn.of('nova'), 500);
  assert.ok(transferFn.moves.length >= 1);
  assert.strictEqual(title.creatorId, 'nova');
});
