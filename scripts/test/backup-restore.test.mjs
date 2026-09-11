// Backup and restore — proven by round-tripping a real ledger, not by
// reading the scripts.
//
// **Why this file exists.** An untested backup is a belief. This repo
// already holds gates to that standard: a gate that is never exercised
// is assumed broken. A backup is the same kind of promise, and it is
// the one promise whose failure is unrecoverable — there is no second
// copy of the thing that was supposed to be the second copy.
//
// Everything here runs against a temporary directory laid out like the
// repo (`<app>/data/store.json`), never against the real one. A test
// that could overwrite the live V3 ledger to prove restore works would
// be a spectacularly bad trade.
//
// The failures targeted:
//
//   - a snapshot that silently skips a store, so the backup looks fine
//     in a listing and is missing an app
//   - a restore that writes corrupt or truncated data without noticing
//   - a restore that returns the right *bytes* but the wrong *money* —
//     the whole reason the manifest carries a ledger summary
//   - a dry run that writes anything at all
//   - a restore over a running server, which loses to the next flush

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BACKUP = path.join(SCRIPTS, 'backup-stores.mjs');
const RESTORE = path.join(SCRIPTS, 'restore-stores.mjs');

// A ledger with awkward numbers rather than round ones. 100.10 + 250.05
// + 49.85 = 400.00 exactly, but only if the summing is done with the
// rounding the scripts actually apply — which is the point.
function fixtureLedger() {
  return {
    idempotencyRecords: [],
    vcoinBalances: { ada: 100.10, rio: 250.05, 'void-platform': 49.85 },
    vashBalances: { ada: 12.5 },
    transactions: [
      { id: 1, from: 'ada', to: 'rio', amount: 25.05, reason: 'void_delivery_payout:courier:7' },
      { id: 2, from: 'rio', to: 'void-platform', amount: 4.95, reason: 'void_delivery_platform_fee:courier:7' },
    ],
    nextTransactionId: 3,
  };
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-backup-test-'));
  const write = (app, store) => {
    fs.mkdirSync(path.join(root, app, 'data'), { recursive: true });
    fs.writeFileSync(path.join(root, app, 'data', 'store.json'), JSON.stringify(store));
  };
  write('v3', fixtureLedger());
  write('void', { jobs: [{ id: 7, status: 'completed', settledTotal: 30 }], nextJobId: 8 });
  write('shield', { sessions: [{ token: 'abc', userId: 'ada' }] });
  // A nested app. `chopz/chopz-shop` and `cvnvo/yap` are real apps that
  // live inside another app's directory, and both persist. The original
  // discovery scan was one level deep, so it found neither, backed up
  // everything else and reported success -- a backup silently missing
  // two stores, discovered only during a restore after data loss.
  write('chopz/chopz-shop', { products: [{ id: 1, name: 'tee' }], nextProductId: 2 });
  // A directory with no store.json at all: several apps are like this,
  // and they must be skipped rather than reported as failures.
  fs.mkdirSync(path.join(root, 'dreams', 'data'), { recursive: true });
  return root;
}

// The scripts resolve the repo root from their own location, so to
// point them at a fixture we back up FROM a copy of the scripts placed
// inside it. Cheaper and more honest than adding a --from flag that
// only tests would ever use.
//
// **The environment is controlled, not inherited, and that is not
// tidiness.** Both scripts changed behaviour when `DATABASE_URL` is
// set: they read and write the real tables. `execFileSync` inherits
// `process.env` by default, so on any machine where a developer has
// exported `DATABASE_URL` -- which is every machine running the
// converted apps -- these fixture tests would have started talking to a
// real database instead of the temporary directory they were written
// for. The fixture tests are about files; they say so here.
function fileEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  if (!('DATABASE_URL' in extra)) delete env.DATABASE_URL;
  return env;
}

