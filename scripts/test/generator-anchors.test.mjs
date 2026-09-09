// The anchors every generator depends on, asserted against the real
// files they point into.
//
// **The failure class this exists for.** Three times now a generator or
// scanner in this repo has silently done nothing, or the wrong thing,
// while reporting success:
//
//   1. A scripted `str.replace()` whose pattern no longer matched the
//      line it was written against. `replace()` returns the string
//      unchanged when nothing matches — there is no error — so the edit
//      "succeeded" and `sync --check` then truthfully reported "all 43
//      copies current" because the app had never entered the list. It
//      surfaced as ERR_MODULE_NOT_FOUND at boot.
//
//   2. Two deploy generators scanning `lib/*.js` when every shared
//      module lands as `.cjs`. They read none of shieldAuth,
//      serviceAuth or decisionLog and emitted a confident, complete,
//      wrong answer.
//
//   3. `backup-stores.mjs` scanning one directory level deep when two
//      real apps are nested. It backed up everything else and printed
//      "ok" over a snapshot missing two stores.
//
// What links them is not the bug, it is the *reporting*: in every case
// the tool's own success message was the last word, and the gap only
// appeared much later and somewhere else. A tool that cannot tell the
// difference between "did the work" and "found nothing to do" will
// eventually claim the second while meaning the first.
//
// So: every anchor is checked here against the real file, and a rotted
// anchor is a test failure at the moment it rots rather than a silent
// no-op the next time someone runs the factory.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

// Comments stripped, because the first version of the substring test
// below failed on the comment *explaining* the substring bug. A check
// that cannot tell code from prose about code is the same too-loose
// match it was written to catch — so this repo's own rule applies to
// its own tests: match the thing, not something that mentions it.
const codeOnly = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

// -- scripts/new-app.mjs registration anchors -----------------------------
//
// Kept in the same order as `registrations()` in the factory. When one
// is edited there it must be edited here, which is the point: the pair
// makes a drifted anchor visible instead of silent.
const FACTORY_ANCHORS = [
  ['start-ecosystem.sh', /(\n)(\s*"venvs:venvs:)/],
  ['vaco-shell/lib/registry.js', /(\n)(\s*\{ id: 'voken',)/],
  ['sync-design-system.sh', '  v4-proxy v4-search cvnvo/yap\n'],
  ['sync-shared-runtime.sh', /(SHIELD_TARGETS=\([^)]*)\n\)/],
  ['vaco-shell/VACO_PALETTE_REGISTER.md', '| 78° | HVNTZ |'],
];

test('every App Factory registration anchor still matches its file', () => {
  for (const [file, anchor] of FACTORY_ANCHORS) {
    const source = read(file);
    const matches = typeof anchor === 'string' ? source.includes(anchor) : anchor.test(source);
    assert.ok(matches,
      `scripts/new-app.mjs anchors into ${file} with ${anchor}, which no longer matches. `
      + 'The factory would report success and register nothing.');
  }
});

test('the factory anchor list is the same length as the factory\'s own', () => {
  // A registration added to new-app.mjs without a line here would go
  // unchecked, which is how this file quietly stops being worth having.
  const factory = read('scripts/new-app.mjs');
  const declared = (factory.match(/^\s{6}file: '/gm) || []).length;
  assert.strictEqual(declared, FACTORY_ANCHORS.length,
    `new-app.mjs declares ${declared} registrations but this test checks ${FACTORY_ANCHORS.length}`);
});

// -- The narrow-filter class ----------------------------------------------

test('every tool that scans lib/ reads .cjs as well as .js', () => {
  // Shared modules are synced as `.cjs` (the ESM apps parse a bare
  // `.js` as ESM). A `.js`-only scan therefore reads none of them while
  // looking like it read everything.
  for (const file of ['deploy/generate-docker-compose.js', 'scripts/generate-service-tokens.mjs']) {
    const source = read(file);
    assert.ok(/\.cjs/.test(source),
      `${file} walks lib/ but never mentions .cjs — it would miss every shared module`);
  }
});

test('the service-credential scan distinguishes the singular var from the allowlist', () => {
  // `includes('VACO_SERVICE_TOKEN')` also matches `VACO_SERVICE_TOKENS`,
  // which is the *allowlist* a verifier reads, not a caller's own
  // credential. Conflating them issued caller tokens to pure verifiers
  // and left 21 of 22 verifiers with no allowlist at all — which in
  // `enforce` is a 401 on every mutating cross-app call, from a
  // container that looks healthy.
  for (const file of ['deploy/generate-docker-compose.js', 'scripts/generate-service-tokens.mjs']) {
    const source = codeOnly(read(file));
    assert.ok(/VACO_SERVICE_TOKEN\\b/.test(source),
      `${file} must match VACO_SERVICE_TOKEN with a word boundary, or it also matches the plural`);
    assert.ok(!/includes\(['"]VACO_SERVICE_TOKEN['"]\)/.test(source),
      `${file} still substring-matches VACO_SERVICE_TOKEN`);
  }
});

// -- Manifest-derived tools -----------------------------------------------

test('the tools that derive from start-ecosystem.sh all parse it non-empty', () => {
  // Every one of these reads the same manifest. If its shape changes,
  // a regex that silently returns nothing turns into a generator that
  // emits an empty config and exits 0.
  const manifest = read('start-ecosystem.sh');
  const block = manifest.match(/APPS=\(([\s\S]*?)\n\)/);
  assert.ok(block, 'the APPS array is no longer parseable — every generator reads it');

  const entries = block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('"'));
  assert.ok(entries.length > 25, `only ${entries.length} manifest entries parsed — the shape changed`);

  for (const line of entries) {
    const parts = line.slice(1, -1).split(':');
    assert.ok(parts.length >= 4, `manifest entry is not name:path:cmd:port — ${line}`);
    assert.ok(Number.isFinite(Number(parts[3])), `manifest entry has no numeric port — ${line}`);
  }
});

test('every app in the manifest exists on disk', () => {
  // A manifest naming a directory that is not there produces a
  // generator that skips it without complaint.
  const block = read('start-ecosystem.sh').match(/APPS=\(([\s\S]*?)\n\)/);
  const missing = block[1].split('\n')
    .map((l) => l.trim()).filter((l) => l.startsWith('"'))
    .map((l) => l.slice(1, -1).split(':')[1])
    .filter((appPath) => !fs.existsSync(path.join(REPO_ROOT, appPath)));
  assert.deepStrictEqual(missing, [], 'manifest names directories that do not exist');
});

// -- Sync coverage --------------------------------------------------------

test('sync-shared-runtime checks for unmanaged copies, not only managed ones', () => {
  // The UNUSED check only looks at apps already in a target list, so it
  // answers "is the copy I manage current?" truthfully while an app
  // holding an unmanaged copy sits outside its view. Both vaco-shell
  // (shieldAuth) and vaco-audit (serviceAuth) shipped that way.
  const sync = read('sync-shared-runtime.sh');
  // \b on both ends, because /UNMANAGED/ also matches UNMANAGEDX --
  // which is how the first version of this assertion passed against a
  // build with the check renamed out of existence.
  assert.ok(/\bUNMANAGED\b/.test(sync),
    'sync-shared-runtime.sh has no unmanaged-copy check — a frozen auth module would be invisible');
  assert.ok(/\bUNMANAGED\b[^\n]*-gt 0/.test(sync),
    'the unmanaged count must actually affect the exit status');
});
