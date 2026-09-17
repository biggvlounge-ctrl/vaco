// What the state spends, where it reaches, and what a city is for.
//
// ---------------------------------------------------------------------
// The finding this file exists for
//
// Three of §7's forty urban systems were still `absent` with nothing
// written under the level — 20 Government Services, 35 Military /
// National Guard, 36 Tourism — and the reason was not that they were
// hard. It was that nobody had opened the right document.
//
// `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` defines FIVE tier-level trait
// sheets: FAMILY, ORGANIZATION, CITY, CIVILIZATION and CULTURE. The
// engine built four. `grep -rn "CITY_TRAIT\|CIVILIZATION_TRAIT\|
// tourism" server/*.js` returned nothing at all — thirty-three named
// dimensions that existed only in a document, and §7's three remaining
// gaps were sitting in them: `tourism` is a CITY dimension, and
// `military`, `healthcare`, `education` and `security` are
// CIVILIZATION ones. §49 CITY DNA names "tourism city" and "military
// city" among the nine identities a city can have.
//
// ---------------------------------------------------------------------
// What the suite could not have caught, and now can
//
// Two of the four assertions below are about shapes no fixture would
// ever produce:
//
//   - **`deliverTo` must be idempotent.** Its first version added the
//     §49 DNA upkeep to the row's own `maintenance_level`, so a port's
//     roads climbed fifteen points every quarter and pinned at 100
//     inside two years. That is the fifth one-way ratchet this project
//     has found and the first caught before it shipped. A delivery
//     pass run twice on an unchanged world must leave it unchanged.
//
//   - **The garrison must be centred at zero.** `authority.gripTerm`
//     folds it in, and standing rule 12's first clause says a modifier
//     centred anywhere but zero recalibrates every world the day it
//     starts being read. Held by building the same world twice and
//     zeroing the priority in one of them.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const statecraft = require('../server/statecraft.js');
const tierTraits = require('../server/tierTraits.js');
const authority = require('../server/authority.js');
const territory = require('../server/territory.js');
const infrastructure = require('../server/infrastructure.js');
const demographics = require('../server/demographics.js');
const urbanSystems = require('../server/urbanSystems.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');

// ---------------------------------------------------------------------
// A world with exactly what statecraft reads, and nothing else.
//
// **Standing rule 8**: the subject is constructed, not generated, so
// each assertion is about the thing it names. `generateWorld` also
// APPENDS to a shared WorldState, which is the trap that has cost this
// project two test timeouts.
// ---------------------------------------------------------------------
function stateWorld({
  priorities = { healthcare: 50, education: 50, security: 50, military: 50 },
  economy = 60,
  dna = null,
  tourism = null,
  writ = null,
  schoolCondition = 80,
  schoolFailedSince = null,
  extraInfrastructure = [],
  students = 0,
  tick = 100,
} = {}) {
  const w = {
    tick,
    seed: 'statecraft-test',
    cities: [{
      id: 1,
      name: 'Testbed',
      economy,
      safety: 50,
      infrastructure: 70,
      growth: 0,
      population: 0,
      dna,
      traits: tierTraits.cityTraits(tourism === null ? {} : { tourism }),
    }],
    communities: [{ id: 9, city_id: 1, safety: 50, employment: 50, education: 50, crime: 0, housing: 50, reputation: 50, population: 0 }],
    civilizations: priorities === null
      ? []
      : [{ id: 1, name: 'State', era: null, stability_index: 50, traits: tierTraits.civilizationTraits(priorities) }],
    npcs: [],
    resources: [],
    cultures: [],
    cultureMemberships: [],
    territoryBlocks: [],
    deceased: [],
    historicalRecords: [],
    infrastructure: [
      {
        id: 1, city_id: 1, type: 'hospitals', capacity: 60, condition: 80,
        maintenance_level: 50, funding: 50, age: 0, failed_since_tick: null, repair_ticks: null,
      },
      {
        id: 2, city_id: 1, type: 'schools', capacity: 400, condition: schoolCondition,
        maintenance_level: 50, funding: 50, age: 0,
        failed_since_tick: schoolFailedSince, repair_ticks: null,
      },
      {
        id: 3, city_id: 1, type: 'public_safety', capacity: 50, condition: 80,
        maintenance_level: 50, funding: 50, age: 0, failed_since_tick: null, repair_ticks: null,
      },
      ...extraInfrastructure,
    ],
  };

  for (let i = 0; i < students; i += 1) {
    w.npcs.push({
      id: 100 + i,
      communityId: 9,
      // Ten years old at the fixture's tick, so squarely inside the
      // school window — and stated rather than drawn, because standing
      // rule 8 is about exactly this.
      createdTick: tick - (10 * 365),
      education: 'basic',
      status: 'alive',
    });
  }
  w.communities[0].population = w.npcs.length;

  // `writ` is a stub when supplied: the writ itself has its own file
  // and its own tests, and re-deriving it here would make every
  // assertion below a test of `authority.js` instead.
  const writMap = writ === null ? null : new Map([[9, { writ, regime: authority.regimeFor(writ) }]]);
  return { w, writMap };
}

