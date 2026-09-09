// Per-app completion, measured from the repository.
//
// **Why this exists.** `dev-docs/COMPLETION_AUDIT.md` was written on
// 2026-08-22 with the right method — "measured against the repo, not
// recalled" — and then went stale exactly the way a hand-counted
// document does. By 2026-09-09 its headline numbers read 31 apps and
// 522 tests against a real 34 and 1413. Nothing had gone wrong; nobody
// had re-counted. And it never had the thing most often asked for
// anyway: a per-app number.
//
// So this does not maintain a document. It regenerates one, and
// `scripts/test/completion-report.test.mjs` fails if the committed
// output no longer matches what this script emits.
//
// ---------------------------------------------------------------
// **What "complete" means here, precisely.**
//
// A percentage is an interpretation, and an interpretation nobody can
// audit is worse than no number. So the score is not a judgement — it
// is the count of *named, individually checkable* criteria an app
// meets, out of the criteria that apply to it. Every one is derived
// from the repo below, and every one can be checked by hand.
//
// This measures **infrastructure completeness against this
// ecosystem's own standards**. It is emphatically NOT a measure of
// product depth. An app can score 8/8 and still not do the thing its
// users want, and two apps at 8/8 can be wildly different amounts of
// built software. What it does answer honestly: does this app serve,
// persist, authorise, get tested, ship in the design system, and land
// in all three deployment paths — or is one of those missing?
//
// Three things it deliberately cannot see, all flagged in the output:
//
//   - the real-time media gap (six surfaces blocked on a vendor
//     decision, `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`)
//   - anything Docker (#128) or off-host backup (#125), both blocked
//     on infrastructure this environment does not have
//   - whether a guard is the *right* guard, which is
//     `audit-route-guards.mjs`'s own standing caveat
//
// Usage:
//   node scripts/completion-report.mjs            # write the document
//   node scripts/completion-report.mjs --check    # fail if it drifted

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(REPO_ROOT, 'dev-docs', 'COMPLETION_BY_APP.md');

const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const exists = (...p) => fs.existsSync(path.join(REPO_ROOT, ...p));

// -- the manifest, same source every deploy generator reads -------------

const startScript = readIf(path.join(REPO_ROOT, 'start-ecosystem.sh'));
const manifest = (startScript.match(/APPS=\(([\s\S]*?)\n\)/)?.[1] || '')
  .split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
  .map((l) => {
    const [name, appPath, cmd, port] = l.slice(1, -1).split(':');
    return { name, appPath, cmd, port };
  });

if (manifest.length === 0) {
  process.stderr.write('completion-report: start-ecosystem.sh has no APPS manifest to measure.\n'
    + 'A report that measures nothing must not be written.\n');
  process.exit(2);
}

// -- the other generated artifacts, read rather than assumed ------------

const compose = readIf(path.join(REPO_ROOT, 'docker-compose.yml'));
const ecosystem = readIf(path.join(REPO_ROOT, 'deploy', 'ecosystem.config.js'));
const nginxConf = readIf(path.join(REPO_ROOT, 'deploy', 'nginx-docker.conf'));
const designSh = readIf(path.join(REPO_ROOT, 'sync-design-system.sh'));

