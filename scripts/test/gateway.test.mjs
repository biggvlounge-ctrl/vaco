// The single-port gateway routes to the same places nginx does.
//
// **Why this matters more than it looks.** `gateway.js` exists for
// hosts that expose one port — Replit, Render, Fly, most PaaS boxes —
// where nginx is not available. It is therefore the *only* routing
// layer on those deployments, and a route that works locally and 404s
// in production is worse than no gateway at all.
//
// There are already two generated nginx configs with this same table in
// them. The gateway does not repeat it: like every other consumer, it
// reads `start-ecosystem.sh`'s APPS array. These tests hold the three
// to each other, so the day they disagree the suite says so rather than
// a deployment doing it.
//
// Deliberately not covered: the proxying itself. That is `http.request`
// piping to `http.request`, and a test of it is a test of Node. It was
// driven for real instead — the whole ecosystem booted, every app's
// `/api/health` fetched through one port, 33 of 34 answering 200 with
// the 34th being the app that was deliberately down.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

// Importing the module must start nothing. That is true because
// `gateway.js` guards both `listen` and `--print-routes` behind
// `require.main === module` — it did not, and this import is what
// found it: seven green assertions and a failed run, EADDRINUSE
// against the gateway already serving the live ecosystem.
const { targetFor, routes, ROOT_APP } = require(path.join(REPO_ROOT, 'gateway.js'));

function manifestBackends() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = src.match(/APPS=\(([\s\S]*?)\n\)/);
  assert.ok(block, 'start-ecosystem.sh has no APPS manifest');
  return block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => {
      const [name, appPath, command, port] = l.slice(1, -1).split(':');
      return { name, appPath, command, port: Number(port) };
    });
}

test('every app in the manifest is reachable through the gateway', () => {
  const apps = manifestBackends();
  assert.ok(apps.length > 20, `only ${apps.length} apps parsed — the scan is broken`);

  for (const app of apps) {
    const url = app.name === ROOT_APP ? '/api/health' : `/${app.name}/api/health`;
    const target = targetFor(url);
    assert.ok(target.app, `${app.name} routes nowhere`);
    assert.equal(target.app.name, app.name,
      `${url} routes to ${target.app.name}, not ${app.name}`);
    assert.equal(target.app.port, app.port);
  }
});

test('the prefix is stripped, so an app sees its own paths', () => {
  // The whole point of `rewrite ^/void/(.*)$ /$1 break;` in the nginx
  // config. Without it every app would need to know it is mounted under
  // its own name, and none of them do.
  assert.equal(targetFor('/void/api/health').rewritten, '/api/health');
  assert.equal(targetFor('/vacay/api/bookings?x=1').rewritten, '/api/bookings?x=1');

  // A bare prefix is still that app's root, not an empty path.
  assert.equal(targetFor('/void/').rewritten, '/');
});

test('the root is the shell, unprefixed', () => {
  // `vaco-shell` deliberately has no `/vaco-shell/` route: the app store
  // is what a visitor to the bare domain sees, which is the same
  // decision `generate-nginx-conf.js` makes when it gives the shell the
  // `/` location.
  assert.equal(targetFor('/').app.name, ROOT_APP);
  assert.equal(targetFor('/anything-unrouted').app.name, ROOT_APP);
  assert.equal(routes.some((r) => r.prefix === `/${ROOT_APP}/`), false,
    'the shell has a prefixed route as well as the root, so it is reachable two ways');
});

test('a prefix without its trailing slash redirects rather than falling through', () => {
  // `/void` is a real thing a person types. Matched only as a prefix it
  // would fall through to the shell and 404 there — confusingly, since
  // the app exists and is running.
  const target = targetFor('/void');
  assert.equal(target.redirectTo, '/void/');
  assert.equal(target.app, undefined, 'a redirect must not also proxy');
});

test('no app name can swallow another app’s traffic', () => {
  // `vex` and `vex-trading` are the near-miss in this manifest, and
  // matched wrongly `/vex-trading/api/x` would route to `vex` — a 404
  // from a service that is running perfectly well, which is a bad
  // afternoon.
  assert.equal(targetFor('/vex-trading/api/health').app.name, 'vex-trading');
  assert.equal(targetFor('/vex/api/health').app.name, 'vex');

  const names = manifestBackends().map((a) => a.name);
  for (const a of names) {
    for (const b of names) {
      if (a === b || !b.startsWith(a)) continue;
      assert.equal(targetFor(`/${b}/api/x`).app.name, b,
        `/${b}/ is being swallowed by /${a}/`);
    }
  }

  // **What makes the above hold, stated directly.** It is the trailing
  // slash, not the longest-first sort in `gateway.js`: `/vex-trading/`
  // does not start with `/vex/`, so match order cannot matter. Proven
  // by trying to reverse that sort — every assertion above still
  // passed, because they cannot tell the two orders apart.
  //
  // So assert the real invariant: no route prefix contains another. As
  // long as that holds, order is free; the day a prefix stops being
  // `/<name>/` and this fails, the sort starts carrying weight and
  // wants a test that can actually see it.
  const prefixes = routes.map((r) => r.prefix);
  for (const a of prefixes) {
    for (const b of prefixes) {
      if (a !== b && b.startsWith(a)) {
        assert.fail(`prefix ${a} contains ${b} — matching is now order-dependent`);
      }
    }
  }
});