// ---------------------------------------------------------------------
// The reconciliation
// ---------------------------------------------------------------------

test('both tier sheets store only the dimensions nothing else answers', () => {
  assert.equal(tierTraits.CITY_TRAIT_NAMES.length, 12);
  assert.equal(tierTraits.CIVILIZATION_TRAIT_NAMES.length, 21);

  // Every stored dimension must be one the attachment actually names —
  // the sheet is a subset of the document, never an extension of it.
  for (const name of tierTraits.CITY_TRAIT_FAMILIES) {
    assert.ok(tierTraits.CITY_TRAIT_NAMES.includes(name), `${name} is not a CITY dimension`);
  }
  for (const name of tierTraits.CIVILIZATION_TRAIT_FAMILIES) {
    assert.ok(
      tierTraits.CIVILIZATION_TRAIT_NAMES.includes(name),
      `${name} is not a CIVILIZATION dimension`,
    );
  }

  // The four spending priorities are exactly the stored civilization
  // sheet. If one drifts out of the other, delivery silently stops
  // dividing the budget by everything that claims it.
  const claimants = [...tierTraits.SERVICE_FAMILIES, tierTraits.FORCE_FAMILY].sort();
  assert.deepEqual(claimants, [...tierTraits.CIVILIZATION_TRAIT_FAMILIES].sort());
});

test('a dimension that is answered elsewhere is refused, not silently dropped', () => {
  // `economy` is a real `cities` column. A caller who passes it has
  // read the attachment and not the reconciliation, and dropping it
  // would let them believe a number was stored.
  assert.throws(() => tierTraits.cityTraits({ economy: 80 }), /already/);
  // `transportation` is deferred by CLAUDE.md, and the message has to
  // say so rather than "unknown key".
  assert.throws(() => tierTraits.cityTraits({ transportation: 80 }), /already/);
  // A name that is in neither list is a different error.
  assert.throws(() => tierTraits.cityTraits({ vibes: 80 }), /not a city trait/);
  assert.throws(() => tierTraits.civilizationTraits({ justice: 80 }), /already/);
});

test('an unknown trait reads as null, not as zero', () => {
  // A city generated before the sheet existed, or restored from a
  // database that predates the column, has no sheet at all — and
  // `Number(undefined)` is NaN while `Number(null)` is 0. Both would be
  // wrong; null is right.
  assert.equal(tierTraits.traitOf({}, 'tourism'), null);
  assert.equal(tierTraits.traitOf({ traits: {} }, 'tourism'), null);
  assert.equal(tierTraits.traitOf({ traits: { tourism: null } }, 'tourism'), null);
  assert.equal(tierTraits.traitOf({ traits: { tourism: 0 } }, 'tourism'), 0);
});

