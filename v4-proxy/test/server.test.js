// V4 — does the server start, and do its guards actually refuse?
//
// **Why this file exists, specifically.** `v4-proxy/server.js` called
// a bare `require()` at module scope in an app whose package.json says
// `"type": "module"`. That is a ReferenceError on the first line of
// evaluation: `node server.js` died before it reached anything, so V4
// had not been able to boot at all since the media client was wired
// in.
//
// Nothing caught it. The suite here covered `lib/maps.js` and never
// imported the server; the shared-runtime sync checked that copied
// modules were *required* somewhere, not that the requiring app still
// ran; the route-guard audit reads source text and never executes it.
// Three checks passed over a service that could not start.
//
// So this test does the one thing none of them did: **it starts the
// process.** Everything else here is a bonus — the boot is the point.
//
// It spawns rather than imports on purpose. `server.js` calls
// `app.listen` and `process.exit(1)` at module scope, which an
// in-process import cannot survive, and a child process is also what
// production actually does.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// **These tests need `npm install` to have run, and one place runs them
// where it deliberately has not.**
//
// `scripts/package-release.mjs` extracts the archive and re-runs the
// whole suite inside it, to prove the archive is what it claims. But
// `git archive` correctly excludes `node_modules`, so `node server.js`
// there dies with `Cannot find package 'express'` — twelve failures
// that say nothing about the archive and everything about a missing
// dependency tree. That took the release script's verification down.
//
// So: skip when the dependency is absent, and **say so in the skip
// reason** rather than passing quietly. A suite that silently reports
// success while running nothing is the exact failure this repo keeps a
// rule about. `run-all-tests.mjs` prints the skipped count, so a skip
// here is visible in every run rather than hidden behind an "ok".
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS
  ? false
  : 'v4-proxy/node_modules is absent — these spawn a real server and need `npm install` first';

// A port well clear of the 8787-8821 range the ecosystem uses, so a
// running dev stack does not collide with the suite.
const PORT = 18797;
const BASE = `http://127.0.0.1:${PORT}`;

const SERVICE = { name: 'vacon', token: 'test-token-vacon' };

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
      throw new Error(
        `v4-proxy did not answer /api/health within ${timeoutMs}ms.\n`
        + `--- its output was ---\n${bootLog || '(nothing)'}`,
      );
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
      // Not a real key. The route that would spend it is never reached
      // in this file: every request here is refused before it, or is
      // refused by the audit interlock.
      ANTHROPIC_API_KEY: 'test-key-not-real',
      VACO_SERVICE_TOKENS: `${SERVICE.name}:${SERVICE.token}`,
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
});

const svc = () => ({
  'Content-Type': 'application/json',
  'X-Service-Name': SERVICE.name,
  'X-Service-Token': SERVICE.token,
});

const post = (p, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });

// -- the boot itself -----------------------------------------------------

test('the server starts and serves health', { skip: SKIP }, async () => {
  // If `test.before` got here, it started. This asserts the shape of
  // what it serves, and that both guard layers are actually mounted —
  // a health payload missing them means the middleware silently was
  // not installed, which is how this app was open in the first place.
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.ok(health.serviceAuth, 'health does not report serviceAuth — is the middleware mounted?');
  assert.equal(health.serviceAuth.mode, 'enforce');
  assert.deepEqual(health.serviceAuth.allowlistedServices, [SERVICE.name]);
});

test('the boot output carries no ReferenceError', { skip: SKIP }, () => {
  // The specific failure this file was written for. A server that
  // crashes and gets restarted by a supervisor can still answer
  // health checks between crashes; this reads what it actually said.
  assert.ok(
    !/ReferenceError/.test(bootLog),
    `v4-proxy logged a ReferenceError while starting:\n${bootLog}`,
  );
});

// -- the guards ----------------------------------------------------------

const AGENT_BODY = { system: 'You are QVAN.', messages: [{ role: 'user', content: 'status' }] };

test('POST /api/agent refuses an anonymous caller', { skip: SKIP }, async () => {
  // The route that spends a real API key against a real model. It
  // answered anyone.
  //
  // **This one passes because of the app-level floor, not the route
  // guard.** Proven, not assumed: deleting `actorOrService(...)` from
  // the route left this test green, because `serviceAuth` refuses
  // every unauthenticated mutating call before the route is reached.
  // Worth having anyway — it is the property that actually matters —
  // but the route's own guard needs the test below.
  const res = await post('/api/agent', AGENT_BODY);
  assert.equal(res.status, 401, 'an unauthenticated caller could invoke an agent');
});

