// Two dead tables built, and the four statistics they unlock.
//
// **How both were found.** Writing `server/statistics.js` I wrote
// school capacity, clinic capacity and infrastructure condition as
// computations, and each returned a real-looking **0** — the
// `infrastructure` table has the right ten types and the right columns
// and no WorldState array at all. And `demographic_composition` was
// declared unavailable with the reason "no demographic fields exist on
// an NPC", which was true of the fields people usually mean and false
// of three the schema already carried: `languages`, `entity_languages`
// and `npcs.religion`/`npcs.education`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const demographics = require('../server/demographics.js');
const economy = require('../server/economy.js');
const infrastructure = require('../server/infrastructure.js');
const statistics = require('../server/statistics.js');
const territory = require('../server/territory.js');
const engine = require('../server/engine.js');

let nextId = 120000;

function world({ tick = 1000 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    communities: [],
    cities: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityOrganizationMemberships: [],
    entityTraits: [],
    entityKnowledge: [],
    entityState: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    crimeIncidents: [],
    territoryBlocks: [],
    properties: [],
    ownershipRecords: [],
    resources: [],
    marketListings: [],
    infrastructure: [],
    languages: [],
    entityLanguages: [],
    nextEntityId: 1,
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  infrastructure.reseedIds(worldState);
  demographics.reseedIds(worldState);
  return worldState;
}

function person(worldState, { communityId = null, religion = null, education = null } = {}) {
  const npc = {
    id: nextId++, status: 'active', communityId, home_property_id: null,
    religion, education, generation: 1,
    createdTick: 0, updatedTick: worldState.tick,
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings: 100, tick: worldState.tick });
  return npc;
}

// ======================================================================
// Infrastructure
// ======================================================================

test('a piece of infrastructure needs a city and a real type', () => {
  // `infrastructure.city_id` is NOT NULL with no default, and a type
  // outside the schema's own ten is a column value nothing reads.
  // Both caught here rather than at migrate time, which is the
  // difference between an error and a rolled-back migration.
  const w = world();
  assert.throws(() => infrastructure.generateInfrastructure(w, { type: 'schools' }),
    /requires options.cityId/);
  const city = territory.generateCity(w, { name: 'Riverton' });
  assert.throws(() => infrastructure.generateInfrastructure(w, { cityId: 999, type: 'schools' }),
    /no city 999/);
  assert.throws(() => infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'airports' }),
    /"airports" is not an infrastructure type/);

  assert.equal(infrastructure.INFRASTRUCTURE_TYPES.length, 10);
});

test('capacity is unknown when nothing exists AND when nothing says how big', () => {
  // **The distinction the original defect collapsed**, and the one
  // that bit again inside the fix: `Number(null)` is 0 and 0 is
  // finite, so a bare isFinite guard passed an unstated capacity
  // through as zero.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });

  assert.equal(infrastructure.capacityOf(w, city.id, 'schools'), null, 'nothing exists');

  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools' });
  assert.equal(infrastructure.capacityOf(w, city.id, 'schools'), null,
    'a school with no stated capacity reported a capacity');

  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools', capacity: 300 });
  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools', capacity: 200 });
  assert.equal(infrastructure.capacityOf(w, city.id, 'schools'), 500);
  assert.equal(infrastructure.capacityOf(w, city.id, 'hospitals'), null);
});

test('failure risk is computed from age, condition and maintenance', () => {
  // Standing rule 3: `infrastructure.failure_risk` is a real column
  // and is derivable from three others, so nothing assigns it.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  const fresh = infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'water_systems', condition: 100, age: 0, maintenanceLevel: 100,
  });
  const failing = infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'bridges', condition: 10, age: 90, maintenanceLevel: 0,
  });

  assert.equal(infrastructure.failureRisk(fresh), 0);
  assert.ok(infrastructure.failureRisk(failing) > 0.7);
  assert.equal(fresh.failure_risk, null, 'something assigned the computed column');
  assert.equal(failing.failure_risk, null);

  // Maintenance reduces it without erasing it.
  const maintained = { ...failing, maintenance_level: 100 };
  assert.ok(infrastructure.failureRisk(maintained) < infrastructure.failureRisk(failing));
  assert.ok(infrastructure.failureRisk(maintained) > 0);
});