function backupFrom(repoRoot, dest, extra = [], env = fileEnv()) {
  fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });
  fs.copyFileSync(BACKUP, path.join(repoRoot, 'scripts', 'backup-stores.mjs'));
  return execFileSync(process.execPath,
    [path.join(repoRoot, 'scripts', 'backup-stores.mjs'), '--dest', dest, ...extra],
    { encoding: 'utf8', env });
}

function restore(args, env = fileEnv()) {
  return execFileSync(process.execPath, [RESTORE, ...args], { encoding: 'utf8', env });
}

function snapshotsIn(dest) {
  return fs.readdirSync(dest).filter((n) => /^\d{8}T\d{6}Z$/.test(n)).sort();
}

function latestManifest(dest) {
  const snaps = snapshotsIn(dest);
  return JSON.parse(fs.readFileSync(path.join(dest, snaps[snaps.length - 1], 'manifest.json'), 'utf8'));
}

// -- Backup -------------------------------------------------------------

test('a snapshot captures every store and skips directories that have none', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const manifest = latestManifest(dest);
  const apps = manifest.entries.map((e) => e.app).sort();

  assert.deepStrictEqual(apps, ['chopz/chopz-shop', 'shield', 'v3', 'void'],
    'every store present — nested apps included — and dreams/ (no store.json) correctly skipped');
  assert.strictEqual(manifest.storeCount, 4);
  // A backup that silently dropped a store would still produce a
  // manifest and a directory listing that looked healthy.
  for (const entry of manifest.entries) {
    assert.ok(entry.sha256 && entry.sha256.length === 64, `${entry.app} has a real digest`);
    assert.ok(entry.bytes > 0);
  }
});

test('the manifest records the ledger, not just the file', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const ledger = latestManifest(dest).entries.find((e) => e.app === 'v3').ledger;

  assert.strictEqual(ledger.vcoinAccounts, 3);
  assert.strictEqual(ledger.transactionCount, 2);
  assert.strictEqual(ledger.totalVcoin, 400,
    'the recorded total is the money, and it is the independent witness a checksum cannot be');
  assert.strictEqual(ledger.totalVash, 12.5);
  assert.strictEqual(ledger.nextTransactionId, 3);
});

test('a store that does not parse fails the backup rather than being copied quietly', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  fs.writeFileSync(path.join(repo, 'void', 'data', 'store.json'), '{"jobs": [tru');

  assert.throws(() => backupFrom(repo, dest), (err) => {
    // Non-zero exit is the contract: a cron job that ignores this is
    // storing corruption and believing it has a backup.
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr, /void: store\.json does not parse/);
    assert.match(err.stderr, /INCOMPLETE/);
    return true;
  });
});

test('--keep prunes old snapshots and keeps the newest', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);

  // Snapshots are stamped to the second, so fabricate older ones
  // directly rather than sleeping through three real seconds.
  backupFrom(repo, dest);
  const real = snapshotsIn(dest)[0];
  for (const stamp of ['20260101T000000Z', '20260102T000000Z', '20260103T000000Z']) {
    fs.cpSync(path.join(dest, real), path.join(dest, stamp), { recursive: true });
  }
  assert.strictEqual(snapshotsIn(dest).length, 4);

  backupFrom(repo, dest, ['--keep', '2']);
  const remaining = snapshotsIn(dest);
  assert.strictEqual(remaining.length, 2);
  assert.ok(remaining.includes(real) || remaining[remaining.length - 1] >= real,
    'pruning removes the oldest, never the newest');
});

// -- Restore ------------------------------------------------------------

test('a dry run writes absolutely nothing', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  fs.writeFileSync(path.join(target, 'v3', 'data', 'store.json'), '{"sentinel": true}');

  const out = restore(['--dest', dest, '--into', target]);
  assert.match(out, /Dry run\. Nothing was written/);
  assert.match(out, /would write/);

  assert.strictEqual(fs.readFileSync(path.join(target, 'v3', 'data', 'store.json'), 'utf8'),
    '{"sentinel": true}',
    'the default must never destroy state — the person running restore is having a bad day');
});

