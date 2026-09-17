// What happens after somebody is caught.
//
// **Three notes in `urbanSystems.js`, one gap.** Law Enforcement was
// `partial` — "clearance is NOT arrest ... raids, arrests and
// sentencing would need somewhere to put people first". Court was
// `partial` — "No courts, cases or judgements — nothing applies a law
// to anybody, so this is legislation without adjudication."  Prison was
// `absent` — "§17 lists `imprisoned` as an NPC status. Searched: the
// string appears nowhere in the schema or under server/."
//
// So a settlement could generate a crime, name the person who did it,
// investigate it, clear it, and then nothing whatever happened to them;
// and separately, `laws` was a table no code read when deciding
// anything. `server/justice.js` is the link.
//
// ---------------------------------------------------------------------
// The defect found on the way, which was larger than the feature
//
// **`relationships.conflict` was initialised to 0 and the only writer
// in the engine was gated behind its own threshold.**
// `runSecurityPhase` calls `keys.resolveAggression` when a
// relationship's `conflict` exceeds 30; `resolveAggression` is the sole
// code anywhere that raises `conflict`. Conflict starts at 0, so the
// resolver never ran, so conflict never rose. Measured on a 200-tick
// generated world: **0 of 241 relationships had a conflict above zero.**
// Not one violent or domestic offence has ever occurred in any world
// this engine has generated, and two of §9's four generatable crime
// categories were unreachable.
//
// That is `relationships.love` exactly — "initialised to 0 and written
// by nothing", so no child could ever be born, with eighteen passing
// tests saying otherwise because every one set the field directly.
// `crime.advanceFriction` is the same answer `births.advanceBonds` was.
//
// And its first version was wrong in the way standing rule 12's third
// clause describes: `FRICTION_STRAIN_FLOOR` was 50 because 50 sounds
// like the middle of a 0-100 scale. Measured stress in a settled world
// runs 0 to 43.8 with a median of 0, so the strain term was dead, and
// averaging a dead term in with two live ones capped conflict at 21.2
// against a threshold of 30 — a fix that changed nothing while looking
// like it had worked.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const justice = require('../server/justice.js');
const crime = require('../server/crime.js');
const politics = require('../server/politics.js');
const behavior = require('../server/behavior.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

// -- the vocabularies are two other files' ---------------------------------

test('every crime category maps to a real law category, and carries a sentence', () => {
  // An offence with no entry is dismissed for want of a law, which is
  // indistinguishable from a city that never legislated — so a renamed
  // category would quietly make every case of it walk, forever, and
  // `unlegislated_crime_share` would report it as a fact about the
  // government. The module asserts this at require time; this is the
  // same check where somebody will see it fail.
  for (const category of Object.keys(crime.CATEGORIES)) {
    assert.ok(justice.LAW_FOR_OFFENCE[category],
      `${category} is a crime category with no law category`);
    assert.ok(politics.LAW_CATEGORIES.includes(justice.LAW_FOR_OFFENCE[category]),
      `${category} maps to "${justice.LAW_FOR_OFFENCE[category]}", which is not a law category`);
    assert.ok(Number.isFinite(justice.SENTENCE_TICKS[category]),
      `${category} has no sentence length, so a conviction would imprison somebody forever`);
  }
  assert.doesNotThrow(() => justice.assertVocabulariesLineUp());
});

// -- the deadlock, pinned --------------------------------------------------

test('conflict can rise at all, which it could not', () => {
  // **The regression that matters most in this file.** Nothing outside
  // `resolveAggression` wrote `conflict`, and `resolveAggression` only
  // ran above 30.
  const w = {
    tick: 0,
    relationships: [{
      entity_a_id: 1, entity_b_id: 2, relationship_type: 'social',
      trust: 20, competition: 70, conflict: 0, interaction_count: 100,
    }],
    entityState: [],
    npcs: [], events: [],
  };

  for (let t = 0; t < 200; t += 1) {
    w.tick = t;
    crime.advanceFriction(w, { tick: t });
  }
  assert.ok(w.relationships[0].conflict > 30,
    `a pair at trust 20 and rivalry 70 reached only ${w.relationships[0].conflict} — `
    + 'the escalation threshold is 30, so violent crime is still unreachable');
});

test('friction is a target approached, not an accumulator', () => {
  // An accumulator would put every long-lived relationship over the
  // threshold eventually regardless of circumstance — a model in which
  // everybody who lives long enough tries to kill somebody.
  const w = {
    tick: 0,
    relationships: [{
      entity_a_id: 1, entity_b_id: 2, relationship_type: 'social',
      trust: 50, competition: 0, conflict: 0, interaction_count: 5000,
    }],
    entityState: [], npcs: [], events: [],
  };
  for (let t = 0; t < 2000; t += 1) {
    w.tick = t;
    crime.advanceFriction(w, { tick: t });
  }
  assert.ok(w.relationships[0].conflict < 1,
    `two people who trust each other normally and compete over nothing reached `
    + `${w.relationships[0].conflict} after two thousand ticks of simply knowing each other`);

  // And it comes back DOWN when the cause passes.
  w.relationships[0].conflict = 60;
  for (let t = 2000; t < 2400; t += 1) {
    w.tick = t;
    crime.advanceFriction(w, { tick: t });
  }
  assert.ok(w.relationships[0].conflict < 60, 'conflict never falls, so a feud is forever');
});

test('two people who have never met are not in conflict', () => {
  const w = {
    tick: 0,
    relationships: [{
      entity_a_id: 1, entity_b_id: 2, relationship_type: 'social',
      trust: 0, competition: 100, conflict: 0, interaction_count: 1,
    }],
    entityState: [], npcs: [], events: [],
  };
  for (let t = 0; t < 500; t += 1) crime.advanceFriction(w, { tick: t });
  assert.equal(w.relationships[0].conflict, 0);
});

test('the strain floor is where a real population reaches, not where 100 halves', () => {
  // **Standing rule 12's third clause, and the measurement that caught
  // it.** The floor was 50; measured stress in a settled world runs
  // 0..43.8, so the term was dead on every person in the world.
  assert.ok(crime.FRICTION_STRAIN_FLOOR <= 40,
    `a strain floor of ${crime.FRICTION_STRAIN_FLOOR} is above what a settled population `
    + 'reaches (measured max 43.8), so the term contributes nothing');

  // Live in both directions: strain present raises the target, absent
  // does not sink it to nothing.
  const base = {
    entity_a_id: 1, entity_b_id: 2, trust: 30, competition: 40, conflict: 0,
    interaction_count: 100,
  };
  const calm = { tick: 0, entityState: [], relationships: [] };
  const strained = {
    tick: 0,
    entityState: [
      { entity_id: 1, stress_level: 90 },
      { entity_id: 2, stress_level: 90 },
    ],
    relationships: [],
  };
  const calmTarget = crime.frictionTarget(calm, base);
  const strainedTarget = crime.frictionTarget(strained, base);
  assert.ok(strainedTarget > calmTarget,
    'two people under real pressure are no more likely to fall out than two who are fine');
  assert.ok(calmTarget > 0, 'a distrustful rivalry with no pressure behind it reads as nothing');
});

test('unobserved is not calm', () => {
  // `behavior.moodFor` already shipped the bug of reading an
  // unobserved person as "content". Somebody with no `entity_state`
  // row contributes nothing rather than a zero.
  const w = { entityState: [{ entity_id: 1, stress_level: 100 }] };
  const both = { entityState: [
    { entity_id: 1, stress_level: 100 }, { entity_id: 2, stress_level: 100 },
  ] };
  assert.equal(crime.strainBetween(w, 1, 2), crime.strainBetween(both, 1, 2),
    'an unobserved partner was averaged in as a calm one');
  assert.equal(crime.strainBetween({ entityState: [] }, 1, 2), 0);
});

// -- the cascade, on a fixture ---------------------------------------------

function courtWorld({ lawCategory = 'property', category = 'theft' } = {}) {
  const w = {
    tick: 10,
    npcs: [{ id: 1, communityId: 5, status: 'active', home_property_id: 77 }],
    communities: [{ id: 5, city_id: 9 }],
    cities: [{ id: 9 }],
    laws: lawCategory
      ? [{ id: 100, category: lawCategory, jurisdiction_city_id: 9, status: 'active' }]
      : [],
    crimeIncidents: [{
      id: 1, category, perpetrator_entity_id: 1, victim_entity_id: null,
      community_id: 5, tick: 9, severity: 30, investigated_tick: 10, cleared: true,
    }],
    courtCases: [],
    employmentRecords: [{
      id: 1, entity_id: 1, employer_organization_id: 50, wage: 10,
      position: 'hand', start_tick: 0, status: 'active',
    }],
    scheduleEvents: [{ id: 2, entity_id: 1, event_type: 'work', frequency: 'daily', tick_last_occurred: 9 }],
    habits: [{ entity_id: 1, habit_name: 'work', strength: 80, harmful: false }],
    entityState: [], memories: [], relationships: [], entityKnowledge: [],
    historicalRecords: [], properties: [{ id: 77 }], entityTraits: [], events: [],
  };
  justice.reseedIds(w);
  return w;
}

test('a cleared incident becomes a conviction where a law covers it', () => {
  const w = courtWorld();
  const events = justice.runJustice(w, { tick: 10 });

  assert.equal(w.courtCases.length, 1);
  const [caseRow] = w.courtCases;
  assert.equal(caseRow.status, 'convicted');
  assert.equal(caseRow.law_id, 100, 'the case cites no law, so nothing read `laws`');
  assert.equal(caseRow.sentence_ticks, justice.SENTENCE_TICKS.theft);
  assert.equal(w.npcs[0].status, 'imprisoned');
  assert.equal(events.filter((e) => e.type === 'conviction').length, 1);
});

test('the sentence costs the things being inside costs', () => {
  const w = courtWorld();
  justice.runJustice(w, { tick: 10 });

  assert.equal(w.employmentRecords[0].status, 'ended', 'a prisoner kept drawing a wage');
  // `employment_records` has no `end_tick` column and economy.js says so
  // at length — writing one here would be the field the engine sets and
  // the database cannot hold.
  assert.equal(w.employmentRecords[0].end_tick, undefined);

  assert.equal(w.scheduleEvents.length, 0, 'a prisoner still commuted to work');
  // **Habits and mood survive.** `behavior.releaseDeceased` drops both
  // and is right to for a death; using it here would erase who somebody
  // was and hand back a stranger after ninety days.
  assert.equal(w.habits.length, 1, 'a sentence erased the person');

  assert.equal(w.npcs[0].home_property_id, 77, 'a prisoner was evicted, which nothing asked for');
  assert.ok(w.historicalRecords.some((r) => r.event_type === 'conviction'));
  assert.ok(w.memories.some((m) => m.entity_id === 1));
});

test('a city that never legislated cannot convict anybody', () => {
  // **The most interesting thing here, and it falls out rather than
  // being designed in.** Until now no code anywhere read `laws` when
  // deciding anything, so a government could legislate into a void.
  const w = courtWorld({ lawCategory: null });
  const events = justice.runJustice(w, { tick: 10 });

  const [caseRow] = w.courtCases;
  assert.equal(caseRow.status, 'dismissed');
  assert.equal(caseRow.law_id, null);
  assert.equal(caseRow.sentence_ticks, null);
  assert.equal(w.npcs[0].status, 'active', 'somebody was imprisoned with no law to imprison them under');
  assert.equal(events.filter((e) => e.type === 'case_dismissed').length, 1);
});

test('the wrong kind of law does not cover it', () => {
  // A city with a trade statute and no property statute still lets a
  // thief walk. That is the whole content of `LAW_FOR_OFFENCE`.
  const w = courtWorld({ lawCategory: 'trade' });
  justice.runJustice(w, { tick: 10 });
  assert.equal(w.courtCases[0].status, 'dismissed');
});

test('a law with no jurisdiction applies everywhere', () => {
  // `laws.jurisdiction_city_id` is nullable and `politics.enactLaw` has
  // always allowed a null one. Nothing had ever read it either way.
  const w = courtWorld({ lawCategory: null });
  w.laws = [{ id: 200, category: 'property', jurisdiction_city_id: null, status: 'active' }];
  justice.runJustice(w, { tick: 10 });
  assert.equal(w.courtCases[0].status, 'convicted');
  assert.equal(w.courtCases[0].law_id, 200);
});

test('a repealed law convicts nobody', () => {
  const w = courtWorld();
  w.laws[0].status = 'repealed';
  justice.runJustice(w, { tick: 10 });
  assert.equal(w.courtCases[0].status, 'dismissed');
});

test('a sentence ends, and what they come out to is the point', () => {
  const w = courtWorld();
  justice.runJustice(w, { tick: 10 });
  assert.equal(w.npcs[0].status, 'imprisoned');

  const sentence = justice.SENTENCE_TICKS.theft;
  // Nothing happens a tick early.
  justice.runJustice(w, { tick: 10 + sentence - 1 });
  assert.equal(w.npcs[0].status, 'imprisoned');

  const events = justice.runJustice(w, { tick: 10 + sentence });
  assert.equal(w.npcs[0].status, 'active');
  assert.equal(w.courtCases[0].released_tick, 10 + sentence);
  assert.equal(events.filter((e) => e.type === 'release').length, 1);

  // **And their routine comes back different.** `seedRoutine` gives a
  // `work` schedule only to somebody with an active employment record,
  // and theirs ended at conviction — so a released person has rest and
  // eat and no work until the economy hires them again. The consequence
  // does its own arithmetic; no penalty is applied on top.
  const types = w.scheduleEvents.map((e) => e.event_type);
  assert.ok(types.includes('rest') && types.includes('eat'));
  assert.equal(types.includes('work'), false,
    'a released prisoner walked back into the job the conviction ended');
  assert.ok(w.historicalRecords.some((r) => r.event_type === 'release'));
});

test('one incident, one case, however many ticks run', () => {
  // **Standing rule 7.** A pass over the whole history every tick would
  // re-charge everybody every tick forever.
  const w = courtWorld();
  for (let t = 10; t < 60; t += 1) justice.runJustice(w, { tick: t });
  assert.equal(w.courtCases.length, 1, `${w.courtCases.length} cases from one incident`);
});

test('nobody serves two sentences at once, and the dead are not tried', () => {
  const w = courtWorld();
  justice.runJustice(w, { tick: 10 });

  // A second cleared incident by the same person while inside.
  w.crimeIncidents.push({
    id: 2, category: 'theft', perpetrator_entity_id: 1, victim_entity_id: null,
    community_id: 5, tick: 11, severity: 30, investigated_tick: 11, cleared: true,
  });
  justice.runJustice(w, { tick: 11 });
  assert.equal(w.courtCases.length, 1,
    'somebody in a cell was charged again, so incarceration_rate counts them twice');

  // And a defendant who has left `npcs` entirely.
  const dead = courtWorld();
  dead.npcs = [];
  justice.runJustice(dead, { tick: 10 });
  assert.equal(dead.courtCases.length, 0);
});

test('an uncleared or unattributed incident is not a case', () => {
  const pending = courtWorld();
  pending.crimeIncidents[0].cleared = null;
  justice.runJustice(pending, { tick: 10 });
  assert.equal(pending.courtCases.length, 0, 'somebody was tried for a case nobody investigated');

  const failed = courtWorld();
  failed.crimeIncidents[0].cleared = false;
  justice.runJustice(failed, { tick: 10 });
  assert.equal(failed.courtCases.length, 0);

  const unknown = courtWorld();
  unknown.crimeIncidents[0].perpetrator_entity_id = null;
  justice.runJustice(unknown, { tick: 10 });
  assert.equal(unknown.courtCases.length, 0, 'somebody was convicted with no defendant');
});

// -- the readings ----------------------------------------------------------

test('unknown is not zero', () => {
  const w = courtWorld();
  assert.equal(justice.incarcerationRate(w, 999), null, 'an empty area reads as crime-free');
  assert.equal(justice.convictionRate(w, 5), null,
    'an area that has brought no cases reads as convicting nobody, which is a different fact');
  assert.equal(justice.unlegislatedShare(w, 5), null);
  assert.equal(justice.describeCase(w, 9999), null);
});

test('the three statistics answer, and they are in the crime block', () => {
  const w = courtWorld();
  justice.runJustice(w, { tick: 10 });
  assert.equal(justice.incarcerationRate(w, 5), 1);
  assert.equal(justice.convictionRate(w, 5), 1);
  assert.equal(justice.unlegislatedShare(w, 5), 0);

  for (const key of ['incarceration_rate', 'conviction_rate', 'unlegislated_crime_share']) {
    const definition = statistics.CATALOGUE.find((s) => s.key === key);
    assert.ok(definition, `${key} is not in the catalogue`);
    assert.equal(definition.category, 'crime');
    assert.equal(definition.unit, 'share');
  }
});

// -- being inside changes what other systems model -------------------------

test('a prisoner is not counted where a prisoner should not be', () => {
  // **The riskiest choice in this system, so it is held here.** The
  // dead are MOVED out of `worldState.npcs` precisely so that seventeen
  // call sites cannot forget to check a flag. A prisoner stays, because
  // being inside is temporary and partial — they still age, their
  // traits still drift, they still own things and still belong to a
  // family. So each system has to say for itself, and this is the list.
  const SERVER = path.join(__dirname, '..', 'server');
  const MUST_CHECK = {
    'births.js': 'somebody in a cell conceived a child',
    'households.js': 'somebody in a cell was counted as living in the house',
    'competition.js': 'somebody in a cell entered the community game',
  };
  for (const [file, why] of Object.entries(MUST_CHECK)) {
    const source = fs.readFileSync(path.join(SERVER, file), 'utf8');
    assert.match(source, /imprisoned/, `${file} does not check the status — ${why}`);
  }
});

test('a household is smaller while somebody is away, and whole again after', () => {
  const households = require('../server/households.js');
  const w = {
    npcs: [
      { id: 1, communityId: 5, status: 'active', home_property_id: 77 },
      { id: 2, communityId: 5, status: 'active', home_property_id: 77 },
    ],
    properties: [{ id: 77 }], households: [], communities: [{ id: 5, city_id: 9 }],
  };
  assert.equal(households.occupancyNow(w).get(77).length, 2);
  w.npcs[0].status = 'imprisoned';
  assert.equal(households.occupancyNow(w).get(77).length, 1);
  w.npcs[0].status = 'active';
  assert.equal(households.occupancyNow(w).get(77).length, 2,
    'the household did not recover when they came home');
  void behavior;
});

// -- the real pipeline -----------------------------------------------------

test('the tick runs it, in the Security phase, after policing', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'tick.js'), 'utf8');
  const policingAt = source.indexOf('policing.runPolicing');
  const justiceAt = source.indexOf('justice.runJustice');
  assert.ok(justiceAt > 0, 'the tick never calls justice, so no world has ever held a trial');
  assert.ok(justiceAt > policingAt,
    'justice runs before policing, so it charges people for crimes nobody investigated yet');
});

