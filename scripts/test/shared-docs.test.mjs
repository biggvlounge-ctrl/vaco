// Documents that exist in more than one app must agree.
//
// **Why this exists.** Some specification documents are the source of
// truth for several apps at once, and the repo keeps a copy in each
// app's directory rather than one copy somewhere central. Nothing kept
// those copies in step -- `sync-shared-runtime.sh` covers code modules
// and `sync-design-system.sh` covers CSS, but no script and no test
// covered documents.
//
// It bit immediately. `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` is the
// declared source of truth for the Product and Listing shapes in three
// apps. Adding two fields to it, I updated the three copies I knew
// about -- and there were **four**. The fourth, nested at
// `chopz/chopz-shop/`, would have sat there contradicting the other
// three, which is worse than not editing any of them: a reader
// checking the spec from inside chopz-shop would have got the old
// answer and had no way to know.
//
// A stale copy of a specification is not a stale copy of prose. It is
// a second, quieter answer to a question the code is trying to settle.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Documents deliberately kept in several places. Each name here is a
// claim that every copy of it in the repo should be byte-identical.
//
// README.md and CLAUDE.md are excluded on purpose: they are per-app by
// design and SHOULD differ. This list is only for documents that are
// one specification with several homes.
const MUST_AGREE = [
  'VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md',
  'VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md',
];

// Walk the repo for a filename, skipping the places a duplicate is
// somebody else's business.
function copiesOf(filename) {
  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 3) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name === filename) found.push(path.relative(REPO_ROOT, full));
    }
  };
  walk(REPO_ROOT);
  return found.sort();
}

const digest = (rel) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(REPO_ROOT, rel)))
  .digest('hex');

test('every document with more than one home has identical copies', () => {
  const drifted = [];

  for (const filename of MUST_AGREE) {
    const copies = copiesOf(filename);

    // A document that has stopped being duplicated is fine, but a name
    // in the list matching nothing means this test is checking air.
    assert.ok(copies.length > 0, `${filename} is listed here but exists nowhere`);

    const byDigest = new Map();
    for (const rel of copies) {
      const d = digest(rel);
      if (!byDigest.has(d)) byDigest.set(d, []);
      byDigest.get(d).push(rel);
    }

    if (byDigest.size > 1) {
      const groups = [...byDigest.values()]
        .map((g) => `      ${g.join('\n      ')}`)
        .join('\n    --- differs from ---\n');
      drifted.push(`${filename} has ${byDigest.size} different versions:\n${groups}`);
    }
  }

  assert.deepEqual(
    drifted, [],
    `these shared documents have drifted apart:\n\n  ${drifted.join('\n\n  ')}\n\n`
    + 'Copies of one specification must agree. Update every copy, or move the\n'
    + 'document somewhere central and leave a pointer in each app.',
  );
});

test('the list names documents that really are duplicated', () => {
  // A single-copy document in this list would pass the check above
  // forever while asserting nothing, and would hide the day somebody
  // adds a second copy of something that genuinely needs checking.
  const notDuplicated = MUST_AGREE.filter((f) => copiesOf(f).length < 2);
  assert.deepEqual(
    notDuplicated, [],
    `these are listed as shared documents but have fewer than two copies: ${notDuplicated.join(', ')}. `
    + 'Either remove the name or the check is vacuous.',
  );
});
