// How far the state's rule actually reaches, area by area.
//
// **The correction this file holds.** `server/justice.js` shipped with
// law as a city-wide absolute: a city with a property statute convicted
// every thief in every block of it. The owner's model is different and
// better — government and law are a scale of trust, lawlessness occurs
// in certain areas, groups and small groups keep their own law, and a
// city may maintain government rule without that being a guarantee
// after the reset. All of it from stats and NPCs.
//
// ---------------------------------------------------------------------
// What had to be fixed before any of it could vary
//
// **Every community in every world was identical.**
// `communities.housing`, `safety`, `employment`, `education` and
// `reputation` all sat at the schema default of 50 and `crime` at 0,
// and nothing anywhere wrote one of them — so `getCommunityHealth`
// returned exactly 50 for every area ever generated and city
// reemergence was 37 or 38 in every world. Six communities across two
// cities, identical to the integer. A settlement cannot be rougher than
// the one next to it if the engine has no field in which they differ.
//
// **And every building collapsed.** Property condition decayed 0.4 a
// tick with nothing anywhere restoring it: 38 properties, condition
// 30..96 at generation, and min 0 / median 0 / max 0 by tick 300, with
// the lifecycle stage still reading `operation`. That is the thirteenth
// standing rule for the third time in one session — resources had it,
// habits had it, buildings had it — and it made `housing` read 0 in
// every populated area the moment anything computed it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const authority = require('../server/authority.js');
const territory = require('../server/territory.js');
const property = require('../server/property.js');
const policing = require('../server/policing.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

// A world with exactly the four readings the writ is made of, and
// nothing else. **Standing rule 8**: the subject is constructed, not
// generated, so each assertion is about the thing it names.
function stateWorld({
  trust = null, safetyCapacity = null, safetyCondition = 100,
  factionHold = null, blockStatus = 'controlled', approval = null, residents = 2,
} = {}) {
  const w = {
    tick: 100,
    communities: [{ id: 9, city_id: 1 }],
    cities: [{ id: 1 }],
    npcs: Array.from({ length: residents }, (_, i) => ({ id: i + 1, communityId: 9 })),
    infrastructure: safetyCapacity === null ? [] : [{
      id: 1, city_id: 1, type: 'public_safety', capacity: safetyCapacity,
      condition: safetyCondition, maintenance_level: 50, age: 0,
    }],
    territoryBlocks: factionHold === null ? [] : [{
      id: 1, faction_id: 50, city_id: 1, community_id: 9, status: blockStatus,
    }],
    organizations: [],
    entityTraits: [], beliefs: [], publicOpinion: [], governments: [],
    crimeIncidents: [], courtCases: [], groupSanctions: [],
  };

  // **A faction's hold has to be built through the real generator.**
  // `authority.gripTerm` reads its traits through `getLiveEntity`,
  // which is standing rule 9 doing its job — the denormalised
  // `org.traits` sheet is frozen at generation and the live values are
  // the `entity_traits` rows. A fixture that set the sheet directly
  // measured nothing, which is exactly the failure that rule exists for
  // and which this test found in its own setup.
  if (factionHold !== null) {
    const faction = engine.generateFaction({
      name: 'Holders', type: 'gang', traitValueFor: () => factionHold,
    });
    w.organizations.push(faction);
    w.territoryBlocks[0].faction_id = faction.id;
    w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === faction.id);
  }
  if (trust !== null) {
    for (const npc of w.npcs) {
      w.beliefs.push({
        id: npc.id, entity_id: npc.id, belief_name: policing.TRUST_BELIEF,
        belief_type: policing.TRUST_BELIEF_TYPE, strength: trust, tick: 0,
      });
    }
  }
  if (approval !== null) {
    w.governments = [{ organization_id: 70, system_type: 'council' }];
    w.publicOpinion = [{
      city_id: null, topic: 'government:70', approval_score: approval, tick: 1,
    }];
  }
  return w;
}

// -- all three bands are reachable ----------------------------------------

test('a state can rule, half-rule, or not reach at all', () => {
  // **The check that matters most.** A three-band scale where two bands
  // are unreachable is one band with decoration — the same defect as a
  // threshold whose writer sits behind it.
  const governed = authority.writOf(stateWorld({
    trust: 90, safetyCapacity: 100, safetyCondition: 100, approval: 85,
  }), 9);
  const ordinary = authority.writOf(stateWorld({
    trust: 50, safetyCapacity: 10, safetyCondition: 80, approval: 50,
  }), 9);
  const failed = authority.writOf(stateWorld({
    trust: 10, safetyCapacity: 1, safetyCondition: 10, approval: 15,
  }), 9);

  assert.equal(governed.regime, 'governed', `strong state read ${governed.writ}`);
  assert.equal(ordinary.regime, 'contested', `ordinary state read ${ordinary.writ}`);
  assert.equal(failed.regime, 'lawless', `collapsed state read ${failed.writ}`);
  assert.ok(governed.writ > ordinary.writ && ordinary.writ > failed.writ);
});

