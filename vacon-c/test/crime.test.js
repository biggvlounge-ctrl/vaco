// Typed crime — the substrate every crime statistic needed.
//
// **The finding this suite records.** §9's MASTER BLOCK KEY asks for
// seven crime categories per area. The engine answered with two
// aggregate NUMERIC columns (`communities.crime`, seeded to 0 and
// updated by nothing) and one `conflict_escalation` event whose only
// account of what happened was an English sentence in a `note` field.
// So "violent crime in this block" was not an unimplemented number, it
// was an unrepresentable one.
//
// These tests hold three things: that a crime has a type and a place,
// that a category nothing generates says so rather than reporting a
// zero indistinguishable from a measured one, and that the generators
// read the environment rather than the person.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const crime = require('../server/crime.js');
const areaStats = require('../server/areaStats.js');
const economy = require('../server/economy.js');
const territory = require('../server/territory.js');
const engine = require('../server/engine.js');

function world({ tick = 100 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    deceased: [],
    communities: [],
    organizations: [],
    families: [],
    familyMemberships: [],
    entityTraits: [],
    entityKnowledge: [],
    memories: [],
    relationships: [],
    historicalRecords: [],
    activeConditions: [],
    employmentRecords: [],
    individualFinances: [],
    crimeIncidents: [],
    resources: [],
    marketListings: [],
  };
  territory.reseedIds(worldState);
  economy.reseedIds(worldState);
  crime.reseedIds(worldState);
  return worldState;
}

let nextId = 1;
function person(worldState, { communityId = null, savings = 100 } = {}) {
  const npc = { id: nextId++, status: 'active', communityId, home_property_id: null };
  worldState.npcs.push(npc);
  economy.generateIndividualFinances(worldState, npc.id, { savings, tick: worldState.tick });
  return npc;
}

// -- the record ---------------------------------------------------------

test('a crime carries a category, and an unknown category is refused', () => {
  // **A typo would create a ninth category that every per-category
  // report silently omits** — a crime wave that shows up nowhere. The
  // refusal is the whole point of validating here rather than at a
  // boundary.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });

  assert.throws(
    () => crime.recordCrime(w, { category: 'vandalism', perpetratorId: a.id }),
    /"vandalism" is not a crime category/,
  );
  const incident = crime.recordCrime(w, { category: 'theft', perpetratorId: a.id });
  assert.equal(incident.category, 'theft');
});

test('a crime is filed against the victim\'s community, not the offender\'s', () => {
  // Counted where it happened to somebody. An offender who travels to
  // rob a wealthier block should raise that block's rate, not their
  // own — otherwise crime statistics describe where criminals sleep.
  const w = world();
  const here = territory.generateCommunity(w, {});
  const there = territory.generateCommunity(w, {});
  const offender = person(w, { communityId: here.id });
  const victim = person(w, { communityId: there.id });

  const incident = crime.recordCrime(w, {
    category: 'theft', perpetratorId: offender.id, victimId: victim.id,
  });
  assert.equal(incident.community_id, there.id);
});

test('an incident with nobody placed is recorded with no community, not an arbitrary one', () => {
  // Same rule `areaStats.unplaced` follows: visibly excluded beats
  // quietly corrupting somebody else's numbers.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const drifter = person(w);
  const incident = crime.recordCrime(w, { category: 'property', perpetratorId: drifter.id });

  assert.equal(incident.community_id, null);
  assert.equal(crime.incidentsIn(w, c.id).length, 0);
});

test('a serious crime becomes world history with an id a database can hold', () => {
  // **The id is the point.** `historical_records.id` is a BIGSERIAL
  // PRIMARY KEY and `migrate.js` inserts it explicitly, so a record
  // pushed without one arrives as NULL and the whole migration fails
  // — invisible in memory, because every read path finds a record by
  // `what`/`who` rather than by id.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });

  crime.recordCrime(w, { category: 'violent', perpetratorId: a.id, victimId: b.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id });

  const history = w.historicalRecords.filter((h) => h.what === 'crime');
  assert.equal(history.length, 1, 'only the violent one clears the significance floor');
  assert.equal(history[0].why, 'violent');
  assert.ok(Number.isInteger(history[0].id), 'a history record with no id cannot be migrated');
});

