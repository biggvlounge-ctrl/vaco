// Which apps keep state where — measured from the tree, and the
// documents held to it.
//
// **Why this exists.** On 11 Sep 2026, 28 apps moved from a JSON file
// to the shared Postgres store backend. The counts in the documents
// were updated for the part that had grown ("29 of the 34 backends use
// Postgres") and left alone for the part that had shrunk. So four
// documents went on describing a file-backed remainder that no longer
// existed:
//
//   REPLIT.md         "The remaining 5 still use a JSON file"
//   REPLIT.md         "6 of the 34 apps keep state in JSON files on disk"
//   deploy/README.md  "Every app keeps its state in JSON files on disk"
//   deploy/README.md  "Every other app ... persists with createPersistentStore"
//
// The real number was 2. That is not a cosmetic error: the "not good
// for production" warning in REPLIT.md is calibrated on it, and so is
// the reader's decision about whether an autoscaling deployment is
// safe. A document that overstates the remaining work reads as a
// warning; one that understates it reads as permission.
//
// Deliberately narrow, like `deploy-readme.test.mjs`: it checks the
// counts, not the prose around them. The one exception is the pair of
// absolute claims below — "every app" is a count too, and it is the
// shape this drift took.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(REPO_ROOT, ...p));

// The same manifest every deploy generator reads, parsed the same way.
function manifestBackends() {
  const m = read('start-ecosystem.sh').match(/APPS=\(([\s\S]*?)\n\)/);
  assert.ok(m, 'start-ecosystem.sh no longer has an APPS=( ... ) manifest');
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => {
      const [name, appPath] = l.slice(1, -1).split(':');
      return { name, appPath };
    })
    // Backends are the entries with a server. The two Vite frontends
    // have none and keep no state of their own.
    .filter((a) => exists(a.appPath, 'server.js'));
}

// Four categories, because there genuinely are four and collapsing any
// two of them is how the documents went wrong.
//
//   pgShared  — `shared/storeBackend.js`: a document in `vaco.stores`.
//   pgOwn     — VACON-C, which has its own 63-table schema and is on
//               Postgres by a completely different route.
//   file      — still `createPersistentStore`: a JSON file on disk.
//   stateless — keeps nothing across a restart, by design.
//
// "On Postgres" is pgShared + pgOwn. "Survives an autoscaling
// deployment" is that same set, and `file` is the set that does not —
// which is the number a person deploying this actually needs.
function classify() {
  const out = { pgShared: [], pgOwn: [], file: [], stateless: [] };
  for (const app of manifestBackends()) {
    const server = read(path.join(app.appPath, 'server.js'));
    if (exists(app.appPath, 'lib', 'persistencePg.js') || /attachStore/.test(server)) {
      out.pgShared.push(app.name);
    } else if (exists(app.appPath, 'VACANCY_POSTGRESQL_SCHEMA.sql')) {
      out.pgOwn.push(app.name);
    } else if (exists(app.appPath, 'lib', 'persistence.js') || exists(app.appPath, 'persistence.js')) {
      out.file.push(app.name);
    } else {
      out.stateless.push(app.name);
    }
  }
  return out;
}

const BACKENDS = classify();
const TOTAL = BACKENDS.pgShared.length + BACKENDS.pgOwn.length
  + BACKENDS.file.length + BACKENDS.stateless.length;
const ON_POSTGRES = BACKENDS.pgShared.length + BACKENDS.pgOwn.length;

// Whitespace-normalised, for the same reason `deploy-readme.test.mjs`
// does it: these documents are hard-wrapped, so where a line break
// falls must not decide whether a claim gets checked.
function claims(re, within) {
  const flat = within.replace(/\s+/g, ' ');
  return [...flat.matchAll(new RegExp(re.source, `${re.flags}g`))];
}

test('the classification found a real ecosystem, not an empty set', () => {
  // A tool that finds nothing must not report success. Every assertion
  // below is vacuously true against an empty classification, so this
  // runs first and fails loudly instead.
  assert.ok(TOTAL > 30, `only ${TOTAL} backends classified — the manifest parse is broken`);
  assert.ok(BACKENDS.pgShared.length > 20,
    `only ${BACKENDS.pgShared.length} apps found on the shared Postgres backend — the detector is broken`);
  assert.deepEqual(BACKENDS.pgOwn, ['vacon-c'],
    'VACON-C is the one app with its own Postgres schema; this found something else');
});

test('every document states the real number of apps on Postgres', () => {
  let checked = 0;
  for (const doc of ['REPLIT.md', 'deploy/replit-boot.sh', 'SYSTEM_OF_RECORD.md']) {
    const src = read(doc);
    for (const m of claims(/(\d+) of the (\d+) backends/, src)) {
      checked += 1;
      assert.equal(Number(m[1]), ON_POSTGRES,
        `${doc} says ${m[1]} of the backends use Postgres; ${ON_POSTGRES} do`);
      assert.equal(Number(m[2]), TOTAL,
        `${doc} says there are ${m[2]} backends; the manifest has ${TOTAL}`);
    }
  }
  assert.ok(checked > 0, 'no document states the Postgres split any more — this test now checks nothing');
});

test('every document states the real number of apps still on files', () => {
  const n = BACKENDS.file.length;
  let checked = 0;
  for (const doc of ['REPLIT.md', 'SYSTEM_OF_RECORD.md', 'deploy/README.md']) {
    const src = read(doc);
    for (const m of claims(/(\d+) (?:of the \d+ )?(?:apps|backends) keep(?:s)? (?:their |its )?state in JSON files/, src)) {
      checked += 1;
      assert.equal(Number(m[1]), n,
        `${doc} says ${m[1]} apps keep state in JSON files; ${n} do (${BACKENDS.file.join(', ')})`);
    }
    for (const m of claims(/remaining (\d+) still use a JSON file/, src)) {
      checked += 1;
      assert.equal(Number(m[1]), n,
        `${doc} says ${m[1]} apps remain on a JSON file; ${n} do (${BACKENDS.file.join(', ')})`);
    }
  }
  assert.ok(checked > 0,
    'no document states how many apps are still file-backed — that is the number a person '
    + 'deploying this needs, so it should be stated somewhere and checked here');
});

test('no document claims every app is file-backed', () => {
  // The absolute form of the same drift, and the one a count-matching
  // regex cannot catch: prose that names no number is never wrong by
  // arithmetic, only by fact. Both of these sentences were true when
  // written and false the day the conversion landed.
  for (const doc of ['REPLIT.md', 'deploy/README.md', 'SYSTEM_OF_RECORD.md', 'deploy/replit-boot.sh']) {
    const flat = read(doc).replace(/\s+/g, ' ');
    for (const phrase of [
      /Every app keeps its state in JSON files/i,
      /Every other app in this ecosystem persists with `?createPersistentStore/i,
      // Not banned: "without a database everything falls back to a JSON
      // file per app". That one is still true — it describes the
      // fallback, not the configured state — and banning the phrase
      // rather than the claim would have forced a correct sentence out
      // of `deploy/replit-boot.sh`.
    ]) {
      assert.ok(!phrase.test(flat),
        `${doc} still says every app is file-backed; ${BACKENDS.file.length} of ${TOTAL} are `
        + `(${BACKENDS.file.join(', ')})`);
    }
  }
});