test('unobserved is not ungoverned', () => {
  // A place the engine knows nothing about has no reading. Treating
  // that as lawlessness would declare every fresh world ungoverned
  // before anything had happened in it — unknown is not zero, in the
  // place where getting it wrong is loudest.
  const nothing = authority.writOf(stateWorld({}), 9);
  assert.equal(nothing.writ, null);
  assert.equal(nothing.regime, null);

  // And the state still prosecutes there, because it has not been shown
  // to have failed.
  const decision = authority.prosecutes(stateWorld({}), 9, 'theft');
  assert.equal(decision.prosecutes, true);
  assert.equal(decision.reason, 'unmeasured');
});

test('standing scales the reading, it does not average into it', () => {
  // **Measured, and the measurement forced the shape.** As a fourth
  // averaged term, government approval — one number for the whole world
  // — pulled six areas into the range 0.525..0.621, every one of them
  // contested, with two of the three bands unreachable. A term that is
  // not about this place cannot distinguish this place; all it can do
  // is compress the range.
  const base = { trust: 80, safetyCapacity: 100, safetyCondition: 100 };
  const noGovernment = authority.writOf(stateWorld(base), 9);
  const backed = authority.writOf(stateWorld({ ...base, approval: 100 }), 9);
  const despised = authority.writOf(stateWorld({ ...base, approval: 0 }), 9);

  assert.ok(backed.writ > noGovernment.writ, 'a popular government reaches no further');
  assert.ok(despised.writ < noGovernment.writ, 'a hated government reaches just as far');

  // Centred: an average government changes nothing, so the day approval
  // started being read no area moved. Standing rule 12's first clause.
  const average = authority.writOf(stateWorld({ ...base, approval: 50 }), 9);
  assert.equal(average.writ, noGovernment.writ,
    'reading an average government\'s approval moved every area in the world');
});

test('somebody else holding the ground is the state not holding it', () => {
  const clear = authority.writOf(stateWorld({
    trust: 60, safetyCapacity: 50, factionHold: null,
  }), 9);
  const held = authority.writOf(stateWorld({
    trust: 60, safetyCapacity: 50, factionHold: 90, blockStatus: 'fortified',
  }), 9);
  assert.ok(held.writ < clear.writ,
    'a fortified gang block makes no difference to how far the state rules');

  // A faction losing its grip holds less of it.
  const slipping = authority.writOf(stateWorld({
    trust: 60, safetyCapacity: 50, factionHold: 90, blockStatus: 'contested',
  }), 9);
  assert.ok(slipping.writ > held.writ);

  // And who that is, for the group-law half.
  const w = stateWorld({ factionHold: 90, blockStatus: 'fortified' });
  assert.equal(authority.holderOf(w, 9), w.organizations[0].id);
  assert.equal(authority.holderOf(stateWorld({}), 9), null);
});

test('rotted policing is not policing', () => {
  const kept = authority.writOf(stateWorld({ trust: 50, safetyCapacity: 100, safetyCondition: 100 }), 9);
  const rotted = authority.writOf(stateWorld({ trust: 50, safetyCapacity: 100, safetyCondition: 10 }), 9);
  assert.ok(rotted.writ < kept.writ,
    'a station at 10 condition polices as well as one at 100');
});

// -- what the state answers where it half-reaches -------------------------

test('a contested area answers what it cannot ignore, and lets the rest go', () => {
  const w = stateWorld({ trust: 50, safetyCapacity: 10, safetyCondition: 80, approval: 50 });
  assert.equal(authority.writOf(w, 9).regime, 'contested');

  const crime = require('../server/crime.js');
  for (const category of Object.keys(crime.CATEGORIES)) {
    const decision = authority.prosecutes(w, 9, category);
    const serious = crime.SEVERITY[category] >= authority.CONTESTED_SEVERITY_FLOOR;
    assert.equal(decision.prosecutes, serious,
      `${category} (severity ${crime.SEVERITY[category]}) was `
      + `${decision.prosecutes ? 'prosecuted' : 'let go'} in a contested area`);
  }
});

test('a lawless area answers nothing, however serious', () => {
  const w = stateWorld({ trust: 10, safetyCapacity: 1, safetyCondition: 10, approval: 15 });
  assert.equal(authority.writOf(w, 9).regime, 'lawless');
  for (const category of ['violent', 'gun', 'theft', 'property']) {
    assert.equal(authority.prosecutes(w, 9, category).prosecutes, false,
      `the state prosecuted ${category} somewhere it does not reach`);
  }
});

// -- areas differ, which they did not ------------------------------------

