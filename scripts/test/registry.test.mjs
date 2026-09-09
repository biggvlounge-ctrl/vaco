// `vaco-shell/lib/registry.js` against `docker-compose.yml`.
//
// **Why this exists.** The root README calls the registry "the
// authoritative list of apps, their real ports, and their groupings --
// ports there are verified, not guessed." That claim was false for a
// while: `vaco-audit`, `vaco-operator` and `vaco-media` were built,
// containerised and deployed while the registry never heard of them.
//
// Nothing failed. The shell rendered its tiles, `--check` passed, the
// compose file generated cleanly, and the only symptom was that a
// document naming itself authoritative had three holes in it. Same
// failure class as the `.js`-only lib scan and the depth-1 backup
// walk: a source of truth that omits silently, and reports success
// while doing it.
//
// So the two lists are held against each other here. Both directions
// matter and they fail for different reasons:
//
//   compose -> registry   a deployed service nobody can find
//   registry -> compose   a tile pointing at a port nothing serves
//
// Exemptions are named individually, with a reason, and are asserted
// to still be real. A blanket "ignore anything not matching" would
// reintroduce exactly the too-loose match this file is about.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const { APPS } = await import(
  path.join(REPO_ROOT, 'vaco-shell', 'lib', 'registry.js')
);

const compose = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf8');

// A service that is *built* from a directory, which is what "an app in
// this repo" means. `nginx` uses an image and correctly does not match.
// Anchored on the two-space indent compose uses for service keys so a
// nested key of the same name cannot pass for a service.
function builtServices(yaml) {
  return [...yaml.matchAll(/^ {2}([a-z0-9-]+):\n {4}build:/gm)].map((m) => m[1]);
}

// -- Exemptions, each named and each justified ---------------------------

// The shell does not list itself. It is the thing doing the listing.
const SHELL = 'vaco-shell';

// Served through its parent shell rather than launched directly. A
// direct row for `vex` was in the registry once and had to be removed
// (#96) precisely because it bypassed `vex-trading`.
const SERVED_THROUGH_PARENT = { vex: 'vex-trading' };

// Registry rows with no container, for two different reasons.
const BRAND_ROWS = ['cvltvre', 'vado'];      // both point at voken:8794
const DEV_ONLY = ['v3-shield'];              // venvs-mock-backend, not deployed

test('every containerised app appears in the shell registry', () => {
  const ids = new Set(APPS.map((a) => a.id));
  const exempt = new Set([SHELL, ...Object.keys(SERVED_THROUGH_PARENT)]);

  const missing = builtServices(compose).filter((s) => !ids.has(s) && !exempt.has(s));

  assert.deepEqual(
    missing, [],
    `docker-compose builds these but vaco-shell/lib/registry.js does not list them: ${missing.join(', ')}`
      + ' -- a deployed service nobody can find. Add a row, or add a named exemption here.',
  );
});

test('every registry row points at something that exists', () => {
  const built = new Set(builtServices(compose));
  const exempt = new Set([...BRAND_ROWS, ...DEV_ONLY]);

  const dangling = APPS.map((a) => a.id).filter((id) => !built.has(id) && !exempt.has(id));

  assert.deepEqual(
    dangling, [],
    `the registry lists these but docker-compose builds nothing for them: ${dangling.join(', ')}`
      + ' -- a launcher tile pointing at a port nothing serves.',
  );
});

// The exemptions above are the whole risk in this file: a stale one
// silently re-opens the hole it was written to keep narrow. So each is
// asserted to still mean what it says.
test('the named exemptions are still true', () => {
  const ids = new Set(APPS.map((a) => a.id));
  const built = new Set(builtServices(compose));

  assert.ok(built.has(SHELL), 'vaco-shell must still be a built service');
  assert.ok(!ids.has(SHELL), 'vaco-shell must not list itself');

  for (const [child, parent] of Object.entries(SERVED_THROUGH_PARENT)) {
    assert.ok(built.has(child), `${child} is exempted as a sub-app but is no longer built`);
    assert.ok(
      ids.has(parent),
      `${child} is exempted because ${parent} serves it, but ${parent} is not in the registry`
      + ' -- that exemption now hides the sub-app entirely',
    );
  }

  for (const id of BRAND_ROWS) {
    const row = APPS.find((a) => a.id === id);
    assert.ok(row, `${id} is exempted as a brand row but is no longer in the registry`);
    assert.ok(
      row.url.includes('8794'),
      `${id} is exempted because it points at voken:8794, but its url is ${row.url}`,
    );
  }

  for (const id of DEV_ONLY) {
    assert.ok(APPS.some((a) => a.id === id), `${id} is exempted but no longer in the registry`);
  }
});

// Ports are the half of the registry claim that is easiest to let rot,
// because a wrong one still renders a perfectly good tile.
test('registry ports match the PORT each container is given', () => {
  const composePorts = new Map();

  // Split into service blocks on the two-space keys, then read the
  // runtime `PORT:` out of each. Reading the whole file at once would
  // let one service's port answer for another's.
  const blocks = compose.split(/^ {2}(?=[a-z0-9-]+:$)/m);
  for (const block of blocks) {
    const name = block.match(/^([a-z0-9-]+):$/m)?.[1];
    if (!name) continue;
    const port = block.match(/^ {4}environment:\n(?: {6}.*\n)*? {6}PORT: (\d+)/m)?.[1];
    if (port) composePorts.set(name, port);
  }

  assert.ok(composePorts.size > 20, 'the compose port scan found almost nothing -- it is broken');

  const wrong = [];
  for (const app of APPS) {
    const expected = composePorts.get(app.id);
    if (!expected) continue;                       // no container, covered above
    if (!app.url.includes(`:${expected}`)) {
      wrong.push(`${app.id}: registry says ${app.url}, compose runs it on ${expected}`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join('; '));
});
