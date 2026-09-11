// Seed coverage cannot quietly rot.
//
// **Why this exists.** The ecosystem booted with 36 working apps and
// almost nothing in them: 14 of the 30 apps that keep a store had zero
// records after a clean boot, and one of them -- VACON-C -- shipped a
// 72-object world seeder that no boot path called. Everything was
// tested and correct and the launcher opened onto a series of blank
// pages, which reads as broken rather than as new.
//
// The failure was invisible because nothing connected "this app
// exists" to "somebody decided whether it needs demo content". A new
// app joins `start-ecosystem.sh` and silently defaults to empty.
//
// So: every app in the manifest must be accounted for here -- either
// `scripts/seed-demo.mjs` seeds it, its own `server.js` seeds itself at
// boot, or it is named below with the reason it holds none. Adding an
// app without making that decision fails this test.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEED = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'seed-demo.mjs'), 'utf8');

// The app list, read from the launcher rather than restated -- the same
// reuse install-ecosystem.sh does.
function manifestApps() {
  const sh = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = sh.match(/^APPS=\(([\s\S]*?)^\)/m);
  assert.ok(block, 'could not find the APPS array in start-ecosystem.sh');
  return [...block[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1].split(':'))
    .map(([name, dir]) => ({ name, dir }));
}

// Apps that legitimately hold no demo content, each with the reason.
// A name here is a decision, not a backlog entry.
const NO_CONTENT_BY_DESIGN = {
  'vaco-shell': 'the launcher itself — its content is the app registry',
  shield: 'the session service — the demo people ARE its content, seeded by seedPeople()',
  v3: 'the ledger — balances come from the demo people and their transactions',
  'vaco-analytics': 'derives every figure from the other apps; seeding it would be writing fiction into a metrics store',
  'vaco-audit': 'an append-only record of operator decisions; entries must come from real decisions',
  'vaco-operator': 'operator credentials — a demo must not ship a standing operator credential',
  'vaco-media': 'a control plane; grants are created by the apps that need playback',
  'vaco-notify': 'notifications are produced by other apps acting, not seeded directly',
  vacon: 'the network layer — no user-facing content of its own',
  'v4-proxy': 'refuses to start without ANTHROPIC_API_KEY; nothing to seed',
  'v4-search': 'searches the other apps; it has no store of its own to fill',
  vex: 'brokerAccounts and tradeOrders stay empty while placeTradeOrder is held pending broker-dealer compliance review; its landing correctly shows the compliance gates instead',
  'vex-trading': 'placeTradeOrder is held pending broker-dealer compliance review — deliberately no write path',
  vago: 'wagering and prediction markets stay closed pending compliance review; not seeded to make a demo look fuller',
  yap: 'accepts reports only from an operator-verified reporter; seeding one would mean auto-approving an identity claim, which is the guard Yap exists to enforce',
  vdp: 'a Vite frontend that seeds itself in the browser (src/lib/seedDemoData.js)',
  venvs: 'a Vite frontend using browser storage',
  vaca: 'seeded as far as a machine may take it — claims are submitted, approval needs a human operator',
};

test('every app in the manifest is either seeded or declared contentless', () => {
  const apps = manifestApps();
  assert.ok(apps.length > 30, `found only ${apps.length} apps — the manifest scan is broken`);

  const unaccounted = [];
  for (const { name, dir } of apps) {
    if (NO_CONTENT_BY_DESIGN[name]) continue;

    // Seeded centrally: the app is named in seed-demo.mjs's PORTS map,
    // which is the list of apps it can talk to at all.
    const seededCentrally = new RegExp(`['"]?${name.replace(/[-/]/g, '[-/]')}['"]?\\s*:\\s*\\d{4}`).test(SEED);

    // Or it seeds itself at boot.
    const selfSeeder = path.join(REPO_ROOT, dir, 'lib', 'seedDemoData.js');
    const seedsItself = fs.existsSync(selfSeeder)
      && /seedDemoData/.test(fs.readFileSync(path.join(REPO_ROOT, dir, 'server.js'), 'utf8'));

    if (!seededCentrally && !seedsItself) unaccounted.push(name);
  }

  assert.deepEqual(
    unaccounted, [],
    'these apps have no demo content and no stated reason for having none:\n    '
    + `${unaccounted.join('\n    ')}\n\n`
    + 'Either seed the app in scripts/seed-demo.mjs, give it a lib/seedDemoData.js\n'
    + 'wired into its server.js, or add it to NO_CONTENT_BY_DESIGN in this file\n'
    + 'with the reason. An app that opens onto a blank page reads as broken.',
  );
});

test('the contentless list names only apps that actually exist', () => {
  // A stale exemption is worse than none: it silently excuses an app
  // that was renamed, and hides its successor.
  const names = new Set(manifestApps().map((a) => a.name));
  const ghosts = Object.keys(NO_CONTENT_BY_DESIGN).filter((n) => !names.has(n));
  assert.deepEqual(ghosts, [],
    `these are excused from seeding but are not in the manifest: ${ghosts.join(', ')}`);
});

test('seed-demo declares a real port for every app it names', () => {
  // `http://localhost:undefined/...` is what a missing port produces.
  // fetch rejects it, seed() catches it and reports a failed step, and
  // in a 30-line run that is easy to miss. This was a real failure.
  // The PORTS object packs several entries per line, so this matches
  // entries rather than lines. Scanning line-anchored found zero and
  // the vacuity guard below caught it.
  const portsBlock = SEED.match(/const PORTS = \{([\s\S]*?)\n\};/);
  assert.ok(portsBlock, 'could not find the PORTS map in seed-demo.mjs');
  const ports = [...portsBlock[1].matchAll(/(?:'([^']+)'|([A-Za-z][\w-]*)):\s*(\d+)/g)]
    .map((m) => ({ app: m[1] || m[2], port: Number(m[3]) }))
    .filter((p) => p.port >= 3000 && p.port <= 65535);

  assert.ok(ports.length >= 15, `found only ${ports.length} ports in seed-demo.mjs — the scan is broken`);
  for (const { app, port } of ports) {
    assert.ok(Number.isInteger(port) && port > 0, `${app} has a bad port: ${port}`);
  }

  // Every port in the seeder must match the launcher's own table.
  const sh = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = sh.match(/^APPS=\(([\s\S]*?)^\)/m)[1];
  const real = new Map(
    [...block.matchAll(/"([^"]+)"/g)]
      .map((m) => m[1].split(':'))
      .map(([name, , , port]) => [name, Number(port)]),
  );

  const wrong = ports
    .filter(({ app }) => real.has(app))
    .filter(({ app, port }) => real.get(app) !== port)
    .map(({ app, port }) => `${app}: seed-demo says ${port}, the manifest says ${real.get(app)}`);

  assert.deepEqual(wrong, [],
    `seed-demo.mjs and start-ecosystem.sh disagree about ports:\n    ${wrong.join('\n    ')}`);
});