test('community conditions are computed from what happens there', () => {
  // Every one of these was the schema default in every world.
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 3, populationPerCommunity: 20, seed: 'auth',
  });
  for (let t = 0; t < 200; t += 1) engine.advanceTick();

  const populated = w.communities.filter((c) => c.population > 0);
  assert.ok(populated.length >= 2, 'not enough populated areas to compare');

  const varies = (field) => new Set(populated.map((c) => c[field])).size > 1;
  assert.ok(varies('employment') || varies('education') || varies('housing'),
    'every populated community reports identical conditions, which is the state this was '
    + 'built to leave: housing/safety/employment/education all sat at 50 in every world');

  // And health is no longer 50 everywhere.
  const healths = new Set(populated.map((c) => territory.getCommunityHealth(c)));
  assert.equal(healths.has(50) && healths.size === 1, false,
    'community health is 50 in every area again');
});

test('a community with nobody in it reads as unmeasured, not as ruined', () => {
  // An emptied area kept `crime: 100` and `safety: 100` side by side,
  // which is not a fact about anywhere.
  const w = {
    tick: 10,
    communities: [{
      id: 1, city_id: 1, population: 0, housing: 40, crime: 100, safety: 100,
      employment: 100, education: 30, reputation: 50,
    }],
    cities: [{ id: 1 }], npcs: [], properties: [], crimeIncidents: [],
    employmentRecords: [], infrastructure: [], entityLanguages: [], languages: [],
  };
  territory.refreshCommunityConditions(w, { tick: 10 });

  const [community] = w.communities;
  for (const field of ['crime', 'safety', 'employment', 'education']) {
    assert.equal(community[field], null, `${field} kept a stale reading for an empty area`);
  }
  // Housing is not cleared — the buildings are still standing whether
  // or not anybody is in them.
  assert.equal(community.housing, 40);
});

test('the health of a community with nobody in it is nothing, not zero', () => {
  assert.equal(territory.getCommunityHealth({
    housing: null, safety: null, employment: null, education: null,
    reputation: null, crime: null,
  }), null);
  assert.equal(territory.getCommunityHealth(null), null);
});

// -- buildings stay up if somebody keeps them up --------------------------

test('a lived-in, owned home holds; an empty one rots', () => {
  // **The third one-way ratchet.** Condition fell 0.4 a tick with
  // nothing restoring it, so every building in every world was at 0 by
  // tick 300 and `communities.housing` read 0 everywhere.
  const w = { tick: 0, properties: [], ownershipRecords: [] };
  const lived = {
    id: 1, condition: 80, age: 10, lifecycle_stage: 'operation', occupants: [1, 2],
  };
  const empty = {
    id: 2, condition: 80, age: 10, lifecycle_stage: 'operation', occupants: [],
  };
  w.properties.push(lived, empty);
  w.ownershipRecords.push({
    id: 1, entity_id: 1, owner_entity_id: 7, owner_type: 'individual',
    acquired_tick: 0, acquired_method: 'purchase', released_tick: null,
  });

  for (let t = 1; t <= 200; t += 1) {
    property.advancePropertyLifecycle(w, lived, t);
    property.advancePropertyLifecycle(w, empty, t);
  }

  assert.ok(lived.condition > 80,
    `a home somebody lives in and somebody owns fell to ${lived.condition}`);
  assert.equal(empty.condition, 0, 'a building nobody lives in or owns never decayed');

  // Both halves count, and neither alone holds a building up.
  assert.ok(property.OCCUPANT_UPKEEP_PER_TICK + property.OWNER_UPKEEP_PER_TICK
    > property.CONDITION_DECAY_PER_TICK);
  assert.ok(property.OCCUPANT_UPKEEP_PER_TICK < property.CONDITION_DECAY_PER_TICK);
  assert.ok(property.OWNER_UPKEEP_PER_TICK < property.CONDITION_DECAY_PER_TICK);
});

// -- the statistics ------------------------------------------------------

test('a settlement can report which regime it is under', () => {
  const w = engine.WorldState;
  const profile = statistics.profileFor(w, w.communities[0].id);
  assert.equal(profile.statistics.state_authority.known, true,
    'a generated world cannot say how far its government reaches');
  assert.equal(profile.statistics.state_authority.category, 'crime');

  const writ = profile.statistics.state_authority.value;
  assert.ok(writ >= 0 && writ <= 1);
  assert.ok(authority.REGIMES.includes(authority.regimeFor(writ)));

  // The two that report what the state let go. Null where it has
  // declined nothing, which is different from declining and nobody
  // stepping in.
  for (const key of ['state_declined_share', 'group_answered_share']) {
    const cell = profile.statistics[key];
    assert.ok(cell, `${key} is not in the catalogue`);
    assert.equal(cell.unit, 'share');
    assert.ok(cell.value === null || (cell.value >= 0 && cell.value <= 1));
  }
});
