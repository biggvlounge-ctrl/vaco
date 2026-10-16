// Vaco Assistant -- same module as vaco-shell/test/explore.test.js,
// copied along with lib/explore.js. Each source is faked through an
// injected fetchFn so these stay fast and deterministic while still
// proving the real fail-soft-per-source contract.

const test = require('node:test');
const assert = require('node:assert');

const { getProfileSummary, getRecentActivity } = require('../lib/explore');

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    for (const [match, result] of responses) {
      if (url.includes(match)) return result;
    }
    throw new Error(`fakeFetch: no stub for ${url}`);
  };
  fn.calls = calls;
  return fn;
}

test('getProfileSummary reports every source ok when all four are up', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/balance/', { ok: true, data: { balance: 120 } }],
    ['/articles', { ok: true, data: { articles: [{ id: 1 }, { id: 2 }] } }],
    ['/subscribers', { ok: true, data: { subscribers: [{ id: 1 }] } }],
    ['/progress', { ok: true, data: { referralCount: 3 } }],
    ['/entries', { ok: true, data: { entries: [{ id: 1 }, { id: 2 }, { id: 3 }] } }],
  ]);

  const summary = await getProfileSummary('u1', { fetchFn });

  assert.equal(summary.wallet.balance, 120);
  assert.equal(summary.vxllage.articleCount, 2);
  assert.equal(summary.vxllage.subscriberCount, 1);
  assert.equal(summary.voken.referralCount, 3);
  assert.equal(summary.vago.entryCount, 3);
});

test('one source being down reports its own error without blanking the others', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/balance/', { ok: true, data: { balance: 120 } }],
    ['/articles', { ok: false, error: 'unreachable: ECONNREFUSED' }],
    ['/subscribers', { ok: true, data: { subscribers: [] } }],
    ['/progress', { ok: true, data: { referralCount: 3 } }],
    ['/entries', { ok: true, data: { entries: [] } }],
  ]);

  const summary = await getProfileSummary('u1', { fetchFn });

  assert.equal(summary.wallet.ok, true);
  assert.equal(summary.vxllage.ok, false);
  assert.match(summary.vxllage.error, /ECONNREFUSED/);
  assert.equal(summary.voken.ok, true);
});

test('getRecentActivity sorts most-recent-first and marks direction', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/transactions/', {
      ok: true,
      data: {
        transactions: [
          { id: 1, fromUserId: 'u1', toUserId: 'u2', amount: 10, reason: 'tip', timestamp: 100 },
          { id: 2, fromUserId: 'u2', toUserId: 'u1', amount: 25, reason: 'referral payout', timestamp: 300 },
        ],
      },
    }],
  ]);

  const activity = await getRecentActivity('u1', { fetchFn });

  assert.equal(activity.ok, true);
  assert.deepEqual(activity.items.map((i) => i.id), [2, 1]);
  assert.equal(activity.items[0].direction, 'in');
});

test('getRecentActivity surfaces a real failure as ok:false with an empty feed', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/transactions/', { ok: false, error: 'unreachable: ECONNREFUSED' }],
  ]);

  const activity = await getRecentActivity('u1', { fetchFn });

  assert.equal(activity.ok, false);
  assert.deepEqual(activity.items, []);
});
