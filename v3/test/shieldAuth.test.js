// The shared Shield auth middleware — requireSession and requireActor.
//
// **This file guards the fix for a live, exploitable vulnerability.**
//
// Every app carried its own `optionalOwnAccount(field)` middleware
// whose first line was `if (!token) return next();`. It was mounted
// alone — no `requireSession` in front — on thirteen money-moving
// routes across ten apps. The guard therefore only engaged for callers
// who *volunteered* a token. Supplying none was the bypass.
//
// Run against this repository before the fix:
//
//   curl -X POST localhost:8811/api/vcoin/transfer \
//     -d '{"fromUserId":"victim","toUserId":"attacker","amount":500}'
//   → 201, 500 VCoin moved, victim's balance 1000 → 500
//
// `requireActor` replaces it. This suite is the thing that keeps the
// hole shut, so every test here is written as "the attack fails",
// not "the happy path works".
//
// Note this file lives in v3/ because that is where the synced copy is
// exercised against the app that matters most. `sync-shared-runtime.sh`
// keeps `shared/shieldAuth.js` and every `<app>/lib/shieldAuth.js`
// byte-identical, and `--check` fails otherwise — so testing one copy
// tests them all, and the sync check is what makes that true.

const test = require('node:test');
const assert = require('node:assert');

const { requireSession, requireActor, optionalOwnAccount } = require('../lib/shieldAuth.cjs');

// A fake Shield. The real one is an HTTP call; swapping global fetch
// keeps these tests fast and, more importantly, lets them assert what
// happens when Shield is *down* — which is a distinct answer from
// "your session is invalid" and easy to get wrong.
function withShield(sessions, { down = false } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (down) throw new Error('ECONNREFUSED');
    const token = decodeURIComponent(String(url).split('/').pop());
    const userId = sessions[token];
    return { json: async () => (userId ? { valid: true, userId, expiresAt: Date.now() + 3600000 } : { valid: false }) };
  };
  return () => { globalThis.fetch = original; };
}

// Runs a middleware against a fake req/res and reports what happened.
async function run(middleware, { headers = {}, body = {} } = {}) {
  const req = { headers, body };
  let status = null;
  let payload = null;
  let passed = false;
  const res = {
    status(code) { status = code; return res; },
    json(data) { payload = data; return res; },
  };
  await middleware(req, res, () => { passed = true; });
  return { passed, status, error: payload && payload.error, req };
}

const AUTH = (token) => ({ authorization: `Bearer ${token}` });

// -- The bypass that existed ---------------------------------------------

test('no Authorization header is 401 — this is the bypass that used to be a 201', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    const result = await run(requireActor('fromUserId'), {
      body: { fromUserId: 'victim', toUserId: 'attacker', amount: 500 },
    });
    assert.strictEqual(result.passed, false, 'the request must not reach the handler');
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /missing Authorization/);
  } finally { restore(); }
});

test('a malformed Authorization header is 401, not a pass', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    for (const authorization of ['', 'tok-ada', 'Basic tok-ada', 'Bearer', 'bearer tok-ada']) {
      const result = await run(requireActor('userId'), {
        headers: { authorization }, body: { userId: 'ada' },
      });
      assert.strictEqual(result.passed, false, `"${authorization}" must not pass`);
      assert.strictEqual(result.status, 401);
    }
  } finally { restore(); }
});

test('a token Shield does not recognise is 401', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    const result = await run(requireActor('userId'), {
      headers: AUTH('tok-forged'), body: { userId: 'ada' },
    });
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.status, 401);
    assert.match(result.error, /invalid or expired/);
  } finally { restore(); }
});

// -- Impersonation --------------------------------------------------------

test('a valid session cannot act as somebody else', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    const result = await run(requireActor('fromUserId'), {
      headers: AUTH('tok-ada'), body: { fromUserId: 'victim', toUserId: 'ada', amount: 500 },
    });
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.status, 403);
    assert.match(result.error, /different user than 'fromUserId'/);
  } finally { restore(); }
});

test('a matching decoy field does not launder a mismatched one', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    // Checking only the *first* present field would let this through:
    // `userId` matches the session, `fromUserId` is the victim. Every
    // named field that is present has to match.
    const result = await run(requireActor('userId', 'fromUserId'), {
      headers: AUTH('tok-ada'), body: { userId: 'ada', fromUserId: 'victim', amount: 500 },
    });
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.status, 403);
    assert.match(result.error, /fromUserId/);
  } finally { restore(); }
});

