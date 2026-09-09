// Every HTTP server carries the trace, and carries it in the right order.
//
// **This file exists because three cheaper checks all passed over five
// dead servers.** The tracing sweep inserted the `require` line and the
// `app.use(traceMiddleware())` line independently, and in five apps —
// chopz, chopz-shop, cvnvo, hvntz and VOID — the require landed *below*
// the mount. That is a `ReferenceError` at module evaluation: the
// process exits immediately.
//
// `node --check` passed on all 35 (it is valid syntax). The 860-test
// suite passed (no suite boots those servers). The shared-runtime sync
// passed (the copy was present and required *somewhere*). Only actually
// starting the processes found it — and VOID is the largest app in the
// ecosystem.
//
// So this checks the two things that were wrong, statically and cheaply,
// on every server at once:
//
//   1. the middleware is mounted at all
//   2. the require sits above the mount
//
// It does not replace booting them. `v4-proxy/test/server.test.js`
// spawns a real process for exactly that reason; this is the wide,
// fast net that says which of the 35 to go look at.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Found by walking, not listed. A hand-written list of servers is a list
// that goes stale the next time somebody runs scripts/new-app.mjs.
function servers(dir = REPO_ROOT, depth = 0) {
  if (depth > 2) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...servers(full, depth + 1));
    else if (e.name === 'server.js') out.push(path.relative(REPO_ROOT, full));
  }
  return out;
}

const SERVERS = servers();

test('the scan finds the servers it is meant to check', () => {
  // A tool that finds nothing must not report success.
  assert.ok(
    SERVERS.length >= 30,
    `only ${SERVERS.length} server.js files found — this scan is broken, not the repo`,
  );
  for (const expected of ['void/server.js', 'v3/server.js', 'chopz/chopz-shop/server.js']) {
    assert.ok(SERVERS.includes(expected), `${expected} was not found by the walk`);
  }
});

test('every HTTP server mounts the trace middleware', () => {
  const missing = SERVERS.filter((rel) => {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    return !/app\.use\(traceMiddleware\(\)\)/.test(src);
  });
  assert.deepEqual(
    missing, [],
    'these servers do not mount traceMiddleware, so a trace dies when a request reaches them',
  );
});

test('the require sits above the mount, in every one of them', () => {
  // The exact bug. In CommonJS a `const` is in the temporal dead zone
  // until its declaration runs, so requiring below the `app.use` throws
  // at boot rather than failing later — which is better, but only if
  // somebody starts the process.
  const wrong = [];
  for (const rel of SERVERS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const req = src.search(/tracing\.cjs/);
    const use = src.search(/app\.use\(traceMiddleware\(\)\)/);
    if (req === -1 || use === -1) continue;   // covered by the test above
    if (req > use) wrong.push(rel);
  }
  assert.deepEqual(
    wrong, [],
    'these servers reference traceMiddleware before importing it — they throw a ReferenceError at boot',
  );
});

test('the middleware is mounted before the auth middleware', () => {
  // Order is the whole point: a request that serviceAuth *refuses* must
  // still carry a trace id. A 401 you cannot correlate is exactly the
  // one you want to correlate.
  const wrong = [];
  for (const rel of SERVERS) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const trace = src.search(/app\.use\(traceMiddleware\(\)\)/);
    const auth = src.search(/app\.use\(\s*serviceAuth\.middleware\s*\)/);
    if (trace === -1 || auth === -1) continue;
    if (trace > auth) wrong.push(rel);
  }
  assert.deepEqual(
    wrong, [],
    'these servers mount serviceAuth before tracing, so refused requests carry no trace id',
  );
});

test('every server that mounts it also has the synced copy', () => {
  const missing = SERVERS.filter((rel) => {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (!/app\.use\(traceMiddleware\(\)\)/.test(src)) return false;
    return !fs.existsSync(path.join(REPO_ROOT, path.dirname(rel), 'lib', 'tracing.cjs'));
  });
  assert.deepEqual(missing, [], 'these mount the middleware but have no lib/tracing.cjs to load');
});