test('POST /api/agent verifies the session it is handed', { skip: SKIP }, async () => {
  // **The test that pins the route guard**, after the obvious one
  // turned out not to.
  //
  // `serviceAuth.classify` treats *any* `Authorization: Bearer` header
  // as a user session — it does not verify the token, that is Shield's
  // job. So a request with a junk bearer token walks straight through
  // the app-level floor. What stops it is `requireSession()` on the
  // route, which asks Shield and refuses when the answer is not yes.
  //
  // Shield is not running in this suite, so a reached guard answers
  // 502 and says so. If the guard were removed, the request would
  // instead reach the handler and fail somewhere else entirely, with
  // a message about the audit log or the upstream API. The message is
  // the discriminator, not the status.
  const res = await post('/api/agent', AGENT_BODY, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-session-token',
  });
  const body = await res.json().catch(() => ({}));
  assert.match(
    String(body.error || ''), /requireSession|Shield/,
    `a junk bearer token reached past the route guard — got ${res.status}: ${JSON.stringify(body)}`,
  );
});

test('POST /api/calls refuses an anonymous caller and accepts a service', { skip: SKIP }, async () => {
  assert.equal((await post('/api/calls', { agentId: 'qvan', userId: 'ada' })).status, 401);

  const ok = await post('/api/calls', { agentId: 'qvan', userId: 'ada' }, svc());
  assert.equal(ok.status, 201, 'a verified internal service was refused');
  const call = await ok.json();
  assert.equal(call.userId, 'ada');
});

test('POST /api/calls refuses a service presenting the wrong token', { skip: SKIP }, async () => {
  const res = await post('/api/calls', { agentId: 'qvan', userId: 'ada' }, {
    'Content-Type': 'application/json',
    'X-Service-Name': SERVICE.name,
    'X-Service-Token': 'not-the-token',
  });
  assert.equal(res.status, 401);
});

test('GET /api/calls is scoped to the caller, not to the query string', { skip: SKIP }, async () => {
  // This route took `?userId=` and returned that person's calls to
  // anyone who asked. The query string was the only thing deciding
  // whose records came back.
  assert.equal((await fetch(`${BASE}/api/calls?userId=ada`)).status, 401);

  // And the read path must work for a verified service — which it did
  // not, at first: `serviceAuth` returned early on non-mutating
  // methods and never set `req.callingService`, so `actorOrService`
  // could not see it. Same token, same allowlist, different verb.
  const res = await fetch(`${BASE}/api/calls?userId=ada`, { headers: svc() });
  assert.equal(res.status, 200, 'a verified service was refused on a read route');
  const body = await res.json();
  assert.ok(Array.isArray(body.calls));
});

test('GET /api/fallback-messages refuses an anonymous caller', { skip: SKIP }, async () => {
  assert.equal((await fetch(`${BASE}/api/fallback-messages?userId=ada`)).status, 401);
});

test('POST /api/maps/crossings refuses an anonymous caller', { skip: SKIP }, async () => {
  // The most sensitive route on this port: it takes a userId and
  // reports who that person crossed paths with. It carried a comment
  // reading "there is no VACO principal on this call at all."
  assert.equal((await post('/api/maps/crossings', { userId: 'ada' })).status, 401);
});

test('POST /api/calls/sweep-timeouts demands a service, not a session', { skip: SKIP }, async () => {
  // A scheduler job that acts on everybody's calls at once. No user's
  // session could reasonably authorise it.
  assert.equal((await post('/api/calls/sweep-timeouts')).status, 401);
  assert.equal((await post('/api/calls/sweep-timeouts', {}, svc())).status, 200);
});

test('the app-level floor covers even the routes marked open', { skip: SKIP }, async () => {
  // **Written expecting a 200, and it returned 401.** The code was
  // right and the expectation was wrong, which is worth recording
  // rather than quietly editing away.
  //
  // Six map routes carry an `audit-route-guards: open` marker: they
  // take coordinates in and return arithmetic out, with no principal
  // and no stored data. That is still true of the *route*. But
  // `serviceAuth` is mounted app-wide in enforce mode, and it gates
  // every mutating method — so a POST to a "declared open" route is
  // refused before it is reached.
  //
  // The consequence, stated plainly: those markers describe the route
  // handler, not what a caller can reach. On this app there is no
  // anonymous mutating call at all, the same floor `dreams` and
  // `venvm` describe in their own headers.
  const body = {
    fromLat: 38.62, fromLng: -90.19, toLat: 38.65, toLng: -90.24,
  };
  assert.equal(
    (await post('/api/maps/distance', body)).status, 401,
    'a mutating route was reachable anonymously — the app-level floor is gone',
  );

  // And with a credential it is what it always was: arithmetic.
  const ok = await post('/api/maps/distance', body, svc());
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).distanceKm > 0, 'the calculator stopped calculating');
});

test('reads that were never gated are still reachable', { skip: SKIP }, async () => {
  // The mirror of the test above. `serviceAuth` gates writes only, so
  // a plain GET of the shared map layer stays open — and should, it
  // is a directory of places, not of people. Asserted so that a later
  // change to the middleware cannot close it silently.
  const res = await fetch(`${BASE}/api/maps`);
  assert.equal(res.status, 200);
  // `describeMaps` reports counts and stated limitations, not the
  // places themselves — checked against the response rather than
  // assumed, after asserting an array here and being wrong.
  const body = await res.json();
  assert.equal(typeof body.places, 'number');
  assert.ok(Array.isArray(body.limitations) && body.limitations.length > 0);
});
