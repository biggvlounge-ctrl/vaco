#!/usr/bin/env node
// Build the deployable archive -- and then prove it is deployable.
//
// **Why the second half exists.** Producing a tarball is four lines.
// `tar` exits 0 on an archive that is missing the compose generator,
// carries a stale docker-compose.yml, or -- the one that actually
// matters -- contains a real `.env` full of live service tokens. Every
// one of those ships silently, and the failure surfaces on somebody
// else's machine, which is the exact failure class this repo keeps
// finding: a tool that reports success without checking the thing it
// claims to have done.
//
// So this script builds the archive, extracts it into a scratch
// directory, and runs the real verification suite *inside the extract*.
// Not against the working tree -- against the bytes a deployer will
// actually receive. If the tests pass here and fail there, the archive
// was the difference, and that is precisely what we want to catch.
//
// **What goes in.** `git archive` from HEAD: tracked files only. That
// is deliberate rather than convenient --
//
//   - `node_modules/` (273MB across the tree) is excluded. The Docker
//     path installs during build, and the local path has
//     `install-ecosystem.sh`. Shipping platform-specific binaries
//     inside a source archive is how a deploy breaks on a different
//     libc.
//   - `**/data/` runtime stores are excluded. They are somebody's live
//     state, not release content.
//   - `.env` is excluded, and asserted excluded. There is a real one in
//     this working tree with live tokens in it.
//
// Usage:
//   node scripts/package-release.mjs            # build, verify, report
//   node scripts/package-release.mjs --out DIR  # write somewhere else
//   node scripts/package-release.mjs --keep     # leave the extract for inspection

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const outDir = (() => {
  const i = args.indexOf('--out');
  return i === -1 ? REPO_ROOT : path.resolve(args[i + 1]);
})();
const keepExtract = args.includes('--keep');

// **Both streams, concatenated.** `execFileSync` returns stdout only,
// and several of these tools print their headline result to stderr --
// `generate-docker-compose.js` among them. Piping stderr without
// reading it just moved the problem: the console stopped showing the
// line and this script still could not see it. spawnSync hands back
// both.
function run(cmd, cmdArgs, cwd = REPO_ROOT) {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) {
    const err = new Error(`${cmd} ${cmdArgs.join(' ')} exited ${r.status}`);
    err.output = output;
    throw err;
  }
  return output;
}

// Set once the archive exists, so `fail` can take it away again.
let archiveToClean = null;

// **Nothing that failed verification is left on disk.**
//
// This used to delete only the extraction directory, and only the
// secret-scan refusal deleted the archive. So a run whose in-extract
// tests failed printed a loud error and left a finished-looking
// `.tar.gz` sitting in the repo root — which is precisely the artefact
// somebody would pick up and ship. Found by a real failure, not by
// reading.
function fail(msg) {
  let note = '';
  if (archiveToClean && fs.existsSync(archiveToClean)) {
    fs.unlinkSync(archiveToClean);
    note = `\n    Deleted ${path.basename(archiveToClean)} — an archive that failed `
      + 'verification must not be left where somebody can ship it.';
  }
  process.stderr.write(`\npackage-release: ${msg}${note}\n`);
  process.exit(1);
}

// -- 1. Refuse to package an ambiguous tree ------------------------------
//
// `git archive` reads HEAD, not the working tree. Packaging with
// uncommitted changes produces an archive that silently does not
// contain the work you just did -- and looks completely fine.

const dirty = run('git', ['status', '--porcelain']).trim();
if (dirty) {
  fail(
    'the working tree has uncommitted changes, and `git archive` packages HEAD.\n'
    + 'The archive would not contain them, and nothing would say so. Commit first:\n\n'
    + dirty.split('\n').map((l) => `    ${l}`).join('\n'),
  );
}

const commit = run('git', ['rev-parse', '--short', 'HEAD']).trim();
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const stamp = new Date().toISOString().slice(0, 10);
const name = `vaco-${stamp}-${commit}`;
const archivePath = path.join(outDir, `${name}.tar.gz`);
archiveToClean = archivePath;

process.stdout.write(`package-release: ${branch} @ ${commit}\n`);

// -- 2. Build ------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
run('git', ['archive', '--format=tar.gz', `--prefix=${name}/`, '-o', archivePath, 'HEAD']);

const bytes = fs.statSync(archivePath).size;
const entries = run('tar', ['-tzf', archivePath]).trim().split('\n');
const files = entries.filter((e) => !e.endsWith('/'));

process.stdout.write(
  `  built    ${path.relative(process.cwd(), archivePath)} `
  + `(${(bytes / 1024 / 1024).toFixed(1)}MB, ${files.length} files)\n`,
);

// -- 3. Nothing secret may be in it --------------------------------------
//
// Checked by pattern against the archive's own listing rather than by
// trusting .gitignore, because "it is ignored" and "it is absent from
// this tarball" are different claims and only the second one matters
// here. `.env.example` files are templates and must stay.

const SECRET_PATTERNS = [
  { re: /(^|\/)\.env$/, what: 'a real .env' },
  { re: /(^|\/)\.env\.(?!example)[^/]+$/, what: 'an environment file' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, what: 'a private SSH key' },
  { re: /\.(pem|p12|pfx|key)$/, what: 'a key or certificate' },
  { re: /(^|\/)\.npmrc$/, what: 'an npmrc (may carry a registry token)' },
  { re: /(^|\/)data\/store\.json$/, what: 'a live runtime store' },
];

