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

// ---------------------------------------------------------------------
// Postgres, and the failure that made this section necessary
//
// **This script backed up stale files and reported `ok`.** On 11 Sep
// 2026, 29 of the 34 backends moved onto Postgres. When `DATABASE_URL`
// is set, `shared/storeBackend.js` builds the store from `vaco.stores`
// and never touches `<app>/data/store.json` again — so the file left on
// disk is whatever was there at cutover, frozen.
//
// This script only knew about those files. Driven on a real ecosystem
// with a real database attached, it copied 30 stale files, verified
// every checksum, wrote a manifest, and printed:
//
//     v3 ledger: 17 accounts, 21 transactions, 15500 VCoin
//     backup-stores: ok
//
// while the live ledger held 2 accounts, 1 transaction and 2000 VCoin
// in `vaco.v3_balances`. The ledger summary above — this file's own
// second witness, written precisely because "a corrupt-but-well-formed
// store would pass a checksum against itself and still be wrong" — was
// checking the wrong store. Self-consistent, and about a database that
// had not been read.
//
// A backup tool that is quietly incomplete is worse than one that is
// obviously broken, and this was worse still: it was quietly backing up
// a *different, older universe* and asserting on its money.
//
// So when `DATABASE_URL` is set this dumps the real tables too, and the
// ledger summary comes from wherever the ledger actually is.
//
// **What this still does not cover, stated rather than implied.**
// VACON-C's 63-table world schema is not in here. It is a different
// kind of data with a different restore path, and `pg_dump` is the
// right tool for it — pretending a JSON dump of three tables covers it
// would be the same class of error this section exists to fix.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The tables this knows how to snapshot. `vaco.stores` is the 28
// document-store apps; the two v3 tables are the row ledger.
//
// `v3_idempotency` is deliberately absent. Its rows expire within 24
// hours and exist to make a retry safe, not to record what happened —
// restoring them would re-arm claims for requests nobody is retrying
// any more, and omitting them costs a caller at most one duplicate
// refusal. Named here so the omission is a decision on the page rather
// than a table somebody forgot.
const DB_TABLES = ['vaco.stores', 'vaco.v3_balances', 'vaco.v3_transactions'];

function loadPg() {
  const require_ = createRequire(import.meta.url);
  // `pg` is a dependency of the converted apps rather than of the repo
  // root, so it is resolved the same way the test suites resolve it.
  try { return require_('pg'); } catch { /* fall through */ }
  return require_(path.join(REPO_ROOT, 'vacon-c', 'node_modules', 'pg'));
}

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

// The same second witness, read from the rows instead of the document.
//
// **The two shapes really are different and must not be merged.** The
// file store keeps `vcoinBalances` as an object of user -> number; the
// row ledger keeps one row per user per currency, and Postgres returns
// NUMERIC as a *string*, so `+` on it concatenates rather than adds.
// That is why every amount goes through `Number()` here.
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

// Dump the tables into one file in the snapshot. Returns what the
// manifest needs, and throws rather than returning a partial result —
// the caller treats a database failure as a failed backup, not as a
// backup without a database in it.
async function backupDatabase(databaseUrl, snapshotDir, log) {
  const { Pool } = loadPg();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const dump = {};
    for (const table of DB_TABLES) {
      // A table that does not exist is not an error: an ecosystem that
      // has never run V3 against this database has no v3_balances yet.
      // A table that exists and cannot be read IS an error, and the
      // distinction is the `to_regclass` check rather than swallowing
      // every failure.
      const present = await pool.query('SELECT to_regclass($1) AS oid', [table]);
      if (!present.rows[0].oid) {
        dump[table] = null;
        log(`  ${table.padEnd(22)} (absent)`);
        continue;
      }
      const { rows } = await pool.query(`SELECT * FROM ${table}`);
      dump[table] = rows;
      log(`  ${table.padEnd(22)} ${String(rows.length).padStart(8)} rows`);
    }

    const raw = Buffer.from(`${JSON.stringify(dump, null, 2)}\n`, 'utf8');
    const target = path.join(snapshotDir, 'postgres.json');
    fs.writeFileSync(target, raw);

    // Read it back, for the same reason the file path does.
    const digest = sha256(raw);
    if (sha256(fs.readFileSync(target)) !== digest) {
      throw new Error('postgres.json does not match what was written');
    }

    const balances = dump['vaco.v3_balances'];
    return {
      file: 'postgres.json',
      bytes: raw.length,
      sha256: digest,
      tables: Object.fromEntries(DB_TABLES.map((t) => [t, dump[t] ? dump[t].length : null])),
      // Only claim a ledger summary when the ledger rows are actually
      // there. An absent table means V3 is not on this database, and a
      // summary of zero would read as an empty ledger rather than as no
      // ledger.
      ledger: balances
        ? ledgerSummaryFromRows(balances, dump['vaco.v3_transactions'] || [])
        : null,
      appKeys: (dump['vaco.stores'] || []).map((r) => r.app_key).sort(),
    };
  } finally {
    await pool.end();
  }
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

