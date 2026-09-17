// server/justice.js
//
// What happens after somebody is caught.
//
// **The boundary this crosses was written down before it was crossed.**
// `server/urbanSystems.js` on system 13, Law Enforcement, marked
// `partial`:
//
//   "Still partial, and the boundary is deliberate: clearance is NOT
//    arrest. §7 Prison is absent and `imprisoned` was not added as an
//    entity status, so raids, arrests and sentencing would need
//    somewhere to put people first."
//
// And on system 17, Court, also `partial`:
//
//   "Laws are enacted, repealed and queried by jurisdiction. **No
//    courts, cases or judgements** — nothing applies a law to anybody,
//    so this is legislation without adjudication. `runSecurityPhase`
//    does not read `laws`."
//
// And on system 18, Prison, `absent`:
//
//   "§17 lists `imprisoned` as an NPC status. Searched: the string
//    appears nowhere in the schema or under server/. Nothing
//    incarcerates anybody."
//
// Three notes, one gap. A settlement could generate a crime, name the
// person who did it, investigate it, clear it, and then nothing at all
// happened to them — and separately, a government could legislate into
// a void, because no code anywhere read `laws` when deciding anything.
// This is the link between the two.
//
// ---------------------------------------------------------------------
// The chain, and what each link reads
//
//   arrest      `policing.js` sets `cleared` on an incident whose
//               `perpetrator_entity_id` the engine already knows. A
//               cleared incident with a living, free perpetrator is an
//               arrest. Nothing new is decided here — clearance is the
//               decision, and this is the consequence it never had.
//
//   charge      A charge cites a LAW: an active row in `laws` whose
//               category covers the offence, in the jurisdiction the
//               offence happened in. `politics.enactLaw` has been
//               writing those rows since elections were built and
//               nothing read them.
//
//   judgement   Convicted where a law covers it, dismissed where none
//               does. **See the long note on `judge` for why there is
//               no doubt in this model and why inventing some would be
//               worse than leaving it out.**
//
//   sentence    Length by offence category, in ticks. A tick is a day.
//
//   prison      `npcs.status = 'imprisoned'` — the spec's own §17
//               value. `server/schema-extensions.sql` has carried a
//               note since it was written saying that value "stays
//               absent, which is why §7's Prison system is still marked
//               `absent`". It is not absent any more.
//
//   release     The sentence runs out and the person comes back. What
//               they come back to is the point of the whole system:
//               their job is gone, their household ran without them,
//               and the record is in `historical_records` forever.
//
// ---------------------------------------------------------------------
// And the state's rule is a scale, not a map
//
// **This file shipped with law as a city-wide absolute** — if the city
// had a property statute, every thief in every block was charged, tried
// and convicted. That is wrong for this setting, and the owner said so:
// government and law are a scale of trust, lawlessness occurs in
// certain areas, groups and small groups keep their own law, and some
// cities maintain government rule without it being a guarantee after
// the reset.
//
// `server/authority.js` computes how far the state's rule reaches in
// each area, from four measured readings. This file asks it before
// bringing a case:
//
//   governed    charged, tried, sentenced — as before.
//   contested   the state answers what it cannot ignore. Violence,
//               guns, domestic incidents and sex offences are charged;
//               theft, property and drug offences are let go.
//   lawless     the state brings no case at all.
//
// And where the state does not answer an offence, **whoever holds the
// ground might**. See `answerByGroup`.
//
// ---------------------------------------------------------------------
// A settlement that never legislated cannot convict anybody
//
// This falls out rather than being designed in, and it is the most
// interesting thing here. `worldgen.js` enacts laws from a list; a city
// that has no active law of the matching category dismisses every case
// in that category, and the offender walks. So `unlegislated_crime_share`
// is a real reading of a real difference between two settlements, and
// `laws` stops being a table that exists to be counted.
//
// ---------------------------------------------------------------------
// What this does NOT model, stated rather than implied
//
// **Prison capacity.** `infrastructure.INFRASTRUCTURE_TYPES` is a fixed
// ten and none of them is a prison, so nothing here can overflow, queue
// or release early for want of a cell. The handoff package names a
// document — `PRISON_POPULATION_CENTERS_BREAKS_SCHOOLS.md`, listed in
// `VACANCY_MASTER_SESSION_INDEX.md` §4 — that is not in this repository,
// so the numbers that would make capacity real are not available to
// read. Adding an eleventh infrastructure type on a guess would put an
// invented capacity underneath every incarceration statistic.
//
// **Wrongful conviction, plea bargaining, appeal, bail, probation,
// parole.** All of them need an evidence model, and this engine records
// ground truth: `crime_incidents.perpetrator_entity_id` is who did it,
// not who somebody believes did it. See `judge`.

