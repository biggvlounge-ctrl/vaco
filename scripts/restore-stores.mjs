#!/usr/bin/env node
// VACO — restore persisted stores from a snapshot made by
// `backup-stores.mjs`.
//
// **An untested backup is a belief, not a backup.** This repo holds
// gates to that standard everywhere else — a gate that is never
// exercised is assumed broken — and a backup deserves the same
// treatment. So this script exists as much to be *run in a test* as to
// be run in an emergency, and `test/restore.test.js` does exactly that
// on a temporary copy of the repo layout.
//
// **Dry run is the default, and that is deliberate.** Restore is the
// one operation here that destroys current state. The person running it
// is, by definition, having a bad day. Making them type `--apply` is
// one keystroke against overwriting a live ledger with a stale one.
//
// **Three things are verified before anything is written:**
//
//   1. every file named in the manifest is present in the snapshot
//   2. every file's SHA-256 matches what the manifest recorded
//   3. every file still parses as JSON
//
// And after writing, for `v3` only, the restored ledger is re-summarised
// and compared against the manifest's recorded account count,
// transaction count, and total VCoin. A checksum proves the bytes came
// back; the ledger summary is an independent second witness that what
// came back is money-shaped. Same reason the suites assert on balances
// rather than statuses.
//
// **What this does not do:** it does not stop running servers. A server
// holding a store in memory will overwrite a restored file on its next
// flush, and its in-memory copy is the stale one. Stop the ecosystem
// first — `./stop-ecosystem.sh` — and the script refuses loudly if it
// can tell that a server is up.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_DEST = process.env.VACO_BACKUP_DIR
  || path.join(path.dirname(REPO_ROOT), 'vaco-backups');

const USAGE = `Usage: node scripts/restore-stores.mjs [snapshot] [options]

  snapshot       Snapshot directory, or a bare stamp like 20260826T131500Z
                 resolved under the backup dir. Default: the newest.
  --dest <dir>   Backup dir to resolve a bare stamp against.
                 Default: $VACO_BACKUP_DIR, else ../vaco-backups.
  --into <dir>   Repo root to restore into. Default: this repo.
  --only <apps>  Comma-separated app names. Default: everything.
  --apply        Actually write. Without it this is a dry run.
  --list         List available snapshots and exit.
  --force        Restore even if a server looks like it is running.

Verifies checksums and JSON validity before writing anything, and
re-checks the v3 ledger totals after.`;