test('the gateway routes to the same places the nginx config does', () => {
  // Three copies of one table — this one, `nginx-docker.conf` and
  // `nginx-vaco.conf.example` — all generated from the same manifest.
  // If they ever disagree, the deployment that uses the odd one out is
  // the one that breaks.
  const nginx = fs.readFileSync(path.join(REPO_ROOT, 'deploy', 'nginx-docker.conf'), 'utf8');
  const nginxPrefixes = new Set(
    [...nginx.matchAll(/^\s*location\s+(\/[a-z0-9-]+\/)\s*\{/gm)].map((m) => m[1]),
  );
  assert.ok(nginxPrefixes.size > 20, 'parsed too few nginx locations — the scan is broken');

  const gatewayPrefixes = new Set(routes.map((r) => r.prefix));

  const onlyNginx = [...nginxPrefixes].filter((p) => !gatewayPrefixes.has(p));
  const onlyGateway = [...gatewayPrefixes].filter((p) => !nginxPrefixes.has(p));

  assert.deepEqual(onlyNginx, [], 'nginx routes these; the gateway does not');
  assert.deepEqual(onlyGateway, [], 'the gateway routes these; nginx does not');
});

// The two tests below load `gateway.js` from a scratch directory with a
// manifest of our choosing beside it. It resolves the manifest from
// `__dirname`, so a copy in a temp dir reads the temp manifest — which
// makes both of these real behaviour rather than a grep of the source
// for a message string I would otherwise have had to keep in sync.
function loadCopyWith(manifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-gateway-'));
  fs.copyFileSync(path.join(REPO_ROOT, 'gateway.js'), path.join(dir, 'gateway.js'));
  if (manifest !== null) fs.writeFileSync(path.join(dir, 'start-ecosystem.sh'), manifest);
  try {
    return { loaded: require(path.join(dir, 'gateway.js')), error: null };
  } catch (err) {
    return { loaded: null, error: err };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the gateway refuses to run without a manifest rather than routing nowhere', () => {
  // A gateway with an empty table answers every request from the shell
  // and looks perfectly healthy while every other app is unreachable.
  // That is the failure this refuses to become.
  const missing = loadCopyWith(null);
  assert.equal(missing.loaded, null, 'loaded with no start-ecosystem.sh at all');
  assert.match(String(missing.error.message), /ENOENT|manifest/);

  const empty = loadCopyWith('APPS=(\n)\n');
  assert.equal(empty.loaded, null, 'loaded with an empty APPS manifest');
  assert.match(String(empty.error.message), /routing to no apps|parsed to nothing/);

  const noShell = loadCopyWith('APPS=(\n  "void:void:npm start:8801"\n)\n');
  assert.equal(noShell.loaded, null, `loaded with no ${ROOT_APP} to answer "/"`);
  assert.match(String(noShell.error.message), new RegExp(ROOT_APP));

  // The control: the same loader with a good manifest must succeed, or
  // the three refusals above prove nothing.
  const good = loadCopyWith(`APPS=(\n  "${ROOT_APP}:.:npm start:8789"\n  "void:void:npm start:8801"\n)\n`);
  assert.equal(good.error, null, 'the control manifest was refused too');
  assert.equal(good.loaded.targetFor('/void/api/health').app.port, 8801);
});

test('requiring the gateway does not bind a port or exit', () => {
  // The gateway is a module and a program. As a module it must be
  // inert — the tests above require it, and on a host already running
  // the gateway an unguarded `listen` turns them into EADDRINUSE.
  // A child that requires it and does nothing else must exit on its
  // own; a live listener would hold the event loop open until timeout.
  const child = spawnSync(process.execPath, [
    '-e', `require(${JSON.stringify(path.join(REPO_ROOT, 'gateway.js'))});`,
    '--', // or node claims the next flag as its own and exits 9
    '--print-routes', // must be ignored: a module may not read the host's argv
  ], { timeout: 10_000, encoding: 'utf8' });

  assert.equal(child.signal, null, 'requiring gateway.js hung — it is listening on import');
  assert.equal(child.status, 0, `exited ${child.status}: ${child.stderr}`);
  assert.equal(child.stdout, '', `printed on import: ${child.stdout}`);
});
