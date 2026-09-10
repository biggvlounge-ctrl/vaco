// Every place that names a Node version must name the same one.
//
// **The gap this closes.** Three different Node versions were in play
// at once, and nothing compared them:
//
//   dev machine        Node 22
//   CI                 Node 22
//   deploy/Dockerfile  node:20-alpine
//   package.json       "engines": { "node": ">=18" }
//
// So the whole suite passed on 22, in CI, on a runtime production does
// not use — and the declared floor was low enough to permit all three,
// which meant it validated nothing. Nothing was broken by it yet; a
// v22-only feature would have been, and the failure would have
// appeared only in the container.
//
// That is the same shape as the two Vite frontends that had not built
// for weeks: correct in development, wrong where it ships, and no
// check standing between the two. This is that check.
//
// It deliberately compares the **major** version only. Patch drift
// between a CI runner and a base image is normal and not worth
// failing over; a major is a different runtime.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const DOCKERFILES = ['deploy/Dockerfile.node', 'deploy/Dockerfile.vite'];
const CI = '.github/workflows/ci.yml';

// `FROM node:22-alpine` / `FROM node:22-alpine AS build`
function dockerMajors(rel) {
  const src = read(rel);
  const found = [...src.matchAll(/^FROM\s+node:(\d+)/gm)].map((m) => Number(m[1]));
  assert.ok(found.length > 0, `${rel} has no FROM node: line — this scan is broken`);
  return found;
}

function ciMajors() {
  const src = read(CI);
  const found = [...src.matchAll(/node-version:\s*'?(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(found.length > 0, `${CI} declares no node-version — this scan is broken`);
  return found;
}

// Every app's own floor. node_modules is excluded: those are other
// people's declarations and none of our business.
function engineFloors() {
  const out = [];
  const walk = (dir, depth = 0) => {
    if (depth > 2) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.name === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
        const spec = pkg.engines?.node;
        if (spec) out.push({ file: path.relative(REPO_ROOT, full), spec });
      }
    }
  };
  walk(REPO_ROOT);
  return out;
}

// **A lockfile carries its own copy of `engines`, and nobody was
// checking it.** The scan above reads `package.json` only, so 33
// lockfiles sat on `">=18"` while their own `package.json` had moved to
// `">=22"` — invisible here, and only surfaced when a real
// `./install-ecosystem.sh` run rewrote every one of them. `npm ci`
// reads the lockfile's copy, so the two disagreeing is exactly the kind
// of split that behaves differently in CI than on a workstation.
function lockfileEngines() {
  const out = [];
  const walk = (dir, depth = 0) => {
    if (depth > 2) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (e.name !== 'package-lock.json') continue;
      const lock = JSON.parse(fs.readFileSync(full, 'utf8'));
      const spec = lock.packages?.['']?.engines?.node;
      if (spec) out.push({ file: path.relative(REPO_ROOT, full), spec });
    }
  };
  walk(REPO_ROOT);
  return out;
}

test('every lockfile agrees with its own package.json about the Node floor', () => {
  const locks = lockfileEngines();
  assert.ok(locks.length > 20,
    `found only ${locks.length} lockfile engines declarations — the scan is broken`);

  const mismatched = [];
  for (const lock of locks) {
    const pkgPath = path.join(REPO_ROOT, path.dirname(lock.file), 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const spec = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).engines?.node;
    if (spec && spec !== lock.spec) {
      mismatched.push(`${lock.file}: lock says ${lock.spec}, package.json says ${spec}`);
    }
  }
  assert.deepEqual(mismatched, [],
    'these lockfiles disagree with their package.json about the Node floor. '
    + '`npm ci` reads the lockfile, so this is a real split between CI and a local install. '
    + 'Re-run ./install-ecosystem.sh and commit the result.');
});

test('every Dockerfile builds on the same Node major', () => {
  const all = DOCKERFILES.flatMap(dockerMajors);
  assert.equal(new Set(all).size, 1, `Dockerfiles disagree: ${all.join(', ')}`);
});

test('CI runs the same Node major the Dockerfiles build on', () => {
  const docker = dockerMajors(DOCKERFILES[0])[0];
  const ci = ciMajors();
  for (const v of ci) {
    assert.equal(
      v, docker,
      `CI runs Node ${v} but ${DOCKERFILES[0]} builds on Node ${docker}. `
      + 'The suite would pass on a runtime production does not use.',
    );
  }
});

test('the declared engines floor is the version actually shipped', () => {
  // A floor below the shipped major permits a runtime nobody tests on.
  // ">=18" while shipping 22 and testing on 22 is what was there, and
  // it validated nothing.
  const docker = dockerMajors(DOCKERFILES[0])[0];
  const floors = engineFloors();
  assert.ok(floors.length > 20, `found only ${floors.length} engines declarations — the scan is broken`);

  const wrong = floors.filter(({ spec }) => {
    const m = spec.match(/(\d+)/);
    return !m || Number(m[1]) !== docker;
  });
  assert.deepEqual(
    wrong.map((w) => `${w.file}: "${w.spec}"`), [],
    `these declare a Node floor other than ${docker}, the version the Dockerfiles build on`,
  );
});

test('the Node running this suite is the one that ships', () => {
  // The last leg of the triangle. If a developer is on a different
  // major than the image, they are testing something else.
  const docker = dockerMajors(DOCKERFILES[0])[0];
  const here = Number(process.versions.node.split('.')[0]);
  assert.equal(
    here, docker,
    `this suite is running on Node ${here} but the Dockerfiles build on Node ${docker}. `
    + 'Every result here describes a runtime production does not use.',
  );
});