function parseArgs(argv) {
  const args = { dest: DEFAULT_DEST, into: REPO_ROOT, apply: false, only: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dest') { args.dest = path.resolve(argv[i + 1]); i += 1; }
    else if (arg === '--into') { args.into = path.resolve(argv[i + 1]); i += 1; }
    else if (arg === '--only') { args.only = argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean); i += 1; }
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--')) throw new Error(`unknown argument: ${arg}`);
    else if (!args.snapshot) args.snapshot = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

function listSnapshots(dest) {
  if (!fs.existsSync(dest)) return [];
  return fs.readdirSync(dest, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}T\d{6}Z$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function resolveSnapshot(args) {
  if (args.snapshot) {
    // An explicit path wins; otherwise treat it as a stamp under dest.
    const asPath = path.resolve(args.snapshot);
    if (fs.existsSync(path.join(asPath, 'manifest.json'))) return asPath;
    const asStamp = path.join(args.dest, args.snapshot);
    if (fs.existsSync(path.join(asStamp, 'manifest.json'))) return asStamp;
    throw new Error(`no manifest.json found for snapshot "${args.snapshot}"`);
  }
  const snapshots = listSnapshots(args.dest);
  if (snapshots.length === 0) throw new Error(`no snapshots found in ${args.dest}`);
  return path.join(args.dest, snapshots[snapshots.length - 1]);
}

// Mirrors backup-stores.mjs. A nested app (`chopz/chopz-shop`) is one
// name containing a slash; the snapshot directory is flat. The manifest
// keeps the real relative path, because that is where the restore has
// to write; only the snapshot filename is flattened.
function snapshotFile(app) {
  return `${app.replace(/\//g, '__')}.json`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Duplicated from backup-stores.mjs on purpose. If these two ever
// disagree the restore check is worthless, so the shape is small enough
// to read side by side, and `test/restore.test.js` pins the agreement
// by round-tripping a real ledger through both.
function ledgerSummary(store) {
  const vcoin = store.vcoinBalances || {};
  const vash = store.vashBalances || {};
  const sum = (balances) => Object.values(balances)
    .reduce((total, amount) => total + (typeof amount === 'number' ? amount : 0), 0);
  return {
    vcoinAccounts: Object.keys(vcoin).length,
    vashAccounts: Object.keys(vash).length,
    totalVcoin: Math.round(sum(vcoin) * 100) / 100,
    totalVash: Math.round(sum(vash) * 100) / 100,
    transactionCount: Array.isArray(store.transactions) ? store.transactions.length : 0,
    nextTransactionId: store.nextTransactionId ?? null,
  };
}

// A running server holds the store in memory and will flush over
// whatever we write — and its in-memory copy is the stale one, so the
// restore loses silently rather than loudly.
//
// Detected via the pid files `start-ecosystem.sh` records at
// logs/pids/<app>.pid. This is a best-effort guard, not a lock: a
// server started by hand leaves no pid file and will not be caught.
// That is why the check is a refusal with an override rather than a
// promise.
function looksLikeSomethingIsRunning(repoRoot) {
  const pidDir = path.join(repoRoot, 'logs', 'pids');
  if (!fs.existsSync(pidDir)) return null;
  const alive = [];
  for (const name of fs.readdirSync(pidDir)) {
    if (!name.endsWith('.pid')) continue;
    let raw;
    try {
      raw = fs.readFileSync(path.join(pidDir, name), 'utf8').trim();
    } catch {
      continue;
    }
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      process.kill(pid, 0); // signal 0 tests existence without touching it
      alive.push(`${name.replace(/\.pid$/, '')} (pid ${pid})`);
    } catch {
      // Not running. A stale pid file is normal after a crash, and
      // stop-ecosystem.sh removes them on a clean shutdown.
    }
  }
  return alive.length > 0 ? alive : null;
}

function writeAtomic(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.restore.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, filePath);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}\n`);
    process.exit(2);
  }
  if (args.help) { process.stdout.write(`${USAGE}\n`); return; }

  if (args.list) {
    const snapshots = listSnapshots(args.dest);
    if (snapshots.length === 0) {
      process.stdout.write(`No snapshots in ${args.dest}\n`);
    } else {
      process.stdout.write(`Snapshots in ${args.dest}:\n`);
      for (const name of snapshots) {
        const manifestPath = path.join(args.dest, name, 'manifest.json');
        let detail = '(no manifest — INCOMPLETE)';
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const ledger = manifest.entries.find((e) => e.app === 'v3')?.ledger;
          detail = `${manifest.storeCount} stores`
            + (ledger ? `, ${ledger.transactionCount} txns, ${ledger.totalVcoin} VCoin` : ', no v3');
        } catch { /* leave the INCOMPLETE marker */ }
        process.stdout.write(`  ${name}  ${detail}\n`);
      }
    }
    return;
  }

  let snapshotDir;
  try {
    snapshotDir = resolveSnapshot(args);
  } catch (err) {
    process.stderr.write(`restore-stores: ${err.message}\n`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'manifest.json'), 'utf8'));
  let entries = manifest.entries;
  if (args.only) {
    const wanted = new Set(args.only);
    const missing = args.only.filter((app) => !entries.some((e) => e.app === app));
    if (missing.length > 0) {
      process.stderr.write(`restore-stores: snapshot has no store for: ${missing.join(', ')}\n`);
      process.exit(1);
    }
    entries = entries.filter((e) => wanted.has(e.app));
  }

  process.stdout.write(`restore-stores: ${snapshotDir}\n`);
  process.stdout.write(`  taken ${manifest.createdAt}, ${entries.length} store(s) to restore\n`);

  // -- Verify everything before writing anything --------------------
  const verified = [];
  const problems = [];
  for (const entry of entries) {
    const source = path.join(snapshotDir, snapshotFile(entry.app));
    if (!fs.existsSync(source)) { problems.push(`${entry.app}: missing from snapshot`); continue; }
    const raw = fs.readFileSync(source);
    const digest = sha256(raw);
    if (digest !== entry.sha256) {
      problems.push(`${entry.app}: checksum mismatch (snapshot is corrupt)`);
      continue;
    }
    try {
      JSON.parse(raw.toString('utf8'));
    } catch (err) {
      problems.push(`${entry.app}: does not parse (${err.message})`);
      continue;
    }
    verified.push({ entry, raw });
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`restore-stores: FAILED ${problem}\n`);
    process.stderr.write('restore-stores: nothing was written.\n');
    process.exit(1);
  }
  process.stdout.write(`  verified ${verified.length} file(s): checksums match, all parse\n`);

  if (!args.apply) {
    for (const { entry } of verified) {
      const target = path.join(args.into, entry.app, 'data', 'store.json');
      const exists = fs.existsSync(target);
      process.stdout.write(`  would write ${entry.app.padEnd(16)} ${String(entry.bytes).padStart(8)} bytes`
        + `  ${exists ? '(overwrites existing)' : '(new file)'}\n`);
    }
    process.stdout.write('\nDry run. Nothing was written. Re-run with --apply to restore.\n');
    return;
  }

  const running = args.force ? null : looksLikeSomethingIsRunning(args.into);
  if (running) {
    process.stderr.write('restore-stores: these look like they are still running:\n');
    for (const line of running) process.stderr.write(`  ${line}\n`);
    process.stderr.write('A running server holds its store in memory and will flush over the\n'
      + 'restored file. Run ./stop-ecosystem.sh first, or pass --force.\n');
    process.exit(1);
  }

  for (const { entry, raw } of verified) {
    writeAtomic(path.join(args.into, entry.app, 'data', 'store.json'), raw);
    process.stdout.write(`  restored ${entry.app}\n`);
  }

  // -- Verify the money came back, not just the bytes ----------------
  const v3Entry = verified.find(({ entry }) => entry.app === 'v3');
  if (v3Entry?.entry.ledger) {
    const restored = JSON.parse(
      fs.readFileSync(path.join(args.into, 'v3', 'data', 'store.json'), 'utf8'),
    );
    const after = ledgerSummary(restored);
    const expected = v3Entry.entry.ledger;
    const mismatches = Object.keys(expected)
      .filter((key) => after[key] !== expected[key])
      .map((key) => `${key}: expected ${expected[key]}, got ${after[key]}`);
    if (mismatches.length > 0) {
      process.stderr.write('restore-stores: THE LEDGER DID NOT COME BACK INTACT\n');
      for (const line of mismatches) process.stderr.write(`  ${line}\n`);
      process.exit(1);
    }
    process.stdout.write(`  v3 ledger verified: ${after.vcoinAccounts} accounts, `
      + `${after.transactionCount} transactions, ${after.totalVcoin} VCoin\n`);
  } else {
    process.stdout.write('  note: no v3 ledger in this restore — nothing to verify on the money\n');
  }

  process.stdout.write('restore-stores: ok\n');
}

main();
