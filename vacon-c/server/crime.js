// server/crime.js
//
// A crime with a type on it — the substrate every crime statistic
// needs and nothing in this engine had.
//
// **What was wrong before this.** `communities.crime` and
// `territory_blocks.crime_rate` are single NUMERIC columns, seeded to
// 0 by their generators and updated by nothing. §9's MASTER BLOCK KEY
// asks for seven crime categories per area — "violent crime, property
// crime, drug crime, theft, gun crime, fraud, domestic incidents" —
// and `runSecurityPhase` produced no crime record at all. It resolved
// aggression between two people with a standing grudge and, when that
// escalated, emitted one `conflict_escalation` event whose only
// description of what happened was an English sentence in a `note`
// field.
//
// So "crime by type per area" was not a missing number. There was
// nothing to count, and no way to attribute what little there was to
// a place.
//
// ---------------------------------------------------------------------
// Why this is a table and death was not
//
// `mortality.js` deliberately put deaths in `historical_records`
// rather than inventing a `deaths` table, and the same question was
// asked here and answered the other way. The reason is attribution.
//
// A crime statistic is a count **per area**. `historical_records` has
// `where_location_id`, which references `properties`, and a property
// has no city, community or block in the base schema — so a crime
// recorded there could never be summed by neighbourhood, which is the
// only thing §9 asks of it. It also has no role structure: `who` is a
// flat id array, so "who did it" and "who it happened to" are the same
// field, and a victim would be indistinguishable from an offender.
//
// A typed incident carries four things no existing table holds
// together: **category, perpetrator, victim, and the community it
// happened in**. That is a table.
//
// It does not replace history. A high-significance incident still
// writes a `historical_records` row the same way a death does, so §41's
// "the world remembers" keeps one place to read. The incident row is
// the count; the history row is the memory.
//
// ---------------------------------------------------------------------
// Eight categories, four generators, and the four that are honest
// about having none
//
// Every category §9 names is here and countable. **Only some of them
// are produced by anything**, and the rest say what they are waiting
// for rather than being quietly filled with a plausible number — the
// same discipline `areaStats.UNAVAILABLE` uses.
//
//   violent    ✅ aggression that escalates (keys.resolveAggression)
//   domestic   ✅ the same escalation between two people in one family
//   theft      ✅ deprivation, against a wealthier resident
//   property   ✅ deprivation, with nobody to take from
//   drug       ✗  no substance, contraband or trade in one exists
//   gun        ✗  no weapon exists anywhere in the schema
//   fraud      ✗  market listings resolve honestly; there is no
//                 contract, claim or instrument to falsify
//   sex_offense ✗ **not a gap — a decision.** The category exists so
//                 the statistic can be reported honestly by a world
//                 that has one (an import, a scenario, a scripted
//                 event), and no generator produces one. §9 does not
//                 list it; it is here because it was asked for, and it
//                 is counted and never narrated.
//
// `CATEGORIES` below is the whole list with those reasons attached, so
// a caller can show a user which zeroes are measurements and which are
// absences. A zero that means "we do not model this" and a zero that
// means "nobody did it here" are different facts, and reporting them
// as the same number is the defect this file exists to avoid.
//
// ---------------------------------------------------------------------
// Deprivation, not disposition
//
// The theft and property generators read net worth against the
// world's poverty line and the scarcity of food, water and medicine —
// the environment, exactly as mortality does. They read **no trait
// that could stand in for a kind of person**, and that is deliberate:
// §9 permits demographic modelling and forbids demographics
// determining an NPC's "morality, criminality, intelligence, or
// worth". A generator keyed to who somebody is rather than what they
// are living through would write exactly the model that clause
// forbids, one commit at a time.
//
// Aggression is the exception and is not one: it is a decision an
// entity makes through `keys.resolveAggression`, about a specific
// other entity it has a specific grudge against, and the escalation
// was already computed. This file names what that escalation *is*.
//
// Every draw is seeded (`seeded.js`), so §88's replay guarantee holds:
// the same world and the same seed commit the same crimes.