test('the victim learns something, and how much depends on who robbed them', () => {
  // **This used to assert the victim learned NOTHING**, on the
  // argument that "a victim who automatically knows exactly what
  // happened to them would make `entity_knowledge`'s distortion and
  // confidence model meaningless". The argument was right; the
  // conclusion was that the victim got nothing at all, and no
  // mechanism to observe the harm was ever built.
  //
  // So **nothing in this engine wrote a knowledge row whose
  // `subject_entity_id` is a person** — measured, 0 of 600 — and that
  // was the gate behind two of the seven Keys. `runSocialPhase` runs
  // `resolveTrust` only where the actor holds a fact ABOUT the other
  // party, so `keys_log` measured Trust at **0 resolutions in 300
  // ticks**: the whole Social category dead.
  //
  // The original reasoning is honoured rather than reversed. The
  // victim does not get the truth; they get what they could make out,
  // drawn against the offender's own `criminal` family via
  // `policing.evasionOf` and their own perception. That is the
  // distortion model being USED rather than reserved.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id });

  assert.equal(w.memories.filter((m) => m.entity_id === a.id).length, 1);

  // The victim now has a memory, and it is NEGATIVE — which is the
  // half the knowledge row cannot carry. `knowledgeCharge` measures
  // whether a fact is true, not whether it is good, so a firmly-known
  // fact alone would raise the victim's trust in whoever robbed them.
  const victimMemories = w.memories.filter((m) => m.entity_id === b.id);
  assert.equal(victimMemories.length, 1);
  assert.equal(victimMemories[0].memory_type, 'negative');
  assert.ok(victimMemories[0].emotion_level < 0);
  assert.deepEqual(victimMemories[0].related_entity_ids, [a.id]);

  // And a fact about a PERSON, which is what opens the gate.
  const learned = w.entityKnowledge.filter((k) => k.entity_id === b.id);
  assert.equal(learned.length, 1);
  assert.equal(learned[0].subject_entity_id, a.id);
  // Never certainty: the confidence is what they could make out, and
  // the fact_type follows it rather than being asserted.
  assert.ok(learned[0].confidence_level > 0 && learned[0].confidence_level < 1,
    `the victim was handed a confidence of ${learned[0].confidence_level}`);
  assert.ok(['known', 'assumption'].includes(learned[0].fact_type));
  // It travels — `media.runWordOfMouth` carries `subject_entity_id`,
  // so a neighbourhood learns who is worth avoiding.
  assert.ok(learned[0].spread_rate > 0);
});

test('a skilled offender leaves the victim guessing, an unskilled one does not', () => {
  // The distortion model doing the work it exists for. Standing rule 8:
  // both subjects are constructed, because the whole assertion is
  // about where their `criminal` traits put them.
  // **Through `entity_traits`, not the frozen sheet** — standing rule
  // 9. `policing.evasionOf` reads the LIVE entity, so setting
  // `npc.traits` would measure nothing; this fixture's `person` helper
  // creates no trait rows at all, so they are built here.
  const { generateEntityTraits } = require('../server/entityTraits.js');
  const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');

  const learn = (evasionTrait) => {
    const w = world();
    const c = territory.generateCommunity(w, {});
    const offender = person(w, { communityId: c.id });
    const victim = person(w, { communityId: c.id });
    w.entityTraits.push(...generateEntityTraits(
      offender.id, w.tick, INDIVIDUAL_DEFINITIONS,
      (def) => (def.family === 'criminal' ? evasionTrait : 50),
    ));
    crime.recordCrime(w, { category: 'theft', perpetratorId: offender.id, victimId: victim.id });
    return w.entityKnowledge.find((k) => k.entity_id === victim.id);
  };

  const ghost = learn(100);
  const clumsy = learn(0);
  assert.ok(clumsy.confidence_level > ghost.confidence_level,
    'a ghost and a clumsy thief were equally identifiable');
  assert.equal(clumsy.fact_type, 'known');
  assert.equal(ghost.fact_type, 'assumption');
  // Distortion is the complement, so a guess arrives garbled and
  // degrades further with every retelling.
  assert.ok(ghost.distortion_level > clumsy.distortion_level);
});

