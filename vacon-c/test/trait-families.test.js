// Seven trait families that were generated on every entity and read by
// nothing.
//
// **Measured, not guessed at.** `scripts/measure-world.mjs` counts how
// many of the 114 individual traits have a reader anywhere in
// `server/`. It said 44 of 114 — 39% — and named seven whole families
// with zero readers between them:
//
//   criminal       Stealth, Deception, Black Market Ties, Heat Tolerance
//   environmental  Weather Tolerance, Wilderness Survival, Contamination Resistance
//   technology     Machinery Aptitude, Electronics Repair, Signal/Comms Literacy, Salvage Engineering
//   educational    Literacy, Technical Knowledge, Historical Knowledge, Self-Taught Aptitude
//   reputation     Trustworthiness, Notoriety, Local Fame, Credibility
//   special        Artifact Sensitivity, Signal Perception, Anomaly Resistance
//   personality    Confidence, Humor, Charisma, Curiosity
//
// Every one of them was generated, stored, migrated to Postgres,
// restored, and never once consulted by anything that happened in the
// world. That is the eleventh standing rule in its other form: a trait
// nothing reads is indistinguishable from a trait that does not exist.
//
// ---------------------------------------------------------------------
// Why this file exists rather than a test per module
//
// Because the failure mode is shared, and it is not "the number is
// wrong". It is **"the reader runs and the number never moves"**, and
// it has three shapes, all three of which shipped in the first version
// of this work and are pinned below:
//
//   1. The reader is called with a world that has no trait rows, so it
//      returns its neutral default forever. Every existing fixture in
//      this suite is such a world — which is exactly why five of these
//      seven readers passed the whole suite without being executed
//      once on a real trait.
//   2. The reader computes a value that a later line overwrites.
//      `keys.js` computed a confidence from `personality.Confidence`
//      and then spread the resolver's own `decision` object over the
//      top of it, discarding the result on every call.
//   3. The reader is centred on zero rather than on the average
//      person, so reading the trait at all shifts the whole world's
//      calibration. An ordinary person got 75% of the mortality risk
//      and 75% of the clearance chance they had the day before.
//
// So every test here does the same thing: build the SAME world twice
// with the SAME everything except one family's values, and assert the
// outcome differs — and that an ordinary person's outcome is unchanged
// from what it was before any of this existed.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

const barter = require('../server/barter.js');
const infrastructure = require('../server/infrastructure.js');
const keys = require('../server/keys.js');
const perception = require('../server/perception.js');
const mortality = require('../server/mortality.js');
const policing = require('../server/policing.js');
const technology = require('../server/technology.js');

let nextId = 900000;

// A world with real `entity_traits` rows, which is the whole point —
// see shape 1 in the header. `family` is set to `value` and everything
// else to 50, so any difference between two of these worlds is
// attributable to exactly one family.
function personIn(worldState, family, value, extra = {}) {
  const id = nextId++;
  worldState.entityTraits.push(...generateEntityTraits(
    id, worldState.tick ?? 0, INDIVIDUAL_DEFINITIONS,
    (def) => (def.family === family ? value : 50),
  ));
  worldState.npcs.push({ id, status: 'active', traits: {}, createdTick: 0, ...extra });
  return id;
}

function bareWorld(extra = {}) {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    families: [],
    entityTraits: [],
    memories: [],
    relationships: [],
    entityKnowledge: [],
    decisionLog: [],
    ...extra,
  };
}

// ---------------------------------------------------------------------
// criminal — how well somebody evades, never why they offend
// ---------------------------------------------------------------------

test('criminal traits change who gets away with it', () => {
  const w = bareWorld();
  const slippery = personIn(w, 'criminal', 95);
  const hopeless = personIn(w, 'criminal', 5);

  const chance = (id) => policing.clearanceChance(
    w, { perpetrator_entity_id: id, victim_entity_id: null }, { capacity: 1 },
  );
  assert.ok(chance(slippery) < chance(hopeless),
    `a 95 evader is cleared at ${chance(slippery)} and a 5 at ${chance(hopeless)}`);
  assert.ok(policing.evasionOf(w, slippery) > policing.evasionOf(w, hopeless));
});

test('an ordinary offender is cleared at exactly the un-modified rate', () => {
  // Shape 3. The trait spreads the population out; it does not get to
  // move the world's baseline clearance rate.
  const w = bareWorld();
  const ordinary = personIn(w, 'criminal', 50);
  const incident = { perpetrator_entity_id: ordinary, victim_entity_id: null };

  const got = policing.clearanceChance(w, incident, { capacity: 1 });
  assert.equal(got, policing.BASE_CLEARANCE,
    'reading a trait moved the clearance rate of a world nobody changed');
});