'use strict';

const areaStats = require('./areaStats.js');
const economy = require('./economy.js');
const mortality = require('./mortality.js');
const worldStore = require('./worldStore.js');
const inventory = require('./inventory.js');
const items = require('./items.js');

// An item's base worth, for choosing what a thief takes. Deliberately
// the BASE value rather than the local barter score: a thief in the
// moment is not running a market analysis, and calling `barterScore`
// per item per theft would price the whole world on every incident.
function barterValue(worldState, itemName) {
  const item = items.findItem(worldState, itemName);
  return item ? Number(item.baseValue) || 0 : 0;
}
const { seededDraw } = require('./seeded.js');
const { nextAfter } = require('./nextAfter.js');

// §9's seven, verbatim and in its order, plus the one that was asked
// for. `generated` says whether anything in this engine produces it;
// `substrate` says what it is waiting for when nothing does.
const CATEGORIES = {
  violent: {
    generated: true,
    note: 'aggression between two entities with standing conflict that escalates',
  },
  property: {
    generated: true,
    note: 'deprivation with no wealthier resident present to take from',
  },
  drug: {
    generated: false,
    substrate: 'no substance, contraband or illicit trade exists. resources.resource_type is '
      + 'open TEXT and nothing produces one, so a drug offence has no object.',
  },
  theft: {
    generated: true,
    note: 'deprivation, against a resident above the poverty line',
  },
  gun: {
    generated: true,
    note: 'an escalation where the aggressor has something from §26\'s `protection` category '
      + 'equipped. This was declared ungeneratable — "no weapon exists anywhere in the '
      + 'schema" — until server/inventory.js gave an offence something to be armed WITH.',
  },
  fraud: {
    generated: false,
    substrate: 'market_listings resolve honestly and there is no contract, claim, insurance '
      + 'or instrument to falsify. employment_records and ownership_records are the nearest '
      + 'substrate and neither can currently be forged.',
  },
  domestic: {
    generated: true,
    note: 'the same escalation as violent, between two members of one family',
  },
  sex_offense: {
    generated: false,
    substrate: 'deliberately ungenerated. The category exists so a world that records one — '
      + 'an import, a scenario, a scripted event — can report the statistic honestly. '
      + 'Nothing in this engine produces one and nothing narrates one.',
  },
};

const CRIME_CATEGORIES = Object.keys(CATEGORIES);
const GENERATED_CATEGORIES = CRIME_CATEGORIES.filter((c) => CATEGORIES[c].generated);

//: Flagged interpretive. No document gives a crime rate, so these are
//: the shape of the model rather than a measured constant.
//:
//: Deprivation pressure is the share of the gap between somebody's net
//: worth and the poverty line, times the worst essential shortage.
//: Somebody at the line under no shortage commits nothing; somebody at
//: zero under a total shortage draws against BASE_DEPRIVATION_RISK.
const BASE_DEPRIVATION_RISK = 0.0006;   // per tick, at full deprivation
const SCARCITY_WEIGHT = 0.5;            // how much a shortage adds on top of poverty

// Severity, 0..100, in the same currency as `events.severity` and
// `historical_records.significance` so the three agree.
const SEVERITY = {
  violent: 70, domestic: 65, sex_offense: 85, gun: 80,
  theft: 30, property: 35, drug: 25, fraud: 40,
};

// A crime this significant is also world history. Same threshold
// `runHistoryPhase` uses for events, for the same reason: history is
// what a community would still be talking about.
const HISTORY_SIGNIFICANCE_FLOOR = 60;

