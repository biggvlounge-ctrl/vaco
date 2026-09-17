// A demographic dimension that may be COUNTED and may not DECIDE.
//
// `statistics.js` carried `race_and_ethnicity_composition` as a
// declared gap, and the declaration is the reason this file exists:
//
//   "deliberately absent rather than missing. No column exists, no
//    document in the package asks for one, and §9 permits demographic
//    modelling while forbidding demographics determining an NPC's
//    morality, criminality, intelligence or worth — which makes adding
//    one a decision to take explicitly, not a side effect of wanting a
//    composition statistic."
//
// The owner took that decision on 17 Sep 2026. So the field exists and
// is measured exactly like language, religion and education — and the
// forbidden half is a TEST rather than an intention.
//
// **Why a test and not a comment.** Every other constraint in this
// engine that was written down and not enforced was eventually
// violated by somebody who had not read it. `crime.js` already carries
// the same guard for traits, for the same §9 clause, and it is the
// reason crime generators read the environment instead of the person.
// This is that guard extended to the one dimension where getting it
// wrong would be worst.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const demographics = require('../server/demographics.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const statistics = require('../server/statistics.js');

const SERVER = path.join(__dirname, '..', 'server');

// Comments stripped, so a file explaining WHY it does not read
// ethnicity does not read as reading it — the same false positive that
// `urbanSystems.js` hit when a string literal named a table.
function codeOf(file) {
  const source = fs.readFileSync(path.join(SERVER, file), 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// -- the firewall ---------------------------------------------------------

test('no generator of outcomes reads ethnicity', () => {
  // **The claim §9 actually makes.** Each of these decides something
  // about a person — whether they offend, whether they are caught,
  // whether they work, what they earn, whether they die, what they are
  // capable of. None may read what group they belong to.
  const FORBIDDEN = [
    'crime.js',        // who offends
    'policing.js',     // who is caught
    'economy.js',      // who works and what they earn
    'mortality.js',    // who dies
    'traits.js',       // what somebody is capable of
    'entityTraits.js',
    'traitDrift.js',   // how that changes
    'keys.js',         // how they decide
    'contest.js',      // who wins
    'motivation.js',   // what they want
    'archetypes.js',   // what they are taken to be
    'migration.js',    // who is pushed out
    'succession.js',   // who inherits
  ];

  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /ethnicity/i.test(codeOf(file));
  });

  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads ethnicity. §9 permits demographic modelling and forbids `
    + 'demographics determining an NPC\'s morality, criminality, intelligence or worth. '
    + 'This dimension exists to be counted, not to decide anything.');
});

test('exactly one module reads it, and it is the one that counts', () => {
  // The other direction: a firewall around a field nothing reads at all
  // would pass the test above and mean the dimension does not exist.
  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /ethnicity/i.test(codeOf(f)));

  assert.ok(readers.includes('demographics.js'),
    'nothing measures ethnicity, so the field is stored and never used');

  // `engine.js` and `worldgen.js` SET it; `births.js` inherits it;
  // `migrate.js` and `restore.js` CARRY it, which is not the same as
  // deciding with it — a persistence layer that skipped the column
  // would drop the dimension on every checkpoint. Anything outside this
  // list is a new decision somebody should make on purpose.
  const expected = [
    'births.js', 'demographics.js', 'engine.js', 'migrate.js',
    'restore.js', 'statistics.js', 'worldgen.js',
  ];
  const unexpected = readers.filter((f) => !expected.includes(f));
  assert.deepEqual(unexpected, [],
    `${unexpected.join(', ')} started reading ethnicity — that is a decision to take `
    + 'explicitly, the same way adding the field was');
});

// -- it is measured like every other demographic dimension ----------------

test('composition reports ethnicity beside language, religion and education', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 3, populationPerCommunity: 25, seed: 'eth' });

  const residents = w.npcs.filter((n) => n.communityId === w.communities[0].id);
  const composition = demographics.compositionOf(w, residents);

  for (const dimension of ['language', 'religion', 'education', 'ethnicity']) {
    assert.ok(composition[dimension], `composition has no ${dimension}`);
    assert.ok(Array.isArray(composition[dimension].distribution.rows));
  }

  // More than one group, or diversity means nothing.
  assert.ok(composition.ethnicity.distribution.rows.length > 1,
    'every resident belongs to one group, so there is no composition to report');
  assert.ok(composition.ethnicity.diversity > 0 && composition.ethnicity.diversity < 1);
});

test('the declared gap is closed, and the statistics answer', () => {
  const w = engine.WorldState;
  const declared = new Set(statistics.unavailable().map((e) => e.key));
  assert.equal(declared.has('race_and_ethnicity_composition'), false,
    'the declared gap is still declared');

  const profile = statistics.profileFor(w, w.communities[0].id);
  assert.equal(profile.statistics.ethnic_diversity.known, true);
  assert.equal(profile.statistics.dominant_ethnicity_share.known, true);
  assert.equal(profile.statistics.ethnic_diversity.category, 'demographic');
});

test('an unrecorded ethnicity reads as unknown, not as a group', () => {
  // Unknown is not a category. `diversityOf` already excludes
  // `unknown`, and a person nobody recorded must not be counted into
  // somebody else's group.
  const w = engine.WorldState;
  const residents = [
    { id: 1, ethnicity: 'Riverborn' },
    { id: 2, ethnicity: null },
    { id: 3, ethnicity: null },
  ];
  const composition = demographics.compositionOf(w, residents);
  const rows = composition.ethnicity.distribution.rows;
  const unknown = rows.find((r) => r.value === 'unknown');

  assert.ok(unknown, 'two unrecorded people were folded into a named group');
  assert.equal(unknown.count, 2);
  assert.equal(composition.ethnicity.dominantShare, 1,
    'the one recorded person is the whole of the KNOWN population');
});

// -- it is inherited, not re-rolled ---------------------------------------

test('a child belongs to the household it was born into', () => {
  // Rolling a fresh value would make `ethnic_diversity` drift toward
  // the generator's distribution rather than the population's, and a
  // settlement's composition would stop being a fact about its
  // families.
  const births = require('../server/births.js');
  const source = fs.readFileSync(path.join(SERVER, 'births.js'), 'utf8');
  assert.match(source, /ethnicity: bearer\.ethnicity/,
    'births.js does not inherit ethnicity, so children are drawn fresh');
  void births;
});

// -- the names are not real-world groups ----------------------------------

test('the generated groups are named for this setting', () => {
  // Deliberate: the engine needs a dimension with more than one value
  // so composition and diversity mean something, and borrowing real
  // ethnonyms would attach real-world associations to a simulation that
  // models none of them.
  const source = fs.readFileSync(path.join(SERVER, 'worldgen.js'), 'utf8');
  const match = source.match(/ethnicities: \[([^\]]+)\]/);
  assert.ok(match, 'worldgen declares no ethnicities');

  const names = match[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  assert.ok(names.length >= 3, 'fewer than three groups gives diversity almost nothing to say');
  for (const name of names) {
    assert.ok(/^[A-Z][a-z]+$/.test(name), `"${name}" is not a single setting-style name`);
  }
});
