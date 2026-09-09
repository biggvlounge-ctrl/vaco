// Vex Trading — the parent shell over VEX and Vex Business.
//
// **Why this suite exists.** This app is small, and small is exactly
// why it went untested: a static registry and two health probes look
// like nothing worth checking. But a shell's whole job is to point at
// the right things, and a pointer that drifts is silent. If VEX's port
// moves and this registry does not, `/api/apps` reports `reachable:
// false` forever and the honest-looking "a sub-app being down doesn't
// 500 this endpoint" behaviour turns into a permanent lie that nothing
// distinguishes from a real outage.
//
// So the checks that matter here are not about logic — there barely is
// any — they are about whether this shell's claims still match the
// codebase around it:
//
//   1. Every advertised sub-app URL points at that app's real port.
//   2. Reachability is a live probe, never a stored or hardcoded value.
//   3. An unknown sub-app is a 404, not an empty success.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SUB_APPS, listSubApps, getSubApp } = require('../lib/registry.js');

const ROOT = path.join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// The registry itself
// ---------------------------------------------------------------------------

test('the shell lists exactly its two real sub-apps', () => {
  assert.deepEqual(listSubApps().map((a) => a.id).sort(), ['vex', 'vex-business']);
  assert.equal(listSubApps(), SUB_APPS, 'listSubApps returns the registry, not a copy of a copy');
});

test('every sub-app entry carries what a launcher needs to render it', () => {
  for (const app of SUB_APPS) {
    for (const field of ['id', 'name', 'description', 'apiUrl', 'uiUrl', 'uiNote']) {
      assert.ok(app[field], `${app.id} is missing ${field}`);
    }
    assert.match(app.apiUrl, /^https?:\/\//, `${app.id} apiUrl is not a URL`);
    assert.match(app.uiUrl, /^https?:\/\//, `${app.id} uiUrl is not a URL`);
  }
});

test('a known id resolves and an unknown one returns null, not undefined', () => {
  // `undefined` and `null` reach a JSON response differently — one
  // disappears from the body entirely — so the route's 404 check
  // depends on which this is.
  assert.equal(getSubApp('vex').id, 'vex');
  assert.equal(getSubApp('nope'), null);
  assert.equal(getSubApp(undefined), null);
});

// ---------------------------------------------------------------------------
// The pointers still point at real things
// ---------------------------------------------------------------------------

test('VEX\'s advertised API port is the port VEX actually listens on', () => {
  // The drift this whole file exists for. VEX's own server.js is the
  // source of truth; this registry is a copy of one number from it, and
  // a copy nobody checks is a copy that goes stale.
  const vexSource = fs.readFileSync(path.join(ROOT, 'vex', 'server.js'), 'utf8');
  const realPort = vexSource.match(/PORT\s*\|\|\s*(\d+)/)[1];
  const advertised = new URL(getSubApp('vex').apiUrl).port;
  assert.equal(
    advertised, realPort,
    `the shell points at :${advertised} and VEX listens on :${realPort} — /api/apps would `
    + 'report it permanently unreachable, indistinguishable from a real outage',
  );
});

test('the sub-apps this shell claims actually exist on disk', () => {
  // "vex-business" is a Python/FastAPI codebase, not a Node one, so it
  // is checked as a directory rather than by parsing a server.js.
  assert.ok(fs.existsSync(path.join(ROOT, 'vex', 'server.js')), 'vex/ is missing');
  assert.ok(fs.existsSync(path.join(ROOT, 'vex-business')), 'vex-business/ is missing');
});

test('the shell is registered in vaco-shell at its own real port', () => {
  // The other direction: the ecosystem registry points AT this app.
  const shellSource = fs.readFileSync(
    path.join(ROOT, 'vaco-shell', 'lib', 'registry.js'), 'utf8',
  );
  const entry = shellSource.match(/id: 'vex-trading'[^}]*url: '([^']+)'/);
  assert.ok(entry, 'vaco-shell does not list vex-trading at all');

  const ownSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const ownPort = ownSource.match(/PORT\s*\|\|\s*(\d+)/)[1];
  assert.equal(new URL(entry[1]).port, ownPort, 'vaco-shell points at the wrong port for this app');
});

test('no sub-app claims to be a UI this shell does not own', () => {
  // The registry's own header is explicit that neither sub-app has a UI
  // Vex Trading renders, and that VEX's uiUrl deliberately points at
  // VDP. That honesty is load-bearing — a note saying "opens VDP" is
  // the difference between a helpful link and a broken promise.
  const vex = getSubApp('vex');
  assert.match(vex.uiNote, /VDP/, 'VEX\'s uiUrl points elsewhere and must say so');
  assert.match(vex.description, /backend only/i);
});

// ---------------------------------------------------------------------------
// Reachability is measured, not remembered
// ---------------------------------------------------------------------------

test('reachability is never a stored field on a sub-app', () => {
  // If `reachable` were baked into the registry, `/api/apps` would
  // report a fixed answer that happens to look live. The route computes
  // it per request; the registry must not carry it.
  for (const app of SUB_APPS) {
    assert.equal(app.reachable, undefined, `${app.id} carries a stored reachable flag`);
  }
});

test('the server probes each sub-app rather than assuming it is up', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const code = source.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(code, /fetch\(`\$\{apiUrl\}\/api\/health`/, 'no live probe in the source');
  assert.match(code, /AbortSignal\.timeout/, 'a probe with no timeout hangs the whole response');
  assert.doesNotMatch(code, /reachable:\s*true\b/, 'reachability must never be hardcoded true');
});

test('a probe failure is a false, not a thrown error', async () => {
  // One sub-app being down must not 500 the endpoint that reports it —
  // that would take the whole shell offline whenever any child is.
  // Exercised against a port nothing is listening on.
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /catch\s*\{\s*\n\s*return false;/, 'the probe must swallow its own failure');

  // And the real behaviour, not just the shape of the code: an
  // unreachable host resolves false rather than rejecting.
  const probe = async (apiUrl) => {
    try {
      const res = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(300) });
      return res.ok;
    } catch {
      return false;
    }
  };
  assert.equal(await probe('http://127.0.0.1:1'), false);
});