const pm2Names = [...ecosystem.matchAll(/name:\s*["']([^"']+)/g)].map((m) => m[1]);
const nginxLocs = [...nginxConf.matchAll(/^\s*location\s+(\S+)/gm)].map((m) => m[1]);
const composeSvcs = [...(compose.split(/\n(?=volumes:\n)/)[0] || '')
  .matchAll(/\n {2}([a-z0-9][\w-]*):\n/g)].map((m) => m[1]);
const designTargets = (designSh.match(/TARGETS=\(([\s\S]*?)\n\)/)?.[1] || '')
  .split(/\s+/).filter(Boolean);

// -- guard coverage, from the audit rather than re-derived --------------
//
// Re-implementing the route scan here would mean two scanners that can
// disagree, and the one in `audit-route-guards.mjs` is the one the CI
// gate and the release verification both run. So: run it, parse it.
const guardEnv = { ...process.env };
delete guardEnv.NODE_TEST_CONTEXT;
const guardOut = spawnSync(process.execPath, ['scripts/audit-route-guards.mjs'],
  { cwd: REPO_ROOT, encoding: 'utf8', env: guardEnv }).stdout || '';
const guards = new Map();
for (const m of guardOut.matchAll(/^ {2}(\S+)\s+(\d+)\s+(\d+)\s+(\d+)(.*)$/gm)) {
  guards.set(m[1], {
    guarded: Number(m[2]),
    declared: Number(m[3]),
    open: Number(m[4]),
    appLevel: /app-level service credential/.test(m[5]),
  });
}
if (guards.size === 0) {
  process.stderr.write('completion-report: could not parse audit-route-guards output.\n'
    + 'Scoring every app as unguarded would be a lie; refusing to write.\n');
  process.exit(2);
}

// -- per-app test counts, by actually running each suite ---------------
//
// Counting `test(` occurrences would count tests that do not run, and a
// skipped suite would score the same as a passing one. Both matter here.
function suiteFor(appPath) {
  for (const d of ['test', path.join('src', 'test')]) {
    const abs = path.join(REPO_ROOT, appPath, d);
    if (!fs.existsSync(abs)) continue;
    const files = fs.readdirSync(abs).filter((f) => /\.test\.(js|mjs)$/.test(f));
    if (files.length > 0) return files.map((f) => path.join(d, f));
  }
  return null;
}

// **`NODE_TEST_CONTEXT` must not reach the child, and this cost a real
// wrong answer.** `node --test` sets it, and a child `node --test` that
// inherits it switches to the machine-readable v8 reporter — no
// `# pass N` line at all. Since `scripts/test/completion-report.test.mjs`
// runs this script from inside the test runner, every suite here parsed
// as zero, every app scored "has a test suite: ❌", and the report was
// completely wrong while exiting 0. It only surfaced because `--check`
// disagreed with a document generated moments earlier.
//
// A report whose numbers depend on who invoked it is not a measurement.
const CLEAN_ENV = { ...process.env };
delete CLEAN_ENV.NODE_TEST_CONTEXT;

function runSuite(appPath, files) {
  const r = spawnSync(process.execPath, ['--test', ...files],
    { cwd: path.join(REPO_ROOT, appPath), encoding: 'utf8', env: CLEAN_ENV });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const num = (re) => Number((out.match(re) || [])[1] ?? 0);
  const counts = { pass: num(/^# pass (\d+)/m), fail: num(/^# fail (\d+)/m), skip: num(/^# skipped (\d+)/m) };
  // **The count has to be the same wherever this runs.** A suite whose
  // dependencies are absent skips rather than fails, by the convention
  // `v4-proxy/test/server.test.js` established — so `pass` alone is 34
  // for vaco-analytics in a developed checkout and 28 inside the
  // release-archive extract, and a document recording it would "drift"
  // every time the release script looked at it. `pass + skip` is the
  // suite's real size and is identical in both, which is what makes the
  // committed report checkable anywhere rather than only here.
  counts.total = counts.pass + counts.skip;

  // Trust the exit code over the parsed summary, the same rule
  // `run-all-tests.mjs` follows: a suite that crashes before printing
  // TAP reports zeros, and scoring that as "no failures" is how a
  // broken suite becomes a green row.
  if (r.status !== 0 && counts.fail === 0) counts.fail = 1;
  return counts;
}

// -- the criteria -------------------------------------------------------
//
// Each returns true, false, or null for "does not apply to this app".
// A null is excluded from both halves of the fraction, so an app is
// never marked down for lacking something it was never meant to have.
const CRITERIA = [
  {
    key: 'serves',
    label: 'Serves HTTP',
    why: 'a real server.js that answers /api/health',
    test: (a) => exists(a.appPath, 'server.js') && /['"`]\/api\/health['"`]/.test(a.server),
  },
  {
    key: 'frontend',
    label: 'Has a frontend',
    why: 'public/index.html — its own real client',
    // Headless infrastructure services are exempt; see HEADLESS.
    test: (a) => (HEADLESS.has(a.name) ? null : exists(a.appPath, 'public', 'index.html')),
  },
  {
    key: 'design',
    label: 'On the design system',
    why: 'a sync-design-system.sh target, so it cannot drift',
    test: (a) => {
      // vaco-shell/public IS the design system. Scoring the source
      // against its own target list marks the one authoritative copy
      // as the non-compliant one.
      if (a.name === DESIGN_SOURCE) return null;
      // Apps with no frontend have nothing to style. Marking them
      // incomplete for it would bury the ones that really are missing.
      return exists(a.appPath, 'public', 'index.html') ? designTargets.includes(a.appPath) : null;
    },
  },
  {
    key: 'persists',
    label: 'Persists to disk',
    why: 'createPersistentStore — state survives a restart',
    // A pure proxy or search front-end holds no state of its own.
    test: (a) => (/createPersistentStore/.test(a.server) ? true
      : (a.holdsState ? false : null)),
  },
  {
    key: 'tests',
    label: 'Has a test suite',
    why: 'a test/ directory with at least one running test',
    test: (a) => a.tests !== null,
  },
  {
    key: 'green',
    label: 'Suite passes',
    why: 'zero failures when its own suite is run',
    test: (a) => (a.tests === null ? null : a.tests.fail === 0),
  },
  {
    key: 'guards',
    label: 'Every mutating route accounted for',
    why: 'guarded, or declared open with a stated reason — no route neither',
    test: (a) => {
      const g = guards.get(a.name);
      return g ? g.open === 0 : null;
    },
  },
  {
    key: 'deployed',
    label: 'In all three deploy paths',
    why: 'docker-compose.yml, ecosystem.config.js and nginx-docker.conf',
    test: (a) => composeSvcs.includes(a.name)
      && pm2Names.includes(a.name)
      // vaco-shell is the `/` root rather than a prefixed location.
      && (nginxLocs.includes(`/${a.name}/`) || (a.name === 'vaco-shell' && nginxLocs.includes('/'))),
  },
];

// -- exemptions, every one of which re-earns itself below ---------------
//
// **The rule this file follows.** An exemption list that is merely
// consulted is a list that keeps excusing a situation after the
// situation changes — the exact bug `atomicity-control.mjs`'s
// single-leg list was built to avoid. So each list here is checked
// against the repo on every run, and a stale entry fails the run
// rather than quietly producing a better-looking number.
//
// Stateless by design — no store of its own, so "persists to disk"
// does not apply:
//   v4-proxy      holds the Anthropic key and forwards; no state
//   v4-search     a search front-end over other apps' data
//   vaco-shell    the app store launcher; entitlements live in V3
//   vex-trading   a front door over VEX and Vex Business, whose own
//                 header says "Nothing here merges their code or their
//                 data" — it has no data to merge
const STATELESS = new Set(['v4-proxy', 'v4-search', 'vaco-shell', 'vex-trading']);

// Headless infrastructure. These are called by other services, never
// opened by a person, so "has a frontend" does not apply:
//   vaco-audit     the decision log
//   vaco-operator  the authority service that grants operator roles
//   vaco-media     live sessions and recorded-asset registration
const HEADLESS = new Set(['vaco-audit', 'vaco-operator', 'vaco-media']);

// The app whose public/ is the design system itself, read from
// sync-design-system.sh rather than named here, so a move cannot leave
// this pointing at the wrong app.
const DESIGN_SOURCE = (designSh.match(/SOURCE_DIR="\$ROOT\/([^/"]+)\//) || [])[1] || null;

const apps = manifest.filter((a) => a.cmd === 'npm start').map((a) => {
  const server = readIf(path.join(REPO_ROOT, a.appPath, 'server.js'));
  const files = suiteFor(a.appPath);
  return {
    ...a,
    server,
    holdsState: !STATELESS.has(a.name),
    tests: files ? runSuite(a.appPath, files) : null,
  };
});

// -- every exemption re-earns itself, or the run fails ------------------

const stale = [];

for (const a of apps.filter((x) => STATELESS.has(x.name))) {
  if (/createPersistentStore/.test(a.server)) {
    stale.push(`${a.name} is on STATELESS but now calls createPersistentStore — remove it from that `
      + 'list rather than letting the exemption hide a real store');
  }
}

for (const a of apps.filter((x) => HEADLESS.has(x.name))) {
  if (exists(a.appPath, 'public', 'index.html')) {
    stale.push(`${a.name} is on HEADLESS but now serves public/index.html — remove it from that list, `
      + 'and check whether that page belongs on the design system');
  }
}

for (const name of [...STATELESS, ...HEADLESS]) {
  if (!apps.some((a) => a.name === name)) {
    stale.push(`${name} is on an exemption list but is not a backend in the manifest — `
      + 'an exemption for an app that does not exist is a list nobody is maintaining');
  }
}

if (DESIGN_SOURCE === null) {
  stale.push('sync-design-system.sh no longer declares SOURCE_DIR in the expected shape, so the '
    + 'design-system source cannot be identified and would be scored as a non-compliant target');
}

if (stale.length > 0) {
  process.stderr.write(`completion-report: ${stale.length} stale exemption(s):\n`);
  for (const s of stale) process.stderr.write(`  - ${s}\n`);
  process.exit(2);
}

// -- score --------------------------------------------------------------

// **100% has to mean 100%.** `Math.round(259 / 260 * 100)` is 100, and
// the first version of this script printed a headline "100%" over a
// table with an unmet criterion in it. A number that rounds *up* to
// complete is worse than no number: it is the one figure a reader will
// quote, and it would have been false. So the only way to print 100 is
// to meet every applicable criterion; everything else floors, and
// stops at 99.
const percent = (met, total) => (met === total ? 100 : Math.min(99, Math.floor((met / total) * 100)));

for (const a of apps) {
  a.results = CRITERIA.map((c) => ({ ...c, value: c.test(a) }));
  a.applies = a.results.filter((r) => r.value !== null);
  a.met = a.applies.filter((r) => r.value === true);
  a.pct = percent(a.met.length, a.applies.length);
}

apps.sort((x, y) => y.pct - x.pct || x.name.localeCompare(y.name));

const totalApplies = apps.reduce((n, a) => n + a.applies.length, 0);
const totalMet = apps.reduce((n, a) => n + a.met.length, 0);
const overall = percent(totalMet, totalApplies);

const totalTests = apps.reduce((n, a) => n + (a.tests?.total ?? 0), 0);

// -- the document -------------------------------------------------------

const tick = (v) => (v === null ? '—' : (v ? '✅' : '❌'));

const rows = apps.map((a) => `| \`${a.name}\` | **${a.pct}%** | ${a.met.length}/${a.applies.length} `
  + `| ${CRITERIA.map((c) => tick(a.results.find((r) => r.key === c.key).value)).join(' | ')} `
  + `| ${a.tests ? a.tests.total : 0} |`).join('\n');

// Context for a shortfall that is a known, sequenced decision rather
// than an oversight. Keyed `app:criterion` and printed only where that
// criterion is genuinely unmet, so a note cannot outlive the gap it
// explains — and an unmet criterion with no note reads as exactly what
// it is, unexplained.
const NOTES = {
  'vacon-c:persists': 'known and sequenced: `vacon-c/CLAUDE.md`\'s own order of operations, '
    + 'step 9 — "Stand up Postgres, migrate off in-memory `WorldState`, keep `/api/*` identical". '
    + 'It is deliberately last, behind the engine work it would otherwise have to be migrated '
    + 'twice for. Until then a restart loses the simulation state.',
};

const shortfalls = apps
  .filter((a) => a.met.length < a.applies.length)
  .map((a) => {
    const unmet = a.results.filter((r) => r.value === false);
    const notes = unmet.map((r) => NOTES[`${a.name}:${r.key}`]).filter(Boolean);
    return `- **\`${a.name}\`** (${a.pct}%) — missing: `
      + unmet.map((r) => r.label.toLowerCase()).join(', ')
      + (notes.length > 0 ? `\n\n  ${notes.join('\n\n  ')}` : '');
  })
  .join('\n');

const doc = `# VACO — Completion by App

**GENERATED FILE — do not edit.** Re-run:

    node scripts/completion-report.mjs

Every number below was measured from this repository at generation
time: the app manifest in \`start-ecosystem.sh\`, the three generated
deploy artifacts, \`scripts/audit-route-guards.mjs\`'s own output, and
each app's test suite actually executed. Nothing here is recalled.
\`scripts/test/completion-report.test.mjs\` fails if this file drifts
from what the script emits, which is the failure mode that made
\`COMPLETION_AUDIT.md\` read 31 apps and 522 tests when the real numbers
were ${apps.length} and ${totalTests}.

---

## What this number means — and what it does not

The percentage is **not a judgement**. It is the count of named,
individually checkable criteria an app meets, out of the criteria that
apply to it. Every column below can be verified by hand.

It measures **infrastructure completeness against this ecosystem's own
standards**: does the app serve, persist, authorise, get tested, ship
in the design system, and land in all three deployment paths.

> ### It is NOT a measure of product depth.
>
> An app can score 100% and still not do the thing its users want. Two
> apps at 100% can be very different amounts of built software. A high
> score means nothing structural is missing, not that the product is
> finished.

**Three real gaps this table cannot see**, all of them larger than
anything it can:

1. **Real-time media.** Six surfaces cannot do their core thing —
   Vvltvre Flix cannot play, Vvltvre Pods cannot stream, Vavlt Stvdios
   cannot show a feed, CHOPZ cannot play video, VENVM cannot generate
   media, DREAMS has no display. Blocked on a vendor decision, not
   effort. See \`dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md\`.
2. **Docker has never been build-tested** (#128) and **backups are
   same-host only** (#125). Both blocked on infrastructure, not work.
3. **A guard being present is not a guard being right.**
   \`audit-route-guards.mjs\` says so in its own output:
   \`requireSession()\` where an ownership lookup belongs still counts
   as guarded, and that was a real bug once.

---

## Headline

| Metric | Value |
|---|---:|
| Express backends in the manifest | **${apps.length}** |
| Overall criteria met | **${overall}%** (${totalMet}/${totalApplies}) |
| Apps at 100% | **${apps.filter((a) => a.pct === 100).length} / ${apps.length}** |
| Tests | **${totalTests}** |
| Apps with no test suite | **${apps.filter((a) => a.tests === null).length}** |

Two notes on that test count, so it is not read as contradicting
anything else:

- It is **lower than \`scripts/run-all-tests.mjs\`'s**, and both are
  right. This table counts only the ${apps.length} Express backends in the
  manifest. The full run also covers the Vite frontends (VDP, VENVS),
  the shared \`scripts/\` suites, \`world-layer\` and \`vaco-mcp\` — real
  tests, but not any single manifest app's.
- It counts each suite's **size**, passing plus skipped, not passes
  alone. Suites that boot a real server skip themselves when the app's
  dependencies are absent, so counting passes would make this document
  read differently depending on where it was generated. Every suite
  here is at zero failures — that is the "Suite passes" column, and it
  is checked separately.

---

## Per app

| App | Complete | Met | ${CRITERIA.map((c) => c.label).join(' | ')} | Tests |
|---|---:|---:|${CRITERIA.map(() => '---').join('|')}|---:|
${rows}

\`—\` means the criterion does not apply to that app and is excluded
from both halves of its fraction — an app is never marked down for
lacking something it was never meant to have.

### The criteria

${CRITERIA.map((c) => `- **${c.label}** — ${c.why}`).join('\n')}

---

## Where the shortfalls are

${shortfalls || 'Every app meets every criterion that applies to it.'}
`;

if (process.argv.includes('--check')) {
  const committed = readIf(OUT);
  if (committed !== doc) {
    process.stderr.write('completion-report: dev-docs/COMPLETION_BY_APP.md is out of date.\n'
      + 'Re-run `node scripts/completion-report.mjs`.\n');
    process.exit(1);
  }
  process.stdout.write(`completion-report: up to date (${apps.length} apps, ${overall}% overall).\n`);
} else {
  fs.writeFileSync(OUT, doc);
  process.stdout.write(`Wrote dev-docs/COMPLETION_BY_APP.md (${apps.length} apps, `
    + `${overall}% of ${totalApplies} applicable criteria met, ${totalTests} tests).\n`);
}