'use strict';

const worldStore = require('./worldStore.js');
const politics = require('./politics.js');
const behavior = require('./behavior.js');
const economy = require('./economy.js');
const authority = require('./authority.js');
const membership = require('./membership.js');
const inventory = require('./inventory.js');

// ---------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------

//: The statuses a case passes through. `dismissed` and `convicted` are
//: terminal; `charged` exists for the tick a case is opened on, so a
//: case is never observed in no state at all.
const CASE_STATUSES = ['charged', 'convicted', 'dismissed'];

//: Which law category covers which offence. **Both vocabularies are the
//: engine's own** — the left side is `crime.CATEGORIES` (§9's seven)
//: and the right is `politics.LAW_CATEGORIES` — so this is a mapping
//: between two existing lists rather than a third list invented here.
//: `assertVocabulariesLineUp` checks both sides at require time, so a
//: rename on either fails loudly instead of quietly dismissing every
//: case of one category forever.
//:
//: Flagged interpretive in exactly one respect: which of the nine law
//: categories covers which offence is a reading, not a citation. Theft
//: and fraud go to `property` and `financial` because that is what they
//: are about; the rest are `criminal`.
const LAW_FOR_OFFENCE = {
  violent: 'criminal',
  gun: 'criminal',
  domestic: 'criminal',
  drug: 'criminal',
  sex_offense: 'criminal',
  theft: 'property',
  fraud: 'financial',
  property: 'property',
};

//: How long a sentence runs, in ticks. A tick is a day
//: (`behavior.TICK_INTERVALS`), so these are 60 days to four years.
//:
//: **Flagged interpretive, and the document that would settle it is not
//: in this repository.** `VACANCY_MASTER_SESSION_INDEX.md` §4 names
//: `PRISON_POPULATION_CENTERS_BREAKS_SCHOOLS.md`; it is one of the
//: received-but-not-stored documents, so there is nothing to cite. What
//: these are chosen FOR is stated instead: they are ordered by the
//: severity the engine already assigns each category, and they are on
//: the scale a sentence actually is — months for property offences,
//: years for violence.
//:
//: **Which means most test worlds are too short to see a violent
//: offender released, and that is a fact about run length rather than a
//: flaw to tune away.** A 200-tick world releases thieves (120) and
//: property offenders (90) and nobody else. The regression that matters
//: — that a sentence ENDS — is held on those two rather than by
//: shortening a murder to six weeks so a fixture can watch it finish.
const SENTENCE_TICKS = {
  violent: 1095,
  sex_offense: 1095,
  gun: 730,
  domestic: 365,
  drug: 180,
  fraud: 180,
  theft: 120,
  property: 90,
};

//: Serving time is not a life sentence for the household either. A
//: person's home is kept — `home_property_id` is not cleared — because
//: coming out to nowhere to live is a different claim from coming out
//: to a job that was filled. `households.js` counts who is actually
//: there, which is the computed reading, so an imprisoned person is
//: simply not counted as an occupant while they are away.

let nextCaseId = 1;

function reseedIds(worldState) {
  const highest = (worldState.courtCases || []).reduce(
    (max, row) => Math.max(max, Number(row.id) || 0), 0,
  );
  nextCaseId = highest + 1;
  return { nextCaseId };
}

// ---------------------------------------------------------------------
// Reading the state of a person
// ---------------------------------------------------------------------

function isImprisoned(npc) {
  return npc?.status === 'imprisoned';
}

// Everybody currently inside, as ids. Built once for a pass rather than
// asked per person — the same lesson `traitDrift.indexRows` cost.
function imprisonedIds(worldState) {
  return new Set((worldState.npcs || []).filter(isImprisoned).map((n) => n.id));
}

function casesFor(worldState, entityId) {
  return (worldState.courtCases || []).filter((c) => c.defendant_entity_id === entityId);
}