test('a restore brings the ledger back exactly, and says so on the money', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  // Simulate the disaster: the ledger is gone.
  fs.rmSync(path.join(target, 'v3', 'data', 'store.json'));

  const out = restore(['--dest', dest, '--into', target, '--apply']);

  const restored = JSON.parse(fs.readFileSync(path.join(target, 'v3', 'data', 'store.json'), 'utf8'));
  assert.deepStrictEqual(restored, fixtureLedger(),
    'every balance and every transaction, byte for byte');
  assert.match(out, /v3 ledger verified: 3 accounts, 2 transactions, 400 VCoin/);
  assert.match(out, /restore-stores: ok/);
});

test('a corrupted snapshot is refused, and nothing is written', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  // Flip one byte inside the snapshot — the classic silent bit-rot
  // case. The file still parses; only the checksum knows.
  const snap = path.join(dest, snapshotsIn(dest)[0]);
  const ledger = JSON.parse(fs.readFileSync(path.join(snap, 'v3.json'), 'utf8'));
  ledger.vcoinBalances.ada = 999999;
  fs.writeFileSync(path.join(snap, 'v3.json'), JSON.stringify(ledger));

  const target = makeRepo();
  const before = fs.readFileSync(path.join(target, 'v3', 'data', 'store.json'), 'utf8');

  assert.throws(() => restore(['--dest', dest, '--into', target, '--apply']), (err) => {
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr, /v3: checksum mismatch/);
    assert.match(err.stderr, /nothing was written/);
    return true;
  });

  assert.strictEqual(fs.readFileSync(path.join(target, 'v3', 'data', 'store.json'), 'utf8'), before,
    'verification happens before any write, so a bad snapshot cannot half-restore');
});

test('a truncated snapshot file is refused before it can overwrite anything', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const snap = path.join(dest, snapshotsIn(dest)[0]);
  fs.writeFileSync(path.join(snap, 'void.json'), '{"jobs": [{"id": 7');

  const target = makeRepo();
  assert.throws(() => restore(['--dest', dest, '--into', target, '--apply']), (err) => {
    assert.match(err.stderr, /void: checksum mismatch/);
    return true;
  });
});

test('--only restores one app and leaves the others alone', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  fs.writeFileSync(path.join(target, 'void', 'data', 'store.json'), '{"sentinel": true}');
  fs.rmSync(path.join(target, 'v3', 'data', 'store.json'));

  restore(['--dest', dest, '--into', target, '--only', 'v3', '--apply']);

  assert.ok(fs.existsSync(path.join(target, 'v3', 'data', 'store.json')), 'v3 came back');
  assert.strictEqual(fs.readFileSync(path.join(target, 'void', 'data', 'store.json'), 'utf8'),
    '{"sentinel": true}', 'void was not in scope and must be untouched');
});

test('restoring an app the snapshot never held is refused, not silently skipped', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  assert.throws(() => restore(['--dest', dest, '--into', target, '--only', 'voken', '--apply']),
    (err) => {
      assert.match(err.stderr, /snapshot has no store for: voken/);
      return true;
    });
});

test('a restore refuses while a server is still holding the store', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  // This process is definitely alive, which is the whole assertion.
  fs.mkdirSync(path.join(target, 'logs', 'pids'), { recursive: true });
  fs.writeFileSync(path.join(target, 'logs', 'pids', 'v3.pid'), String(process.pid));

  assert.throws(() => restore(['--dest', dest, '--into', target, '--apply']), (err) => {
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr, /still running/);
    assert.match(err.stderr, /stop-ecosystem\.sh/);
    return true;
  });

  // --force is the documented override, and it must actually work:
  // a guard with no escape hatch gets worked around in worse ways.
  const out = restore(['--dest', dest, '--into', target, '--apply', '--force']);
  assert.match(out, /restore-stores: ok/);
});

