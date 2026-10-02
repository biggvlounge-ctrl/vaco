// VACO MEDIA -- POST /api/play must bill the signed URL's expiry to
// the grant that was actually presented, not to whichever active
// grant for that (assetId, viewerId) pair happens to be first in the
// store.
//
// **Why this spawns the real server.** The bug lived entirely in
// server.js's route, not in lib/assets.js (whose own tests call
// verifyPlaybackGrant directly and never exercise the route's
// after-the-fact grant re-lookup). server.js has no module exports and
// calls app.listen() unconditionally, so this is a real server over a
// real socket, same as vacon-c's and vaco-operator's route tests.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false
  : 'vaco-media/node_modules is absent -- these spawn a real server and need `npm install` first';

const SERVICE_NAME = 'test-svc';
const SERVICE_TOKEN = 'test-svc-token-for-play-test';
const STORE_FILE = path.join(APP_DIR, 'data', 'store.json');

let server;
let PORT;
let BASE;

test.before(async () => {
  if (SKIP) return;
  fs.rmSync(STORE_FILE, { force: true });

  PORT = 9400 + Math.floor(Math.random() * 400);
  BASE = `http://127.0.0.1:${PORT}/api`;

  server = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      VACO_SERVICE_TOKENS: `${SERVICE_NAME}:${SERVICE_TOKEN}`,
      VACO_MEDIA_STORAGE: 'local',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vaco-media did not start within 10s')), 10000);
    server.stdout.on('data', (d) => {
      if (d.toString().includes('listening')) { clearTimeout(timer); resolve(); }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vaco-media exited before listening (code ${code})`));
    });
  });
});

test.after(() => {
  if (server) server.kill();
  fs.rmSync(STORE_FILE, { force: true });
});

function asService(path, options = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': SERVICE_NAME,
      'X-Service-Token': SERVICE_TOKEN,
      ...(options.headers || {}),
    },
  });
}

test('a signed URL\'s expiry matches the grant actually presented, not an earlier sibling grant', { skip: SKIP }, async () => {
  const asset = (await (await asService('/assets', {
    method: 'POST',
    body: JSON.stringify({ app: 'vulture-flix', externalId: 'title-play-race', kind: 'video', ownerId: 'studio-1' }),
  })).json());

  await asService(`/assets/${asset.id}/storage`, {
    method: 'POST',
    body: JSON.stringify({ storageKey: 'k1', bytes: 1000 }),
  });
  await asService(`/assets/${asset.id}/ready`, { method: 'POST' });

  // Grant A: issued first, long TTL (the default -- several hours).
  // It lands first in store.grants, so a lookup keyed only on
  // (assetId, viewerId, not revoked) finds it before anything else.
  const a = (await (await asService(`/assets/${asset.id}/playback-grants`, {
    method: 'POST',
    body: JSON.stringify({ viewerId: 'viewer-1' }),
  })).json());

  // Grant B: issued second, a short TTL. A real, independent grant for
  // the same viewer and asset -- a re-requested playback, a second
  // device -- not a malicious construction.
  const b = (await (await asService(`/assets/${asset.id}/playback-grants`, {
    method: 'POST',
    body: JSON.stringify({ viewerId: 'viewer-1', ttlMs: 5000 }),
  })).json());

  assert.ok(b.grant.expiresAt < a.grant.expiresAt, 'grant B must be the shorter-lived of the two for this test to mean anything');

  // Play using B's credential -- the short-lived grant.
  const playRes = await fetch(`${BASE}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: b.credential, assetId: asset.id }),
  });
  const play = await playRes.json();

  assert.equal(playRes.status, 200);
  // The signed URL must expire with B -- the grant the credential
  // actually names -- not with A, which happens to sit earlier in the
  // store and would otherwise hand the short-lived credential's holder
  // a URL that outlives it.
  assert.equal(play.expiresAt, b.grant.expiresAt,
    `the signed URL's expiry (${play.expiresAt}) did not match the presented grant's own expiry `
    + `(${b.grant.expiresAt}) -- it came from a different, earlier-issued grant instead`);
});
