// VDP's declared VACANCY tables must be real tables.
//
// **What this enforces.** `VDP_VACANCY_SHARED_ENGINE_COST_REDUCTION.md`
// instructs: check whether VACANCY's schema already covers an entity
// type before creating a new parallel table or system. VDP now
// declares that mapping in `vdp/src/lib/vacancySchema.js`, and a
// declaration nobody checks is worth nothing — it rots the first time
// a table is renamed, and rots silently, which is how the parallel
// schema the instruction warns about gets built anyway.
//
// It is a cross-app check, so it lives in `scripts/test/` rather than
// in either app: `vdp` must not import from `vacon-c` (separate build
// contexts — see `sync-shared-runtime.sh`'s header), and this reads
// both from the repo root without either depending on the other.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = path.join(REPO_ROOT, 'vacon-c', 'VACANCY_POSTGRESQL_SCHEMA.sql');

const { VACANCY_ENTITY_MAP, NOT_SHARED, tableFor, describeAlignment } = await import(
  path.join(REPO_ROOT, 'vdp', 'src', 'lib', 'vacancySchema.js')
);

function schemaTables() {
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  return new Set(
    [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_][a-z0-9_]*)["`]?/gi)]
      .map((m) => m[1].toLowerCase()),
  );
}

test('the schema file exists and parses to a real table list', () => {
  assert.ok(fs.existsSync(SCHEMA), `${SCHEMA} is missing — the mapping points at nothing`);
  const tables = schemaTables();
  // A guard on the parser, not the data. A regex that matched nothing
  // would make every assertion below vacuously... fail, actually — but
  // one that matched too much would make them vacuously pass.
  assert.ok(tables.size > 40, `parsed only ${tables.size} tables — the scan is broken`);
  for (const core of ['entities', 'properties', 'organizations', 'npcs', 'cities']) {
    assert.ok(tables.has(core), `expected core table "${core}" not found — is this the right schema?`);
  }
});

test('every table VDP declares is a real table in VACANCY\'s schema', () => {
  const tables = schemaTables();
  const missing = Object.entries(VACANCY_ENTITY_MAP)
    .filter(([, table]) => !tables.has(table))
    .map(([kind, table]) => `${kind} -> "${table}"`);

  assert.deepEqual(
    missing, [],
    'VDP declares these VACANCY tables, and the schema has no such table:\n    '
    + `${missing.join('\n    ')}\n`
    + 'Either the mapping is wrong or a table was renamed. Do not add a VDP-specific '
    + 'table to resolve it — that is the parallel schema the instruction exists to prevent.',
  );
});

test('the mapping is not empty, and covers the three things the instruction names', () => {
  // "The casino, Venus Resort properties, and VDP's NPCs should be real
  // rows in the same properties/entities/organizations tables."
  assert.ok(Object.keys(VACANCY_ENTITY_MAP).length >= 5);
  assert.equal(tableFor('resortVenue'), 'properties');
  assert.equal(tableFor('resortStaff'), 'npcs');
  assert.equal(tableFor('resortOperator'), 'organizations');
  assert.equal(tableFor('fighter'), 'entities');
  assert.equal(tableFor('nonsense'), null);
});

test('every deliberate non-mapping carries a reason', () => {
  // An unmapped kind with no reason is indistinguishable from one
  // somebody forgot.
  assert.ok(Object.keys(NOT_SHARED).length > 0);
  for (const [kind, reason] of Object.entries(NOT_SHARED)) {
    assert.equal(typeof reason, 'string');
    assert.ok(reason.trim().length > 15, `${kind}'s reason is too thin to be one: "${reason}"`);
  }
});

test('the mapping says out loud that nothing is a database row yet', () => {
  // The honest half. VACANCY's engine still reads an in-memory
  // WorldState (vacon-c/server/db.js says so in its own header), so a
  // reader must not take this module as "VDP is on Postgres".
  const d = describeAlignment();
  // The honest half is now two halves, and the distinction is the point:
  // VDP can READ every shared entity type over the API, and nothing is
  // a database row, because the engine has not moved to Postgres.
  assert.match(d.status, /readable-not-persisted/);
  assert.match(d.status, /in-memory WorldState/);
  assert.match(d.status, /not|no VDP object is a database ROW yet/i);
  assert.ok(d.tables.length > 0);
});

test("VACANCY's engine has not silently moved to Postgres without this being revisited", () => {
  // Checked structurally rather than by matching prose. The first
  // version of this asserted on a sentence in db.js's header and
  // failed immediately — the phrase wraps across two comment lines, so
  // the regex could never match. A test that cannot pass is as useless
  // as one that cannot fail, and the structural fact is the better
  // signal anyway: the conversion has happened when the engine starts
  // reading the connection layer.
  //
  // Failing here is the prompt to finish the job, not a defect.
  const engine = fs.readFileSync(path.join(REPO_ROOT, 'vacon-c', 'server', 'engine.js'), 'utf8');
  assert.doesNotMatch(
    engine, /require\(['"]\.\/db(\.js)?['"]\)/,
    'vacon-c/server/engine.js now requires db.js, so the engine may be reading Postgres. '
    + "VDP's objects can become real rows — update vdp/src/lib/vacancySchema.js "
    + 'and this test together.',
  );

  // And the connection layer still exists, so the mapping has somewhere to go.
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'vacon-c', 'server', 'db.js')));
});

