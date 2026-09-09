#!/usr/bin/env node
// VACO App Factory — scaffold a new app that inherits everything.
//
// **Why this exists.** The 30 apps in this repo converged on one shape
// because each was built by copying the last. That is why the shape is
// consistent, and also why `optionalOwnAccount`'s pass-through bug
// ended up in ten of them: a copied mistake is an ecosystem-wide
// mistake.
//
// This script was written immediately after building `vaco-notify` by
// hand, and the step list below is what that actually took — including
// the four steps that are easy to forget and produce a broken deploy
// weeks later rather than an error now:
//
//    1. directories + package.json          9. registry.js entry
//    2. .dockerignore                      10. start-ecosystem.sh manifest
//    3. lib/persistence.js                 11. sync-design-system targets
//    4. lib/shieldAuth.js                  12. sync-shared-runtime targets
//    5. lib/store.js                       13. palette register entry
//    6. server.js                          14. docker-compose regeneration
//    7. public/index.html                  15. nginx regeneration
//    8. a first test                       16. npm install
//
// **Thin wrappers, not copies.** `persistence.js` and `shieldAuth.js`
// are placed by their own sync scripts, so a fix to the canonical file
// reaches this app like every other. That is the difference between the
// factory and the copy-the-last-app habit it replaces: this one adds a
// participant to the sync, rather than a thirty-first divergent copy.
//
//   node scripts/new-app.mjs <name> [--port N] [--parent P] [--accent #RRGGBB]
//   node scripts/new-app.mjs <name> --dry-run
//   node scripts/new-app.mjs <name> --no-auth      # no route guarding
//
// The generated app boots, health-checks, smoke-passes in a browser,
// and its first test asserts a refusal — because a suite that only
// proves the happy path is how every gap in this repo survived.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage: node scripts/new-app.mjs <name> [options]

  --port N        Port. Default: one past the highest in the manifest.
  --parent P      Parent group for the registry. Default: the app name.
  --accent #HEX   Accent colour. Default: refuses, and tells you to pick
                  one against VACO_PALETTE_REGISTER.md.
  --no-auth       Skip shieldAuth wiring (an app with no mutating routes).
  --dry-run       Print what would change, write nothing.

Creates the app AND registers it everywhere: the manifest, the shell
registry, both sync scripts, the palette register, and the generated
deploy config.`;

function parseArgs(argv) {
  const args = { dryRun: false, auth: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port') { args.port = Number(argv[++i]); }
    else if (arg === '--parent') { args.parent = argv[++i]; }
    else if (arg === '--accent') { args.accent = argv[++i]; }
    else if (arg === '--no-auth') args.auth = false;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!arg.startsWith('--') && !args.name) args.name = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

function manifestEntries() {
  const block = read('start-ecosystem.sh').match(/^APPS=\(([\s\S]*?)^\)/m);
  if (!block) throw new Error('could not find the APPS array in start-ecosystem.sh');
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].split(':'));
}

// Derived, not asked for: the next free port after everything in the
// manifest. A hand-picked port that collides produces a DOWN in
// start-ecosystem.sh and a confusing hour.
function nextFreePort() {
  const used = manifestEntries().map(([, , , port]) => Number(port)).filter(Number.isFinite);
  return Math.max(...used.filter((p) => p >= 8787 && p < 9000)) + 1;
}

function assertUsable(name, port) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`"${name}" must be lowercase letters, digits and hyphens — it becomes a directory, a service name and a container name`);
  }
  if (fs.existsSync(path.join(REPO_ROOT, name))) {
    throw new Error(`${name}/ already exists`);
  }
  const taken = manifestEntries().find(([, , , p]) => Number(p) === port);
  if (taken) throw new Error(`port ${port} is already taken by ${taken[0]}`);
  const registry = read('vaco-shell/lib/registry.js');
  if (registry.includes(`id: '${name}'`)) throw new Error(`${name} is already in the shell registry`);
}

// -- Templates ------------------------------------------------------------

const files = (ctx) => ({
  'package.json': `${JSON.stringify({
    name: ctx.name,
    version: '1.0.0',
    description: ctx.description,
    main: 'server.js',
    scripts: { start: 'node server.js', test: 'node --test test/*.test.js' },
    engines: { node: '>=18' },
    dependencies: { cors: '^2.8.5', dotenv: '^16.4.5', express: '^4.19.2' },
  }, null, 2)}\n`,

  '.dockerignore': read('v3/.dockerignore'),

  'lib/store.js': `// ${ctx.Name} — the store factory.