// The sentence somebody is currently serving, or null.
function servingCase(worldState, entityId) {
  return casesFor(worldState, entityId).find(
    (c) => c.status === 'convicted' && c.released_tick === null,
  ) ?? null;
}

// ---------------------------------------------------------------------
// The links
// ---------------------------------------------------------------------

// Which active law covers this offence here, or null.
//
// Jurisdiction is the city. `laws.jurisdiction_city_id` is nullable and
// a null one applies everywhere, which is what a national statute is —
// `politics.enactLaw` has always allowed it and nothing ever read it.
function lawCovering(worldState, category, cityId) {
  const lawCategory = LAW_FOR_OFFENCE[category];
  if (!lawCategory) return null;
  return (worldState.laws || []).find(
    (law) => law.status === 'active'
      && law.category === lawCategory
      && (law.jurisdiction_city_id === null
        || law.jurisdiction_city_id === undefined
        || law.jurisdiction_city_id === cityId),
  ) ?? null;
}

// Open a case against the person a cleared incident names.
//
// **`judge` decides guilt on whether a law exists, and nothing else,
// and that is a deliberate limit rather than an oversight.** This engine
// records ground truth: `crime_incidents.perpetrator_entity_id` is who
// did it, written by `crime.js` at the moment it happened. There is no
// evidence, no testimony, no chain of custody and no witness reliability
// anywhere in the schema, so a model of doubt would have nothing to draw
// a verdict from except a coin. A coin dressed as a trial is worse than
// no trial, because it produces an acquittal rate somebody will read as
// meaning something.
//
// So what a court does here is the half this engine CAN answer: whether
// the thing that happened is against the law where it happened. That is
// a real question with a real answer in real data, and it is the
// question `laws` was sitting there unread waiting to be asked.
function judge(worldState, options = {}) {
  const { incident, tick = worldState.tick ?? 0 } = options;

  const defendantId = incident.perpetrator_entity_id;
  const defendant = (worldState.npcs || []).find((n) => n.id === defendantId) ?? null;
  // A dead or already-imprisoned defendant is not tried. The first is
  // not a judgement about the dead, it is that `mortality` has moved
  // them out of `npcs` and there is nobody to sentence; the second
  // keeps one person from serving two sentences at once, which would
  // make `incarceration_rate` count them twice.
  if (!defendant || isImprisoned(defendant)) return null;

  const community = (worldState.communities || []).find(
    (c) => c.id === incident.community_id,
  ) ?? null;
  const cityId = community?.city_id ?? null;
  const law = lawCovering(worldState, incident.category, cityId);

  const row = {
    id: nextCaseId++,
    incident_id: incident.id,
    defendant_entity_id: defendantId,
    community_id: incident.community_id,
    city_id: cityId,
    category: incident.category,
    // The law it was brought under, or null where the city legislated
    // none — which is the whole of the dismissal.
    law_id: law?.id ?? null,
    status: law ? 'convicted' : 'dismissed',
    charged_tick: tick,
    sentence_ticks: law ? (SENTENCE_TICKS[incident.category] ?? null) : null,
    released_tick: null,
  };
  (worldState.courtCases || (worldState.courtCases = [])).push(row);
  return row;
}