async function main() {
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
  const databaseUrl = process.env.DATABASE_URL;

  const stores = discoverStores();
  // **Only a hard failure when there is nothing at all to back up.**
  // With a database attached, no store files is an ordinary state — a
  // fresh deployment that has only ever run on Postgres has none.
  if (stores.length === 0 && !databaseUrl) {
    process.stderr.write('backup-stores: found no */data/store.json to back up, '
      + 'and DATABASE_URL is not set, so there is no database to read either.\n');
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

  // -- the database ---------------------------------------------------
  //
  // After the files, so a database failure still leaves whatever the
  // file pass captured on disk as evidence.
  let database = null;
  if (databaseUrl) {
    log('  --');
    try {
      database = await backupDatabase(databaseUrl, snapshotDir, log);
    } catch (err) {
      failures.push(`postgres: ${err.message}`);
    }
  }

  // Files belonging to an app whose live store is in the database are
  // marked rather than dropped. They are still copied — an old copy of
  // a store is worth having and costs nothing — but a restore must not
  // mistake one for current, and neither must a person reading the
  // manifest.
  if (database) {
    const live = new Set(database.appKeys);
    for (const entry of entries) {
      if (live.has(path.basename(entry.app))) entry.stale = true;
    }
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
    // Recorded so a restore knows which backend this snapshot was taken
    // from without having to infer it from which files are present.
    backend: database ? 'postgres+files' : 'files',
    entries,
    postgres: database,
  };
  const manifestPath = path.join(snapshotDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const pruned = pruneOldSnapshots(args.dest, args.keep, log);

  // -- the ledger line, from wherever the ledger actually is ----------
  //
  // **This is the line that lied.** It read the v3 *file* unconditionally
  // and printed a confident account count and VCoin total, which stayed
  // confident and became false the moment V3 moved to Postgres. Now the
  // database wins when there is one, and the line says which store it
  // is describing so the number can never again be read as being about
  // the other one.
  const fileLedger = entries.find((entry) => entry.app === 'v3')?.ledger;
  const ledger = (database && database.ledger) || fileLedger;
  const source = database && database.ledger ? 'Postgres rows'
    : (fileLedger ? 'v3/data/store.json' : null);

  if (ledger) {
    log(`  v3 ledger (${source}): ${ledger.vcoinAccounts} accounts, `
      + `${ledger.transactionCount} transactions, ${ledger.totalVcoin} VCoin`);
  } else {
    log('  note: no v3 store found — the ledger is NOT in this snapshot');
  }

  // **A backup that did not read the live store must not say `ok`.**
  // With DATABASE_URL set and the ledger tables absent, every file this
  // captured is a pre-cutover copy, and printing success over it is the
  // exact failure this whole section was written for.
  if (databaseUrl && !(database && database.ledger) && fileLedger) {
    process.stderr.write(
      'backup-stores: DATABASE_URL is set, but vaco.v3_balances does not exist in it.\n'
      + `  The v3 file captured here reports ${fileLedger.totalVcoin} VCoin across `
      + `${fileLedger.vcoinAccounts} accounts.\n`
      + '  If V3 is running against this database, that file is a pre-cutover copy and\n'
      + '  this snapshot does NOT contain the live ledger. Refusing to report success.\n');
    process.exit(1);
  }

  log(`backup-stores: ok${pruned > 0 ? ` (pruned ${pruned} old snapshot${pruned === 1 ? '' : 's'})` : ''}`);

  if (args.quiet) process.stdout.write(`${snapshotDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`backup-stores: ${err.stack || err.message}\n`);
  process.exit(1);
});