test('a body that names no actor at all is refused, not waved through', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    // Absence must not mean permission. If a missing field passed, the
    // bypass would be "omit the field" instead of "omit the header" —
    // the same bug wearing a different hat.
    const result = await run(requireActor('fromUserId'), {
      headers: AUTH('tok-ada'), body: { toUserId: 'attacker', amount: 500 },
    });
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.status, 400);
    assert.match(result.error, /must name the acting user/);
  } finally { restore(); }
});

test('null and undefined actors are treated as absent, not as a match', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    for (const value of [null, undefined]) {
      const result = await run(requireActor('userId'), {
        headers: AUTH('tok-ada'), body: { userId: value },
      });
      assert.strictEqual(result.passed, false, `userId: ${String(value)} must not pass`);
      assert.strictEqual(result.status, 400);
    }
  } finally { restore(); }
});

// -- The legitimate path --------------------------------------------------

test('a session acting as itself passes, and the handler learns who it is', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    const result = await run(requireActor('fromUserId'), {
      headers: AUTH('tok-ada'), body: { fromUserId: 'ada', toUserId: 'rio', amount: 25 },
    });
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.req.sessionUserId, 'ada',
      'the handler must be able to trust an identity it did not have to parse');
  } finally { restore(); }
});

test('each route names its own actor field, because the ecosystem never agreed on one', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    // These are the real field names in use across the 30 apps. A
    // single hardcoded field would have meant renaming every API or
    // writing a middleware per app — and writing one per app is exactly
    // how thirteen routes ended up unguarded.
    const fields = ['userId', 'fromUserId', 'buyerId', 'investorId', 'authorId',
      'boosterId', 'requesterId', 'fromOwnerId', 'customerId', 'artistId', 'subscriberId'];
    for (const field of fields) {
      const ok = await run(requireActor(field), { headers: AUTH('tok-ada'), body: { [field]: 'ada' } });
      assert.strictEqual(ok.passed, true, `${field} should pass for its own owner`);
      const bad = await run(requireActor(field), { headers: AUTH('tok-ada'), body: { [field]: 'victim' } });
      assert.strictEqual(bad.status, 403, `${field} should refuse an impersonator`);
    }
  } finally { restore(); }
});

test('requireSession proves identity without claiming to prove authorization', async () => {
  const restore = withShield({ 'tok-ada': 'ada' });
  try {
    // Deliberate: requireSession does NOT look at the body. It is the
    // right guard only for routes with no acting-user field at all, and
    // documenting that here keeps someone from reaching for it as the
    // cheaper option on a route that has one.
    const result = await run(requireSession(), {
      headers: AUTH('tok-ada'), body: { userId: 'somebody-else' },
    });
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.req.sessionUserId, 'ada');
  } finally { restore(); }
});

// -- Shield being down ----------------------------------------------------

test('Shield unreachable is 502, never 401 and never a pass', async () => {
  const restore = withShield({}, { down: true });
  try {
    const result = await run(requireActor('userId'), {
      headers: AUTH('tok-ada'), body: { userId: 'ada' },
    });
    assert.strictEqual(result.passed, false,
      'an outage must not fail open — that would make a DoS on Shield a way in');
    assert.strictEqual(result.status, 502,
      '401 would tell a legitimate user their session expired and train them to re-auth against an outage');
  } finally { restore(); }
});

// -- The removed middleware ------------------------------------------------

test('optionalOwnAccount is gone and says so loudly', () => {
  // Not deprecated, not a console warning: it throws at mount time. A
  // middleware that silently permits anonymous access must not remain
  // available to be reached for, or copy-pasted in from an older app.
  assert.throws(() => optionalOwnAccount('userId'), /has been removed/);
  assert.throws(() => optionalOwnAccount('userId'), /requireActor/);
});

test('requireActor with no field is a mount-time error, not a runtime pass', () => {
  // `requireActor()` with nothing to check would otherwise be a guard
  // that guards nothing while looking like it does.
  assert.throws(() => requireActor(), /at least one body field/);
});
