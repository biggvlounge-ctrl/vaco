// The constellation map exists in two places, and this holds them to
// each other.
//
// `dev-docs/VACO_CONSTELLATIONS.md` is the prose source — drawn
// 2026-08-26 to direct instruction, glyphs revised 2026-08-28. It
// records which placements were directed and which were decided when
// asked, so it is the document a disagreement gets settled against.
// `vaco-shell/lib/registry.js` exports the same map as `CONSTELLATIONS`
// so the App Store can render it.
//
// **Why a test rather than care.** That document spent two weeks saying
// its internal layer held three services while the registry grew five
// more — Shield, VACO Audit, VACO Operator, VACO Media and VACO Notify,
// the last of which the document still describes as unbuilt "task
// #123". Nothing was broken and nothing said anything. A structure
// recorded in prose and separately in code will drift, and the
// direction it drifts is always the same: the code grows, the document
// does not.
//
// So this parses the document's own ASCII map and requires the two to
// agree in **both** directions. A name in one and not the other fails,
// whichever side it is on.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = 'dev-docs/VACO_CONSTELLATIONS.md';
const doc = fs.readFileSync(path.join(REPO_ROOT, DOC), 'utf8');

const registry = await import(
  path.join(REPO_ROOT, 'vaco-shell', 'lib', 'registry.js'));
const { APPS, CONSTELLATIONS, UNPLACED, constellationOf, listConstellations } = registry;

// -- Parsing the document's map ----------------------------------------
//
// The map is a fenced block of three columns, each headed by a glyph
// and a name and followed by its members, indented:
//
//   ■ VOKEN                ✕ VVLTVRE               ○ SYSTEMS
//      VOKEN                  Vvltvre                 V3
//
// Columns are found by the character offset of each heading rather than
// by splitting on runs of spaces — member names contain no spaces today,
// but "VACO Analytics" and "VACO Operator" do, and a whitespace split
// would have quietly read those as two entries each.
const GLYPHS = ['■', '✕', '○', '▲', '◇'];