test('an unrecorded offender reads as ordinary, not as effortless to catch', () => {
  // Unknown is not a zero — and a zero here would make an anonymous
  // crime the EASIEST kind to clear, which is backwards.
  const w = bareWorld();
  assert.equal(policing.evasionOf(w, null), 0.5);
  assert.equal(policing.evasionOf(w, 123456), 0.5);
  assert.equal(
    policing.clearanceChance(w, { perpetrator_entity_id: null, victim_entity_id: null },
      { capacity: 1 }),
    policing.BASE_CLEARANCE,
  );
});

test('crime.js still reads no trait at all, which is the constraint', () => {
  // §9 forbids demographics determining criminality. That is about
  // what drives somebody to OFFEND; this work is about how well they
  // EVADE, and the line between the two is the whole justification for
  // reading `criminal` anywhere. If a generator ever starts reading a
  // trait, this file should fail.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'crime.js'), 'utf8',
  );
  assert.equal(source.includes('getLiveEntity'), false,
    'crime.js reads a trait — a generator keyed to who somebody is writes exactly '
    + 'the model §9 forbids');
});

// ---------------------------------------------------------------------
// environmental — surviving conditions
// ---------------------------------------------------------------------

test('environmental traits change who survives a famine', () => {
  const w = bareWorld();
  const hardy = personIn(w, 'environmental', 100);
  const frail = personIn(w, 'environmental', 0);

  const risk = (id) => mortality.annualDeathRisk(w, id, { age: 30, scarcity: 1 });
  assert.ok(risk(hardy) < risk(frail),
    `hardy ${risk(hardy)} vs frail ${risk(frail)}`);
});

test('hardiness moves the environment term and leaves the age curve alone', () => {
  // The distinction the constant's comment claims: being able to cope
  // with weather does not make anybody younger.
  const w = bareWorld();
  const hardy = personIn(w, 'environmental', 100);
  const frail = personIn(w, 'environmental', 0);

  const noScarcity = (id) => mortality.annualDeathRisk(w, id, { age: 90, scarcity: 0 });
  assert.equal(noScarcity(hardy), noScarcity(frail),
    'hardiness changed the risk of old age, which it has no business touching');
});

test('an ordinary person faces exactly the environment risk they always did', () => {
  const w = bareWorld();
  const ordinary = personIn(w, 'environmental', 50);
  assert.equal(mortality.hardinessFactor(w, ordinary), 1);

  const expected = mortality.BASE_ANNUAL_RISK
    + (30 / mortality.MAX_AGE) ** mortality.AGE_EXPONENT
    + mortality.scarcityRisk(1);
  const got = mortality.annualDeathRisk(w, ordinary, { age: 30, scarcity: 1 });
  // vitalityOf is the health family, held at 50 here, so it is 1.
  assert.ok(Math.abs(got - expected) < 1e-9,
    `reading a trait moved an ordinary person's risk from ${expected} to ${got}`);
});

// ---------------------------------------------------------------------
// technology — keeping what was built working
// ---------------------------------------------------------------------

test('technology traits change how fast a city falls apart', () => {
  const w = bareWorld({ communities: [{ id: 1, city_id: 7 }], cities: [{ id: 7 }] });
  personIn(w, 'technology', 100, { communityId: 1 });
  const engineers = infrastructure.technicalSkillIn(w, 7);

  const v = bareWorld({ communities: [{ id: 1, city_id: 7 }], cities: [{ id: 7 }] });
  personIn(v, 'technology', 0, { communityId: 1 });
  const nobody = infrastructure.technicalSkillIn(v, 7);

  assert.ok(engineers > nobody, `${engineers} vs ${nobody}`);

  const row = { maintenance_level: 50, city_id: 7 };
  assert.ok(infrastructure.effectiveMaintenance(w, row)
    > infrastructure.effectiveMaintenance(v, row));
});

test('a city with nobody in it is maintained exactly as recorded', () => {
  const w = bareWorld({ communities: [], cities: [{ id: 7 }] });
  assert.equal(infrastructure.technicalSkillIn(w, 7), 50);
  assert.equal(infrastructure.effectiveMaintenance(w, { maintenance_level: 40, city_id: 7 }), 40);
});

// ---------------------------------------------------------------------
// educational — what a people know
// ---------------------------------------------------------------------

