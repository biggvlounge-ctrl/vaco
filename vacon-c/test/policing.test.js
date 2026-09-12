// The other half of the Security phase — the half that did nothing.
//
// `urbanSystems.js` said so in system 13's own note since it was
// written: "One phase covers this and Crime together. No patrols,
// investigations, raids, arrests or clearance rates." The crime half
// became real with server/crime.js; until this file existed, §9's
// SURVEILLANCE block was the one category in the whole catalogue with
// nothing computed at all — four declared gaps out of four — and
// `police_trust` had no institution to be trust in.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const beliefs = require('../server/beliefs.js');
const crime = require('../server/crime.js');
const economy = require('../server/economy.js');
const infrastructure = require('../server/infrastructure.js');
const policing = require('../server/policing.js');
const statistics = require('../server/statistics.js');
const territory = require('../server/territory.js');

let nextId = 200000;

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
    beliefs: [],
    nextEntityId: 1,
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  crime.reseedIds(worldState);
  infrastructure.reseedIds(worldState);
  beliefs.reseedIds(worldState);
  return worldState;
}

function person(worldState, communityId = null) {
  const npc = {
    id: nextId++, status: 'active', communityId, home_property_id: null,
    createdTick: 0, updatedTick: worldState.tick, generation: 1,
  };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings: 100, tick: worldState.tick });
  return npc;
}

// A city, a block, residents, and optionally a police capacity.
function place(worldState, { residents = 10, capacity = null, condition = 100 } = {}) {
  const city = territory.generateCity(worldState, { name: `City ${nextId++}` });
  const community = territory.generateCommunity(worldState, { cityId: city.id });
  const people = [];
  for (let i = 0; i < residents; i += 1) people.push(person(worldState, community.id));
  if (capacity !== null) {
    infrastructure.generateInfrastructure(worldState, {
      cityId: city.id, type: 'public_safety', capacity, condition,
    });
  }
  return { city, community, people };
}

// -- capacity -----------------------------------------------------------

test('a world that never built a police station has unknown capacity, not zero', () => {
  // The distinction every statistic in this project has had to make at
  // least once: a city with no public safety infrastructure is not a
  // city with an overwhelmed one.
  const w = world();
  const { city, community } = place(w, { residents: 10 });
  assert.equal(policing.policingCapacity(w, city.id, 10), null);
  assert.equal(policing.patrolsPer1k(w, community.id), null);
  assert.equal(policing.clearanceRate(w, community.id), null);
});

test('capacity is per resident and scaled by condition', () => {
  const w = world();
  const full = place(w, { residents: 100, capacity: 2, condition: 100 });
  const decayed = place(w, { residents: 100, capacity: 2, condition: 50 });
  const stretched = place(w, { residents: 1000, capacity: 2, condition: 100 });

  const a = policing.policingCapacity(w, full.city.id, 100);
  const b = policing.policingCapacity(w, decayed.city.id, 100);
  const c = policing.policingCapacity(w, stretched.city.id, 1000);

  assert.equal(a, 1, '2 units for 100 residents is the full-capacity ratio');
  assert.ok(b < a, 'a decayed station should provide less');
  assert.ok(c < a, 'the same station stretched over ten times the people should provide less');
});

test('a city that lets public safety decay clears fewer crimes, with no second mechanism', () => {
  // The connection worth having: clearance reads the same rows the
  // capacity came from, so infrastructure decay reaches policing
  // without anything being wired between them.
  const w = world();
  const { city, community } = place(w, { residents: 100, capacity: 2, condition: 100 });
  const incident = { id: 1, category: 'theft', victim_entity_id: 5, community_id: community.id };

  const before = policing.clearanceChance(w, incident, {
    capacity: policing.policingCapacity(w, city.id, 100),
  });
  for (let t = 0; t < 365 * 30; t += 1) infrastructure.advanceInfrastructure(w, t);
  const after = policing.clearanceChance(w, incident, {
    capacity: policing.policingCapacity(w, city.id, 100),
  });

  assert.ok(after < before, `thirty years of decay did not reduce clearance (${before} -> ${after})`);
});

test('a case with a victim is likelier to be cleared than one without', () => {
  // True of real clearance rates, and mechanically right here: a
  // victim is a witness this engine actually has.
  const w = world();
  const { city } = place(w, { residents: 100, capacity: 2 });
  const capacity = policing.policingCapacity(w, city.id, 100);
  const withVictim = policing.clearanceChance(w, { victim_entity_id: 7 }, { capacity });
  const without = policing.clearanceChance(w, { victim_entity_id: null }, { capacity });
  assert.ok(withVictim > without);
});

