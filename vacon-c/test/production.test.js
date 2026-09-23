// Labour produces value, and the event log stops shouting.
//
// **Both findings came from one measurement.** Running 300 ticks of a
// generated 150-person world and counting what came out:
//
//     fear_spike               28,016
//     migration_risk           16,284
//     payroll_missed            1,488
//     ...
//     birth                         3
//     death                         1
//
// 46,703 events, of which 95% were two signals firing on a CONDITION
// rather than a crossing, and 1,488 were every business in the world
// slowly going bankrupt because `organizations.income` was a column
// nothing ever wrote.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

let nextId = 400000;

function world() {
  const worldState = {
    tick: 0,
    npcs: [],
    deceased: [],
    organizations: [],
    // `getLiveEntity` looks an entity up across all three tiers, so a
    // fixture without `families` throws on any id it cannot find —
    // which is exactly the lookup the "somebody who does not exist"
    // case below exercises.
    families: [],
    entityTraits: [],
    employmentRecords: [],
    individualFinances: [],
    resources: [],
    marketListings: [],
  };
  economy.reseedIds(worldState);
  return worldState;
}

// Built with the real trait generator so every family an inherited
// sheet needs is present — standing rule 6.
function worker(worldState, value) {
  const id = nextId++;
  worldState.entityTraits.push(
    ...generateEntityTraits(id, worldState.tick, INDIVIDUAL_DEFINITIONS, () => value),
  );
  const npc = { id, status: 'active', traits: {}, createdTick: 0, updatedTick: 0 };
  worldState.npcs.push(npc);
  return npc;
}

function employer(worldState, assets = 100000) {
  const org = { id: nextId++, type: 'business', assets, income: 0, expenses: 0 };
  worldState.organizations.push(org);
  return org;
}

// -- productivity -------------------------------------------------------

test('an average worker scores exactly 1.0, which is the whole model', () => {
  // **The first version divided skills by 100 and multiplied two more
  // sub-1 modulators**, so an entirely average worker scored 0.28 and
  // produced 45% of their own wage. Every business still failed, just
  // more slowly — 470 missed payrolls instead of 1,488. Every trait
  // runs 0..100 with 50 as average, so each factor has to give 1.0 at
  // 50 or the centre of the model is not where the centre of the scale
  // is.
  const w = world();
  const average = worker(w, 50);
  assert.equal(economy.productivityOf(w, average.id), 1);

  const skilled = worker(w, 100);
  const poor = worker(w, 10);
  // 100 skills is 2x average, and both modulators sit at their 1.25
  // ceiling: 2 * 1.25 * 1.25.
  assert.equal(economy.productivityOf(w, skilled.id), 3.125);
  assert.ok(economy.productivityOf(w, poor.id) < 0.2);

  // Somebody who does not exist produces nothing rather than throwing
  // or silently averaging.
  assert.equal(economy.productivityOf(w, 999999), 0);
});

test('health and focus modulate rather than gate', () => {
  // An unwell expert still out-produces a healthy novice, which is
  // what "modulate" has to mean for the model to be about skill.
  const w = world();
  const expert = worker(w, 90);
  const novice = worker(w, 20);
  // Make the expert ill and the novice thriving.
  for (const row of w.entityTraits) {
    const def = INDIVIDUAL_DEFINITIONS.find((d) => d.trait_id === row.trait_id);
    if (!def) continue;
    const ill = def.family === 'health' || def.family === 'mental';
    if (row.entity_id === expert.id && ill) row.current_value = 5;
    if (row.entity_id === novice.id && ill) row.current_value = 100;
  }
  assert.ok(economy.productivityOf(w, expert.id) > economy.productivityOf(w, novice.id));
});

test('productivity reads live traits, not the frozen sheet', () => {
  // Standing rule 9. `npc.traits` is built once at generation; a
  // worker who spent forty years getting better at their job would
  // otherwise produce their birth value forever.
  const w = world();
  const person = worker(w, 50);
  person.traits = { skills: { Communication: 100 }, health: {}, mental: {} };
  assert.equal(economy.productivityOf(w, person.id), 1,
    'productivity read the frozen sheet on the object');
});

// ---------------------------------------------------------------------
// The skill term is the JOB's skill
// ---------------------------------------------------------------------
// It used to be the mean of all sixteen. Measured on a 300-tick world,
// one person's best skill beats their worst by **75.7 points on
// average**, so a specialist and a generalist with the same mean were
// worth exactly the same to an employer and the occupation taxonomy —
// which names the skill each job exercises, and which `traitDrift`
// grows — reached the economy nowhere at all.

