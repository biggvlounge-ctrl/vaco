// Is `vacon-c/dev-docs/GAME_COMPLETENESS.md` still what the script
// measures?
//
// **Why this lives in the `scripts` suite rather than vacon-c's own.**
// The report is a measurement of a generated world run for 200 ticks,
// and reproducing it takes about a minute. Doing that inside vacon-c's
// unit suite pushed it past the 120-second per-suite timeout in
// `run-all-tests.mjs` — which failed the entire suite with "no TAP
// summary" rather than any assertion anybody could act on. The heavy
// check belongs in one place, next to `completion-report.test.mjs`,
// which is here for the same reason and checks the same class of thing.
//
// vacon-c's own `test/completeness.test.js` keeps the cheap half: that
// each axis reads reality, that `BY_DESIGN` is still true of the code it
// cites, and that the report's headline agrees with its own axis table
// and with `SYSTEM_OF_RECORD.md`.
//
// Same argument as every other generated document in this repo: a
// number in a document is a claim, and a claim nothing checks is one
// that will eventually be false. This project has the receipts —
// `vacon-c/CLAUDE.md`'s own "foundation already running" list was wrong
// in three places, and a spec section put its coverage at "roughly 25 of
// the 40" from memory.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = path.join(REPO_ROOT, 'vacon-c', 'dev-docs', 'GAME_COMPLETENESS.md');

test('the committed game-completeness report matches what the script measures', () => {
  assert.ok(fs.existsSync(DOC),
    'vacon-c/dev-docs/GAME_COMPLETENESS.md is missing — run `node vacon-c/scripts/completeness.mjs`');

  const r = spawnSync(process.execPath, ['scripts/completeness.mjs', '--check'],
    { cwd: path.join(REPO_ROOT, 'vacon-c'), encoding: 'utf8' });

  assert.equal(r.status, 0,
    `${r.stdout}${r.stderr}\nRe-run \`node vacon-c/scripts/completeness.mjs\` and commit the result.`);
});

// The report's whole value is that the shortfall is visible and
// actionable. A report that printed a percent and no gap list would be
// a score rather than a work list, and the score is the less useful
// half.
test('the report still says what it would take to reach 100%', () => {
  const doc = fs.readFileSync(DOC, 'utf8');

  assert.match(doc, /## What it takes to reach 100%/,
    'the report no longer lists its gaps');
  assert.match(doc, /empty in a built world/,
    'the report no longer distinguishes a built-but-unused mechanism from a missing one — '
    + 'that distinction is the eleventh standing rule and the most actionable thing in it');
  assert.match(doc, /\*\*Generated\. Do not edit\.\*\*/,
    'the report no longer says it is generated, so somebody will edit it');
});
