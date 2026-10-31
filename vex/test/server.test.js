// VEX — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// Same real gap as cvnvo's, hvntz's, dreams's, and yap's own copies
// of this file: every prior test in this suite called a `lib/*.js`
// function directly, never through this Express app. Modeled on
// v4-proxy/test/server.test.js, the proven precedent for this pattern.
// VEX in particular is the brokerage app, gated pending broker-dealer
// registration -- the compliance-gate route is the single most
// consequential guard in this app, and it had never been proven open
// over a real request, only read as a comment.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vex/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18816;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVICE = { name: 'test-caller', token: 'test-token-vex' };

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
      throw new Error(`vex did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `vex logged an error while starting:\n${bootLog}`);
});

test('POST /api/compliance-gate/:gateName demands a human operator credential, and a service token is not accepted in its place', { skip: SKIP }, async () => {
  // The single most consequential guard in this app: VEX is gated
  // pending real broker-dealer registration, and that gate must not
  // be openable by a compromised or merely-present service.
  const res = await post('/api/compliance-gate/trading', { open: true }, svc());
  assert.equal(res.status, 401, 'a service credential opened a real brokerage compliance gate');
});

test('POST /api/compliance-gate/:gateName refuses an anonymous caller entirely', { skip: SKIP }, async () => {
  const res = await post('/api/compliance-gate/trading', { open: true });
  assert.equal(res.status, 401, 'the compliance gate was reachable with no credential at all');
});

test('POST /api/account refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/account', { userId: 'u1' });
  assert.equal(res.status, 401, 'an unauthenticated caller could open a brokerage account as anyone');
});

test('POST /api/order refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/order', { accountId: 1, symbol: 'TEST', quantity: 1 });
  assert.equal(res.status, 401, 'an unauthenticated caller could place an order against someone else\'s brokerage account');
});

test('GET /api/coin/price is readable with no credential at all', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/coin/price`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.symbol, 'VXC');
  assert.ok(Number.isFinite(body.price));
});

test('POST /api/coin/orders refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/coin/orders', { accountId: 1, orderType: 'buy', coinAmount: 10 });
  assert.equal(res.status, 401, 'an unauthenticated caller could place a VXC order against someone else\'s account');
});

test('GET /api/health reports the VXC symbol and order types', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.coinSymbol, 'VXC');
  assert.deepEqual(health.coinOrderTypes, ['buy', 'sell']);
});
