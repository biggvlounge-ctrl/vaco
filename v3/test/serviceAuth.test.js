// V3 -- trusted-service allowlist.
//
// Covers the gap shieldAuth.js:46 left open: a request with no
// Authorization header at all previously reached the money routes
// unauthenticated. These tests pin the three modes and, just as
// importantly, pin that `observe` still lets traffic through -- a
// regression that silently turned observe into enforce would take
// down eighteen integrations.

const test = require('node:test');
const assert = require('node:assert');

const {
  readMode, parseServiceTokens, tokensMatch, createServiceAuth, DEFAULT_MODE,
} = require('../lib/serviceAuth.cjs');

function run(auth, { method = 'POST', headers = {} } = {}) {
  const req = { method, headers };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let passed = false;
  auth.middleware(req, res, () => { passed = true; });
  return { passed, res, req };
}

// -- config parsing ---------------------------------------------------

test('the default mode is enforce -- an unconfigured V3 refuses, it does not wave through', () => {
  // **This assertion was inverted, and the inversion mattered.** It
  // used to require `observe`, which was the correct migration default
  // while the 18 integrations were being wired: allow unauthenticated
  // writes, record who they came from.
  //
  // The wiring is done — every calling app now sends X-Service-Name
  // and X-Service-Token — so `observe` stopped being a migration tool
  // and became a live hole. Combined with the old `optionalOwnAccount`
  // on the transfer route, an unauthenticated `POST /api/vcoin/transfer`
  // drained a stranger's wallet. Verified against a running instance
  // before the fix; 401 after it.
  //
  // The test is pinned this way round on purpose: a future "restore the
  // safe migration default" would reopen it, and this is what says no.
  assert.strictEqual(DEFAULT_MODE, 'enforce');
  assert.strictEqual(readMode({}), 'enforce',
    'an operator who sets nothing must get the safe behaviour, not the permissive one');

  // `observe` and `off` remain reachable — deliberately. They are the
  // right tools for onboarding a new caller, just not the right default.
  assert.strictEqual(readMode({ VACO_SERVICE_AUTH_MODE: 'observe' }), 'observe');
  assert.strictEqual(readMode({ VACO_SERVICE_AUTH_MODE: 'off' }), 'off');
});

test('an unknown mode throws at startup rather than failing open', () => {
  assert.throws(() => readMode({ VACO_SERVICE_AUTH_MODE: 'enforcce' }), /must be one of/);
});

test('service tokens parse into per-service secrets', () => {
  const tokens = parseServiceTokens('voken:secret-A, void:secret-B');
  assert.strictEqual(tokens.get('voken'), 'secret-A');
  assert.strictEqual(tokens.get('void'), 'secret-B');
});

test('a malformed token entry throws instead of silently dropping a service', () => {
  // Silently skipping would surface much later as a confusing 401.
  assert.throws(() => parseServiceTokens('voken'), /serviceName:token/);
  assert.throws(() => parseServiceTokens('voken:'), /serviceName:token/);
  assert.throws(() => parseServiceTokens(':secret'), /serviceName:token/);
});

test('empty config is valid and yields an empty allowlist', () => {
  assert.strictEqual(parseServiceTokens('').size, 0);
  assert.strictEqual(parseServiceTokens(undefined).size, 0);
});

test('token comparison rejects mismatches including length differences', () => {
  assert.strictEqual(tokensMatch('abc', 'abc'), true);
  assert.strictEqual(tokensMatch('abc', 'abd'), false);
  assert.strictEqual(tokensMatch('abc', 'abcd'), false);
  assert.strictEqual(tokensMatch(undefined, 'abc'), false);
});

// -- mode: off --------------------------------------------------------

test('mode off passes everything through -- the original behavior', () => {
  const auth = createServiceAuth({ mode: 'off', tokens: new Map() });
  assert.strictEqual(run(auth).passed, true);
});

// -- mode: observe ----------------------------------------------------

test('observe ALLOWS unauthenticated writes -- it must not break callers', () => {
  const auth = createServiceAuth({ mode: 'observe', tokens: new Map() });
  assert.strictEqual(run(auth).passed, true);
});

test('observe records who called unauthenticated, by name when given', () => {
  const auth = createServiceAuth({ mode: 'observe', tokens: new Map() });
  run(auth, { headers: { 'x-service-name': 'voken' } });
  run(auth, { headers: { 'x-service-name': 'voken' } });
  run(auth, {});

  const byName = Object.fromEntries(
    auth.describe().unauthenticatedCallers.map((c) => [c.name, c.count]),
  );
  assert.strictEqual(byName.voken, 2);
  assert.strictEqual(byName['(anonymous)'], 1);
});

test('describe() never leaks token values', () => {
  const auth = createServiceAuth({
    mode: 'observe', tokens: new Map([['voken', 'super-secret']]),
  });
  assert.ok(!JSON.stringify(auth.describe()).includes('super-secret'));
  assert.deepStrictEqual(auth.describe().allowlistedServices, ['voken']);
});

// -- mode: enforce ----------------------------------------------------

test('enforce rejects an unauthenticated write with 401', () => {
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map() });
  const { passed, res } = run(auth);
  assert.strictEqual(passed, false);
  assert.strictEqual(res.statusCode, 401);
});

test('enforce admits a valid service credential and tags the request', () => {
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map([['voken', 'secret-A']]) });
  const { passed, req } = run(auth, {
    headers: { 'x-service-name': 'voken', 'x-service-token': 'secret-A' },
  });
  assert.strictEqual(passed, true);
  assert.strictEqual(req.callingService, 'voken');
});

test('enforce rejects a wrong token, and an unknown service using a real token', () => {
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map([['voken', 'secret-A']]) });

  assert.strictEqual(run(auth, {
    headers: { 'x-service-name': 'voken', 'x-service-token': 'wrong' },
  }).passed, false);

  // A real token presented under a name it was not issued to.
  assert.strictEqual(run(auth, {
    headers: { 'x-service-name': 'attacker', 'x-service-token': 'secret-A' },
  }).passed, false);
});

test('a user session satisfies enforce without any service token', () => {
  // Browser traffic carries a Shield session, not a service credential.
  // optionalOwnAccount still checks it downstream; this layer only
  // needs to see that the caller is not anonymous.
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map() });
  assert.strictEqual(run(auth, {
    headers: { authorization: 'Bearer some-session-token' },
  }).passed, true);
});

test('reads are never gated, in any mode', () => {
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map() });
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.strictEqual(run(auth, { method }).passed, true, `${method} should pass`);
  }
});

test('every mutating method is gated, not just POST', () => {
  const auth = createServiceAuth({ mode: 'enforce', tokens: new Map() });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.strictEqual(run(auth, { method }).passed, false, `${method} should be gated`);
  }
});
