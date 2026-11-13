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
//
// ---------------------------------------------------------------------
// §7 Prison, closed one level further: WHERE, not how many cells
// ---------------------------------------------------------------------
// The capacity exclusion above still stands, unchanged — nothing here
// adds a number a cell can overflow. What was still missing is
// narrower and was never excluded on purpose: `imprison` changed a
// person's status and wrote `where_location_id: null` on their own
// conviction record, every time, because nothing connected a sentence
// to an actual place. `server/landmarks.js` has carried a real
// `prison` Key category since before this file existed — real
// significance band, `propertyType: 'government'`, staffed with a
// real `officer` at generation exactly like every other hero-tier
// building — and `world-layer/exportRegion.js`'s own `KEY_CATEGORIES`
// already lists it, so a real NRHP/Overture-imported prison already
// lands on a real `properties` row with `landmark_category ===
// 'prison'` wherever a region pack supplies one, with an invented one
// filling the gap exactly like every other Key category does when it
// doesn't. **That whole pipeline was already real and already
// running** — checked directly, not assumed, before writing a single
// line here — so the fix below is the one real wire it was missing: a
// sentenced person's own `city_id`, which `judge` already records on
// every case, is enough to find the real prison standing in that same
// city and point the conviction at it.
//
// `prisonFor` is deliberately deterministic (lowest `id` among a
// city's real prisons), never a seeded draw — a sentence is a single
// real event with a single real city already decided by `judge`, and
// a real city either has a real prison standing in it or it does not;
// there is nothing here for randomness to decide. A city with none
// keeps today's behaviour exactly: `where_location_id: null`, an
// honest absence rather than an invented building.
//
// `caseRow.prison_property_id` is new and, like `community.
// fertilityRates`/`city.healthBaseline` before it, in-memory only —
// `court_cases` is a real table `migrate.js`/`restore.js` already
// round-trip, and adding a column to it is real, separate schema work
// this round does not take on. A world rebuilt from Postgres loses
// the reference and falls back to the same `null` a world with no
// prison in that city already gets — not a silent loss, the same
// declared, known-limitation posture every other in-memory-only field
// in this registry already carries.

'use strict';

const worldStore = require('./worldStore.js');
const politics = require('./politics.js');
const behavior = require('./behavior.js');
const economy = require('./economy.js');
const authority = require('./authority.js');
const membership = require('./membership.js');
const inventory = require('./inventory.js');
const mortality = require('./mortality.js');
const characterCreation = require('./characterCreation.js');
const orgArchetypes = require('./orgArchetypes.js');
const prisonPacks = require('./prisonPacks.js');

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