test('a generated world reaches it, and reaching it is RARE', () => {
  // **Measured, and the number is the point.** Crime in this engine is
  // deliberately uncommon: `BASE_DEPRIVATION_RISK` is 0.0006 per tick
  // at full deprivation, which is one offence per fully-deprived person
  // per four and a half years, and it is flagged interpretive with that
  // reasoning attached. A 47-person world over 400 ticks produces
  // around two incidents, of which policing clears a fraction.
  //
  // So this asserts the pipeline is CONNECTED — every cleared incident
  // with a living perpetrator becomes a case — rather than asserting a
  // conviction count a small world cannot reliably produce. Tuning the
  // crime rate upward so a fixture could watch a trial would be
  // inflating a constant to make a new system look consequential.
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 2, populationPerCommunity: 12, seed: 'law',
  });
  for (let t = 0; t < 200; t += 1) engine.advanceTick();

  assert.ok(Array.isArray(w.courtCases), 'WorldState carries no courtCases array');

  const chargeable = w.crimeIncidents.filter(
    (i) => i.cleared === true && i.perpetrator_entity_id !== null,
  );
  const charged = new Set(w.courtCases.map((c) => c.incident_id));
  const missed = chargeable.filter((i) => !charged.has(i.id));
  assert.deepEqual(missed.map((i) => i.id), [],
    'a cleared incident with a named perpetrator produced no case — the cascade is broken '
    + 'between policing and justice');

  // Whatever cases there are, they are well formed.
  for (const caseRow of w.courtCases) {
    assert.ok(justice.CASE_STATUSES.includes(caseRow.status));
    assert.ok(Object.keys(crime.CATEGORIES).includes(caseRow.category));
    if (caseRow.status === 'convicted') {
      assert.ok(caseRow.law_id !== null, 'convicted under no law');
      assert.ok(caseRow.sentence_ticks > 0);
    } else {
      assert.equal(caseRow.law_id, null, 'dismissed despite a law covering it');
    }
  }

  // And conflict is no longer stuck at zero, which is the half of this
  // that a small world CAN demonstrate.
  const moved = w.relationships.filter((r) => Number(r.conflict) > 0);
  assert.ok(moved.length > 0,
    'every relationship in the world is still at conflict 0, so violent and domestic crime '
    + 'remain unreachable');
});

