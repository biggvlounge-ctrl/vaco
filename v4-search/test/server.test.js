// V4 Search — does the server start, and does its one real route
// actually behave over HTTP the way its own comment claims?
//
// Same real gap as cvnvo's, hvntz's, dreams's, yap's, vex's and vaca's
// own copies of this file: every prior test in this suite called the
// adapter directly, never through this Express app. Modeled on
// v4-proxy/test/server.test.js, the proven precedent for this pattern.
//
// V4 Search has no auth guard at all -- its own module header says so
// ("audit-route-guards: open -- stateless query, POST only for body
// size; reads and writes no record"). The thing worth proving over a
// real request isn't a 401, it's that the route's own input
// validation (query/apps/limit) actually runs in the live app, not
// just in a unit test of the adapter underneath it.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'v4-search/node_modules is absent — these spawn a real server and need `npm install` first';

const PORT = 18788;
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
      throw new Error(`v4-search did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
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

const post = (p, body) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

test('the server starts and serves health, naming the apps it searches', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.ok(Array.isArray(health.apps) && health.apps.includes('VOKEN'), 'health did not name VOKEN among the searchable apps');
});

test('the boot output carries no ReferenceError or TypeError', { skip: SKIP }, () => {
  assert.ok(!/ReferenceError|TypeError/.test(bootLog), `v4-search logged an error while starting:\n${bootLog}`);
});

test('POST /api/search is open to an anonymous caller, by design', { skip: SKIP }, async () => {
  const res = await post('/api/search', { query: 'hunt' });
  assert.notEqual(res.status, 401, 'an admittedly open-by-design route started refusing anonymous callers');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.query, 'hunt');
  assert.ok(Array.isArray(body.results));
});

test('POST /api/search rejects a missing query over a real request, not just in the adapter', { skip: SKIP }, async () => {
  const res = await post('/api/search', {});
  assert.equal(res.status, 400, 'a request with no query string was not rejected');
});

test('POST /api/search rejects an unknown app id over a real request', { skip: SKIP }, async () => {
  const res = await post('/api/search', { query: 'hunt', apps: ['NOT-A-REAL-APP'] });
  assert.equal(res.status, 400, 'an unknown app id in the apps filter was not rejected');
  const body = await res.json();
  assert.match(String(body.error || ''), /Unknown app id/);
});

test('POST /api/search scopes results to the apps requested', { skip: SKIP }, async () => {
  const res = await post('/api/search', { query: 'hunt', apps: ['VACAY'] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.results.every((r) => r.app === 'VACAY'), 'a scoped search returned a result from an app not in the filter');
});
