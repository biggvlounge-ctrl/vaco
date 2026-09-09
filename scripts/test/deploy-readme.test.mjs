// deploy/README.md is the first file somebody deploying reads. Does it
// still describe what the generators actually emit?
//
// **Why this exists.** It had drifted, and quietly: "34 Express
// backends + 2 Vite frontends... 38 Compose services and 28 named
// volumes" against a real 37 / 3 / 42 / 32. Nothing was wrong with the
// deployment — the generators were right the whole time — but the
// document a specialist opens first was describing a smaller ecosystem
// than the one they would be building, and a service count that is off
// by four is the kind of thing noticed halfway through a build, when
// it reads as "something is missing" rather than "the README is old".
//
// The same argument as `scripts/test/system-of-record.test.mjs`, which
// holds that document against the system: a number in prose is a claim,
// and a claim nothing checks is one that will eventually be false. So
// these read the *generated artifacts* and require the README to agree
// with them, rather than requiring a human to remember.
//
// Deliberately narrow: it checks the counts, not the prose. A document
// can be out of date in ways no test can see, and pretending otherwise
// would be worse than this modest guarantee.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');

const readme = read('deploy/README.md');
const compose = read('docker-compose.yml');
const nginx = read('deploy/nginx-docker.conf');
const ecosystem = read('deploy/ecosystem.config.js');

// Every count the README states, found rather than assumed — so a
// number added later is covered without editing this file.
function claims(re) {
  // matchAll requires the global flag; the callers below write plain
  // patterns, so add it here rather than at every call site.
  return [...readme.matchAll(new RegExp(re.source, `${re.flags}g`))].map((m) => Number(m[1]));
}

test('the README states the real number of Compose services', () => {
  // Everything under `services:`, which is app services plus nginx and
  // livekit — the two that come from images rather than a build.
  const servicesBlock = compose.split(/\n(?=volumes:\n)/)[0];
  const actual = [...servicesBlock.matchAll(/\n {2}([a-z0-9][\w-]*):\n/g)].length;
  const stated = claims(/(\d+)\s*\n?Compose services/);
  assert.ok(stated.length > 0, 'the README no longer states a Compose service count');
  for (const n of stated) {
    assert.equal(n, actual,
      `deploy/README.md says ${n} Compose services; docker-compose.yml has ${actual}`);
  }
});

test('the README states the real number of named volumes', () => {
  // Bounded at `networks:` — running to end of file counts the network
  // name as a volume, which is how this test first reported 33 against
  // a correct README.
  const volumesBlock = (compose.split(/\n(?=volumes:\n)/)[1] || '').split(/\nnetworks:/)[0];
  const actual = [...volumesBlock.matchAll(/\n {2}([a-z0-9][\w-]*):/g)].length;
  const stated = claims(/(\d+) named volumes/);
  assert.ok(stated.length > 0, 'the README no longer states a volume count');
  for (const n of stated) {
    assert.equal(n, actual, `deploy/README.md says ${n} named volumes; compose defines ${actual}`);
  }
});

test('the README states the real backend and frontend split', () => {
  // Backends and frontends are distinguished by which shared Dockerfile
  // a service builds from — the same distinction the generators make.
  const backends = (compose.match(/dockerfile:\s*\.\.?\/?\.*\/deploy\/Dockerfile\.node/g) || []).length;
  const frontends = (compose.match(/dockerfile:\s*\.\.\/deploy\/Dockerfile\.vite/g) || []).length;

  const statedBackends = claims(/(\d+) Express\s*\n?backends/);
  const statedFrontends = claims(/(\d+) Vite frontends/);
  assert.ok(statedBackends.length > 0 && statedFrontends.length > 0,
    'the README no longer states the backend/frontend split');
  for (const n of statedBackends) {
    assert.equal(n, backends, `README says ${n} Express backends; compose builds ${backends} from Dockerfile.node`);
  }
  for (const n of statedFrontends) {
    assert.equal(n, frontends, `README says ${n} Vite frontends; compose builds ${frontends} from Dockerfile.vite`);
  }
});

test('the README states the real nginx location and brace counts', () => {
  const locations = (nginx.match(/^\s*location\s/gm) || []).length;
  const open = (nginx.match(/\{/g) || []).length;
  const close = (nginx.match(/\}/g) || []).length;

  assert.equal(open, close, `the generated nginx config does not balance: ${open} open, ${close} close`);

  const statedLocations = claims(/(\d+) `location` blocks/);
  assert.ok(statedLocations.length > 0, 'the README no longer states a location-block count');
  for (const n of statedLocations) {
    assert.equal(n, locations, `README says ${n} location blocks; nginx-docker.conf has ${locations}`);
  }

  const statedBraces = claims(/\((\d+) open/);
  for (const n of statedBraces) {
    assert.equal(n, open, `README says ${n} open braces; nginx-docker.conf has ${open}`);
  }
});

test('the README states the real pm2 backend count', () => {
  // ecosystem.config.js is the pm2 path and deliberately excludes the
  // Vite frontends, so this is a different number from the Compose one
  // and has its own way of going stale.
  const actual = (ecosystem.match(/name:\s*['"]/g) || []).length;
  const stated = claims(/\*\*(\d+) backends\*\*/);
  assert.ok(stated.length > 0, 'the README no longer states a pm2 backend count');
  for (const n of stated) {
    assert.equal(n, actual, `README says ${n} pm2 backends; ecosystem.config.js defines ${actual}`);
  }
});

test('the historical pm2 run is still labelled as historical', () => {
  // **The one prose check, and it earns its place.** That run was real
  // and is worth keeping, but it happened at 26 apps and the generator
  // now emits 37. Presented without that framing it reads as a current
  // all-green for an ecosystem 40% larger than the one actually tested.
  assert.match(readme, /Live-verified when the pm2 path was built/,
    'the 26-app pm2 verification is being presented as current');
  assert.match(readme, /has not been repeated at \d+/,
    'the README no longer says the pm2 run was not repeated at the current count');
});