test('infrastructure wears out, and maintenance slows it', () => {
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  const neglected = infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'roads', condition: 100, maintenanceLevel: 0,
  });
  const kept = infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'rail', condition: 100, maintenanceLevel: 100,
  });

  for (let t = 0; t < 365 * 5; t += 1) infrastructure.advanceInfrastructure(w, t);

  assert.ok(neglected.condition < 100, 'nothing decayed in five years');
  assert.ok(kept.condition < 100, 'a maintained system should still age');
  assert.ok(neglected.condition < kept.condition,
    `neglected ${neglected.condition} should be worse than kept ${kept.condition}`);
  assert.ok(neglected.age >= 4.9 && neglected.age <= 5.1);
});

test('an at-risk event fires on the crossing, not every tick after it', () => {
  // Standing rule 7. An event on a CONDITION puts an identical row in
  // the log every tick for as long as it holds, burying the tick it
  // actually became true.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  // **Starts BELOW the threshold**, which the first version of this
  // fixture did not: at condition 20 and age 50 the bridge was already
  // at risk 0.68 on the tick it was built, so there was no crossing to
  // observe and the test reported 0 for the right reason and the wrong
  // one. A crossing test has to begin on the near side of the line.
  const bridge = infrastructure.generateInfrastructure(w, {
    cityId: city.id, type: 'bridges', condition: 55, age: 40, maintenanceLevel: 0,
  });
  assert.ok(infrastructure.failureRisk(bridge) < 0.5, 'the fixture starts already at risk');

  let crossings = 0;
  for (let t = 0; t < 6000; t += 1) {
    crossings += infrastructure.advanceInfrastructure(w, t)
      .filter((e) => e.type === 'infrastructure_at_risk').length;
  }
  assert.equal(crossings, 1, `fired ${crossings} times for one crossing`);
  assert.ok(infrastructure.failureRisk(bridge) >= 0.5, 'it never actually crossed');
});

test('cities.infrastructure is a stored rollup and nothing writes it back', () => {
  // The schema's own comment says "cities.infrastructure is a rollup
  // from this". `generateCity` defaults it to 50 and nothing updates
  // it — the same placeholder shape as `communities.employment`.
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  assert.equal(city.infrastructure, 50, 'the placeholder default');

  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'roads', condition: 30 });
  infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools', condition: 10 });

  const drift = infrastructure.describeCityDrift(w, city.id);
  assert.equal(drift.stored, 50);
  assert.equal(drift.computed, 20);
  assert.equal(drift.drifted, true);
  assert.equal(city.infrastructure, 50, 'describeCityDrift wrote back to the stored column');
});

test('a city with no infrastructure has an unknown condition, not zero', () => {
  const w = world();
  const city = territory.generateCity(w, { name: 'Empty' });
  assert.equal(infrastructure.cityCondition(w, city.id), null);
});

test('a roads row is inventory, not Transportation', () => {
  // CLAUDE.md keeps Transportation deferred — movement, vehicles,
  // routes — and listing a road that wears out is not that. Held by
  // checking the source: nothing here moves anybody or reads a route.
  //
  // **Comments stripped**, and the first version of this test failed
  // without it — on the word "migration" inside a comment explaining
  // why a bad city id is caught early rather than rolling back a
  // migration. Same shape as the urban-systems citation check and the
  // Prison check before it: prose about a thing is not the thing.
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../server/infrastructure.js'), 'utf8');
  const body = src.slice(src.indexOf("'use strict'"))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  for (const forbidden of ['trade_routes', 'tradeRoutes', 'migration', 'relocate', 'travel']) {
    assert.equal(body.includes(forbidden), false,
      `infrastructure.js references ${forbidden}, which is deferred Transportation work`);
  }
});

// ======================================================================
// Demographics
// ======================================================================