const leaked = [];
for (const entry of files) {
  const rel = entry.slice(entry.indexOf('/') + 1);      // strip the prefix dir
  for (const { re, what } of SECRET_PATTERNS) {
    if (re.test(rel)) leaked.push(`${rel}  (${what})`);
  }
}
if (leaked.length) {
  fail(`the archive contains files that must never ship.\n    ${leaked.join('\n    ')}`);
}
process.stdout.write(`  clean    no secrets, keys or runtime stores in ${files.length} files\n`);

// -- 4. Everything a deployer needs must be in it ------------------------
//
// The mirror of the check above, and the one that catches an archive
// that is merely incomplete rather than dangerous. Each of these is a
// file the deploy procedure in SYSTEM_OF_RECORD.md §11 actually names.

const REQUIRED = [
  'README.md',
  'SYSTEM_OF_RECORD.md',
  'VACO.md',
  '.env.example',
  'docker-compose.yml',
  'deploy/generate-docker-compose.js',
  'deploy/Dockerfile.node',
  'install-ecosystem.sh',
  'start-ecosystem.sh',
  'stop-ecosystem.sh',
  'sync-shared-runtime.sh',
  'sync-design-system.sh',
  'scripts/run-all-tests.mjs',
  'scripts/audit-route-guards.mjs',
  'scripts/generate-service-tokens.mjs',
  'scripts/backup-stores.mjs',
  'scripts/restore-stores.mjs',
  'shared/shieldAuth.js',
  'shared/serviceAuth.js',
  'shared/decisionLog.js',
  'shared/operatorAuth.js',
  'shared/mediaClient.js',
  'dev-docs/DISASTER_RECOVERY.md',
];

const present = new Set(files.map((e) => e.slice(e.indexOf('/') + 1)));
const missing = REQUIRED.filter((f) => !present.has(f));
if (missing.length) fail(`the archive is missing files the deploy procedure needs:\n    ${missing.join('\n    ')}`);

// Every service compose builds must have its directory in the archive.
const compose = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf8');
const built = [...compose.matchAll(/^ {2}([a-z0-9-]+):\n {4}build:\n(?: {6}.*\n)*? {6}context: \.\/(\S+)/gm)]
  .map((m) => m[2]);
if (built.length < 30) fail(`only found ${built.length} build contexts in docker-compose.yml -- the scan is broken`);

const absentApps = built.filter((dir) => ![...present].some((f) => f.startsWith(`${dir}/`)));
if (absentApps.length) fail(`compose builds these but the archive has no source for them:\n    ${absentApps.join('\n    ')}`);
process.stdout.write(`  complete all ${REQUIRED.length} named files and all ${built.length} build contexts present\n`);

// -- 5. Extract and verify the bytes a deployer receives -----------------
//
// The whole point. Everything above reads the *listing*; this runs the
// contents. A file can be present and truncated, and a generated file
// can be present and stale -- neither shows up in a `tar -t`.

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-release-'));
const root = path.join(work, name);
run('tar', ['-xzf', archivePath, '-C', work]);

const checks = [
  ['compose regenerates identically', 'node', ['deploy/generate-docker-compose.js']],
  ['guard audit', 'node', ['scripts/audit-route-guards.mjs', '--check']],
  ['shared runtime', 'bash', ['./sync-shared-runtime.sh', '--check']],
  ['design system', 'bash', ['./sync-design-system.sh', '--check']],
  ['service tokens', 'node', ['scripts/generate-service-tokens.mjs', '--check']],
  ['test suite', 'node', ['scripts/run-all-tests.mjs']],
];

let lastLine = '';
for (const [label, cmd, cmdArgs] of checks) {
  let out;
  try {
    out = run(cmd, cmdArgs, root);
  } catch (err) {
    fs.rmSync(work, { recursive: true, force: true });
    fail(
      `"${label}" failed inside the extracted archive.\n`
      + 'It passes in the working tree, so the archive is the difference.\n\n'
      + String(err.output || err.message),
    );
  }
  // Prefer the last line carrying a number -- that is the line with the
  // count in it. A bare "ok" is a true summary and a useless one to
  // print next to a check whose whole value is the figure it produces.
  const lines = out.trim().split('\n').filter(Boolean);
  lastLine = [...lines].reverse().find((l) => /\d/.test(l)) || lines.pop() || '';
  process.stdout.write(`  verified ${label.padEnd(32)} ${lastLine}\n`);
}

// The generator ran inside the extract. If it rewrote the file, the
// committed docker-compose.yml was stale and the archive ships a
// compose file nobody generated from this source.
const regenerated = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
if (regenerated !== compose) {
  fs.rmSync(work, { recursive: true, force: true });
  fail('the archived docker-compose.yml differs from what its own generator produces -- it is stale.');
}

if (keepExtract) {
  process.stdout.write(`  kept     ${root}\n`);
} else {
  fs.rmSync(work, { recursive: true, force: true });
}

process.stdout.write(
  `\npackage-release: ${path.basename(archivePath)} is deployable `
  + `(${(bytes / 1024 / 1024).toFixed(1)}MB, ${files.length} files, verified by extraction).\n`,
);