// ---------------------------------------------------------------------
// The budget
// ---------------------------------------------------------------------

test('an even split at full writ funds every service at the state\'s means', () => {
  const { w, writMap } = stateWorld({ economy: 60, writ: 1 });
  const plan = statecraft.fundingFor(w, 1, { writMap });
  assert.equal(plan.budget, 60);
  // Four claimants, an even split, and the ×4 that makes `budget`
  // readable as "what this state can afford per service".
  assert.equal(plan.funding.healthcare, 60);
  assert.equal(plan.funding.education, 60);
  assert.equal(plan.funding.security, 60);
});

test('guns and butter compete without a rule that says they do', () => {
  const even = stateWorld({ writ: 1 });
  const armed = stateWorld({
    writ: 1,
    priorities: { healthcare: 50, education: 50, security: 50, military: 100 },
  });

  const before = statecraft.fundingFor(even.w, 1, { writMap: even.writMap });
  const after = statecraft.fundingFor(armed.w, 1, { writMap: armed.writMap });

  // Nothing about healthcare changed. It is funded less because
  // somebody else is funded more, which is the whole mechanism.
  assert.ok(
    after.funding.healthcare < before.funding.healthcare,
    `raising the army left healthcare at ${after.funding.healthcare}`,
  );
  assert.ok(statecraft.garrisonOf(armed.w, 1) > statecraft.garrisonOf(even.w, 1));
});

test('the state delivers where it governs — and a lawless city is not a rule, it is a multiplier', () => {
  const governed = stateWorld({ writ: 0.95 });
  const lawless = stateWorld({ writ: 0.05 });

  const rich = statecraft.fundingFor(governed.w, 1, { writMap: governed.writMap });
  const poor = statecraft.fundingFor(lawless.w, 1, { writMap: lawless.writMap });

  assert.ok(poor.funding.security < rich.funding.security / 10,
    `lawless security funded at ${poor.funding.security} against ${rich.funding.security}`);
});

test('an unmeasurable writ is not a writ of zero', () => {
  // A world with no policing, no factions and no opinion yet is
  // UNOBSERVED, not ungoverned. Treating the null as a zero would
  // defund every service in every fresh world the day this file
  // landed — standing rule 12's first clause.
  const { w } = stateWorld({ writ: null });
  const plan = statecraft.fundingFor(w, 1, { writMap: new Map() });
  assert.equal(plan.writ, null);
  assert.equal(plan.funding.healthcare, 60);
});

test('a world with no civilization delivers nothing and throws nothing', () => {
  // After a reset, no state is the expected condition rather than an
  // error — `authority.standingTerm` makes the same argument.
  const { w } = stateWorld({ priorities: null });
  assert.equal(statecraft.fundingFor(w, 1), null);
  assert.equal(statecraft.garrisonOf(w, 1), 0);
  assert.deepEqual(statecraft.runStatecraft(w, 90), []);
});

// ---------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------

test('delivery is idempotent — the DNA upkeep does not compound', () => {
  // **The ratchet this project caught before shipping it.** The first
  // version read `row.maintenance_level` and added the upkeep to it, so
  // a port's roads gained fifteen points every ninety days. A delivery
  // pass run twice on an unchanged world must leave it unchanged.
  const { w, writMap } = stateWorld({
    dna: 'port',
    writ: 1,
    extraInfrastructure: [{
      id: 4, city_id: 1, type: 'roads', capacity: null, condition: 70,
      maintenance_level: 40, funding: 40, age: 0, failed_since_tick: null, repair_ticks: null,
    }],
  });
  const plan = statecraft.fundingFor(w, 1, { writMap });

  statecraft.deliverTo(w, w.cities[0], plan);
  const once = w.infrastructure.map((r) => [r.type, r.funding, r.maintenance_level]);
  statecraft.deliverTo(w, w.cities[0], plan);
  statecraft.deliverTo(w, w.cities[0], plan);
  const thrice = w.infrastructure.map((r) => [r.type, r.funding, r.maintenance_level]);

  assert.deepEqual(thrice, once, 'delivery is not idempotent — something is compounding');

  // And the port really does keep its roads up beyond the budget.
  const roads = w.infrastructure.find((r) => r.type === 'roads');
  assert.equal(roads.maintenance_level, 60 + statecraft.DNA_UPKEEP);
});

