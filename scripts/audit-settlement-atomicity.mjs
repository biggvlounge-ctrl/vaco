#!/usr/bin/env node
// Which money paths still pay their parties one transfer at a time?
//
// **The defect, established rather than theorised.** VOID settled every
// job with consecutive awaits:
//
//     await transferFn(customer, provider, payout, ...);
//     await transferFn(customer, 'void-platform', fee, ...);
//     job.status = 'completed';
//
// The second call can fail on its own — the first just debited the same
// customer. When it did, the provider had been paid, the throw meant the
// status was never advanced, and the retry guard still passed. **The
// retry paid the provider a second time.** See
// `void/test/settlementAtomicity.test.js`, which reproduces it.
//
// VOID is fixed: `settleFn(legs, meta)` → `POST /api/vcoin/settle`,
// which validates every leg against running balances and writes nothing
// unless all of them pass. **The rest of the ecosystem is not.** This
// script is the worklist, and a ratchet so the number cannot grow while
// the sweep is in progress.
//
// ---------------------------------------------------------------
// **What it reports, and what it deliberately does not.**
//
// It reports *sites*: `await`ed transfer calls in a `lib/` module, per
// file. A file with two or more is a file where a settlement can be
// interrupted half-done.
//
// It does NOT try to name the enclosing function. The first version of
// this scan did, by splitting on `function `, and misattributed nearly
// every hit — reporting `round()` for a settlement four hundred lines
// away. It also counted the example code inside its own documentation
// comment, which is how it declared the already-converted
// `void/lib/settlement.js` unconverted. Comments and template literals
// are stripped now, and the report gives file and line, which is what
// it can state accurately.
//
// A count is not a verdict either. Two transfers in one file may be two
// unrelated single-leg paths, which are fine. The file is where to look;
// reading it is still the job.
//
// Usage:
//   node scripts/audit-settlement-atomicity.mjs           # the worklist
//   node scripts/audit-settlement-atomicity.mjs --check   # ratchet

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// **The ceiling, not a target.** Lower it as paths are converted; the
// check fails if the count rises, which is the only thing a ratchet can
// honestly promise while a sweep is unfinished. Same shape as
// `audit-route-guards.mjs`: it does not claim the remainder is fine, it
// claims the remainder is not growing.
const CEILING = 47;

const TRANSFER_CALL = /await\s+(?:transferFn|transferVCoin|transfer)\s*\(/g;

// A code example inside a header comment is not a call site. Neither is
// a template literal containing the words. Both produced real false
// positives in the first version of this file.
function stripNonCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => ' '.repeat(m.length))
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, ' '));
}

function libFiles() {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.name.endsWith('.js') || entry.name.includes('.test.')) continue;
      found.push(abs);
    }
  };
  for (const app of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!app.isDirectory() || app.name === 'node_modules' || app.name.startsWith('.')) continue;
    for (const root of ['lib', path.join('src', 'lib')]) {
      const dir = path.join(REPO_ROOT, app.name, root);
      if (fs.existsSync(dir)) walk(dir);
    }
  }
  return found.sort();
}

// V3 is the ledger itself: `vcoin.transfer` and `vcoin.settle` are the
// primitives every other app calls, so anything here is the
// implementation rather than a settlement that should be batched.
//
// (It happens to match nothing today — V3's ledger functions are
// synchronous, so there is no `await transfer(` to find. An earlier
// version of this file *asserted* it matched, as a scan sanity check,
// and that assertion fired immediately: the sentinel was built on a
// guess about code I had not read. The real sanity check is below, and
// it does not depend on any single file staying the way it is.)
const IS_THE_LEDGER = 'v3/lib/vcoin.js';

const rows = [];
for (const abs of libFiles()) {
  const rel = path.relative(REPO_ROOT, abs);
  const src = stripNonCode(fs.readFileSync(abs, 'utf8'));
  const lines = [];
  let m;
  TRANSFER_CALL.lastIndex = 0;
  while ((m = TRANSFER_CALL.exec(src)) !== null) {
    lines.push(src.slice(0, m.index).split('\n').length);
  }
  if (lines.length > 0) rows.push({ rel, lines });
}

// **The scan has to prove it can see anything at all.** A regex that
// stops matching — a rename, a comment-stripper that eats too much —
// reports a spotless ecosystem, which is the most dangerous possible
// output for a money check. `void/lib/settlement.js` alone is not the
// sentinel either, because it is converted; what must hold is that
// transfer calls are found *somewhere*, since this ecosystem
// unquestionably still has them.
if (rows.length === 0) {
  process.stderr.write('audit-settlement-atomicity: found no transfer calls anywhere in any lib/.\n'
    + 'This ecosystem moves money in a dozen apps, so that is a broken scan, not a clean sweep.\n'
    + 'Refusing to report success.\n');
  process.exit(2);
}

const worklist = rows.filter((r) => r.rel !== IS_THE_LEDGER && r.lines.length >= 2);
const total = worklist.reduce((n, r) => n + r.lines.length, 0);

const byApp = new Map();
for (const r of worklist) {
  const app = r.rel.split('/')[0];
  if (!byApp.has(app)) byApp.set(app, []);
  byApp.get(app).push(r);
}

if (!process.argv.includes('--check')) {
  process.stdout.write('Money paths that still transfer one leg at a time\n');
  process.stdout.write('(file and line -- a count is where to look, not a verdict)\n\n');
  for (const [app, files] of [...byApp].sort((a, b) => b[1].length - a[1].length)) {
    process.stdout.write(`  ${app}\n`);
    for (const f of files) {
      process.stdout.write(`      ${String(f.lines.length).padStart(2)} sites  ${f.rel}  (lines ${f.lines.join(', ')})\n`);
    }
  }
  process.stdout.write('\n');
}

process.stdout.write(`audit-settlement-atomicity: ${total} site(s) across ${worklist.length} file(s) `
  + `in ${byApp.size} app(s); ceiling ${CEILING}.\n`);

if (total > CEILING) {
  process.stderr.write(`\nThis is ${total - CEILING} more than when the sweep started.\n`
    + 'A new multi-leg settlement written as consecutive transfers can pay one party, fail, and be\n'
    + 'retried into paying them twice -- see void/test/settlementAtomicity.test.js. Use\n'
    + "V3's `POST /api/vcoin/settle` (one call, all legs) instead, as void/lib/settlement.js does.\n");
  process.exit(1);
}

if (total < CEILING) {
  process.stdout.write(`Below the ceiling -- lower CEILING to ${total} to keep the ratchet tight.\n`);
}
