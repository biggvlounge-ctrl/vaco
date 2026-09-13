// server/policing.js
//
// The other half of the Security phase — the half that did nothing.
//
// **What was wrong.** `runSecurityPhase` has always covered crime and
// law enforcement together, and `urbanSystems.js` has said so in system
// 13's own note since it was written: "One phase covers this and Crime
// together. No patrols, investigations, raids, arrests or clearance
// rates." The crime half became real with `server/crime.js`. This is
// the policing half, and until it existed the §9 SURVEILLANCE block was
// the one category in the whole statistics catalogue with **nothing
// computed at all** — four declared gaps out of four — plus
// `police_trust` in the psychological block, which had no institution
// to be trust in.
//
// `GAME_LANGUAGE_AND_REFERENCES.md` calls this gap "heat" and names it
// the specific thing the open-world crime genre turns on: not that
// crime exists, but that it escalates and that somebody responds.
//
// ---------------------------------------------------------------------
// Four decisions
//
// **1. Policing capacity is infrastructure, not an organization.**
// `organizations.type` enumerates thirteen kinds and none of them is a
// police force; `infrastructure.type` has `public_safety` with a
// capacity, a condition and a funding level. So a city's capacity to
// investigate anything is the public_safety infrastructure it has, in
// the condition it is in — which also means a city that lets its public
// safety decay solves fewer crimes, with no extra mechanism.
//
// **2. Clearance, not arrest.** An investigation ends with a case
// cleared or not. It does NOT produce an arrest, a charge or a
// sentence, because §7's Prison system is `absent` and
// `server/schema-extensions.sql` records deliberately that
// `imprisoned` was NOT added as an entity status. Building arrests
// without anywhere to put anybody would mean either inventing a prison
// or quietly releasing everybody, and both are worse than stopping at
// the honest boundary. `test/urban-systems.test.js` still holds Prison
// as absent, and this file does not change that.
//
// **3. Trust is measured, not derived.** `police_trust` could have
// been computed as a formula over the clearance rate, and that would
// be a restatement of the clearance rate under a name that promises
// something else. Instead an unsolved crime in your area shifts the
// residents' actual belief, through `server/beliefs.js`, which already
// exists and already models strength and neutrality. The statistic
// then reads what people believe rather than what a formula says they
// should.
//
// **4. Reported is not committed, and the statistic says which.**
// Every crime incident this engine records happened. What policing
// adds is whether anybody did anything about it — so `clearance_rate`
// is over incidents that occurred, which is the figure a simulation
// can compute and a real police department cannot. Real crime data
// measures reported crime and is partly a measure of policing;
// `dev-docs/LAND_AND_MAP_DATA.md` says so where it matters, which is
// at the import boundary.

'use strict';

const beliefs = require('./beliefs.js');
const crime = require('./crime.js');
const infrastructure = require('./infrastructure.js');
const { seededDraw } = require('./seeded.js');
const { getLiveEntity } = require('./entityTraits.js');

// The belief this file moves. `belief_type` must be one of the six the
// schema enumerates, and `political` is the right one: trust in an
// institution is a political belief, not a personal preference.
const TRUST_BELIEF = 'trust in public safety';
const TRUST_BELIEF_TYPE = 'political';

//: Flagged interpretive. No document gives a clearance rate.
//:
//: A case's chance of being solved is the local policing capacity
//: (public_safety capacity per resident, scaled by its condition)
//: against how hard the case is. Violent crimes with a named victim
//: are easier than property crimes with none — which is both true of
//: real clearance rates and mechanically the right shape here, since a
//: victim is a witness this engine actually has.
const BASE_CLEARANCE = 0.35;
const CAPACITY_PER_RESIDENT_AT_FULL = 0.02;   // 1 unit of capacity per 50 residents
const VICTIM_BONUS = 0.2;

//: How far one case moves an area's trust. Small on purpose: trust is
//: the accumulation of many outcomes, and a single cleared burglary
//: should not swing a neighbourhood.
const TRUST_PER_CLEARED = 0.6;
const TRUST_PER_UNCLEARED = -0.9;

//: An investigation happens once, on a case this old. Not the tick the
//: crime happened: a case solved the instant it is committed is not an
//: investigation, and the delay is what makes the backlog visible.
const INVESTIGATION_DELAY_TICKS = 7;

// -- capacity -----------------------------------------------------------