test('a city with no DNA is bit-identical to one whose DNA names no system', () => {
  const plain = stateWorld({ dna: null, writ: 1 });
  const financial = stateWorld({ dna: 'finance', writ: 1 });

  for (const fixture of [plain, financial]) {
    const plan = statecraft.fundingFor(fixture.w, 1, { writMap: fixture.writMap });
    statecraft.deliverTo(fixture.w, fixture.w.cities[0], plan);
  }
  assert.deepEqual(
    plain.w.infrastructure.map((r) => [r.type, r.funding, r.maintenance_level]),
    financial.w.infrastructure.map((r) => [r.type, r.funding, r.maintenance_level]),
  );
});

// ---------------------------------------------------------------------
// The garrison
// ---------------------------------------------------------------------

test('the garrison is centred at zero — a state with no army changes no world', () => {
  // Standing rule 12's first clause, held the way that rule says to
  // hold it: the same world twice, differing in exactly one thing.
  // **A faction's hold has to be built through the real generator.**
  // `gripTerm` reads its traits through `getLiveEntity` — standing rule
  // 9 — so a fixture that sets the frozen `org.traits` sheet, or that
  // invents `trait_id`s, measures nothing. `authority.test.js` found
  // exactly this in its own setup.
  const build = (military) => {
    const { w } = stateWorld({
      priorities: { healthcare: 50, education: 50, security: 50, military },
    });
    const faction = engine.generateFaction({
      name: 'Holders', type: 'gang', traitValueFor: () => 80,
    });
    w.organizations = [faction];
    w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === faction.id);
    w.territoryBlocks = [{
      id: 1, community_id: 9, city_id: 1, faction_id: faction.id, status: 'fortified',
    }];
    return w;
  };

  const unarmed = build(0);
  const armed = build(100);

  const without = authority.gripTerm(unarmed, 9);
  const with_ = authority.gripTerm(armed, 9);
  assert.ok(without !== null, 'the fixture did not produce a readable hold');

  // A state with no army leaves the term exactly where it was: held
  // 0.8, so the state keeps 0.2 and nothing else touches it.
  assert.equal(Math.round(without * 10000) / 10000, 0.2);
  // A state that spends on soldiers contests that hold.
  assert.ok(with_ > without, `garrison did not contest the hold (${with_} vs ${without})`);
});

// ---------------------------------------------------------------------
// Tourism
// ---------------------------------------------------------------------

test('tourism is a stock, and it moves toward appeal from either side', () => {
  const high = stateWorld({ tourism: 10 });
  high.w.communities[0].safety = 90;
  for (const row of high.w.infrastructure) row.condition = 90;

  const before = tierTraits.traitOf(high.w.cities[0], 'tourism');
  const appeal = statecraft.tourismAppeal(high.w, 1);
  assert.ok(appeal > before, 'the fixture did not build a city worth visiting');
  statecraft.driftTourism(high.w, high.w.cities[0]);
  const after = tierTraits.traitOf(high.w.cities[0], 'tourism');
  assert.ok(after > before && after < appeal, 'tourism did not lag its appeal');

  // The same expression the other way. A mechanism with no inverse has
  // no equilibrium — standing rule 13 — and the inverse here is the
  // shape of the expression rather than a second mechanism.
  const low = stateWorld({ tourism: 90 });
  low.w.communities[0].safety = 5;
  for (const row of low.w.infrastructure) row.condition = 5;
  const wasHigh = tierTraits.traitOf(low.w.cities[0], 'tourism');
  statecraft.driftTourism(low.w, low.w.cities[0]);
  assert.ok(tierTraits.traitOf(low.w.cities[0], 'tourism') < wasHigh);
});

