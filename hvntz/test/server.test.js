// HVNTZ — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// Same real gap as cvnvo's and dreams' own copies of this file: every
// prior test in this suite called a `lib/*.js` function directly,
// never through this Express app, so a route's own guard annotation
// was never actually exercised over HTTP. Modeled on
// v4-proxy/test/server.test.js, the proven precedent for this pattern.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'hvntz/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18792;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVICE = { name: 'test-caller', token: 'test-token-456' };

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
      throw new Error(`hvntz did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      VACO_SERVICE_TOKENS: `${SERVICE.name}:${SERVICE.token}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { bootLog += d; });
  child.stderr.on('data', (d) => { bootLog += d; });
  await waitForHealth();
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
});

const svc = () => ({
  'Content-Type': 'application/json',
  'X-Service-Name': SERVICE.name,
  'X-Service-Token': SERVICE.token,
});

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

test('the server starts and serves health', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
});

test('the boot output carries no ReferenceError or TypeError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `hvntz logged an error while starting:\n${bootLog}`);
});

test('POST /api/business refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/business', { ownerId: 'u1', name: 'Test Shop' });
  assert.equal(res.status, 401, 'an unauthenticated caller could register a business as anyone');
});

test('POST /api/location refuses a caller with no service credential (requireBodyBusinessOwner floor)', { skip: SKIP }, async () => {
  const res = await post('/api/location', { businessId: 1 });
  assert.equal(res.status, 401, 'location creation ran for a caller presenting no credential at all');
});

test('POST /api/revenue-event demands a human operator credential, not a service token', { skip: SKIP }, async () => {
  // A valid *service* credential passes the app-level floor, which is
  // exactly the point: `requireOperator` is a stronger, separate
  // guard that a service token must not satisfy on its own — this
  // route decides a real payout.
  const res = await post('/api/revenue-event', { businessId: 1, amount: 10 }, svc());
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 401, 'a plain service credential was accepted for a route that decides a payout');
  assert.match(String(body.error || ''), /X-Operator-Credential|operator credential/);
});

test('POST /api/hunt/:huntId/checkin refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/hunt/1/checkin', { userId: 'u1' });
  assert.equal(res.status, 401, 'an unauthenticated caller could check in to a hunt as someone else');
});
