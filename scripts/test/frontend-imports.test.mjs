// Every relative import in the two Vite frontends must resolve to a
// file that actually exists.
//
// **The bug this was written for.** Commit `c7b1d7a` renamed
// `shieldAuth.js` to `shieldAuth.cjs` across the repo, for a real
// reason: `vaco-analytics` and `vaco-shell` are `"type": "module"`, so
// a CommonJS shared module must land as `.cjs` to load at all. The
// rename matched on filename, and caught two files that were never
// synced copies of anything -- `vdp/src/lib/shieldAuth.js` and
// `venvs/src/lib/shieldAuth.js`, each app's *own* browser-side ESM
// session client, which deliberately share the name per the
// documented VENVS/VDP split.
//
// The result: two ESM modules sitting in `.cjs` files, and roughly
// thirty importers across both apps still saying `./shieldAuth.js`.
// Both frontends stopped building entirely.
//
// **Nothing caught it, and that is the interesting part.** Neither
// Vite app had a test suite, and `vite build` is not in the
// verification set, so all seven checks passed -- 638 tests, 490
// routes, 80 shared copies, a byte-identical compose file -- while two
// of the thirty-six services could not build at all. The same sync
// script's `UNMANAGED` check even *names* these two files as
// deliberate exemptions, which is correct and which is exactly why it
// could not see that they had been broken.
//
// So this checks statically: parse the imports, resolve them the way
// the bundler does, and fail if a path points at nothing. Static on
// purpose -- it needs no `node_modules`, so it runs inside the release
// archive too, where a `vite build` cannot.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The two Vite apps. Named rather than discovered: "which directories
// are bundled frontends" is an architectural fact, and a heuristic
// that guessed it could quietly stop covering one.
const FRONTENDS = ['vdp', 'venvs'];

const SOURCE_RE = /\.(js|jsx|mjs)$/;
// Static `import ... from '...'`, side-effect `import '...'`, and
// dynamic `import('...')`. Only relative specifiers matter here --
// bare ones are npm packages and are the bundler's problem, not this
// check's.
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s+(?:[\w*{}\n\r\t, ]+\s+from\s+)?['"](\.[^'"]*)['"]|import\s*\(\s*['"](\.[^'"]*)['"]\s*\)/g;

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (SOURCE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

// Vite/rollup resolution for a relative specifier: exact path first,
// then the extensions it will try, then a directory index.
function resolves(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const ext of ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json']) {
    if (fs.existsSync(base + ext)) return true;
  }
  for (const idx of ['index.js', 'index.jsx', 'index.mjs']) {
    if (fs.existsSync(path.join(base, idx))) return true;
  }
  return false;
}

for (const app of FRONTENDS) {
  const root = path.join(REPO_ROOT, app, 'src');

  test(`${app}: every relative import resolves to a real file`, () => {
    assert.ok(fs.existsSync(root), `${app}/src does not exist -- this check is pointed at nothing`);

    const files = sourceFiles(root);
    assert.ok(files.length > 5, `${app}: found only ${files.length} source files -- the scan is broken`);

    const broken = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        if (!spec) continue;
        if (!resolves(file, spec)) {
          broken.push(`${path.relative(REPO_ROOT, file)} -> ${spec}`);
        }
      }
    }

    assert.deepEqual(
      broken, [],
      `${broken.length} import(s) point at files that do not exist. `
      + `The app cannot build.\n    ${broken.join('\n    ')}`,
    );
  });
}

// The specific file the rename broke, pinned by name in both apps.
// The check above would catch it again anyway; this one names it, so
// the next person to consider renaming these reads why not.
test('both frontends keep their own shieldAuth as .js, not .cjs', () => {
  for (const app of FRONTENDS) {
    const js = path.join(REPO_ROOT, app, 'src', 'lib', 'shieldAuth.js');
    const cjs = path.join(REPO_ROOT, app, 'src', 'lib', 'shieldAuth.cjs');

    assert.ok(fs.existsSync(js), `${app}/src/lib/shieldAuth.js is missing`);
    assert.ok(
      !fs.existsSync(cjs),
      `${app}/src/lib/shieldAuth.cjs exists. This is the app's own browser-side ESM `
      + 'session client, not a synced copy of shared/shieldAuth.js -- it shares the name '
      + 'deliberately, per the VENVS/VDP split. As .cjs it is an ESM file with a CommonJS '
      + 'extension that ~30 importers cannot find, and the app stops building.',
    );

    // It is ESM, which is the reason .cjs is wrong for it.
    const src = fs.readFileSync(js, 'utf8');
    assert.match(src, /^export /m, `${app}'s shieldAuth.js is not ESM -- re-read before trusting this`);
    assert.doesNotMatch(src, /module\.exports/, `${app}'s shieldAuth.js looks like CommonJS now`);
  }
});