// -- the player is not exempt ----------------------------------------------

test('a player serving a sentence cannot act, and can see why', () => {
  // **Without this the one person in the world with a keyboard would
  // be the only one for whom being convicted changed nothing** — every
  // NPC loses their job, their routine and their place in the house,
  // while the player accepts missions from a cell.
  const actions = require('../server/actions.js');
  const players = require('../server/players.js');

  const w = courtWorld();
  w.players = [{ id: 1, mode: 'citizen', linked_entity_id: 1 }];
  w.families = []; w.familyMemberships = []; w.individualFinances = [];
  w.ownershipRecords = []; w.migrationRisk = [];
  justice.runJustice(w, { tick: 10 });

  const verbs = {
    acceptMission: () => ({}), resolveMission: () => ({}),
    addScheduleEvent: () => ({}), reinforceHabit: () => ({}), resolveContest: () => ({}),
  };
  assert.throws(
    () => actions.dispatchAction(w, 1, { action: 'accept-mission', missionId: 7 }, verbs),
    /serving a sentence/,
    'an imprisoned player accepted a mission',
  );

  // And the refusal says when they get out, because that is the
  // question it will be asked.
  assert.throws(
    () => actions.dispatchAction(w, 1, { action: 'accept-mission', missionId: 7 }, verbs),
    new RegExp(`until tick ${10 + justice.SENTENCE_TICKS.theft}`),
  );
  void players;
});

