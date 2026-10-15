// DREAMS — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// Same real gap as cvnvo's and hvntz's own copies of this file: every
// prior test in this suite called a `lib/*.js` function directly,
// never through this Express app. Modeled on
// v4-proxy/test/server.test.js, the proven precedent for this pattern.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'dreams/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18814;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVICE = { name: 'test-caller', token: 'test-token-789' };

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
      throw new Error(`dreams did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `dreams logged an error while starting:\n${bootLog}`);
});

test('POST /api/screens refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/screens', { screenOwnerId: 'u1', locationName: 'Test', locationAddress: '123 Main St' });
  assert.equal(res.status, 401, 'an unauthenticated caller could register a screen as anyone');
});

test('POST /api/campaigns refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/campaigns', { advertiserId: 'a1', name: 'Test Campaign' });
  assert.equal(res.status, 401, 'an unauthenticated caller could create a campaign as anyone');
});

test('POST /api/campaigns/:id/impression demands a real service credential, not a session', { skip: SKIP }, async () => {
  const res = await post('/api/campaigns/1/impression', { screenId: 1 });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 401, 'impression recording ran with no credential at all');
  assert.ok(body.error, 'expected a real refusal message');
});

test('a valid service credential alone cannot create a campaign (requireActor is session-only)', { skip: SKIP }, async () => {
  // The exact bug class this file exists to catch: a route guarded by
  // `requireActor` (a real end-user session, never a service token)
  // must not be satisfiable by presenting service credentials instead
  // -- verified over the real serviceAuth middleware chain, not
  // assumed from reading the route's own annotation.
  const res = await post('/api/campaigns', { advertiserId: 'a1', name: 'Test Campaign' }, svc());
  assert.equal(res.status, 401, 'a service credential satisfied a route that requires a real user session');
});
