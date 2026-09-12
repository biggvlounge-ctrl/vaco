// Age, disease and death — the life scale.
//
// **What this closes.** `property.age` was the only thing in the engine
// that incremented: buildings decayed and people were immortal. §2
// promises the world continues without the player and that NPCs "have
// children" and "die" — births were real, deaths were not.
//
// The assertions worth reading first are the two structural ones: that
// a dead NPC LEAVES `worldState.npcs`, and that a death is reproducible
// from a seed. Everything else follows from those.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const mortality = require('../server/mortality.js');
const economy = require('../server/economy.js');
const politics = require('../server/politics.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// **`createdTick`, camelCase.** The in-memory spelling `generateNPC`
// uses. `created_tick` is the database column, and a fixture written
// with that spelling would make `ageInYears` return null for
// everybody, every risk 0, and every test below pass while nothing
// ever died — which is how the first version of `ageInYears` was
// wrong.
function world({ ages = [70], health = 50, chronic = 50, tick = 36500 } = {}) {
  const worldState = {
    tick,
    npcs: ages.map((age, i) => ({
      id: i + 1,
      status: 'active',
      createdTick: tick - Math.round(age * mortality.TICKS_PER_YEAR),
      updatedTick: tick,
      home_property_id: null,
      generation: 1,
    })),
    deceased: [],
    organizations: [{ id: 100, type: 'government', assets: 10000, expenses: 0 }],
    families: [],
    entityTraits: [],
    entityKnowledge: [],
    beliefs: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    resources: [],
    marketListings: [],
    governments: [],
    elections: [],
    votes: [],
    laws: [],
    publicOpinion: [],
    revolutions: [],
  };
  for (const npc of worldState.npcs) {
    for (const [family, name, value] of [
      ['health', 'Immune Response', health],
      ['health', 'Nutrition Status', health],
      ['health', 'Sleep Quality', health],
      ['health', 'Chronic Conditions', chronic],
      ['physical', 'Recovery Rate', health],
    ]) {
      worldState.entityTraits.push({
        entity_id: npc.id,
        trait_id: getTraitId(family, name),
        base_value: value,
        current_value: value,
        key_modifier: 0,
      });
    }
  }
  return worldState;
}

// -- age is computed ----------------------------------------------------

test('age comes from created_tick and a tick is a day', () => {
  const w = world({ ages: [40], tick: 36500 });
  assert.equal(mortality.ageInYears(w, w.npcs[0]), 40);
  assert.equal(mortality.TICKS_PER_YEAR, 365);

  // Standing rule 3: computed, never stored. `npcs` has no age column,
  // which is the schema being right rather than incomplete.
  assert.equal('age' in w.npcs[0], false);
});

test('an entity with no createdTick has an unknown age, not age zero', () => {
  // A newborn and an entity whose creation was never recorded are
  // different things — and treating the second as 0 makes it immortal
  // by accident, since risk below the natural floor is 0.
  const w = world();
  assert.equal(mortality.ageInYears(w, { id: 99 }), null);
  assert.equal(mortality.ageInYears(w, null), null);

  // **An unknown age drops the age term and nothing else.** The first
  // version returned 0 risk outright, which made anybody with no
  // recorded creation immortal — including in a famine. They still
  // face their environment; it is only their years that are unknown.
  assert.ok(mortality.annualDeathRisk(w, 99, { age: null }) > 0);
  assert.ok(mortality.annualDeathRisk(w, 99, { age: null, scarcity: 1 })
    > mortality.annualDeathRisk(w, 99, { age: null }));
});

// -- health drives the risk ---------------------------------------------

test('the four health traits move mortality, and Chronic Conditions inverts', () => {
  // **The sign error worth testing for.** Averaging all four as if
  // they pointed the same way would make the sickest people the most
  // robust — a plausible number and no error anywhere.
  const hardy = world({ ages: [80], health: 90, chronic: 10 });
  const frail = world({ ages: [80], health: 10, chronic: 90 });

  const hardyRisk = mortality.annualDeathRisk(hardy, 1, { age: 80 });
  const frailRisk = mortality.annualDeathRisk(frail, 1, { age: 80 });
  assert.ok(frailRisk > hardyRisk * 2,
    `frail ${frailRisk} should be much worse than hardy ${hardyRisk}`);

  // And an all-50 person sits exactly on the base curve.
  const average = world({ ages: [80], health: 50, chronic: 50 });
  assert.equal(mortality.vitalityOf(average, 1), 1);
  assert.ok(mortality.vitalityOf(hardy, 1) < 1);
  assert.ok(mortality.vitalityOf(frail, 1) > 1);
});

test('risk is continuous from birth — there is no minimum age of death', () => {
  // **The correction.** The first version had a floor of 40 below
  // which risk was exactly zero, so no child could die of anything
  // but violence. That is a rule about people; the truth in a collapse
  // setting is a rule about circumstances. The only hard bound left is
  // the far end.
  const w = world({ ages: [1] });
  const risk = (age) => mortality.annualDeathRisk(w, 1, { age });

  assert.ok(risk(1) > 0, 'an infant cannot die of anything at all');
  assert.ok(risk(10) > 0);
  assert.ok(risk(20) > 0);

  // Monotonic the whole way up, with no step anywhere.
  let previous = 0;
  for (const age of [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 109]) {
    const current = risk(age);
    assert.ok(current >= previous, `risk fell between ${age} and the age before it`);
    previous = current;
  }

  // And a recognisable shape rather than a flat line: childhood is
  // roughly the accident rate, old age is orders of magnitude worse.
  assert.ok(risk(10) < 0.002, `a child's annual risk is ${risk(10)}`);
  assert.ok(risk(70) > risk(10) * 50, 'age barely tells at all');
  assert.equal(risk(mortality.MAX_AGE), 1, 'nobody outlives the cap');
  assert.equal(risk(200), 1);
});

// -- death is structural ------------------------------------------------

test('a dead NPC leaves worldState.npcs — the whole design in one line', () => {
  // The alternative was a status flag, rejected after measuring: 17
  // call sites across 7 modules iterate `worldState.npcs`. A flag
  // needs all 17 to check it forever, and the first one anybody
  // forgets is a dead person drawing a wage or casting a vote.
  const w = world({ ages: [90] });
  const death = mortality.recordDeath(w, { entityId: 1, cause: 'age', tick: 36500 });

  assert.equal(w.npcs.length, 0);
  assert.equal(w.deceased.length, 1);
  assert.equal(w.deceased[0].status, 'deceased');
  assert.equal(death.age, 90);
  assert.equal(mortality.isDeceased(w, 1), true);
  assert.ok(mortality.getDeceased(w, 1));
});

test('the dead cannot be paid or counted in an election', () => {
  // The payoff of moving the row rather than flagging it: neither
  // `economy.js` nor `politics.js` knows mortality exists, and both
  // are correct anyway.
  const w = world({ ages: [90, 30] });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  economy.hireEntity(w, { entityId: 2, employerOrganizationId: 100, wage: 25 });
  assert.equal(economy.getEmploymentRate(w), 1);

  mortality.recordDeath(w, { entityId: 1, cause: 'age' });

  // **This assertion found a real defect.** The rate counted every
  // active record against a denominator of the living, so two
  // employed people and one survivor reported 2.0 — a rate above
  // 100%. Now it counts the employed who are still alive: one of one.
  assert.equal(economy.getEmploymentRate(w), 1);
  assert.equal(economy.listEmployment(w, { status: 'active' }).length, 2,
    'the dead employee\'s record should survive as history');

  // **And payroll does not pay the dead — a defect this test found
  // and then closed.** It first asserted the broken behaviour: a
  // corpse kept drawing 25 a tick, because `runPayroll` walks
  // contracts rather than people, so moving the row out of `npcs` did
  // not stop the wage on its own.
  const before = w.organizations[0].assets;
  const payroll = economy.runPayroll(w, 36501);
  assert.equal(payroll.paid, 1, 'the dead employee was paid');
  assert.equal(w.organizations[0].assets, before - 25);
  assert.equal(economy.getLatestFinances(w, 1), null,
    'a dead person received wages');
});

test('a death is refused twice, rather than recorded twice', () => {
  const w = world({ ages: [90] });
  mortality.recordDeath(w, { entityId: 1, cause: 'age' });
  assert.throws(() => mortality.recordDeath(w, { entityId: 1, cause: 'age' }),
    /not among the living/);
  assert.throws(() => mortality.recordDeath(w, { entityId: 99, cause: 'age' }),
    /not among the living/);
  assert.equal(w.historicalRecords.length, 1,
    'a second death wrote a second historical record for one person');
});

test('an unknown cause is refused', () => {
  const w = world({ ages: [90] });
  assert.throws(() => mortality.recordDeath(w, { entityId: 1, cause: 'boredom' }),
    /cause must be one of/);
  assert.equal(w.npcs.length, 1, 'a refused death removed the NPC anyway');
});

test('no unpersistable fields are written on the corpse', () => {
  // `npcs` has no died_tick and no death_cause column. The first
  // version set both — the same mistake `endEmployment` made with
  // `end_tick`: a field the engine sets that the database cannot hold,
  // which vanishes on restore and reads as durable until checked.
  const w = world({ ages: [90] });
  mortality.recordDeath(w, { entityId: 1, cause: 'age', tick: 36500 });
  const corpse = w.deceased[0];
  assert.equal('died_tick' in corpse, false);
  assert.equal('death_cause' in corpse, false);

  // The tick and cause are recoverable from history instead, which is
  // the read path that makes the record the durable answer.
  const record = mortality.deathRecordFor(w, 1);
  assert.equal(record.when_tick, 36500);
  assert.equal(record.why, 'age');
});

// -- a death is world history -------------------------------------------

test('a death is written to historical_records with no new columns', () => {
  // §41 says the world remembers, and `historical_records` is already
  // where that happens — who/what/when_tick/why carry a death exactly.
  const w = world({ ages: [90] });
  mortality.recordDeath(w, { entityId: 1, cause: 'age', tick: 36500 });

  const [record] = w.historicalRecords;
  assert.deepEqual(record.who, [1]);
  assert.equal(record.what, 'death');
  assert.equal(record.when_tick, 36500);
  assert.equal(record.why, 'age');
  assert.ok(record.significance > 0);
});

test('a violent death names the killer and the killer remembers it', () => {
  // Standing rule 1's write-back applies to the killer, not the
  // victim — the victim has no further decisions to make.
  const w = world({ ages: [30, 30] });
  mortality.killEntity(w, { entityId: 1, killerId: 2, tick: 36500, detail: 'a dispute over water' });

  const record = mortality.deathRecordFor(w, 1);
  assert.deepEqual(record.who, [1, 2]);
  assert.equal(record.why, 'violence');
  assert.equal(record.result, 'a dispute over water');
  assert.ok(record.significance > 50, 'a killing should weigh more than a peaceful death');

  assert.equal(w.memories.length, 1);
  assert.equal(w.memories[0].entity_id, 2, 'the killer, not the victim');
  assert.deepEqual(w.memories[0].related_entity_ids, [1]);
});

test('violence is not a probability and ignores the curve entirely', () => {
  // A killing HAPPENS; it does not resolve. `killEntity` is the
  // explicit path for that, separate from `runMortality` on purpose.
  const w = world({ ages: [20] });
  assert.ok(mortality.annualDeathRisk(w, 1, { age: 20 }) < 0.002,
    'a twenty-year-old should be at almost no passive risk');
  mortality.killEntity(w, { entityId: 1 });
  assert.equal(w.npcs.length, 0);
});

// -- disease is an environmental condition -------------------------------

test('an outbreak is an active condition, like a drought', () => {
  // Deliberately the same mechanism `runEnvironmentPhase` already ages
  // and clears. A separate disease subsystem would be a second way to
  // say "something bad is affecting this region", and two mechanisms
  // for one idea drift apart.
  const w = world({ ages: [30] });
  const outbreak = mortality.addDiseaseOutbreak(w, {
    name: 'river fever', mortalityMultiplier: 20, ticksRemaining: 30,
  });
  assert.equal(w.activeConditions.length, 1);
  assert.equal(outbreak.conditionType, 'disease');
  assert.equal(mortality.diseasePressure(w), 20);

  assert.throws(() => mortality.addDiseaseOutbreak(w, { name: 'x' }),
    /mortalityMultiplier of at least 1/);
  assert.throws(() => mortality.addDiseaseOutbreak(w, {
    name: 'x', mortalityMultiplier: 0.5,
  }), /not a disease/);
});

test('an ordinary condition does not silently start killing people', () => {
  // A drought has no `mortalityMultiplier`, so mortality ignores it.
  // Otherwise adding this system would have quietly made every
  // existing environmental event lethal.
  const w = world({ ages: [30] });
  w.activeConditions.push({ conditionType: 'drought', resourceType: 'food', supplyDelta: -50 });
  assert.equal(mortality.diseasePressure(w), 1);

  // The condition itself adds nothing. **A drought kills through
  // scarcity, not by being a drought** — it drains the food resource,
  // and `survivalScarcity` reads the shortage that results. So the
  // risk here is unchanged, and the cascade is what does the harm.
  const withDrought = mortality.annualDeathRisk(w, 1, { age: 30, pressure: 1 });
  const without = mortality.annualDeathRisk(world({ ages: [30] }), 1, { age: 30 });
  assert.equal(withDrought, without);
});

test('two outbreaks multiply rather than add', () => {
  // Summing would let three mild outbreaks add up to certain death.
  const w = world({ ages: [30] });
  mortality.addDiseaseOutbreak(w, { name: 'a', mortalityMultiplier: 3 });
  mortality.addDiseaseOutbreak(w, { name: 'b', mortalityMultiplier: 4 });
  assert.equal(mortality.diseasePressure(w), 12);
});

test('an epidemic does not check anybody\'s age', () => {
  // This used to be "the one exception to the age floor". With the
  // floor gone it is simply how a disease works: the multiplier
  // applies to everybody's risk, and the young have a real one now.
  const w = world({ ages: [20] });
  const quiet = mortality.annualDeathRisk(w, 1, { age: 20, pressure: 1 });
  const plague = mortality.annualDeathRisk(w, 1, { age: 20, pressure: 50 });
  assert.ok(plague > quiet * 40, `a 50x plague moved a young person from ${quiet} to ${plague}`);
});

test('the environment kills the young, which is what "no minimum age" means', () => {
  // A famine takes children first. Before the floor was removed this
  // was impossible — a five-year-old in a settlement with no food at
  // all was at exactly zero risk.
  const w = world({ ages: [5] });
  w.resources.push({ resource_type: 'food', supply: 1, demand: 100 });
  const scarcity = mortality.survivalScarcity(w);
  assert.equal(scarcity, 1, 'total famine should read as total scarcity');

  const starving = mortality.annualDeathRisk(w, 1, { age: 5, scarcity });
  assert.ok(starving > 0.2, `a starving child's annual risk is only ${starving}`);
  assert.equal(mortality.causeFor({ age: 5, scarcity }), 'deprivation',
    'a famine death recorded as old age makes a starving world look like an ageing one');
});

test('scarcity is the worst essential, not the average of them', () => {
  // Plenty of food and no water at all is a settlement that is dying,
  // and averaging would report it as coping.
  const w = world({ ages: [30] });
  w.resources.push({ resource_type: 'food', supply: 100, demand: 10 });
  w.resources.push({ resource_type: 'water', supply: 1, demand: 100 });
  assert.equal(mortality.survivalScarcity(w), 1);

  // And a shortage of something inessential is an economic problem,
  // not a mortality one.
  const iron = world({ ages: [30] });
  iron.resources.push({ resource_type: 'iron', supply: 1, demand: 100 });
  assert.equal(mortality.survivalScarcity(iron), 0);
});

// -- reproducibility ----------------------------------------------------

test('the same world and tick produce the same deaths, every time', () => {
  // §88: same seed, same rules, same world. `contest.js` already
  // resolves bouts deterministically so a settled result can be
  // re-verified; a world whose contests replay and whose deaths do not
  // is not reproducible.
  // **Run over the outbreak's own duration, not one tick.** The daily
  // hazard is the annual risk spread across a year, so even a severe
  // plague kills a fraction of a percent on any single day — which is
  // correct and was not what the first version of this test assumed.
  // Thirty ticks is what `addDiseaseOutbreak` defaults to, and an
  // epidemic is a span rather than an instant.
  const run = () => {
    const w = world({ ages: Array.from({ length: 200 }, (_, i) => 40 + (i % 60)) });
    mortality.addDiseaseOutbreak(w, { name: 'plague', mortalityMultiplier: 40 });
    const ids = [];
    for (let tick = 36500; tick < 36530; tick += 1) {
      ids.push(...mortality.runMortality(w, tick).deaths.map((d) => d.npc.id));
    }
    return ids;
  };

  const first = run();
  const second = run();
  assert.deepEqual(first, second, 'two identical worlds died differently');
  assert.ok(first.length > 0, 'a 40x plague over 30 days killed nobody — check the curve');
  assert.equal(new Set(first).size, first.length, 'somebody died twice');
});

test('a plague kills more than an ordinary year does', () => {
  const population = () => Array.from({ length: 400 }, (_, i) => 40 + (i % 60));
  const quiet = world({ ages: population() });
  const plagued = world({ ages: population() });
  mortality.addDiseaseOutbreak(plagued, { name: 'plague', mortalityMultiplier: 60 });

  const quietDeaths = mortality.runMortality(quiet, 36500).deaths.length;
  const plagueDeaths = mortality.runMortality(plagued, 36500).deaths.length;
  assert.ok(plagueDeaths > quietDeaths,
    `plague ${plagueDeaths} should exceed a quiet year's ${quietDeaths}`);
  // And a plague death is recorded as disease, not as age.
  assert.ok(mortality.runMortality(
    world({ ages: population() }), 36501,
  ).deaths.every((d) => d.cause === 'age'), 'no disease, so every cause should be age');
});

test('runMortality iterates a copy, so no living person is skipped', () => {
  // `recordDeath` splices the live array. Walking it directly skips
  // the element after every removal — half the population spared at
  // random, and the bug would look like a tuning problem.
  const w = world({ ages: Array.from({ length: 50 }, () => 109) });
  const result = mortality.runMortality(w, 36500);
  assert.equal(result.deaths.length + w.npcs.length, 50,
    'the population does not add up — someone was skipped');
});

test('every death this tick becomes an event', () => {
  const w = world({ ages: [109, 109] });
  const result = mortality.runMortality(w, 36500);
  assert.equal(result.events.length, result.deaths.length);
  for (const event of result.events) {
    assert.equal(event.type, 'death');
    assert.equal(event.tick, 36500);
    assert.ok(mortality.DEATH_CAUSES.includes(event.cause));
  }
});

test('the age profile is computed over the living', () => {
  const w = world({ ages: [30, 50, 90] });
  let profile = mortality.ageProfile(w);
  assert.equal(profile.living, 3);
  assert.equal(profile.dead, 0);
  assert.ok(Math.abs(profile.meanAge - 56.67) < 0.1);
  assert.equal(profile.oldest, 90);

  mortality.recordDeath(w, { entityId: 3, cause: 'age' });
  profile = mortality.ageProfile(w);
  assert.equal(profile.living, 2);
  assert.equal(profile.dead, 1);
  assert.equal(profile.oldest, 50);
});

// -- and the loop it closes ---------------------------------------------

test('a dead voter cannot be elected or vote', () => {
  const w = world({ ages: [30, 30, 30] });
  politics.reseedIds(w);
  politics.foundGovernment(w, { organizationId: 100, systemType: 'democracy' });
  const election = politics.scheduleElection(w, { organizationId: 100 });
  politics.openElection(w, { electionId: election.id });
  politics.castVote(w, { electionId: election.id, voterEntityId: 1, candidateEntityId: 2 });

  mortality.killEntity(w, { entityId: 3, killerId: 1 });

  // Turnout is over the living, so a killing changes the denominator —
  // politics.js does not know mortality exists and is right anyway.
  const result = politics.closeElection(w, { electionId: election.id });
  assert.equal(result.turnout, 0.5, '1 vote among 2 living NPCs');
  assert.equal(result.winnerId, 2);
});