// A city's policing capacity per resident, 0..1, scaled by the
// condition of the public_safety infrastructure providing it.
//
// **Null when there is no public safety infrastructure at all**, which
// is different from a capacity of zero and is the distinction every
// statistic in this project has had to make at least once. A world
// that has never built a police station is not a world with an
// overwhelmed one.
function policingCapacity(worldState, cityId, residents) {
  if (cityId === null || cityId === undefined) return null;
  const rows = infrastructure.infrastructureIn(worldState, cityId, 'public_safety');
  if (rows.length === 0) return null;

  const capacity = infrastructure.capacityOf(worldState, cityId, 'public_safety');
  if (capacity === null) return null;
  if (residents === 0) return null;

  // Condition-weighted: a station at 40 condition provides 40% of what
  // it would at 100. Reads the same rows the capacity came from, so a
  // decaying city loses clearance without a second mechanism.
  const meanCondition = rows
    .map((r) => Number(r.condition))
    .filter((c) => Number.isFinite(c))
    .reduce((a, b, _, arr) => a + b / arr.length, 0);

  const perResident = (capacity / residents) * (meanCondition / 100);
  return Math.max(0, Math.min(1, perResident / CAPACITY_PER_RESIDENT_AT_FULL));
}

//: How much an offender's own skill at not being caught moves the
//: chance of clearance. At 0.5, somebody at 100 across the `criminal`
//: family HALVES it and somebody at 0 raises it by half.
//:
//: **Centred on the average offender, not on zero.** The first version
//: multiplied by `1 - evasion * WEIGHT`, so an ordinary criminal was
//: 25% harder to catch than before and the whole world's clearance rate
//: dropped for no reason anybody had decided on. A trait modifier
//: spreads a population out; it does not get to recalibrate the system
//: it reads into. `mortality.hardinessFactor` centres the same way and
//: for the same reason.
const EVASION_WEIGHT = 0.5;

// How hard this offender is to catch, 0..1, where 0.5 is ordinary.
//
// **This is the one place `criminal` traits belong, and the
// distinction is deliberate.** `crime.js` reads no trait at all and a
// test enforces it, because §9 forbids demographics determining an
// NPC's criminality — a generator keyed to who somebody IS rather than
// what they are living through writes exactly that model.
//
// That constraint is about **what drives somebody to offend**. It says
// nothing about how well they do it. Stealth, Deception, Black Market
// Ties and Heat Tolerance are skills at not being caught, and reading
// them here changes who gets away with it rather than who tries —
// which is the honest place for them and was the whole `criminal`
// family's only possible home.
// An unknown offender — no perpetrator recorded, or one who has left
// the world — reads as ordinary rather than as hopeless or as easy.
// Unknown is not a zero, and here a zero would make an anonymous crime
// the EASIEST kind to clear, which is exactly backwards.
function evasionOf(worldState, entityId) {
  if (entityId === null || entityId === undefined) return 0.5;
  const live = getLiveEntity(worldState, entityId);
  if (!live) return 0.5;
  const trait = (name) => {
    // `?? 50` rather than `|| 50`: a real 0 is somebody with no skill
    // at all, and `||` would upgrade them to average.
    const value = Number(live.traits?.criminal?.[name] ?? 50);
    return Number.isFinite(value) ? value : 50;
  };
  const skill = (
    trait('Stealth') + trait('Deception') + trait('Black Market Ties') + trait('Heat Tolerance')
  ) / 4;
  return Math.max(0, Math.min(1, skill / 100));
}

// The chance one case is cleared, before the seeded draw.
function clearanceChance(worldState, incident, { capacity }) {
  if (capacity === null) return 0;
  const victimBonus = incident.victim_entity_id === null ? 0 : VICTIM_BONUS;
  const base = BASE_CLEARANCE * capacity + victimBonus * capacity;
  const evasion = evasionOf(worldState, incident.perpetrator_entity_id);
  const factor = Math.max(0, 1 - (evasion - 0.5) * 2 * EVASION_WEIGHT);
  return Math.max(0, Math.min(1, base * factor));
}

// -- investigating ------------------------------------------------------

// Resolve one case. Exported so a scenario or a player action can close
// one directly, the same way `killEntity` sits beside `runMortality`.
function investigate(worldState, options = {}) {
  const { incidentId, tick = worldState.tick ?? 0 } = options;
  const incident = (worldState.crimeIncidents || []).find((i) => i.id === incidentId);
  if (!incident) throw new Error(`investigate: no crime incident ${incidentId}`);
  if (incident.investigated_tick !== null && incident.investigated_tick !== undefined) {
    throw new Error(`investigate: incident ${incidentId} has already been investigated`);
  }

  const community = worldState.communities.find((c) => c.id === incident.community_id) || null;
  const residents = worldState.npcs.filter((n) => n.communityId === incident.community_id);
  const capacity = policingCapacity(worldState, community?.city_id ?? null, residents.length);
  const chance = clearanceChance(worldState, incident, { capacity });

  const cleared = seededDraw([incident.id, tick, 'clearance']) < chance;
  incident.investigated_tick = tick;
  incident.cleared = cleared;

  // **The belief moves for the people who live there**, not for the
  // whole world — a burglary solved three cities away is not why
  // somebody trusts the police. `shiftBelief` creates the belief at
  // neutral on first contact, which is exactly right: an opinion forms
  // the first time something happens.
  const delta = cleared ? TRUST_PER_CLEARED : TRUST_PER_UNCLEARED;
  for (const resident of residents) {
    beliefs.shiftBelief(worldState, {
      entityId: resident.id,
      beliefType: TRUST_BELIEF_TYPE,
      beliefName: TRUST_BELIEF,
      delta,
      tick,
    });
  }

  return { incident, cleared, chance, capacity };
}

