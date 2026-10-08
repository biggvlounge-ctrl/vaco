// VDP — does the real server start, serve its public routes, and do
// its guards actually refuse? Spawns the real process rather than
// importing it (server.cjs calls `server.listen` at module scope, an
// in-process import cannot exercise that the way production actually
// boots it), same reasoning and same shape as vash-tap/test/routes.test.js
// and vaco-notify/test/durability.test.js.
//
// Neither Shield nor V3 is running in this suite — deliberate, same as
// vash-tap's. It proves what a mocked-fetch unit test cannot: that an
// actor-gated route (requireActor) asks Shield and gets a real 502
// rather than hanging or silently passing when Shield is unreachable,
// that a request with no Authorization header at all is refused
// WITHOUT ever contacting Shield (shieldAuth.cjs's own immediate
// bearerToken check), and that the one real success path available
// without any live dependency -- a trusted-service credential, which
// serviceAuth checks locally and never calls Shield for -- actually
// works end to end against the real spawned server.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const DEPS = fs.existsSync(path.join(APP_DIR, 'node_modules', 'express'));
const SKIP = DEPS ? false : 'vdp/node_modules is absent -- these spawn a real server and need `npm install` first';

const PORT = 18827;
const BASE = `http://127.0.0.1:${PORT}`;
const STORE_FILE = path.join(APP_DIR, 'data', 'store.json');

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
      throw new Error(`vdp server did not answer /api/health within ${timeoutMs}ms.\n--- its output was ---\n${bootLog || '(nothing)'}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

test.before(async () => {
  if (!DEPS) return;
  fs.rmSync(STORE_FILE, { force: true });

  child = spawn(process.execPath, ['server.cjs'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Point every cross-app URL at a closed port on purpose -- this
      // suite tests the unreachable-dependency behavior, not a live
      // ecosystem. Real success paths that need Shield or V3 are
      // verified manually (see this session's own curl verification),
      // the same split vash-tap's own header draws.
      V3_API_URL: 'http://127.0.0.1:1',
      SHIELD_API_URL: 'http://127.0.0.1:1',
      VACO_SERVICE_TOKENS: 'venvs:test-venvs-token',
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
  fs.rmSync(STORE_FILE, { force: true });
});

const post = (p, body, headers = {}) => fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body ?? {}),
});

// -- boot / public routes ---------------------------------------------------

test('the server starts, serves health, and ticks a real NPC world', { skip: SKIP }, async () => {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'vdp');
  assert.equal(health.npcs, 14, 'createNpcWorld\'s own default population');
});

test('a never-seen player auto-creates with the real needs/skills/beliefs shape', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/players/brand-new-player/state`)).json();
  assert.ok(body.state.needs);
  assert.ok(body.state.traits);
  assert.deepEqual(body.skills, {
    Business: 0, Crafting: 0, Construction: 0, Communication: 0, Management: 0, Athletics: 0, Art: 0,
  });
  assert.deepEqual(body.beliefs, {});
});

test('GET /api/jobs lists the real fixed job catalog', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/jobs`)).json();
  assert.ok(body.jobs.some((j) => j.id === 'food-cashier'));
  assert.ok(body.jobs.every((j) => Number.isFinite(j.payPerShift) && j.payPerShift > 0));
});

test('GET /api/vacay-hotels reports Meridian\'s real tier cap, not a hardcoded number', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/vacay-hotels`)).json();
  assert.deepEqual(body.listingIds, []);
  assert.ok(Number.isInteger(body.maxHotels) && body.maxHotels >= 1 && body.maxHotels <= 3);
  assert.ok(body.tierName);
});

