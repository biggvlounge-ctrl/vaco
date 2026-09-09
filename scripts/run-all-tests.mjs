#!/usr/bin/env node
// VACO — run every test suite in the ecosystem, in one command.
//
// **Why this exists.** 391 tests were written across 17 apps and
// nothing ran them together. Every regression was caught by whoever
// happened to `cd` into the right directory. A suite nobody runs is a
// suite that is already failing and nobody knows.
//
// **Discovered, not listed.** Suites are found by walking for
// `test/*.test.{js,mjs}`, which is why `chopz/chopz-shop` (nested one
// level down) and `scripts` (not an app at all) are both picked up
// without appearing in any manifest. A hardcoded list is a list that
// silently stops covering the newest thing, which is exactly the
// failure this script exists to prevent.
//
// **Each suite runs in its own process** via `node --test`, from its
// own directory, because the apps have independent `node_modules` and
// several are CommonJS while others are ESM. Running them in one
// process would couple them in ways the architecture deliberately
// avoids.
//
// Exit code is the point: non-zero if any suite fails, so CI and a
// pre-push hook can both just call this.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// vex-business is a Python monorepo with its own toolchain (uv +
// pytest + alembic). It is not skipped because it does not matter —
// it holds the live-trading interlock — but because `node --test`
// cannot run it. It needs its own CI job.
const NOT_NODE = new Set(['vex-business']);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.venv']);

function findSuites(dir, depth = 0) {
  if (depth > 3) return [];
  const found = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const testDir = path.join(dir, 'test');
  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir)
      .filter((f) => /\.test\.(js|mjs)$/.test(f))
      .sort()
      .map((f) => path.join('test', f));
    if (files.length > 0) found.push({ dir, files });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    if (depth === 0 && NOT_NODE.has(entry.name)) continue;
    if (entry.name === 'test') continue; // already handled above
    found.push(...findSuites(path.join(dir, entry.name), depth + 1));
  }
  return found;
}

// `node --test` prints a TAP summary. Parsing it gives real per-suite
// counts rather than just "it exited 0", which is what makes the
// headline number in COMPLETION_AUDIT.md verifiable rather than
// recalled.
function parseSummary(output) {
  const read = (label) => {
    const match = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
    return match ? Number(match[1]) : 0;
  };
  return { tests: read('tests'), pass: read('pass'), fail: read('fail'), skipped: read('skipped') };
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`Usage: node scripts/run-all-tests.mjs [--verbose]

Discovers and runs every test/*.test.{js,mjs} suite in the repo.
Exits non-zero if any suite fails.

  --verbose   Print full output for every suite, not just failures.
`);
  process.exit(0);
}
const verbose = args.includes('--verbose');

const suites = findSuites(REPO_ROOT).sort((a, b) => a.dir.localeCompare(b.dir));
if (suites.length === 0) {
  process.stderr.write('run-all-tests: found no suites. That is almost certainly wrong.\n');
  process.exit(1);
}

process.stdout.write(`run-all-tests: ${suites.length} suites\n\n`);

const totals = { tests: 0, pass: 0, fail: 0, skipped: 0 };
const failed = [];
const started = Date.now();

const CHILD_ENV = { ...process.env };
delete CHILD_ENV.NODE_TEST_CONTEXT;

for (const suite of suites) {
  const name = path.relative(REPO_ROOT, suite.dir) || '.';
  // Explicit file paths, not `--test test/`. Node resolves a directory
  // argument as a module rather than scanning it, so the directory form
  // fails with MODULE_NOT_FOUND on every suite — which is exactly what
  // the apps' own `node --test test/*.test.js` avoids by letting the
  // shell expand the glob first.
  const result = spawnSync(process.execPath, ['--test', ...suite.files], {
    cwd: suite.dir,
    encoding: 'utf8',
    // `node --test` sets NODE_TEST_CONTEXT, and a child that inherits
    // it switches to the machine-readable v8 reporter — no `# pass N`
    // line for parseSummary to find, so every suite would count zero.
    // This script is normally run directly, but it is one `node --test`
    // wrapper away from silently reporting an all-zero green run.
    env: CHILD_ENV,
    // A suite that hangs must not hang CI forever. Two minutes is far
    // beyond anything here — the whole ecosystem runs in seconds.
    timeout: 120000,
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const summary = parseSummary(output);
  totals.tests += summary.tests;
  totals.pass += summary.pass;
  totals.fail += summary.fail;
  totals.skipped += summary.skipped;

  // Trust the exit code over the parsed summary. A suite that crashes
  // before printing TAP reports zeros, and treating that as "no tests
  // failed" is how a broken suite becomes invisible.
  const ok = result.status === 0;
  if (!ok) failed.push({ name, output, status: result.status, signal: result.signal });

  const mark = ok ? 'ok  ' : 'FAIL';
  const count = summary.tests > 0
    ? `${String(summary.pass).padStart(3)}/${String(summary.tests).padEnd(3)}`
    : '(no TAP summary)';
  process.stdout.write(`  ${mark} ${name.padEnd(24)} ${count}  ${suite.files.length} file(s)\n`);

  if (verbose) process.stdout.write(`${output}\n`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (failed.length > 0) {
  process.stdout.write('\n');
  for (const failure of failed) {
    process.stdout.write(`${'='.repeat(70)}\n${failure.name} failed`);
    process.stdout.write(failure.signal ? ` (killed by ${failure.signal})\n` : ` (exit ${failure.status})\n`);
    process.stdout.write(`${'='.repeat(70)}\n${failure.output}\n`);
  }
}

process.stdout.write(`\nrun-all-tests: ${totals.pass}/${totals.tests} passed`);
if (totals.skipped > 0) process.stdout.write(`, ${totals.skipped} skipped`);
process.stdout.write(` across ${suites.length} suites in ${elapsed}s\n`);

if (failed.length > 0) {
  process.stdout.write(`run-all-tests: ${failed.length} suite(s) FAILED: ${failed.map((f) => f.name).join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('run-all-tests: ok\n');
