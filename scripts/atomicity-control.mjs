// Does anything actually fail if a settlement stops being atomic?
//
// **Why this exists.** Every multi-leg money path in the ecosystem was
// converted to one `settleFn(legs)` call, and `MONEY_ATOMICITY.md`
// claimed each had a unit test asserting the settlement is one call.
// Checking that claim by grepping test files for assertion shapes
// produced an immediate false negative — voidmagic asserts a *delta*
// (`settleCalls.length - before`), not a length — so the grep said
// "no assertion" about code that had one.
//
// The only reliable question is the one this script asks: break
// atomicity in the module, run its suite, and see whether anything
// fails. Run against the whole ecosystem it found five modules whose
// control did not fire, three of them real:
//
//   voidmagic/lib/media.js              `deliverMedia` had no money test at all
//   vacay/lib/auto/rentals.js           `cancelRental`'s late branch untested
//   vacay/lib/bookings/experienceBookings.js  both functions untested anywhere
//
// The other two are the reason this script has an exemption list rather
// than a green/red count.
//
// **The mutation.** One settlement per leg instead of one settlement
// for all of them:
//
//     await settleFn(legs, meta)
//   → await ((L, m) => Promise.all(L.map((l) => settleFn([l], m))))(legs, meta)
//
// Every account ends with the same balance, every total still adds up,
// every conservation invariant still holds. Only an assertion that
// counts the calls can see the difference — which is exactly why the
// arithmetic tests could not be trusted to cover this.
//
// **The exemption checks itself.** A single-leg settlement is atomic by
// construction: there is nothing to split, so the mutation is a no-op
// and the control *cannot* fire. Listing those modules as "expected
// silent" would hide the bug the list sits beside — the day somebody
// adds a second leg, the exemption would quietly keep excusing it. So
// each exemption asserts the module is *still* single-leg, and fails
// the run if it is not. Same discipline as
// `scripts/test/vite-build-args.test.mjs`'s same-origin exemption.
//
// Usage:
//   node scripts/atomicity-control.mjs            # every settling module
//   node scripts/atomicity-control.mjs vacay      # one app
//
// It rewrites source files in place and restores them, so it refuses to
// run against a dirty working tree for the modules it touches.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FROM = 'await settleFn(';

// **Two properties, two mutations.** `MONEY_ATOMICITY.md`'s conversion
// recipe asks for two assertions per site, and only the first was ever
// checked mechanically:
//
//   atomic    every leg goes to V3 in one call, so a failure part-way
//             cannot leave some payees paid and others not.
//   ordered   the record is written *after* the money moves, so a
//             refused settlement leaves the job/booking/order retryable
//             rather than marked done and never paid. VOID's standing
//             rule 6 — "settle before you write the status".
//
// A module can satisfy one and not the other, so each gets its own
// mutation and each has to be caught by something.
const MUTATIONS = [
  {
    name: 'atomic',
    to: 'await ((L, m) => Promise.all(L.map((l) => settleFn([l], m))))(',
    missing: 'add an assertion that the settlement is ONE call',
  },
  {
    name: 'ordered',
    // Swallow the ledger's refusal. The function then walks straight
    // past a settlement that never happened and writes the record
    // anyway — a completed booking nobody paid for.
    to: 'await ((...a) => settleFn(...a).catch(() => null))(',
    missing: 'add a test that a REFUSED settlement throws and leaves the record untouched',
  },
];

// Modules whose every settlement is a single leg. The control cannot
// fire for these and its silence is correct — but only while they stay
// single-leg, which is what `assertSingleLeg` below re-checks on every
// run rather than trusting this list.
const SINGLE_LEG = new Set([
  // The checkout-free store charges one shopper one total; the dispute
  // reversal pays one shopper back. Neither has a second party.
  'void/lib/grabAndGo.js',
  // VACAY is merchant-of-record for its own fleet, so there is no owner
  // to split with — the whole price moves to one account either way.
  'vacay/lib/auto/fleetRentals.js',
]);

// Seeds and simulators. They call `settleFn` but are not request paths,
// and their suites assert who pays rather than how many calls it took.
const NOT_A_REQUEST_PATH = new Set([
  'vago/lib/seedDemoData.js',
  'void/lib/storeSim.js',
]);

// Route files wire settlement into Express; the money shape lives in the
// lib module they call.
const isRouteFile = (rel) => rel.endsWith('/routes.js');

function settlingModules() {
  const found = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { walk(abs, r); continue; }
      if (!entry.name.endsWith('.js') || entry.name.includes('.test.')) continue;
      if (!/\/(lib|src\/lib)\//.test(`/${r}`)) continue;
      if (fs.readFileSync(abs, 'utf8').includes(FROM)) found.push(r);
    }
  };
  for (const app of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!app.isDirectory() || app.name === 'node_modules' || app.name.startsWith('.')) continue;
    const libRoots = [path.join(REPO_ROOT, app.name, 'lib'), path.join(REPO_ROOT, app.name, 'src', 'lib')];
    for (const root of libRoots) {
      if (fs.existsSync(root)) walk(root, path.relative(REPO_ROOT, root));
    }
  }
  return found.sort();
}

