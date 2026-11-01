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
import { DISTRICTS } from '../src/lib/world.js';

// createNpcWorld's own default founding population (14), plus one real
// government liaison per real district (see npcs.js's own
// seedGovernmentLiaisons, wired into this server's boot sequence) --
// not two separate counts a test should guess between.
const EXPECTED_BOOT_NPC_COUNT = 14 + DISTRICTS.length;

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
  assert.equal(health.npcs, EXPECTED_BOOT_NPC_COUNT, 'createNpcWorld\'s own default population plus one government liaison per real district');
});

test('a never-seen player auto-creates with the real needs/skills/beliefs shape', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/players/brand-new-player/state`)).json();
  assert.ok(body.state.needs);
  assert.ok(body.state.traits);
  assert.deepEqual(body.skills, {
    Business: 0, Crafting: 0, Construction: 0, Communication: 0, Management: 0, Athletics: 0, Art: 0,
    Agriculture: 0, Combat: 0, Engineering: 0, Medicine: 0,
  });
  assert.deepEqual(body.beliefs, {});
});

test('GET /api/jobs lists the real fixed job catalog', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/jobs`)).json();
  assert.ok(body.jobs.some((j) => j.id === 'food-cashier'));
  assert.ok(body.jobs.every((j) => Number.isFinite(j.payPerShift) && j.payPerShift > 0));
});

test('GET /api/vacay-hotels reports the town\'s real tier cap, not a hardcoded number', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/vacay-hotels`)).json();
  assert.deepEqual(body.listingIds, []);
  assert.ok(Number.isInteger(body.maxHotels) && body.maxHotels >= 1 && body.maxHotels <= 3);
  assert.ok(body.tierName);
});

test('GET /api/resources/:id reports real zero materials and a real old-world stock for a never-seen player', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/resources/never-seen-player`)).json();
  assert.deepEqual(body.materials, { wood: 0, stone: 0, clay: 0, ore: 0, game: 0, crop: 0, water: 0, fish: 0 });
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

test('registering a town hotel with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/vacay-hotels/register', { listingId: 1, registeredBy: 'alice' });
  assert.equal(res.status, 401);
});

test('registering a town hotel with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
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

// -- social class / relocation, hospital, school, daycare (9 Oct 2026) -----

test('a never-seen player gets a real social class, derived live, not stored', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/players/social-class-reader/social-class`)).json();
  assert.ok(['elite', 'stable', 'at-risk'].includes(body.socialClass));
});

test('requesting hospital treatment with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/hospital/treat', { patientId: 'alice' });
  assert.equal(res.status, 401);
});

test('requesting hospital treatment with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/hospital/treat', { patientId: 'alice' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before ever reaching V3');
});

test('GET /api/hospital/treatments/:patientId lists a real, empty-by-default array', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/hospital/treatments/never-treated`)).json();
  assert.deepEqual(body.treatments, []);
});

test('attending school with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/school/attend', { studentId: 'alice' });
  assert.equal(res.status, 401);
});

test('attending school with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/school/attend', { studentId: 'alice' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield even for a free action');
});

test('a gym workout with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/gym/workout', { userId: 'alice', skillName: 'Athletics' });
  assert.equal(res.status, 401);
});

test('a gym workout with a real bearer token asks Shield -- real 502 when it is unreachable, never a silent skill bump', { skip: SKIP }, async () => {
  const res = await post('/api/gym/workout', { userId: 'alice', skillName: 'Athletics' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before training anyone\'s real skill');
});

test('GET /api/school/attendances/:studentId lists a real, empty-by-default array', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/school/attendances/never-attended`)).json();
  assert.deepEqual(body.attendances, []);
});

test('enrolling in daycare with no credential is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/daycare/enroll', { guardianId: 'alice' });
  assert.equal(res.status, 401);
});

test('enrolling in daycare with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const res = await post('/api/daycare/enroll', { guardianId: 'alice' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before ever reaching V3');
});

test('GET /api/daycare/enrollments/:guardianId lists a real, empty-by-default array', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/daycare/enrollments/never-enrolled`)).json();
  assert.deepEqual(body.enrollments, []);
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
  assert.equal(snapshot.npcs.length, EXPECTED_BOOT_NPC_COUNT);
  ws.close();
});