// ---------------------------------------------------------------------
// Friction — and the deadlock that made violent crime impossible
// ---------------------------------------------------------------------
//
// **`relationships.conflict` was initialised to 0 and the only code in
// the engine that ever raised it was gated behind its own threshold.**
// `runSecurityPhase` calls `keys.resolveAggression` for a relationship
// whose `conflict > CONFLICT_ESCALATION_THRESHOLD` (30);
// `resolveAggression` is the sole writer of `conflict`, at
// `responseLevel / 10`. Conflict starts at 0, so the resolver never
// runs, so conflict never rises, so the resolver never runs. Measured
// on a generated world at 200 ticks: **0 of 241 relationships had a
// conflict above zero**, and therefore not one violent or domestic
// offence has ever occurred in any world this engine has generated.
// Two of §9's four generatable crime categories were unreachable.
//
// This is `relationships.love` again, one field over. That one was
// "initialised to 0 and written by nothing", so no child could ever be
// born, and eighteen passing tests said otherwise because every one of
// them set the field directly. The answer there was
// `births.advanceBonds`, called from the Social phase; this is the same
// answer for the same shape of hole, and it deliberately mirrors it.
//
//: Contact first, exactly as a bond needs it: two people who have never
//: met are not in conflict. Reusing `births.BOND_CONTACT_FLOOR`'s value
//: would couple two unrelated models, so this is its own constant at
//: the same number, and the reason is the same — thirty ticks is long
//: enough that a relationship is a relationship.
const FRICTION_CONTACT_FLOOR = 30;

//: What friction is made of. Two terms about the PAIR, multiplied by
//: one about their circumstances — and the shape is that way because
//: the first shape was measured and did not work.
//:
//:   distrust   `relationships.trust` below the neutral 50, which
//:              `keys.resolveTrust` moves every time one of them learns
//:              something about the other.
//:   rivalry    `relationships.competition`, raised by the territory
//:              resolver and, since `server/competition.js`, by playing
//:              each other at the community game.
//:   strain     `entity_state.stress_level`, averaged over the two, as
//:              a MULTIPLIER on the other two rather than a third term
//:              averaged in with them.
//:
//: **Why not the mean of three.** That was the first version, and
//: measured on a 400-tick world it capped conflict at 21.2 against an
//: escalation threshold of 30 — so violent crime stayed exactly as
//: impossible as it had been, with a mechanism in place that looked
//: like it had fixed it. The cause is the third clause of standing rule
//: 12: `FRICTION_STRAIN_FLOOR` was set to 50 because 50 *sounds* like
//: the middle of a 0-100 scale, and the measured stress in that world
//: ran 0 to 43.8 with a median of 0. Strain was therefore 0 for every
//: person in the world, permanently, and averaging a dead term in with
//: two live ones costs a third of the achievable range.
//:
//: So: the floor is 40, which is the top of `behavior.MOOD_BANDS`'
//: `steady` band and the top of what a settled population actually
//: reaches — and strain amplifies rather than dilutes. A pair with real
//: distrust and an active rivalry is a feud whether or not either of
//: them is also under pressure; being under pressure makes it worse.
const FRICTION_STRAIN_FLOOR = 40;

//: How fast conflict moves toward what circumstances justify.
//:
//: **A target, approached — never a ratchet.** Conflict moves TOWARD
//: the figure above, so it falls again when the rivalry cools or the
//: trust recovers. The alternative is an accumulator, which would put
//: every long-lived relationship over the escalation threshold
//: eventually regardless of circumstance — a model in which everybody
//: who lives long enough tries to kill somebody.
const FRICTION_RATE = 0.02;

let nextCrimeId = 1;

function reseedIds(worldState) {
  nextCrimeId = nextAfter(worldState.crimeIncidents, 'id');
  return { nextCrimeId };
}

// -- recording ----------------------------------------------------------

function livingOrDead(worldState, entityId) {
  return worldState.npcs.find((n) => n.id === entityId)
    || (worldState.deceased || []).find((n) => n.id === entityId)
    || null;
}

