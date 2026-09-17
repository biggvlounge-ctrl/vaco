// server/statecraft.js
//
// What the state spends, where it reaches, and what a city is FOR.
//
// Three of §7's forty urban systems were still `absent` with no note
// against them — the only three in the list with nothing written under
// the level at all:
//
//   20. Government Services      absent
//   35. Military / National Guard absent
//   36. Tourism                   absent
//
// All three were already documented. `server/tierTraits.js` has the
// reconciliation; the short version is that `tourism` is a CITY
// dimension in VACANCY_TRAIT_DATABASE_ATTACHMENT.md, `military`,
// `healthcare`, `education` and `security` are CIVILIZATION dimensions
// in the same list, and §49 CITY DNA names "tourism city", "military
// city" and seven more as the identities a city can have. Nothing here
// is invented; it is the two tier sheets the engine never built, given
// the readers that make them matter.
//
// ---------------------------------------------------------------------
// The design directive this implements
//
// "the govt and law is a scale of trust and areas for certain areas
// lawlessness will occur and group and small group laws some cities
// will maintain govt rule but it is not a guarantee in new world after
// reset / All based on stats and npc"
//
// `authority.js` answered the first half: the state's writ is a
// measured 0..1 per area, not a city-wide guarantee. This file is the
// consequence nobody had drawn yet — **the state only delivers where
// its writ reaches.** A lawless community's hospitals, schools and
// stations are funded in proportion to a writ near zero, so they are
// not maintained, so they decay, so `authority.reachTerm` thins
// further. That is a spiral, and it is the correct one: it is what
// "not a guarantee" means when the engine actually models it.
//
// It is not a one-way ratchet, which standing rule 13 would otherwise
// forbid. Three separate paths run the other way: `trustTerm` rises
// when policing clears cases, `gripTerm` rises when
// `resolveTerritoryControl` moves a faction from fortified to
// contested, and the garrison below is the state deliberately buying
// grip back. A city can be lost and a city can be retaken.
//
// ---------------------------------------------------------------------
// Guns and butter, without a rule that says so
//
// The four stored civilization dimensions are spending priorities on
// one budget. Delivery divides each by their own total, so raising the
// army lowers the schools with no separate rule expressing the
// tradeoff — the tradeoff is the arithmetic. `tierTraits.js` names the
// four in one place for exactly that reason.
//
// ---------------------------------------------------------------------
// What is stored and what is computed
//
//   city.dna         STORED. §49's identity. Drawn once at founding
//                    from what the city actually has, and a city does
//                    not become a different kind of city on a Tuesday.
//   city.traits      STORED, one dimension: `tourism`. A STOCK, not a
//                    rollup — see `TOURISM_ADJUST` below. Standing
//                    rule 3 forbids storing a computable rollup, and
//                    this is not one: a city that becomes safe today
//                    does not have visitors today.
//   civ.traits       STORED, four dimensions. A policy, i.e. an INPUT.
//                    Nothing in the engine moves them, and that is not
//                    the `cities.economy` failure repeating — an
//                    outcome that never moves is a dead column, an
//                    input that never moves is a setting. `setPriority`
//                    is the seam a Leader-mode dashboard would use;
//                    Leader mode is deferred in CLAUDE.md, the seam is
//                    not.
//   stability        COMPUTED, never stored. §48 says so in its own
//                    text: "Stability is dynamically calculated."
//   appeal, budget,  COMPUTED. All rollups of things already measured.
//   share, garrison

'use strict';

const tierTraits = require('./tierTraits.js');
const infrastructure = require('./infrastructure.js');
const authority = require('./authority.js');
const { seededDraw } = require('./seeded.js');

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const mean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

