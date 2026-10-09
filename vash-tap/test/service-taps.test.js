// VASH TAP — a trusted service may register a Tap with no end-user
// session to present, the exact gap VDP's own "everybody who comes
// into the world will have a band similar to Vash Tap" arrival flow
// needs: a brand-new player has no live browser session yet, so VDP
// registers their personal Tap server-to-server.
//
// Spawned as its own process (not folded into routes.test.js) because
// that suite deliberately runs with VACO_SERVICE_TOKENS='' to prove
// the *absence* of a service credential still 401s; this suite needs
// a real token present to prove the opposite path. Shield stays
// unreachable here too (same closed-port pattern as routes.test.js) —
// that is the actual regression: before the fix, a service call still
// went through `requireSession()` first and got a 502 for an
// unreachable Shield it should never have had to ask.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vash-tap/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18826;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVICE_TOKEN = 'test-shared-token';

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
  fs.rmSync(path.join(APP_DIR, 'data', 'store.json'), { force: true });

  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      V3_API_URL: 'http://127.0.0.1:1',
      VACA_API_URL: 'http://127.0.0.1:1',
      HVNTZ_API_URL: 'http://127.0.0.1:1',
      VACO_NOTIFY_URL: 'http://127.0.0.1:1',
      DREAMS_API_URL: 'http://127.0.0.1:1',
      SHIELD_API_URL: 'http://127.0.0.1:1',
      VACO_SERVICE_TOKENS: `vdp:${SERVICE_TOKEN}`,
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

const serviceHeaders = {
  'Content-Type': 'application/json',
  'X-Service-Name': 'vdp',
  'X-Service-Token': SERVICE_TOKEN,
};

test('a verified service registers a personal Tap with no Authorization header and no live Shield', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ tapType: 'personal', ownerIdentityId: 'real-arrival-1' }),
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  assert.equal(body.tapType, 'personal');
  assert.equal(body.ownerIdentityId, 'real-arrival-1');
});

test('a service may register a personal tap for ANY ownerIdentityId -- unlike a session caller, who may only register their own', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ tapType: 'personal', ownerIdentityId: 'real-arrival-2' }),
  });
  assert.equal(res.status, 201);
});

test('an unknown service name is still rejected, proving this is a real credential check, not a header name bypass', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Name': 'not-a-real-service', 'X-Service-Token': SERVICE_TOKEN },
    body: JSON.stringify({ tapType: 'personal', ownerIdentityId: 'real-arrival-3' }),
  });
  assert.equal(res.status, 401);
});

test('a wrong token for a real service name is still rejected', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/taps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Name': 'vdp', 'X-Service-Token': 'wrong-token' },
    body: JSON.stringify({ tapType: 'personal', ownerIdentityId: 'real-arrival-4' }),
  });
  assert.equal(res.status, 401);
});