test('a language needs a name, and a parent that exists', () => {
  const w = world();
  assert.throws(() => demographics.generateLanguage(w, {}), /requires options.name/);
  assert.throws(() => demographics.generateLanguage(w, { name: 'Creole', parentLanguageId: 9 }),
    /no parent language 9/);

  const root = demographics.generateLanguage(w, { name: 'Riverine' });
  const child = demographics.generateLanguage(w, {
    name: 'Low Riverine', parentLanguageId: root.id,
  });
  assert.equal(child.parent_language_id, root.id);
});

test('exactly one primary language per person, enforced rather than assumed', () => {
  // `entity_languages.is_primary` is a plain BOOLEAN with nothing
  // behind it, so two primaries is a row the database accepts and
  // every composition statistic then double-counts that person.
  const w = world();
  const a = person(w);
  const first = demographics.generateLanguage(w, { name: 'Riverine' });
  const second = demographics.generateLanguage(w, { name: 'Highland' });

  demographics.speakLanguage(w, { entityId: a.id, languageId: first.id, isPrimary: true });
  demographics.speakLanguage(w, { entityId: a.id, languageId: second.id, isPrimary: true });

  const primaries = w.entityLanguages.filter((r) => r.entity_id === a.id && r.is_primary);
  assert.equal(primaries.length, 1);
  assert.equal(demographics.primaryLanguageOf(w, a.id).id, second.id);
  assert.equal(w.entityLanguages.filter((r) => r.entity_id === a.id).length, 2,
    'the first language should still be spoken, just not primary');
});

test('speaking the same language twice updates rather than duplicating', () => {
  const w = world();
  const a = person(w);
  const lang = demographics.generateLanguage(w, { name: 'Riverine' });
  demographics.speakLanguage(w, { entityId: a.id, languageId: lang.id, proficiency: 40 });
  demographics.speakLanguage(w, { entityId: a.id, languageId: lang.id, proficiency: 90 });
  assert.equal(w.entityLanguages.length, 1);
  assert.equal(w.entityLanguages[0].proficiency, 90);
});

test('unrecorded people are counted as unknown, not dropped and not defaulted', () => {
  // **A block where nobody's religion has been recorded and a block
  // that is uniformly one religion are opposite findings**, and
  // silently dropping the unknowns makes the first look like the
  // second.
  const w = world();
  const people = [
    person(w, { religion: 'Tidewater' }),
    person(w, { religion: 'Tidewater' }),
    person(w),
  ];
  const distribution = demographics.distributionOf(people, (n) => n.religion);
  assert.equal(distribution.total, 3);
  const unknown = distribution.rows.find((r) => r.value === 'unknown');
  assert.equal(unknown.count, 1);
  assert.equal(unknown.share, 0.3333);

  // And it is excluded from the index, because counting it as a
  // category makes an unrecorded population read as a diverse one.
  assert.equal(demographics.diversityOf(distribution), 0, 'everybody recorded shares one value');
  assert.equal(demographics.dominantShareOf(distribution), 1);
});

test('diversity is 0 for one value and rises as a population fragments', () => {
  const w = world();
  const uniform = [person(w, { religion: 'A' }), person(w, { religion: 'A' })];
  const split = [person(w, { religion: 'A' }), person(w, { religion: 'B' })];
  const four = ['A', 'B', 'C', 'D'].map((religion) => person(w, { religion }));

  assert.equal(demographics.diversityOf(demographics.distributionOf(uniform, (n) => n.religion)), 0);
  assert.equal(demographics.diversityOf(demographics.distributionOf(split, (n) => n.religion)), 0.5);
  assert.equal(demographics.diversityOf(demographics.distributionOf(four, (n) => n.religion)), 0.75);
});

test('a population with nothing recorded has an unknown diversity, not zero', () => {
  const w = world();
  const nobody = [person(w), person(w)];
  const distribution = demographics.distributionOf(nobody, (n) => n.religion);
  assert.equal(demographics.diversityOf(distribution), null);
  assert.equal(demographics.dominantShareOf(distribution), null);
});

test('education has a direction, so a mean is meaningful where a mean religion is not', () => {
  const w = world();
  const people = [
    person(w, { education: 'none' }),
    person(w, { education: 'higher' }),
    person(w, { education: 'nonsense' }),
  ];
  const composition = demographics.compositionOf(w, people);
  // 'none' is index 0, 'higher' is index 4; 'nonsense' is not a level
  // and contributes nothing rather than a zero.
  assert.equal(composition.education.meanLevel, 2);
  assert.equal(demographics.EDUCATION_LEVELS.length, 6);
});

