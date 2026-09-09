// Is `dev-docs/COMPLETION_BY_APP.md` still what the script emits?
//
// **Why this exists.** `dev-docs/COMPLETION_AUDIT.md` was written with
// the right method — "measured against the repo, not recalled" — and
// still went stale, because a document measured once is a document
// measured once. By the time anyone re-read it, it said 31 apps and
// 522 tests against a real 34 and 1413. Nothing had gone wrong; nobody
// had re-counted.
//
// The generated replacement can drift the same way the moment somebody
// adds an app and does not re-run the script. This is the thing that
// notices. Same argument as `deploy-readme.test.mjs`: a number in a
// document is a claim, and a claim nothing checks is one that will
// eventually be false.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = path.join(REPO_ROOT, 'dev-docs', 'COMPLETION_BY_APP.md');

test('the committed completion report matches what the script emits', () => {
  assert.ok(fs.existsSync(DOC), 'dev-docs/COMPLETION_BY_APP.md is missing — run `node scripts/completion-report.mjs`');

  const r = spawnSync(process.execPath, ['scripts/completion-report.mjs', '--check'],
    { cwd: REPO_ROOT, encoding: 'utf8' });

  assert.equal(r.status, 0,
    `${r.stdout}${r.stderr}\nRe-run \`node scripts/completion-report.mjs\` and commit the result.`);
});

// The report's whole value is that a shortfall is visible. A run that
// exempted its way to a clean sheet would look identical to a genuinely
// clean one, so the document has to keep saying which criteria did not
// apply and why.
test('the report still explains its own exemptions', () => {
  const doc = fs.readFileSync(DOC, 'utf8');

  assert.match(doc, /does not apply to that app and is excluded/,
    'the report no longer explains what a `—` means');
  assert.match(doc, /NOT a measure of product depth/,
    'the report no longer warns that the score is not product completeness');
  assert.match(doc, /MEDIA_INFRASTRUCTURE_DECISION\.md/,
    'the report no longer points at the real-time media gap, which is larger than anything it scores');
});

// **100% has to mean 100%.** An earlier version printed a headline
// "100%" over a table containing an unmet criterion, because
// `Math.round(259 / 260 * 100)` is 100. That is the one figure a reader
// quotes, and it was false.
test('a headline of 100% is only possible with nothing unmet', () => {
  const doc = fs.readFileSync(DOC, 'utf8');
  const headline = doc.match(/\| Overall criteria met \| \*\*(\d+)%\*\* \((\d+)\/(\d+)\) \|/);
  assert.ok(headline, 'the report no longer states an overall percentage');

  const [, pct, met, total] = headline.map(Number);
  if (pct === 100) {
    assert.equal(met, total, `the report claims 100% with ${total - met} criteria unmet`);
  } else {
    assert.ok(met < total, 'the report claims less than 100% with everything met');
  }
});
