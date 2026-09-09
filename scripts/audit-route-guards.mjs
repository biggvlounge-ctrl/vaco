#!/usr/bin/env node
// VACO — which requests can reach this handler, and who is allowed to
// be making them?
//
// **Why a script and not a careful reading.** That question is the one
// `dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md` says to ask
// of every route, and it is the one three separate security bugs in one
// session were hiding behind. It is also, uniquely among security
// questions, *mechanically answerable*: the answer is entirely
// contained in the argument list between the route path and the
// handler. Nothing about the domain logic changes it.
//
// So it should not be answered by reading 700 route definitions and
// hoping. Unit tests structurally cannot see it — they call library
// functions and never send a request — which is exactly why 464 tests
// were green while an unauthenticated POST drained wallets.
//
// **What this does and does not prove.**
//
//   It DOES prove: this route has *some* guard mounted, or it has none.
//   It does NOT prove: the guard is the *right* one.
//
// `requireSession()` on a route that needs an ownership lookup is the
// vxllage bug, and it counts as guarded here. That gap is deliberate —
// a script cannot know that `POST /villages/:id/articles` acts on
// someone else's village. What it can do is shrink the set a human has
// to think about from every route to the unguarded ones, and then keep
// it shrunk. Rule 4 of the standing instruction still applies to every
// route this leaves behind: send the request.
//
// Usage:
//   node scripts/audit-route-guards.mjs             # summary table
//   node scripts/audit-route-guards.mjs --list      # every unguarded route
//   node scripts/audit-route-guards.mjs --app vsafe # one app, in detail
//   node scripts/audit-route-guards.mjs --check     # CI: fail if any app's
//                                                   # unguarded count rose
//   node scripts/audit-route-guards.mjs --check            # CI: zero unaccounted

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The usage block above invites `| head`, and Node turns the resulting
// closed pipe into an unhandled 'error' event and a stack trace. Piping
// a report into head is not a failure.
process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); });

// Middleware that establishes *who is calling*. A route carrying any of
// these has had the question asked of it; a route carrying none has not.
// `express.json`, `cors` and friends are app-level and never appear in a
// route's argument list, so there is nothing to exclude.
//
// One convention, not a list of suffixes. Every guard in this codebase
// is named `require<Something>` — requireActor, requireSession,
// requireCheckInOwner, requireStayParty, requireFlightPassenger,
// requireListedParticipant, requireCallingService. An earlier version
// of this file enumerated the suffixes it had seen so far and quietly
// reported six real guards as missing the moment VACAY introduced new
// names for the same idea. A list that must be extended every time
// someone writes a guard is a list that will be wrong.
//
// The false-positive risk is a non-guard helper called
// `requireSomething` in a route's argument list. Nothing in this
// codebase does that, and the cost of being wrong that way (a route
// reported guarded when it is not) is real — so if the convention ever
// stops holding, this is the line to revisit, not to work around.
// A route declaring itself deliberately open, with the reason attached.
// The reason is mandatory: "open" with no argument is how this becomes
// a rubber stamp.
const DECLARED_OPEN_RE = /\/\/\s*audit-route-guards:\s*open\s*--\s*(.+)/;