test('a crime with no victim tells nobody about anybody', () => {
  // A property offence against nobody has no observer. Writing a
  // knowledge row with a null subject would put a fact about nothing
  // into the table the Social Key gates on.
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  crime.recordCrime(w, { category: 'property', perpetratorId: a.id, victimId: null });
  assert.equal(w.entityKnowledge.length, 0);
});

// -- domestic vs violent ------------------------------------------------

test('an escalation inside a family is domestic, and outside it is violent', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });
  const stranger = person(w, { communityId: c.id });

  w.families.push({ id: 1, surname: 'Vance' });
  w.familyMemberships.push({ entity_id: a.id, family_id: 1, role: 'parent' });
  w.familyMemberships.push({ entity_id: b.id, family_id: 1, role: 'partner' });

  assert.equal(crime.sharesFamily(w, a.id, b.id), true);
  assert.equal(crime.sharesFamily(w, a.id, stranger.id), false);

  assert.equal(
    crime.recordEscalation(w, { perpetratorId: a.id, victimId: b.id }).category,
    'domestic',
  );
  assert.equal(
    crime.recordEscalation(w, { perpetratorId: a.id, victimId: stranger.id }).category,
    'violent',
  );
});

// -- the generators read the environment --------------------------------

test('deprivation pressure is poverty and shortage, and is zero at the line', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  for (const savings of [100, 100, 100, 100]) person(w, { communityId: c.id, savings });
  const poor = person(w, { communityId: c.id, savings: 0 });
  const line = areaStats.povertyLine(w);   // median 100 → line 50

  const comfortable = w.npcs[0];
  assert.equal(crime.deprivationPressure(w, comfortable, { line, scarcity: 0 }), 0,
    'somebody at or above the line is under no deprivation pressure at all');
  assert.equal(crime.deprivationPressure(w, poor, { line, scarcity: 0 }), 1);

  // A shortage on top of poverty makes it worse, and is capped at 1.
  const halfway = person(w, { communityId: c.id, savings: 25 });
  const dry = crime.deprivationPressure(w, halfway, { line, scarcity: 0 });
  const drought = crime.deprivationPressure(w, halfway, { line, scarcity: 1 });
  assert.ok(drought > dry, 'a shortage should raise the pressure');
  assert.ok(drought <= 1);
});

test('deprivation produces theft when there is somebody to take from, property when there is not', () => {
  // The distinction §9 draws between "theft" and "property crime", and
  // it is structural rather than a coin flip: a block with nobody
  // above the line has nobody to rob.
  const w = world({ tick: 1 });
  const mixed = territory.generateCommunity(w, {});
  const destitute = territory.generateCommunity(w, {});

  // World median comes from everybody, so the rich block sets the line.
  for (let i = 0; i < 6; i += 1) person(w, { communityId: mixed.id, savings: 1000 });
  for (let i = 0; i < 40; i += 1) person(w, { communityId: mixed.id, savings: 0 });
  for (let i = 0; i < 40; i += 1) person(w, { communityId: destitute.id, savings: 0 });

  // Run enough ticks that the seeded draws fire somewhere. The rate is
  // deliberately low; this is a statistical claim with stated bounds,
  // not an assertion about one draw (standing rule 8).
  for (let t = 1; t <= 400; t += 1) {
    w.tick = t;
    crime.runDeprivationCrime(w, t);
  }

  const inMixed = crime.incidentsIn(w, mixed.id);
  const inDestitute = crime.incidentsIn(w, destitute.id);
  assert.ok(inMixed.length > 0, 'no crime was generated at all in 400 ticks of total deprivation');
  assert.ok(inDestitute.length > 0);

  assert.ok(inMixed.some((i) => i.category === 'theft'),
    'a block with wealthy residents should produce thefts');
  assert.equal(inDestitute.every((i) => i.category === 'property'), true,
    'a block with nobody above the line has nobody to steal from');
  assert.equal(inDestitute.every((i) => i.victim_entity_id === null), true);
});