// ---------------------------------------------------------------------
// §49 CITY DNA
// ---------------------------------------------------------------------
//
// "Each city has a distinct identity: industrial city, tourism city,
// port city, military city, technology city, university city, finance
// city, agricultural city, culturally dominant city." Nine, verbatim
// and in the spec's own order. §49 goes on to say City DNA "modifies
// economy, migration, crime, infrastructure, resources, development,
// population, technology, culture" — nine effects it does not
// quantify.
//
// Only the effects that have something real to modify are wired.
// `appeal` is how much the identity draws visitors and `service` is
// which infrastructure type the identity keeps up beyond what the
// budget bought — both land on fields that already have readers. The
// other seven §49 effects are left unwired on purpose rather than
// given invented coefficients; `urbanSystems.js` records that as the
// reason Tourism is `partial` and not `modelled`.
const CITY_DNA = {
  industrial: { appeal: -10, service: null },
  tourism: { appeal: 30, service: null },
  port: { appeal: 5, service: 'roads' },
  military: { appeal: -5, service: 'public_safety' },
  technology: { appeal: 0, service: 'internet' },
  university: { appeal: 10, service: 'schools' },
  finance: { appeal: 5, service: null },
  agricultural: { appeal: 0, service: 'water_systems' },
  cultural: { appeal: 25, service: null },
};

const DNA_NAMES = Object.keys(CITY_DNA);

//: What a DNA's own upkeep is worth on its named system, in
//: maintenance points. **Flagged interpretive** — §49 says DNA
//: "modifies infrastructure" and gives no figure. 15 is chosen against
//: `infrastructure.MAINTENANCE_OFFSET`, which is 50: it is enough to
//: carry a system funded a little under the line over it, and not
//: enough to keep one standing that the state has abandoned.
const DNA_UPKEEP = 15;

// Draw a city's identity. Seeded on the city's POSITION in the
// generation loop, never on its id — §88, and the corollary that cost
// the infrastructure failure draw a commit.
function drawDna(seed, index) {
  const unit = seededDraw([seed, 'city-dna', index]);
  return DNA_NAMES[Math.min(DNA_NAMES.length - 1, Math.floor(unit * DNA_NAMES.length))];
}

function dnaOf(city) {
  const name = city?.dna;
  return name && CITY_DNA[name] ? name : null;
}

// ---------------------------------------------------------------------
// Tourism — a stock, not a reading
// ---------------------------------------------------------------------

// What the city offers a visitor, 0..100. Everything here is already
// measured somewhere else; this is the rollup.
//
// Null when the city cannot be read at all, which is not the same as a
// city nobody wants to visit.
function tourismAppeal(worldState, cityId) {
  const city = (worldState.cities || []).find((c) => c.id === cityId);
  if (!city) return null;

  const communities = (worldState.communities || []).filter((c) => c.city_id === cityId);
  const terms = [];

  // Safety, as the people who live there experience it. A visitor's
  // first question, and `refreshCommunityConditions` already answers
  // it per area.
  const safety = mean(communities
    .map((c) => Number(c.safety))
    .filter(Number.isFinite));
  if (safety !== null) terms.push(safety);

  // What is standing. `cityCondition` is the mean condition of the
  // city's infrastructure — the rollup `cities.infrastructure` is
  // documented to be OF.
  const condition = infrastructure.cityCondition(worldState, cityId);
  if (condition !== null) terms.push(clamp(Number(condition)));

  // Whether there is a culture here to come for. A city with no
  // culture attached is not a city with a bad culture, so it
  // contributes no term rather than a low one.
  const attached = (worldState.cultureMemberships || [])
    .filter((a) => a.tier === 'city' && a.entity_id === cityId);
  if (attached.length > 0) {
    const scores = [];
    for (const link of attached) {
      const culture = (worldState.cultures || []).find((c) => c.id === link.culture_id);
      const art = Number(culture?.traits?.art);
      const tradition = Number(culture?.traits?.tradition);
      for (const v of [art, tradition]) if (Number.isFinite(v)) scores.push(v);
    }
    const cultural = mean(scores);
    if (cultural !== null) terms.push(cultural);
  }

  if (terms.length === 0) return null;

  const dna = dnaOf(city);
  const bias = dna === null ? 0 : CITY_DNA[dna].appeal;
  return clamp(Math.round(mean(terms) + bias));
}