test('a stale pid file does not block a restore', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const target = makeRepo();
  fs.mkdirSync(path.join(target, 'logs', 'pids'), { recursive: true });
  // A pid that cannot be running. After a crash this is the normal
  // state, and refusing here would make the guard useless exactly when
  // it is needed most.
  fs.writeFileSync(path.join(target, 'logs', 'pids', 'v3.pid'), '2147483646');

  const out = restore(['--dest', dest, '--into', target, '--apply']);
  assert.match(out, /restore-stores: ok/);
});

test('--list reports the ledger totals of each snapshot', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const out = restore(['--dest', dest, '--list']);
  assert.match(out, /4 stores, 2 txns, 400 VCoin/,
    'a listing should let you pick a snapshot by what is in it, not just by its timestamp');
});

// -- Nested apps ---------------------------------------------------------

test('a nested app is backed up and restored like any other', () => {
  // The failure this pins down is not a crash: discoverStores() scanned
  // one level deep, so `chopz/chopz-shop` was never a candidate. The
  // backup then reported "ok" over a snapshot missing that store
  // entirely. Asserting on the restored *contents* rather than on the
  // exit status is what makes that visible.
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);

  const out = backupFrom(repo, dest);
  assert.match(out, /chopz\/chopz-shop/, 'a nested app must appear in the backup listing');

  // The snapshot directory is flat, so the name is flattened -- but the
  // manifest must keep the real relative path, because that is where a
  // restore has to write it back.
  const snapshot = path.join(dest, snapshotsIn(dest)[0]);
  assert.ok(fs.existsSync(path.join(snapshot, 'chopz__chopz-shop.json')),
    'the snapshot filename must be flattened, not written into a subdirectory');
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'));
  assert.ok(manifest.entries.some((e) => e.app === 'chopz/chopz-shop'),
    'the manifest must keep the real relative path');

  fs.writeFileSync(path.join(repo, 'chopz', 'chopz-shop', 'data', 'store.json'), '{"lost": true}');
  restore(['--dest', dest, '--into', repo, '--apply']);

  const restored = JSON.parse(
    fs.readFileSync(path.join(repo, 'chopz', 'chopz-shop', 'data', 'store.json'), 'utf8'),
  );
  assert.deepStrictEqual(restored, { products: [{ id: 1, name: 'tee' }], nextProductId: 2 },
    'a nested app must round-trip, not just appear in the listing');
});

// -- The database, and the day these scripts did not know about it -------
//
// **The failure these exist for, in full.** On 11 Sep 2026, 29 of the 34
// backends moved onto Postgres. `shared/storeBackend.js` then builds
// every converted app's store from `vaco.stores` and never touches
// `<app>/data/store.json` again, so the file on disk freezes at whatever
// it held on cutover day.
//
// Neither script knew. Driven on a real ecosystem with a real database
// attached, `backup-stores.mjs` copied 30 stale files, verified every
// checksum, wrote a manifest, and printed:
//
//     v3 ledger: 17 accounts, 21 transactions, 15500 VCoin
//     backup-stores: ok
//
// against a live ledger of 2 accounts, 1 transaction and 2000 VCoin. The
// ledger summary — this repo's own "assert on the money, not on the
// bytes" second witness — was summarising the wrong store, confidently.
// `restore-stores.mjs` had the mirror: it would have written the files,
// re-read the file it had just written, and reported the ledger
// verified while the database sat untouched.
//
// The first test below needs no database at all and is the most
// valuable of the set, because it is the check that would have caught
// the original bug on any machine.

// One unreachable URL. These tests assert that the scripts REFUSE
// before connecting, so the port never has to answer — and if a future
// change moves the refusal after the connection, the test fails with a
// connection error rather than passing quietly.
const UNREACHABLE = 'postgres://nobody@127.0.0.1:1/definitely-not-here';