// -- investigating ------------------------------------------------------

test('an incident starts in a third state: not solved, not failed, not looked at', () => {
  // **`cleared` is nullable for this reason.** Defaulting it to false
  // would make every incident ever recorded count against the
  // clearance rate from the moment it happened, so an area's rate
  // would fall every time somebody committed a crime rather than every
  // time one went unsolved.
  const w = world();
  const { community, people } = place(w, { residents: 10, capacity: 1 });
  const incident = crime.recordCrime(w, {
    category: 'theft', perpetratorId: people[0].id, victimId: people[1].id,
  });

  assert.equal(incident.investigated_tick, null);
  assert.equal(incident.cleared, null);
  assert.equal(policing.clearanceRate(w, community.id), null,
    'an uninvestigated case produced a clearance rate');
  assert.deepEqual(policing.caseload(w, community.id),
    { total: 1, investigated: 0, cleared: 0, open: 1 });
});

test('nothing is investigated on the tick it happened, and a case is investigated once', () => {
  const w = world();
  const { community, people } = place(w, { residents: 10, capacity: 1 });
  const incident = crime.recordCrime(w, {
    category: 'violent', perpetratorId: people[0].id, victimId: people[1].id, tick: w.tick,
  });

  assert.equal(policing.runPolicing(w, w.tick).resolved.length, 0,
    'a case solved the instant it is committed is not an investigation');
  const later = w.tick + policing.INVESTIGATION_DELAY_TICKS;
  assert.equal(policing.runPolicing(w, later).resolved.length, 1);
  assert.equal(policing.runPolicing(w, later + 10).resolved.length, 0, 'reinvestigated');

  assert.throws(() => policing.investigate(w, { incidentId: incident.id }),
    /has already been investigated/);
  assert.throws(() => policing.investigate(w, { incidentId: 99999 }), /no crime incident/);
});

test('an incident with no community is closed rather than left pending forever', () => {
  // There is no local force to investigate it and nobody whose trust
  // could move, so the backlog stays real cases rather than
  // unplaceable ones.
  const w = world();
  const drifter = person(w);
  const incident = crime.recordCrime(w, { category: 'property', perpetratorId: drifter.id });
  assert.equal(incident.community_id, null);

  policing.runPolicing(w, w.tick + 100);
  assert.equal(incident.investigated_tick, w.tick + 100);
  assert.equal(incident.cleared, false);
});

test('a capable force clears cases and an absent one clears none', () => {
  // The control matters most: if the force-less world still clears
  // cases, clearance is not reading capacity at all.
  function run({ capacity }) {
    const w = world();
    const { community, people } = place(w, { residents: 50, capacity });
    for (let i = 0; i < 60; i += 1) {
      crime.recordCrime(w, {
        category: 'theft', perpetratorId: people[i % 50].id,
        victimId: people[(i + 1) % 50].id, tick: i,
      });
    }
    policing.runPolicing(w, 500);
    return policing.caseload(w, community.id);
  }

  const policed = run({ capacity: 2 });
  const unpoliced = run({ capacity: null });

  assert.equal(policed.investigated, 60);
  assert.ok(policed.cleared > 0, 'a well-resourced force cleared nothing in sixty cases');
  assert.equal(unpoliced.investigated, 60, 'cases should still be closed, just not solved');
  assert.equal(unpoliced.cleared, 0, 'a world with no police force solved a crime');
});

test('the same world clears the same cases', () => {
  // §88's replay guarantee.
  function run() {
    nextId = 300000;
    const w = world();
    const { community, people } = place(w, { residents: 20, capacity: 1 });
    for (let i = 0; i < 40; i += 1) {
      crime.recordCrime(w, {
        category: 'theft', perpetratorId: people[i % 20].id,
        victimId: people[(i + 1) % 20].id, tick: i,
      });
    }
    policing.runPolicing(w, 500);
    return crime.incidentsIn(w, community.id).map((i) => `${i.id}:${i.cleared}`);
  }
  const first = run();
  const second = run();
  assert.ok(first.length > 0);
  assert.deepEqual(first, second);
  nextId = 400000;
});

// -- trust --------------------------------------------------------------