test('nobody robs themselves', () => {
  // One rich resident alone in a block is the degenerate case: they
  // are both the only target and, if the line moves, a possible
  // offender.
  const w = world({ tick: 1 });
  const c = territory.generateCommunity(w, {});
  const only = person(w, { communityId: c.id, savings: 1000 });
  for (let i = 0; i < 20; i += 1) person(w, { communityId: c.id, savings: 0 });

  for (let t = 1; t <= 300; t += 1) crime.runDeprivationCrime(w, t);
  for (const incident of crime.incidentsIn(w, c.id)) {
    assert.notEqual(incident.perpetrator_entity_id, incident.victim_entity_id);
  }
  assert.ok(crime.incidentsIn(w, c.id).some((i) => i.victim_entity_id === only.id));
});

test('a comfortable world with no shortage generates no deprivation crime', () => {
  // The control. If this fires, the generator is not reading the
  // environment — it is reading nothing and rolling anyway.
  const w = world({ tick: 1 });
  const c = territory.generateCommunity(w, {});
  for (let i = 0; i < 40; i += 1) person(w, { communityId: c.id, savings: 100 });

  for (let t = 1; t <= 1000; t += 1) crime.runDeprivationCrime(w, t);
  assert.equal(w.crimeIncidents.length, 0);
});

test('the same world and the same tick commit the same crimes', () => {
  // §88's replay guarantee. Two identical worlds, run identically,
  // must produce identical incidents — a crime generator on
  // Math.random() would make every world unreproducible.
  function run() {
    const w = world({ tick: 1 });
    const c = territory.generateCommunity(w, {});
    nextId = 9000;   // same ids in both runs, which is what the seed keys off
    for (let i = 0; i < 10; i += 1) person(w, { communityId: c.id, savings: 500 });
    for (let i = 0; i < 30; i += 1) person(w, { communityId: c.id, savings: 0 });
    for (let t = 1; t <= 300; t += 1) crime.runDeprivationCrime(w, t);
    return w.crimeIncidents.map((i) => `${i.tick}:${i.category}:${i.perpetrator_entity_id}`);
  }
  const first = run();
  const second = run();
  assert.ok(first.length > 0);
  assert.deepEqual(first, second);
  nextId = 20000;
});

// -- honest zeroes ------------------------------------------------------

test('every category §9 names is countable, and the ungenerated ones say why', () => {
  // **A zero that means "nobody did it here" and a zero that means "we
  // do not model this" are different facts.** Reporting them as the
  // same number is exactly the defect this module exists to avoid, so
  // the reason travels with the category.
  assert.deepEqual(crime.CRIME_CATEGORIES.sort(), [
    'domestic', 'drug', 'fraud', 'gun', 'property', 'sex_offense', 'theft', 'violent',
  ]);

  for (const [category, meta] of Object.entries(crime.CATEGORIES)) {
    if (meta.generated) {
      assert.ok(meta.note && meta.note.length > 20, `${category} claims a generator and describes none`);
      assert.equal(meta.substrate, undefined);
    } else {
      assert.ok(meta.substrate && meta.substrate.length > 60,
        `${category} has no generator and no explanation of what it is waiting for`);
    }
  }

  // `gun` joined the generated set when server/inventory.js gave an
  // offence something to be armed WITH. Its declared reason was
  // precisely "no weapon exists anywhere in the schema", and that
  // stopped being true.
  assert.deepEqual(crime.GENERATED_CATEGORIES.sort(),
    ['domestic', 'gun', 'property', 'theft', 'violent']);
});

test('sex_offense is recordable and nothing in the engine generates one', () => {
  // A decision, not a gap — and the decision is held by a test so it
  // cannot be undone by accident. The statistic can be reported
  // honestly by a world that records one; this engine never writes one
  // on its own.
  assert.equal(crime.CATEGORIES.sex_offense.generated, false);
  assert.match(crime.CATEGORIES.sex_offense.substrate, /deliberately ungenerated/);

  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });
  const incident = crime.recordCrime(w, {
    category: 'sex_offense', perpetratorId: a.id, victimId: b.id,
  });
  assert.equal(crime.countsByCategory(w, c.id).sex_offense, 1);
  assert.ok(incident.severity >= crime.HISTORY_SIGNIFICANCE_FLOOR);
});

