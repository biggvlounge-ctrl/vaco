// Everything about the container build that can be checked without a
// container.
//
// **Why this exists.** `docker compose build` has never run — no
// network in this project's development environment reaches Docker Hub
// — and `SYSTEM_OF_RECORD.md` calls it the single largest untested
// step. That is an honest statement of risk, and it is also a large
// unknown to hand somebody. The last time container-only bugs were
// actually hunted, adding one district surfaced five, every one of them
// invisible on a laptop by construction.
//
// So this closes the gap between "never built" and "nothing checkable
// is wrong": the classes of failure that only appear inside an image,
// but whose *inputs* are all sitting in the repo. It does not replace
// the build. It means the specialist who runs the build first is
// debugging genuinely new information, not a missing `.dockerignore`.
//
// What it checks, and the container-only failure each one prevents:
//
//   contexts   a compose service whose build context has no
//              package.json, no start/build script, or no
//              .dockerignore. Without .dockerignore excluding
//              node_modules, `COPY . .` copies the *host's* modules
//              over the image's — shipping dev dependencies and
//              host-platform native binaries into a container that
//              installed neither.
//   stores     a persistent service whose store path resolves outside
//              its mounted volume. The app runs, writes, and loses
//              everything on restart — and nothing local can see it,
//              because locally there is no volume at all.
//   env        a compose variable with no default that is missing from
//              .env.example. `docker compose up` refuses to start and
//              the operator has no list of what to supply.
//   deps       a runtime file importing a package that is only in
//              devDependencies, or in no manifest at all.
//              `Dockerfile.node` runs `npm install --omit=dev`, so the
//              image is missing it and the container crashes at import
//              — while locally `node_modules` has everything.
//
// Usage: node scripts/deploy-preflight.mjs [--verbose]
//
// A clean run is a real result and is reported as one. A run that
// checks nothing must not report success, so it exits 2 if it cannot
// find services to check at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');
const problems = [];
const notes = [];

const read = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');
const compose = read('docker-compose.yml');

// -- the services compose actually builds ------------------------------
//
// Split on two-space-indented service keys. Anything with a `context:`
// is a build target; anything else (livekit, nginx from an image) is
// not this script's business.
function services() {
  const out = [];
  for (const block of compose.split(/\n {2}(?=[a-z0-9][\w-]*:\n)/)) {
    const name = /^\s*([a-z0-9][\w-]*):/.exec(block);
    const ctx = /context:\s*(\S+)/.exec(block);
    if (!name || !ctx) continue;
    out.push({
      name: name[1],
      dir: ctx[1].replace(/^\.\//, ''),
      // Quoted in the generated file: - "vacon_data:/app/data"
      mounts: [...block.matchAll(/-\s+"?([\w-]+):(\/[^"\s]+)"?/g)].map((m) => m[2]),
      block,
    });
  }
  return out;
}

const svcs = services();
if (svcs.length === 0) {
  process.stderr.write('deploy-preflight: found no build contexts in docker-compose.yml.\n'
    + 'A run that checks nothing must not report success.\n');
  process.exit(2);
}

// -- 1. build contexts --------------------------------------------------

for (const s of svcs) {
  const abs = path.join(REPO_ROOT, s.dir);
  if (!fs.existsSync(abs)) {
    problems.push(`${s.name}: build context ${s.dir} does not exist`);
    continue;
  }
  const pkgPath = path.join(abs, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    problems.push(`${s.name}: ${s.dir}/package.json is missing — the Dockerfile COPYs it before npm install`);
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  if (!scripts.start && !scripts.build) {
    problems.push(`${s.name}: neither a "start" nor a "build" script — both Dockerfiles need one`);
  }
  const di = path.join(abs, '.dockerignore');
  if (!fs.existsSync(di)) {
    problems.push(`${s.name}: no .dockerignore, so \`COPY . .\` will copy the host's node_modules `
      + 'into the image, over the ones npm install just produced');
  } else if (!/(^|\n)\s*node_modules\/?\s*(\n|$)/.test(fs.readFileSync(di, 'utf8'))) {
    problems.push(`${s.name}: .dockerignore does not exclude node_modules`);
  }
}

// -- 2. persistent stores land inside their volume ----------------------
//
// Two shapes in this repo, and the second is where a divergence could
// hide: a literal `path.join(__dirname, 'data', 'store.json')`, or a
// `STORE_PATH` const with an env override. WORKDIR is /app in both
// Dockerfiles, so `__dirname` is /app and the literal resolves to
// /app/data — which is what the volume mounts.
let persistent = 0;
for (const s of svcs) {
  const server = path.join(REPO_ROOT, s.dir, 'server.js');
  if (!fs.existsSync(server)) continue;
  const src = fs.readFileSync(server, 'utf8');
  const call = /createPersistentStore\(\s*([A-Za-z_$][\w$]*)\s*,/.exec(src)
    || /createPersistentStore\(\s*(path\.join\([^)]*\))/.exec(src);
  if (!call) continue;

  // A service with no mount that never persists is fine; one that
  // persists is not. Vite frontends share a directory with their API
  // sibling, so only complain when this service itself has a store AND
  // is the one running server.js.
  const runsServer = !/Dockerfile\.vite/.test(s.block);
  if (!runsServer) continue;
  persistent += 1;

  let resolved = call[1];
  if (!resolved.startsWith('path.join')) {
    const def = new RegExp(`${resolved}\\s*=\\s*([^;\\n]+)`).exec(src);
    resolved = def ? def[1] : resolved;
  }
  // Anything that ends up under a `data` directory relative to __dirname
  // is /app/data at runtime.
  const underData = /__dirname\s*,\s*['"]data['"]/.test(resolved);
  const mount = s.mounts.find((m) => m.replace(/\/$/, '').endsWith('/data'));

  if (!underData) {
    problems.push(`${s.name}: store path does not resolve under __dirname/data — ${resolved.trim().slice(0, 90)}`);
  } else if (!mount) {
    problems.push(`${s.name}: writes to /app/data but compose mounts no volume there — `
      + 'the store is lost on every container restart');
  } else if (verbose) {
    notes.push(`${s.name}: ${mount} <- __dirname/data`);
  }

  // An env override that compose points somewhere else would silently
  // move the store out of the volume.
  const envVar = /process\.env\.([A-Z][A-Z0-9_]*_STORE_PATH)/.exec(src);
  if (envVar) {
    const set = new RegExp(`${envVar[1]}:\\s*"?([^"\\n]+)"?`).exec(s.block);
    if (set && mount && !set[1].trim().startsWith(mount)) {
      problems.push(`${s.name}: compose sets ${envVar[1]}=${set[1].trim()}, which is outside the `
        + `mounted volume ${mount}`);
    }
  }
}

// -- 3. required env vars are documented --------------------------------

const required = [...new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)].map((m) => m[1]))];
let declared = new Set();
if (fs.existsSync(path.join(REPO_ROOT, '.env.example'))) {
  declared = new Set(read('.env.example').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split('=')[0].trim()));
} else {
  problems.push('.env.example is missing, and compose requires ' + required.length + ' variables with no default');
}
for (const v of required) {
  if (!declared.has(v)) {
    problems.push(`${v} has no default in docker-compose.yml and is not in .env.example — `
      + '`docker compose up` will refuse to start and say only the variable name');
  }
}