// Put somebody inside, and take away what being inside takes away.
//
// **The consequences are the system.** A status field nothing reads is
// the eleventh standing rule wearing a prison uniform, so each of these
// is a real write to a real store that a real system already consults.
function imprison(worldState, caseRow, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const npc = (worldState.npcs || []).find((n) => n.id === caseRow.defendant_entity_id);
  if (!npc) return null;

  npc.status = 'imprisoned';

  // 1. The job is gone. `economy.js` reads `status === 'active'` to
  //    decide who is employed, and `motivation.SATISFIERS.income` reads
  //    that set — so this is what makes coming out hard rather than a
  //    flavour note.
  //
  //    Through `endEmployment` rather than by hand: that function's own
  //    comment records that an earlier version set an `end_tick` the
  //    schema has no column for, and writing the row here would
  //    reintroduce exactly that.
  if (economy.getEmployment(worldState, npc.id)) {
    economy.endEmployment(worldState, { entityId: npc.id });
  }

  // 2. The routine stops. `runBehavior` would otherwise have somebody
  //    commuting from a cell to a job they no longer hold.
  //
  //    **Schedules only — NOT `behavior.releaseDeceased`.** That
  //    function drops the person's habits and their `entity_state` row
  //    as well, which is right for a death and wrong for a sentence: it
  //    would erase who somebody was and hand back a stranger. Leaving
  //    the habits in place is also what makes the sentence cost
  //    something on its own terms, with no penalty invented for it —
  //    habit strength decays proportionally every tick, so a person
  //    serving 120 days comes out with routines at about half the
  //    strength they went in with.
  worldState.scheduleEvents = (worldState.scheduleEvents || [])
    .filter((e) => e.entity_id !== npc.id);

  // 3. The record, which outlives the sentence. `historical_records` is
  //    where this engine keeps what happened to somebody, and it is
  //    what `succession` and `demographics` read rather than a column
  //    on the person.
  worldStore.addHistoricalRecord(worldState, {
    event_type: 'conviction',
    description: `convicted of ${caseRow.category} under law ${caseRow.law_id}`,
    when_tick: tick,
    participants: [npc.id],
    where_location_id: null,
  });

  // 4. And they remember it.
  worldStore.addMemory(worldState, {
    entityId: npc.id,
    memoryType: 'experience',
    category: 'personal',
    description: `sentenced for ${caseRow.category}`,
    importance: 85,
    emotionLevel: 15,
    relatedEntityIds: [],
    tick,
  });

  return npc;
}

// Let somebody out. Returns the case, or null if there was nothing to
// release them from.
function release(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  const caseRow = servingCase(worldState, entityId);
  if (!npc || !caseRow) return null;

  npc.status = 'active';
  caseRow.released_tick = tick;

  // **Their routine is re-seeded, and it comes back different.**
  // `seedRoutine` gives a `work` schedule only to somebody with an
  // active employment record, and theirs ended at conviction — so
  // somebody released has rest and eat and no work until the economy
  // hires them again. That is the consequence doing its own arithmetic
  // rather than a penalty applied on top.
  behavior.seedRoutine(worldState, entityId, { tick });

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'release',
    description: `released after ${caseRow.sentence_ticks} ticks for ${caseRow.category}`,
    when_tick: tick,
    participants: [entityId],
    where_location_id: null,
  });

  return caseRow;
}

// ---------------------------------------------------------------------
// Group law — what answers an offence where the state does not
// ---------------------------------------------------------------------
//
// **Small-group law, and it is deliberately not a second court.** A
// faction holding a block does not hold trials, keep a statute book or
// run a prison. What it has are the three levers this engine already
// gives an organization over a person, and each one is a real write to
// a real store:
//
//   restitution   the offender hands the victim something out of their
//                 own holdings. `inventory.transfer` — the same verb a
//                 theft already uses, pointed the other way.
//   expulsion     if the offender belongs to the faction, they stop
//                 belonging. `membership.leaveOrganization`.
//   feud          if they do not, the victim and the offender are now
//                 enemies, and `crime.advanceFriction` will carry it
//                 from there.
//
// **A faction answers what touches it, and ignores what does not.** An
// offence with no victim — a property offence against nobody — has
// nothing to put right, so nothing happens, and that IS the answer in a
// place with no state: some things simply go unanswered. Reporting that
// as a null rather than as an event is the point.
const GROUP_FEUD_GAIN = 12;