test('an unmeasurable appeal leaves the stock where it was', () => {
  const { w } = stateWorld({ tourism: 42 });
  w.communities = [];
  w.infrastructure = [];
  assert.equal(statecraft.tourismAppeal(w, 1), null);
  assert.equal(statecraft.driftTourism(w, w.cities[0]), null);
  assert.equal(tierTraits.traitOf(w.cities[0], 'tourism'), 42);
});

test('§49 CITY DNA biases appeal, and the draw is reproducible', () => {
  const plain = stateWorld({ dna: null });
  const resort = stateWorld({ dna: 'tourism' });
  const works = stateWorld({ dna: 'industrial' });

  const base = statecraft.tourismAppeal(plain.w, 1);
  assert.equal(statecraft.tourismAppeal(resort.w, 1), base + statecraft.CITY_DNA.tourism.appeal);
  assert.equal(statecraft.tourismAppeal(works.w, 1), base + statecraft.CITY_DNA.industrial.appeal);

  // §88: the same seed and the same position give the same city.
  assert.equal(statecraft.drawDna('abc', 0), statecraft.drawDna('abc', 0));
  assert.notEqual(statecraft.drawDna('abc', 0), statecraft.drawDna('abc', 1));
  assert.ok(statecraft.DNA_NAMES.includes(statecraft.drawDna('abc', 7)));
  // All nine of §49's identities, no more and no fewer.
  assert.equal(statecraft.DNA_NAMES.length, 9);
});

// ---------------------------------------------------------------------
// Schooling — what education funding actually buys
// ---------------------------------------------------------------------

test('attainment moves, and it moves only where a funded school is open', () => {
  // **`infrastructure.js` declared this gap in its own words**: there
  // was no per-tick education mechanism for a school outage to
  // interrupt, because `npcs.education` was set at generation and never
  // moved. `demographics.EDUCATION_LEVELS` is a six-rung ladder nobody
  // climbed.
  const run = ({ funding, failed = null }) => {
    const { w } = stateWorld({ students: 200, schoolFailedSince: failed });
    for (const row of w.infrastructure) {
      if (row.type === 'schools') row.funding = funding;
    }
    let moved = 0;
    for (let t = 0; t < 2000; t += 1) {
      w.tick = 100 + t;
      moved += statecraft.runSchooling(w, w.tick).length;
    }
    return moved;
  };

  assert.ok(run({ funding: 100 }) > 0, 'a fully funded school taught nobody in 2000 ticks');
  // **Centred at zero, exactly.** A state that spends nothing on
  // schools leaves attainment where it was, which is what every world
  // generated before this mechanism existed looked like.
  assert.equal(run({ funding: 0 }), 0);
  // A school that is not running teaches nobody — the outage effect
  // that could not be written before the mechanism existed.
  assert.equal(run({ funding: 100, failed: 50 }), 0);
});

test('schooling never invents a fact about somebody', () => {
  const { w } = stateWorld({ students: 5 });
  for (const row of w.infrastructure) if (row.type === 'schools') row.funding = 100;

  // Nobody recorded this person's attainment. `indexOf` is -1 for
  // them, and -1 is not rung zero — starting them at `none` would
  // invent a fact.
  w.npcs[0].education = null;
  // And somebody at the top of the ladder stays there.
  w.npcs[1].education = demographics.EDUCATION_LEVELS[demographics.EDUCATION_LEVELS.length - 1];
  // Too old for school.
  w.npcs[2].createdTick = w.tick - (60 * 365);

  for (let t = 0; t < 3000; t += 1) {
    w.tick = 100 + t;
    statecraft.runSchooling(w, w.tick);
  }

  assert.equal(w.npcs[0].education, null);
  assert.equal(w.npcs[1].education, 'advanced');
  assert.equal(w.npcs[2].education, 'basic');
});

