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

// ---------------------------------------------------------------------
// Postgres
//
// **This had the mirror of the bug `backup-stores.mjs` had.** It
// restored files and then printed "v3 ledger verified: 17 accounts,
// 15500 VCoin" — a summary of the file it had just written, while the
// live ledger in `vaco.v3_balances` sat untouched. On a Postgres
// deployment the whole restore would have been a no-op that announced
// success on the money, which on the worst day of somebody's year is
// the most expensive sentence in this repository.
//
// So: the snapshot says which backend it came from, and this refuses
// any combination where writing the files alone would leave a person
// believing the ledger came back when it did not.
//
//   snapshot has postgres + DATABASE_URL set    → restore both
//   snapshot has postgres + no DATABASE_URL     → refuse
//   snapshot is files-only + DATABASE_URL set   → refuse
//   snapshot is files-only + no DATABASE_URL    → restore files (as before)
//
// `--files-only` overrides the two refusals for the case where that is
// genuinely what is wanted — recovering one app's documents on a
// machine with no database in front of you. It is a flag rather than
// the default because the default has to be the safe reading.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPg() {
  const require_ = createRequire(import.meta.url);
  try { return require_('pg'); } catch { /* fall through */ }
  return require_(path.join(REPO_ROOT, 'vacon-c', 'node_modules', 'pg'));
}

// Same shape as backup-stores.mjs's, and for the same reason: Postgres
// returns NUMERIC as a string, so every amount goes through Number().
function ledgerSummaryFromRows(balances, transactions) {
  const of = (currency) => balances.filter((r) => r.currency === currency);
  const sum = (rows) => Math.round(
    rows.reduce((total, r) => total + Number(r.amount), 0) * 100) / 100;
  const vcoin = of('vcoin');
  const vash = of('vash');
  return {
    vcoinAccounts: vcoin.length,
    vashAccounts: vash.length,
    totalVcoin: sum(vcoin),
    totalVash: sum(vash),
    transactionCount: transactions.length,
    nextTransactionId: transactions.length
      ? Math.max(...transactions.map((t) => Number(t.id))) + 1
      : null,
  };
}

