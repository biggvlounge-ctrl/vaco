// VENVS — the browser Shield client, and the one branch in it that
// destroys something.
//
// **Why this file exists when the suite says client modules are not
// tested.** `venvs/test/venvs.test.js` states that the `*Client.js`
// modules are deliberately uncovered, because they are thin `fetch`
// wrappers and a test for one would be a test of `fetch`. That reason
// is sound and it does not extend to this module: `getCurrentSession`
// does not merely forward a call, it decides whether to **delete the
// user's session token from localStorage**. That is a destructive
// branch with a real user consequence, and it was wrong.
//
// The bug: the function parsed the response and treated any falsy
// `body.valid` as "expired", then cleared the token. A Shield answering
// 503 with a JSON error body carries no `valid` field, so a transient
// outage deleted every browser user's token — logging them out
// permanently instead of for the length of the outage, because the
// token is gone and cannot come back when Shield does.
//
// Shield answers `404 {"valid": false}` for a token it genuinely does
// not know. That IS a verdict, and the token should go. The distinction
// between the two is the whole fix, so both directions are asserted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'venvs.shield.sessionToken';

// A localStorage that behaves like the real one, so "was the token
// cleared?" is a question this test can actually ask.
function withStorage(initial) {
  const map = new Map(Object.entries(initial));
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return { map, restore: () => { globalThis.localStorage = original; } };
}

function withFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = original; };
}

// Imported after the globals exist, because the module reads them at
// call time but the import itself must not explode in Node.
const { getCurrentSession } = await import('../src/lib/shieldAuth.js');

test('a live session is returned and the token is kept', async () => {
  const store = withStorage({ [KEY]: 'tok-live' });
  const restore = withFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ valid: true, userId: 'ada', expiresAt: Date.now() + 3600000 }),
  }));
  try {
    const session = await getCurrentSession();
    assert.equal(session.userId, 'ada');
    assert.equal(store.map.get(KEY), 'tok-live', 'a valid session must not clear the token');
  } finally { restore(); store.restore(); }
});

test('a token Shield does not know is cleared — that is a real verdict', async () => {
  const store = withStorage({ [KEY]: 'tok-stale' });
  const restore = withFetch(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ valid: false }),
  }));
  try {
    assert.equal(await getCurrentSession(), null);
    assert.equal(store.map.has(KEY), false,
      'Shield ruled the token unknown, so keeping it would strand the user on a dead session');
  } finally { restore(); store.restore(); }
});

test('a Shield outage answering 5xx does NOT clear the token', async () => {
  const store = withStorage({ [KEY]: 'tok-live' });
  const restore = withFetch(async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: 'shield: database unavailable' }),
  }));
  try {
    assert.equal(await getCurrentSession(), null, 'signed out for now is correct');
    assert.equal(store.map.get(KEY), 'tok-live',
      'the outage deleted the token — the user is logged out permanently over a transient failure');
  } finally { restore(); store.restore(); }
});

test('an unreachable Shield does NOT clear the token', async () => {
  const store = withStorage({ [KEY]: 'tok-live' });
  const restore = withFetch(async () => { throw new Error('ECONNREFUSED'); });
  try {
    assert.equal(await getCurrentSession(), null);
    assert.equal(store.map.get(KEY), 'tok-live', 'unreachable is not a verdict on the token');
  } finally { restore(); store.restore(); }
});

test('an HTML error page does NOT clear the token', async () => {
  // A proxy in front of Shield can answer 200 with an HTML error page.
  // res.json() throws on it, and an uncaught throw here would both lose
  // the token and reject where every caller expects null.
  const store = withStorage({ [KEY]: 'tok-live' });
  const restore = withFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
  }));
  try {
    assert.equal(await getCurrentSession(), null, 'must return null, not reject');
    assert.equal(store.map.get(KEY), 'tok-live');
  } finally { restore(); store.restore(); }
});