// The real prison standing in a city, or null for an honest absence.
// Deterministic (lowest real `id`) rather than seeded — see the header
// note on why a draw has nothing to decide here.
//
// **`options.ageYears`, and what it closes.** Every real prison this
// engine designates is typed `'state-or-federal-prison'` — an adult
// facility, see `landmarks.js`'s own header on `facilityType` for why
// no juvenile-, women's- or jail-specific building exists to route to
// instead. A known minor (`ageYears < 18`, from `mortality.
// ageInYears` — the same function `control.ageOf`/`roleOf` already
// use for every other age-gated decision in this engine) is refused a
// placement in that adult building rather than silently imprisoned in
// it: this returns `null`, the identical honest-absence this function
// already returns for a city with no real prison at all, because
// "this city has no facility that may legally hold this person" is
// the same kind of fact as "this city has no prison standing in it."
// **What this deliberately does NOT do**: route a minor to a REAL
// juvenile facility, because none is generated — see
// `prisonPacks.js`'s header for why a believable facility-type split
// was not invented this round. `ageYears === null` (unknown) is not
// treated as a minor, the same `Number(null)` corollary this file's
// own registry already states elsewhere — an unobserved age places
// exactly as it always has.
function prisonFor(worldState, cityId, options = {}) {
  const { ageYears = null } = options;
  if (cityId === null || cityId === undefined) return null;
  const candidates = (worldState.properties || []).filter(
    (p) => p.landmark_category === 'prison' && p.city_id === cityId,
  );
  if (candidates.length === 0) return null;
  const chosen = candidates.reduce((lowest, p) => (p.id < lowest.id ? p : lowest));
  if (Number.isFinite(ageYears) && ageYears < 18 && chosen.facilityType !== 'juvenile-detention') {
    return null;
  }
  return chosen;
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

  // **Where, not just that.** A real prison in the same city the
  // offence and conviction already happened in — see the header note
  // above. `null` when this city has none, OR when this person is a
  // known minor and the one real prison this city has is not typed to
  // hold one — see `prisonFor`'s own header.
  const ageYears = mortality.ageInYears(worldState, npc, tick);
  const prison = prisonFor(worldState, caseRow.city_id, { ageYears });
  caseRow.prison_property_id = prison?.id ?? null;

  // **Gang politics, where there is now more than one person inside
  // to have politics with.** See `ensurePrisonGang`'s own header.
  if (prison) ensurePrisonGang(worldState, prison.id, tick);

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
    description: prison
      ? `convicted of ${caseRow.category} under law ${caseRow.law_id}, sent to ${prison.name}`
      : `convicted of ${caseRow.category} under law ${caseRow.law_id}`,
    when_tick: tick,
    participants: [npc.id],
    // **The FK `properties` was added for, one system over from
    // `landmarks.designate`'s own use of it.** A real prison in this
    // case's own city; `null` for a city with none, same as before
    // this change — never a placeholder building invented to fill it.
    where_location_id: prison?.id ?? null,
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
//
// **"After the reset, they head to their family."** Real, not
// invented: `characterCreation.describeFamilyTree` is the one real
// lookup this engine already has for a person's actual parents,
// siblings and cousins — never a second family system, and never a
// guess about who is related to whom. A release with nobody real to
// return to says so rather than inventing a reunion; this is a
// report on what the engine's own family data already holds, not a
// new mechanic that creates a bond on the way out the door.
//
// `options.reason` distinguishes a sentence that actually ran out
// (`'sentence-served'`, the default — everything before this round's
// own behaviour) from one cut short by `runPrisonBreaks` below
// (`'prison-break'`) — the same event, a release, with an honestly
// different cause recorded on it rather than one description standing
// in for two different real things.
function release(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0, reason = 'sentence-served' } = options;
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

  // Same real prison the conviction pointed at, if any — the release
  // is leaving the place the sentence actually named, not a second,
  // independently-decided location.
  const prison = (worldState.properties || []).find(
    (p) => p.id === caseRow.prison_property_id,
  ) ?? null;

  // **`describeFamilyTree` reports the dead too** — `entityBasics`
  // returns `alive: false` for a deceased parent or sibling rather
  // than omitting them, so a release that did not filter on it would
  // send somebody "home" to a parent `mortality.recordDeath` already
  // closed out. Filtered here, the same living-only discipline
  // `answerByGroup`'s own header already names for a different reach
  // into this exact family data.
  const family = characterCreation.describeFamilyTree(worldState, entityId);
  const livingFamily = [...family.parents, ...family.siblings].filter((f) => f?.alive === true);
  const familyClause = livingFamily.length > 0
    ? ` — heads for ${family.family?.surname ? `the ${family.family.surname} family` : 'family'} `
      + `(${livingFamily.length} real living member${livingFamily.length === 1 ? '' : 's'})`
    : ' — no living family this engine has any record of';

  const causeClause = reason === 'prison-break'
    ? `broke out of ${prison ? prison.name : 'custody'} after ${caseRow.sentence_ticks
    } ticks for ${caseRow.category}, sentence unserved`
    : prison
      ? `released from ${prison.name} after ${caseRow.sentence_ticks} ticks for ${caseRow.category}`
      : `released after ${caseRow.sentence_ticks} ticks for ${caseRow.category}`;

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'release',
    description: `${causeClause}${familyClause}`,
    when_tick: tick,
    participants: [entityId],
    where_location_id: prison?.id ?? null,
  });

  if (livingFamily.length > 0) {
    worldStore.addMemory(worldState, {
      entityId,
      memoryType: 'experience',
      category: 'family',
      description: reason === 'prison-break' ? 'broke out and went to find family' : 'released and went home to family',
      importance: 70,
      emotionLevel: 60,
      relatedEntityIds: livingFamily.map((f) => f.id).filter((id) => id !== undefined && id !== null),
      tick,
    });
  }

  // Prison-to-street pipeline (see that section's own header below):
  // if this release just freed a real prison-gang member, connect them
  // to its real street-side counterpart in the real community they are
  // actually in. A no-op, returning null, for anyone who was never a
  // member of one — defined after this function in the file, but a
  // function declaration, so the forward reference resolves at call
  // time rather than needing to be moved above `release` itself.
  joinStreetAffiliate(worldState, entityId, { tick });

  return caseRow;
}