//: How much of the gap between a city's current tourism and its appeal
//: closes in a tick. **Flagged interpretive.** At 0.02 a city takes
//: about 35 ticks to cover half the distance and a bit over a year to
//: substantially arrive, which is the right order for a reputation:
//: slower than the safety reading that drives it, fast enough that a
//: city which cleans itself up sees visitors inside a generated world's
//: lifetime.
const TOURISM_ADJUST = 0.02;

// One tick of drift toward appeal. Returns the new value, or null when
// appeal could not be read — in which case the stock is left exactly
// where it was, because an unmeasurable appeal is not an appeal of
// zero.
function driftTourism(worldState, city) {
  const appeal = tourismAppeal(worldState, city.id);
  if (appeal === null) return null;
  if (!city.traits) city.traits = tierTraits.cityTraits();
  const current = tierTraits.traitOf(city, 'tourism');
  const from = current === null ? tierTraits.DEFAULT_VALUE : current;
  // Symmetric by construction: the same expression raises a city
  // toward a high appeal and lowers it toward a low one. Standing rule
  // 13's first clause is satisfied by the shape, not by a second
  // mechanism bolted on to undo the first.
  const next = clamp(Math.round((from + (appeal - from) * TOURISM_ADJUST) * 100) / 100);
  city.traits.tourism = next;
  return next;
}

// ---------------------------------------------------------------------
// The budget
// ---------------------------------------------------------------------

// What the state can afford, 0..100, on the same scale as the
// `funding` and `maintenance_level` columns it will be written into.
//
// The mean economy of its cities — which is now a live reading rather
// than the founding constant it was until `refreshCityConditions`
// existed. Null when no city has an economy to read.
function budgetOf(worldState) {
  const economies = (worldState.cities || [])
    .map((c) => Number(c.economy))
    .filter(Number.isFinite);
  if (economies.length === 0) return null;
  return clamp(Math.round(mean(economies)));
}

// The civilization whose budget this is. A world has one; a world may
// have none, and after a reset that is the expected state rather than
// an error — `authority.standingTerm` makes the same argument for
// governments.
function stateOf(worldState) {
  const civilizations = worldState.civilizations || [];
  return civilizations.length === 0 ? null : civilizations[0];
}

// Each priority's share of the budget, summing to 1 across the four.
// Null when there is no state, or when the state has recorded no
// priorities at all.
//
// An all-zero sheet is a state that has decided to spend on nothing,
// and it returns zero shares rather than dividing by zero.
function sharesOf(civilization) {
  if (!civilization) return null;
  const names = [...tierTraits.SERVICE_FAMILIES, tierTraits.FORCE_FAMILY];
  const values = {};
  let total = 0;
  for (const name of names) {
    const v = tierTraits.traitOf(civilization, name);
    if (v === null) return null;
    values[name] = v;
    total += v;
  }
  const shares = {};
  for (const name of names) shares[name] = total === 0 ? 0 : values[name] / total;
  return shares;
}

// Which infrastructure type each service priority pays for. The
// mapping is the whole reason these three dimensions and not others
// are stored: each one lands on a type the schema already enumerates
// and something already reads.
//
//   healthcare -> hospitals      (health statistics, hospital distance)
//   education  -> schools        (service level, demographics)
//   security   -> public_safety  (authority.reachTerm, patrol distance)
const SERVICE_INFRASTRUCTURE = {
  healthcare: 'hospitals',
  education: 'schools',
  security: 'public_safety',
};

// Four claimants, so an even split is a quarter each. Multiplying by
// the number of claimants puts an even split at the state's full
// means, which is what makes `budget` readable as "what this state can
// afford per service" rather than "a quarter of what it can afford".
const CLAIMANTS = tierTraits.SERVICE_FAMILIES.length + 1;