test('no generator reads a trait, because §9 forbids the model that would build', () => {
  // §9: the system supports demographic modelling "without making
  // demographics determine an NPC's morality, criminality,
  // intelligence, or worth". A generator keyed to who somebody IS
  // rather than what they are living through writes exactly that
  // model, one commit at a time — so the source is held to reading the
  // environment.
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../server/crime.js'), 'utf8');
  const body = src.slice(src.indexOf("'use strict'"));
  for (const forbidden of ['traitsToSheet', 'getLiveEntity', 'traitValue', 'entityTraits']) {
    assert.equal(body.includes(forbidden), false,
      `crime.js reads ${forbidden}: a crime generator must read circumstances, not people`);
  }
});

// -- counts and rates ---------------------------------------------------

test('counts cover every category so two areas have the same shape', () => {
  // **This is what makes areas comparable at all.** An object built
  // only from the categories that occurred would give a quiet block
  // three keys and a violent one eight, and no comparison across them
  // would line up.
  const w = world();
  const quiet = territory.generateCommunity(w, {});
  const rough = territory.generateCommunity(w, {});
  const a = person(w, { communityId: rough.id });
  const b = person(w, { communityId: rough.id });
  crime.recordCrime(w, { category: 'violent', perpetratorId: a.id, victimId: b.id });
  crime.recordCrime(w, { category: 'violent', perpetratorId: a.id, victimId: b.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id });

  const quietCounts = crime.countsByCategory(w, quiet.id);
  const roughCounts = crime.countsByCategory(w, rough.id);
  assert.deepEqual(Object.keys(quietCounts).sort(), Object.keys(roughCounts).sort());
  assert.equal(roughCounts.violent, 2);
  assert.equal(roughCounts.theft, 1);
  assert.equal(quietCounts.violent, 0);
});

test('the rate is per 1,000 residents, and an empty area has none', () => {
  // Raw totals cannot rank a 40-person block against a 4,000-person
  // district. Every cross-area statistic in this project is
  // normalised, and an area with no residents has no rate rather than
  // a rate of zero.
  const w = world();
  const small = territory.generateCommunity(w, {});
  const empty = territory.generateCommunity(w, {});
  const a = person(w, { communityId: small.id });
  const b = person(w, { communityId: small.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id });

  assert.equal(crime.ratePer1k(w, small.id), 500);
  assert.equal(crime.ratePer1k(w, empty.id), null);
});

test('a window can be applied, so a rate means "lately" rather than "ever"', () => {
  const w = world();
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  const b = person(w, { communityId: c.id });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id, tick: 10 });
  crime.recordCrime(w, { category: 'theft', perpetratorId: a.id, victimId: b.id, tick: 900 });

  assert.equal(crime.incidentsIn(w, c.id).length, 2);
  assert.equal(crime.incidentsIn(w, c.id, { sinceTick: 500 }).length, 1);
  assert.equal(crime.worldCounts(w, { sinceTick: 500 }).theft, 1);
});

// -- the engine wiring --------------------------------------------------

test('the WorldState the engine actually ships carries crime incidents', () => {
  // Standing rule 6 in its usual shape: a module that writes to an
  // array the real WorldState does not declare writes to `undefined`
  // and nothing notices until a restore.
  assert.ok(Array.isArray(engine.WorldState.crimeIncidents));
});

test('ids survive a reseed, so a restored world does not reuse them', () => {
  const w = world();
  w.crimeIncidents.push({ id: 41, category: 'theft', tick: 1 });
  assert.deepEqual(crime.reseedIds(w), { nextCrimeId: 42 });
  const c = territory.generateCommunity(w, {});
  const a = person(w, { communityId: c.id });
  assert.equal(crime.recordCrime(w, { category: 'theft', perpetratorId: a.id }).id, 42);
});
