#!/usr/bin/env node
// Bring the test counts in SYSTEM_OF_RECORD.md and REPLIT.md back in
// line with what the tools actually measured.
//
// **Why this exists rather than a note telling people to edit by
// hand.** Three suites were added in one session, and each time the
// same three places had to be updated: §10's per-suite table, §1's
// headline, and REPLIT.md's line about the suite. Every one of those
// hand edits needed a correction — a column width, a figure in the
// wrong section, a number that appeared twice. The numbers are
// generated; the transcription was the only manual step, and it was
// the only step that went wrong.
//
// It reads the same two generated files that
// `scripts/test/system-of-record.test.mjs` reads, so this cannot
// disagree with the test that guards it:
//
//   dev-docs/COMPLETION_BY_APP.md   per-app counts (completion-report.mjs)
//   dev-docs/TEST_COUNTS.json       every suite, including the four
//                                   the report does not list
//
// **It changes numbers in place and nothing else.** The per-suite
// table's column layout and row order are left exactly as they are:
// re-sorting it by count would be a cosmetic rewrite of forty lines in
// the middle of a document whose whole job is being diffable. If a
// suite is missing from the table entirely, that is said rather than
// invented — where a new row belongs in a hand-arranged table is a
// judgement call, not a substitution.
//
// Run it after `node scripts/run-all-tests.mjs`, which is what writes
// TEST_COUNTS.json. Running it before means restamping to the previous
// run's numbers.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SOR_PATH = path.join(REPO_ROOT, 'SYSTEM_OF_RECORD.md');
const REPLIT_PATH = path.join(REPO_ROOT, 'REPLIT.md');
const REPORT_PATH = path.join(REPO_ROOT, 'dev-docs', 'COMPLETION_BY_APP.md');
const COUNTS_PATH = path.join(REPO_ROOT, 'dev-docs', 'TEST_COUNTS.json');

function fail(message) {
  process.stderr.write(`restamp-record: ${message}\n`);
  process.exit(1);
}

for (const p of [SOR_PATH, REPLIT_PATH, REPORT_PATH, COUNTS_PATH]) {
  if (!fs.existsSync(p)) fail(`${path.relative(REPO_ROOT, p)} is missing`);
}

// -- what the tools measured -------------------------------------------

const report = fs.readFileSync(REPORT_PATH, 'utf8');
const counts = JSON.parse(fs.readFileSync(COUNTS_PATH, 'utf8'));

// Same row pattern the test parses, deliberately: a divergence here
// would restamp to numbers the test then rejects.
const real = new Map();
for (const m of report.matchAll(/^\| `([a-z0-9-]+)` \|.*\| (\d+) \|\s*$/gm)) {
  real.set(m[1], Number(m[2]));
}
if (real.size < 25) fail(`parsed only ${real.size} apps from the completion report`);

for (const [name, row] of Object.entries(counts.perSuite || {})) {
  if (!real.has(name)) real.set(name, row.tests);
}

if (!Number.isInteger(counts.total) || counts.total < 100) {
  fail(`TEST_COUNTS.json records only ${counts.total} tests`);
}
const suiteCount = Object.keys(counts.perSuite || {}).length;

// -- §10's per-suite table ---------------------------------------------

let sor = fs.readFileSync(SOR_PATH, 'utf8');
const tableMatch = sor.match(/(### Per-suite\n\n```\n)([\s\S]*?)(```)/);
if (!tableMatch) fail('§10 no longer has a per-suite table');

const changed = [];
const missing = [];
const seen = new Set();

// A row is `<name> <spaces> <count>`, two or three times per line. The
// replacement keeps the pair's total width so the columns stay aligned:
// a name plus padding plus a count that got one digit longer loses a
// space of padding, not a column.
const newTable = tableMatch[2].replace(
  /([a-z0-9\-/]+)(\s+)(\d+)/g,
  (whole, name, gap, was) => {
    seen.add(name);
    if (!real.has(name)) {
      missing.push(name);
      return whole;
    }
    const now = String(real.get(name));
    if (now === was) return whole;
    changed.push(`${name}: ${was} -> ${now}`);
    const width = gap.length + was.length;
    const pad = Math.max(1, width - now.length);
    return `${name}${' '.repeat(pad)}${now}`;
  },
);
sor = sor.replace(tableMatch[0], `${tableMatch[1]}${newTable}${tableMatch[3]}`);

// **A nested app is listed under two names and neither is wrong.** The
// completion report rows it by app name (`chopz-shop`), TEST_COUNTS
// rows it by suite path (`chopz/chopz-shop`), and §10's table uses the
// path. Reporting the bare name as an unmatched suite would be a
// standing false warning on every run, so a name is only unmatched if
// no path form of it was matched either.
for (const name of real.keys()) {
  if (seen.has(name)) continue;
  const aliased = [...seen].some((s) => s.endsWith(`/${name}`));
  if (!aliased) missing.push(name);
}

// -- §1's headline and the command comment -----------------------------

function substitute(text, label, pattern, replacement) {
  const found = text.match(pattern);
  if (!found) fail(`${label}: nothing matched ${pattern}`);
  const next = text.replace(pattern, replacement);
  if (next !== text) changed.push(`${label}: ${found[0].trim()} -> ${replacement.trim()}`);
  return next;
}

sor = substitute(sor, 'SYSTEM_OF_RECORD.md §1',
  /\| Automated tests \| \d+ across \d+ suites \|/,
  `| Automated tests | ${counts.total} across ${suiteCount} suites |`);

sor = substitute(sor, 'SYSTEM_OF_RECORD.md §10 command',
  /# \d+\/\d+ across \d+ suites/,
  `# ${counts.total}/${counts.total} across ${suiteCount} suites`);

let replit = fs.readFileSync(REPLIT_PATH, 'utf8');
replit = substitute(replit, 'REPLIT.md',
  /- The full test suite: \d+ tests across \d+ suites\./,
  `- The full test suite: ${counts.total} tests across ${suiteCount} suites.`);

// -- write -------------------------------------------------------------

fs.writeFileSync(SOR_PATH, sor);
fs.writeFileSync(REPLIT_PATH, replit);

if (changed.length === 0) {
  process.stdout.write('restamp-record: already current.\n');
} else {
  process.stdout.write(`restamp-record: updated ${changed.length} figure(s).\n`);
  for (const line of changed) process.stdout.write(`  ${line}\n`);
}

// Reported, never guessed at. A suite in the table that the tools do
// not know about, or a suite the tools measured that the table does not
// list, both need a person to decide what the document should say.
if (missing.length > 0) {
  process.stdout.write(
    `restamp-record: ${missing.length} suite(s) not matched between the table and the `
    + `tools, left alone: ${missing.sort().join(', ')}\n`,
  );
}
