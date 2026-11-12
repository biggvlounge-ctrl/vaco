// Real BJS/OJJDP incarceration demographics, by real facility type —
// a reference table, never a per-NPC draw. Read server/prisonPacks.js's
// own header before this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const prisonPacks = require('../server/prisonPacks.js');
const crime = require('../server/crime.js');

const SERVER = path.join(__dirname, '..', 'server');

function codeOf(file) {
  const source = fs.readFileSync(path.join(SERVER, file), 'utf8');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------
// The reference table itself
// ---------------------------------------------------------------------

test('every declared facility type resolves, and an unknown one does not', () => {
  for (const type of prisonPacks.FACILITY_TYPES) {
    const entry = prisonPacks.describeFacilityDemographics(type);
    assert.ok(entry, `${type} has no entry`);
    assert.equal(entry.facilityType, type);
    assert.ok(Number.isFinite(entry.asOf), `${type} carries no asOf year`);
    assert.ok(typeof entry.source === 'string' && entry.source.length > 0);
    assert.ok(entry.raceShare && typeof entry.raceShare === 'object');
    assert.ok(entry.femaleShare && Number.isFinite(entry.femaleShare.value));
  }
  assert.equal(prisonPacks.describeFacilityDemographics('not-a-real-type'), null);
});

test('no race share is fabricated past 1 — every share is a real reported fraction', () => {
  for (const type of prisonPacks.FACILITY_TYPES) {
    const { raceShare, femaleShare } = prisonPacks.describeFacilityDemographics(type);
    const total = Object.values(raceShare).reduce((a, b) => a + b, 0);
    assert.ok(total > 0 && total <= 1.01, `${type} race shares sum to ${total}`);
    assert.ok(femaleShare.value > 0 && femaleShare.value < 1, `${type} female share is ${femaleShare.value}`);
  }
});

test('the state-or-federal entry\'s own under-100% share is reported, not silently normalised', () => {
  const entry = prisonPacks.describeFacilityDemographics('state-or-federal-prison');
  const total = Object.values(entry.raceShare).reduce((a, b) => a + b, 0);
  assert.ok(total < 0.95, 'the real BJS/FBOP reporting gap (two-or-more-races, other) was papered over');
  assert.match(entry.raceShareNote, /do not sum to 1/);
});

test('facilityType names line up with landmarks.js\'s own default', () => {
  const landmarks = require('../server/landmarks.js');
  const property = { id: 1, city_id: 1, landmark_category: 'historic-site' };
  landmarks.designate(
    { properties: [property], historicalRecords: [] },
    { propertyId: 1, category: 'prison', significance: 60 },
  );
  assert.equal(property.facilityType, 'state-or-federal-prison');
  assert.ok(prisonPacks.FACILITY_TYPES.includes(property.facilityType),
    'landmarks.js designates a facilityType prisonPacks.js has no entry for');
});

// ---------------------------------------------------------------------
// The crime taxonomy, honestly represented
// ---------------------------------------------------------------------

test('describePopulationCaveat names all eight real crime categories, not a narrower set', () => {
  const caveat = prisonPacks.describePopulationCaveat();
  assert.deepEqual(new Set(caveat.trackedCategories), new Set(Object.keys(crime.CATEGORIES)));
  assert.deepEqual(new Set(caveat.generatedCategories), new Set(crime.GENERATED_CATEGORIES));
  assert.deepEqual(new Set(caveat.declaredAbsent), new Set(['drug', 'fraud', 'sex_offense']));
  // Every generated category is real and not also declared absent.
  for (const c of caveat.generatedCategories) {
    assert.equal(caveat.declaredAbsent.includes(c), false);
  }
});

// ---------------------------------------------------------------------
// §9's shape, for a reference table rather than a per-NPC field —
// nothing reads this to decide an outcome
// ---------------------------------------------------------------------

test('only justice.js reads prisonPacks, and only to report', () => {
  const FORBIDDEN = [
    'crime.js', 'policing.js', 'economy.js', 'mortality.js', 'traits.js',
    'entityTraits.js', 'traitDrift.js', 'keys.js', 'contest.js',
    'motivation.js', 'archetypes.js', 'migration.js', 'succession.js',
    'authority.js', 'control.js', 'heat.js',
  ];
  const offenders = FORBIDDEN.filter((file) => {
    if (!fs.existsSync(path.join(SERVER, file))) return false;
    return /prisonPacks/.test(codeOf(file));
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} reads prisonPacks — §9 forbids a demographic deciding an outcome; `
    + 'this module exists to be reported, not to decide anything.');

  const readers = fs.readdirSync(SERVER)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => f !== 'prisonPacks.js')
    .filter((f) => /require\(.\.\/prisonPacks\.js.\)/.test(codeOf(f)));
  assert.deepEqual(readers, ['justice.js'],
    `${readers.join(', ')} started requiring prisonPacks.js — that is a decision to take `
    + 'explicitly, the same way every other real demographic field\'s own reader list is.');
});