function setSkill(worldState, entityId, name, value) {
  const def = INDIVIDUAL_DEFINITIONS.find((d) => d.family === 'skills' && d.name === name);
  if (!def) throw new Error(`no skills trait named ${name}`);
  const row = worldState.entityTraits.find(
    (r) => r.entity_id === entityId && r.trait_id === def.trait_id,
  );
  if (!row) throw new Error(`entity ${entityId} has no row for ${name}`);
  row.current_value = value;
}

test('somebody whose job skill equals their own mean scores what they always scored', () => {
  // **Standing rule 12's first clause.** The blend has to be centred on
  // the person's own sheet mean, not on 50 and not on anything else: a
  // term centred elsewhere would silently revalue every worker in every
  // world the day it started being read, which is the evasion modifier
  // all over again. Held exactly rather than approximately.
  const w = world();
  const person = worker(w, 50);
  const org = employer(w);
  economy.hireEntity(w, {
    entityId: person.id, employerOrganizationId: org.id, wage: 10, position: 'farmer',
  });
  assert.equal(economy.productivityOf(w, person.id), 1,
    'a flat-50 farmer moved when the job skill became a term');
});

test('a specialist is worth more in their own trade than out of it', () => {
  // The claim the change exists to make. Same person, same sheet, same
  // employer — only the title differs. If this does not move, the
  // occupation taxonomy is decoration in the economy.
  const w = world();
  const person = worker(w, 50);
  setSkill(w, person.id, 'Agriculture', 95);
  const org = employer(w);

  economy.hireEntity(w, {
    entityId: person.id, employerOrganizationId: org.id, wage: 10, position: 'farmer',
  });
  const inTrade = economy.productivityOf(w, person.id);
  economy.endEmployment(w, { entityId: person.id });
  economy.hireEntity(w, {
    entityId: person.id, employerOrganizationId: org.id, wage: 10, position: 'cook',
  });
  const outOfTrade = economy.productivityOf(w, person.id);

  assert.ok(inTrade > outOfTrade,
    `a 95-Agriculture farmer (${inTrade.toFixed(3)}) should out-produce the same `
    + `person put in a kitchen (${outOfTrade.toFixed(3)})`);
  // And the person out of their trade is not ruined by it: half the
  // term is still everything else they can do, which is why JOB_SHARE
  // is a half rather than the whole thing.
  assert.ok(outOfTrade > 0.5, `out of trade collapsed to ${outOfTrade.toFixed(3)}`);
});

test('an untitled job is a real state and keeps the sheet mean', () => {
  // Every world restored from before `occupations.js` existed has
  // `position: null` on every record, and `drawOccupation` returns null
  // for an organization type that employs nobody. Reading those as a
  // zero-skill job would revalue the entire restored population.
  const w = world();
  const person = worker(w, 50);
  setSkill(w, person.id, 'Agriculture', 95);
  const withoutJob = economy.productivityOf(w, person.id);
  const org = employer(w);
  economy.hireEntity(w, {
    entityId: person.id, employerOrganizationId: org.id, wage: 10, position: null,
  });
  assert.equal(economy.productivityOf(w, person.id), withoutJob);
});

// -- production ---------------------------------------------------------

test('a business earns from the people it employs', () => {
  const w = world();
  const org = employer(w, 1000);
  const a = worker(w, 50);
  const b = worker(w, 50);
  economy.hireEntity(w, { entityId: a.id, employerOrganizationId: org.id, wage: 100 });
  economy.hireEntity(w, { entityId: b.id, employerOrganizationId: org.id, wage: 100 });

  economy.runProduction(w, 1);
  // Two average workers on 100 each, at WAGE_TO_OUTPUT.
  assert.equal(org.income, 200 * economy.WAGE_TO_OUTPUT);
  assert.equal(org.assets, 1000 + 200 * economy.WAGE_TO_OUTPUT);
});

test('an average workforce is profitable and a poor one is not', () => {
  // The relationship worth having: a business is viable when it
  // employs capable people and not when it does not.
  function margin(traitValue) {
    const w = world();
    const org = employer(w, 100000);
    for (let i = 0; i < 5; i += 1) {
      const npc = worker(w, traitValue);
      economy.hireEntity(w, { entityId: npc.id, employerOrganizationId: org.id, wage: 50 });
    }
    economy.runProduction(w, 1);
    economy.runPayroll(w, 1);
    return org.income - org.expenses;
  }
  assert.ok(margin(50) > 0, 'an average workforce cannot cover its own wages');
  assert.ok(margin(15) < 0, 'a barely-skilled workforce is profitable');
});

