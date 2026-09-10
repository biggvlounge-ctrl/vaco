// SYSTEM_OF_RECORD.md's numbers still match the tools that produce them.
//
// **Why this exists.** That file opens by saying "Every number below
// was produced by running the tool that owns it, not recalled." That
// was true when each number was written and nothing checked that it
// stayed true. By 10 Sep 2026 it claimed 879 tests against a real
// 1498, 33 suites against 39, 28 volumes against 30, and 339 commits
// on a branch that has 31.
//
// Which is exactly the failure the file itself names in §8 — a
// document asserting something nothing verifies. A system of record
// that is a week stale is worse than no system of record, because
// people trust it: the whole point of the file is that you can check a
// claim against it instead of re-deriving.
//
// So: every number in it that a tool owns is re-derived here from that
// tool's real output. Where re-running the tool inside a test would be
// too slow (the full suite takes ~35s), the number is checked against
// the artifact the tool wrote — which is itself checked for freshness
// by that tool's own test.
//
// Deliberately NOT checked: prose. This cannot tell whether §12's
// reasons are still the real reasons. It checks the things that go
// stale silently — counts — and leaves judgement to a reader.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOR = fs.readFileSync(path.join(REPO_ROOT, 'SYSTEM_OF_RECORD.md'), 'utf8');

// Returns stdout AND stderr, always.
//
// Written with execFileSync first, which returns only stdout on
// success — and `generate-docker-compose.js` writes its summary with
// console.error so the YAML can go to stdout. So this test reported
// that the generator's output "had changed shape" when it had simply
// gone to the stream that was being thrown away. spawnSync hands back
// both.
function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  // Several of these tools exit non-zero to report a finding rather
  // than a crash, so the exit code is not consulted — the output is
  // the answer either way, and each caller asserts on what it needs.
  return `${r.stdout || ''}${r.stderr || ''}`;
}

test('the document names the commit and branch it describes', () => {
  const head = run('git', ['rev-parse', '--short', 'HEAD']).trim();
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const commits = run('git', ['rev-list', '--count', 'HEAD']).trim();

  assert.match(SOR, new RegExp(`\`${head}\``),
    `SYSTEM_OF_RECORD.md does not name the current commit ${head}. Update the "Current as of" `
    + 'line — a system of record that describes a commit nobody can identify is a story.');
  assert.match(SOR, new RegExp(`\`${branch}\``));

  // The commit count appears twice: the stamp and §12. Both must be real.
  const claimed = [...SOR.matchAll(/(\d+) commits/g)].map((m) => m[1]);
  assert.ok(claimed.length > 0, 'no commit count in the document at all');
  for (const n of claimed) {
    // An explicitly historical figure is allowed if the sentence says
    // so — §12 keeps the old 339 on purpose, to explain what was lost.
    if (n === commits) continue;
    const context = SOR.slice(Math.max(0, SOR.indexOf(`${n} commits`) - 400),
      SOR.indexOf(`${n} commits`) + 200);
    assert.match(context, /earlier revision|no longer exists|was lost|history it counted/i,
      `"${n} commits" appears with no note explaining why it is not the real count (${commits})`);
  }
});