// ---------------------------------------------------------------------
// Gang politics, inside one real prison
// ---------------------------------------------------------------------
//
// **Reuses `control.js`'s real takeover machinery and `orgArchetypes.
// js`'s real archetype system — this is not a second, prison-specific
// mechanism.** `'prison gang'` (orgArchetypes.js) is `type: 'gang'`,
// `isFaction: true`, the identical shape `militia`/`insurgent cell`
// already have, so `organizations.leader_id` is the real leader this
// engine already tracks for every other faction, and a real
// `territory_blocks` row can hold the prison's own COMMUNITY exactly
// the way one already holds any other neighbourhood — `control.js`
// and `authority.js` need no new code at all to let a prison gang
// contest, hold or lose ground once it exists.
//
// **Scoped to a real prison's COMMUNITY, never a "wing" or "cell
// block".** `justice.js`'s own earlier header on `prisonFor` already
// checked this directly: `territory_blocks.community_id` is the
// finest geography this schema has, and no interior-building
// subdivision exists anywhere in it. Inventing one here would be
// exactly the geography this file's own `prisonFor` note already
// declined to invent for a facility type the schema cannot support —
// so "taking over a prison" is the real prison's own community
// crossing into `authority.REGIMES`' `lawless` band, the SAME regime
// mechanic every other area of this engine already uses, not a
// parallel status invented for prisons alone. See `runPrisonBreaks`.
//
// **Membership is structural, not drawn.** A prison gang's members
// are, by construction, whoever this engine has actually imprisoned
// at that one real property right now — `inmatesOf` reads
// `courtCases`/`npcs` directly, never a separate roster. **Leadership
// is deterministic (lowest real id among current inmates), the same
// "nothing here for randomness to decide" reasoning `prisonFor`'s own
// header already gives** — nothing in this engine's substrate (no
// `npc.combat` reader that survives imprisonment, no prison-specific
// reputation score) is real enough to seed a contested draw from, and
// a draw dressed as one would be worse than an honest deterministic
// rule, the same shape this file's own `judge` already argues for
// declining to invent a coin-flip verdict.
const PRISON_GANG_MIN_MEMBERS = 2;

// Everyone currently, actually serving time at this one real property.
function inmatesOf(worldState, prisonPropertyId) {
  const servingIds = new Set(
    (worldState.courtCases || [])
      .filter((c) => c.status === 'convicted' && c.released_tick === null
        && c.prison_property_id === prisonPropertyId)
      .map((c) => c.defendant_entity_id),
  );
  // Living only — `judge`/`imprison` already refuse a dead defendant,
  // but a death INSIDE is a separate real event (`mortality.js`) this
  // file does not own, so the filter is re-asserted here rather than
  // assumed from the case row alone.
  return (worldState.npcs || [])
    .filter((n) => servingIds.has(n.id) && n.status === 'imprisoned')
    .map((n) => n.id);
}