test('the dead do not work, and neither does an ended contract', () => {
  const w = world();
  const org = employer(w, 1000);
  const alive = worker(w, 50);
  const gone = worker(w, 50);
  economy.hireEntity(w, { entityId: alive.id, employerOrganizationId: org.id, wage: 100 });
  economy.hireEntity(w, { entityId: gone.id, employerOrganizationId: org.id, wage: 100 });

  // Removed from `npcs` the way mortality removes a corpse.
  w.npcs = w.npcs.filter((n) => n.id !== gone.id);
  economy.runProduction(w, 1);
  assert.equal(org.income, 100 * economy.WAGE_TO_OUTPUT, 'a corpse produced output');

  org.income = 0;
  economy.endEmployment(w, { entityId: alive.id });
  economy.runProduction(w, 2);
  assert.equal(org.income, 0);
});

test('income accumulates, because expenses does', () => {
  // An income that reset each tick beside an expense total that never
  // did would make the obvious comparison — `income - expenses` —
  // nonsense in both directions.
  const w = world();
  const org = employer(w, 100000);
  const npc = worker(w, 50);
  economy.hireEntity(w, { entityId: npc.id, employerOrganizationId: org.id, wage: 100 });

  economy.runProduction(w, 1);
  economy.runPayroll(w, 1);
  const afterOne = { income: org.income, expenses: org.expenses };
  economy.runProduction(w, 2);
  economy.runPayroll(w, 2);

  assert.equal(org.income, afterOne.income * 2);
  assert.equal(org.expenses, afterOne.expenses * 2);
});

// -- what it fixes end to end -------------------------------------------

test('a generated world stops going bankrupt, and its event log stops shouting', () => {
  // **The regression guard for both findings at once**, because both
  // were measured the same way and neither was visible to any unit
  // test — an event fired on a condition and a column nothing wrote
  // both look completely correct from inside a fixture.
  const w = engine.WorldState;
  const before = { events: w.events.length, orgs: w.organizations.length };
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 20, seed: 'noise' });

  const counts = {};
  // Which ticks each signal fired on, not just how many times. See the
  // guard below for why the distinction is the whole point.
  const ticksFiredOn = {};
  const TICKS = 120;
  for (let t = 0; t < TICKS; t += 1) {
    for (const event of engine.advanceTick().events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
      (ticksFiredOn[event.type] ??= new Set()).add(t);
    }
  }
  void before;

  // Nothing goes bankrupt.
  assert.equal(counts.payroll_missed ?? 0, 0,
    'businesses are still failing to make payroll, so nothing is earning');

  const people = w.npcs.length;
  // Two signals that used to fire per person per tick. `fear_spike` ran
  // at 93 a tick on 152 people.
  //
  // **This measured the TOTAL against the population, and that guard
  // broke the day the weather arrived.** A total conflates the bug
  // (fires for everybody every tick) with correct behaviour (fires for
  // some people on each genuine crossing) — and once `environment.js`
  // started producing real shortages, five honest scarcity crossings
  // put 49 fear spikes on a 38-person world and tripped a threshold of
  // 38. The signal was working exactly as intended.
  //
  // What the bug actually looks like is firing on ALMOST EVERY TICK, so
  // that is what is measured now. A crossing-driven signal fires on a
  // handful of ticks however many people it reaches on each.
  for (const noisy of ['fear_spike', 'migration_risk']) {
    const onTicks = (ticksFiredOn[noisy] ?? new Set()).size;
    assert.ok(onTicks < TICKS / 3,
      `${noisy} fired on ${onTicks} of ${TICKS} ticks — `
      + 'it is firing on a condition again rather than on a crossing');
  }


  // And a shortage is announced when it starts, not every tick it
  // lasts. Knowledge rows were 44,899 after 300 ticks on 152 people —
  // just about one per person per tick, which is what a broadcast on a
  // CONDITION looks like.
  //
  // **Measured as a rate, for the same reason as the two signals
  // above.** A flat `people * 5` ceiling assumed shortages were rare,
  // and once the weather could cause them, seven honest crossings put
  // 280 rows on a 38-person world and tripped a threshold of 190. Every
  // one of those rows was a real announcement of a real shortage.
  const perPersonPerTick = w.entityKnowledge.length / (people * TICKS);
  assert.ok(perPersonPerTick < 0.25,
    `${w.entityKnowledge.length} knowledge rows is ${perPersonPerTick.toFixed(2)} per person `
    + 'per tick — the scarcity broadcast is firing on a condition again');
});