// Where a crime is counted.
//
// **The victim's community, falling back to the perpetrator's.** A
// crime is counted where it happened to somebody, which is the only
// geography either party actually has — `entities.community_id`. An
// incident with neither is recorded with a null community and is
// excluded from every per-area count rather than being assigned to an
// arbitrary one, exactly as `areaStats.unplaced` treats a resident
// with no home.
function communityForIncident(worldState, { perpetratorId, victimId }) {
  const victim = victimId === null || victimId === undefined ? null : livingOrDead(worldState, victimId);
  if (victim && victim.communityId !== null && victim.communityId !== undefined) {
    return victim.communityId;
  }
  const perpetrator = perpetratorId === null || perpetratorId === undefined
    ? null : livingOrDead(worldState, perpetratorId);
  if (perpetrator && perpetrator.communityId !== null && perpetrator.communityId !== undefined) {
    return perpetrator.communityId;
  }
  return null;
}

// Record one incident. `category` is checked against the list rather
// than accepted — a typo would create a ninth category that every
// per-category report silently omits, which is the failure this whole
// file is built to make impossible.
function recordCrime(worldState, options = {}) {
  const {
    category,
    perpetratorId = null,
    victimId = null,
    tick = worldState.tick ?? 0,
    detail = null,
  } = options;

  if (!CRIME_CATEGORIES.includes(category)) {
    throw new Error(
      `recordCrime: "${category}" is not a crime category. The eight are: `
      + `${CRIME_CATEGORIES.join(', ')}.`,
    );
  }

  const communityId = options.communityId !== undefined
    ? options.communityId
    : communityForIncident(worldState, { perpetratorId, victimId });

  const severity = options.severity ?? SEVERITY[category] ?? 50;

  const incident = {
    id: nextCrimeId++,
    category,
    perpetrator_entity_id: perpetratorId,
    victim_entity_id: victimId,
    community_id: communityId,
    tick,
    severity,
    detail,
    // **Set by server/policing.js, and null here on purpose.** Null
    // means "nobody has looked at this yet", which is a third state
    // distinct from investigated-and-cleared and
    // investigated-and-not. Defaulting `cleared` to false would make
    // every case ever recorded count against the clearance rate from
    // the moment it happened.
    investigated_tick: null,
    cleared: null,
  };
  worldState.crimeIncidents.push(incident);

  // Significant enough that the world remembers it. Same shape as a
  // death's record so `historical_records` stays one readable log.
  if (severity >= HISTORY_SIGNIFICANCE_FLOOR) {
    worldStore.addHistoricalRecord(worldState, {
      who: [perpetratorId, ...(victimId === null ? [] : [victimId])].filter((id) => id !== null),
      what: 'crime',
      when_tick: tick,
      where_location_id: null,
      why: category,
      result: detail,
      consequences: null,
      future_effects: null,
      significance: severity,
    });
  }

  // Standing rule 1's write-back: whoever did it remembers doing it.
  // The victim's memory is left to whatever mechanism observes the
  // harm — a victim who always knows exactly what happened to them
  // would make `entity_knowledge`'s distortion model meaningless.
  if (perpetratorId !== null) {
    worldStore.addMemory(worldState, {
      entityId: perpetratorId,
      tick,
      memoryType: 'negative',
      category: 'conflict',
      description: `Committed a ${category} offence${victimId === null ? '' : ` against entity ${victimId}`}.`,
      importance: severity,
      emotionLevel: -Math.round(severity / 2),
      relatedEntityIds: victimId === null ? [] : [victimId],
    });
  }

  return incident;
}

// -- the generators -----------------------------------------------------

// Do these two share a family? A fight inside a household is a
// different statistic from a fight in the street, and `families` plus
// `family_memberships` already say which is which.
function sharesFamily(worldState, aId, bId) {
  const families = (worldState.familyMemberships || [])
    .filter((m) => m.entity_id === aId)
    .map((m) => m.family_id);
  if (families.length === 0) return false;
  return (worldState.familyMemberships || [])
    .some((m) => m.entity_id === bId && families.includes(m.family_id));
}