const GUARD_PATTERNS = [
  /\brequire[A-Z]\w*\s*\(/,
  /\bactorOrService\s*\(/,
  /\bserviceAuth\b/,
];

// Mutating verbs only. A GET that leaks data is a real problem but a
// different one, with a different fix, and folding it in here would
// bury the signal — `void` alone would contribute 60 rows of listing
// endpoints that are correctly public.
//
// `app.` and `router.` both, because VACAY (62 routes) and anything
// else built from mounted routers is otherwise entirely invisible here
// — and an audit that silently reports zero for the app with the most
// money-moving routes is worse than no audit at all. That was the first
// thing this script got wrong about itself.
const ROUTE_RE = /\b(?:app|router)\.(post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2\s*,/g;

// App-level middleware guards *every* route beneath it, and no route's
// own argument list mentions it. V3 mounts `serviceAuth.middleware`
// this way, which is why a per-route scan alone reported its money
// endpoints as open. Detected separately and reported as such: an
// app-level service credential and a per-route actor check answer
// different questions, and one does not substitute for the other.
const APP_LEVEL_RE = /^\s*app\.use\(\s*(serviceAuth\.middleware|requireSession\(\)|\w*[Aa]uth\w*\.middleware)/m;

// Where the argument list ends and the handler begins. Handlers in this
// repo are consistently `(req, res)`, `(_req, res)` or an async form of
// either, so the first of those after the path is the boundary.
const HANDLER_RE = /(async\s*)?\(\s*_?req\s*,\s*res\b/;

function appsFromManifest() {
  const manifest = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = manifest.match(/^APPS=\(([\s\S]*?)^\)/m);
  if (!block) throw new Error('could not find the APPS array in start-ecosystem.sh');
  return [...block[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1].split(':'))
    .filter(([, , command]) => command === 'npm start')
    .map(([name, appPath]) => ({ name, appPath }));
}

// Every file that can define a route: the app's own server.js plus any
// router module under lib/. Walked rather than globbed for one level of
// nesting, because VACAY's live under lib/<product>/routes.js.
function routeFiles(appDir) {
  const files = [];
  const serverPath = path.join(appDir, 'server.js');
  if (fs.existsSync(serverPath)) files.push(serverPath);

  const libDir = path.join(appDir, 'lib');
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && depth > 0) walk(full, depth - 1);
      else if (entry.isFile() && /\.(js|cjs)$/.test(entry.name)) {
        // Cheap filter: only files that actually define routes.
        try {
          if (/\brouter\.(post|put|patch|delete|get)\(/.test(fs.readFileSync(full, 'utf8'))) {
            files.push(full);
          }
        } catch { /* unreadable */ }
      }
    }
  };
  walk(libDir, 2);
  return files;
}

function auditApp(app) {
  const appDir = path.join(REPO_ROOT, app.appPath);
  const files = routeFiles(appDir);
  if (files.length === 0) return null; // Not an express app.

  const serverSource = (() => {
    try { return fs.readFileSync(path.join(appDir, 'server.js'), 'utf8'); } catch { return ''; }
  })();
  const appLevelGuard = APP_LEVEL_RE.exec(serverSource)?.[1] ?? null;

  const routes = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(appDir, file);

    for (const match of source.matchAll(ROUTE_RE)) {
      const afterPath = source.slice(match.index + match[0].length);
      const handlerAt = afterPath.search(HANDLER_RE);
      // No recognisable handler start: the argument list runs past
      // anything this can reason about. Report it rather than guessing
      // — a silently skipped route is the failure mode of the whole
      // idea.
      const middleware = handlerAt === -1 ? null : afterPath.slice(0, handlerAt);

      // **Declared open, with a reason.** Some routes genuinely have no
      // actor to check -- Shield's own `login` cannot require a session
      // to create one, and an LLM proxy has no VACO principal at all.
      // Those used to sit in the "unguarded" column forever, which had
      // two bad effects: the percentage never meant anything, and a
      // route that was *accidentally* open looked exactly like one that
      // was deliberately open.
      //
      // So a route may declare itself, in a comment directly above it:
      //
      //     // audit-route-guards: open -- no actor exists; this creates the session
      //
      // A reason is required and is printed in the listing. Now every
      // route is guarded, declared, or unaccounted-for, and `--check`
      // fails on the third -- which is the only one that matters.
      const preceding = source.slice(0, match.index).split('\n').slice(-4).join('\n');
      const declared = DECLARED_OPEN_RE.exec(preceding);

      routes.push({
        method: match[1].toUpperCase(),
        routePath: match[3],
        file: rel,
        line: source.slice(0, match.index).split('\n').length,
        guards: middleware === null
          ? null
          : GUARD_PATTERNS.filter((p) => p.test(middleware)).length > 0,
        declaredOpen: declared ? declared[1].trim() : null,
        middleware: middleware === null ? '' : middleware.trim().replace(/,$/, ''),
      });
    }
  }

  return {
    name: app.name,
    routes,
    appLevelGuard,
    guarded: routes.filter((r) => r.guards === true).length,
    declaredOpen: routes.filter((r) => r.guards !== true && r.declaredOpen).length,
    unguarded: routes.filter((r) => r.guards === false && !r.declaredOpen).length,
    unparsed: routes.filter((r) => r.guards === null).length,
  };
}

const results = appsFromManifest().map(auditApp).filter(Boolean);

const args = process.argv.slice(2);
const only = args.includes('--app') ? args[args.indexOf('--app') + 1] : null;
const list = args.includes('--list');

if (only) {
  const app = results.find((r) => r.name === only);
  if (!app) {
    process.stderr.write(`audit-route-guards: no app named "${only}"\n`);
    process.exit(1);
  }
  process.stdout.write(`${app.name} — ${app.routes.length} mutating routes\n`);
  if (app.appLevelGuard) {
    process.stdout.write(
      `  app-level: ${app.appLevelGuard} — guards every route below, but proves\n`
      + '             the CALLER is known, not that the ACTOR is entitled.\n',
    );
  }
  process.stdout.write('\n');
  let currentFile = null;
  for (const r of app.routes) {
    if (r.file !== currentFile) {
      currentFile = r.file;
      process.stdout.write(`  ${currentFile}\n`);
    }
    const mark = r.guards === null ? '?' : r.guards ? 'ok' : '--';
    const guard = r.middleware ? ` ${r.middleware.replace(/\s+/g, ' ').slice(0, 60)}` : '';
    process.stdout.write(
      `    ${mark.padEnd(3)} ${r.method.padEnd(6)} ${r.routePath.padEnd(46)} :${r.line}${guard}\n`,
    );
  }
  const pct = app.routes.length ? Math.round((app.guarded / app.routes.length) * 100) : 100;
  process.stdout.write(`\n  ${app.guarded} guarded, ${app.unguarded} unguarded (${pct}%)\n`);
  process.exit(0);
}

// -- --check: a ratchet, not a threshold -------------------------------
//
// The point is not "guard 80% of routes". It is that an app which has
// been swept does not quietly slide back, and that a NEW route arrives
// guarded rather than being noticed months later. So the baseline
// records each app's open count and the check fails if any app's rises.
//
// It deliberately does not fail on a rise in the *total* route count:
// adding routes is normal work. It fails when the number of routes
// nobody has asked the question about goes up.

// **Zero unaccounted, always** -- not a ratchet against a baseline.
//
// The baseline existed because 45 routes were open with no way to say
// *why*, so the best available rule was "do not get worse." Now every
// route can declare itself with a reason, and the honest rule is
// absolute: a mutating route is either guarded or it states why it is
// not. A count that only has to not increase lets the next 45 in one
// at a time.
if (args.includes('--check') || args.includes('--update-baseline')) {
  if (args.includes('--update-baseline')) {
    process.stderr.write(
      'audit-route-guards: --update-baseline is gone. Every route is now either\n'
      + 'guarded or declared open with a reason:\n\n'
      + '    // audit-route-guards: open -- <why this route has no actor to check>\n\n'
      + 'There is no number to move any more.\n',
    );
    process.exit(2);
  }

  const unaccounted = results.flatMap((r) => r.routes
    .filter((route) => route.guards === false && !route.declaredOpen)
    .map((route) => `  ${r.name.padEnd(18)} ${route.method.padEnd(6)} ${route.routePath}  (${route.file}:${route.line})`));

  const unparsed = results.reduce((n, r) => n + r.unparsed, 0);

  if (unaccounted.length > 0) {
    process.stderr.write(
      `audit-route-guards: ${unaccounted.length} mutating route(s) are neither guarded nor declared open.\n\n`
      + `${unaccounted.join('\n')}\n\n`
      + 'Guard it, or -- if it genuinely has no actor to check -- say why in a\n'
      + 'comment directly above the route:\n\n'
      + '    // audit-route-guards: open -- <reason>\n\n'
      + 'The reason is mandatory. "open" on its own is how this becomes a rubber stamp.\n',
    );
    process.exit(1);
  }

  if (unparsed > 0) {
    process.stderr.write(
      `audit-route-guards: ${unparsed} route(s) could not be parsed, so nothing can be claimed\n`
      + 'about them. Inspect by hand.\n',
    );
    process.exit(1);
  }

  const guarded = results.reduce((n, r) => n + r.guarded, 0);
  const declared = results.reduce((n, r) => n + r.declaredOpen, 0);
  process.stdout.write(
    `audit-route-guards: all ${guarded + declared} mutating routes across ${results.length} apps `
    + `accounted for (${guarded} guarded, ${declared} declared open with a reason).\n`,
  );
  process.exit(0);
}

const totalRoutes = results.reduce((n, r) => n + r.routes.length, 0);
const totalGuarded = results.reduce((n, r) => n + r.guarded, 0);
const totalUnparsed = results.reduce((n, r) => n + r.unparsed, 0);

process.stdout.write(`audit-route-guards: ${results.length} express apps, ${totalRoutes} mutating routes\n\n`);
process.stdout.write(`  ${'app'.padEnd(20)} ${'guarded'.padStart(8)} ${'declared'.padStart(9)} ${'open'.padStart(6)}\n`);
process.stdout.write(`  ${'-'.repeat(20)} ${'-'.repeat(8)} ${'-'.repeat(9)} ${'-'.repeat(6)}\n`);

for (const app of [...results].sort((a, b) => b.unguarded - a.unguarded)) {
  if (app.routes.length === 0) continue;
  process.stdout.write(
    `  ${app.name.padEnd(20)} ${String(app.guarded).padStart(8)} ${String(app.declaredOpen).padStart(9)} ${String(app.unguarded).padStart(6)}`
    + `${app.appLevelGuard ? '  + app-level service credential' : ''}`
    + `${app.unparsed ? `  (${app.unparsed} unparsed)` : ''}\n`,
  );
}

const totalDeclared = results.reduce((n, r) => n + r.declaredOpen, 0);
const totalUnaccounted = results.reduce((n, r) => n + r.unguarded, 0);
const accounted = totalGuarded + totalDeclared;

process.stdout.write(
  `\n  ${totalGuarded} of ${totalRoutes} mutating routes carry a guard `
  + `(${Math.round((totalGuarded / totalRoutes) * 100)}%).\n`
  + `  ${totalDeclared} are declared open with a stated reason.\n`
  + `  ${accounted} of ${totalRoutes} accounted for `
  + `(${Math.round((accounted / totalRoutes) * 100)}%) — `
  + `${totalUnaccounted} route(s) are neither.\n`,
);
if (totalUnparsed > 0) {
  process.stdout.write(`  ${totalUnparsed} route(s) could not be parsed — inspect these by hand.\n`);
}

if (list) {
  process.stdout.write('\nUnaccounted routes (neither guarded nor declared):\n');
  for (const app of results) {
    const open = app.routes.filter((r) => r.guards === false && !r.declaredOpen);
    if (open.length === 0) continue;
    process.stdout.write(`\n  ${app.name} (${open.length})\n`);
    for (const r of open) {
      process.stdout.write(`    ${r.method.padEnd(6)} ${r.routePath.padEnd(52)} :${r.line}\n`);
    }
  }
}

process.stdout.write(
  '\nA guard here means *some* middleware asked who is calling. It does\n'
  + 'not mean the right one — requireSession() where an ownership lookup\n'
  + 'belongs counts as guarded, and that was a real bug. Send the request.\n',
);