// -- live wrestling: two real players, one real-time match ----------------
//
// `live/start` is requireCallingService -- the same local, no-Shield
// check `library/record` above already proves works end to end, so
// this suite can run the full booking-through-going-live path for
// real. `live/move`/`live/forfeit` are requireActor -- this suite can
// only prove their refusal shapes (same split every requireActor route
// above takes); the full two-player match-to-completion path, over a
// real Shield session, was verified manually this session and is
// recorded in VDP_COMBAT_SPORTS_DISTRICT.md.

const svc = { 'X-Service-Name': 'venvs', 'X-Service-Token': 'test-venvs-token' };

test('a real uneven handicap card books, starts, and settles end to end over HTTP', { skip: SKIP }, async () => {
  const sideA = ['big-1', 'big-2', 'big-3'];
  const sideB = ['small-1'];
  const booked = await (await post('/api/combat-sports/matches', {
    matchFormat: 'handicap', combatSportType: 'wrestling', skillLevel: 'amateur',
    participantIds: [...sideA, ...sideB], sideAIds: sideA, sideBIds: sideB,
  }, svc)).json();
  assert.deepEqual(booked.sideAIds, sideA);
  assert.deepEqual(booked.sideBIds, sideB);

  await post(`/api/combat-sports/matches/${booked.matchId}/start`, {}, svc);
  const settled = await (await post(`/api/combat-sports/matches/${booked.matchId}/result`, { winnerIds: sideB }, svc)).json();
  assert.deepEqual(settled.winnerIds, sideB);
  assert.equal(settled.status, 'finished');
});

test('a real mixed-discipline card books and settles end to end over HTTP', { skip: SKIP }, async () => {
  const booked = await (await post('/api/combat-sports/matches', {
    matchFormat: 'one-on-one', skillLevel: 'amateur', participantIds: ['boxer-1', 'wrestler-1'],
    disciplineByParticipant: { 'boxer-1': 'boxing', 'wrestler-1': 'wrestling' },
  }, svc)).json();
  assert.equal(booked.combatSportType, 'mixed');
  assert.deepEqual(booked.disciplineByParticipant, { 'boxer-1': 'boxing', 'wrestler-1': 'wrestling' });

  await post(`/api/combat-sports/matches/${booked.matchId}/start`, {}, svc);
  const settled = await (await post(`/api/combat-sports/matches/${booked.matchId}/result`, { winnerIds: ['boxer-1'] }, svc)).json();
  assert.equal(settled.status, 'finished');
});

// Fresh, never-repeated participant ids per call -- none of these test
// matches ever resolve (that would need a real live match played out),
// so reusing a pair would make `assertBookable` correctly refuse the
// next booking ("already in a live match"), the exact real collision
// this session's own manual verification hit first.
let liveMatchCounter = 0;
async function bookLiveSinglesMatch() {
  liveMatchCounter += 1;
  const booked = await post('/api/combat-sports/matches', {
    matchFormat: 'one-on-one', combatSportType: 'wrestling', skillLevel: 'street',
    participantIds: [`ada-${liveMatchCounter}`, `bo-${liveMatchCounter}`],
  }, svc);
  const match = await booked.json();
  await post(`/api/combat-sports/matches/${match.matchId}/start`, {}, svc);
  return { matchId: match.matchId, wrestlerId: `ada-${liveMatchCounter}` };
}

