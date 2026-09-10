// Does every `!` carve-out in .gitignore still name a real path — and
// are the files it rescues actually in the repository?
//
// **Why this exists.** `.gitignore` line 2 is `**/data/`, which exists
// to keep runtime stores (`<app>/data/store.json`) out of version
// control. It matches any directory named `data` at any depth, so two
// real source directories in the CALL app had to be carved back out by
// name:
//
//     !call/packages/data/          a Python package literally named data/
//     !call/data/sample/            the seed-data directory
//
// Then CALL was renamed to Vex Business. The directories moved. The
// negations did not, and `**/data/` quietly reclaimed six real source
// files — `orm.py`, `database.py`, `__init__.py`, `py.typed`,
// `pyproject.toml` and `data/sample/README.md`.
//
// **Nothing failed, and that is the point.** `git status` was clean,
// because ignored files are not untracked files — they do not appear.
// The files were absent from every release archive, absent from every
// bundle, and would have gone with the container. They were found only
// by listing ignored paths by hand while making a backup.
//
// A negation pattern that names a path is a claim that the path exists
// and needs rescuing. Both halves are checkable, so they are checked:
// the path is on disk, and the files under it are really tracked. A
// carve-out that exists but whose files were never added rescues
// nothing.
//
// Deliberately narrow: it says nothing about whether the ignore rules
// are *right*, only that no carve-out is aimed at a path that moved.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Only concrete paths. `!**/.env.example` and friends are globs whose
// job is to match wherever such a file turns up, and "does this path
// exist" is not a meaningful question about them.
function concreteNegations() {
  return fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!') && !l.includes('*') && !l.includes('?'))
    .map((l) => l.slice(1).replace(/\/$/, ''))
    // A bare filename with no slash is a name-anywhere rule, not a path.
    .filter((p) => p.includes('/'));
}

test('every path-shaped .gitignore carve-out names something that exists', () => {
  const negations = concreteNegations();
  assert.ok(negations.length > 0,
    '.gitignore has no path-shaped carve-outs — if the `**/data/` rule is still there, '
    + 'something that used to be rescued may no longer be');

  const missing = negations.filter((p) => !fs.existsSync(path.join(REPO_ROOT, p)));
  assert.deepEqual(missing, [],
    'these .gitignore carve-outs point at paths that do not exist. A renamed directory leaves '
    + 'its negation behind and the broad ignore rule silently reclaims real source files, which '
    + 'is exactly how six of them went untracked after CALL became vex-business.');
});

// **This one needs a git repository, and one place runs the suite
// without one.** `scripts/package-release.mjs` extracts `git archive`
// output — tracked files and nothing else, no `.git` — and re-runs
// everything inside it. There, "is this file tracked?" has no answer
// rather than a different one: `git ls-files` fails outright.
//
// Note this is not the case the report-drift check faced, where the
// answer merely differed and the fix was to ask a better question.
// Here the repository the question is about is genuinely absent. The
// path-exists check above still runs everywhere, and it is the one
// that catches the rename bug this file was written for.
const NO_GIT = fs.existsSync(path.join(REPO_ROOT, '.git'))
  ? false
  : 'no .git directory — this is a release-archive extract, where every file present '
    + 'is tracked by construction and there is nothing to ask git about';

test('the files a carve-out rescues are actually tracked', { skip: NO_GIT }, () => {
  // The carve-out working and the files being in the repository are
  // two different facts. Only the second one survives a lost container.
  const dirs = concreteNegations().filter((p) => {
    const abs = path.join(REPO_ROOT, p);
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  });

  const emptyOfTracked = [];
  for (const dir of dirs) {
    // A carve-out may name a parent purely so a deeper one can apply
    // (git will not descend into an excluded directory), so a parent
    // with tracked files anywhere beneath it counts.
    const r = spawnSync('git', ['ls-files', '--', dir], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ls-files failed for ${dir}: ${r.stderr}`);
    if (r.stdout.trim() === '') emptyOfTracked.push(dir);
  }

  assert.deepEqual(emptyOfTracked, [],
    'these directories are carved out of .gitignore but contain no tracked files. Either the '
    + 'carve-out is obsolete, or the files it rescues were never committed — in which case they '
    + 'exist only on this machine.');
});

// ---------------------------------------------------------------------------
// Nothing installs itself into the repository
// ---------------------------------------------------------------------------

test('no node_modules is tracked, and every app ignores its own', () => {
  // **Found by unzipping the release archive**, not by reading
  // anything: `vaco-notify/node_modules` was tracked — 636 files,
  // 4.6MB — so `git archive` shipped it in every release, directly
  // contradicting `scripts/package-release.mjs`'s own header, which
  // says node_modules is excluded because "shipping platform-specific
  // binaries inside a source archive is how a deploy breaks on a
  // different libc."
  //
  // The cause was mundane and worth recording: the root `.gitignore`
  // has no node_modules rule at all. Each app carries its own, and
  // `vaco-notify` and `vaco-mcp` were the two that did not have one.
  // vaco-notify's dependencies were committed before anybody noticed,
  // and a `.gitignore` added afterwards does nothing about files that
  // are already tracked.
  //
  // That is the more dangerous half. With no rule anywhere, a single
  // `git add -A` run after `install-ecosystem.sh` would commit every
  // app's dependencies — 277MB — and nothing would have objected.
  const listed = spawnSync('git', ['ls-files'], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  // In a release-archive extract there is no .git to ask. Same posture
  // as the carve-out check above: say so rather than pass quietly.
  if (listed.status !== 0) {
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, '.git')),
      `git ls-files failed with a .git present: ${listed.stderr}`);
    return;
  }
  const tracked = listed.stdout.split('\n').filter((f) => f.includes('node_modules/'));

  const dirs = [...new Set(tracked.map((f) => f.replace(/\/node_modules\/.*/, '/node_modules')))];
  assert.deepEqual(dirs, [],
    `these node_modules directories are tracked and ship in every release archive:\n    `
    + `${dirs.join('\n    ')}\n`
    + 'Run `git rm -r --cached <dir>` and make sure that app has a .gitignore.');

  // And the rule that keeps it that way: every app with a package.json
  // ignores its own. An app without one is not broken today — it is
  // one `git add -A` away from being the next vaco-notify.
  const unguarded = [];
  for (const entry of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const appDir = path.join(REPO_ROOT, entry.name);
    if (!fs.existsSync(path.join(appDir, 'package.json'))) continue;

    const ignoreFile = path.join(appDir, '.gitignore');
    const ignored = fs.existsSync(ignoreFile)
      && /^\s*node_modules\/?\s*$/m.test(fs.readFileSync(ignoreFile, 'utf8'));
    if (!ignored) unguarded.push(entry.name);
  }

  assert.deepEqual(unguarded, [],
    `these apps have a package.json and nothing ignoring their node_modules:\n    `
    + `${unguarded.join('\n    ')}`);
});
