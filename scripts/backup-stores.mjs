#!/usr/bin/env node
// VACO — snapshot every app's persisted store to a destination outside
// the repository.
//
// **Why this exists.** Every claim this repo makes about money being
// correct assumes the data still exists. Until now there was no
// mechanism by which V3's ledger survived the loss of one disk, and no
// restore procedure to test. `dev-docs/COMPLETION_AUDIT.md` catalogued
// untested apps; it did not catalogue this, because nothing was broken
// — there was simply nothing there.
//
// **Why a plain copy is safe, and where that stops being true.**
// `lib/persistence.js` writes every store with write-to-temp-then-
// rename. `rename(2)` is atomic within a filesystem, so a reader either
// sees the whole previous file or the whole next one — never a
// half-written JSON document. That means this script does not need to
// stop any server, take a lock, or coordinate with a running process to
// get a *per-app* consistent copy.
//
// It does **not** give a consistent snapshot *across* apps, and that
// limit is real rather than theoretical. A VOID settlement moves VCoin
// in `v3` and then updates the job record in `void`. A backup running
// in between captures v3 post-transfer and void pre-update. On restore
// the money moved and the job looks unpaid.
//
// That is recorded rather than solved because solving it needs
// ecosystem-wide coordination that does not exist yet — see
// `dev-docs/DISASTER_RECOVERY.md` §"What this does not protect".
// The mitigation available today is cheap: back up often, and prefer a
// quiet moment. The real fix arrives with Postgres (Acceleration
// Matrix §12), where a single database has a single consistent
// snapshot.
//
// **Assert on the money, not on the bytes.** The manifest records a
// SHA-256 per file, which proves the bytes came back. For `v3` it also
// records account count, transaction count, and total VCoin in
// circulation, so `restore-stores.mjs` can verify the *ledger* came
// back — the same reason the test suites assert on balances rather than
// on a status. A corrupt-but-well-formed store would pass a checksum
// against itself and still be wrong; a ledger total is a second,
// independent witness.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kept outside the repository by default. A backup committed alongside
// the thing it backs up protects against nothing.
const DEFAULT_DEST = process.env.VACO_BACKUP_DIR
  || path.join(path.dirname(REPO_ROOT), 'vaco-backups');

const DEFAULT_KEEP = 30;

function parseArgs(argv) {
  const args = { dest: DEFAULT_DEST, keep: DEFAULT_KEEP, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dest') { args.dest = path.resolve(argv[i + 1]); i += 1; }
    else if (arg === '--keep') { args.keep = Number(argv[i + 1]); i += 1; }
    else if (arg === '--quiet') args.quiet = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.keep) || args.keep < 1) {
    throw new Error('--keep must be a positive integer');
  }
  return args;
}

const USAGE = `Usage: node scripts/backup-stores.mjs [options]

  --dest <dir>   Where snapshots go. Default: $VACO_BACKUP_DIR, else
                 ../vaco-backups (deliberately outside the repo).
  --keep <n>     Snapshots to retain. Default: ${DEFAULT_KEEP}.
  --quiet        Only print the snapshot path and errors.

Exits non-zero if any store fails to parse or fails to copy. A backup
that silently skipped a file is worse than no backup, because it is
believed.`;

// Every app that persists does so at <app>/data/store.json. Discovered
// rather than listed, so a new app built by the App Factory is backed
// up without anyone remembering to add it here.
//
// **Two levels deep, and the first version was one.** `chopz/chopz-shop`
// and `cvnvo/yap` are real apps that live inside another app's
// directory, and both persist. A depth-1 scan found neither, backed up
// everything else, and reported success -- so the backup was silently
// missing two stores, and the place that discovers that is a restore
// after data loss. A backup tool that is quietly incomplete is worse
// than one that is obviously broken.
//
// Nesting stops at two because that is the real shape of this repo; a
// third level would start walking node_modules and .venv for no reason.
const SKIP = new Set(['node_modules', 'data', 'public', 'test', 'dist', 'build', '.venv']);

function discoverStores() {
  const found = [];
  const scan = (relDir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(REPO_ROOT, relDir || '.'), { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const file = path.join(REPO_ROOT, rel, 'data', 'store.json');
      if (fs.existsSync(file)) found.push({ app: rel, file });
      if (depth > 0) scan(rel, depth - 1);
    }
  };
  scan('', 1);
  return found.sort((a, b) => a.app.localeCompare(b.app));
}