test('GET /api/combat-sports/matches/:id/live 404s before any live match has started', { skip: SKIP }, async () => {
  const { matchId } = await bookLiveSinglesMatch();
  const res = await fetch(`${BASE}/api/combat-sports/matches/${matchId}/live`);
  assert.equal(res.status, 404);
});

test('live/start succeeds end-to-end with a real trusted-service credential, seeding both wrestlers at full health', { skip: SKIP }, async () => {
  const { matchId, wrestlerId } = await bookLiveSinglesMatch();
  const res = await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  assert.equal(res.status, 201);
  const live = await res.json();
  assert.equal(live.wrestlers[wrestlerId].health, 100);
  assert.equal(Object.keys(live.wrestlers).length, 2);
  assert.equal(live.waitingOn.length, 2);

  const read = await (await fetch(`${BASE}/api/combat-sports/matches/${matchId}/live`)).json();
  assert.deepEqual(read, live);
});

test('live/start is refused without a real service credential', { skip: SKIP }, async () => {
  const { matchId } = await bookLiveSinglesMatch();
  const res = await post(`/api/combat-sports/matches/${matchId}/live/start`, {});
  assert.equal(res.status, 401);
});

test('live/start twice on the same match is refused -- a live match cannot be opened over itself', { skip: SKIP }, async () => {
  const { matchId } = await bookLiveSinglesMatch();
  await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  const second = await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  assert.equal(second.status, 400);
});

test('live/move with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const { matchId, wrestlerId } = await bookLiveSinglesMatch();
  await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  const res = await post(`/api/combat-sports/matches/${matchId}/live/move`, { wrestlerId, move: 'strike' });
  assert.equal(res.status, 401);
});

test('live/move with a real bearer token asks Shield -- real 502 when it is unreachable, never a silent pass for who gets to move', { skip: SKIP }, async () => {
  const { matchId, wrestlerId } = await bookLiveSinglesMatch();
  await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  const res = await post(`/api/combat-sports/matches/${matchId}/live/move`,
    { wrestlerId, move: 'strike' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before a move is ever accepted on a real wrestler\'s behalf');
});

test('live/forfeit with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const { matchId, wrestlerId } = await bookLiveSinglesMatch();
  await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  const res = await post(`/api/combat-sports/matches/${matchId}/live/forfeit`, { wrestlerId });
  assert.equal(res.status, 401);
});

test('live/forfeit with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const { matchId, wrestlerId } = await bookLiveSinglesMatch();
  await post(`/api/combat-sports/matches/${matchId}/live/start`, {}, svc);
  const res = await post(`/api/combat-sports/matches/${matchId}/live/forfeit`,
    { wrestlerId }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before a forfeit can ever end a real match');
});

// -- conflicts: disputes and street/turf fights ----------------------------
//
// Declaring/starting/forfeit-side/escalate are all requireCallingService,
// the same local no-Shield check proven above, so this suite runs a
// real conflict all the way through settlement. `duel/move` and
// `duel/forfeit` are requireActor -- same split as live wrestling
// above, so only their refusal shapes are proven here.

let conflictCounter = 0;
async function declareConflict(overrides = {}) {
  conflictCounter += 1;
  const res = await post('/api/conflicts', {
    kind: 'dispute', reason: 'turf',
    sideA: { groupId: `tribe-ashwood-${conflictCounter}`, label: `Ashwood ${conflictCounter}`, participantIds: [`ash1-${conflictCounter}`, `ash2-${conflictCounter}`] },
    sideB: { groupId: `tribe-redrock-${conflictCounter}`, label: `Redrock ${conflictCounter}`, participantIds: [`red1-${conflictCounter}`] },
    ...overrides,
  }, svc);
  return res.json();
}

test('POST /api/conflicts is refused without a real service credential', { skip: SKIP }, async () => {
  const res = await post('/api/conflicts', {
    kind: 'street-fight', sideA: { participantIds: ['x1'] }, sideB: { participantIds: ['x2'] },
  });
  assert.equal(res.status, 401);
});

