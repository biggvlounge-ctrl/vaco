// VASH TAP — does the server start, seed the §46 demo, and do its
// guards actually refuse?
//
// Spawns the real process rather than importing it, matching
// v4-proxy/test/server.test.js's own reasoning: `server.js` calls
// `app.listen` at module scope, an in-process import cannot exercise
// that the way production actually boots it, and a spawned child is
// what a real deploy does. Neither Shield, VACA, HVNTZ, nor V3 are
// running in this suite — that is deliberate. It proves two things a
// mocked-fetch unit test cannot: that a session-gated route asks
// Shield and gets a real 502 rather than hanging when Shield is down
// (see shieldAuth.cjs's own resolveSession), and that the public
// resolve route fails soft rather than hard when VACA is unreachable
// — the exact regression this build's own fix (lib/tap.js resolveTap)
// exists to hold.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vash-tap/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18825;
const BASE = `http://127.0.0.1:${PORT}`;

let child;
let bootLog = '';

async function waitForHealth(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return res;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(`vash-tap did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  // The store path is fixed (computed from __dirname in server.js, not
  // overridable via env) — clear any leftover file from a previous run
  // so this suite always boots from an empty store and re-seeds.
  fs.rmSync(path.join(APP_DIR, 'data', 'store.json'), { force: true });

  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Point every cross-app URL at a closed port on purpose — this
      // suite tests the unreachable-dependency behavior, not a live
      // ecosystem. `resolveHvntzBusiness` and resolveTap's fail-soft
      // identityFetchFn wrapper both exist specifically to make that
      // safe rather than a hang.
      V3_API_URL: 'http://127.0.0.1:1',
      VACA_API_URL: 'http://127.0.0.1:1',
      HVNTZ_API_URL: 'http://127.0.0.1:1',
      VACO_NOTIFY_URL: 'http://127.0.0.1:1',
      SHIELD_API_URL: 'http://127.0.0.1:1',
      VACO_SERVICE_TOKENS: '',
      VACO_SERVICE_AUTH_MODE: 'enforce',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { bootLog += d; });
  child.stderr.on('data', (d) => { bootLog += d; });

  await waitForHealth();
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
  // Remove the store this run wrote so a repeat run re-seeds from
  // empty instead of silently reusing a previous run's Tap IDs.
  fs.rmSync(path.join(APP_DIR, 'data', 'store.json'), { force: true });
});

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

// -- boot ------------------------------------------------------------------

test('the server starts, serves health, and seeded the §46 demo', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'vash-tap');
  assert.equal(health.taps, 5, 'HUNT Barber Shop should seed exactly Chair 1 through 5');
  assert.equal(health.assignments, 5, 'each seeded chair should have a demo barber assigned');
  assert.ok(health.serviceAuth, 'health does not report serviceAuth — is the middleware mounted?');
  assert.equal(health.serviceAuth.mode, 'enforce');
});

test('the boot output carries no ReferenceError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError/.test(bootLog), `vash-tap logged a ReferenceError while starting:\n${bootLog}`);
});

// -- the public resolve route -----------------------------------------------

test('GET /api/taps/:tapCode/resolve needs no session and returns the seeded chair', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps/VT-000001/resolve`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tap.tapCode, 'VT-000001');
  assert.equal(body.tap.businessId, 9001);
  assert.equal(body.payable, true);
  assert.ok(body.assignment, 'the seeded chair should have a current assignment');
  // HVNTZ is unreachable for this whole suite, same as VACA — business
  // resolution must fail soft here too, not take the route down.
  assert.strictEqual(body.business, null);
});

test('resolve fails soft when VACA is unreachable — the regression this build fixed', { skip: SKIP }, async () => {
  // VACA_API_URL points at a closed port for this whole suite. Before
  // lib/tap.js's resolveTap wrapped identityFetchFn in try/catch, this
  // request threw inside the route and came back as an opaque
  // "fetch failed" 404. It must now succeed with the identity check
  // reported as unknown, not refuse the whole resolution.
  const res = await fetch(`${BASE}/api/taps/VT-000001/resolve`);
  assert.equal(res.status, 200, 'a VACA outage must not turn a public resolve into an error');
  const body = await res.json();
  assert.equal(body.assigneeVerified, null);
});

test('GET /api/taps/:tapCode/resolve on an unknown tap is 404', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps/VT-999999/resolve`);
  assert.equal(res.status, 404);
});

test('GET /api/taps/:tapCode and /api/business/:businessId/taps need no session', { skip: SKIP }, async () => {
  const tap = await (await fetch(`${BASE}/api/taps/VT-000002`)).json();
  assert.equal(tap.tapCode, 'VT-000002');

  const list = await (await fetch(`${BASE}/api/business/9001/taps`)).json();
  assert.equal(list.taps.length, 5);
});

// -- the guards --------------------------------------------------------------

test('POST /api/taps refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/taps', { tapType: 'business', businessId: 9001 });
  assert.equal(res.status, 401);
});

test('POST /api/taps/:tapCode/assignments refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/taps/VT-000001/assignments', { assignedIdentityId: 'someone' });
  assert.equal(res.status, 401);
});

test('POST /api/taps/:tapCode/freeze and /unfreeze refuse an anonymous caller', { skip: SKIP }, async () => {
  assert.equal((await post('/api/taps/VT-000002/freeze', {})).status, 401);
  assert.equal((await post('/api/taps/VT-000002/unfreeze', {})).status, 401);
});

test('freeze/unfreeze with a session but no live HVNTZ gets a clean 502, not a hang', { skip: SKIP }, async () => {
  // HVNTZ is unreachable for this whole suite (see test.before), so the
  // ownership check in requireTapBusinessOwner cannot complete either
  // way. This is the same regression coverage as the earlier "junk
  // bearer token" test, for the route this build added afterward.
  const res = await post('/api/taps/VT-000002/freeze', {}, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-session-token',
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 502, `expected 502, got ${res.status}: ${JSON.stringify(body)}`);
});

test('POST /api/taps/:tapCode/pay refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/taps/VT-000001/pay', { fromUserId: 'ada', amount: 40 });
  assert.equal(res.status, 401);
});

test('GET /api/spenders/:userId/history refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/spenders/ada/history`);
  assert.equal(res.status, 401);
});

test('GET /api/business/:businessId/revenue refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/business/9001/revenue`);
  assert.equal(res.status, 401);
});

test('a junk bearer token reaches requireSession and gets a clean 502, not a hang', { skip: SKIP }, async () => {
  // Shield is unreachable for this whole suite. serviceAuth.classify
  // treats any Authorization: Bearer header as a possible user session
  // without verifying it — requireSession is what actually asks
  // Shield, exactly the v4-proxy precedent this test mirrors.
  const res = await post('/api/taps', { tapType: 'business', businessId: 9001 }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-session-token',
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 502, `expected a clean 502 for an unreachable Shield, got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error || ''), /Shield/);
});
