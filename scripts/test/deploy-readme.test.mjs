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
const nginxExample = read('deploy/nginx-vaco.conf.example');
const ecosystem = read('deploy/ecosystem.config.js');
const startScript = read('start-ecosystem.sh');

// Every count the README states, found rather than assumed — so a
// number added later is covered without editing this file.
//
// **Whitespace is normalised first, and that is load-bearing.** The
// README is hard-wrapped, so where the line break happens to fall
// decides whether "36 expected `location` blocks" is one space or a
// newline. Twice now a pattern written with a literal space matched
// nothing and the test reported "the README no longer states a count"
// — or worse, silently checked one of two claims — against a README
// that stated it perfectly well. Collapsing runs of whitespace to a
// single space makes a claim's wrapping irrelevant to whether it is
// checked, which is the only version of this that can be trusted.
function claims(re, within = readme) {
  const flat = within.replace(/\s+/g, ' ');
  // matchAll requires the global flag; the callers below write plain
  // patterns, so add it here rather than at every call site.
  return [...flat.matchAll(new RegExp(re.source, `${re.flags}g`))].map((m) => Number(m[1]));
}

// **Which nginx file is a given count about?** The README documents
// two generated nginx configs — `nginx-docker.conf` for Compose and
// `nginx-vaco.conf.example` for the bare-metal VPS path — and states
// location and brace counts for both, in the same words. Checking
// every such claim against one file was a real bug in this test: it
// happened to pass only while the two configs coincidentally agreed,
// and would have reported the VPS section wrong the moment they
// diverged (as they had, by four apps, when this was written).
//
// A count is attributed to whichever config its own `## ` section
// names. A section that names neither states no nginx counts, so
// there is nothing to attribute.
function nginxSections() {
  return readme.split(/\n(?=## )/).map((body) => {
    if (body.includes('nginx-docker.conf')) return { body, file: nginx, name: 'nginx-docker.conf' };
    if (body.includes('nginx-vaco.conf.example') || body.includes('generate-nginx-conf.js')) {
      return { body, file: nginxExample, name: 'nginx-vaco.conf.example' };
    }
    return null;
  }).filter(Boolean);
}

// The authoritative app/path/port list. `start-ecosystem.sh`'s APPS
// array is what every deploy generator reads; parsed here the same way
// they parse it, so this test fails for the same reason they would.
function manifestApps() {
  const m = startScript.match(/APPS=\(([\s\S]*?)\n\)/);
  assert.ok(m, 'start-ecosystem.sh no longer has an APPS=( ... ) manifest');
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => {
      const [name, appPath, cmd, port] = l.slice(1, -1).split(':');
      return { name, appPath, cmd, port };
    });
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
  const sections = nginxSections();
  assert.ok(sections.length > 0, 'the README no longer documents either generated nginx config');

  let checkedLocations = 0;
  for (const { body, file, name } of sections) {
    const locations = (file.match(/^\s*location\s/gm) || []).length;
    const open = (file.match(/\{/g) || []).length;
    const close = (file.match(/\}/g) || []).length;

    assert.equal(open, close, `${name} does not balance: ${open} open, ${close} close`);

    // "36 `location` blocks" and "36 expected `location` blocks" are
    // both how the README words it; the optional adjective is why an
    // earlier version of this pattern silently matched nothing and
    // reported "the README no longer states a count" against a README
    // that stated two.
    for (const n of claims(/(\d+)(?: expected)? `location` blocks/, body)) {
      checkedLocations += 1;
      assert.equal(n, locations, `README says ${n} location blocks; ${name} has ${locations}`);
    }
    for (const n of claims(/\((\d+) open/, body)) {
      assert.equal(n, open, `README says ${n} open braces; ${name} has ${open}`);
    }
  }

  assert.ok(checkedLocations > 0, 'the README no longer states a location-block count');
});

// **The drift this test was extended to catch.** Compose and nginx are
// generated from `start-ecosystem.sh`'s APPS manifest, and their
// generators say so. `ecosystem.config.js` said so too and was not:
// no generator for it existed, so it was hand-maintained, and it had
// silently fallen six apps behind — vaco-audit, vaco-operator,
// vaco-media, vaco-notify, vex, vex-trading. `pm2 start` would have
// reported every process online while four services the rest of the
// ecosystem calls were simply absent, and every caller of those four
// fails soft on signals by standing rule, so nothing would have said
// so. The generator now exists; this holds its output to the manifest.
test('every backend in the manifest is in the pm2 process list', () => {
  const backends = manifestApps().filter((a) => a.cmd === 'npm start');
  const listed = [...ecosystem.matchAll(/name:\s*["']([^"']+)/g)].map((m) => m[1]);

  const missing = backends.filter((a) => !listed.includes(a.name)).map((a) => a.name);
  const extra = listed.filter((n) => !backends.some((a) => a.name === n));

  assert.deepEqual(missing, [],
    'these manifest backends have no pm2 entry — re-run `node deploy/generate-ecosystem-config.js`');
  assert.deepEqual(extra, [],
    'these pm2 entries are not in start-ecosystem.sh\'s manifest');

  // Ports too: a right name on a wrong port is a process that starts,
  // passes its own health check, and is unreachable at the address
  // nginx proxies to.
  for (const app of backends) {
    const entry = ecosystem.match(new RegExp(`name: "${app.name}"[\\s\\S]{0,200}?PORT: "(\\d+)"`));
    assert.ok(entry, `no PORT found for ${app.name} in ecosystem.config.js`);
    assert.equal(entry[1], app.port, `${app.name}: pm2 says port ${entry[1]}, the manifest says ${app.port}`);
  }
});

// The same question for the committed nginx example, which had drifted
// the same way — four apps with no location block, so a real VPS would
// have 404'd them at the reverse proxy however healthy the backend.
// `vaco-shell` is deliberately absent: it IS the `/` root.
test('every backend in the manifest has an nginx location block', () => {
  const backends = manifestApps().filter((a) => a.cmd === 'npm start');
  for (const file of [{ src: nginx, name: 'nginx-docker.conf' },
    { src: nginxExample, name: 'nginx-vaco.conf.example' }]) {
    const locs = [...file.src.matchAll(/^\s*location\s+(\S+)/gm)].map((m) => m[1]);
    const missing = backends
      .filter((a) => a.name !== 'vaco-shell' && !locs.includes(`/${a.name}/`))
      .map((a) => a.name);
    assert.deepEqual(missing, [],
      `${file.name} has no location block for these manifest backends — re-run the nginx generator`);
    assert.ok(locs.includes('/'), `${file.name} has no \`/\` root block for vaco-shell`);

    const dups = locs.filter((l, i) => locs.indexOf(l) !== i);
    assert.deepEqual(dups, [], `${file.name} emits duplicate location blocks`);
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
