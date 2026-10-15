// VACA — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// Same real gap as cvnvo's, hvntz's, dreams's, yap's and vex's own
// copies of this file: every prior test in this suite called a
// `lib/*.js` function directly, never through this Express app.
// Modeled on v4-proxy/test/server.test.js, the proven precedent for
// this pattern.
//
// VACA is the gate other apps trust (VOKEN's value algorithm consumes
// the authenticity grades decided here) and its own module header
// explains the split: submitting a claim about yourself is open by
// design, but approving or rejecting one is the decision that must
// not be forgeable. `requireOperator('vaca:verify')` is that guard,
// and a service credential must not satisfy it in its place.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vaca/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18804;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVICE = { name: 'test-caller', token: 'test-token-vaca' };

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
      throw new Error(`vaca did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `vaca logged an error while starting:\n${bootLog}`);
});

test('POST /api/verifications refuses an anonymous caller (the app-wide service-auth floor, not a route-specific guard)', { skip: SKIP }, async () => {
  const res = await post('/api/verifications', { subjectType: 'user', subjectId: 'u1', claim: 'test' });
  assert.equal(res.status, 401, 'an unauthenticated caller could submit a verification claim');
});

test('POST /api/verifications is open to a plain service credential -- no vaca:verify operator scope required to submit a claim about yourself', { skip: SKIP }, async () => {
  // The module's own "audit-route-guards: open" comment on this route
  // means no *additional* guard beyond the app-wide floor every
  // mutating route already carries -- not that the route has zero
  // guard. A service credential, the lower bar, must be enough.
  const res = await post('/api/verifications', { subjectType: 'user', subjectId: 'u1', claim: 'test' }, svc());
  assert.notEqual(res.status, 401, 'a route documented as self-service demanded more than a service credential');
});

test('POST /api/verifications/:id/approve demands a human operator credential, and a service token is not accepted in its place', { skip: SKIP }, async () => {
  // The decision VACA exists to protect: VOKEN's value algorithm
  // trusts whatever grade comes out of this route, so a service
  // credential alone must never be enough to approve one.
  const res = await post('/api/verifications/1/approve', { reviewedBy: 'svc' }, svc());
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 401, 'a plain service credential approved an authenticity claim');
  assert.match(String(body.error || ''), /operator/i);
});

test('POST /api/verifications/:id/approve refuses an anonymous caller entirely', { skip: SKIP }, async () => {
  const res = await post('/api/verifications/1/approve', { reviewedBy: 'nobody' });
  assert.equal(res.status, 401, 'an unauthenticated caller could approve an authenticity claim');
});

test('POST /api/verifications/:id/reject demands a human operator credential, and a service token is not accepted in its place', { skip: SKIP }, async () => {
  const res = await post('/api/verifications/1/reject', { reviewedBy: 'svc' }, svc());
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 401, 'a plain service credential rejected an authenticity claim');
  assert.match(String(body.error || ''), /operator/i);
});