test('the per-suite table matches what each app really has', () => {
  // **Not compared against a single headline number.** run-all-tests
  // and the completion report count different things — the former
  // includes the repo-level `scripts` suite and nested apps, the
  // latter counts per-app suites — so asserting they are equal would
  // be asserting something false and asserting they are "close" would
  // be asserting nothing.
  //
  // The per-app numbers, though, are the same numbers. Comparing those
  // catches staleness precisely: an app whose suite grew and whose row
  // here did not is exactly the drift this file is for.
  const report = fs.readFileSync(
    path.join(REPO_ROOT, 'dev-docs', 'COMPLETION_BY_APP.md'), 'utf8');

  // The report's table rows end with the app's test count.
  const real = new Map();
  for (const m of report.matchAll(/^\| `([a-z0-9-]+)` \|.*\| (\d+) \|\s*$/gm)) {
    real.set(m[1], Number(m[2]));
  }
  assert.ok(real.size > 25, `parsed only ${real.size} apps from the completion report`);

  const table = SOR.match(/### Per-suite\n\n```\n([\s\S]*?)```/);
  assert.ok(table, '§10 no longer has a per-suite table');
  const listed = new Map(
    [...table[1].matchAll(/([a-z0-9\-/]+)\s+(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  );

  // Four suites the completion report does not list, because they are
  // not apps: the repo-level `scripts` suite, `world-layer` (a pure
  // data module), and the two nested apps. Their counts come from
  // `dev-docs/TEST_COUNTS.json`, which `run-all-tests.mjs` writes on
  // every run.
  //
  // **This is not a footnote.** `scripts` was left unguarded at first,
  // and the very next thing that happened was adding seven tests to it
  // — which made §10's headline wrong by seven while every check here
  // still passed. A row nothing compares is a row that drifts.
  //
  // **And reading a file rather than running the tool is deliberate.**
  // The first version of this ran `run-all-tests.mjs` from inside a
  // test. That is a suite running itself: 345 seconds, a hundred
  // leaked Postgres connections past the server's limit of a hundred,
  // and four unrelated suites failing as a result. It also could not
  // have worked — `node --test` sets NODE_TEST_CONTEXT, so the nested
  // run switched to the v8 reporter and printed nothing parseable,
  // which is the same trap `run-all-tests.mjs` deletes that variable
  // to avoid one level up. The tool writes its numbers down; this
  // reads them.
  // **One run of lag, stated rather than hidden.** `run-all-tests.mjs`
  // writes this file at the END of a run, and this test executes
  // during it — so it validates §10 against the PREVIOUS run's counts.
  // Add a test and the drift surfaces on the next full run, not this
  // one.
  //
  // That is a real limitation and it is still the right trade: the
  // alternative is a suite that runs itself, which was tried and cost
  // 345 seconds and four unrelated suites. A one-run lag on a document
  // check is not a class of bug worth that.
  const counts = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'dev-docs', 'TEST_COUNTS.json'), 'utf8'));
  for (const [name, r] of Object.entries(counts.perSuite)) {
    if (!real.has(name)) real.set(name, r.tests);
  }

  const wrong = [];
  const unchecked = [];
  for (const [app, count] of listed) {
    if (!real.has(app)) { unchecked.push(app); continue; }
    if (real.get(app) !== count) wrong.push(`${app}: §10 says ${count}, really ${real.get(app)}`);
  }

  assert.deepEqual(unchecked, [],
    `no tool reports a count for these rows in §10, so nothing holds them to anything:\n    `
    + `${unchecked.join('\n    ')}`);

  assert.deepEqual(wrong, [],
    `§10's per-suite table is stale:\n    ${wrong.join('\n    ')}\n`
    + 'Re-run `node scripts/run-all-tests.mjs` and update it.');

  // **The headline, checked against the table rather than separately.**
  // Every row above is held to the real per-app count, so their sum and
  // their number ARE the headline — which means one assertion covers
  // "1498/1498 across 39 suites" without re-running a 35-second suite
  // inside a test.
  //
  // This was missing at first: the rows were guarded and the headline
  // was not, so replacing "1498/1498 across 39 suites" with the old
  // "879/879 across 33 suites" passed. Found by trying exactly that.
  const sum = [...listed.values()].reduce((a, n) => a + n, 0);
  const headline = SOR.match(/(\d+)\/(\d+) across (\d+) suites/);
  assert.ok(headline, '§10 no longer states a headline test count');

  assert.equal(Number(headline[1]), sum,
    `§10's headline says ${headline[1]} tests; its own per-suite table sums to ${sum}`);
  assert.equal(Number(headline[2]), sum, 'the headline reports failures — x/y must have x === y');
  assert.equal(Number(headline[3]), listed.size,
    `§10's headline says ${headline[3]} suites; its own table has ${listed.size} rows`);
});

test('the route-guard, shared-runtime and token counts are the real ones', () => {
  const guards = run('node', ['scripts/audit-route-guards.mjs', '--check']);
  const routes = guards.match(/all (\d+) mutating routes/);
  assert.ok(routes, `audit-route-guards produced no count:\n${guards}`);
  assert.match(SOR, new RegExp(`${routes[1]}/${routes[1]} accounted for`),
    `§10 does not say ${routes[1]}/${routes[1]} accounted for, which is what the audit reports`);

  const runtime = run('bash', ['sync-shared-runtime.sh', '--check']);
  const copies = runtime.match(/all (\d+) copies current/);
  assert.ok(copies, `sync-shared-runtime produced no count:\n${runtime}`);
  assert.match(SOR, new RegExp(`${copies[1]} copies current`),
    `§10 does not say ${copies[1]} copies current`);

  const tokens = run('node', ['scripts/generate-service-tokens.mjs', '--check']);
  const callers = tokens.match(/(\d+) callers/);
  assert.ok(callers, `generate-service-tokens produced no count:\n${tokens}`);
  assert.match(SOR, new RegExp(`${callers[1]} callers`),
    `§10 does not say ${callers[1]} callers`);
});

test('the Compose service and volume counts are the real ones', () => {
  const compose = run('node', ['deploy/generate-docker-compose.js']);
  const counted = compose.match(/\((\d+) app services \+ ([^,]+(?:, [^,]+)*), (\d+) persisted volumes\)/);
  assert.ok(counted, `the generator's summary line changed shape:\n${compose}`);

  const [, apps, , volumes] = counted;
  assert.match(SOR, new RegExp(`${apps} apps \\+ nginx`),
    `§10 does not state ${apps} app services`);
  assert.match(SOR, new RegExp(`${volumes} volumes`),
    `§10 does not state ${volumes} volumes`);

  // And the generator must not have changed the committed file — a
  // count that matches a file nobody committed is not a record.
  const diff = run('git', ['diff', '--stat', 'docker-compose.yml']).trim();
  assert.equal(diff, '',
    'the generator rewrote docker-compose.yml, so the committed file is out of date:\n'
    + `${diff}`);
});

test('the settlement-atomicity ceiling is stated and is still zero', () => {
  // The one number in §10 whose *value* matters rather than just its
  // freshness. A ceiling above zero would mean a money movement is
  // split into separate calls somewhere, which is the defect the whole
  // sweep removed.
  const audit = run('node', ['scripts/audit-settlement-atomicity.mjs']);
  const found = audit.match(/(\d+) site\(s\) across (\d+) file\(s\).*ceiling (\d+)/);
  assert.ok(found, `the atomicity audit's summary changed shape:\n${audit}`);

  assert.equal(found[3], '0', 'the atomicity ceiling is no longer 0');
  assert.equal(found[1], '0',
    `${found[1]} split settlement site(s) exist again — §10 and §6 both say there are none`);
  assert.match(SOR, /ceiling 0/,
    '§10 does not mention the atomicity ratchet, which is one of the commands it lists');
});

test('every app in the per-suite table exists, and none is missing', () => {
  // The table in §10 goes stale in the quiet direction: an app added
  // after it was written simply is not there, and nothing looks wrong.
  const table = SOR.match(/### Per-suite\n\n```\n([\s\S]*?)```/);
  assert.ok(table, '§10 no longer has a per-suite table');

  const listed = new Set(
    [...table[1].matchAll(/([a-z0-9\-/]+)\s+\d+/g)].map((m) => m[1]),
  );
  assert.ok(listed.size > 30, `parsed only ${listed.size} rows — the table scan is broken`);

  const src = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = src.match(/APPS=\(([\s\S]*?)\n\)/);
  const apps = block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => l.slice(1, -1).split(':')[0]);

  // Apps with no test/ directory of their own are legitimately absent.
  const withTests = apps.filter((name) => {
    const dir = path.join(REPO_ROOT, name, 'test');
    return fs.existsSync(dir);
  });

  const missing = withTests.filter((name) => !listed.has(name));
  assert.deepEqual(missing, [],
    `these apps have test suites and are not in §10's per-suite table:\n    ${missing.join('\n    ')}`);
});

test('§10 says a skipped test is not a passing one', () => {
  // vacon-c's restore and persistence suites need a real Postgres and
  // skip without one. A reader who runs the suite on a machine with no
  // database gets a green run that exercised 17 fewer checks than the
  // number in this file, and nothing on screen says so.
  const section = SOR.slice(SOR.indexOf('## 10.'), SOR.indexOf('## 11.'));
  assert.match(section, /Postgres/,
    '§10 does not mention that some checks need a Postgres');
  assert.match(section, /skip|skipped/i,
    '§10 does not warn that those checks skip rather than fail without one');
});
