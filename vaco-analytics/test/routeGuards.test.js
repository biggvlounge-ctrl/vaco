// VACO Analytics — who may make this app write, and page somebody.
//
// **Why these spawn a real server.** `scripts/audit-route-guards.mjs`
// says it in its own header: unit tests structurally cannot see route
// authorization, because they call library functions and never send a
// request. That is exactly how this app's one real gap survived a
// 28-test suite — every one of those tests calls `evaluateMetric`
// directly, so none of them could notice who was allowed to.
//
// **The gap.** `POST /api/intelligence/evaluate` carried an
// `audit-route-guards: open` marker reading "stateless evaluation over
// posted metrics; writes no record". Both halves were false:
// `evaluateMetric` does `store.alerts.push(result)` and
// `store.nextAlertId++` on every anomaly, `durable(store)` commits it,
// and the handler then pages a responder through vaco-notify.
//
// The app-level `serviceAuth` middleware kept fully anonymous callers
// out, and that is why it looked fine. But it only proves *some*
// credential is present — identifying a caller and authorising one are
// different jobs, and the route did the second nowhere. Driven against
// a running server, `Authorization: Bearer any-old-session-token` — a
// string, not a session — returned 200 and left a persisted alert row.
//
// So the assertions below are about the credential, not the arithmetic.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9741;
const BASE = `http://localhost:${PORT}`;
const SERVICE = { 'X-Service-Name': 'probe', 'X-Service-Token': 'tok-probe' };

let child;

async function waitForHealth() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('vaco-analytics never came up');
}

function post(p, body, headers = {}) {
  return fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
}

test.before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      VACO_SERVICE_TOKENS: 'probe:tok-probe',
      // No VACO_SERVICE_TOKEN of its own, so `notifyAnomaly` posts
      // without a credential and vaco-notify (absent here) refuses it.
      // That path fails soft by design and must not affect these.
      VACO_SERVICE_TOKEN: '',
    },
    stdio: 'ignore',
  });
  await waitForHealth();
});

test.after(() => { if (child) child.kill(); });

test('no credential at all cannot reach the evaluator', async () => {
  const res = await post('/api/intelligence/evaluate', { app: 'x', metric: 'm' });
  assert.equal(res.status, 401);
});

test('a bearer token is not a licence to write alerts and page people', async () => {
  // **The regression.** This returned 200 and wrote a row. Note the
  // token is invented — nothing validates it, which is the point:
  // serviceAuth identifies, it does not authorise, and the route has
  // to say what it needs.
  const res = await post(
    '/api/intelligence/evaluate',
    { app: 'x', metric: 'm' },
    { Authorization: 'Bearer any-old-session-token' },
  );
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.match(body.error, /requireCallingService/);
});

test('a trusted service credential still works', async () => {
  // The guard has to refuse the wrong caller without breaking the right
  // one — a test that only checked the 403 would pass on a route that
  // refused everybody.
  const res = await post('/api/intelligence/evaluate', { app: 'x', metric: 'm' }, SERVICE);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.evaluated, false);
  assert.equal(body.reason, 'insufficient_data');
});

test('a refused evaluation writes no alert row', async () => {
  // Read the store through the app's own listing rather than trusting
  // the status code: a 403 that still wrote would be the worst outcome
  // and the status alone cannot rule it out.
  const app = `guard-probe-${Date.now()}`;
  for (const value of [10, 10, 10, 10, 10, 10, 10, 10, 10, 999]) {
    await post('/api/metrics/ingest', { app, metric: 'lat', value }, SERVICE);
  }

  const before = await (await fetch(`${BASE}/api/intelligence/alerts?app=${app}`)).json();
  assert.equal(before.alerts.length, 0, 'ingest alone must not raise an alert');

  const res = await post(
    '/api/intelligence/evaluate',
    { app, metric: 'lat', category: 'ops' },
    { Authorization: 'Bearer any-old-session-token' },
  );
  assert.equal(res.status, 403);

  const after = await (await fetch(`${BASE}/api/intelligence/alerts?app=${app}`)).json();
  assert.equal(after.alerts.length, 0,
    'a refused evaluation still wrote an alert row — the guard runs after the write');
});

test('the same evaluation on a service credential does raise the alert', async () => {
  // The control for the test above: if the fixture could not produce an
  // anomaly at all, "no alert row" would pass for the wrong reason.
  const app = `guard-probe-ok-${Date.now()}`;
  for (const value of [10, 10, 10, 10, 10, 10, 10, 10, 10, 999]) {
    await post('/api/metrics/ingest', { app, metric: 'lat', value }, SERVICE);
  }

  const res = await post('/api/intelligence/evaluate', { app, metric: 'lat', category: 'ops' }, SERVICE);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.isAnomaly, true,
    'the fixture stopped producing an anomaly, so the refusal test above proves nothing');

  const after = await (await fetch(`${BASE}/api/intelligence/alerts?app=${app}`)).json();
  assert.equal(after.alerts.length, 1);
});

test('telemetry ingest requires the service credential its reason claims', async () => {
  // The header block above `/api/metrics/ingest` says a poisoned
  // baseline hides the anomaly rather than raising it. Its declared
  // reason said "from services" and nothing enforced it, so any bearer
  // token could write telemetry. Every real caller already sends a
  // service credential — verified across all seven `pushMetric`
  // implementations — so this only refuses what was never legitimate.
  const withBearer = await post(
    '/api/metrics/ingest',
    { app: 'poison', metric: 'lat', value: 1 },
    { Authorization: 'Bearer any-old-session-token' },
  );
  assert.equal(withBearer.status, 403);

  const withService = await post(
    '/api/metrics/ingest',
    { app: 'poison', metric: 'lat', value: 1 },
    SERVICE,
  );
  assert.equal(withService.status, 201, 'the legitimate service path must still work');
});