//
// One factory whose shape grows by adding top-level array/counter
// fields as each module arrives. Every app in this ecosystem uses this
// pattern, and \`lib/persistence.js\` depends on it: it proxies whatever
// this returns, so the store must be a plain object built here rather
// than assembled across files.

function create${ctx.Pascal}Store() {
  return {
    items: [],
    nextItemId: 1,
  };
}

module.exports = { create${ctx.Pascal}Store };
`,

  'lib/items.js': `// ${ctx.Name} — the first domain module.
//
// Replace this with the real thing. Two properties are worth keeping
// whatever it becomes, because they are what the rest of this repo
// learned the hard way:
//
//   1. **Injected cross-app clients.** If this module needs another
//      app, take a function parameter (\`transferFn\`, \`fetchFn\`) rather
//      than requiring across app boundaries. There are zero cross-app
//      \`require\`s in this repo, and that is what lets Docker build each
//      app from its own directory.
//
//   2. **Refuse rather than default.** A missing field should throw,
//      not fall back. Several real bugs here came from a guard that
//      treated absence as permission.

function createItem(store, options = {}) {
  const { name, ownerId, now = Date.now() } = options;

  if (!name) throw new Error('createItem requires a name');
  if (!ownerId) throw new Error('createItem requires an ownerId');

  const item = { id: store.nextItemId++, name, ownerId, createdAt: now };
  store.items.push(item);
  return item;
}

function getItem(store, id) {
  return store.items.find((i) => i.id === id) || null;
}

function listItems(store) {
  return store.items;
}

module.exports = { createItem, getItem, listItems };
`,

  'server.js': `// ${ctx.Name} — ${ctx.description}
//
// Scaffolded by \`scripts/new-app.mjs\`. Everything below is the shape
// every app in this ecosystem shares; replace the domain, keep the
// wiring.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:${ctx.port}/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createPersistentStore, durable } = require('./lib/persistence');
const { create${ctx.Pascal}Store } = require('./lib/store');
const { createItem, getItem, listItems } = require('./lib/items');${ctx.auth ? `
const { requireActor } = require('./lib/shieldAuth');` : ''}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || ${ctx.port};
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), create${ctx.Pascal}Store);

// Commits to disk before responding on every 2xx mutating request. Not
// optional: without it an acknowledged write can be lost to a \`kill -9\`
// inside the debounce window, which was demonstrated rather than
// reasoned about — see lib/persistence.js.
app.use(durable(store));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: '${ctx.name}', items: store.items.length });
});

app.get('/api/items', (_req, res) => {
  res.json({ items: listItems(store) });
});