// ---------------------------------------------------------------------
// §48 NEIGHBORHOOD STABILITY
// ---------------------------------------------------------------------

test('§48\'s bands are the spec\'s, to the number', () => {
  assert.equal(statecraft.stabilityBand(0), 'COLLAPSING');
  assert.equal(statecraft.stabilityBand(29), 'COLLAPSING');
  assert.equal(statecraft.stabilityBand(30), 'STRUGGLING');
  assert.equal(statecraft.stabilityBand(49), 'STRUGGLING');
  assert.equal(statecraft.stabilityBand(50), 'STABLE');
  assert.equal(statecraft.stabilityBand(69), 'STABLE');
  assert.equal(statecraft.stabilityBand(70), 'THRIVING');
  assert.equal(statecraft.stabilityBand(84), 'THRIVING');
  assert.equal(statecraft.stabilityBand(85), 'ELITE');
  assert.equal(statecraft.stabilityBand(100), 'ELITE');
  // An unmeasured area has no band, and `Number(null)` is 0 — which
  // would put it in COLLAPSING.
  assert.equal(statecraft.stabilityBand(null), null);
  assert.equal(statecraft.stabilityBand(undefined), null);
});

test('stability is computed, never stored', () => {
  const { w, writMap } = stateWorld({ writ: 0.9 });
  const value = statecraft.communityStability(w, 9, writMap);
  assert.ok(Number.isFinite(value));
  assert.equal(w.communities[0].stability, undefined,
    'stability was written onto the row — §48 says it is dynamically calculated');
});

// ---------------------------------------------------------------------
// The city columns that were founding constants
// ---------------------------------------------------------------------

test('cities.infrastructure becomes the rollup its own schema comment names', () => {
  const { w } = stateWorld();
  w.cities[0].infrastructure = 50;
  for (const row of w.infrastructure) row.condition = 90;
  territory.refreshCityConditions(w, { tick: w.tick });
  assert.equal(w.cities[0].infrastructure, infrastructure.cityCondition(w, 1));
  assert.equal(w.cities[0].infrastructure, 90);
});

test('a city with nothing measurable keeps what it had rather than reading zero', () => {
  const { w } = stateWorld();
  w.infrastructure = [];
  w.communities = [];
  w.npcs = [];
  // The tourism stock counts as a measurement — it is stored state
  // that drifts, not a placeholder — so a city that has one is not a
  // city with nothing measurable. Cleared here so the assertion is
  // about the case it names.
  w.cities[0].traits = {};
  const before = { ...w.cities[0] };
  territory.refreshCityConditions(w, { tick: w.tick });
  assert.equal(w.cities[0].infrastructure, before.infrastructure);
  assert.equal(w.cities[0].safety, before.safety);
  assert.equal(w.cities[0].economy, before.economy);
});

// ---------------------------------------------------------------------
// Citation is not presence
// ---------------------------------------------------------------------

test('§7 no longer carries three bare absences, and the new statistics answer', () => {
  const byName = Object.fromEntries(urbanSystems.SYSTEMS.map((s) => [s.name, s]));
  for (const name of ['Government Services', 'Military / National Guard', 'Tourism']) {
    assert.notEqual(byName[name].level, 'absent', `${name} is still absent`);
    assert.ok(byName[name].note, `${name} has a level and no note`);
  }

  const keys = new Set(statistics.CATALOGUE.map((d) => d.key));
  for (const key of ['tourism', 'tourism_appeal', 'service_funding', 'garrison',
    'neighborhood_stability']) {
    assert.ok(keys.has(key), `${key} is not in the catalogue`);
  }
});