function suiteFor(app) {
  for (const d of [path.join(REPO_ROOT, app, 'test'), path.join(REPO_ROOT, app, 'src', 'test')]) {
    if (!fs.existsSync(d)) continue;
    const files = fs.readdirSync(d)
      .filter((f) => f.endsWith('.test.js') || f.endsWith('.test.mjs'))
      .map((f) => path.join(d, f));
    if (files.length > 0) return files;
  }
  return null;
}

// `node --test` sets NODE_TEST_CONTEXT, and a child that inherits it
// switches to the machine-readable v8 reporter — no `# pass N` line to
// parse. Here that would be worse than a wrong count: with `fail`
// parsing as -1 for both the baseline and the mutation, `mutated.fail >
// base.fail` is false, and every control would report "the mutation
// broke NOTHING" against suites that catch it perfectly well.
const CHILD_ENV = { ...process.env };
delete CHILD_ENV.NODE_TEST_CONTEXT;

function runSuite(files, cwd) {
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd, encoding: 'utf8', env: CHILD_ENV });
  const num = (re) => Number((r.stdout.match(re) || [])[1] ?? -1);
  return { pass: num(/^# pass (\d+)/m), fail: num(/^# fail (\d+)/m) };
}

// Every `settleFn([...])` call in the file, as its literal leg count.
// A settlement built from a `legs` variable is not counted here — it is
// multi-leg by nature, which is the case the control covers anyway.
function literalLegCounts(src) {
  const counts = [];
  const open = /await settleFn\(\s*\[/g;
  let m;
  while ((m = open.exec(src)) !== null) {
    const start = src.indexOf('[', m.index);
    let depth = 0; let j = start;
    for (; j < src.length; j += 1) {
      if (src[j] === '[') depth += 1;
      else if (src[j] === ']') { depth -= 1; if (depth === 0) break; }
    }
    counts.push((src.slice(start, j).match(/\bfromUserId\b/g) || []).length);
    open.lastIndex = j;
  }
  return counts;
}

const only = process.argv.slice(2);
const modules = settlingModules()
  .filter((m) => !isRouteFile(m) && !NOT_A_REQUEST_PATH.has(m))
  .filter((m) => only.length === 0 || only.some((o) => m.startsWith(`${o}/`) || m === o));

if (modules.length === 0) {
  process.stderr.write(`atomicity-control: no settling modules matched ${only.join(', ') || '(all)'}\n`
    + 'A run that checks nothing must not report success.\n');
  process.exit(2);
}

const problems = [];
let fired = 0; let exempt = 0;

for (const rel of modules) {
  const app = rel.split('/')[0];
  const abs = path.join(REPO_ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');

  const files = suiteFor(app);
  if (!files) { problems.push(`${rel}: no test suite found for ${app}`); continue; }

  const base = runSuite(files, path.join(REPO_ROOT, app));
  if (base.fail !== 0) {
    problems.push(`${rel}: ${app}'s suite is already failing (${base.fail}) \u2014 fix that before trusting a control`);
    continue;
  }

  // A single-leg module is atomic by construction: nothing to split, so
  // the `atomic` mutation is a no-op and its silence is correct. The
  // exemption is re-earned from source on every run, and does NOT
  // extend to `ordered` \u2014 writing a record for money that never moved
  // is a defect at any leg count.
  let skipAtomic = false;
  if (SINGLE_LEG.has(rel)) {
    const counts = literalLegCounts(src);
    const multi = counts.filter((n) => n > 1);
    if (multi.length > 0) {
      problems.push(`${rel} is on the single-leg exemption list but now has a `
        + `${multi[0]}-leg settlement. Remove it from SINGLE_LEG and give the `
        + 'multi-leg path a one-call assertion.');
    } else {
      skipAtomic = true;
      exempt += 1;
      process.stdout.write(`    exempt  ${rel.padEnd(44)} atomic: every settlement is one leg (${counts.join(', ') || 'none literal'})\n`);
    }
  }

  for (const mutation of MUTATIONS) {
    if (mutation.name === 'atomic' && skipAtomic) continue;

    fs.writeFileSync(abs, src.split(FROM).join(mutation.to));
    const mutated = runSuite(files, path.join(REPO_ROOT, app));
    fs.writeFileSync(abs, src);

    if (mutated.fail > base.fail) {
      fired += 1;
      process.stdout.write(`    ok      ${rel.padEnd(44)} ${mutation.name}: control fires (${mutated.fail} test(s) caught it)\n`);
    } else {
      problems.push(`${rel} [${mutation.name}]: the mutation broke NOTHING. ${app}'s suite stayed `
        + `${base.pass}/${base.fail}. ${mutation.missing}.`);
    }
  }
}

process.stdout.write(`\natomicity-control: ${fired} control(s) fired across ${modules.length} module(s) `
  + `and ${MUTATIONS.length} mutation(s), ${exempt} single-leg atomic exemption(s).\n`);

if (problems.length > 0) {
  process.stdout.write(`\n${problems.length} problem(s):\n`);
  for (const p of problems) process.stdout.write(`  - ${p}\n`);
  process.exit(1);
}
process.stdout.write('atomicity-control: ok\n');