test('trust is measured from what residents believe, not derived from clearance', () => {
  // A formula over the clearance rate would be the clearance rate
  // under a name promising something else. This reads `beliefs`, which
  // every case in the area has moved.
  const w = world();
  const { community, people } = place(w, { residents: 10, capacity: 2 });
  assert.equal(policing.trustIn(w, community.id), null,
    'nothing has happened here yet — unknown, not neutral');

  const incident = crime.recordCrime(w, {
    category: 'theft', perpetratorId: people[0].id, victimId: people[1].id, tick: 0,
  });
  const outcome = policing.investigate(w, { incidentId: incident.id, tick: 100 });

  const trust = policing.trustIn(w, community.id);
  assert.ok(trust !== null);
  if (outcome.cleared) {
    assert.ok(trust > beliefs.NEUTRAL_STRENGTH, 'a cleared case should raise trust');
  } else {
    assert.ok(trust < beliefs.NEUTRAL_STRENGTH, 'an unsolved case should lower trust');
  }

  // The belief is a real row of the right type, not a number kept
  // somewhere private.
  const held = beliefs.findBelief(w, people[0].id, policing.TRUST_BELIEF);
  assert.equal(held.belief_type, 'political');
});

test('unsolved crime erodes trust, and only where it happened', () => {
  const w = world();
  const bad = place(w, { residents: 10, capacity: null });     // no force at all
  const quiet = place(w, { residents: 10, capacity: 2 });

  for (let i = 0; i < 20; i += 1) {
    crime.recordCrime(w, {
      category: 'violent', perpetratorId: bad.people[0].id,
      victimId: bad.people[1].id, tick: i,
    });
  }
  policing.runPolicing(w, 500);

  assert.ok(policing.trustIn(w, bad.community.id) < beliefs.NEUTRAL_STRENGTH);
  assert.equal(policing.trustIn(w, quiet.community.id), null,
    'a burglary three cities away moved somebody\'s trust');
});

// -- the boundary this deliberately stops at ----------------------------

test('clearance is not arrest, and Prison stays absent', () => {
  // §7's Prison system is `absent` and schema-extensions.sql records
  // that `imprisoned` was deliberately NOT added as an entity status.
  // Building arrests without anywhere to put anybody would mean
  // inventing a prison or quietly releasing everybody.
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../server/policing.js'), 'utf8');
  const body = src.slice(src.indexOf("'use strict'"))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  for (const forbidden of ['imprison', 'arrest', 'sentence', 'charge']) {
    assert.equal(new RegExp(forbidden, 'i').test(body), false,
      `policing.js models ${forbidden}, which needs the Prison system §7 marks absent`);
  }

  const w = world();
  const { people } = place(w, { residents: 5, capacity: 2 });
  const incident = crime.recordCrime(w, {
    category: 'violent', perpetratorId: people[0].id, victimId: people[1].id, tick: 0,
  });
  policing.investigate(w, { incidentId: incident.id, tick: 100 });
  assert.equal(people[0].status, 'active', 'clearing a case changed the offender\'s status');
});

// -- what it unlocks in the catalogue -----------------------------------

test('the surveillance block is no longer entirely unanswered', () => {
  // It was 0 of 4 — the one §9 category in the whole catalogue with
  // nothing computed at all — and the reason was one system rather
  // than four.
  const w = world();
  const { community, people } = place(w, { residents: 20, capacity: 3 });
  for (let i = 0; i < 10; i += 1) {
    crime.recordCrime(w, {
      category: 'theft', perpetratorId: people[i].id, victimId: people[i + 1].id, tick: i,
    });
  }
  policing.runPolicing(w, 500);

  const s = statistics.profileFor(w, community.id).statistics;
  assert.equal(s.patrol_frequency.known, true);
  assert.equal(s.patrol_frequency.value, 150, '3 units of capacity for 20 residents');
  assert.equal(s.clearance_rate.known, true);
  assert.equal(s.open_cases_per_1k.value, 0, 'every case has been investigated');
  assert.equal(s.public_safety_trust.known, true);

  const declared = statistics.unavailable().map((e) => e.key);
  assert.equal(declared.includes('patrol_frequency'), false);
  assert.equal(declared.includes('police_trust'), false);
});

test('the three surveillance statistics that remain say what they still need', () => {
  // Honest about the boundary: cameras, lighting and private security
  // have no substrate anywhere in the schema, and the fix for those is
  // not another engine module.
  const remaining = statistics.unavailable()
    .filter((e) => e.category === 'surveillance')
    .map((e) => e.key)
    .sort();
  assert.deepEqual(remaining, ['camera_coverage', 'private_security_presence', 'street_lighting']);
  for (const entry of statistics.unavailable().filter((e) => e.category === 'surveillance')) {
    assert.ok(entry.reason.length > 60);
  }
});
