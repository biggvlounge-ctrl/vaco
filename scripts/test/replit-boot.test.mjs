// The single-port boot script hands PORT to the gateway and to nothing else.
//
// **Why this test exists.** `deploy/replit-boot.sh` is the `.replit`
// run command: on Replit it is the only thing that runs. The first
// time it was driven for real it reported "0 up, 5 down" for five apps
// that had started perfectly well thirty seconds earlier under
// `start-ecosystem.sh` directly.
//
// The cause was that `PORT` is set for the gateway, `start-ecosystem.sh`
// hands its environment to every app it starts, and every app reads
// `process.env.PORT`. So all of them tried to bind the gateway's port.
// The logs said EADDRINUSE on 0.0.0.0:8080; the boot output said five
// apps were down, which reads like an out-of-memory problem and is not
// one. Replit always sets PORT, so this would have failed there every
// time, and failed misleadingly.
//
// A regression here is invisible until someone deploys, which is the
// worst time to find it. Hence a test rather than a comment.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// A stand-in repo: the real boot script, and fakes for the two things
// it drives. The script resolves everything from its own location, so
// a copy in a temp tree drives the fakes. This runs the real control
// flow — the PORT handling, the summary parse, the up/down branch —
// without booting 36 servers or binding a port.
function runBootIn({ summary, env }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-replit-boot-'));
  fs.mkdirSync(path.join(dir, 'deploy'));
  // Skips the install branch, which is what a warm container looks like.
  fs.mkdirSync(path.join(dir, 'v3', 'node_modules'), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, 'deploy', 'replit-boot.sh'),
    path.join(dir, 'deploy', 'replit-boot.sh'),
  );

  // Each fake reports the PORT it was handed. That is the whole
  // question: the apps must see none, the gateway must see the one the
  // host set.
  fs.writeFileSync(path.join(dir, 'start-ecosystem.sh'),
    '#!/usr/bin/env bash\n'
    + 'echo "APPS_SAW_PORT=[${PORT:-unset}]"\n'
    + `echo "${summary}"\n`);
  fs.writeFileSync(path.join(dir, 'gateway.js'),
    'process.stdout.write(`GATEWAY_SAW_PORT=[${process.env.PORT ?? "unset"}]\\n`);\n');
  fs.chmodSync(path.join(dir, 'start-ecosystem.sh'), 0o755);

  const run = spawnSync('bash', [path.join(dir, 'deploy', 'replit-boot.sh')], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return run;
}

const HEALTHY = '5 up, 0 down, out of 5 total.';

test('the apps are started with PORT removed from their environment', () => {
  const run = runBootIn({ summary: HEALTHY, env: { PORT: '8080' } });

  assert.match(run.stdout, /APPS_SAW_PORT=\[unset\]/,
    'PORT leaked into start-ecosystem.sh — every app will try to bind the '
    + 'gateway\'s port and the boot will report them all DOWN');

  // Unsetting it is not enough on its own: the gateway still has to get
  // it, or the whole thing listens on the wrong port and the host
  // routes to nothing.
  assert.match(run.stdout, /GATEWAY_SAW_PORT=\[8080\]/,
    'the gateway did not receive the host\'s PORT');
});

test('an unset PORT falls back to 8080 rather than to nothing', () => {
  // Replit sets PORT; a local run of this script does not. The
  // fallback is what makes `bash deploy/replit-boot.sh` work by hand,
  // and `gateway.js` defaults the same way.
  const { PORT, ...noPort } = process.env;
  const run = spawnSync('bash', ['-c', 'true'], { env: noPort });
  assert.equal(run.status, 0);

  const booted = runBootIn({ summary: HEALTHY, env: { PORT: '' } });
  assert.match(booted.stdout, /GATEWAY_SAW_PORT=\[8080\]/,
    'with no PORT set the gateway got something other than the 8080 fallback');
  assert.match(booted.stdout, /APPS_SAW_PORT=\[unset\]/);
});

test('a partly-up ecosystem still starts the gateway, and says why', () => {
  // A boot where some apps are down is the expected case on a small
  // container or with a secret missing. Refusing to start the gateway
  // there would make a reachable-but-incomplete deployment into an
  // unreachable one.
  const run = runBootIn({ summary: '3 up, 2 down, out of 5 total.', env: { PORT: '8080' } });

  assert.match(run.stdout, /2 app\(s\) did not come up/);
  assert.match(run.stdout, /missing secret/, 'the diagnosis no longer names the likely causes');
  assert.match(run.stdout, /GATEWAY_SAW_PORT=\[8080\]/,
    'the gateway did not start, so a partly-up ecosystem is now fully unreachable');
});

