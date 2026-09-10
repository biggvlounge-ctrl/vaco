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

// How far behind HEAD the "Current as of" stamp may fall.
//
// **It can never be zero.** A file cannot contain the hash of the
// commit that adds it — stamping HEAD, committing, and re-checking
// gives a different hash every time. The first version of this test
// required an exact match and failed on its own commit, which is a
// neat demonstration of the thing it is testing for.
//
// So the property is: the stamp names a real commit on this branch,
// and the document has not drifted far from it. Three is enough room
// for the commit that updates the document plus a couple of follow-ups
// before somebody should re-stamp it.
const STAMP_TOLERANCE = 3;

// A release-archive extract has no `.git` — `scripts/package-release.mjs`
// builds it with `git archive`, which writes tracked files and nothing
// else, then runs this suite inside it. Every git-dependent check below
// therefore has nothing to ask, and the first version of this file
// FAILED there rather than skipping: "fatal: not a git repository".
//
// A skip is not a pass, so each one says exactly what it could not
// check. The count checks against the tools are unaffected and still
// run — which is the half that matters most inside an archive, since
// that is the artifact somebody deploys.
const HAS_GIT = fs.existsSync(path.join(REPO_ROOT, '.git'));
const NO_GIT = 'no .git — this is a release-archive extract, where the commit stamp cannot be '
  + 'checked against a history that is not present';

test('the document names a real, recent commit on this branch', (t) => {
  if (!HAS_GIT) return t.skip(NO_GIT);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  assert.match(SOR, new RegExp(`\`${branch}\``),
    `SYSTEM_OF_RECORD.md does not name the current branch ${branch}`);

  const stamp = SOR.match(/Current as of commit \`([0-9a-f]{7,40})\`/);
  assert.ok(stamp, 'SYSTEM_OF_RECORD.md has no "Current as of commit `...`" stamp');

  // A real commit, and one on this history — not a hash from a branch
  // nobody has, or from the history that was lost.
  const merge = run('git', ['merge-base', '--is-ancestor', stamp[1], 'HEAD']);
  const known = run('git', ['cat-file', '-t', stamp[1]]).trim();
  assert.equal(known, 'commit',
    `SYSTEM_OF_RECORD.md is stamped \`${stamp[1]}\`, which is not a commit in this repository`);
  assert.equal(merge.trim(), '',
    `SYSTEM_OF_RECORD.md is stamped \`${stamp[1]}\`, which is not an ancestor of HEAD`);

  const behind = Number(run('git', ['rev-list', '--count', `${stamp[1]}..HEAD`]).trim());
  assert.ok(behind <= STAMP_TOLERANCE,
    `SYSTEM_OF_RECORD.md is stamped \`${stamp[1]}\`, ${behind} commits behind HEAD `
    + `(tolerance ${STAMP_TOLERANCE}). Re-run the §10 commands and update the stamp — a system `
    + 'of record describing a state nobody can reach is a story.');
});

test('every stated commit count matches the commit the document is stamped at', (t) => {
  if (!HAS_GIT) return t.skip(NO_GIT);
  // **Counted at the stamp, not at HEAD**, and that is the precise
  // meaning rather than a loophole. "Current as of commit `X`, N
  // commits" is a claim about the state at X. Requiring N to equal the
  // count at HEAD is unsatisfiable for the same reason requiring the
  // stamp to equal HEAD is: committing the document increments the
  // count, so the number is stale the instant it is written. Counting
  // at X is exact, checkable, and true.
  //
  // How far X may lag HEAD is the stamp tolerance, asserted separately
  // above — so the two together say "the document describes a real
  // recent commit, and its numbers are that commit's numbers."
  //
  // **No proximity escape hatch.** An earlier version excused a wrong
  // count if explanatory prose sat within 400 characters, and the
  // stamp sits directly above its own explanation — so putting the old
  // 339 back into the stamp passed. This document writes the counts
  // from the lost history as prose ("an earlier revision of this line
  // said 332"), never as "332 commits", so every "N commits" is a live
  // claim and every one must be right.
  const stamp = SOR.match(/Current as of commit \`([0-9a-f]{7,40})\`/);
  assert.ok(stamp, 'no "Current as of commit `...`" stamp to count from');
  const atStamp = run('git', ['rev-list', '--count', stamp[1]]).trim();
  assert.match(atStamp, /^\d+$/, `could not count commits at ${stamp[1]}: ${atStamp}`);

  const claimed = [...SOR.matchAll(/(\d+) commits/g)].map((m) => m[1]);
  assert.ok(claimed.length > 0, 'no commit count in the document at all');

  const wrong = [...new Set(claimed.filter((n) => n !== atStamp))];
  assert.deepEqual(wrong, [],
    `SYSTEM_OF_RECORD.md states ${wrong.join(', ')} commits; \`${stamp[1]}\`, the commit it is `
    + `stamped at, has ${atStamp}. If one of those is a deliberate historical figure, write it `
    + 'as prose rather than as "N commits" — every occurrence of that form is a live claim.');
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
  // count that matches a file nobody committed is not a record. Only
  // askable where there is a git history to compare against.
  if (HAS_GIT) {
    const diff = run('git', ['diff', '--stat', 'docker-compose.yml']).trim();
    assert.equal(diff, '',
      'the generator rewrote docker-compose.yml, so the committed file is out of date:\n'
      + `${diff}`);
  }
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

test('a claim that the branch is pushed is a claim that can be checked', (t) => {
  // SYSTEM_OF_RECORD.md said `git push` returned 403 for most of this
  // work's life, and that was true and important. It stopped being
  // true on 10 Sep 2026, and a system of record that keeps warning
  // about a resolved problem is wrong in the same way as one that
  // hides an unresolved one — a reader acts on it either way.
  //
  // **Deliberately not "local and remote are identical."** Being a
  // commit or two ahead of origin is the normal state between a commit
  // and its push, and a check that failed on it would fail on the very
  // commit that adds this test. The durable claim is narrower and
  // stable: the branch exists on the remote at all. Never having
  // pushed is the condition that cost this repository its history.
  if (!HAS_GIT) return t.skip(NO_GIT);

  const claimsPushed = /The branch is pushed|Durability: resolved/.test(SOR);
  const remote = run('git', ['rev-parse', '--verify', '--quiet', '@{upstream}']).trim();
  const hasUpstream = /^[0-9a-f]{40}$/.test(remote);

  if (claimsPushed) {
    assert.ok(hasUpstream,
      'SYSTEM_OF_RECORD.md says the branch is pushed, but this branch has no upstream on '
      + 'any remote. Either push it or put the warning back — an unpushable branch '
      + 'described as safe is how the history was lost the first time.');
  } else {
    assert.ok(!hasUpstream,
      'the branch IS pushed, and SYSTEM_OF_RECORD.md still carries the warning that it is '
      + 'not. Update §12 — a resolved problem left in a system of record misleads exactly '
      + 'as much as an unresolved one that is hidden.');
  }
});