function expectFailure(fn) {
  try {
    fn();
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`;
  }
  return null;
}

test('a files-only snapshot is refused when DATABASE_URL is set', () => {
  // The original bug, from the restore side: the snapshot predates the
  // database, so writing its files would leave the ledger untouched and
  // report success.
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  const output = expectFailure(() => restore(
    ['--dest', dest, '--into', repo, '--apply', '--force'],
    fileEnv({ DATABASE_URL: UNREACHABLE }),
  ));

  assert.ok(output, 'restoring a files-only snapshot with DATABASE_URL set must fail');
  assert.match(output, /no Postgres dump in it/,
    'the refusal must say why, not just exit non-zero');
  assert.doesNotMatch(output, /ECONNREFUSED|connect/i,
    'the refusal must happen before any connection attempt');
});

test('--files-only is the documented way past that refusal', () => {
  const repo = makeRepo();
  const dest = path.join(repo, '..', `dest-${path.basename(repo)}`);
  backupFrom(repo, dest);

  fs.writeFileSync(path.join(repo, 'void', 'data', 'store.json'), '{"lost": true}');
  restore(['--dest', dest, '--into', repo, '--apply', '--force', '--files-only'],
    fileEnv({ DATABASE_URL: UNREACHABLE }));

  const restored = JSON.parse(fs.readFileSync(path.join(repo, 'void', 'data', 'store.json'), 'utf8'));
  assert.strictEqual(restored.jobs[0].id, 7, '--files-only must still restore the files');
});

// **This test needs a real Postgres, and the first version of it did
// not — which is why it was worthless.** It drove the fixture repo,
// where `pg` is not installed, so `backup-stores.mjs` failed to load the
// driver and exited non-zero for that reason alone. Deleting the
// refusal it was meant to guard changed nothing: the test still passed.
// Caught by removing the refusal and watching the suite stay green.
//
// So it drives the REAL script against the REAL repo (read-only; the
// snapshot goes to a temp directory) pointed at an empty database. Then
// the only thing that can make it exit non-zero is the refusal.
const PG_URL = process.env.VACO_TEST_DATABASE_URL || process.env.DATABASE_URL;

// **`false`, not `null`, and that is not a style choice.** Node's test
// runner treats `skip` as set when it is anything other than
// `undefined` — so `{ skip: null }` skips the test. This was written
// with `null`, which meant the test below was silently skipped on
// exactly the machines that could run it, and reported as passing.
// Found by giving it a real database and noticing it still said SKIP.
let pgReason = false;
if (!PG_URL) {
  pgReason = 'no DATABASE_URL or VACO_TEST_DATABASE_URL — nothing to check the database path against';
}

test('the backup refuses to report success when the ledger tables are missing',
  { skip: pgReason }, () => {
    // A database with no `vaco` schema in it at all: every file the
    // script captures is then a pre-cutover copy, and printing `ok` over
    // that is the original bug.
    const empty = `${PG_URL.replace(/\/[^/]*$/, '')}/vaco_backup_test_empty`;
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'vaco-backup-empty-'));

    let admin;
    try {
      admin = execFileSync('psql', [PG_URL, '-tAc',
        "SELECT 1 FROM pg_database WHERE datname = 'vaco_backup_test_empty'"],
      { encoding: 'utf8' }).trim();
    } catch {
      return; // psql not available; the skip above could not know that
    }
    if (!admin) {
      execFileSync('psql', [PG_URL, '-c', 'CREATE DATABASE vaco_backup_test_empty'],
        { encoding: 'utf8' });
    }

    const output = expectFailure(() => execFileSync(
      process.execPath, [BACKUP, '--dest', dest],
      { encoding: 'utf8', env: fileEnv({ DATABASE_URL: empty }) },
    ));

    assert.ok(output,
      'DATABASE_URL set, no ledger tables in it, and the script reported success — '
      + 'every file in that snapshot is a pre-cutover copy');
    assert.match(output, /does not exist in it/,
      'the refusal must name what is missing');
    assert.doesNotMatch(output, /backup-stores: ok/,
      'it must not report success — that is the bug this whole section is about');
  });
