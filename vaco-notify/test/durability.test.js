// VACO NOTIFY -- an undelivered notification must survive a crash
// just as reliably as a delivered one.
//
// **Why this spawns the real server.** The bug lived entirely in how
// server.js and lib/persistence.js's durable() hook interact, which
// test/notify.test.js's direct calls into lib/notify.js never
// exercise: `durable()` only forces a synchronous flush on a 2xx
// response, and POST /api/notify deliberately answers 500 for an
// *undelivered* notification -- a real write, not a failed one. Left
// to the generic hook, that write fell back to the ordinary 200ms
// debounce, and a crash in that window lost it: a restart with
// `undeliveredAlerts` back to looking clean, the exact "green status
// page while nobody was paged" failure this service exists to
// prevent.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false
  : 'vaco-notify/node_modules is absent -- this spawns a real server and needs `npm install` first';

const STORE_FILE = path.join(APP_DIR, 'data', 'store.json');

let server;
let PORT;
let BASE;

test.before(async () => {
  if (SKIP) return;
  fs.rmSync(STORE_FILE, { force: true });

  PORT = 9500 + Math.floor(Math.random() * 400);
  BASE = `http://127.0.0.1:${PORT}/api`;

  server = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT), VACO_SERVICE_AUTH_MODE: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vaco-notify did not start within 10s')), 10000);
    server.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) { clearTimeout(timer); resolve(); }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vaco-notify exited before listening (code ${code})`));
    });
  });
});

test.after(() => {
  if (server) server.kill();
  fs.rmSync(STORE_FILE, { force: true });
});

test('an undelivered notification is on disk the instant the 500 is answered, not after the debounce', { skip: SKIP }, async () => {
  // server.js seeds one default subscription on first boot (console,
  // minSeverity 'alert') so a fresh install is never silently
  // undelivered-by-default -- which means 'critical' and 'alert'
  // notifications land there. 'signal' sits below that threshold
  // (SEVERITIES = ['signal', 'alert', 'critical']), so it matches
  // nothing and send() marks it 'undelivered' -- a real write to
  // store.notifications regardless, per notify.js's own comment:
  // "nobody was configured to hear this" and "this was heard" are
  // both real, distinct outcomes, and only the first one is
  // undelivered. The route answers 500 for exactly that reason.
  const res = await fetch(`${BASE}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app: 'vsafe', severity: 'signal', title: 'nobody is subscribed to this',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 500, 'an undelivered notification must answer 500, not a uniform 2xx');
  assert.equal(body.status, 'undelivered');

  // Read the store file back SYNCHRONOUSLY, in the same tick the HTTP
  // response resolved -- well inside the 200ms debounce window the
  // generic durable() hook would otherwise have left this waiting in.
  // If the commit was forced, the write is already there; if it was
  // left to the debounce, the file is still whatever it was before
  // this request (most likely absent, since nothing else wrote yet).
  const onDisk = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  const persisted = onDisk.notifications.find((n) => n.id === body.id);
  assert.ok(persisted, 'the undelivered notification was not on disk immediately after the 500 -- it is sitting in the debounce window, where a crash would lose it');
  assert.equal(persisted.status, 'undelivered');
});
