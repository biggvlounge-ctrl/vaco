// Every cross-app URL an app reads must be one the compose generator
// knows how to wire.
//
// **The bug this was written for.** Three apps — `vsafe`, `dreams` and
// `vaco-analytics` — read `process.env.VACO_NOTIFY_URL`, and that
// variable was absent from `ENV_VAR_TO_SERVICE` in
// `deploy/generate-docker-compose.js`. So compose never set it, all
// three fell back to their built-in `http://localhost:8818` default,
// and inside a container that address is the container itself.
//
// Every notification the ecosystem raised was therefore refused by
// nothing and swallowed. All three callers wrap the send in a
// deliberately silent catch — correct on its own terms, since a DREAMS
// impression is not the place to surface a channel outage — so there
// was no error, no log, and no symptom. The channel worked perfectly in
// local dev, where localhost:8818 really is vaco-notify, and was
// completely dead in Docker.
//
// That combination is the whole lesson: a **hand-maintained map** plus
// a **fallback default that works in dev** plus a **silent failure
// path** produces something that cannot be noticed by testing, running,
// or reading any one file. It is only visible by holding the two lists
// against each other, which is what this does.
//
// The map is deliberately hand-maintained — its own comment explains
// why, and that reasoning still stands: "a rename on either side is a
// visible, deliberate edit here, not a silent regex match." This test
// keeps that property while removing the one failure mode it had.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATOR = path.join(REPO_ROOT, 'deploy', 'generate-docker-compose.js');

// The generator's own table, read out of its source rather than
// imported — the file is a script that writes on load.
function mappedVars() {
  const src = fs.readFileSync(GENERATOR, 'utf8');
  const block = src.match(/const ENV_VAR_TO_SERVICE = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'could not find ENV_VAR_TO_SERVICE in the generator — this scan is broken');
  return new Map(
    [...block[1].matchAll(/^\s*([A-Z][A-Z0-9_]*):\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]),
  );
}

// Every `process.env.SOMETHING_URL` an app's own server reads.
function readVars() {
  const found = new Map();                       // var -> [apps]
  for (const entry of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    for (const rel of [
      path.join(entry.name, 'server.js'),
      ...fs.existsSync(path.join(REPO_ROOT, entry.name, 'lib'))
        ? fs.readdirSync(path.join(REPO_ROOT, entry.name, 'lib'))
          .filter((f) => f.endsWith('.js')).map((f) => path.join(entry.name, 'lib', f))
        : [],
    ]) {
      const full = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(full)) continue;
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*_URL)\b/g)) {
        if (!found.has(m[1])) found.set(m[1], new Set());
        found.get(m[1]).add(entry.name);
      }
    }
  }
  return found;
}

// Variables that are genuinely not another service in this compose
// file. Each named individually, with a reason — a blanket skip would
// reopen exactly the hole this test closes.
const NOT_A_SERVICE = {
  // The Shell is reached from a browser, not container-to-container;
  // vdp/venvs are Vite apps and this is a client-side origin.
  VACO_SHELL_URL: 'a browser-facing origin, not a service-to-service address',
  SHELL_URL: 'same — the launcher origin a user is sent back to',
  // Media plane vendors, deliberately external.
  LIVEKIT_URL: 'an external vendor endpoint, configured per deployment',
  VACO_MEDIA_CDN_BASE: 'an external CDN origin',
  DATABASE_URL: 'a Postgres connection string, not an HTTP service',
};

test('the generator has a URL table, and it is not empty', () => {
  const mapped = mappedVars();
  assert.ok(mapped.size > 15, `parsed only ${mapped.size} entries — the scan is broken`);
  assert.equal(mapped.get('V3_API_URL'), 'v3');
});

test('every cross-app URL an app reads is one compose knows how to wire', () => {
  const mapped = mappedVars();
  const read = readVars();
  assert.ok(read.size > 10, `found only ${read.size} URL reads — the scan is broken`);

  const unwired = [];
  for (const [name, apps] of read) {
    if (mapped.has(name) || name in NOT_A_SERVICE) continue;
    unwired.push(`${name}  (read by ${[...apps].sort().join(', ')})`);
  }

  assert.deepEqual(
    unwired, [],
    'These apps read a cross-app URL that docker-compose never sets, so each falls back to '
    + 'its localhost default — which inside a container is the container itself:\n    '
    + `${unwired.join('\n    ')}\n`
    + 'Add it to ENV_VAR_TO_SERVICE in deploy/generate-docker-compose.js, or to '
    + 'NOT_A_SERVICE here with a reason if it genuinely is not one.',
  );
});

test('every mapped variable points at a service compose actually builds', () => {
  // The mirror direction: a map entry naming a service that no longer
  // exists wires an address to nothing.
  const compose = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf8');
  const services = new Set(
    [...compose.matchAll(/^ {2}([a-z0-9-]+):\n {4}build:/gm)].map((m) => m[1]),
  );
  const dangling = [...mappedVars()]
    .filter(([, svc]) => !services.has(svc))
    .map(([name, svc]) => `${name} -> "${svc}"`);
  assert.deepEqual(dangling, [], `the URL table points at services that do not exist: ${dangling.join(', ')}`);
});

test('the notify channel specifically is wired for all three of its callers', () => {
  // Pinned by name, because this is the one that was broken and the
  // one whose failure is silent by design in all three callers.
  const compose = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf8');
  for (const app of ['vsafe', 'dreams', 'vaco-analytics']) {
    const block = compose.split(/^ {2}(?=[a-z0-9-]+:$)/m).find((b) => b.startsWith(`${app}:`));
    assert.ok(block, `no ${app} service in docker-compose.yml`);
    assert.match(
      block, /VACO_NOTIFY_URL: "http:\/\/vaco-notify:8818"/,
      `${app} reads VACO_NOTIFY_URL but compose does not set it — its notifications `
      + 'will be swallowed by its own silent catch block.',
    );
  }
});

test('every non-service exemption carries a reason', () => {
  for (const [name, reason] of Object.entries(NOT_A_SERVICE)) {
    assert.ok(reason.trim().length > 15, `${name}'s exemption reason is too thin: "${reason}"`);
  }
});