// `worldState.prisonGangs` (prison property id -> organization id) and
// `worldState.prisonRegimeState` (prison property id -> last observed
// regime, below) are both new and in-memory only — the same documented
// posture `caseRow.prison_property_id`/`city.healthBaseline` already
// carry and for the identical reason: no schema column exists for
// either, and adding one is real, separate schema work this round does
// not take on. A world rebuilt from Postgres loses both and falls back
// to founding a fresh gang / treating every prison as newly observed —
// not a silent loss, the same known, stated limitation every other
// in-memory-only field in this registry already carries. The real
// `organizations` row itself IS round-tripped (schema has always had
// that table); only the lookup FROM a prison TO its gang is not.
function ensurePrisonGang(worldState, prisonPropertyId, tick) {
  const gangs = worldState.prisonGangs || (worldState.prisonGangs = {});
  const inmates = inmatesOf(worldState, prisonPropertyId);

  const existingId = gangs[prisonPropertyId] ?? null;
  const existing = existingId
    ? (worldState.organizations || []).find((o) => o.id === existingId) ?? null
    : null;

  if (existing) {
    // New arrivals join the same real org under the same real leader —
    // `succession.js`, not this file, decides what happens if that
    // leader is ever released or dies, the same separation of
    // concerns `control.js`'s own takeover code already keeps.
    worldState.entityOrganizationMemberships = worldState.entityOrganizationMemberships || [];
    for (const inmateId of inmates) {
      membership.joinOrganization(worldState, { entityId: inmateId, organizationId: existingId, tick });
    }
    return existing;
  }

  // Not founded yet, and nothing to found with fewer than two people —
  // a "gang" of one inmate is just an inmate.
  if (inmates.length < PRISON_GANG_MIN_MEMBERS) return null;

  const prison = (worldState.properties || []).find((p) => p.id === prisonPropertyId) ?? null;
  const leaderId = inmates.reduce((lowest, id) => (id < lowest ? id : lowest));

  // `orgArchetypes.found` needs `generateOrganization`/`generateFaction`
  // injected rather than required at module scope — `engine.js`
  // requires `tick.js`, which requires THIS file, so a module-scope
  // `require('./engine.js')` here would be the identical half-built-
  // module cycle `answerByGroup`'s own header already names for
  // `heat.js`, fixed the identical way: required lazily, inside the
  // function, the moment it is actually needed.
  // eslint-disable-next-line global-require
  const engine = require('./engine.js');
  // **`generateFaction`/`generateOrganization` write to `engine.
  // WorldState` itself, not to whatever `worldState` object this call
  // was handed.** Every real, generated world IS that same singleton
  // (`worldgen.js`'s own header: "a world is a process-level thing
  // here"), so this is usually a no-op — but a constructed test
  // fixture is deliberately its own plain object (standing rule 8),
  // and `membership.joinOrganization` below reads `worldState.
  // organizations` by the array it was actually given. Ensuring the
  // array exists and holds the real founded row — never a second,
  // different object standing in for it — makes this correct either
  // way instead of correct only when the two happen to be the same
  // reference.
  worldState.organizations = worldState.organizations || [];
  const founded = orgArchetypes.found(worldState, {
    archetype: 'prison gang',
    name: `${prison ? prison.name : 'the prison'} yard`,
    seed: worldState.seed ?? 'world',
    // §88: seeded on the prison's own real id, never on an inmate's —
    // an inmate roster changes tick to tick and a trait draw keyed on
    // one would not be reproducible from the same world twice.
    key: prisonPropertyId,
    generateOrganization: engine.generateOrganization,
    generateFaction: engine.generateFaction,
  });
  if (!worldState.organizations.includes(founded)) worldState.organizations.push(founded);
  founded.leader_id = leaderId;
  gangs[prisonPropertyId] = founded.id;

  worldState.entityOrganizationMemberships = worldState.entityOrganizationMemberships || [];
  for (const inmateId of inmates) {
    membership.joinOrganization(worldState, {
      entityId: inmateId,
      organizationId: founded.id,
      role: inmateId === leaderId ? 'leader' : 'member',
      tick,
    });
  }

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'prison_gang_founded',
    description: `${founded.name} forms inside ${prison ? prison.name : 'a prison'}, `
      + `led by ${leaderId}`,
    when_tick: tick,
    participants: inmates,
    where_location_id: prisonPropertyId,
  });

  return founded;
}