test('educational traits change what a civilization can recover', () => {
  const build = (value) => {
    const w = bareWorld({ civilizations: [], technologyEras: [], eraUnlocks: [] });
    technology.reseedIds(w);
    technology.seedTechnologyEras(w);
    const civ = technology.foundCivilization(w, { name: `C${value}`, stability: 50 });
    personIn(w, 'educational', value, { civilizationId: civ.id });
    return { w, civ };
  };
  const scholars = build(100);
  const illiterate = build(0);

  assert.ok(technology.learningOf(scholars.w, scholars.civ.id)
    > technology.learningOf(illiterate.w, illiterate.civ.id),
  'a civilization of scholars did not read as better educated than one that cannot read');

  // And the requirement it has to clear moves with it: an educated
  // population recovers a technology a forgetful one cannot.
  const asked = ({ w, civ }, era) => {
    const blocked = technology.canUnlock(w, { civilizationId: civ.id, eraName: era });
    return blocked;
  };
  assert.ok(asked(scholars, 'bronze_working'));
  assert.ok(asked(illiterate, 'bronze_working'));
});

test('a civilization with nobody attached asks for exactly its stated requirement', () => {
  const w = bareWorld({ civilizations: [], technologyEras: [], eraUnlocks: [] });
  technology.reseedIds(w);
  assert.equal(technology.learningOf(w, 1), 50,
    'an unpeopled civilization should neither gain nor lose');
});

// ---------------------------------------------------------------------
// reputation — what somebody's word is worth
// ---------------------------------------------------------------------

test('reputation changes what a seller can get for the same goods', () => {
  const w = bareWorld({ resources: [], cities: [], communities: [] });
  const trusted = personIn(w, 'reputation', 100);
  const shifty = personIn(w, 'reputation', 0);
  const buyer = personIn(w, 'reputation', 50);

  const item = barter.SOURCED_ITEMS[0].name;
  const priced = (seller) => barter.agreedPrice(w, item, { sellerId: seller, buyerId: buyer });

  assert.ok(priced(trusted).unitPrice > priced(shifty).unitPrice,
    `trusted ${priced(trusted).unitPrice} vs shifty ${priced(shifty).unitPrice}`);
});

test('an ordinary seller gets exactly the un-modified barter score', () => {
  const w = bareWorld({ resources: [], cities: [], communities: [] });
  const seller = personIn(w, 'reputation', 50);
  const buyer = personIn(w, 'reputation', 50);

  const item = barter.SOURCED_ITEMS[0].name;
  const deal = barter.agreedPrice(w, item, { sellerId: seller, buyerId: buyer });
  assert.ok(Math.abs(deal.unitPrice - deal.Final_Barter_Score) < 1e-9,
    `reading a trait moved an even deal from ${deal.Final_Barter_Score} to ${deal.unitPrice}`);
});

// ---------------------------------------------------------------------
// special — how well a signal is picked up
// ---------------------------------------------------------------------
//
// **The wrong home, recorded because the reasoning is the useful
// part.** The first version gated accepting an artifact mission on a
// sensitivity floor. `generateMission` REQUIRES an artifact, so
// "artifact missions" is every mission, and the floor was a permanent
// lock on the engine's only player verb for whoever rolled low at
// generation — 25% of a measured population at the threshold first
// tried. Gating on how strange the artifact is instead fails standing
// rule 6: `artifacts.rarity` and `energy_class` are free TEXT that
// nothing writes, so the branch would never fire.
//
// `server/perception.js` has the argument in full. What is tested here
// is the home it moved to: the confidence somebody ends up holding a
// broadcast fact at.

test('special traits change how firmly news is taken in', () => {
  const w = bareWorld();
  const sharp = personIn(w, 'special', 100);
  const oblivious = personIn(w, 'special', 0);

  assert.ok(perception.receivedConfidence(w, sharp, 0.9)
    > perception.receivedConfidence(w, oblivious, 0.9),
  'the sharpest and the most oblivious person took the same news in identically');
});

test('an ordinary listener receives news at exactly the stated confidence', () => {
  const w = bareWorld();
  const ordinary = personIn(w, 'special', 50);
  assert.ok(Math.abs(perception.receivedConfidence(w, ordinary, 0.9) - 0.9) < 1e-9,
    'reading a trait moved what an ordinary person hears');
  assert.equal(perception.perceptionOf(w, ordinary), 50);
});

test('an unmeasured confidence stays null rather than becoming a number', () => {
  const w = bareWorld();
  const id = personIn(w, 'special', 100);
  assert.equal(perception.receivedConfidence(w, id, null), null);
  assert.equal(perception.receivedConfidence(w, id, undefined), null);
});

