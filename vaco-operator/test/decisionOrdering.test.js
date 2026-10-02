// VACO OPERATOR -- an authority grant must not survive a vaco-audit
// outage.
//
// **Why this file exists.** `decisionLog.cjs`'s own header states the
// invariant this service is supposed to enforce: "record before
// deciding, and refuse to decide if you cannot record... writing
// afterwards means a crash between the two leaves a decision nobody can
// attribute, which is the state this service exists to end." All four
// mutating routes in server.js (create/disable/grant/revoke) ran the
// real mutation FIRST and called `decisionLog.record` only afterward --
// so when vaco-audit was down, the route correctly answered 503, but
// the operator/grant had already landed in the live store moments
// earlier. The caller was told the action did not happen; it had.
//
// This spawns the real server against a small, controllable fake
// vaco-audit that can be switched to fail on demand, and proves that
// while it is failing, none of the four routes leaves a trace in the
// live store.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false
  : 'vaco-operator/node_modules is absent -- these spawn a real server and need `npm install` first';

const BOOTSTRAP_CREDENTIAL = 'vop_test_bootstrap_credential_for_decision_ordering';

let auditFailing = false;
let auditServer;
let auditPort;

let opServer;
let opPort;
let BASE;

const STORE_FILE = path.join(APP_DIR, 'data', 'store.json');

test.before(async () => {
  if (SKIP) return;

  // server.js's store path is hardcoded (data/store.json, no env
  // override), and bootstrap() only seeds when the store is empty. A
  // file left over from a previous run would make the bootstrap
  // credential this suite relies on silently not exist.
  fs.rmSync(STORE_FILE, { force: true });

  // The fake vaco-audit: 201 while `auditFailing` is false, 500 while
  // true. A real outage is exactly this from the caller's point of
  // view -- `decisionLog.cjs` does not distinguish "down" from
  // "refused."
  auditServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/decisions') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (auditFailing) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'simulated vaco-audit outage' }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: `dec_${Date.now()}` }));
        }
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise((resolve) => auditServer.listen(0, '127.0.0.1', resolve));
  auditPort = auditServer.address().port;

  opPort = 9100 + Math.floor(Math.random() * 400);
  BASE = `http://127.0.0.1:${opPort}/api`;

  opServer = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(opPort),
      VACO_SERVICE_AUTH_MODE: 'off',
      VACO_OPERATOR_BOOTSTRAP: BOOTSTRAP_CREDENTIAL,
      VACO_AUDIT_URL: `http://127.0.0.1:${auditPort}`,
      VACO_AUDIT_MODE: 'enforce',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vaco-operator did not start within 10s')), 10000);
    opServer.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) { clearTimeout(timer); resolve(); }
    });
    opServer.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vaco-operator exited before listening (code ${code})`));
    });
  });
});

test.after(() => {
  if (opServer) opServer.kill();
  if (auditServer) auditServer.close();
  fs.rmSync(STORE_FILE, { force: true });
});

function authed(path, options = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-operator-credential': BOOTSTRAP_CREDENTIAL,
      ...(options.headers || {}),
    },
  });
}

test('a vaco-audit outage during creation leaves no operator behind', { skip: SKIP }, async () => {
  auditFailing = true;
  const res = await authed('/operators', {
    method: 'POST',
    body: JSON.stringify({ name: 'eve-create-race' }),
  });
  assert.equal(res.status, 503, 'the route must refuse while the decision cannot be recorded');

  const list = await (await authed('/operators')).json();
  const names = list.operators.map((o) => o.name);
  assert.ok(
    !names.includes('eve-create-race'),
    `an operator was minted despite the decision record failing -- names: ${names.join(', ')}`,
  );
});

test('a vaco-audit outage during disable leaves the operator enabled', { skip: SKIP }, async () => {
  auditFailing = false;
  const created = await (await authed('/operators', {
    method: 'POST',
    body: JSON.stringify({ name: 'mallory-disable-race' }),
  })).json();
  assert.equal(created.operator.disabledAt, null);

  auditFailing = true;
  const res = await authed(`/operators/${created.operator.id}/disable`, { method: 'POST' });
  assert.equal(res.status, 503);

  const after = await (await authed(`/operators/${created.operator.id}`)).json();
  assert.equal(after.disabledAt, null, 'the operator was disabled despite the decision record failing');
});

test('a vaco-audit outage during a grant leaves the scope ungranted', { skip: SKIP }, async () => {
  auditFailing = false;
  const created = await (await authed('/operators', {
    method: 'POST',
    body: JSON.stringify({ name: 'ada-grant-race' }),
  })).json();

  auditFailing = true;
  const res = await authed(`/operators/${created.operator.id}/grants`, {
    method: 'POST',
    body: JSON.stringify({ scope: 'vago:settle' }),
  });
  assert.equal(res.status, 503);

  const holders = await (await authed('/scopes/vago:settle/holders')).json();
  const names = holders.holders.map((h) => h.operatorName);
  assert.ok(
    !names.includes('ada-grant-race'),
    `a scope was granted despite the decision record failing -- holders: ${names.join(', ')}`,
  );
});

test('a vaco-audit outage during a revoke leaves the grant active', { skip: SKIP }, async () => {
  auditFailing = false;
  const created = await (await authed('/operators', {
    method: 'POST',
    body: JSON.stringify({ name: 'bob-revoke-race' }),
  })).json();
  await authed(`/operators/${created.operator.id}/grants`, {
    method: 'POST',
    body: JSON.stringify({ scope: 'vago:settle' }),
  });

  auditFailing = true;
  const res = await authed(`/operators/${created.operator.id}/grants/revoke`, {
    method: 'POST',
    body: JSON.stringify({ scope: 'vago:settle' }),
  });
  assert.equal(res.status, 503);

  const holders = await (await authed('/scopes/vago:settle/holders')).json();
  const active = holders.holders.filter((h) => h.operatorName === 'bob-revoke-race' && !h.revokedAt);
  assert.equal(active.length, 1, 'the grant was revoked despite the decision record failing');
});
