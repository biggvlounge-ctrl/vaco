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
// It reads the same generated files that
// `scripts/test/system-of-record.test.mjs` reads, so this cannot
// disagree with the test that guards it:
//
//   dev-docs/COMPLETION_BY_APP.md   per-app counts (completion-report.mjs)
//   dev-docs/TEST_COUNTS.json       every suite, including the four
//                                   the report does not list
//
// ...and runs the three audits whose totals §1 quotes, because those
// are the other figures that drifted. **Adding one app to one shared
// module moved five of them at once** -- route count, guarded count,
// open count, shared-module copies and service callers -- which is
// more transcription than anybody gets right by hand twice.
//
// The audits are run in `--check` mode and their own output is parsed,
// so a restamp cannot invent a number the tool would not print.
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

import { execFileSync, spawnSync } from 'node:child_process';
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

// **The headline comes from the table, not from TEST_COUNTS.total**, and
// the difference is not cosmetic. `system-of-record.test.mjs` checks the
// headline against the sum of §10's own rows — deliberately, so one
// assertion covers both without running the suite inside a test.
//
// Taking it from `counts.total` instead worked only while the two
// sources were always refreshed together. They are not any more:
// `run-all-tests.mjs` now leaves TEST_COUNTS alone on a red run, so
// after a failing run the table restamps from a fresh
// COMPLETION_BY_APP.md while the headline would restamp from a stale
// TEST_COUNTS — and the document would state two numbers that
// contradict each other. Hit immediately after making that change:
// table 1677, headline 1666.
//
// Summing the rows we just wrote is skew-proof by construction.
const tableRows = [...newTable.matchAll(/([a-z0-9\-/]+)\s+(\d+)/g)];
const headlineTotal = tableRows.reduce((n, m) => n + Number(m[2]), 0);
const headlineSuites = tableRows.length;
if (headlineTotal < 100 || headlineSuites < 25) {
  fail(`parsed only ${headlineSuites} rows totalling ${headlineTotal} from §10's table`);
}

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
  `| Automated tests | ${headlineTotal} across ${headlineSuites} suites |`);

sor = substitute(sor, 'SYSTEM_OF_RECORD.md §10 command',
  /# \d+\/\d+ across \d+ suites/,
  `# ${headlineTotal}/${headlineTotal} across ${headlineSuites} suites`);

let replit = fs.readFileSync(REPLIT_PATH, 'utf8');
replit = substitute(replit, 'REPLIT.md',
  /- The full test suite: \d+ tests across \d+ suites\./,
  `- The full test suite: ${headlineTotal} tests across ${headlineSuites} suites.`);

// -- the audit totals §1 quotes ----------------------------------------

// Each of these runs the tool and reads the number out of what it
// printed. A tool that fails or changes its wording produces no
// substitution and a reported skip -- never a guess.
// **`spawnSync`, and both streams.** The first version used
// `execFileSync`, which returns stdout ONLY -- and
// `generate-docker-compose.js` reports its counts with `console.error`,
// so the volume total came back as an empty string and was reported as
// unreadable. The tempting fix was to adjust the regex; the regex was
// right and the helper was throwing half the output away.
//
// Both streams are also what makes a `--check` tool that fails on
// drift still usable here: it prints the real numbers and exits
// non-zero, and a non-zero exit is not a reason to lose them.
function toolOutput(command, args) {
  const run = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return `${run.stdout || ''}${run.stderr || ''}`;
}

const audits = [];

