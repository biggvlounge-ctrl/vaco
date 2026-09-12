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

// Per-suite results, written out at the end. See the note by the write.
const perSuite = {};

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

  perSuite[name] = {
    tests: summary.tests, pass: summary.pass, fail: summary.fail, skipped: summary.skipped,
  };

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

// **Write the counts down.**
//
// SYSTEM_OF_RECORD.md quotes a per-suite table and a headline, and
// `scripts/test/system-of-record.test.mjs` holds them to reality. Its
// first version got those numbers by running THIS script inside a
// test, which was wrong twice: it took 284 seconds, and `node --test`
// sets NODE_TEST_CONTEXT, so the nested run switched to the v8
// reporter and produced no parseable lines at all — the same trap this
// file already deletes that variable to avoid, one level up.
//
// So the tool that owns the numbers writes them, and the test reads
// them. The file is regenerated by every full GREEN run, which is the
// same command the documentation tells you to run, so it cannot drift
// without `git status` showing it.
//
// **A red run does not write it, and that took a deadlock to work
// out.** It used to write on every run including failures, and
// `system-of-record.test.mjs` guards against committing a record of a
// red run. Put those together and the guard latches: commit once while
// something is failing, and from then on the committed record says
// `failed: 1`, the guard fails on that, the guard's own failure is the
// only thing failing, and every subsequent run records `failed: 1`
// again. Nothing short of hand-editing a generated file gets out.
//
// That guard already reads `git show HEAD:` rather than the working
// tree, which fixed the *working-tree* half of the problem — a red
// record you have not committed is just an accurate note about a run
// that failed. It did not fix the committed half, because the tool
// would happily write a red record for you to commit. Hit on
// 12 Sep 2026, by committing one.
//
// Writing only on green makes the invariant "this file describes the
// last run in which everything passed", which is both stronger and
// impossible to latch. The cost is that a red run leaves the numbers
// one run stale — which is exactly the lag the per-suite table check
// already documents and tolerates, and the live numbers are printed
// below either way.
const countsPath = path.join(REPO_ROOT, 'dev-docs', 'TEST_COUNTS.json');
if (totals.fail === 0) {
  fs.writeFileSync(countsPath, `${JSON.stringify({
    total: totals.tests,
    passed: totals.pass,
    failed: totals.fail,
    skipped: totals.skipped,
    suites: suites.length,
    perSuite,
  }, null, 2)}\n`);
} else {
  process.stdout.write(
    `run-all-tests: ${totals.fail} test(s) failed, so dev-docs/TEST_COUNTS.json was left `
    + 'at the last green run. Fix the failures and re-run to update it.\n',
  );
}

process.stdout.write(`\nrun-all-tests: ${totals.pass}/${totals.tests} passed`);
if (totals.skipped > 0) process.stdout.write(`, ${totals.skipped} skipped`);
process.stdout.write(` across ${suites.length} suites in ${elapsed}s\n`);

if (failed.length > 0) {
  process.stdout.write(`run-all-tests: ${failed.length} suite(s) FAILED: ${failed.map((f) => f.name).join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('run-all-tests: ok\n');