// An escalation that has already been decided, named.
//
// Called from `runSecurityPhase` with the outcome `keys.resolveAggression`
// just produced. This does not re-decide anything and does not roll:
// the aggression key already ran, already wrote back, and already said
// `escalatesToConflict`. All that was missing was a record saying what
// kind of crime that was.
function recordEscalation(worldState, options = {}) {
  const { perpetratorId, victimId, tick = worldState.tick ?? 0, responseLevel = null } = options;

  // **Armed or not, asked literally.** §9 lists `gun` as its own
  // category and this file declared it ungeneratable for exactly one
  // reason, in its own words: nothing in the schema could distinguish
  // an armed offence from an unarmed one. `inventory.hasEquippedCategory`
  // can — §26's `protection` category is what somebody has about them
  // for that purpose.
  //
  // It takes precedence over `domestic` and `violent` because it is
  // the more specific fact: a §9 crime report that recorded an armed
  // assault as a plain one would lose the thing the category exists to
  // count.
  const armed = inventory.hasEquippedCategory(worldState, perpetratorId, 'protection');
  const category = armed
    ? 'gun'
    : sharesFamily(worldState, perpetratorId, victimId) ? 'domestic' : 'violent';
  return recordCrime(worldState, {
    category,
    perpetratorId,
    victimId,
    tick,
    severity: responseLevel === null ? SEVERITY[category] : Math.max(SEVERITY[category], responseLevel),
    detail: 'escalated from standing conflict',
  });
}

// How hard this person is being squeezed, 0..1.
//
// Poverty and shortage, and nothing about them. Somebody at or above
// the poverty line with no shortage returns 0 and never draws.
// **`povertyDepth` rather than `(line - worth) / line` written out
// here.** The first version of this did write it out, and produced no
// crime at all under total destitution: in a world where most people
// own nothing the median is 0, so the line is 0, so `worth < line` is
// false for everybody and the poorest possible world reported nobody
// poor. A zero line means everybody is poor, not nobody, and that
// belongs in one place — see `areaStats.povertyDepth`.
function deprivationPressure(worldState, npc, { line, scarcity }) {
  const worth = economy.getNetWorth(worldState, npc.id);
  const depth = areaStats.povertyDepth(worth, line);
  if (depth <= 0) return 0;
  return Math.min(1, depth * (1 + scarcity * SCARCITY_WEIGHT));
}

// Deprivation crime for the whole living population, once per tick.
//
// Runs inside the Security phase — the pipeline stays at eleven.
function runDeprivationCrime(worldState, tick = worldState.tick ?? 0) {
  const line = areaStats.povertyLine(worldState);
  const scarcity = mortality.survivalScarcity(worldState);
  const incidents = [];
  if (line === null) return incidents;

  // One pass to find, per community, somebody worth stealing from.
  // A theft needs a victim above the line; without one the same
  // pressure comes out as a property offence instead, which is the
  // distinction §9 draws between "theft" and "property crime".
  const targetsByCommunity = new Map();
  for (const npc of worldState.npcs) {
    if (npc.communityId === null || npc.communityId === undefined) continue;
    const worth = economy.getNetWorth(worldState, npc.id);
    if (!Number.isFinite(worth) || areaStats.isBelowPovertyLine(worth, line)) continue;
    if (worth <= 0) continue;   // nothing to take is not a target
    const existing = targetsByCommunity.get(npc.communityId);
    if (!existing || worth > existing.worth) targetsByCommunity.set(npc.communityId, { npc, worth });
  }

  for (const npc of worldState.npcs) {
    const pressure = deprivationPressure(worldState, npc, { line, scarcity });
    if (pressure <= 0) continue;
    if (seededDraw([npc.id, tick, 'crime:deprivation']) >= pressure * BASE_DEPRIVATION_RISK) continue;

    const target = targetsByCommunity.get(npc.communityId);
    // Never the offender themselves — a world with one rich person in
    // a block would otherwise have them rob themselves.
    const victim = target && target.npc.id !== npc.id ? target.npc : null;

    const incident = recordCrime(worldState, {
      category: victim ? 'theft' : 'property',
      perpetratorId: npc.id,
      victimId: victim ? victim.id : null,
      tick,
      detail: `deprivation pressure ${Math.round(pressure * 100)}`,
    });

    // **A theft takes something.** Before `server/inventory.js` there
    // was nothing to take: the victim lost nothing, the offender
    // gained nothing, and the only trace was a row saying it happened.
    // The least valuable thing the victim holds is taken — somebody
    // stealing out of deprivation takes what they can carry, and
    // taking the best item would make every theft a heist.
    if (victim) {
      const holdings = inventory.holdingsOf(worldState, victim.id)
        .filter((h) => !h.equipped);
      if (holdings.length > 0) {
        const target = holdings.reduce((least, h) => {
          const value = barterValue(worldState, h.item_name);
          return value < barterValue(worldState, least.item_name) ? h : least;
        });
        inventory.transfer(worldState, {
          fromId: victim.id, toId: npc.id, itemName: target.item_name, quantity: 1, tick,
        });
        incident.detail += `; took a ${target.item_name}`;
      }
    }

    incidents.push(incident);
  }

  return incidents;
}

