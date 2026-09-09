// Every Compose build context resolves to a Dockerfile that exists.
//
// **The bug this was written for, found by looking rather than by
// reasoning.** `deploy/generate-docker-compose.js` emitted a fixed
// `dockerfile: ../<Dockerfile>` for every service. `dockerfile` is
// resolved relative to `context`, so one `../` is correct for a
// top-level app (`./chopz` → repo root) and wrong for a nested one:
// `./chopz/chopz-shop` resolved to `chopz/deploy/Dockerfile.node` and
// `./cvnvo/yap` to `cvnvo/deploy/Dockerfile.node`. Neither exists.
// Both services would have died at build time with a missing
// Dockerfile.
//
// Nothing caught it for a simple reason worth writing down: **the
// checks that existed validated the file, not the filesystem.**
// `docker compose config` parses YAML and interpolates variables — it
// exits 0 on a build path pointing at nothing, because resolving build
// context is the builder's job, not the parser's. And no build had ever
// been run. A generated path is only as good as the last time somebody
// resolved it.
//
// This test needs no Docker daemon and no network, so it runs anywhere
// the rest of the suite does.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = path.join(ROOT, 'docker-compose.yml');

// A narrow parse of just the build blocks. The file is machine
// generated with fixed indentation, so `context:` and `dockerfile:`
// always appear as an adjacent pair under a named service.
function buildBlocks() {
  const lines = fs.readFileSync(COMPOSE, 'utf8').split('\n');
  const blocks = [];
  let service = null;
  for (let i = 0; i < lines.length; i += 1) {
    const named = lines[i].match(/^ {2}([a-z0-9_.-]+):\s*$/);
    if (named) { service = named[1]; continue; }
    const ctx = lines[i].match(/^ {6}context: (.+?)\s*$/);
    if (!ctx) continue;
    const df = (lines[i + 1] || '').match(/^ {6}dockerfile: (.+?)\s*$/);
    blocks.push({
      service,
      context: ctx[1].replace(/^["']|["']$/g, ''),
      dockerfile: df ? df[1].replace(/^["']|["']$/g, '') : null,
    });
  }
  return blocks;
}

test('the compose file exists and has been generated', () => {
  assert.ok(fs.existsSync(COMPOSE),
    'docker-compose.yml is missing — run `node deploy/generate-docker-compose.js`');
});

test('the parser finds the build blocks it is supposed to check', () => {
  // The guard that keeps every assertion below from passing vacuously.
  // A parser that matched nothing would report a clean run over an
  // empty list, which is exactly the failure mode this file exists to
  // prevent somewhere else.
  const blocks = buildBlocks();
  assert.ok(blocks.length >= 30,
    `parsed only ${blocks.length} build blocks — the parser is broken, not the compose file`);
  assert.ok(blocks.every((b) => b.service), 'a build block was not attributed to a service');
  assert.ok(blocks.every((b) => b.dockerfile),
    'a build block has a context with no dockerfile line following it');
});

test('every build context is a real directory', () => {
  const missing = buildBlocks()
    .filter((b) => !fs.existsSync(path.resolve(ROOT, b.context)))
    .map((b) => `${b.service}: ${b.context}`);
  assert.deepEqual(missing, [], 'these services build from a directory that does not exist');
});

test('every dockerfile resolves, relative to its own context', () => {
  // The regression. `dockerfile` is relative to `context`, so the
  // number of `../` segments has to match the context's depth — a
  // fixed `../` silently breaks exactly the nested apps.
  const missing = buildBlocks()
    .filter((b) => {
      const ctx = path.resolve(ROOT, b.context);
      return !fs.existsSync(path.resolve(ctx, b.dockerfile));
    })
    .map((b) => `${b.service}: ${b.context} + ${b.dockerfile} -> `
      + path.relative(ROOT, path.resolve(ROOT, b.context, b.dockerfile)));

  assert.deepEqual(
    missing, [],
    'these services point at a Dockerfile that does not exist. `docker compose config` '
    + 'passes on this — it parses YAML and never resolves a build path — so it only '
    + 'surfaces during an actual build.',
  );
});

test('the nested apps are covered, since they are the ones that broke', () => {
  // Named explicitly rather than left to the sweep above: `chopz-shop`
  // and `yap` are the only two contexts more than one level deep, and
  // a future refactor that flattens or moves them should fail here
  // loudly rather than quietly stop testing the case.
  const blocks = buildBlocks();
  const nested = blocks.filter((b) => b.context.replace(/^\.\//, '').split('/').length > 1);
  assert.ok(nested.length >= 2,
    `expected at least two nested build contexts, found ${nested.length} — if the layout `
    + 'genuinely changed, update this test; if not, the generator stopped emitting them');

  for (const b of nested) {
    const depth = b.context.replace(/^\.\//, '').split('/').length;
    assert.equal(
      (b.dockerfile.match(/\.\.\//g) || []).length, depth,
      `${b.service}: context is ${depth} levels deep but dockerfile climbs `
      + `${(b.dockerfile.match(/\.\.\//g) || []).length}`,
    );
  }
});

test('every app image can actually start: package.json and the right script', () => {
  // The next failure class after a missing Dockerfile. Both shared
  // images are generic — `COPY . .` then `npm start` (Node) or
  // `npm run build` (Vite) — so an app whose context lacks the script
  // builds fine and dies on boot.
  const problems = [];
  for (const b of buildBlocks()) {
    const ctx = path.resolve(ROOT, b.context);
    const pkgPath = path.join(ctx, 'package.json');
    if (!fs.existsSync(pkgPath)) { problems.push(`${b.service}: no package.json`); continue; }
    const scripts = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {};
    const isVite = /Dockerfile\.vite/.test(b.dockerfile);
    if (isVite && !scripts.build) problems.push(`${b.service}: Vite image runs \`npm run build\``);
    if (!isVite && !scripts.start) problems.push(`${b.service}: Node image runs \`npm start\``);
  }
  assert.deepEqual(problems, [], 'these services would build and then fail to start');
});

test('every build context excludes its secrets and runtime state', () => {
  // `COPY . .` copies everything the .dockerignore does not exclude.
  // The generator already asserts this at generation time; asserting it
  // here too means a .dockerignore deleted after generation is caught
  // without regenerating.
  const missing = buildBlocks()
    .filter((b) => !fs.existsSync(path.resolve(ROOT, b.context, '.dockerignore')))
    .map((b) => b.service);
  assert.deepEqual(missing, [], 'these contexts have no .dockerignore, so `COPY . .` takes everything');
});