// The mean writ across a city's communities, 0..1, or null where none
// of them could be read. This is the gate: the state delivers where it
// governs.
function cityWrit(worldState, cityId, writMap = null) {
  const communities = (worldState.communities || []).filter((c) => c.city_id === cityId);
  const values = [];
  for (const community of communities) {
    const reading = writMap ? writMap.get(community.id) : authority.writOf(worldState, community.id);
    if (reading && reading.writ !== null && reading.writ !== undefined) values.push(reading.writ);
  }
  return values.length === 0 ? null : mean(values);
}

// What one city's services are funded at this cycle.
//
// Returns `{ writ, budget, funding: { healthcare, education, security } }`,
// or null when there is nothing to compute from. Pure — writes nothing.
function fundingFor(worldState, cityId, options = {}) {
  const civilization = options.civilization === undefined
    ? stateOf(worldState) : options.civilization;
  const shares = sharesOf(civilization);
  if (shares === null) return null;

  const budget = options.budget === undefined ? budgetOf(worldState) : options.budget;
  if (budget === null) return null;

  // **An unmeasurable writ is not a writ of zero.** A world with no
  // policing, no factions and no opinion yet is unobserved, not
  // ungoverned — `authority.writOf` returns null for exactly that
  // case and says so. Treating it as zero would defund every service
  // in every fresh world the moment this file was added, which is
  // standing rule 12's first clause.
  const writ = cityWrit(worldState, cityId, options.writMap ?? null);
  const gate = writ === null ? 1 : writ;

  const funding = {};
  for (const service of tierTraits.SERVICE_FAMILIES) {
    funding[service] = clamp(Math.round(budget * shares[service] * CLAIMANTS * gate));
  }
  return { writ, budget, funding, shares };
}

// ---------------------------------------------------------------------
// The garrison
// ---------------------------------------------------------------------

// The state's force projection in one city, 0..1. Zero when the state
// spends nothing on soldiers, when there is no state at all, and when
// there is no budget to read — the centring standing rule 12's first
// clause demands. `authority.gripTerm` folds this in as
// `1 - held * (1 - garrison)`, so at garrison 0 the term is
// bit-identical to what it was before this file existed, and there is
// a test that says so.
//
// Not gated on writ. The army is what the state sends where its writ
// does NOT reach; gating it on writ would make it useless exactly
// where it is for.
function garrisonOf(worldState, cityId, options = {}) {
  const civilization = options.civilization === undefined
    ? stateOf(worldState) : options.civilization;
  const shares = sharesOf(civilization);
  if (shares === null) return 0;
  const budget = options.budget === undefined ? budgetOf(worldState) : options.budget;
  if (budget === null) return 0;
  if (!(worldState.cities || []).some((c) => c.id === cityId)) return 0;
  return clamp01((budget / 100) * shares[tierTraits.FORCE_FAMILY]);
}

// Same reading, keyed by community, for `authority.gripTerm` to use
// without knowing about cities.
function garrisonIn(worldState, communityId, options = {}) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community || community.city_id === null || community.city_id === undefined) return 0;
  return garrisonOf(worldState, community.city_id, options);
}

// ---------------------------------------------------------------------
// §48 NEIGHBORHOOD STABILITY
// ---------------------------------------------------------------------
//
// "0-30 = COLLAPSING · 30-50 = STRUGGLING · 50-70 = STABLE ·
//  70-85 = THRIVING · 85-100 = ELITE. Stability is dynamically
// calculated."
//
// The bands are the spec's, to the number. The calculation is not
// given, so it is composed from readings that already exist rather
// than from new coefficients: how well the area is doing
// (`getCommunityHealth`) and whether anyone is in charge of it
// (`authority.writOf`). Nothing else is added, because anything else
// would be a number chosen here and dressed as §48's.
const STABILITY_BANDS = [
  { floor: 85, name: 'ELITE' },
  { floor: 70, name: 'THRIVING' },
  { floor: 50, name: 'STABLE' },
  { floor: 30, name: 'STRUGGLING' },
  { floor: 0, name: 'COLLAPSING' },
];