// -- 4. no runtime import of a dev-only or undeclared package -----------
//
// **Deliberately conservative about what counts as an import.** An
// earlier version matched `from '...'` anywhere in the file and
// reported seventeen findings, every one of them prose inside a comment
// ("a real third category, distinct from 'vdp-native'"). It now matches
// only a real statement at the start of a line, and skips comment
// lines outright. A checker that cries wolf gets ignored, which is
// worse than not having it.
const BUILTIN = new Set(('assert async_hooks buffer child_process cluster console constants crypto dgram '
  + 'diagnostics_channel dns domain events fs http http2 https inspector module net os path perf_hooks '
  + 'process punycode querystring readline repl stream string_decoder timers tls trace_events tty url '
  + 'util v8 vm wasi worker_threads zlib').split(' '));
const SKIP_DIR = new Set(['node_modules', 'test', 'tests', '__tests__', 'dist', 'coverage', 'public']);
const IMPORT_RE = /^\s*(?:import\s[^'"]*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:const|let|var)\s[^=]*=\s*require\(\s*['"]([^'"]+)['"]\s*\))/;

function sourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(d, e.name)); continue; }
      // `.jsx` is not runtime for a Dockerfile.node service — node
      // cannot require it without a build step, so an orphan prototype
      // component is not a missing runtime dependency.
      if (!/\.(js|cjs|mjs)$/.test(e.name)) continue;
      if (/\.(test|spec)\./.test(e.name)) continue;
      // Build-time config, never loaded by the server. Two apps keep a
      // Vite frontend and an API server in one directory, so the API
      // service's context sees its sibling's config.
      if (/^(vite|rollup|tailwind|postcss|eslint)\.config\./.test(e.name)) continue;
      out.push(path.join(d, e.name));
    }
  };
  walk(dir);
  return out;
}

for (const s of svcs) {
  const abs = path.join(REPO_ROOT, s.dir);
  const pkgPath = path.join(abs, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = new Set(Object.keys(pkg.dependencies || {}));
  const dev = new Set(Object.keys(pkg.devDependencies || {}));
  // The vite image installs dev dependencies on purpose — its build
  // stage runs `npm install`, not `--omit=dev`. Only the node image
  // drops them, so only it can be broken this way.
  if (/Dockerfile\.vite/.test(s.block)) continue;

  for (const f of sourceFiles(abs)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (const line of lines) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      const m = IMPORT_RE.exec(line);
      if (!m) continue;
      const spec = m[1] || m[2] || m[3];
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
      const top = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (BUILTIN.has(top) || deps.has(top)) continue;
      const rel = path.relative(REPO_ROOT, f);
      problems.push(dev.has(top)
        ? `${s.name}: ${rel} imports "${top}", which is a devDependency — `
          + '`npm install --omit=dev` leaves it out of the image'
        : `${s.name}: ${rel} imports "${top}", which is in no manifest — it will not be in the image`);
    }
  }
}

// -- report -------------------------------------------------------------

process.stdout.write(`deploy-preflight: ${svcs.length} build context(s), ${persistent} persistent service(s), `
  + `${required.length} required env var(s).\n`);
for (const n of notes) process.stdout.write(`    ok  ${n}\n`);

if (problems.length > 0) {
  process.stdout.write(`\n${problems.length} problem(s) that would only show up inside a container:\n`);
  for (const p of problems) process.stdout.write(`  - ${p}\n`);
  process.exit(1);
}
process.stdout.write('deploy-preflight: ok — nothing checkable without a registry is wrong.\n'
  + 'This does not mean the build passes. It means the first failure will be new information.\n');