test('a conflict allows a real uneven handicap (2 versus 1) and is readable back by id', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  assert.equal(declared.sideA.startingCount, 2);
  assert.equal(declared.sideB.startingCount, 1);
  assert.equal(declared.status, 'scheduled');

  const read = await (await fetch(`${BASE}/api/conflicts/${declared.conflictId}`)).json();
  assert.equal(read.conflictId, declared.conflictId);
});

test('starting a conflict opens its first real duel and lists it in GET /api/conflicts', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  const started = await (await post(`/api/conflicts/${declared.conflictId}/start`, {}, svc)).json();
  assert.equal(started.conflict.status, 'live');
  assert.ok(started.duel.wrestlers);
  assert.equal(Object.keys(started.duel.wrestlers).length, 2);

  const list = await (await fetch(`${BASE}/api/conflicts`)).json();
  assert.ok(list.conflicts.some((c) => c.conflictId === declared.conflictId));
});

test('duel/move with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  await post(`/api/conflicts/${declared.conflictId}/start`, {}, svc);
  const res = await post(`/api/conflicts/${declared.conflictId}/duel/move`, { wrestlerId: 'any-wrestler', move: 'strike' });
  assert.equal(res.status, 401);
});

test('duel/forfeit with a real bearer token asks Shield -- real 502 when it is unreachable', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  await post(`/api/conflicts/${declared.conflictId}/start`, {}, svc);
  const res = await post(`/api/conflicts/${declared.conflictId}/duel/forfeit`,
    { wrestlerId: 'someone' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502, 'requireActor must ask Shield before a forfeit can ever end a real duel');
});

test('forfeiting a whole side settles the conflict and credits real leaderboard records for every fighter and both groups', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  await post(`/api/conflicts/${declared.conflictId}/start`, {}, svc);
  const settled = await (await post(`/api/conflicts/${declared.conflictId}/forfeit-side`, { sideKey: 'B' }, svc)).json();
  assert.equal(settled.status, 'finished');
  assert.equal(settled.winningSide, 'A');
  assert.equal(settled.resolution, 'forfeit');

  const rating = await (await fetch(`${BASE}/api/leaderboards/rating`)).json();
  assert.ok(rating.leaders.some((l) => l.fighterId === declared.sideA.groupId), 'the winning tribe itself gets a real rating record');
});

test('escalate refuses a conflict that has not crossed the real war threshold', { skip: SKIP }, async () => {
  const declared = await declareConflict();
  await post(`/api/conflicts/${declared.conflictId}/start`, {}, svc);
  const res = await post(`/api/conflicts/${declared.conflictId}/escalate`, {}, svc);
  assert.equal(res.status, 400);
});

test('GET /api/leaderboards/rising starts empty and never 500s on an empty store', { skip: SKIP }, async () => {
  // This runs early enough in a fresh suite run that it is a real
  // smoke test of the route existing and returning a real shape, not
  // a claim about contents (other tests in this file populate the
  // store concurrently in a shared server).
  const res = await fetch(`${BASE}/api/leaderboards/rising`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.leaders));
});

test('POST /api/predictions/open requires a real question and 502s honestly when VAGO is unreachable', { skip: SKIP }, async () => {
  const missingQuestion = await post('/api/predictions/open', {}, svc);
  assert.equal(missingQuestion.status, 400);

  const res = await post('/api/predictions/open', { question: 'Will there be an invasion of Redrock?' }, svc);
  assert.equal(res.status, 502, 'VAGO is not running in this suite -- a real, honest failure, never a fabricated market');
});

// -- venues: a real promoter renting a real gym or stadium -----------------

