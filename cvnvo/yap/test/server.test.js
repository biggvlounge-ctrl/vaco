// YAP — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// Same real gap as cvnvo's, hvntz's, and dreams' own copies of this
// file. Also exercises the two routes `server.js` itself marks
// deliberately open (`audit-route-guards: open`) — proving the
// documented reasoning (no auto-publish; the dispute route verifies
// ownership internally) actually holds over a real request, not just
// in the comment.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'yap/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18802;
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
      throw new Error(`yap did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { bootLog += d; });
  child.stderr.on('data', (d) => { bootLog += d; });
  await waitForHealth();
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
});

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

test('the server starts and serves health', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'yap');
});

test('the boot output carries no ReferenceError or TypeError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `yap logged an error while starting:\n${bootLog}`);
});

test('POST /yap/moderation/:id/publish demands a human operator credential', { skip: SKIP }, async () => {
  const res = await post('/yap/moderation/1/publish', {});
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 401, 'a report was publishable with no operator credential at all');
  assert.match(String(body.error || ''), /X-Operator-Credential|operator credential/);
});

test('POST /yap/moderation/:id/reject demands a human operator credential, and a service token is not accepted in its place', { skip: SKIP }, async () => {
  // The route's own header is explicit: "There is deliberately no
  // service-token fallback on these routes... a compromised service
  // should not be able to publish a defamatory claim." Verified, not
  // just read: a valid-looking service credential must not work here.
  const res = await post('/yap/moderation/1/reject', { reason: 'test' }, {
    'Content-Type': 'application/json',
    'X-Service-Name': 'some-service',
    'X-Service-Token': 'some-token',
  });
  assert.equal(res.status, 401, 'a service credential satisfied a route that requires a human operator');
});

test('POST /yap/reports is open by design, not forgotten -- no auth guard blocks it', { skip: SKIP }, async () => {
  // Real business success needs CVNVO up to verify the reporter's
  // profile (`profileFetchFn`), out of scope for this guard-focused
  // suite -- lib/yap.js's own 36 tests already cover that path with a
  // stub. What belongs here: confirming this route is reachable with
  // no credential at all, i.e. genuinely open as its own
  // `audit-route-guards: open` comment claims, not silently guarded.
  const res = await post('/yap/reports', { reporterId: 'reporter-1', subjectId: 'subject-1', flag: 'red', details: 'test report' });
  assert.notEqual(res.status, 401, 'the open submission route was refused by an auth guard');
});

test('POST /yap/reports/:id/dispute is open by design, not forgotten -- no auth guard blocks it', { skip: SKIP }, async () => {
  const res = await post('/yap/reports/999999/dispute', { subjectId: 'someone', grounds: 'test' });
  assert.notEqual(res.status, 401, 'the open dispute route was refused by an auth guard');
});