// ---------------------------------------------------------------------------
// Reachability — added 29 Aug 2026
// ---------------------------------------------------------------------------
// **A mapped table nothing can read is still a parallel schema waiting
// to happen.** The checks above prove VDP's declared tables exist in a
// `.sql` file. That was the whole story while VACON-C served five
// endpoints and none of them touched properties, organizations,
// entities or cities — the mapping could only ever be a declaration.
//
// VACON-C now serves those entity types over HTTP. So the mapping can
// be held to a stronger standard: every table VDP claims to share must
// be reachable through VACON-C's API, and VDP's client must actually
// speak to it. Otherwise the next person needing a venue record finds
// no way to read one and builds a second model here — which is exactly
// the cost the shared-engine document exists to avoid.

const VACANCY_SERVER = path.join(REPO_ROOT, 'vacon-c', 'server.js');
const VDP_CLIENT = path.join(REPO_ROOT, 'vdp', 'src', 'lib', 'vacancyClient.js');

// Which VACON-C route surface serves each shared table. Stated rather
// than guessed from the table name: `npcs` is served by /api/npcs, but
// `economy_snapshots` is served by /api/economy/snapshot, and nothing
// about the names would tell you that.
const TABLE_ROUTES = {
  properties: '/api/properties',
  organizations: '/api/organizations',
  npcs: '/api/npcs',
  entities: '/api/entities/:id',
  cities: '/api/cities',
  events: '/api/events',
  economy_snapshots: '/api/economy/snapshot',
};

function vacancyRoutes() {
  const src = fs.readFileSync(VACANCY_SERVER, 'utf8');
  return new Set(
    [...src.matchAll(/^app\.(?:get|post|put|delete)\('([^']+)'/gm)].map((m) => m[1]),
  );
}

test('every shared table has a stated route, and that route is registered', () => {
  const declared = new Set(Object.values(VACANCY_ENTITY_MAP));
  const routes = vacancyRoutes();

  const unrouted = [...declared].filter((table) => !TABLE_ROUTES[table]);
  assert.deepEqual(
    unrouted, [],
    'VDP shares these tables and TABLE_ROUTES above does not say how to read them:\n    '
    + `${unrouted.join(', ')}\n`
    + 'Add the route it is served by, or explain why it is unreadable.',
  );

  const missing = [...declared]
    .map((table) => [table, TABLE_ROUTES[table]])
    .filter(([, route]) => !routes.has(route));

  assert.deepEqual(
    missing.map(([t, r]) => `${t} -> ${r}`), [],
    'These routes are named as serving a shared table and VACON-C does not register them.',
  );
});

test("VDP's client actually reads the shared entity types", () => {
  // The lesson from sync-shared-runtime.sh, applied to an API: a synced
  // file nobody imports is drift nothing can see. A client function
  // nobody wrote is the same failure — the mapping says "a resort venue
  // is a property" and no code could fetch one.
  const client = fs.readFileSync(VDP_CLIENT, 'utf8');

  for (const [table, route] of Object.entries(TABLE_ROUTES)) {
    if (!Object.values(VACANCY_ENTITY_MAP).includes(table)) continue;
    // The literal path prefix, so a renamed route fails here rather
    // than at runtime in a browser.
    const prefix = route.replace('/:id', '');
    assert.ok(
      client.includes(prefix),
      `vdp/src/lib/vacancyClient.js never calls ${prefix}, so VDP cannot read the `
      + `"${table}" rows it declares it shares. That is how a parallel model gets built.`,
    );
  }
});

test('the client stays a reader — it does not mutate shared world state', () => {
  // VDP observing VACON-C is safe. VDP writing to it is a design
  // decision nobody has made, and the tick in particular advances state
  // for every consumer at once (VACON-C operator-guards it for that
  // reason). The four pre-existing POSTs are grandfathered by name so
  // this test names what it permits rather than counting.
  // Scoped per function, not by a sliding window. The first version
  // looked 400 characters past each requestJson call, which reaches
  // into the NEXT function — so `getWorldState` was reported as a POST
  // because `advanceTick` follows it. A detector that mislabels a GET
  // would eventually be silenced rather than fixed, and then it would
  // miss the write it exists to catch.
  const client = fs.readFileSync(VDP_CLIENT, 'utf8');
  const posts = client
    .split(/export async function /)
    .slice(1)
    .filter((body) => /method:\s*["']POST["']/.test(body))
    .map((body) => {
      const call = body.match(/requestJson\(\s*`?["'`]([^"'`$]+)/);
      return call ? call[1] : '(unparsed)';
    });

  const allowed = new Set(['/api/tick', '/api/npc/generate', '/api/artifacts', '/api/mission']);
  const unexpected = posts.filter((p) => !allowed.has(p.split('$')[0].replace(/\/$/, '')));

  assert.deepEqual(
    unexpected, [],
    'vacancyClient gained a POST beyond the four it started with. Writing to VACON-C '
    + 'from VDP is a real design decision — make it deliberately, and update this test '
    + 'with the reason.',
  );
});