test('a boot that never health-checked anything is a failure, not a success', () => {
  // No summary line means start-ecosystem.sh died before it got as far
  // as checking anything. Starting the gateway on top of that produces
  // a service that answers every request with a 502 while looking like
  // it booted.
  const run = runBootIn({ summary: 'bash: something exploded', env: { PORT: '8080' } });

  assert.notEqual(run.status, 0, 'exited 0 having started nothing');
  assert.doesNotMatch(run.stdout, /GATEWAY_SAW_PORT/,
    'the gateway started in front of an ecosystem that never came up');
});

// ---------------------------------------------------------------------
// The root manifest, and why its absence was a real deployment failure.
//
// **Found by a person, not by a tool.** Replit was handed this repo and
// said it could not understand the format of the apps. The cause was
// that there was no `package.json` at the repo root: 36 of them, one
// per app, and none at the top. Every runtime detector -- Replit's,
// Nixpacks', Render's, Heroku's -- classifies a repo as Node by finding
// that file at the root, so all of them saw a directory of shell
// scripts and refused to proceed.
//
// Nothing in the test suite noticed, because every other consumer
// enumerates apps from a manifest or by walking directories, and a
// root file is invisible to both. The ecosystem was correct, tested
// and unimportable at the same time.
//
// The three deliberate absences below are load-bearing and each would
// break something if added, so they are asserted rather than trusted
// to a comment inside a file that cannot carry comments.
// ---------------------------------------------------------------------

const ROOT_PKG_PATH = path.join(REPO_ROOT, 'package.json');

test('the repo root has a package.json, so a host can identify the project', () => {
  assert.ok(
    fs.existsSync(ROOT_PKG_PATH),
    'no package.json at the repo root. Replit, Nixpacks, Render and Heroku all '
    + 'decide "this is a Node project" by finding this file here, and without it '
    + 'they refuse the import without saying why.',
  );

  const pkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
  assert.equal(pkg.private, true, 'the root manifest must be private — this is not a publishable package');
  assert.ok(pkg.engines?.node, 'no engines.node floor, so a host may pick a runtime nothing is tested on');
});

test('the root start script is the same entry point .replit runs', () => {
  // Two hosts, one entry point. A host that runs `npm start` and a host
  // that reads `.replit` must boot the identical thing, or the tested
  // path and the deployed path diverge silently.
  const pkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));
  const replit = fs.readFileSync(path.join(REPO_ROOT, '.replit'), 'utf8');

  assert.match(pkg.scripts?.start || '', /deploy\/replit-boot\.sh/,
    '`npm start` no longer runs the boot script, so a host using it boots something else');
  assert.match(replit, /run\s*=\s*"bash deploy\/replit-boot\.sh"/,
    '.replit and package.json disagree about the entry point');

  // `main` and `.replit`'s entrypoint name the same file.
  const entry = replit.match(/entrypoint\s*=\s*"([^"]+)"/)?.[1];
  assert.equal(pkg.main, entry, `package.json main is ${pkg.main} but .replit entrypoint is ${entry}`);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, pkg.main)), `${pkg.main} does not exist`);
});

test('the root manifest declares no dependencies, no workspaces and no postinstall', () => {
  const pkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, 'utf8'));

  // gateway.js requires only node: builtins. A root dependency would
  // create a root node_modules that install-ecosystem.sh does not manage.
  assert.equal(
    Object.keys(pkg.dependencies || {}).length, 0,
    'the root manifest grew a dependency. gateway.js uses only node: builtins; '
    + 'a root node_modules is not managed by install-ecosystem.sh.',
  );

  // Workspaces would hoist and re-resolve all 36 apps, invalidating 36
  // lockfiles that the Docker build and CI both rely on being exact.
  assert.ok(!pkg.workspaces,
    'the root manifest declares workspaces. That re-resolves all 36 apps and '
    + 'invalidates the per-app lockfiles the Docker path and CI depend on.');

  // Installing 36 apps must be asked for, never a side effect.
  assert.ok(!pkg.scripts?.postinstall,
    'a postinstall here makes `npm install` silently install 36 apps');
});
