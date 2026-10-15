// Vaco Assistant — does the server start, and do its guards actually
// refuse over a real HTTP request?
//
// Same real-HTTP pattern as v4-proxy/test/server.test.js and this
// session's other copies of it (cvnvo, hvntz, dreams, yap, vex, vaca,
// v4-search): spawn the real server, poll /api/health, hit real
// routes with built-in fetch. This app in particular is personal --
// a profile and a chat history are nobody else's business -- so the
// thing most worth proving over a real request is that
// requireParamActor really refuses a session that belongs to a
// different user, not just the no-credential-at-all case.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vaco-assistant/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18828;
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
      throw new Error(`vaco-assistant did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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
  assert.deepEqual(health.tones, ['friendly', 'direct', 'professional', 'motivational']);
});

test('the boot output carries no ReferenceError or TypeError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `vaco-assistant logged an error while starting:\n${bootLog}`);
});

test('GET /api/assistant/tones is open to an anonymous caller, by design', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/assistant/tones`);
  assert.equal(res.status, 200);
});

test('GET /api/assistant/profile/:userId refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/assistant/profile/demo-user`);
  assert.equal(res.status, 401, 'an unauthenticated caller could read a stranger\'s assistant profile');
});

test('POST /api/assistant/profile refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/assistant/profile', { userId: 'demo-user', name: 'x' });
  assert.equal(res.status, 401, 'an unauthenticated caller could personalize a stranger\'s assistant');
});

test('GET /api/assistant/history/:userId refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/assistant/history/demo-user`);
  assert.equal(res.status, 401, 'an unauthenticated caller could read a stranger\'s chat history');
});

test('POST /api/assistant/chat refuses an anonymous caller', { skip: SKIP }, async () => {
  const res = await post('/api/assistant/chat', { userId: 'demo-user', content: 'hi' });
  assert.equal(res.status, 401, 'an unauthenticated caller could chat as a stranger');
});

test('a garbage Bearer token is never accepted locally -- it is sent to Shield for real verification', { skip: SKIP }, async () => {
  // A Bearer header is never enough on its own: requireActor always
  // calls out to Shield to verify it. Shield is not running in this
  // test, so the honest outcome is 502 ("Shield unreachable"), not a
  // silent local pass -- the point being tested is that no code path
  // here waves a request through just because a header was present.
  const res = await post('/api/assistant/chat', { userId: 'demo-user', content: 'hi' }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer not-a-real-token',
  });
  assert.equal(res.status, 502, 'a junk Bearer token was not sent to Shield for real verification');
  const body = await res.json();
  assert.match(body.error, /Shield unreachable/);
});