// -- friction -------------------------------------------------------------

// How much strain these two are under, 0..1, from what the Behavior
// Engine has actually observed about them.
//
// **Unknown is not calm.** A person with no `entity_state` row has not
// been observed, and `behavior.moodFor` already shipped the bug of
// reading that as "content". Somebody unobserved contributes nothing to
// the average rather than a zero — and where NEITHER has been observed,
// there is no strain reading at all and friction is driven by the other
// two terms alone.
function strainBetween(worldState, aId, bId) {
  const levels = [];
  for (const row of worldState.entityState || []) {
    if (row.entity_id !== aId && row.entity_id !== bId) continue;
    const level = Number(row.stress_level);
    if (Number.isFinite(level)) levels.push(level);
  }
  if (levels.length === 0) return 0;
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  return Math.max(0, Math.min(1, (mean - FRICTION_STRAIN_FLOOR) / (100 - FRICTION_STRAIN_FLOOR)));
}

// What this pair's circumstances currently justify, 0..100.
function frictionTarget(worldState, relationship) {
  const trust = Number(relationship.trust ?? 50);
  const distrust = Math.max(0, Math.min(1, (50 - trust) / 50));
  const rivalry = Math.max(0, Math.min(1, Number(relationship.competition ?? 0) / 100));
  const strain = strainBetween(worldState, relationship.entity_a_id, relationship.entity_b_id);
  // The mean of the two terms that are ABOUT these two people, scaled
  // by the strain they are under. So a rivalry alone is a rivalry — it
  // takes distrust as well to make a feud — and pressure makes an
  // existing feud worse rather than manufacturing one out of nothing.
  return ((distrust + rivalry) / 2) * (1 + strain) * 100;
}

// Move `relationships.conflict` toward what circumstances justify.
//
// Called from `runSocialPhase` beside `births.advanceBonds`, which is
// the pass this mirrors — see the long note above FRICTION_CONTACT_FLOOR
// for the deadlock this exists to break. Returns events for crossings
// only, never for the condition (standing rule 7): a pair sitting above
// the threshold for a decade is one event, not three thousand.
function advanceFriction(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, threshold = null } = options;
  const events = [];

  for (const relationship of worldState.relationships || []) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if ((relationship.interaction_count ?? 0) < FRICTION_CONTACT_FLOOR) continue;

    const before = Number(relationship.conflict ?? 0);
    const target = frictionTarget(worldState, relationship);
    const after = Math.max(0, Math.min(100,
      Math.round((before + (target - before) * FRICTION_RATE) * 10000) / 10000));
    relationship.conflict = after;

    if (threshold !== null && before <= threshold && after > threshold) {
      events.push({
        type: 'feud_opened',
        severity: 'medium',
        note: `entities ${relationship.entity_a_id} and ${relationship.entity_b_id} `
          + 'fell into open conflict',
        tick,
        affected_entity_ids: [relationship.entity_a_id, relationship.entity_b_id],
        global_effects: { conflict: after },
      });
    }
  }

  return events;
}