function stabilityBand(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return STABILITY_BANDS.find((b) => n >= b.floor)?.name ?? null;
}

function communityStability(worldState, communityId, writMap = null) {
  const territory = require('./territory.js');
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;

  const terms = [];
  const health = territory.getCommunityHealth(community);
  if (health !== null && health !== undefined && Number.isFinite(Number(health))) {
    terms.push(Number(health));
  }
  const reading = writMap ? writMap.get(communityId) : authority.writOf(worldState, communityId);
  if (reading && reading.writ !== null && reading.writ !== undefined) {
    terms.push(reading.writ * 100);
  }
  if (terms.length === 0) return null;
  return clamp(Math.round(mean(terms)));
}

function cityStability(worldState, cityId, writMap = null) {
  const values = (worldState.communities || [])
    .filter((c) => c.city_id === cityId)
    .map((c) => communityStability(worldState, c.id, writMap))
    .filter((v) => v !== null);
  return values.length === 0 ? null : clamp(Math.round(mean(values)));
}

// ---------------------------------------------------------------------
// Schooling — what education funding actually buys
// ---------------------------------------------------------------------
//
// **`infrastructure.js` declared this gap in its own words** and it is
// the reason `schools` is the one service type with no outage effect:
//
//   "schools — **declared.** Education is `partial` and there is no
//    per-tick education mechanism for an outage to interrupt —
//    `npcs.education` is set at generation and never moves."
//
// So a funded school was a number on a row, and attainment was a fact
// decided at birth. `demographics.EDUCATION_LEVELS` is a six-rung
// ladder nobody ever climbed.
//
// This is the reader that makes CIVILIZATION `education` mean
// something, and it is also the distinction `tierTraits.js` draws
// between the two education dimensions doing real work: the
// civilization's number is PROVISION, `communities.education` is
// ATTAINMENT, and this function is the only thing that turns one into
// the other.
//
// ---------------------------------------------------------------------
// Centred at zero, with a real inverse
//
// Zero funding is zero probability, exactly — so a world whose state
// spends nothing on schools behaves as it did before this function
// existed. Standing rule 12's first clause.
//
// And it is not a ratchet, which standing rule 13 would otherwise
// catch: attainment only climbs, but the POPULATION's attainment falls
// on its own, because `births.js` puts new people on the bottom rung
// and `mortality.js` takes the educated off the top. A city that stops
// schooling does not un-teach anybody; it watches its mean fall as its
// people are replaced. That is the correct inverse and it already
// existed.

//: A student advances a rung every four years at full funding.
//: **Flagged interpretive** — no document sets a pace — and chosen
//: against `demographics.EDUCATION_LEVELS`, which is six rungs: four
//: years a rung puts a fully funded run from `none` to `advanced` at
//: twenty years, which is a life spent in school and therefore the
//: right upper bound for a rate nobody will ever actually sustain.
const SCHOOL_YEARS_PER_LEVEL = 4;
const TICKS_PER_YEAR = 365;

//: Who is at school. **Flagged interpretive**, and deliberately wider
//: than a childhood: `advanced` is four rungs above `secondary` and a
//: 5-to-18 window would make the top of the ladder unreachable for
//: everyone, which is standing rule 14's shape — a rung whose only
//: route to it closes before anybody gets there.
const SCHOOL_AGE_MIN = 5;
const SCHOOL_AGE_MAX = 30;

