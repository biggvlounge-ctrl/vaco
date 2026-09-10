#!/usr/bin/env node
// Take a durable snapshot of the whole repository — and prove it
// restores before saying it worked.
//
// **Why this exists.** On 2026-09-08 this repository was lost
// completely: 444 commits, gone with an ephemeral container, because
// `git push` had been 403ing for a permission-scope reason and work
// carried on with commits landing locally only. `git commit` writes to
// a disk that can disappear. Until an object exists somewhere else, it
// exists once.
//
// `scripts/package-release.mjs` was not enough and could not have been.
// It builds `git archive HEAD` — the tracked files at one commit, with
// no history, no branches, and nothing to recover an earlier state
// from. Recovering from one is what cost every commit message and every
// intermediate state in September.
//
// A `git bundle` is the whole repository in one file: every commit,
// every branch, every tag. It is a real git remote — you clone from it.
// That is the artifact this produces.
//
// **And it proves it by restoring, because `verify` does not.** That
// is not a principle here, it was measured: fourteen bytes of garbage
// were written into the middle of a real bundle's pack, and
//
//     git bundle verify  →  "The bundle records a complete history."  exit 0
//     git clone          →  "pack has bad object ... inflate returned -3"  exit 128
//
// `verify` reads the header and the ref list. It will happily bless a
// file whose objects are shredded. So this clones the bundle into a
// scratch directory and checks the restored repository has the commit
// count, HEAD and file count it should. Same discipline as
// `package-release.mjs`, which extracts its own archive and runs the
// suite inside it: a tool that reports success without checking the
// thing it claims to have done is the failure class this repository
// keeps finding.
//
// Usage:
//   node scripts/snapshot.mjs              # bundle + verify by cloning
//   node scripts/snapshot.mjs --release    # also build the release tarball
//
// **The snapshot is not a backup until it leaves this machine.** A
// bundle sitting beside the repository it backs up protects against
// nothing — the same argument `dev-docs/DISASTER_RECOVERY.md` §6 makes
// about store snapshots, and the same one that was ignored about
// commits. Send it, sync it, download it. The script says so at the end
// rather than letting a green line read as "done".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, cwd = REPO_ROOT) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}):\n${out}`);
  }
  return `${r.stdout || ''}${r.stderr || ''}`;
}

const fail = (msg) => {
  process.stderr.write(`\nsnapshot: ${msg}\n`);
  process.exit(1);
};

// -- 1. Refuse to snapshot a tree that is not what it looks like -------
//
// Not a purity check. `git bundle` packages committed objects, so
// uncommitted work is simply absent from the file — and a snapshot that
// silently omits the last hour is worse than no snapshot, because it
// will be trusted.

const dirty = run('git', ['status', '--porcelain']).trim();
if (dirty) {
  fail('the working tree has uncommitted changes, and a bundle only carries committed objects.\n'
    + 'They would be missing from the snapshot and nothing would say so. Commit first:\n\n'
    + `${dirty.split('\n').map((l) => `    ${l}`).join('\n')}\n`);
}

const sha = run('git', ['rev-parse', '--short', 'HEAD']).trim();
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const commits = run('git', ['rev-list', '--count', 'HEAD']).trim();
const tracked = run('git', ['ls-files']).trim().split('\n').length;

process.stdout.write(`snapshot: ${branch} @ ${sha} — ${commits} commit(s), ${tracked} tracked file(s)\n`);

// -- 2. The bundle ------------------------------------------------------

const name = `vaco-full-history-${sha}.bundle`;
const bundlePath = path.join(REPO_ROOT, name);

// A stale bundle from an earlier HEAD sitting in the root is a file
// somebody will pick up believing it is current.
for (const f of fs.readdirSync(REPO_ROOT)) {
  if (/^vaco-full-history-.*\.bundle$/.test(f) && f !== name) {
    fs.rmSync(path.join(REPO_ROOT, f));
    process.stdout.write(`  removed  ${f} (superseded)\n`);
  }
}

run('git', ['bundle', 'create', bundlePath, '--all']);
const size = (fs.statSync(bundlePath).size / 1024 / 1024).toFixed(1);
process.stdout.write(`  built    ${name} (${size}MB)\n`);

// -- 3. Verify by restoring, not by asking ------------------------------

const verifyOut = run('git', ['bundle', 'verify', bundlePath]);
if (!/complete history/.test(verifyOut)) {
  fail(`\`git bundle verify\` does not report a complete history:\n${verifyOut}`);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-snapshot-'));
const restored = path.join(work, 'restored');
try {
  run('git', ['clone', '--quiet', '--branch', branch, bundlePath, restored], work);

  const rCommits = run('git', ['rev-list', '--count', 'HEAD'], restored).trim();
  const rSha = run('git', ['rev-parse', '--short', 'HEAD'], restored).trim();
  const rTracked = run('git', ['ls-files'], restored).trim().split('\n').length;

  if (rSha !== sha) fail(`the clone came up at ${rSha}, not ${sha}`);
  if (rCommits !== commits) fail(`the clone has ${rCommits} commits, the repository has ${commits}`);
  if (rTracked !== tracked) fail(`the clone has ${rTracked} tracked files, the repository has ${tracked}`);

  process.stdout.write(`  restored a real clone: ${rCommits} commit(s), ${rTracked} file(s), HEAD ${rSha}\n`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

// -- 4. Optionally the release tarball too ------------------------------
//
// Different artifact, different job. The bundle is for recovering the
// repository; the tarball is for handing somebody a deployable tree.
// Whoever is taking a snapshot because pushing is broken usually wants
// both.

if (process.argv.includes('--release')) {
  process.stdout.write('\n');
  const out = run(process.execPath, ['scripts/package-release.mjs']);
  process.stdout.write(out.split('\n').filter(Boolean).slice(-1)[0] + '\n');
}

// -- 5. Say the part that is not done yet -------------------------------

process.stdout.write(`\nsnapshot: ${name} is a complete, restore-tested copy of this repository.\n`);

// Ignored files are absent from the bundle too, and unlike uncommitted
// ones they never show up in `git status`. That is exactly how six real
// source files stayed untracked for two weeks. This does not block the
// snapshot — most ignored paths are node_modules and runtime stores,
// which genuinely do not belong — but it is printed, because the only
// way that class of loss gets noticed is somebody reading the list.
//
// Read *after* the artifacts are built, so the list describes what is
// on disk now rather than including a superseded bundle this run has
// already deleted.
const ignored = run('git', ['status', '--porcelain', '--ignored'])
  .split('\n').filter((l) => l.startsWith('!!')).map((l) => l.slice(3).trim())
  .filter((p) => p !== name && !p.endsWith('.bundle'));

if (ignored.length > 0) {
  process.stdout.write(`\n${ignored.length} path(s) are gitignored and therefore NOT in it:\n`);
  for (const p of ignored) process.stdout.write(`  - ${p}\n`);
  process.stdout.write('Runtime stores and node_modules belong on that list. Source does not —\n'
    + 'read it rather than skim it. Six real files hid there for two weeks.\n');
}

process.stdout.write('\nIt is not a backup yet. A snapshot beside the repository it backs up\n'
  + 'protects against nothing: get the file off this machine.\n');