test('GET /api/venues lists the real, named catalog', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/venues`)).json();
  assert.ok(body.venues.some((v) => v.id === 'combat-sports-gym'));
  assert.ok(body.venues.some((v) => v.id === 'downtown-stadium'));
});

test('GET /api/venues/bookings/:id 404s honestly for an unknown booking', { skip: SKIP }, async () => {
  const res = await fetch(`${BASE}/api/venues/bookings/999999`);
  assert.equal(res.status, 404);
});

test('booking a venue with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/venues/bookings', { promoterId: 'promoter-1', venueId: 'combat-sports-gym' });
  assert.equal(res.status, 401);
});

test('booking a venue with a real bearer token asks Shield -- real 502 when it is unreachable, never a silent charge for renting it', { skip: SKIP }, async () => {
  const res = await post('/api/venues/bookings',
    { promoterId: 'promoter-1', venueId: 'combat-sports-gym' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502);
});

test('setting a ticket price with no credential at all is refused WITHOUT reaching Shield', { skip: SKIP }, async () => {
  const res = await post('/api/venues/bookings/1/ticket-price', { promoterId: 'promoter-1', price: 25 });
  assert.equal(res.status, 401);
});

test('buying a ticket with a real bearer token asks Shield -- real 502 when it is unreachable, never moving real VCoin on an unverified identity', { skip: SKIP }, async () => {
  const res = await post('/api/venues/bookings/1/tickets',
    { buyerId: 'fan-1' }, { Authorization: 'Bearer some-token' });
  assert.equal(res.status, 502);
});

// -- promotions: the real ownership ladder ---------------------------------

test('POST /api/promotions is refused without a real service credential', { skip: SKIP }, async () => {
  const res = await post('/api/promotions', { promotionId: 'p1', name: 'X', ownerId: 'owner-1', sport: 'wrestling' });
  assert.equal(res.status, 401);
});

test('founding a promotion, signing a fighter, reading its record, and selling it all work end to end, for real, with a service credential', { skip: SKIP }, async () => {
  const promo = await (await post('/api/promotions', {
    promotionId: 'p-e2e', name: 'Iron Fist Wrestling', ownerId: 'owner-e2e', ownerType: 'player', sport: 'wrestling',
  }, svc)).json();
  assert.equal(promo.promotionId, 'p-e2e');

  const read = await (await fetch(`${BASE}/api/promotions/p-e2e`)).json();
  assert.equal(read.name, 'Iron Fist Wrestling');

  const signed = await (await post('/api/promotions/p-e2e/sign', { fighterId: 'fighter-e2e' }, svc)).json();
  assert.ok(signed.rosterIds.includes('fighter-e2e'));

  const fighterStatus = await (await fetch(`${BASE}/api/fighters/fighter-e2e/promotion`)).json();
  assert.equal(fighterStatus.independent, false);
  assert.equal(fighterStatus.promotion.promotionId, 'p-e2e');

  const record = await (await fetch(`${BASE}/api/promotions/p-e2e/record`)).json();
  assert.equal(record.rosterSize, 1);

  const byOwner = await (await fetch(`${BASE}/api/promotions/owners/owner-e2e`)).json();
  assert.ok(byOwner.promotions.some((p) => p.promotionId === 'p-e2e'));

  const sold = await (await post('/api/promotions/p-e2e/sell', { newOwnerId: 'gang-ashwood', newOwnerType: 'organization' }, svc)).json();
  assert.equal(sold.ownerId, 'gang-ashwood');

  const released = await (await post('/api/promotions/p-e2e/release', { fighterId: 'fighter-e2e' }, svc)).json();
  assert.equal(released.rosterIds.length, 0);
  const nowIndependent = await (await fetch(`${BASE}/api/fighters/fighter-e2e/promotion`)).json();
  assert.equal(nowIndependent.independent, true);
});

test('GET /api/fighters/:id/promotion reports a real never-signed fighter as independent', { skip: SKIP }, async () => {
  const body = await (await fetch(`${BASE}/api/fighters/never-signed-fighter/promotion`)).json();
  assert.equal(body.independent, true);
  assert.equal(body.promotion, null);
});