test('GET /api/resources/:id reports real zero materials and a real old-world stock for a never-seen player', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/resources/never-seen-player`)).json();
  assert.deepEqual(body.materials, { wood: 0, stone: 0, clay: 0, ore: 0 });
  assert.equal(body.canDig, true);
  assert.ok(Number.isFinite(body.oldWorldStock) && body.oldWorldStock > 0);
});

// -- actor-gated routes: refusal behavior, no live Shield ------------------

test('a mutating route with no credential at all is refused by serviceAuth WITHOUT reaching Shield', { skip: SKIP }, async () => {
  // serviceAuth is mounted app-wide, ahead of every route, so a
  // completely bare mutating request never reaches requireActor at
  // all -- it is refused here, by name, same posture every other
  // group-2 route in this ecosystem takes.
  const res = await post('/api/jobs/food-cashier/clock-in', { workerId: 'alice' });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /serviceAuth/);
});

test('a mutating route with a real bearer token gets a real 502 when Shield is unreachable, not a silent pass', { skip: SKIP }, async () => {
  const res = await post('/api/jobs/food-cashier/clock-in', { workerId: 'alice' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireSession must ask Shield and report the outage, not treat it as either success or an expired session');
});

test('registering a Meridian hotel with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/vacay-hotels/register', { listingId: 1, registeredBy: 'alice' });
  assert.equal(res.status, 401);
});

test('registering a Meridian hotel with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/vacay-hotels/register', { listingId: 1, registeredBy: 'alice' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before ever checking the tier cap or calling VACAY');
});

test('digging with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/resources/alice/dig', {});
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /serviceAuth/);
});

test('digging with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/resources/alice/dig', {}, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireParamActor must ask Shield before ever touching the resources store');
});

test('requesting a cook payout with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/food-district/cook-payout', { cookId: 'alice', brandSlug: 'vive' });
  assert.equal(res.status, 401);
});

test('requesting a cook payout with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/food-district/cook-payout', { cookId: 'alice', brandSlug: 'vive' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before ever reaching V3');
});

test('requesting a CHOPZ shift payout with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/chopz/shift-payout', { ownerId: 'alice', unitId: 1 });
  assert.equal(res.status, 401);
});

test('requesting a CHOPZ shift payout with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/chopz/shift-payout', { ownerId: 'alice', unitId: 1 }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before ever reaching V3');
});

// -- the one real success path this suite can prove without Shield/V3 -----

test('library/record succeeds end-to-end with a real trusted-service credential, no Shield needed', { skip: SKIP }, async () => {
  const res = await post('/api/library/record',
    { orderId: 'itest-1', buyerId: 'dana', title: 'The Carpenter\'s Handbook', skillSubject: 'Construction' },
    { 'X-Service-Name': 'venvs', 'X-Service-Token': 'test-venvs-token' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.applied, true);
  assert.equal(body.effect.skill, 'Construction');

  const player = await (await fetch(`${BASE}/api/players/dana/state`)).json();
  assert.equal(player.skills.Construction, 12, 'TEXTBOOK_GAIN applied exactly once');
});

test('the same order id is refused a second real effect -- a retried delivery does not double-bump', { skip: SKIP }, async () => {
  await post('/api/library/record',
    { orderId: 'itest-2', buyerId: 'erin', title: 'The Complete Home Cook', skillSubject: 'Crafting' },
    { 'X-Service-Name': 'venvs', 'X-Service-Token': 'test-venvs-token' });
  const second = await post('/api/library/record',
    { orderId: 'itest-2', buyerId: 'erin', title: 'The Complete Home Cook', skillSubject: 'Crafting' },
    { 'X-Service-Name': 'venvs', 'X-Service-Token': 'test-venvs-token' });
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.applied, false);
});

test('an unrecognized service token is refused, not silently treated as authorized', { skip: SKIP }, async () => {
  const res = await post('/api/library/record',
    { orderId: 'itest-3', buyerId: 'frank', title: 'x', skillSubject: 'Crafting' },
    { 'X-Service-Name': 'venvs', 'X-Service-Token': 'wrong-token' });
  assert.equal(res.status, 401);
});

// -- real-time: the WebSocket layer sends a real snapshot on connect ------

test('connecting to /ws/world sends a real snapshot with the live npc population', { skip: SKIP }, async () => {
  const { default: WebSocket } = await import('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/world`);
  const snapshot = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no snapshot within 3s')), 3000);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'snapshot') {
        clearTimeout(timer);
        resolve(msg);
      }
    });
    ws.on('error', reject);
  });
  assert.equal(snapshot.npcs.length, 14);
  ws.close();
});