// One tick of school. Returns the people who moved up a rung.
function runSchooling(worldState, tick) {
  const demographics = require('./demographics.js');
  const mortality = require('./mortality.js');

  const levels = demographics.EDUCATION_LEVELS;
  const top = levels.length - 1;

  // **Read off the rows, not recomputed from the budget.** The budget
  // pass writes `funding` onto each city's `schools` rows once a
  // quarter and that column IS the record of what was delivered;
  // asking `fundingFor` again here would walk every community's writ
  // on every tick to re-derive a number already sitting on the row.
  // It would also be the wrong number — what a school has is what it
  // was given last quarter, not what the state could afford today.
  const byCity = new Map();
  for (const city of worldState.cities || []) {
    const rows = infrastructure.infrastructureIn(worldState, city.id, 'schools');
    const funded = rows
      .filter((row) => row.funding !== null && row.funding !== undefined)
      .map((row) => Number(row.funding))
      .filter(Number.isFinite);
    byCity.set(city.id, {
      funding: funded.length === 0 ? null : mean(funded),
      // **A school that is not running teaches nobody.** This is the
      // outage effect `infrastructure.js` said it could not write,
      // arriving from the other side: the mechanism now exists, so the
      // interruption is expressible. A city with no schools at all has
      // no provision, whatever the state has budgeted for one.
      open: rows.length > 0 && rows.some((row) => !infrastructure.isFailed(row)),
    });
  }

  const cityOf = new Map();
  for (const community of worldState.communities || []) {
    cityOf.set(community.id, community.city_id);
  }

  const advanced = [];
  for (const npc of worldState.npcs || []) {
    const cityId = cityOf.get(npc.communityId);
    if (cityId === null || cityId === undefined) continue;
    const provision = byCity.get(cityId);
    if (!provision || !provision.open || provision.funding === null) continue;
    if (provision.funding <= 0) continue;

    const at = levels.indexOf(npc.education);
    // **`indexOf` is -1 for a person whose education nobody recorded,
    // and -1 is not rung zero.** An unknown attainment is unknown;
    // starting them at `none` would invent a fact about them.
    if (at < 0 || at >= top) continue;

    const age = mortality.ageInYears(worldState, npc, tick);
    if (age === null || age < SCHOOL_AGE_MIN || age > SCHOOL_AGE_MAX) continue;

    const chance = (provision.funding / 100) / (SCHOOL_YEARS_PER_LEVEL * TICKS_PER_YEAR);
    // Seeded on the person and the tick — reproducible under §88, and
    // on identity here rather than position because a person IS the
    // subject of this draw, not an item in a generation loop.
    if (seededDraw([worldState.seed ?? 'world', 'school', npc.id, tick]) >= chance) continue;

    npc.education = levels[at + 1];
    advanced.push({ entityId: npc.id, from: levels[at], to: npc.education, cityId });
  }
  return advanced;
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

//: A budget is periodic, not continuous — a state sets funding for a
//: period and lives with it. 90 ticks is a quarter, and a tick is a
//: day (`behavior.TICK_INTERVALS`).
//:
//: **Chosen by measuring, not by what the number sounds like.** The
//: obvious value was 365, matching `politics.LEGISLATION_INTERVAL_TICKS`
//: — and `scripts/measure-world.mjs` runs 200 ticks, so an annual
//: budget would have fired zero times in every world anyone ever
//: measured. That is standing rule 14's shape: a mechanism whose only
//: trigger sits outside the window it will be observed in.
const BUDGET_INTERVAL_TICKS = 90;

function isBudgetDay(tick) {
  return Number.isFinite(tick) && tick > 0 && tick % BUDGET_INTERVAL_TICKS === 0;
}

// Write this cycle's funding onto a city's service infrastructure.
//
// `funding` and `maintenance_level` both move, and they move together
// because one pays for the other. Both columns already have readers:
// `repairTicks` reads funding, and `effectiveMaintenance` reads
// maintenance_level against `MAINTENANCE_OFFSET` — above which decay
// is arrested. **That is the inverse `infrastructure.js` was missing.**
// When utilities were built, repair was made to restore service and
// deliberately not condition, because any condition gain coupled to
// the failure rate produced a ratchet the other way. Maintenance is
// the honest inverse: it does not hand condition back, it stops the
// bleeding, and only for as long as it is paid for.
function deliverTo(worldState, city, plan) {
  const touched = [];
  const dna = dnaOf(city);
  const dnaService = dna === null ? null : CITY_DNA[dna].service;

  // What this city's identity keeps its own system up to — §49's "City
  // DNA modifies ... infrastructure".
  //
  // **Built from the plan, never from the row's current value.** The
  // first version read `row.maintenance_level` and added the upkeep to
  // it, which re-adds the previous quarter's upkeep every quarter: a
  // port's roads climbed 15 points every ninety days and pinned at 100
  // inside two years. That is the fifth one-way ratchet this project
  // has found, and the first one caught before it shipped. A delivery
  // pass has to be IDEMPOTENT — running it twice on an unchanged world
  // must leave the world unchanged — and a baseline taken from the
  // thing being written can never be.
  const services = tierTraits.SERVICE_FAMILIES.map((name) => plan.funding[name]);
  const baseline = services.length === 0
    ? 0
    : services.reduce((a, b) => a + b, 0) / services.length;
  const dnaLevel = clamp(Math.round(baseline + DNA_UPKEEP));

  for (const row of infrastructure.infrastructureIn(worldState, city.id)) {
    const service = Object.keys(SERVICE_INFRASTRUCTURE)
      .find((name) => SERVICE_INFRASTRUCTURE[name] === row.type);

    // The identity wins where it applies — a university city's schools
    // are kept up whatever the ministry sent, and a port's roads are
    // kept up although no service priority covers roads at all.
    let level = null;
    if (dnaService === row.type) level = dnaLevel;
    else if (service) level = plan.funding[service];
    if (level === null) continue;

    row.funding = level;
    row.maintenance_level = level;
    touched.push(row);
  }
  return touched;
}

// One tick of statecraft. Runs inside `runOrganizationPhase` — a
// budget is a government act and a government is an organization
// (standing rule 4), and the pipeline is locked at eleven phases.
//
// Returns the events the tick should consider.
function runStatecraft(worldState, tick) {
  const events = [];

  // Tourism drifts every tick; the budget is set quarterly. Both read
  // the city conditions `territory.refreshCityConditions` wrote, which
  // is why this runs after it in the phase.
  for (const city of worldState.cities || []) driftTourism(worldState, city);

  // School runs every day, on last quarter's money.
  const advanced = runSchooling(worldState, tick);
  for (const step of advanced) {
    // **A crossing, and only the one that matters.** Every rung is a
    // crossing, but a log line per rung per person would bury the tick
    // it happened on under a hundred identical ones — standing rule 7.
    // Only the top of the ladder is recorded, because reaching it is
    // rare and is the fact a city's history would actually keep.
    if (step.to !== 'advanced') continue;
    events.push({
      type: 'education_completed',
      severity: 'low',
      note: `Entity ${step.entityId} reached the top of the education ladder`,
      tick,
      affected_entity_ids: [step.entityId],
      global_effects: { cityId: step.cityId, from: step.from, to: step.to },
    });
  }

  if (!isBudgetDay(tick)) return events;

  const civilization = stateOf(worldState);
  const budget = budgetOf(worldState);
  if (!civilization || budget === null) return events;

  const writMap = authority.writByCommunity(worldState);

  for (const city of worldState.cities || []) {
    const plan = fundingFor(worldState, city.id, { civilization, budget, writMap });
    if (plan === null) continue;

    const before = infrastructure.infrastructureIn(worldState, city.id)
      .filter((r) => Object.values(SERVICE_INFRASTRUCTURE).includes(r.type))
      .map((r) => Number(r.maintenance_level) || 0);
    deliverTo(worldState, city, plan);
    const after = infrastructure.infrastructureIn(worldState, city.id)
      .filter((r) => Object.values(SERVICE_INFRASTRUCTURE).includes(r.type))
      .map((r) => Number(r.maintenance_level) || 0);

    const wasAbove = before.filter((v) => v >= infrastructure.MAINTENANCE_OFFSET).length;
    const nowAbove = after.filter((v) => v >= infrastructure.MAINTENANCE_OFFSET).length;

    // **A crossing, not a condition** — standing rule 7. The budget
    // being low is true every day; the day a city's services fall
    // below the line where maintenance arrests decay is one day.
    if (nowAbove < wasAbove) {
      events.push({
        type: 'services_withdrawn',
        severity: plan.writ !== null && plan.writ < authority.CONTESTED_FLOOR ? 'high' : 'moderate',
        note: `${city.name}: ${wasAbove - nowAbove} public service(s) fell below the `
          + `maintenance line (writ ${plan.writ === null ? 'unmeasured' : plan.writ.toFixed(2)})`,
        tick,
        affected_entity_ids: [],
        global_effects: { cityId: city.id, writ: plan.writ, budget, funding: plan.funding },
      });
    } else if (nowAbove > wasAbove) {
      events.push({
        type: 'services_restored',
        severity: 'low',
        note: `${city.name}: ${nowAbove - wasAbove} public service(s) funded back above the `
          + 'maintenance line',
        tick,
        affected_entity_ids: [],
        global_effects: { cityId: city.id, writ: plan.writ, budget, funding: plan.funding },
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------
// Setting the policy
// ---------------------------------------------------------------------

// The seam. Leader mode is deferred; a government changing its mind
// about what to spend on is not a Leader-mode feature, it is the only
// way these four numbers ever move.
function setPriority(worldState, options = {}) {
  const { name, value } = options;
  const civilization = options.civilizationId === undefined
    ? stateOf(worldState)
    : (worldState.civilizations || []).find((c) => c.id === options.civilizationId);
  if (!civilization) throw new Error('setPriority: this world has no civilization.');

  const names = [...tierTraits.SERVICE_FAMILIES, tierTraits.FORCE_FAMILY];
  if (!names.includes(name)) {
    throw new Error(`setPriority: "${name}" is not a spending priority (one of: ${names.join(', ')}).`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('setPriority requires a finite value 0-100.');

  if (!civilization.traits) civilization.traits = tierTraits.civilizationTraits();
  civilization.traits[name] = clamp(n);
  return civilization.traits;
}

// ---------------------------------------------------------------------
// Description — what the API hands back
// ---------------------------------------------------------------------

function describeStatecraft(worldState, cityId) {
  const city = (worldState.cities || []).find((c) => c.id === Number(cityId));
  if (!city) return null;
  const plan = fundingFor(worldState, city.id);
  return {
    cityId: city.id,
    name: city.name,
    dna: dnaOf(city),
    tourism: tierTraits.traitOf(city, 'tourism'),
    tourismAppeal: tourismAppeal(worldState, city.id),
    stability: cityStability(worldState, city.id),
    stabilityBand: stabilityBand(cityStability(worldState, city.id)),
    garrison: garrisonOf(worldState, city.id),
    writ: plan === null ? null : plan.writ,
    budget: plan === null ? budgetOf(worldState) : plan.budget,
    funding: plan === null ? null : plan.funding,
    priorities: stateOf(worldState)?.traits ?? null,
  };
}

module.exports = {
  CITY_DNA,
  DNA_NAMES,
  DNA_UPKEEP,
  SERVICE_INFRASTRUCTURE,
  STABILITY_BANDS,
  BUDGET_INTERVAL_TICKS,
  TOURISM_ADJUST,
  CLAIMANTS,
  drawDna,
  dnaOf,
  tourismAppeal,
  driftTourism,
  budgetOf,
  stateOf,
  sharesOf,
  cityWrit,
  fundingFor,
  garrisonOf,
  garrisonIn,
  stabilityBand,
  communityStability,
  cityStability,
  isBudgetDay,
  deliverTo,
  SCHOOL_YEARS_PER_LEVEL,
  SCHOOL_AGE_MIN,
  SCHOOL_AGE_MAX,
  runSchooling,
  runStatecraft,
  setPriority,
  describeStatecraft,
};
