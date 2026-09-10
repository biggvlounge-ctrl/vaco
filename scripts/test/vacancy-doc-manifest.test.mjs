// Is `vacon-c/VACANCY_DOCUMENT_MANIFEST.md` still true?
//
// **What it is for.** `VACANCY_MASTER_SESSION_INDEX.md` names ~90
// documents and tells the reader to use it *instead of* looking at the
// files. Most of those documents are not in this repository. The
// manifest measures that, and this keeps the measurement honest — a
// count written down once is a count that will be wrong later, which
// is the same argument `deploy-readme.test.mjs` and
// `completion-report.test.mjs` make.
//
// **This deliberately does not require the missing count to be zero.**
// Those documents were produced in earlier threads and cannot be
// conjured from inside the repository; a test that stays red until
// somebody locates 74 files is a test that gets ignored, and an
// ignored test protects nothing. What it does enforce is that the
// manifest matches reality — so the moment a document *is* added, the
// number moves, and if the index starts naming something new, the
// manifest has to be regenerated to say so.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'vacon-c', 'VACANCY_DOCUMENT_MANIFEST.md');

// The generator asks git what is in the repository, so like
// `gitignore-carveouts.test.mjs`'s second check it has no answer
// inside a `git archive` extract, where there is no `.git` at all.
const NO_GIT = fs.existsSync(path.join(REPO_ROOT, '.git'))
  ? false
  : 'no .git directory — this is a release-archive extract, and the manifest is built from '
    + '`git ls-files`';

test('the committed VACANCY document manifest matches reality', { skip: NO_GIT }, () => {
  assert.ok(fs.existsSync(MANIFEST),
    'vacon-c/VACANCY_DOCUMENT_MANIFEST.md is missing — run `node scripts/vacancy-doc-manifest.mjs`');

  const r = spawnSync(process.execPath, ['scripts/vacancy-doc-manifest.mjs', '--check'],
    { cwd: REPO_ROOT, encoding: 'utf8' });

  assert.equal(r.status, 0,
    `${r.stdout}${r.stderr}\nRe-run \`node scripts/vacancy-doc-manifest.mjs\` and commit the result.`);
});

// The manifest's value is entirely in the reader understanding that
// the index is not an inventory. A version that quietly dropped that
// framing would be a list of filenames nobody acts on.
test('the manifest still says the index is not an inventory', { skip: NO_GIT }, () => {
  const doc = fs.readFileSync(MANIFEST, 'utf8');

  assert.match(doc, /Not in this repository/,
    'the manifest no longer separates the documents that are absent');
  assert.match(doc, /cannot be closed from inside the\s+repository/,
    'the manifest no longer says the missing documents have to be located, not regenerated');
  assert.match(doc, /record of what was written/,
    'the manifest no longer warns that the index is a record, not an inventory');
});
