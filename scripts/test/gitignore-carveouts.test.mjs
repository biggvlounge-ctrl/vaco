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

test('the files a carve-out rescues are actually tracked', () => {
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