// ---------------------------------------------------------------------
// Prison-to-street pipeline
// ---------------------------------------------------------------------
//
// By direct instruction: "let certain gangs branch from the prisons to
// the streets. They'll be connected depending on area, connections,
// organizations that are connected." Reuses the exact same real
// substrate `ensurePrisonGang` above already does — `engine.
// generateFaction` (the identical call `worldgen.js`'s own ordinary
// street-gang generation makes, `type: 'gang'`, no new archetype
// invented for it) and `membership.joinOrganization` — rather than a
// second, parallel founding mechanism.
//
// **"Connected depending on area" is the real, already-tracked
// `npc.communityId` a released person is actually in, never an
// invented relocation.** Nothing in this engine moves a released
// person's community (see `release()` above — only their routine is
// re-seeded), so "the area they're connected to" is exactly where
// they already are when they walk out, the identical real field
// `characterCreation.js`'s own (module-local) `communityOf` helper
// already reads for a different purpose elsewhere in this engine.
//
// **One real affiliate per (prison gang, community) pair, not one
// global street arm.** `worldState.streetAffiliates` keys on
// `${prisonGangOrganizationId}:${communityId}` — the same in-memory-
// only, no-schema-column posture `worldState.prisonGangs` above
// already carries, for the identical reason (no column exists for
// either, and this is real, separate schema work no round here takes
// on casually). Two different released members of the same prison
// gang, returning to two different real communities, grow two real,
// separately-tracked street crews rather than one that implausibly
// spans both at once — the literal reading of "branch... depending on
// area."

function streetAffiliateOf(worldState, prisonGangOrganizationId, communityId) {
  if (prisonGangOrganizationId == null || communityId == null) return null;
  const affiliates = worldState.streetAffiliates || {};
  const key = `${prisonGangOrganizationId}:${communityId}`;
  const existingId = affiliates[key] ?? null;
  if (!existingId) return null;
  return (worldState.organizations || []).find((o) => o.id === existingId) ?? null;
}

// Founds (or returns the already-real) street-side counterpart to one
// real prison gang, scoped to one real community. A single released
// founding member is enough — unlike `ensurePrisonGang`'s real
// `PRISON_GANG_MIN_MEMBERS` floor of two, there is no equivalent
// "is this even a gang" question here: the founder is a real,
// already-proven member of the prison gang they are branching from,
// not an arbitrary pair of strangers, so no minimum-members constant
// is needed or defined.
function ensureStreetAffiliate(worldState, options = {}) {
  const { prisonGangOrganizationId, communityId, tick = worldState.tick ?? 0 } = options;
  if (prisonGangOrganizationId == null || communityId == null) return null;

  const existing = streetAffiliateOf(worldState, prisonGangOrganizationId, communityId);
  if (existing) return existing;

  const prisonGang = (worldState.organizations || []).find(
    (o) => o.id === prisonGangOrganizationId,
  ) ?? null;
  if (!prisonGang) return null;

  const community = (worldState.communities || []).find((c) => c.id === communityId) ?? null;

  // eslint-disable-next-line global-require
  const engine = require('./engine.js');
  // eslint-disable-next-line global-require
  const { seededDraw } = require('./seeded.js');
  worldState.organizations = worldState.organizations || [];
  const founded = engine.generateFaction({
    name: `${prisonGang.name} Street Crew`,
    type: 'gang',
    // §88: seeded on the stable (prisonGangOrganizationId, communityId)
    // pair, never on a founding member's own id — a roster changes
    // tick to tick and a trait draw keyed on one would not replay. Same
    // primitive `orgArchetypes.traitValueFor` already uses, a 20-90
    // band matching `worldgen.js`'s own ordinary street-gang trait
    // spread, not a different invented range for an affiliate crew.
    traitValueFor: (def) => Math.round(
      20 + seededDraw([
        worldState.seed ?? 'world', 'street-affiliate-trait',
        prisonGangOrganizationId, communityId, def.family, def.name,
      ]) * 70,
    ),
  });
  if (!worldState.organizations.includes(founded)) worldState.organizations.push(founded);

  // In-memory-only convenience fields, the same treatment `founded.
  // leader_id = leaderId` already gets a few lines above in
  // `ensurePrisonGang` — not a schema column, a real fact about this
  // one generated row nonetheless.
  founded.affiliatedPrisonGangId = prisonGangOrganizationId;
  founded.communityId = communityId;

  worldState.streetAffiliates = worldState.streetAffiliates || {};
  worldState.streetAffiliates[`${prisonGangOrganizationId}:${communityId}`] = founded.id;

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'street_affiliate_founded',
    description: `${founded.name} forms on the street`
      + `${community ? ` in ${community.name}` : ''}, affiliated with ${prisonGang.name}`,
    when_tick: tick,
    participants: [],
    where_location_id: null,
  });

  return founded;
}