test('the dashboard says they are inside, and for how long', () => {
  // A dashboard showing a citizen's mood, habits and routine while
  // silently omitting that they are in prison would be withholding the
  // one fact they most need.
  const w = courtWorld();
  const serving = justice.servingCase(w, 1);
  assert.equal(serving, null, 'somebody is serving a sentence before any case was brought');

  justice.runJustice(w, { tick: 10 });
  const after = justice.servingCase(w, 1);
  assert.ok(after);
  assert.equal(after.category, 'theft');
  assert.equal(
    Number(after.charged_tick) + Number(after.sentence_ticks),
    10 + justice.SENTENCE_TICKS.theft,
  );

  // Released, and no longer serving.
  justice.runJustice(w, { tick: 10 + justice.SENTENCE_TICKS.theft });
  assert.equal(justice.servingCase(w, 1), null);
});

test('every founded city can prosecute violence and theft from the start', () => {
  // **Measured, and the measurement is the argument.** A 600-tick world
  // with 240 people produced 26 offences, 7 cleared, and 7 cases — all
  // 7 dismissed, because neither city had ever legislated against
  // theft. Every thief walked and nobody was ever imprisoned.
  //
  // Two categories drawn at random from nine was fine while `laws` was
  // a table nothing read. It stopped being fine when
  // `justice.lawCovering` started reading it: a government that has not
  // outlawed theft or violence is not governing. Everything beyond
  // those two is policy and arrives over the following years through
  // `politics.runLegislation`.
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 3, communitiesPerCity: 1, populationPerCommunity: 6, seed: 'codes',
  });

  const byCity = new Map();
  for (const law of w.laws) {
    const list = byCity.get(law.jurisdiction_city_id) ?? [];
    list.push(law.category);
    byCity.set(law.jurisdiction_city_id, list);
  }
  assert.ok(byCity.size > 0, 'a generated world founded no laws at all');

  for (const [cityId, categories] of byCity) {
    // A duplicate is not a second statute — `lawCovering` takes the
    // first active match, so the second row changes nothing.
    assert.equal(new Set(categories).size, categories.length,
      `city ${cityId} enacted ${categories.join(', ')} twice`);

    for (const founding of ['criminal', 'property']) {
      assert.ok(categories.includes(founding),
        `city ${cityId} has no ${founding} law, so every offence it covers is dismissed`);
    }
  }

  // And the cascade can therefore reach a conviction, which is the
  // point of the whole change.
  const city = [...byCity.keys()][0];
  const community = w.communities.find((c) => c.city_id === city);
  assert.ok(justice.lawCovering(w, 'theft', city), 'a thief still cannot be charged');
  assert.ok(justice.lawCovering(w, 'violent', city));
  void community;
});

