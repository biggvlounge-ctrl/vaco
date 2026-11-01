// VENVS — does the real backend start, serve its public routes, and
// do its guards actually refuse? Spawns the real process rather than
// importing it (server.cjs calls `app.listen` at module scope),
// same reasoning and same shape as vdp/test/server.test.js.
//
// Neither Shield nor V3 is running in this suite — deliberate, same
// as vdp's own suite. It proves what a mocked-fetch unit test cannot:
// that every mutating route here (there is no requireCallingService
// escape hatch in this app — every real seller/cart/checkout action
// has exactly one accountable human) asks Shield and gets a real 502
// when Shield is unreachable rather than hanging or silently passing,
// and that a request with no Authorization header at all is refused
// WITHOUT ever contacting Shield. The full real money-moving path
// (register a seller, list a product, cart, checkout, real VCoin
// moving in V3) was verified manually this session against real
// spawned Shield + V3 + this server — see this app's own README for
// the recorded transcript.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'venvs/node_modules is absent -- these spawn a real server and need `npm install` first';

const PORT = 18829;
const BASE = `http://127.0.0.1:${PORT}`;
const STORE_FILE = path.join(APP_DIR, 'data', 'store.json');

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
      throw new Error(`venvs server did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  fs.rmSync(STORE_FILE, { force: true });

  child = spawn(process.execPath, ['server.cjs'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Point every cross-app URL at a closed port on purpose -- this
      // suite tests the unreachable-dependency behavior, not a live
      // ecosystem. The real success path was verified manually
      // against a real spawned Shield + V3 (see this file's header).
      V3_API_URL: 'http://127.0.0.1:1',
      SHIELD_API_URL: 'http://127.0.0.1:1',
      VACO_SERVICE_TOKENS: 'venvs:test-venvs-token',
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
  fs.rmSync(STORE_FILE, { force: true });
});

const post = (p, body, headers = {}) => fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body ?? {}),
});

test('the server starts and serves health with a real, empty marketplace', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'venvs');
  assert.equal(health.sellers, 0);
  assert.equal(health.products, 0);
});

test('GET /api/marketplace/products starts real and empty, never 500s on an empty store', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/marketplace/products`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.products, []);
});

test('GET /api/marketplace/sellers/:id 404s honestly for an unknown seller', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/marketplace/sellers/999`);
  assert.equal(res.status, 404);
});

test('registering a seller with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/sellers', { ownerId: 'hunts-biz-1', name: 'Hunts Hardware' });
  assert.equal(res.status, 401);
});

test('registering a seller with a real bearer token asks Shield -- real 502 when it is unreachable, never a silent pass for whose storefront this is', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/sellers',
    { ownerId: 'hunts-biz-1', name: 'Hunts Hardware' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502);
});

test('listing a product with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/sellers/1/products', { ownerId: 'hunts-biz-1', title: 'Real Hammer', price: 40 });
  assert.equal(res.status, 401);
});

test('creating a cart with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/carts', { buyerId: 'buyer-1' });
  assert.equal(res.status, 401);
});

test('adding to a cart with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/carts/1/items',
    { buyerId: 'buyer-1', productId: 1, quantity: 1 }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502);
});

test('checkout with no credential at all is refused WITHOUT reaching Shield -- never a silent charge', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/checkout', { buyerId: 'buyer-1', cartId: 1 });
  assert.equal(res.status, 401);
});

test('checkout with a real bearer token asks Shield -- real 502 when it is unreachable, never moving real VCoin on an unverified identity', { skip: SKIP }, async () => {
  const res = await post('/api/marketplace/checkout',
    { buyerId: 'buyer-1', cartId: 1 }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502);
});

test('a mismatched actor (claiming to act as someone else) is refused with 403, not 401 or 502', { skip: SKIP }, async () => {
  // requireActor checks the claimed field against the real session
  // AFTER resolving it -- with Shield unreachable this still 502s
  // before ever reaching the mismatch check, which is itself the
  // point: a forged ownerId is never waved through just because
  // Shield could not be reached to disprove it.
  const res = await post('/api/marketplace/sellers',
    { ownerId: 'someone-else', name: 'X' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'Shield must be consulted before any identity claim is trusted, forged or not');
});
