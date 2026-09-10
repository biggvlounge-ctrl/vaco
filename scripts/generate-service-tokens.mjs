#!/usr/bin/env node
// VACO — generate V3 trusted-service tokens for a real deployment.
//
// **Why this exists rather than "run openssl seventeen times".** V3's
// allowlist and each caller's own token have to agree exactly. Written
// by hand that is seventeen values copied into two different shapes —
// one `name:token` list and sixteen separate variables — and a single
// transposed character produces a container that boots healthy and
// 401s the first time money moves. Generating both sides from one
// source makes them consistent by construction.
//
// The caller list is read from `start-ecosystem.sh`, the same
// authoritative manifest every other generator uses, filtered to the
// apps whose source actually reaches V3. A hand-kept list of "who talks
// to V3" is one refactor away from being wrong.
//
//   node scripts/generate-service-tokens.mjs            # print to stdout
//   node scripts/generate-service-tokens.mjs --write    # write/update .env
//
// Tokens are 32 random bytes from `crypto.randomBytes`, hex-encoded —
// the same strength as `openssl rand -hex 32`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function appsFromManifest() {
  const manifest = fs.readFileSync(path.join(REPO_ROOT, 'start-ecosystem.sh'), 'utf8');
  const block = manifest.match(/^APPS=\(([\s\S]*?)^\)/m);
  if (!block) throw new Error('could not find the APPS array in start-ecosystem.sh');
  return [...block[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1].split(':'))
    .map(([name, appPath, command]) => ({ name, appPath, command }));
}

// An app needs a credential if its own source presents one. Checking
// for the constant the wiring actually uses means this cannot drift
// from the code the way a maintained list would.
//
// Two details that were both wrong here, and are the same two bugs the
// Compose generator carried:
//
//   `.cjs` counts. Every module sync-shared-runtime.sh copies lands as
//   `.cjs`, so a `.js`-only scan reads none of shieldAuth, serviceAuth
//   or decisionLog.
//
//   `\b` after TOKEN is load-bearing. Plain `includes` also matches
//   VACO_SERVICE_TOKENS -- the *allowlist* a verifier reads -- so every
//   app that merely checks credentials was being issued a caller token
//   it never presents.
function reachesV3(app) {
  const roots = [path.join(REPO_ROOT, app.appPath, 'server.js')];
  const libDir = path.join(REPO_ROOT, app.appPath, 'lib');
  try {
    for (const file of fs.readdirSync(libDir)) {
      if (file.endsWith('.js') || file.endsWith('.cjs')) roots.push(path.join(libDir, file));
    }
  } catch { /* no lib/ */ }

  for (const file of roots) {
    try {
      if (/process\.env\.VACO_SERVICE_TOKEN\b/.test(fs.readFileSync(file, 'utf8'))) return true;
    } catch { /* unreadable, skip */ }
  }
  return false;
}

const envVarName = (appName) => `VACO_TOKEN_${appName.toUpperCase().replace(/-/g, '_')}`;

// **A Node backend, identified by its entry point rather than by how
// its start command is spelled.** This read `command === 'npm start'`
// until the manifest changed those to `node server.js` to save a
// process per app, at which point it matched nothing.
//
// It failed loudly — "found no callers. That is almost certainly
// wrong." — and that guard is the reason this was a two-minute fix
// rather than eight apps silently getting 403 from V3 on every call,
// which is exactly what happened the last time this list was wrong.
const callers = appsFromManifest()
  .filter((app) => fs.existsSync(path.join(REPO_ROOT, app.appPath, 'server.js')))
  .filter((app) => app.name !== 'v3')
  .filter(reachesV3)
  .map((app) => app.name)
  .sort();

if (callers.length === 0) {
  process.stderr.write('generate-service-tokens: found no callers. That is almost certainly wrong.\n');
  process.exit(1);
}

// **`--list` prints just the caller names**, so a shell script can
// derive the same set instead of keeping a fourth copy of it.
// `start-ecosystem.sh` had a hand-maintained `VACO_CALLERS` holding 19
// names while this derivation found 27 — the same drift the
// `.env.example` block below was written to stop, in a third place. A
// local boot therefore allowlisted 19 services, and the other 8 got 403
// from V3 on every service call. Confirmed live: V3's own
// `/api/health` reported `allowlistedServices` of exactly 19.
if (process.argv.includes('--list')) {
  process.stdout.write(`${callers.join(' ')}\n`);
  process.exit(0);
}