function parseDocMap() {
  const fence = doc.match(/```\n([\s\S]*?)```/);
  assert.ok(fence, `${DOC} no longer has a fenced map block`);
  const lines = fence[1].split('\n');

  // Every heading, with the column it starts at and the row it is on.
  const heads = [];
  lines.forEach((line, row) => {
    for (const m of line.matchAll(/([■✕○▲◇])\s+(\S+)/g)) {
      heads.push({ glyph: m[1], name: m[2], col: m.index, row });
    }
  });
  assert.ok(heads.length >= 6, `parsed only ${heads.length} headings from ${DOC}'s map`);

  // A member belongs to the nearest heading at or left of where it
  // starts, on a later row, within that heading's band. Bands end where
  // the next heading on the same row begins.
  const groups = heads.map((h) => ({ ...h, members: [] }));
  for (const g of groups) {
    const sameRow = heads.filter((h) => h.row === g.row).sort((a, b) => a.col - b.col);
    const next = sameRow.find((h) => h.col > g.col);
    const end = next ? next.col : Infinity;
    // Rows below this heading, until a row that carries a new heading
    // in this same band.
    for (let row = g.row + 1; row < lines.length; row += 1) {
      if (heads.some((h) => h.row === row && h.col >= g.col && h.col < end)) break;
      const slice = lines[row].slice(g.col, end === Infinity ? undefined : end).trim();
      if (!slice) continue;
      // Strip a trailing parenthetical gloss, which the document uses
      // for some entries and not others.
      groups.push; // no-op, keeps the loop body shape obvious
      g.members.push(slice.replace(/\s*\(.*$/, '').trim());
    }
  }
  return groups;
}

const docGroups = parseDocMap();

// The document writes VEX and Village; the registry's parent names are
// `Vex` and `VXLLAGE`. Recorded here rather than by lowercasing
// everything, so a genuine rename still fails instead of being absorbed
// by a loose comparison.
const DOC_TO_REGISTRY = {
  VEX: 'Vex',
  Village: 'VXLLAGE',
};
const normalise = (n) => DOC_TO_REGISTRY[n] || n;

// -- The checks --------------------------------------------------------

test('the document map parsed into real groups, not an empty set', () => {
  // Every assertion below is vacuously true against an empty parse.
  assert.equal(docGroups.length, 6,
    `parsed ${docGroups.length} groups from ${DOC}; expected 6`);
  const total = docGroups.reduce((n, g) => n + g.members.length, 0);
  assert.ok(total >= 20, `parsed only ${total} members from ${DOC}'s map`);
  for (const g of docGroups) {
    assert.ok(g.members.length > 0, `${g.glyph} ${g.name} parsed with no members`);
  }
});

test('every group in the document is in the registry, with the same glyph', () => {
  for (const g of docGroups) {
    const found = CONSTELLATIONS.find((c) => c.name === g.name);
    assert.ok(found, `${DOC} has a ${g.glyph} ${g.name} constellation; registry.js does not`);
    assert.equal(found.glyph, g.glyph,
      `${g.name}: ${DOC} draws ${g.glyph}, registry.js says ${found.glyph}`);
  }
});

test('every group in the registry is in the document', () => {
  for (const c of CONSTELLATIONS) {
    const found = docGroups.find((g) => g.name === c.name);
    assert.ok(found, `registry.js has a ${c.glyph} ${c.name} constellation; ${DOC} does not draw it`);
  }
});

test('membership agrees in both directions', () => {
  for (const g of docGroups) {
    const c = CONSTELLATIONS.find((x) => x.name === g.name);
    const fromDoc = g.members.map(normalise).sort();

    // Public groups are keyed by parent; the internal one by app id,
    // because its members are services rather than products. Compared
    // by display name either way, which is what the document writes.
    const fromCode = (c.public
      ? c.parents.slice()
      : (c.appIds || []).map((id) => {
        const app = APPS.find((a) => a.id === id);
        assert.ok(app, `registry.js puts unknown app id "${id}" in ${c.name}`);
        return app.name;
      })).sort();

    assert.deepEqual(fromCode, fromDoc,
      `${c.glyph} ${c.name} disagrees.\n`
      + `      ${DOC}: ${fromDoc.join(', ')}\n`
      + `      registry.js: ${fromCode.join(', ')}`);
  }
});

test('the shape vocabulary still describes the real group sizes', () => {
  // ■ and ✕ mean four, ▲ and ○ mean three. ◇ is the exception and the
  // document says so: it encodes a boundary, not a size, which is how
  // it went from 3 members to 8 without the vocabulary changing.
  const MEANS = { '■': 4, '✕': 4, '▲': 3, '○': 3 };
  for (const c of CONSTELLATIONS) {
    const expected = MEANS[c.glyph];
    if (!expected) continue;
    assert.equal(c.parents.length, expected,
      `${c.glyph} ${c.name} has ${c.parents.length} parents, but ${c.glyph} means ${expected}`);
  }
});

test('no parent is in two constellations, and there are eighteen', () => {
  // The one rule the map states outright: "No parent in two places,
  // none left out."
  const parents = CONSTELLATIONS.filter((c) => c.public).flatMap((c) => c.parents);
  const dups = parents.filter((p, i) => parents.indexOf(p) !== i);
  assert.deepEqual(dups, [], 'these parents are in more than one constellation');
  assert.equal(parents.length, 18,
    `${parents.length} public parents across the constellations; the map says 18`);

  // And they are the same eighteen the registry actually uses.
  const real = [...new Set(APPS.filter((a) => a.parent).map((a) => a.parent))];
  assert.deepEqual(parents.slice().sort(), real.slice().sort(),
    'the constellations and the registry disagree about what the parents are');
});

test('every app is placed or deliberately unplaced', () => {
  // The omission class this test exists for: an app added to the
  // registry and never placed simply would not appear in the
  // constellation view, and nothing would say so.
  const missing = APPS
    .filter((a) => !constellationOf(a) && !(a.id in UNPLACED))
    .map((a) => a.id);
  assert.deepEqual(missing, [],
    'these apps are in no constellation and not listed in UNPLACED — place them '
    + `in ${DOC} and registry.js, or record why they are outside the structure`);

  // And UNPLACED does not name apps that no longer exist.
  const stale = Object.keys(UNPLACED).filter((id) => !APPS.some((a) => a.id === id));
  assert.deepEqual(stale, [], 'UNPLACED names apps the registry no longer has');
});

test('the internal layer holds every app no public constellation claims', () => {
  const internal = CONSTELLATIONS.find((c) => !c.public);
  assert.ok(internal, 'there is no non-public constellation any more');

  for (const app of APPS) {
    if (app.id in UNPLACED) continue;
    const c = constellationOf(app);
    if (c && c.public) continue;
    assert.ok((internal.appIds || []).includes(app.id),
      `${app.id} is in no public constellation, so it belongs in ${internal.glyph} ${internal.name}`);
  }
});

test('listConstellations covers every app exactly once', () => {
  const seen = listConstellations().flatMap((c) => c.apps.map((a) => a.id));
  const dups = seen.filter((id, i) => seen.indexOf(id) !== i);
  assert.deepEqual(dups, [], 'these apps appear in more than one constellation');

  const expected = APPS.filter((a) => !(a.id in UNPLACED)).map((a) => a.id);
  assert.deepEqual(seen.slice().sort(), expected.slice().sort(),
    'listConstellations does not return every placed app exactly once');
});