const routes = toolOutput('node', ['scripts/audit-route-guards.mjs', '--check'])
  .match(/all (\d+) mutating routes across (\d+) apps accounted for \((\d+) guarded, (\d+) declared open/);
if (routes) {
  const [, total, , guarded, open] = routes;
  audits.push(['§1 mutating routes',
    /\| Mutating HTTP routes \| \d+, all accounted for \(\d+ guarded, \d+ declared open with a reason\) \|/,
    `| Mutating HTTP routes | ${total}, all accounted for (${guarded} guarded, ${open} declared open with a reason) |`]);
  audits.push(['§10 route-audit comment',
    /# \d+\/\d+ accounted for/, `# ${total}/${total} accounted for`]);
} else {
  audits.push(['§1 mutating routes', null, null]);
}

const copies = toolOutput('./sync-shared-runtime.sh', ['--check'])
  .match(/all (\d+) copies current and in use/);
if (copies) {
  audits.push(['§1 shared-module copies',
    /\| Shared-module copies kept in sync \| \d+ \|/,
    `| Shared-module copies kept in sync | ${copies[1]} |`]);
  audits.push(['§10 sync comment',
    /# \d+ copies current, none unmanaged/, `# ${copies[1]} copies current, none unmanaged`]);
} else {
  audits.push(['§1 shared-module copies', null, null]);
}

const callers = toolOutput('node', ['scripts/generate-service-tokens.mjs', '--check'])
  .match(/matches the derived list of (\d+) callers/);
if (callers) {
  audits.push(['§1 service callers',
    /\| Service credentials in `\.env\.example` \| \d+ callers \|/,
    `| Service credentials in \`.env.example\` | ${callers[1]} callers |`]);
  audits.push(['§10 token comment',
    /# \.env\.example matches \d+ callers/, `# .env.example matches ${callers[1]} callers`]);
} else {
  audits.push(['§1 service callers', null, null]);
}

const compose = toolOutput('node', ['deploy/generate-docker-compose.js'])
  .match(/(\d+) app services \+ nginx, livekit, postgres, (\d+) persisted volumes/);
if (compose) {
  audits.push(['§1 persisted volumes',
    /\| Persisted volumes \| \d+ \|/, `| Persisted volumes | ${compose[2]} |`]);
  audits.push(['§10 compose comment',
    /# \d+ apps \+ nginx, livekit, postgres, \d+ volumes/,
    `# ${compose[1]} apps + nginx, livekit, postgres, ${compose[2]} volumes`]);
} else {
  audits.push(['§1 persisted volumes', null, null]);
}

const unread = [];
for (const [label, pattern, replacement] of audits) {
  if (pattern === null) { unread.push(label); continue; }
  sor = substitute(sor, label, pattern, replacement);
}
if (unread.length > 0) {
  process.stdout.write(
    `restamp-record: could not read ${unread.length} audit total(s), left alone: `
    + `${unread.join(', ')}\n`,
  );
}

// -- the commit stamp --------------------------------------------------

// **Stamped at HEAD, with HEAD's own commit count.** The two are one
// claim: "current as of commit X, N commits" says N is the count *at
// X*, which `system-of-record.test.mjs` checks exactly. Writing HEAD's
// hash beside a count taken anywhere else is the one way to get this
// pair wrong, so they are read in a single place here.
//
// Committing this restamp moves HEAD on, leaving the stamp one commit
// behind — which is what the test's tolerance of 3 exists for. Chasing
// it to zero is not possible: the commit that updates the stamp is
// itself a commit.
//
// Skipped without `.git`, which is the case inside a release-archive
// extract — the same condition `system-of-record.test.mjs` skips the
// stamp check on. Not silently: the count figures above are still
// restamped, and the skip is reported.
function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const head = fs.existsSync(path.join(REPO_ROOT, '.git')) ? git(['rev-parse', '--short', 'HEAD']) : null;
if (head === null) {
  process.stdout.write('restamp-record: no .git, so the commit stamp was left alone.\n');
} else {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commits = git(['rev-list', '--count', 'HEAD']);
  // Built from a fixed month list rather than `toLocaleDateString`,
  // which renders September as "Sept" under en-GB and would have
  // changed the document's established "12 Sep 2026" form for one
  // month of the year only.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const date = `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  if (branch === null || commits === null) fail('git is present but would not answer');

  sor = substitute(sor, 'SYSTEM_OF_RECORD.md stamp',
    /\*Current as of commit `[0-9a-f]{7,40}`, \d+ commits, branch\n`[^`]+`, [^.]+\.\*/,
    `*Current as of commit \`${head}\`, ${commits} commits, branch\n\`${branch}\`, ${date}.*`);
}

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