function answerByGroup(worldState, options = {}) {
  const {
    incident, holderId, communityId, tick = worldState.tick ?? 0,
  } = options;
  if (!holderId) return null;

  const offenderId = incident.perpetrator_entity_id;
  const victimId = incident.victim_entity_id ?? null;
  const acts = [];

  // **Everybody here has to still be alive, and the same argument
  // `judge` already makes applies one function over.** `judge` refuses
  // a dead defendant because "`mortality` has moved them out of `npcs`
  // and there is nobody to sentence". Group law had no such check, and
  // it is worse there than in a court, because the state's answer is a
  // row in a table and a faction's answer is a `transfer`, a
  // `leaveOrganization` and a relationship write — three reaches into
  // the living world.
  //
  // **This crashed the tick**, and it took a 400-tick playtest to see:
  // `inventory.transfer` asserts its RECIPIENT is among the living, so
  // the first offence whose victim died before a lawless area got round
  // to answering it threw out of `runJustice`, out of
  // `runSecurityPhase` and out of `advanceTick`. Not a wrong number —
  // the world stopped. The suite could not see it because the gap
  // between an incident and its answer has to be long enough for
  // somebody to die in, and because it only happens where the state
  // does NOT prosecute. `succession.js`'s own header records the same
  // shape of bug found the same way, on a 300-tick run.
  const living = (id) => id !== null && (worldState.npcs || []).some((n) => n.id === id);

  // A dead offender has nothing to answer with and nobody to expel.
  if (!living(offenderId)) return null;
  // A dead victim cannot be made whole and cannot hold a grudge. The
  // faction still expels its own, so this narrows the answer rather
  // than cancelling it — and an offence that goes unanswered because
  // the person it was done to is gone is exactly what this file's
  // header means by "some things simply go unanswered".
  const victimLives = living(victimId);

  // Restitution, where there is somebody to make it to and something
  // to make it with.
  if (victimLives) {
    const holdings = inventory.holdingsOf(worldState, offenderId).filter((h) => !h.equipped);
    if (holdings.length > 0) {
      inventory.transfer(worldState, {
        fromId: offenderId, toId: victimId, itemName: holdings[0].item_name,
        quantity: 1, tick,
      });
      acts.push('restitution');
    }
  }

  // Expulsion, where they were one of the holder's own.
  const belongs = (worldState.entityOrganizationMemberships || []).some(
    (m) => m.entity_id === offenderId && m.organization_id === holderId && m.status !== 'left',
  );
  if (belongs) {
    membership.leaveOrganization(worldState, offenderId, holderId);
    acts.push('expulsion');
  }

  // Feud, where there is somebody to feud with.
  if (victimLives && victimId !== offenderId) {
    const existing = worldStore.findRelationship(worldState, victimId, offenderId);
    const now = Number(existing?.conflict) || 0;
    worldStore.adjustRelationship(worldState, victimId, offenderId, 'social', {
      conflict: Math.max(0, Math.min(GROUP_FEUD_GAIN, 100 - now)),
    });
    acts.push('feud');
  }

  if (acts.length === 0) return null;

  worldStore.addMemory(worldState, {
    entityId: offenderId,
    memoryType: 'experience',
    category: 'social',
    description: `answered to organization ${holderId} for ${incident.category}`,
    importance: 60,
    emotionLevel: 20,
    relatedEntityIds: victimId === null ? [] : [victimId],
    tick,
  });

  return {
    incidentId: incident.id, communityId, holderId, acts, tick,
  };
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// One tick of justice. Runs inside the Security phase, after policing:
// clearance is the input, and a case cannot be opened on an incident
// nobody has investigated yet.
function runJustice(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const events = [];

  // **Only incidents cleared this tick.** A pass over the whole history
  // every tick would re-charge everybody every tick forever, which is
  // the seventh standing rule's failure — and would also be quadratic
  // in the length of the run.
  const charged = new Set([
    ...(worldState.courtCases || []).map((c) => c.incident_id),
    // An offence the state declined, or a group answered, is dealt
    // with — reconsidering it every tick forever is the seventh
    // standing rule's failure with a different verb.
    ...(worldState.groupSanctions || []).map((g) => g.incident_id),
  ]);

  // One reading per area for the whole pass rather than per incident.
  const writ = authority.writByCommunity(worldState);

  for (const incident of worldState.crimeIncidents || []) {
    if (incident.cleared !== true) continue;
    if (incident.perpetrator_entity_id === null
        || incident.perpetrator_entity_id === undefined) continue;
    if (charged.has(incident.id)) continue;

    // **Does the state's rule reach here at all?** See the header: a
    // governed area charges everything, a contested one charges what it
    // cannot ignore, a lawless one charges nothing.
    const reading = writ.get(incident.community_id) ?? null;
    const decision = authority.prosecutes(worldState, incident.community_id, incident.category,
      reading === null ? {} : { reading });

    if (!decision.prosecutes) {
      charged.add(incident.id);
      // Whoever holds the ground might answer it instead.
      const holderId = authority.holderOf(worldState, incident.community_id);
      const answered = answerByGroup(worldState, {
        incident, holderId, communityId: incident.community_id, tick,
      });
      (worldState.groupSanctions || (worldState.groupSanctions = [])).push({
        incident_id: incident.id,
        community_id: incident.community_id,
        category: incident.category,
        regime: decision.regime,
        holder_organization_id: answered ? holderId : null,
        acts: answered ? answered.acts : [],
        tick,
      });
      events.push({
        type: answered ? 'group_sanction' : 'unanswered_offence',
        severity: 'low',
        note: answered
          ? `${incident.category} answered by organization ${holderId}: ${answered.acts.join(', ')}`
          : `${incident.category} went unanswered — ${decision.reason}`,
        tick,
        affected_entity_ids: [incident.perpetrator_entity_id],
        global_effects: {
          incidentId: incident.id,
          communityId: incident.community_id,
          category: incident.category,
          regime: decision.regime,
          holderId: answered ? holderId : null,
          reason: decision.reason,
        },
      });
      continue;
    }

    const caseRow = judge(worldState, { incident, tick });
    if (!caseRow) continue;
    charged.add(incident.id);

    if (caseRow.status === 'convicted') {
      imprison(worldState, caseRow, { tick });
      events.push({
        type: 'conviction',
        severity: 'medium',
        note: `${caseRow.defendant_entity_id} convicted of ${caseRow.category} `
          + `(${caseRow.sentence_ticks} ticks)`,
        tick,
        affected_entity_ids: [caseRow.defendant_entity_id],
        global_effects: {
          caseId: caseRow.id,
          category: caseRow.category,
          lawId: caseRow.law_id,
          sentenceTicks: caseRow.sentence_ticks,
          communityId: caseRow.community_id,
        },
      });
    } else {
      events.push({
        type: 'case_dismissed',
        severity: 'low',
        note: `${caseRow.defendant_entity_id} walked: no active `
          + `${LAW_FOR_OFFENCE[caseRow.category] ?? 'applicable'} law here`,
        tick,
        affected_entity_ids: [caseRow.defendant_entity_id],
        global_effects: {
          caseId: caseRow.id,
          category: caseRow.category,
          communityId: caseRow.community_id,
        },
      });
    }
  }

  // Sentences run out. **A crossing, not a condition** — the case is
  // stamped `released_tick` and never considered again.
  for (const caseRow of worldState.courtCases || []) {
    if (caseRow.status !== 'convicted' || caseRow.released_tick !== null) continue;
    if (tick - caseRow.charged_tick < (caseRow.sentence_ticks ?? Infinity)) continue;

    const released = release(worldState, caseRow.defendant_entity_id, { tick });
    if (!released) {
      // Nobody to release — they died inside, and `mortality` has
      // already moved them out of `npcs`. Close the case so this does
      // not retry every tick for the rest of the run.
      caseRow.released_tick = tick;
      continue;
    }
    events.push({
      type: 'release',
      severity: 'low',
      note: `${caseRow.defendant_entity_id} released after ${caseRow.sentence_ticks} ticks`,
      tick,
      affected_entity_ids: [caseRow.defendant_entity_id],
      global_effects: { caseId: caseRow.id, category: caseRow.category },
    });
  }

  return events;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function casesIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  return (worldState.courtCases || []).filter(
    (c) => c.community_id === communityId
      && (sinceTick === null || Number(c.charged_tick) >= sinceTick),
  );
}

// The share of an area's residents currently inside. Null for an area
// with nobody in it — unknown is not zero, and an empty block does not
// have a low incarceration rate, it has none.
function incarcerationRate(worldState, communityId) {
  const residents = (worldState.npcs || []).filter((n) => n.communityId === communityId);
  if (residents.length === 0) return null;
  return Math.round((residents.filter(isImprisoned).length / residents.length) * 10000) / 10000;
}

// Of the cases an area has brought, the share that ended in a
// conviction. Null where it has brought none — which is different from
// an area that tried and convicted nobody.
function convictionRate(worldState, communityId, options = {}) {
  const cases = casesIn(worldState, communityId, options);
  if (cases.length === 0) return null;
  const convicted = cases.filter((c) => c.status === 'convicted').length;
  return Math.round((convicted / cases.length) * 10000) / 10000;
}

// The share of cases that were dismissed because no law covered them.
//
// **This is the reading that makes `laws` load-bearing.** A settlement
// whose government never legislated against theft dismisses every theft
// case, and the number says so. It is the complement of the conviction
// rate in this model — every dismissal is an unlegislated one, because
// nothing else here dismisses a case — and it is reported separately
// anyway, so the day something else can dismiss a case the two stop
// agreeing and that is visible rather than silent.
function unlegislatedShare(worldState, communityId, options = {}) {
  const cases = casesIn(worldState, communityId, options);
  if (cases.length === 0) return null;
  const unlegislated = cases.filter((c) => c.status === 'dismissed' && c.law_id === null).length;
  return Math.round((unlegislated / cases.length) * 10000) / 10000;
}

// What answered offences here, and what did not. The regime reading for
// an area, beside the count of what the state let go.
function sanctionsIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  return (worldState.groupSanctions || []).filter(
    (g) => g.community_id === communityId
      && (sinceTick === null || Number(g.tick) >= sinceTick),
  );
}

