// VACO Passport — does the server start, seed the demo, and do its
// guards actually refuse?
//
// Spawns the real process rather than importing it, matching
// vash-tap/test/routes.test.js's own reasoning (and v4-proxy's before
// it): `server.js` calls `app.listen` at module scope, an in-process
// import cannot exercise that the way production actually boots it.
// Neither Shield, VACA, HVNTZ, nor V3 are running in this suite —
// deliberate: it proves a session-gated route asks Shield and gets a
// real 502 rather than hanging when Shield is down, and that the
// public GET route fails soft rather than hard when HVNTZ is
// unreachable, matching resolveTap's own precedent in VASH TAP.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vaco-passport/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18826;
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
      throw new Error(`vaco-passport did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  fs.rmSync(path.join(APP_DIR, 'data', 'store.json'), { force: true });

  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      HVNTZ_API_URL: 'http://127.0.0.1:1',
      VACA_API_URL: 'http://127.0.0.1:1',
      V3_API_URL: 'http://127.0.0.1:1',
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
  fs.rmSync(path.join(APP_DIR, 'data', 'store.json'), { force: true });
});

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

// -- boot ------------------------------------------------------------------

test('the server starts, serves health, and seeded the demo Passport', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'vaco-passport');
  assert.equal(health.passports, 1, 'the seeded demo should register exactly one Passport');
  assert.deepEqual(health.networkLevels, ['member', 'verified', 'network']);
  assert.ok(health.serviceAuth, 'health does not report serviceAuth — is the middleware mounted?');
  assert.equal(health.serviceAuth.mode, 'enforce');
});

test('the boot output carries no ReferenceError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError/.test(bootLog), `vaco-passport logged a ReferenceError while starting:\n${bootLog}`);
});

// -- the public read route ---------------------------------------------------

test('GET /api/passports/:businessId needs no session and returns the seeded Passport', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/passports/9001`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.businessId, 9001);
  assert.equal(body.level, 'verified');
  // HVNTZ is unreachable for this whole suite — fails soft, matching
  // resolveTap's own precedent in VASH TAP.
  assert.strictEqual(body.business, null);
});

test('GET /api/passports/:businessId on an unknown business is 404', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/passports/999999`);
  assert.equal(res.status, 404);
});

// -- the guards --------------------------------------------------------------

test('POST /api/passports refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/passports', { businessId: 9001 });
  assert.equal(res.status, 401);
});

test('POST /api/passports/:businessId/verify refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/passports/9001/verify', {});
  assert.equal(res.status, 401);
});

test('POST /api/passports/:businessId/network-activity refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/passports/9001/network-activity', {});
  assert.equal(res.status, 401);
});

test('a junk bearer token reaches requireSession and gets a clean 502, not a hang', { skip: SKIP }, async () => {
  const res = await post('/api/passports', { businessId: 9001 }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-session-token',
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 502, `expected a clean 502 for an unreachable Shield, got ${res.status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error || ''), /Shield/);
});