app.get('/api/items/:id', (req, res) => {
  const item = getItem(store, Number(req.params.id));
  if (!item) return res.status(404).json({ error: \`no item with id \${req.params.id}\` });
  res.json(item);
});

${ctx.auth ? `// \`requireActor\` — NOT \`requireSession\`. It proves a live Shield
// session AND that the session belongs to the user this request claims
// to act as. Every mutating route that names an acting user needs it;
// authentication without that second check is how a stranger's wallet
// got drained. See dev-docs/AUTH_HARDENING.md.
app.post('/api/items', requireActor('ownerId'), (req, res) => {` : `app.post('/api/items', (req, res) => {`}
  try {
    res.status(201).json(createItem(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(\`${ctx.Name} listening on http://localhost:\${PORT}\`);
  console.log(\`Health check: curl http://localhost:\${PORT}/api/health\`);
});
`,

  'public/index.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ctx.Name}</title>
<link rel="stylesheet" href="/vaco-design.css" />
</head>
<body class="vaco">
<script src="/vaco-ui.js"></script>
<script>
// ${ctx.Name} — ${ctx.description}
//
// \`VACO.api\` attaches the Shield session token automatically, which is
// why a write from this page satisfies requireActor without any header
// handling here.

var el = VACO.el;

function renderItems(body) {
  var out = el('div', 'vaco-stack');

  out.appendChild(VACO.card('Create an item', [
    VACO.form([
      { name: 'name', label: 'Name', width: '200px' },
      { name: 'ownerId', label: 'Owner', value: VACO.userId() || '', width: '160px' },
    ], function (values) {
      return VACO.post('/api/items', values).then(function (item) {
        VACO.toast('Created item ' + item.id + '.');
        return renderItems(body);
      });
    }, 'Create'),
  ]));

  return VACO.api('/api/items').then(function (data) {
    out.appendChild(VACO.card('Items', [
      data.items.length === 0
        ? el('p', 'vaco-small vaco-dim', 'Nothing yet.')
        : VACO.table([
          { key: 'id', label: 'Id' },
          { key: 'name', label: 'Name' },
          { key: 'ownerId', label: 'Owner' },
        ], data.items),
    ]));
    return VACO.mount(body, out);
  });
}

VACO.app({
  id: '${ctx.name}',
  name: '${ctx.Name}',
  tagline: '${ctx.description}',
  //: Registered in vaco-shell/VACO_PALETTE_REGISTER.md. Per-app identity
  //: is colour only — the shared layer owns structure.
  accent: '${ctx.accent}',
  accentDim: '${ctx.accentDim}',
  accentInk: '${ctx.accentInk}',
  tabs: [
    { id: 'items', label: 'Items', heading: '${ctx.Name}', render: renderItems },
  ],
});
</script>
</body>
</html>
`,

  'test/items.test.js': `// ${ctx.Name} — the first test.
//
// **It asserts a refusal, deliberately.** A suite that only proves the
// happy path is how every gap in this repo survived: 464 tests passed
// while an unauthenticated request could drain a stranger's wallet,
// because each one exercised a library function directly and nothing
// tested what the code refuses.
//
// When this app moves money, add a ledger helper rather than a spy: a
// spy proves a transfer was attempted, a ledger proves money landed and
// that the total never changed. See chopz/chopz-shop/test/money.test.js.

const test = require('node:test');
const assert = require('node:assert');

const { create${ctx.Pascal}Store } = require('../lib/store');
const { createItem, getItem, listItems } = require('../lib/items');

const NOW = Date.UTC(2026, 5, 1);

test('an item is created with an owner and a real id', () => {
  const store = create${ctx.Pascal}Store();
  const item = createItem(store, { name: 'first', ownerId: 'ada', now: NOW });

  assert.strictEqual(item.ownerId, 'ada');
  assert.ok(item.id > 0);
  assert.strictEqual(getItem(store, item.id).name, 'first');
});

test('a missing field is refused, and nothing is stored', () => {
  const store = create${ctx.Pascal}Store();

  // Absence must not mean permission. Every "field is missing" that
  // resolves to a default is a place an attacker arranges the absence.
  assert.throws(() => createItem(store, { ownerId: 'ada' }), /requires a name/);
  assert.throws(() => createItem(store, { name: 'x' }), /requires an ownerId/);

  assert.strictEqual(store.items.length, 0);
  assert.strictEqual(store.nextItemId, 1, 'a refused create must not burn an id');
});

test('listing returns what was created, in order', () => {
  const store = create${ctx.Pascal}Store();
  createItem(store, { name: 'a', ownerId: 'ada', now: NOW });
  createItem(store, { name: 'b', ownerId: 'rio', now: NOW });

  assert.deepStrictEqual(listItems(store).map((i) => i.name), ['a', 'b']);
});

test('an unknown id resolves to null rather than throwing', () => {
  // Absence is a real answer for a lookup. Throwing here pushes callers
  // toward try/catch around a normal case, and swallowed catches are
  // where refusals go to die.
  assert.strictEqual(getItem(create${ctx.Pascal}Store(), 999), null);
});
`,

  'README.md': `# ${ctx.Name}

${ctx.description}

Scaffolded by \`scripts/new-app.mjs\`. Port **${ctx.port}**, parent
**${ctx.parent}**.

\`\`\`bash
npm install
npm start
curl http://localhost:${ctx.port}/api/health
npm test
\`\`\`

## What it already has

- **Persistence** — \`lib/persistence.js\`, synced from the canonical
  copy. \`durable(store)\` commits to disk before responding on 2xx
  mutating requests.
${ctx.auth ? `- **Auth** — \`lib/shieldAuth.js\`, synced. \`requireActor(field)\` proves a
  live Shield session *and* that it belongs to the acting user. See
  \`dev-docs/AUTH_HARDENING.md\` for why the second half matters.
` : ''}- **Design system** — \`public/vaco-design.css\` + \`vaco-ui.js\`, synced.
  Accent \`${ctx.accent}\`, registered in \`vaco-shell/VACO_PALETTE_REGISTER.md\`.
- **Registered** — the ecosystem manifest, the shell registry, both sync
  scripts, and the generated \`docker-compose.yml\` and nginx config.

## Before this is a real app

1. Replace \`lib/items.js\` with the real domain.
2. If it moves VCoin, settle through V3 and **test on the money, never
   on a status** — a status is exactly what stays correct while the
   money goes wrong.
3. If it calls another app, inject the client as a function parameter.
   There are zero cross-app \`require\`s in this repo, and that is what
   lets Docker build each app from its own directory.
`,
});

// -- Registration ---------------------------------------------------------
//
// The four steps most easily forgotten by hand. Each produces a failure
// far from its cause: a missing manifest line means the app never
// starts in CI; a missing sync target means it silently diverges from
// the canonical auth module.

function registrations(ctx) {
  return [
    {
      file: 'start-ecosystem.sh',
      apply: (s) => s.replace(/(\n)(\s*"venvs:venvs:)/,
        `\n  "${ctx.name}:${ctx.name}:npm start:${ctx.port}:/api/health"$1$2`),
      why: 'the authoritative manifest — compose, nginx and the smoke harness all read it',
    },
    {
      file: 'vaco-shell/lib/registry.js',
      apply: (s) => s.replace(/(\n)(\s*\{ id: 'voken',)/,
        `\n  { id: '${ctx.name}', name: '${ctx.Name}', description: '${ctx.description}', url: 'http://localhost:${ctx.port}', category: 'consumer', parent: '${ctx.parent}', bundle: 'Commerce & Marketplace' },$1$2`),
      why: 'the shell launcher and the company tree',
    },
    {
      file: 'sync-design-system.sh',
      apply: (s) => s.replace('  v4-proxy v4-search cvnvo/yap\n', `  v4-proxy v4-search cvnvo/yap ${ctx.name}\n`),
      why: 'without this the app never receives design-system updates',
    },
    ...(ctx.auth ? [{
      file: 'sync-shared-runtime.sh',
      // Anchored on the *end of the list*, not on a neighbour's name.
      // The previous anchor was the literal line `  cvnvo\n`, which
      // stopped matching the moment SHIELD_TARGETS was rewrapped into
      // multi-app lines -- and a replace that matches nothing returns
      // the string unchanged and reports success. Matching the block's
      // closing paren survives any reflowing of its contents.
      //
      // `[^)]*` rather than `[\s\S]*?`, and that is not cosmetic. The
      // lazy version still matches if SHIELD_TARGETS' own closing paren
      // is disturbed -- it simply runs on to the next list's paren and
      // appends the app to SERVICE_TARGETS instead. That is worse than
      // the no-op it replaced, because it is silently *wrong* rather
      // than silently absent. A class that cannot cross a paren cannot
      // leave the block it started in. (Safe because no app name
      // contains a paren; if one ever does, this must change.)
      apply: (s) => s.replace(/(SHIELD_TARGETS=\([^)]*)\n\)/, `$1\n  ${ctx.name}\n)`),
      why: 'without this the app keeps a frozen copy of the auth module',
    }] : []),
    {
      file: 'vaco-shell/VACO_PALETTE_REGISTER.md',
      apply: (s) => s.replace('| 78° | HVNTZ |',
        `| ??° | ${ctx.Name} | \`${ctx.accent}\` | **Move this row to its correct hue position and replace this sentence.** |\n| 78° | HVNTZ |`),
      why: 'so the next app does not pick a colliding hue',
    },
  ];
}

// -- Main -----------------------------------------------------------------

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`${err.message}\n\n${USAGE}\n`);
  process.exit(2);
}
if (args.help || !args.name) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(args.name ? 0 : 2);
}

const name = args.name;
const port = args.port || nextFreePort();

// Refuses rather than inventing a colour. The palette register exists
// because "the twenty-sixth app invents a hue against nothing" is the
// outcome it was written to prevent, and a generated default would be
// exactly that with extra steps.
if (!args.accent) {
  process.stderr.write(
    `new-app: --accent is required.\n\n`
    + `Pick one against vaco-shell/VACO_PALETTE_REGISTER.md: at least ~10° from its\n`
    + `neighbours, or clearly different in lightness. An auto-generated colour would\n`
    + `be exactly the collision that register exists to prevent.\n`,
  );
  process.exit(2);
}
if (!/^#[0-9a-fA-F]{6}$/.test(args.accent)) {
  process.stderr.write(`new-app: --accent must be #RRGGBB, got "${args.accent}"\n`);
  process.exit(2);
}

try {
  assertUsable(name, port);
} catch (err) {
  process.stderr.write(`new-app: ${err.message}\n`);
  process.exit(1);
}

const shade = (hex, factor) => `#${hex.slice(1).match(/../g)
  .map((c) => Math.max(0, Math.min(255, Math.round(parseInt(c, 16) * factor))).toString(16).padStart(2, '0'))
  .join('')}`;

const ctx = {
  name,
  port,
  auth: args.auth,
  parent: args.parent || name.toUpperCase(),
  Name: name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
  Pascal: name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(''),
  description: `A VACO app.`,
  accent: args.accent,
  accentDim: shade(args.accent, 0.75),
  accentInk: shade(args.accent, 0.08),
};

const generated = files(ctx);
const regs = registrations(ctx);

if (args.dryRun) {
  process.stdout.write(`Would create ${name}/ on port ${port} (parent ${ctx.parent}):\n`);
  for (const file of Object.keys(generated)) process.stdout.write(`  ${name}/${file}\n`);
  process.stdout.write('\nWould register in:\n');
  for (const reg of regs) process.stdout.write(`  ${reg.file.padEnd(38)} ${reg.why}\n`);
  process.stdout.write('\nWould then regenerate docker-compose.yml and the nginx config, and npm install.\n');
  process.exit(0);
}

for (const [rel, content] of Object.entries(generated)) {
  const target = path.join(REPO_ROOT, name, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
fs.mkdirSync(path.join(REPO_ROOT, name, 'data'), { recursive: true });
process.stdout.write(`Created ${name}/ (${Object.keys(generated).length} files)\n`);

const failedRegistrations = [];
for (const reg of regs) {
  const file = path.join(REPO_ROOT, reg.file);
  const before = fs.readFileSync(file, 'utf8');
  const after = reg.apply(before);
  if (after === before) {
    process.stderr.write(`  WARNING  ${reg.file} was not modified — register ${name} by hand (${reg.why})\n`);
    failedRegistrations.push(reg);
    continue;
  }
  fs.writeFileSync(file, after);
  process.stdout.write(`  registered in ${reg.file}\n`);
}

// The sync scripts place persistence.js, shieldAuth.js and the design
// system — so the new app joins the sync rather than owning copies.
execFileSync('./sync-design-system.sh', { cwd: REPO_ROOT, stdio: 'inherit' });
if (ctx.auth) execFileSync('./sync-shared-runtime.sh', { cwd: REPO_ROOT, stdio: 'inherit' });
fs.copyFileSync(path.join(REPO_ROOT, 'v3', 'lib', 'persistence.js'), path.join(REPO_ROOT, name, 'lib', 'persistence.js'));

execFileSync(process.execPath, ['deploy/generate-docker-compose.js'], { cwd: REPO_ROOT, stdio: 'inherit' });
execFileSync(process.execPath, ['deploy/generate-nginx-conf.js', '--docker'], { cwd: REPO_ROOT, stdio: 'inherit' });

process.stdout.write('\nInstalling dependencies...\n');
execFileSync('npm', ['install', '--silent'], { cwd: path.join(REPO_ROOT, name), stdio: 'inherit' });

process.stdout.write(`
${ctx.Name} is ready on port ${port}.

  cd ${name} && npm start && npm test
  node scripts/smoke-frontend.mjs ${name}:${port}

Two things the factory could not decide for you:

  1. vaco-shell/VACO_PALETTE_REGISTER.md has a "??°" row — move it to
     its correct hue position and say why that colour.
  2. lib/items.js is a placeholder. Replace it with the real domain.
`);

// A registration that silently did not happen is the failure this
// script exists to prevent, so it is the last thing printed and it
// exits non-zero. The per-registration WARNING above scrolls past
// behind the sync scripts, compose regeneration and `npm install`;
// by the time the run finishes nobody has seen it, and the app looks
// created. Each of these produces a failure far from its cause -- a
// missing manifest line means the app never starts in CI, a missing
// sync target means it silently diverges from the canonical auth
// module.
if (failedRegistrations.length > 0) {
  process.stderr.write(
    `\n${name} was created, but ${failedRegistrations.length} registration(s) did NOT apply:\n\n`,
  );
  for (const reg of failedRegistrations) {
    process.stderr.write(`  ${reg.file}\n      ${reg.why}\n`);
  }
  process.stderr.write(
    '\nThe anchor each one looks for has drifted. Register by hand, then fix\n'
    + 'the anchor in scripts/new-app.mjs so the next app does not hit this.\n',
  );
  process.exit(1);
}