// Of everything that reached a decision here, the share the state
// declined to prosecute. Null where nothing has.
function stateDeclinedShare(worldState, communityId, options = {}) {
  const cases = casesIn(worldState, communityId, options).length;
  const declined = sanctionsIn(worldState, communityId, options).length;
  if (cases + declined === 0) return null;
  return Math.round((declined / (cases + declined)) * 10000) / 10000;
}

// Of what the state declined, the share a group answered anyway. Null
// where it declined nothing — which is a different fact from a place
// where nobody stepped in.
function groupAnsweredShare(worldState, communityId, options = {}) {
  const declined = sanctionsIn(worldState, communityId, options);
  if (declined.length === 0) return null;
  const answered = declined.filter((g) => g.holder_organization_id !== null).length;
  return Math.round((answered / declined.length) * 10000) / 10000;
}

function describeCase(worldState, caseId) {
  const row = (worldState.courtCases || []).find((c) => c.id === caseId);
  if (!row) return null;
  const law = (worldState.laws || []).find((l) => l.id === row.law_id) ?? null;
  return {
    ...row,
    law: law ? { id: law.id, category: law.category, description: law.description } : null,
    serving: row.status === 'convicted' && row.released_tick === null,
  };
}

// ---------------------------------------------------------------------
// Both vocabularies are somebody else's, checked at require time
// ---------------------------------------------------------------------
// An offence with no entry here is dismissed for want of a law, which
// is indistinguishable from a city that never legislated — so a renamed
// crime category would quietly make every case of it walk, forever, and
// `unlegislated_crime_share` would report it as a fact about the
// government. The same guard `contest.js` and `competition.js` carry.
function assertVocabulariesLineUp() {
  // Required here rather than at the top: `crime.js` does not depend on
  // this file, and keeping the import local makes the check obviously
  // self-contained.
  const crime = require('./crime.js');

  const offences = Object.keys(crime.CATEGORIES);
  const missing = offences.filter((c) => !LAW_FOR_OFFENCE[c]);
  if (missing.length > 0) {
    throw new Error(
      `justice: ${missing.join(', ')} is a crime category with no law category — every case `
      + 'of it would be dismissed as unlegislated, which is a claim about a government',
    );
  }
  const invented = Object.keys(LAW_FOR_OFFENCE).filter((c) => !offences.includes(c));
  if (invented.length > 0) {
    throw new Error(`justice: ${invented.join(', ')} is not a crime category`);
  }
  const wrongLaws = Object.values(LAW_FOR_OFFENCE)
    .filter((c) => !politics.LAW_CATEGORIES.includes(c));
  if (wrongLaws.length > 0) {
    throw new Error(
      `justice: ${[...new Set(wrongLaws)].join(', ')} is not a law category `
      + `(one of: ${politics.LAW_CATEGORIES.join(', ')})`,
    );
  }
  const unsentenced = offences.filter((c) => !Number.isFinite(SENTENCE_TICKS[c]));
  if (unsentenced.length > 0) {
    throw new Error(
      `justice: ${unsentenced.join(', ')} has no sentence length, so a conviction for it `
      + 'would imprison somebody forever',
    );
  }
}

assertVocabulariesLineUp();

module.exports = {
  CASE_STATUSES,
  LAW_FOR_OFFENCE,
  SENTENCE_TICKS,
  reseedIds,
  isImprisoned,
  imprisonedIds,
  casesFor,
  servingCase,
  lawCovering,
  judge,
  imprison,
  release,
  runJustice,
  casesIn,
  GROUP_FEUD_GAIN,
  answerByGroup,
  sanctionsIn,
  stateDeclinedShare,
  groupAnsweredShare,
  incarcerationRate,
  convictionRate,
  unlegislatedShare,
  describeCase,
  assertVocabulariesLineUp,
};
