// The inventory has to agree with the tree, and until now nothing made it.
//
// ---------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------
// `VACANCY_INVENTORY.md` is one of the two live working documents
// CLAUDE.md names, and its own header records it going stale twice:
// once listing "21 of what were by then 55 files, 15 of those 21 with
// the wrong byte count", and once saying 76 routes when 79 were
// registered. It was found stale a third time on 23 Sep 2026 — 72 files
// claimed against 73 on disk, with `media.js`, `trade.js` and
// `keysLog.js` named nowhere in it.
//
// Three drifts in one document is not carelessness, it is a missing
// guard. `completeness.test.js` already holds the measured percent to
// the tree and `sources.test.js` holds a `wired` path to a file that
// exists; this is the same discipline for the file list.
//
// **It checks presence, not prose.** A row's description is judgement
// and cannot be tested; whether the file it names exists, and whether
// every file has a row, is a fact.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const inventory = fs.readFileSync(path.join(root, 'VACANCY_INVENTORY.md'), 'utf8');
const serverFiles = fs.readdirSync(path.join(root, 'server'))
  .filter((name) => name.endsWith('.js'))
  .sort();

test('every file in server/ has a row in the inventory', () => {
  // The drift that was found three times. A file nobody lists is a file
  // nobody knows was built, which is this repository's oldest failure
  // mode wearing a filename.
  const missing = serverFiles.filter((name) => !inventory.includes(`\`${name}\``));
  assert.deepEqual(missing, [],
    'these server files are named nowhere in VACANCY_INVENTORY.md — add a row for each, '
    + 'saying what it holds and why it exists');
});

test('every file the inventory names still exists', () => {
  // The other direction, and the one that would otherwise rot silently:
  // a row for a file somebody deleted or renamed reads exactly like a
  // row for a file that is there.
  const named = [...inventory.matchAll(/^\| `([\w.-]+\.js)` \|/gm)].map((m) => m[1]);
  assert.ok(named.length > 50, 'the inventory table appears to have lost its rows');
  const gone = [...new Set(named)]
    .filter((name) => !fs.existsSync(path.join(root, 'server', name)))
    // server.js sits at the project root rather than in server/.
    .filter((name) => !fs.existsSync(path.join(root, name)));
  assert.deepEqual(gone, [],
    'VACANCY_INVENTORY.md has rows for files that are not on disk');
});

test('the stated file count is the real one', () => {
  // "All 72 files present on disk" against 73 is the exact shape of the
  // failure: a number typed once, true once, and never re-derived.
  const claimed = inventory.match(/All (\d+) files present on disk/);
  assert.ok(claimed, 'the inventory no longer states a file count');
  assert.equal(Number(claimed[1]), serverFiles.length,
    `the inventory claims ${claimed[1]} server files; there are ${serverFiles.length}`);
});

test('the stated route count is the real one', () => {
  // This one has drifted before too — the document records saying 76
  // when 79 were registered. Counted from server.js rather than trusted.
  const registered = (fs.readFileSync(path.join(root, 'server.js'), 'utf8')
    .match(/^\s*app\.(get|post|put|patch|delete)\(/gm) || []).length;
  const claimed = inventory.match(/\*\*(\d+) routes\*\*/);
  assert.ok(claimed, 'the inventory no longer states a route count');
  assert.equal(Number(claimed[1]), registered,
    `the inventory claims ${claimed[1]} routes; server.js registers ${registered}`);
});