const tokens = new Map(callers.map((name) => [name, crypto.randomBytes(32).toString('hex')]));

const lines = [
  `VACO_SERVICE_TOKENS=${callers.map((n) => `${n}:${tokens.get(n)}`).join(',')}`,
  ...callers.map((n) => `${envVarName(n)}=${tokens.get(n)}`),
];

const write = process.argv.includes('--write');

// -- .env.example: derived, not maintained -----------------------------
//
// **This block exists because the hand-kept version drifted, exactly as
// predicted three comments up.** `.env.example` listed sixteen callers
// while the derived list was nineteen — chopz-shop, vaco-analytics and
// vsafe had been wired since and nobody re-copied them. That is not a
// cosmetic gap: docker-compose marks each token `:?`, so an operator
// following `.env.example` to the letter gets a stack that refuses to
// start with an error naming a variable the file never told them about.
//
// The fix is the same one applied to the tokens themselves: derive both
// shapes from one source. `--example` rewrites the two blocks in place
// with empty values (it is a committed file — it must never hold a real
// secret), and `--check` fails if they have drifted, so CI catches the
// next wiring change instead of a deploy doing it.

const EXAMPLE_PATH = path.join(REPO_ROOT, '.env.example');
const exampleLines = [
  `VACO_SERVICE_TOKENS=${callers.map((n) => `${n}:`).join(',')}`,
  ...callers.map((n) => `${envVarName(n)}=`),
];

function renderExample(existing) {
  // Replace the whole run of VACO_TOKEN_* lines with the derived set,
  // anchored on the allowlist line above them, so added and removed
  // callers are both handled and the surrounding prose survives.
  const withList = existing.replace(/^VACO_SERVICE_TOKENS=.*$/m, exampleLines[0]);
  return withList.replace(
    /^VACO_TOKEN_[A-Z0-9_]*=.*(?:\n^VACO_TOKEN_[A-Z0-9_]*=.*)*$/m,
    exampleLines.slice(1).join('\n'),
  );
}

if (process.argv.includes('--example') || process.argv.includes('--check')) {
  const existing = fs.readFileSync(EXAMPLE_PATH, 'utf8');
  const next = renderExample(existing);

  if (process.argv.includes('--check')) {
    if (next !== existing) {
      process.stderr.write(
        '.env.example has drifted from the derived caller list '
        + `(${callers.length} callers: ${callers.join(', ')}).\n`
        + 'Run: node scripts/generate-service-tokens.mjs --example\n',
      );
      process.exit(1);
    }
    process.stdout.write(`.env.example matches the derived list of ${callers.length} callers.\n`);
    process.exit(0);
  }

  fs.writeFileSync(EXAMPLE_PATH, next);
  process.stdout.write(
    next === existing
      ? `.env.example already current (${callers.length} callers).\n`
      : `Rewrote .env.example for ${callers.length} callers:\n  ${callers.join(', ')}\n`,
  );
  process.exit(0);
}

if (!write) {
  process.stdout.write(`# ${callers.length} V3 service callers, generated ${new Date().toISOString()}\n`);
  process.stdout.write(`${lines.join('\n')}\n`);
  process.stdout.write('\n# Re-run with --write to update .env in place.\n');
  process.exit(0);
}

const envPath = path.join(REPO_ROOT, '.env');
let existing = '';
try {
  existing = fs.readFileSync(envPath, 'utf8');
} catch {
  // No .env yet. Start from the example so ANTHROPIC_API_KEY and the
  // explanatory comments survive, rather than writing a file that has
  // tokens and nothing else.
  try {
    existing = fs.readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf8');
    process.stdout.write('No .env found — starting from .env.example.\n');
  } catch { existing = ''; }
}

// Replace any existing assignment for each key, keeping everything
// else — comments, ANTHROPIC_API_KEY, anything an operator added.
let next = existing;
for (const line of lines) {
  const key = line.slice(0, line.indexOf('='));
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  next = pattern.test(next) ? next.replace(pattern, line) : `${next.replace(/\n*$/, '\n')}${line}\n`;
}

fs.writeFileSync(envPath, next);
process.stdout.write(`Wrote ${lines.length} values to .env for ${callers.length} callers:\n`);
process.stdout.write(`  ${callers.join(', ')}\n`);
process.stdout.write('\n.env is gitignored. These are real secrets — do not commit them.\n');
