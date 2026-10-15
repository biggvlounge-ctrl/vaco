// CVNVO — does the server start, and do its guards actually refuse
// over a real HTTP request?
//
// **Why this file exists.** Every test in this suite until now called
// a `lib/*.js` function directly — never issued a real HTTP request
// through this Express app. That proves the business logic works; it
// proves nothing about whether a route is actually wired to the guard
// its own source comment claims, whether middleware mounting order is
// right, or whether Express itself parses the request the way the
// handler assumes. `server.js`'s own comment above the auth section
// says plainly: "Thirty-three of CVNVO's thirty-five mutating routes
// had no guard" before that sweep — the kind of defect this class of
// test exists to catch, and the kind no lib-level test ever could.
//
// Modeled directly on v4-proxy/test/server.test.js, the one real
// precedent for this pattern already in this ecosystem: spawn the
// real server as a child process (an in-process `require` cannot
// survive `app.listen`), poll its real `/api/health`, and hit real
// routes with the built-in `fetch` — no new dependency.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');

// Same real reason v4-proxy's own copy of this check exists: a `git
// archive`-extracted release has no `node_modules`, and a suite that
// silently passed zero tests there would say nothing was wrong.
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'cvnvo/node_modules is absent — these spawn a real server and need `npm install` first';

// Clear of the 8787-8821 range the ecosystem uses, so a running dev
// stack never collides with this suite.
const PORT = 18798;
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
      throw new Error(`cvnvo did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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
      VACO_SERVICE_TOKENS: 'test-caller:test-token-123',
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

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

// -- the boot itself -------------------------------------------------

test('the server starts and serves health', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'cvnvo');
});

test('the boot output carries no ReferenceError or TypeError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `cvnvo logged an error while starting:\n${bootLog}`);
});

// -- the guards, over a real request ----------------------------------

test('POST /api/profiles refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/profiles', { userId: 'u1', displayName: 'Test' });
  assert.equal(res.status, 401, 'an unauthenticated caller could create a dating profile as anyone');
});

test('POST /api/safety/check-ins refuses an anonymous caller', { skip: SKIP }, async () => {
  // The highest-stakes route in the app, per its own header comment:
  // an unguarded version let anyone file a safety check-in in
  // somebody else's name.
  const res = await post('/api/safety/check-ins', { userId: 'u1' });
  assert.equal(res.status, 401, 'an unauthenticated caller could file a safety check-in as someone else');
});

test('POST /api/matches/generate refuses a caller with no service credential', { skip: SKIP }, async () => {
  const res = await post('/api/matches/generate', { userId: 'u1' });
  assert.equal(res.status, 401, 'match generation ran for a caller presenting no credential at all');
});

test('POST /api/matches/generate refuses a caller presenting the wrong service token', { skip: SKIP }, async () => {
  const res = await post('/api/matches/generate', { userId: 'u1' }, {
    'Content-Type': 'application/json',
    'X-Service-Name': 'test-caller',
    'X-Service-Token': 'the-wrong-token',
  });
  assert.equal(res.status, 401, 'a wrong service token was accepted as a right one');
});

test('a junk Authorization header reaches the route (serviceAuth does not verify it) and is refused by Shield there', { skip: SKIP }, async () => {
  // Same real discriminator v4-proxy's own suite pins down:
  // `serviceAuth.classify` treats any `Authorization: Bearer ...`
  // header as a user session without checking it — that is Shield's
  // job, at the route. Shield is not running in this suite, so a
  // reached guard answers 502 and names Shield, not a fabricated
  // success and not a generic 401 that could mean anything.
  const res = await post('/api/profiles', { userId: 'u1', displayName: 'Test' }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-session-token',
  });
  const body = await res.json().catch(() => ({}));
  assert.match(String(body.error || ''), /requireSession|Shield/, `expected a Shield-naming refusal, got: ${JSON.stringify(body)}`);
});