// Every case that has come of age, once per tick.
//
// Runs inside `runSecurityPhase` beside the crime half — the pipeline
// stays at eleven, and this is the phase whose name has covered both
// jobs since it was written.
function runPolicing(worldState, tick = worldState.tick ?? 0) {
  const events = [];
  const resolved = [];

  for (const incident of worldState.crimeIncidents || []) {
    if (incident.investigated_tick !== null && incident.investigated_tick !== undefined) continue;
    if (tick - incident.tick < INVESTIGATION_DELAY_TICKS) continue;
    // An incident with no community has no local force to investigate
    // it and no residents whose trust could move. Marked investigated
    // and uncleared rather than left pending forever, so the backlog
    // is real cases rather than unplaceable ones.
    if (incident.community_id === null || incident.community_id === undefined) {
      incident.investigated_tick = tick;
      incident.cleared = false;
      continue;
    }

    const outcome = investigate(worldState, { incidentId: incident.id, tick });
    resolved.push(outcome);

    if (outcome.cleared) {
      events.push({
        type: 'crime_cleared',
        severity: incident.severity >= crime.HISTORY_SIGNIFICANCE_FLOOR ? 'high' : 'low',
        note: `${incident.category} offence ${incident.id} was cleared`,
        tick,
        affected_entity_ids: [incident.perpetrator_entity_id, incident.victim_entity_id]
          .filter((id) => id !== null),
        global_effects: { crimeIncidentId: incident.id, crimeCategory: incident.category },
      });
    }
  }

  return { resolved, events };
}

// -- reading ------------------------------------------------------------

// Share of investigated cases that were cleared.
//
// **Over investigated cases, not over all of them.** A case committed
// yesterday has not been solved and has not been failed; counting it
// as unsolved would make every area's clearance rate a function of how
// recently it was measured.
function clearanceRate(worldState, communityId, options = {}) {
  const incidents = crime.incidentsIn(worldState, communityId, options)
    .filter((i) => i.investigated_tick !== null && i.investigated_tick !== undefined);
  if (incidents.length === 0) return null;
  return Math.round((incidents.filter((i) => i.cleared).length / incidents.length) * 10000) / 10000;
}

// Cases investigated but not cleared, and cases not yet investigated.
function caseload(worldState, communityId, options = {}) {
  const incidents = crime.incidentsIn(worldState, communityId, options);
  const investigated = incidents.filter(
    (i) => i.investigated_tick !== null && i.investigated_tick !== undefined,
  );
  return {
    total: incidents.length,
    investigated: investigated.length,
    cleared: investigated.filter((i) => i.cleared).length,
    open: incidents.length - investigated.length,
  };
}

// Patrol presence per 1,000 residents — the §9 SURVEILLANCE figure,
// read from the capacity that actually does the investigating rather
// than from a second number that could disagree with it.
function patrolsPer1k(worldState, communityId) {
  const community = worldState.communities.find((c) => c.id === communityId) || null;
  if (!community || community.city_id === null || community.city_id === undefined) return null;
  const residents = worldState.npcs.filter((n) => n.communityId === communityId).length;
  if (residents === 0) return null;
  const capacity = infrastructure.capacityOf(worldState, community.city_id, 'public_safety');
  if (capacity === null) return null;
  return Math.round((capacity / residents) * 1000 * 100) / 100;
}

// What the people who live here actually believe about public safety,
// 0..100, with 50 as no view either way.
//
// **Measured, not derived.** A formula over the clearance rate would
// be the clearance rate under a name promising something else; this
// reads `beliefs`, which every unsolved case in the area has moved.
function trustIn(worldState, communityId) {
  const residents = worldState.npcs.filter((n) => n.communityId === communityId);
  const held = residents
    .map((n) => beliefs.findBelief(worldState, n.id, TRUST_BELIEF))
    .filter(Boolean)
    .map((b) => Number(b.strength))
    .filter((v) => Number.isFinite(v));
  // Nobody holding the belief means nothing has happened here yet —
  // unknown, not neutral, and certainly not zero.
  if (held.length === 0) return null;
  return Math.round((held.reduce((a, b) => a + b, 0) / held.length) * 100) / 100;
}

module.exports = {
  TRUST_BELIEF,
  TRUST_BELIEF_TYPE,
  BASE_CLEARANCE,
  CAPACITY_PER_RESIDENT_AT_FULL,
  VICTIM_BONUS,
  EVASION_WEIGHT,
  evasionOf,
  TRUST_PER_CLEARED,
  TRUST_PER_UNCLEARED,
  INVESTIGATION_DELAY_TICKS,
  policingCapacity,
  clearanceChance,
  investigate,
  runPolicing,
  clearanceRate,
  caseload,
  patrolsPer1k,
  trustIn,
};