// ======================================================================
// What both unlock in the catalogue
// ======================================================================

test('the demographic block is computed from real records', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const riverine = demographics.generateLanguage(w, { name: 'Riverine' });
  const highland = demographics.generateLanguage(w, { name: 'Highland' });

  const a = person(w, { communityId: c.id, religion: 'Tidewater', education: 'higher' });
  const b = person(w, { communityId: c.id, religion: 'Tidewater', education: 'secondary' });
  const d = person(w, { communityId: c.id, religion: 'Ridge', education: 'basic' });
  const e = person(w, { communityId: c.id });
  demographics.speakLanguage(w, { entityId: a.id, languageId: riverine.id, isPrimary: true });
  demographics.speakLanguage(w, { entityId: b.id, languageId: riverine.id, isPrimary: true });
  demographics.speakLanguage(w, { entityId: d.id, languageId: highland.id, isPrimary: true });
  void e;

  const s = statistics.profileFor(w, c.id).statistics;
  assert.equal(s.dominant_religion_share.value, 0.6667, 'two of the three recorded');
  assert.equal(s.religious_diversity.value, 0.4444);
  assert.equal(s.dominant_language_share.value, 0.6667);
  assert.equal(s.demographics_recorded_share.value, 0.75, 'three of four residents recorded');
  assert.ok(s.educational_attainment.value > 0);
});

test('race and ethnicity stay a declared absence with the §9 clause attached', () => {
  // A decision, not a gap, and held by a test so it cannot be undone
  // by accident: no column exists, no document asks for one, and §9
  // makes adding one something to do explicitly.
  const entry = statistics.unavailable().find((e) => e.key === 'race_and_ethnicity_composition');
  assert.ok(entry);
  assert.match(entry.reason, /deliberately absent rather than missing/);
  assert.match(entry.reason, /morality, criminality, intelligence or worth/);
});

test('nothing that decides anything reads a demographic', () => {
  // **§9's clause, held structurally.** "The system supports
  // demographic modeling without making demographics determine an
  // NPC's morality, criminality, intelligence, or worth." Composition
  // as a statistic is legitimate; a demographic that predicts
  // behaviour is what the spec forbids, so every module that decides
  // something is checked for a read of this one.
  const fs = require('node:fs');
  const path = require('node:path');
  const serverDir = path.join(__dirname, '..', 'server');
  const deciders = ['keys.js', 'contest.js', 'crime.js', 'births.js', 'mortality.js',
    'behavior.js', 'actions.js', 'politics.js', 'missions.js', 'flows.js'];

  for (const file of deciders) {
    const src = fs.readFileSync(path.join(serverDir, file), 'utf8');
    assert.equal(/require\(['"]\.\/demographics\.js['"]\)/.test(src), false,
      `${file} imports demographics.js — §9 forbids a demographic determining behaviour`);
  }
});

test('the engine WorldState carries all three new arrays', () => {
  // Standing rule 6: a module writing to an array the real WorldState
  // does not declare writes to `undefined`, and nothing notices until
  // a restore.
  assert.ok(Array.isArray(engine.WorldState.infrastructure));
  assert.ok(Array.isArray(engine.WorldState.languages));
  assert.ok(Array.isArray(engine.WorldState.entityLanguages));
});

test('ids survive a reseed for both new counters', () => {
  const w = world();
  const city = territory.generateCity(w, { name: 'Riverton' });
  w.infrastructure.push({ id: 30, city_id: city.id, type: 'roads' });
  w.languages.push({ id: 12, name: 'Old Riverine' });
  assert.deepEqual(infrastructure.reseedIds(w), { nextInfrastructureId: 31 });
  assert.deepEqual(demographics.reseedIds(w), { nextLanguageId: 13 });

  assert.equal(
    infrastructure.generateInfrastructure(w, { cityId: city.id, type: 'schools' }).id, 31,
  );
  assert.equal(demographics.generateLanguage(w, { name: 'New Riverine' }).id, 13);
});
