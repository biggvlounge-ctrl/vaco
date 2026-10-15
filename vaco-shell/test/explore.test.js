// vaco-shell -- "explore page, but for your own apps." Each source is
// faked through an injected fetchFn (same real pattern
// personalAssistant.test.js already uses for insightFn/invokeFn) so
// these stay fast and deterministic while still proving the real
// fail-soft-per-source contract: one source being down must not blank
// the others.

import test from 'node:test';
import assert from 'node:assert';

import { getProfileSummary, getRecentActivity } from '../lib/explore.js';

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
    ['/api/vcoin/balance/', { ok: true, data: { userId: 'u1', balance: 120 } }],
    ['/articles', { ok: true, data: { articles: [{ id: 1 }, { id: 2 }] } }],
    ['/subscribers', { ok: true, data: { subscribers: [{ id: 1 }] } }],
    ['/progress', { ok: true, data: { userId: 'u1', referralCount: 3 } }],
    ['/entries', { ok: true, data: { entries: [{ id: 1 }, { id: 2 }, { id: 3 }] } }],
  ]);

  const summary = await getProfileSummary('u1', { fetchFn });

  assert.equal(summary.userId, 'u1');
  assert.equal(summary.wallet.ok, true);
  assert.equal(summary.wallet.balance, 120);
  assert.equal(summary.vxllage.ok, true);
  assert.equal(summary.vxllage.articleCount, 2);
  assert.equal(summary.vxllage.subscriberCount, 1);
  assert.equal(summary.voken.ok, true);
  assert.equal(summary.voken.referralCount, 3);
  assert.equal(summary.vago.ok, true);
  assert.equal(summary.vago.entryCount, 3);
});

test('one source being down reports its own error without blanking the others', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/balance/', { ok: true, data: { userId: 'u1', balance: 120 } }],
    ['/articles', { ok: false, error: 'unreachable: ECONNREFUSED' }],
    ['/subscribers', { ok: true, data: { subscribers: [{ id: 1 }] } }],
    ['/progress', { ok: true, data: { userId: 'u1', referralCount: 3 } }],
    ['/entries', { ok: true, data: { entries: [] } }],
  ]);

  const summary = await getProfileSummary('u1', { fetchFn });

  assert.equal(summary.wallet.ok, true, 'VCoin must still answer when VXLLAGE is down');
  assert.equal(summary.wallet.balance, 120);
  assert.equal(summary.vxllage.ok, false);
  assert.equal(summary.vxllage.articleCount, null);
  assert.match(summary.vxllage.error, /ECONNREFUSED/);
  assert.equal(summary.voken.ok, true, 'VOKEN must still answer when VXLLAGE is down');
  assert.equal(summary.vago.ok, true);
});

test('VXLLAGE reports down if either its articles or subscribers call fails', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/balance/', { ok: true, data: { balance: 0 } }],
    ['/articles', { ok: true, data: { articles: [] } }],
    ['/subscribers', { ok: false, error: 'unreachable: timeout' }],
    ['/progress', { ok: true, data: { referralCount: 0 } }],
    ['/entries', { ok: true, data: { entries: [] } }],
  ]);

  const summary = await getProfileSummary('u1', { fetchFn });

  assert.equal(summary.vxllage.ok, false);
  assert.match(summary.vxllage.error, /timeout/);
});

test('getRecentActivity sorts real V3 transactions most-recent-first and marks direction from this user\'s side', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/transactions/', {
      ok: true,
      data: {
        transactions: [
          { id: 1, fromUserId: 'u1', toUserId: 'u2', amount: 10, reason: 'tip', timestamp: 100 },
          { id: 2, fromUserId: 'u2', toUserId: 'u1', amount: 25, reason: 'referral payout', timestamp: 300 },
          { id: 3, fromUserId: 'u1', toUserId: 'u3', amount: 5, reason: 'merch', timestamp: 200 },
        ],
      },
    }],
  ]);

  const activity = await getRecentActivity('u1', { fetchFn });

  assert.equal(activity.ok, true);
  assert.equal(activity.items.length, 3);
  assert.deepEqual(activity.items.map((i) => i.id), [2, 3, 1], 'most recent timestamp first');
  assert.equal(activity.items[0].direction, 'in');
  assert.equal(activity.items[0].counterparty, 'u2');
  assert.equal(activity.items[1].direction, 'out');
  assert.equal(activity.items[1].counterparty, 'u3');
});

test('getRecentActivity respects the limit', async () => {
  const transactions = Array.from({ length: 5 }, (_, i) => ({
    id: i, fromUserId: 'other', toUserId: 'u1', amount: 1, reason: 'x', timestamp: i,
  }));
  const fetchFn = fakeFetch([
    ['/api/vcoin/transactions/', { ok: true, data: { transactions } }],
  ]);

  const activity = await getRecentActivity('u1', { fetchFn, limit: 2 });

  assert.equal(activity.items.length, 2);
  assert.deepEqual(activity.items.map((i) => i.id), [4, 3]);
});

test('getRecentActivity surfaces a real failure as ok:false with an empty feed, never a fabricated one', async () => {
  const fetchFn = fakeFetch([
    ['/api/vcoin/transactions/', { ok: false, error: 'unreachable: ECONNREFUSED' }],
  ]);

  const activity = await getRecentActivity('u1', { fetchFn });

  assert.equal(activity.ok, false);
  assert.match(activity.error, /ECONNREFUSED/);
  assert.deepEqual(activity.items, []);
});