// One transaction for the whole restore. A half-restored ledger is
// worse than a failed one: it is a set of balances that never existed
// together, and nothing downstream would be able to tell.
async function restoreDatabase(databaseUrl, dump, log) {
  const { Pool } = loadPg();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [table, rows] of Object.entries(dump)) {
      if (rows === null) continue;
      const present = await client.query('SELECT to_regclass($1) AS oid', [table]);
      if (!present.rows[0].oid) {
        throw new Error(`${table} is in the snapshot but does not exist in this database. `
          + 'Start the apps once against it so the schema is created, then restore.');
      }
      await client.query(`DELETE FROM ${table}`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const params = cols.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${params})`,
          cols.map((c) => row[c]),
        );
      }
      log(`  restored ${table.padEnd(22)} ${String(rows.length).padStart(8)} rows`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Read the money back out of the database, not out of what we just
// parsed. The point of a second witness is that it is independent.
async function readLedgerFromDb(databaseUrl) {
  const { Pool } = loadPg();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const balances = await pool.query('SELECT * FROM vaco.v3_balances');
    const txns = await pool.query('SELECT * FROM vaco.v3_transactions');
    return ledgerSummaryFromRows(balances.rows, txns.rows);
  } finally {
    await pool.end();
  }
}

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
  --files-only   Restore the JSON files only, never the database. Refused
                 combinations below become warnings.

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
    else if (arg === '--files-only') args.filesOnly = true;
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

async function main() {
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

  // -- Which backend is this snapshot for, and which is in front of us?
  //
  // Decided before the dry-run output, so a dry run shows the same
  // refusal an apply would hit rather than looking fine and then failing
  // on the day it matters.
  const databaseUrl = process.env.DATABASE_URL;
  const snapshotHasDb = Boolean(manifest.postgres);
  let dbDump = null;

  if (!args.filesOnly) {
    if (snapshotHasDb && !databaseUrl) {
      process.stderr.write(
        'restore-stores: this snapshot contains a Postgres dump and DATABASE_URL is not set.\n'
        + `  It holds ${manifest.postgres.tables['vaco.stores'] ?? 0} app document(s) and `
        + `${manifest.postgres.tables['vaco.v3_balances'] ?? 0} ledger balance row(s).\n`
        + '  Restoring the files alone would leave every converted app reading a database\n'
        + '  this never wrote to. Set DATABASE_URL, or pass --files-only if that is really\n'
        + '  what you want.\n');
      process.exit(1);
    }
    if (!snapshotHasDb && databaseUrl) {
      process.stderr.write(
        'restore-stores: DATABASE_URL is set, but this snapshot has no Postgres dump in it.\n'
        + '  It predates the database (taken with backend "files"), so restoring it writes\n'
        + '  JSON files that the converted apps no longer read — the ledger would be\n'
        + '  untouched and this would report success. Take a new backup, or pass\n'
        + '  --files-only if you are deliberately recovering the pre-cutover files.\n');
      process.exit(1);
    }
  }

  if (snapshotHasDb && databaseUrl && !args.filesOnly) {
    const dumpPath = path.join(snapshotDir, manifest.postgres.file);
    const raw = fs.readFileSync(dumpPath);
    if (sha256(raw) !== manifest.postgres.sha256) {
      process.stderr.write(`restore-stores: ${manifest.postgres.file} does not match its recorded checksum.\n`);
      process.exit(1);
    }
    dbDump = JSON.parse(raw.toString('utf8'));
  }

  if (!args.apply) {
    for (const { entry } of verified) {
      const target = path.join(args.into, entry.app, 'data', 'store.json');
      const exists = fs.existsSync(target);
      process.stdout.write(`  would write ${entry.app.padEnd(16)} ${String(entry.bytes).padStart(8)} bytes`
        + `  ${exists ? '(overwrites existing)' : '(new file)'}`
        + `${entry.stale ? '  [stale — this app\'s live store is the database]' : ''}\n`);
    }
    if (dbDump) {
      for (const [table, rows] of Object.entries(dbDump)) {
        if (rows === null) continue;
        process.stdout.write(`  would replace ${table.padEnd(22)} ${String(rows.length).padStart(8)} rows\n`);
      }
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

  if (dbDump) {
    await restoreDatabase(databaseUrl, dbDump, (line) => process.stdout.write(`${line}\n`));
  }

  // -- Verify the money came back, not just the bytes ----------------
  //
  // **From the database when the database is the ledger.** Re-read out
  // of Postgres and compare against what the snapshot recorded, exactly
  // as the file path does — the version of this that only ever read the
  // file is what made a no-op restore print "v3 ledger verified".
  if (dbDump && manifest.postgres.ledger) {
    const after = await readLedgerFromDb(databaseUrl);
    const expected = manifest.postgres.ledger;
    const mismatches = Object.keys(expected)
      .filter((key) => after[key] !== expected[key])
      .map((key) => `${key}: expected ${expected[key]}, got ${after[key]}`);
    if (mismatches.length > 0) {
      process.stderr.write('restore-stores: THE LEDGER DID NOT COME BACK INTACT\n');
      for (const line of mismatches) process.stderr.write(`  ${line}\n`);
      process.exit(1);
    }
    process.stdout.write(`  v3 ledger verified (Postgres rows): ${after.vcoinAccounts} accounts, `
      + `${after.transactionCount} transactions, ${after.totalVcoin} VCoin\n`);
    process.stdout.write('restore-stores: ok\n');
    return;
  }

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

main().catch((err) => {
  process.stderr.write(`restore-stores: ${err.stack || err.message}\n`);
  process.exit(1);
});