// Called from `release()` below. If the person being released was a
// real member of a prison gang (`'prison gang'` or
// `'racially-affiliated prison gang'`, both `orgArchetypes` entries),
// connects them to its real street-side counterpart in the real
// community they are actually in — founding it if this is the first
// member of that prison gang ever released into that community.
// Returns the affiliate organization, or null if the released person
// was never a prison-gang member, or has no real community to be
// connected into.
function joinStreetAffiliate(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;

  const prisonMembership = (worldState.entityOrganizationMemberships || []).find((m) => {
    if (m.entity_id !== entityId) return false;
    const org = (worldState.organizations || []).find((o) => o.id === m.organization_id);
    return org != null && (org.archetype === 'prison gang' || org.archetype === 'racially-affiliated prison gang');
  });
  if (!prisonMembership) return null;

  // The real `npc.communityId`, read directly — the same field
  // `characterCreation.js`'s own (unexported) `communityOf` helper
  // reads, inlined here rather than widening that module's exports for
  // one field already reachable off the real `npcs` row this file
  // already holds a reference style for elsewhere in this section.
  const npc = (worldState.npcs || []).find((n) => n.id === entityId) ?? null;
  const communityId = npc?.communityId ?? null;
  if (communityId == null) return null;

  const affiliate = ensureStreetAffiliate(worldState, {
    prisonGangOrganizationId: prisonMembership.organization_id,
    communityId,
    tick,
  });
  if (!affiliate) return null;

  membership.joinOrganization(worldState, { entityId, organizationId: affiliate.id, tick });
  return affiliate;
}