// -- reading ------------------------------------------------------------

function incidentsIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  return (worldState.crimeIncidents || []).filter(
    (i) => i.community_id === communityId
      && (sinceTick === null || i.tick >= sinceTick),
  );
}

// Counts for **every** category, always — including the ones nothing
// generates. A caller iterating this gets the same eight keys from
// every area in every world, which is what makes two areas comparable
// at all. Pair it with `CATEGORIES` to tell a measured zero from an
// unmodelled one.
function countsByCategory(worldState, communityId, options = {}) {
  const counts = {};
  for (const category of CRIME_CATEGORIES) counts[category] = 0;
  for (const incident of incidentsIn(worldState, communityId, options)) {
    counts[incident.category] += 1;
  }
  return counts;
}

// Incidents per 1,000 residents. **Rates, not counts, are what
// compare** — a block of 40 people and a district of 4,000 cannot be
// ranked on raw totals, and every cross-area statistic in this project
// is normalised for that reason.
//: The window a "current" crime rate is measured over, and the rate at
//: which a place reads as maximally dangerous.
//:
//: A cumulative count is not a rate — every community's total only ever
//: rises, so a place that was violent a decade ago and is quiet now
//: would read as dangerous forever. One year of ticks is the shortest
//: window that is not dominated by whether anything happened last week.
//:
//: 40 per 1,000 per year is the reference. Flagged interpretive: no
//: document sets one, and it is chosen so that a settlement where
//: roughly one person in twenty-five is involved in a recorded incident
//: in a year reads as fully dangerous rather than merely bad.
const DANGER_WINDOW_TICKS = 365;
const DANGER_REFERENCE_PER_1K = 40;

// How dangerous each community currently is, 0..1, keyed by community
// id. Built once for a whole pass rather than asked per person —
// `traitDrift` needs it for every NPC in the world and recomputing it
// 150 times would walk the incident log 150 times.
//
// A community with nobody in it is absent from the map rather than
// present at 0: an empty block is not a safe one, it is unmeasured.
function dangerByCommunity(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, window = DANGER_WINDOW_TICKS } = options;
  const danger = new Map();
  for (const community of worldState.communities || []) {
    const rate = ratePer1k(worldState, community.id, { sinceTick: tick - window });
    if (rate === null) continue;
    danger.set(community.id, Math.min(1, rate / DANGER_REFERENCE_PER_1K));
  }
  return danger;
}

function ratePer1k(worldState, communityId, options = {}) {
  const population = areaStats.residentsOf(worldState, communityId).length;
  if (population === 0) return null;
  const total = incidentsIn(worldState, communityId, options).length;
  return Math.round((total / population) * 1000 * 100) / 100;
}

// World totals, for the denominator a comparison needs.
function worldCounts(worldState, options = {}) {
  const { sinceTick = null } = options;
  const counts = {};
  for (const category of CRIME_CATEGORIES) counts[category] = 0;
  for (const incident of worldState.crimeIncidents || []) {
    if (sinceTick !== null && incident.tick < sinceTick) continue;
    counts[incident.category] += 1;
  }
  return counts;
}

module.exports = {
  CATEGORIES,
  CRIME_CATEGORIES,
  GENERATED_CATEGORIES,
  BASE_DEPRIVATION_RISK,
  FRICTION_CONTACT_FLOOR,
  FRICTION_STRAIN_FLOOR,
  FRICTION_RATE,
  strainBetween,
  frictionTarget,
  advanceFriction,
  SCARCITY_WEIGHT,
  SEVERITY,
  HISTORY_SIGNIFICANCE_FLOOR,
  reseedIds,
  recordCrime,
  recordEscalation,
  deprivationPressure,
  runDeprivationCrime,
  incidentsIn,
  countsByCategory,
  ratePer1k,
  DANGER_WINDOW_TICKS,
  DANGER_REFERENCE_PER_1K,
  dangerByCommunity,
  worldCounts,
  sharesFamily,
};