test('a running world gives two people different confidence in the same fact', () => {
  // Standing rule 6's shape, and the one that matters: the unit tests
  // above call `perception.js` directly. This runs the real pipeline
  // and looks at the `entity_knowledge` rows it produced.
  //
  // The shortage is forced rather than waited for. A generated world
  // starts in rough balance on purpose (`worldgen.js` calibrates for
  // it), so a broadcast crossing may simply never happen in sixty
  // ticks — and a test that passes only when the world happens to
  // starve is the eighth standing rule's mistake in another costume.
  const worldgen = require('../server/worldgen.js');
  const w = engine.WorldState;
  worldgen.generateWorld({ communitiesPerCity: 2, populationPerCommunity: 20, seed: 'hear' });
  for (const resource of w.resources) {
    resource.supply = 1;
    resource.demand = 1000;
  }

  const before = w.entityKnowledge.length;
  engine.advanceTick();
  const fresh = w.entityKnowledge.slice(before);

  assert.ok(fresh.length > 0, 'a shortage crossed the broadcast threshold and nobody heard');
  const levels = new Set(fresh.map((k) => k.confidence_level));
  assert.ok(levels.size > 1,
    'every person in the world holds the same fact at exactly the same confidence — '
    + 'perception is wired but not reached');
  for (const level of levels) {
    assert.ok(level >= 0 && level <= 1, `confidence_level ${level} is not a probability`);
  }
});

// ---------------------------------------------------------------------
// personality — how firmly a judgement is held
// ---------------------------------------------------------------------

test('personality changes how confidently the same decision is logged', () => {
  // **Shape 2, and the reason this file exists.** The first version of
  // this computed a confidence from the trait and then spread the
  // resolver's own `decision` object over the top of it — so the
  // number written was always the resolver's own, on every call, for
  // all seven Keys. Everything ran. Nothing moved.
  const context = (w) => ({
    tick: w.tick, worldState: w, applyKeyModifier: () => null,
    otherEntityId: 999, knowledge: [],
  });

  const sure = bareWorld();
  const sureId = personIn(sure, 'personality', 100);
  keys.resolveResilience({ ...sure.npcs[0], id: sureId, traits: sheetFor(sure, sureId) },
    context(sure));

  const unsure = bareWorld();
  const unsureId = personIn(unsure, 'personality', 0);
  keys.resolveResilience({ ...unsure.npcs[0], id: unsureId, traits: sheetFor(unsure, unsureId) },
    context(unsure));

  const a = sure.decisionLog[0].confidence;
  const b = unsure.decisionLog[0].confidence;
  assert.ok(a > b, `a confident person logged ${a} and a diffident one ${b}`);
});

test('an ordinary person logs exactly the confidence the resolver computed', () => {
  const w = bareWorld();
  const id = personIn(w, 'personality', 50);
  keys.resolveResilience({ ...w.npcs[0], id, traits: sheetFor(w, id) }, {
    tick: w.tick, worldState: w, applyKeyModifier: () => null,
    otherEntityId: 999, knowledge: [],
  });
  // Resilience computes `resilienceScore / 100`, and every trait here
  // is 50, so the score is 50 and the confidence 0.5.
  assert.ok(Math.abs(w.decisionLog[0].confidence - 0.5) < 1e-9,
    `an ordinary person logged ${w.decisionLog[0].confidence}`);
});

test('a decision nobody measured the certainty of stays null, not zero', () => {
  const decisions = require('../server/decisions.js');
  const w = bareWorld();
  decisions.reseedIds(w);
  const row = decisions.record(w, { entityId: personIn(w, 'personality', 100) });
  assert.equal(row.confidence, null,
    'an unmeasured certainty was multiplied by a trait into an invented number');
});

function sheetFor(worldState, entityId) {
  const { traitsToSheet, getEntityTraitsForEntity } = require('../server/entityTraits.js');
  return traitsToSheet(getEntityTraitsForEntity(worldState, entityId));
}

// ---------------------------------------------------------------------
// the claim itself
// ---------------------------------------------------------------------

test('every one of the seven families is read by something in server/', () => {
  // Structural, and the one that cannot rot: an eighth family added
  // and left unread would not be caught by any test above, and a
  // reader deleted would make one of them silently stop mattering.
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'server');
  const source = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');

  const FAMILIES = [
    'criminal', 'environmental', 'technology', 'educational',
    'reputation', 'special', 'personality',
  ];
  const unread = FAMILIES.filter((family) => !new RegExp(
    `traits\\?\\.${family}|traits\\.${family}`,
  ).test(source));
  assert.deepEqual(unread, [],
    `generated on every entity and read by nothing: ${unread.join(', ')}`);
});