// -- a legal code that grows -----------------------------------------------

test('a government legislates over time, and never the same category twice', () => {
  // **Measured, and the measurement is why this exists.** A 600-tick
  // world with 240 people produced 26 offences, 7 cleared, **7 cases
  // and 7 dismissals** — neither city had ever legislated against
  // theft, so every thief walked and nobody was ever imprisoned.
  //
  // That is a true and interesting fact about a young settlement and a
  // bad permanent one. `politics.runLegislation` makes the statute book
  // grow, so `unlegislated_crime_share` measures how far a place has
  // rebuilt rather than what its two founding dice rolled.
  const w = {
    tick: 0, seed: 'code',
    governments: [{ organization_id: 1, system_type: 'council' }],
    organizations: [{ id: 1, type: 'government', status: 'active' }],
    cities: [{ id: 5 }],
    laws: [{ id: 1, category: 'family', jurisdiction_city_id: 5, status: 'active' }],
    npcs: [], entityKnowledge: [], events: [],
  };

  // A crossing, not a condition — standing rule 7. Nothing happens on
  // an ordinary tick.
  assert.equal(politics.runLegislation(w, 7).length, 0);
  assert.equal(w.laws.length, 1);

  const interval = politics.LEGISLATION_INTERVAL_TICKS;
  for (let t = interval; t <= interval * 8; t += interval) {
    w.tick = t;
    politics.runLegislation(w, t);
  }
  assert.ok(w.laws.length > 1, 'the statute book never grew');

  const categories = w.laws.map((l) => l.category);
  assert.equal(new Set(categories).size, categories.length,
    `the same category was enacted twice (${categories.join(', ')}) — justice.lawCovering `
    + 'takes the first active match, so a duplicate changes nothing at all');

  // And it stops when there is nothing left to legislate, rather than
  // emitting an event every interval forever.
  assert.deepEqual(politics.unlegislatedCategories(w, 5), [],
    'eight intervals did not exhaust nine categories');
  w.tick = interval * 9;
  assert.equal(politics.runLegislation(w, interval * 9).length, 0);
});

test('a law with no jurisdiction counts as held everywhere', () => {
  const w = {
    laws: [{ id: 1, category: 'criminal', jurisdiction_city_id: null, status: 'active' }],
  };
  assert.equal(politics.unlegislatedCategories(w, 5).includes('criminal'), false,
    'a national statute was re-enacted city by city');
});