// A nested app's name is a path (`chopz/chopz-shop`), and a snapshot is
// a flat directory. Without flattening, `path.join(snapshotDir,
// 'chopz/chopz-shop.json')` writes into a subdirectory that does not
// exist. restore-stores.mjs applies the same transform, so the manifest
// keeps the real relative path -- which is what the restore has to
// write back to -- and only the filename is flattened.
export function snapshotFile(app) {
  return `${app.replace(/\//g, '__')}.json`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// A second witness on the money, independent of the checksum. If this
// summary is ever absent from a v3 snapshot, the snapshot is not
// trustworthy for the ledger even if its bytes verify.
function ledgerSummary(store) {
  const vcoin = store.vcoinBalances || {};
  const vash = store.vashBalances || {};
  const sum = (balances) => Object.values(balances)
    .reduce((total, amount) => total + (typeof amount === 'number' ? amount : 0), 0);
  return {
    vcoinAccounts: Object.keys(vcoin).length,
    vashAccounts: Object.keys(vash).length,
    // Rounded to the cent. Summing floats is order-dependent below
    // that, and a backup check that fails on 1e-14 trains people to
    // ignore it.
    totalVcoin: Math.round(sum(vcoin) * 100) / 100,
    totalVash: Math.round(sum(vash) * 100) / 100,
    transactionCount: Array.isArray(store.transactions) ? store.transactions.length : 0,
    nextTransactionId: store.nextTransactionId ?? null,
  };
}

function pruneOldSnapshots(dest, keep, log) {
  const snapshots = fs.readdirSync(dest, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}T\d{6}Z$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const doomed = snapshots.slice(0, Math.max(0, snapshots.length - keep));
  for (const name of doomed) {
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
    log(`  pruned ${name}`);
  }
  return doomed.length;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}\n`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const log = args.quiet ? () => {} : (line) => process.stdout.write(`${line}\n`);

  const stores = discoverStores();
  if (stores.length === 0) {
    process.stderr.write('backup-stores: found no */data/store.json to back up.\n');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const snapshotDir = path.join(args.dest, stamp);
  fs.mkdirSync(snapshotDir, { recursive: true });

  log(`backup-stores: ${stores.length} stores -> ${snapshotDir}`);

  const entries = [];
  const failures = [];

  for (const { app, file } of stores) {
    let raw;
    try {
      raw = fs.readFileSync(file);
    } catch (err) {
      failures.push(`${app}: unreadable (${err.message})`);
      continue;
    }

    // Verify before accepting. A backup of a corrupt file is a corrupt
    // backup that looks fine in a directory listing.
    let parsed;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch (err) {
      failures.push(`${app}: store.json does not parse (${err.message})`);
      continue;
    }

    const target = path.join(snapshotDir, snapshotFile(app));
    fs.writeFileSync(target, raw);

    // Read the copy back rather than trusting the write. Cheap, and it
    // is the only way this script can tell the difference between
    // "wrote it" and "it is on disk".
    const written = fs.readFileSync(target);
    const digest = sha256(raw);
    if (sha256(written) !== digest) {
      failures.push(`${app}: copy does not match source after write`);
      continue;
    }

    const entry = { app, bytes: raw.length, sha256: digest };
    if (app === 'v3') entry.ledger = ledgerSummary(parsed);
    entries.push(entry);
    log(`  ${app.padEnd(16)} ${String(raw.length).padStart(8)} bytes  ${digest.slice(0, 12)}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`backup-stores: FAILED ${failure}\n`);
    // Leave the partial snapshot in place: it is evidence, and deleting
    // the only copy of whatever did succeed on the way to reporting a
    // failure would be the wrong instinct.
    process.stderr.write(`backup-stores: ${failures.length} store(s) failed; snapshot at ${snapshotDir} is INCOMPLETE\n`);
    process.exit(1);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    snapshot: stamp,
    repoRoot: REPO_ROOT,
    storeCount: entries.length,
    entries,
  };
  const manifestPath = path.join(snapshotDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const pruned = pruneOldSnapshots(args.dest, args.keep, log);

  const ledger = entries.find((entry) => entry.app === 'v3')?.ledger;
  if (ledger) {
    log(`  v3 ledger: ${ledger.vcoinAccounts} accounts, ${ledger.transactionCount} transactions, ${ledger.totalVcoin} VCoin`);
  } else {
    log('  note: no v3 store found — the ledger is NOT in this snapshot');
  }
  log(`backup-stores: ok${pruned > 0 ? ` (pruned ${pruned} old snapshot${pruned === 1 ? '' : 's'})` : ''}`);

  if (args.quiet) process.stdout.write(`${snapshotDir}\n`);
}

main();