// ---------------------------------------------------------------------
// Prison breaks and takeovers
// ---------------------------------------------------------------------
//
// **"Taking over a prison" is the same regime mechanic every other
// area already has, not a new status.** `authority.regimeFor` already
// computes `governed`/`contested`/`lawless` for a prison's own
// community exactly as it does for any other — a prison gang growing
// strong enough to hold that community's blocks IS the state losing
// its grip there, the same `gripTerm` calculation, nothing new to
// write.
//
// **A crossing, not a condition — the seventh standing rule, in a new
// place.** A community sitting at `lawless` every tick must not break
// the same prison open again every tick forever; `worldState.
// prisonRegimeState` is the real, in-memory, per-prison memory of the
// last regime this function itself observed, so a break fires exactly
// once per transition INTO `lawless`, never on every tick the area
// happens to stay there. The very first time a prison is ever
// observed, whatever its regime, is recorded as the baseline and
// never treated as a crossing — there is nothing to have crossed FROM
// yet, the same reasoning `authority.js`'s own "unobserved is not a
// zero" note gives for a different value.
//
// **What actually happens on a break: real, not invented.** Everyone
// CURRENTLY serving at that one real prison is released early through
// the same real `release` function an ordinary completed sentence
// uses, tagged `reason: 'prison-break'` so the historical record says
// the sentence was not served rather than silently looking identical
// to one that was.
function runPrisonBreaks(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, writ = authority.writByCommunity(worldState) } = options;
  const events = [];
  const regimeState = worldState.prisonRegimeState || (worldState.prisonRegimeState = {});

  const prisons = (worldState.properties || []).filter((p) => p.landmark_category === 'prison');
  for (const prison of prisons) {
    if (prison.community_id === null || prison.community_id === undefined) continue;
    const reading = writ.get(prison.community_id)
      ?? authority.writOf(worldState, prison.community_id);
    // **An unmeasured area is recorded as its own real baseline, not
    // skipped.** A world that starts with no reading at all and only
    // later becomes measured enough to read `lawless` on its FIRST
    // real reading must still cross into it from something — treating
    // "never observed" and "observed, and governed/contested" as the
    // same prior state would make that first real lawless reading
    // look like a crossing from nowhere, which is not a crossing at
    // all. `regimeState` therefore stores `null` as a real prior value
    // the moment this prison is checked once, distinct from never
    // having been checked.
    const regime = reading.regime ?? null;
    const seenBefore = Object.prototype.hasOwnProperty.call(regimeState, prison.id);
    const previous = regimeState[prison.id] ?? null;
    regimeState[prison.id] = regime;
    if (!seenBefore) continue; // first observation ever — baseline only
    if (regime !== 'lawless' || previous === 'lawless') continue; // no fresh crossing

    const holderId = authority.holderOf(worldState, prison.community_id);
    const brokenOut = [];
    for (const entityId of inmatesOf(worldState, prison.id)) {
      const released = release(worldState, entityId, { tick, reason: 'prison-break' });
      if (released) brokenOut.push(entityId);
    }
    if (brokenOut.length === 0) continue;

    events.push({
      type: 'prison_break',
      severity: 'high',
      note: `${prison.name} breaks open as its own ground goes lawless — `
        + `${brokenOut.length} released unserved${holderId ? ` under organization ${holderId}` : ''}`,
      tick,
      affected_entity_ids: brokenOut,
      global_effects: {
        prisonPropertyId: prison.id,
        communityId: prison.community_id,
        holderId,
        releasedEntityIds: brokenOut,
      },
    });
  }
  return events;
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

  // **The faction's own side of the identical event — real,
  // independent heat, not folded into the victim's feud above.**
  // `heat.js`'s own header explains why this is the one real trigger
  // for multi-faction heat: a faction that actually did something
  // about an offence (this line only runs once `acts.length > 0`) now
  // has this offender on its own real radar, tracked separately from
  // any other faction's. Required here rather than at module scope —
  // `heat.js` requires `justice.js` at module scope for
  // `GROUP_FEUD_GAIN`, so the reverse at module scope would hand one of
  // them a half-built module, the identical cycle `authority.js`
  // already documents taking `statecraft.js` the same way.
  // eslint-disable-next-line global-require
  require('./heat.js').raiseHeat(worldState, { entityId: offenderId, factionOrganizationId: holderId });

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

  // Taking over a prison, closed with the one real reading already
  // computed for this whole pass — see `runPrisonBreaks`'s own header.
  events.push(...runPrisonBreaks(worldState, { tick, writ }));

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
    prison: row.prison_property_id ? describePrison(worldState, row.prison_property_id) : null,
  };
}

// The real facility a case's own `prison_property_id` points at, with
// the real, cited BJS/OJJDP composition data `prisonPacks.js` reports
// for a facility of that kind — the "information on races in all the
// penitentiaries, county jails... juvenile and women's facilities"
// half of task #151, surfaced the one place this engine already names
// a specific real prison rather than duplicated across every caller.
// Reporting only: nothing downstream of this function's return value
// decides anything from it — see `prisonPacks.js`'s own header and
// `test/prison-packs.test.js`'s firewall.
function describePrison(worldState, prisonPropertyId) {
  const property = (worldState.properties || []).find((p) => p.id === prisonPropertyId);
  if (!property) return null;
  return {
    id: property.id,
    name: property.name ?? null,
    facilityType: property.facilityType ?? null,
    demographics: property.facilityType
      ? prisonPacks.describeFacilityDemographics(property.facilityType)
      : null,
    gangOrganizationId: (worldState.prisonGangs || {})[prisonPropertyId] ?? null,
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
  prisonFor,
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
  describePrison,
  assertVocabulariesLineUp,
  PRISON_GANG_MIN_MEMBERS,
  inmatesOf,
  ensurePrisonGang,
  runPrisonBreaks,
  streetAffiliateOf,
  ensureStreetAffiliate,
  joinStreetAffiliate,
};
