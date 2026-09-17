// server/authority.js
//
// How far the state's rule actually reaches, area by area.
//
// **The correction this is built to.** `server/justice.js` shipped with
// law as a city-wide absolute: if the city had a property statute,
// every thief in every block was charged, tried and convicted. The
// owner's reading is different and better —
//
//   "the govt and law is a scale of trust and areas for certain areas
//    lawlessness will occur and group and small group laws some cities
//    will maintain govt rule but it is not a guarantee in new world
//    after reset. All based on stats and npc"
//
// — and it is the correct model for this setting. After a collapse, a
// government's writ is not a property of the map. It is something that
// holds in some places, thins in others, and fails entirely in the
// ones nobody is watching. A city may keep order; that is an outcome,
// not a starting condition.
//
// So this file computes ONE number per area: how far the state's rule
// reaches there, 0..1. Everything about lawlessness follows from it,
// and nothing in it is invented — every term is a measured reading that
// something else in the engine already writes.
//
// ---------------------------------------------------------------------
// The four terms, and why each one is a fact rather than a flavour
//
//   trust        `policing.trustIn` — the belief the people who live
//                there hold about their police, formed from what has
//                actually happened to them. A state whose own residents
//                do not believe in it does not govern them.
//   reach        `infrastructure.serviceLevel(public_safety)` scaled by
//                the condition that infrastructure is in AND by how far
//                this community is from the nearest station. Capacity
//                that has rotted is not capacity, and a station on the
//                other side of the city is not a station on this
//                street.
//   grip         The control score of whatever faction holds the blocks
//                in this area, INVERTED. `territory.resolveTerritoryControl`
//                already rates a faction's hold from its live
//                `organization.territory` and `organization.power`, and
//                a block a gang holds fortified is a block the state
//                does not.
//   standing     The government's approval, from `public_opinion`,
//                which `politics.snapshotPublicOpinion` writes every
//                tick from what people actually know about it.
//
// **The first three are AVERAGED; standing MULTIPLIES, and that is a
// correction rather than a flourish.** Standing is world-scoped — one
// government, one approval, the same number for every area — and
// averaging a constant into a per-area reading cannot distinguish
// anywhere from anywhere else; all it does is pull the whole range
// toward the constant. Measured with it as a fourth term: six areas
// spanning 0.525 to 0.621, every one of them `contested`, with two of
// the three bands unreachable. That is the same defect as a dead term
// in `crime.frictionTarget` and the same fix — a term that is not about
// this place scales what is.
//
// And it is what approval MEANS. A government nobody backs has a weak
// writ everywhere it reaches; one people believe in presses further
// with the same police. It does not make one street different from the
// next.
//
// **Every one of them can be unknown, and unknown is not zero.** An
// area nobody has policed has no trust reading; a world with no
// government has no approval. A term with no reading is dropped from
// the average rather than counted as a failure of the state, because
// "nobody has measured this" and "the state has failed here" are
// different facts and this whole file exists to tell them apart.
//
// ---------------------------------------------------------------------
// Measured, and what the measurement says is still missing
//
// All three bands are reachable and `test/authority.test.js` holds each
// one: a trusted, well-policed, gang-free area reads `governed`; an
// ordinary one `contested`; a gang-held, distrusted area with rotted
// policing reads `lawless`.
//
// **What a DEFAULT generated world reads is `governed` or `contested`,
// and not yet `lawless` anywhere.** Measured on a 240-person, 600-tick
// world: eight communities, writ 0.77 to 0.94, every one governed. On a
// smaller one: six communities, 0.55 to 0.66, every one contested — and
// there the state prosecuted violence and let every theft go, which is
// the model doing exactly what it is for.
//
// The reason was worth writing down rather than tuning away, and it has
// since been fixed. **Two of the three local terms were not really
// local.** `trust` moves on clearances, which are rare, so it sits near
// its neutral 50 everywhere. And `reach` was city-scoped —
// `serviceLevel` is capacity per resident for a whole CITY and caps at
// 1, so every block in a city with a working station read fully
// policed. That left `grip` as the only term that distinguished one
// street from the next.
//
// The missing term was distance: how far this block is from the
// station, which is what actually makes one neighbourhood policed and
// the next one not. `server/geo.js` is that — the format, the resolver
// and haversine metres — and `reachTerm` reads it now. A community 700
// metres from a station and one 9 kilometres away in the same city no
// longer report the same policing.
//
// `trust` is still flat, and that is a fact about how rarely crime
// happens rather than about this file.
//
// ---------------------------------------------------------------------
// What this is NOT
//
// It is not a second police model, a second crime model, or a second
// government. It reads four numbers other modules own and combines
// them. If it ever starts deciding something one of those modules
// should decide, it has grown into a duplicate and should be cut back.

'use strict';

const policing = require('./policing.js');
const infrastructure = require('./infrastructure.js');
const politics = require('./politics.js');
const geo = require('./geo.js');
const { getLiveEntity } = require('./entityTraits.js');

// ---------------------------------------------------------------------
// The bands
// ---------------------------------------------------------------------

//: Where the writ stops being government and starts being something
//: else. **Flagged interpretive** — no document sets them — and stated
//: for what they mean rather than for where they sit:
//:
//:   governed    the state's rule runs. Offences are charged, tried and
//:               sentenced.
//:   contested   it reaches, and not reliably. The state answers what it
//:               cannot ignore and lets the rest go.
//:   lawless     it does not reach. The state brings no case at all,
//:               and whoever does hold the ground answers offences on
//:               their own terms — or nobody does.
//:
//: Two thirds and one third of the way up a 0..1 scale, which is the
//: least arbitrary split available for three bands and is the reason
//: no third number is invented to justify a fourth.
const GOVERNED_FLOOR = 0.66;
const CONTESTED_FLOOR = 0.33;

const REGIMES = ['governed', 'contested', 'lawless'];

//: In a CONTESTED area the state answers what it cannot ignore. That
//: line is `crime.SEVERITY`, which already rates every category — so
//: this is a threshold on an existing scale rather than a second
//: opinion about which crimes are serious. 50 puts violence, guns,
//: domestic incidents and sex offences above it and theft, property
//: and drug offences below.
const CONTESTED_SEVERITY_FLOOR = 50;

// ---------------------------------------------------------------------
// The terms
// ---------------------------------------------------------------------

// How much of the state's police the people here believe in, 0..1, or
// null where nobody holds the belief yet.
function trustTerm(worldState, communityId) {
  const trust = policing.trustIn(worldState, communityId);
  return trust === null ? null : Math.max(0, Math.min(1, trust / 100));
}

// How much policing actually reaches here, 0..1, or null where the city
// has none or states no capacity.
//
// **Capacity times condition.** `infrastructure.serviceLevel` answers
// how much public safety a city has per resident; a station that has
// rotted to 20 condition is not the station that was built. Both halves
// are already computed by `infrastructure.js` and neither was ever read
// together.
function reachTerm(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community || community.city_id === null || community.city_id === undefined) return null;

  const residents = (worldState.npcs || []).filter((n) => n.communityId === communityId).length;
  if (residents === 0) return null;

  const level = infrastructure.serviceLevel(
    worldState, community.city_id, 'public_safety', residents,
  );
  if (level === null) return null;

  const rows = infrastructure.infrastructureIn(worldState, community.city_id)
    .filter((row) => row.type === 'public_safety');
  const conditions = rows.map((row) => Number(row.condition)).filter(Number.isFinite);
  const condition = conditions.length === 0
    ? 1
    : Math.max(0, Math.min(1, conditions.reduce((a, b) => a + b, 0) / conditions.length / 100));

  return Math.max(0, Math.min(1, level * condition * proximity(worldState, communityId)));
}

//: How far a station can be before this street stops being policed by
//: it. **Flagged interpretive** — no document sets a patrol radius —
//: and chosen against the scale a generated world actually has:
//: communities scatter within `geo.COMMUNITY_SPREAD_M` (6 km) of their
//: city, so measured distances to the nearest station run from a few
//: hundred metres to about ten kilometres. A 5 km half-distance puts
//: the near end of that range close to fully policed and the far end at
//: about a third, which is a difference the writ can act on rather than
//: a rounding error.
const PATROL_HALF_DISTANCE_M = 5000;

// How much being HERE rather than at the station is worth, 0..1.
//
// **1 when there is no geography to read, not 0.** An unplaced world —
// every world this engine generated before `server/geo.js` — is one
// where distance is unknown, and an unknown distance is not an infinite
// one. Scoring it 0 would have made every area in every unplaced world
// lawless the day this function was written, which is standing rule
// 12's first clause: a modifier centred wrong recalibrates the world.
function proximity(worldState, communityId) {
  const nearest = geo.nearestInfrastructure(worldState, communityId, 'public_safety');
  if (nearest === null) return 1;
  // A hyperbolic falloff rather than a linear one: halving at the half
  // distance and never reaching zero, because a distant station is
  // worse than a near one and is not the same as no station.
  return PATROL_HALF_DISTANCE_M / (PATROL_HALF_DISTANCE_M + nearest.metres);
}

// How much of this ground somebody else holds, 0..1. Returns the
// state's remaining share, so 1 is nobody else's and 0 is entirely
// somebody else's.
//
// Null where no faction holds a block here at all — which is not the
// same as a faction holding it weakly, and the difference matters:
// the first is the state unopposed, the second is the state winning.
function gripTerm(worldState, communityId) {
  const blocks = (worldState.territoryBlocks || [])
    .filter((b) => b.community_id === communityId);
  if (blocks.length === 0) return null;

  const holds = [];
  for (const block of blocks) {
    const live = getLiveEntity(worldState, block.faction_id);
    if (!live) continue;
    const strength = Number(live.traits?.organization?.territory);
    const power = Number(live.traits?.organization?.power);
    const scores = [strength, power].filter(Number.isFinite);
    if (scores.length === 0) continue;
    // `fortified` is a faction that has dug in; `contested` is one
    // losing its hold. The status is `resolveTerritoryControl`'s own
    // reading of the same two traits, used here as the multiplier on
    // them rather than as a second opinion about them.
    const weight = block.status === 'fortified' ? 1 : (block.status === 'contested' ? 0.5 : 0.8);
    holds.push((scores.reduce((a, b) => a + b, 0) / scores.length / 100) * weight);
  }
  if (holds.length === 0) return null;
  const held = Math.max(0, Math.min(1, holds.reduce((a, b) => a + b, 0) / holds.length));

  // **What the state has put on the ground here.** §7's system 35,
  // Military / National Guard, and `military` is a CIVILIZATION
  // dimension in VACANCY_TRAIT_DATABASE_ATTACHMENT.md — see
  // server/tierTraits.js. A garrison does not make the people trust
  // the police or put a station on the corner, so it touches neither
  // `trustTerm` nor `reachTerm`; what it does is contest somebody
  // else's hold on the ground, which is this term and only this term.
  //
  // **Centred at zero, and provably.** `garrisonIn` returns 0 when the
  // state spends nothing on soldiers, when there is no state, and when
  // there is no budget to read — and in all three cases `1 - held * 1`
  // is bit-identical to what this function returned before the
  // military existed. That is standing rule 12's first clause: the
  // term spreads worlds apart by what they spend, it does not move the
  // baseline underneath worlds that spend nothing. Held by a test that
  // builds the same world twice and zeroes the priority in one.
  //
  // Required at call time rather than at module scope: statecraft
  // reads authority for its writ gate, and authority reads statecraft
  // for this. A cycle at require time resolves to a half-built module;
  // a cycle at call time resolves to a finished one.
  const statecraft = require('./statecraft.js');
  const garrison = Math.max(0, Math.min(1, statecraft.garrisonIn(worldState, communityId)));
  return 1 - held * (1 - garrison);
}

// What the city thinks of its government, 0..1, or null where there is
// no government or nobody has an opinion yet.
//
// **A world can have no government at all**, and after a reset that is
// the expected state rather than an error. `worldgen` founds one; a
// scenario need not.
function standingTerm(worldState) {
  const governments = worldState.governments || [];
  if (governments.length === 0) return null;

  const scores = [];
  for (const government of governments) {
    const latest = politics.latestOpinion(
      worldState, politics.topicForGovernment(government.organization_id),
    );
    const approval = Number(latest?.approval_score);
    if (Number.isFinite(approval)) scores.push(Math.max(0, Math.min(1, approval / 100)));
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ---------------------------------------------------------------------
// The reading
// ---------------------------------------------------------------------

// How far the state's rule reaches in one area, with its workings.
//
// Returns `{ writ, regime, terms, measured }`. `writ` is null when NONE
// of the four could be measured — a place the engine knows nothing
// about is not lawless, it is unobserved, and a caller that treated the
// two the same would declare every fresh world ungoverned.
function writOf(worldState, communityId) {
  const terms = {
    trust: trustTerm(worldState, communityId),
    reach: reachTerm(worldState, communityId),
    grip: gripTerm(worldState, communityId),
    standing: standingTerm(worldState),
  };

  // The three that are about THIS place.
  const local = ['trust', 'reach', 'grip']
    .map((name) => [name, terms[name]])
    .filter(([, v]) => v !== null);

  const measured = Object.entries(terms).filter(([, v]) => v !== null);
  if (local.length === 0) {
    return { writ: null, regime: null, terms, measured: measured.map(([n]) => n) };
  }

  const here = local.reduce((sum, [, v]) => sum + v, 0) / local.length;
  // Standing scales it. Centred so an average government changes
  // nothing: at approval 50 the multiplier is 1, at 0 it is 0.5, at 100
  // it is 1.5. Un-centred it would move every area the day approval
  // started being read, which is the twelfth standing rule's first
  // clause.
  const scale = terms.standing === null ? 1 : 0.5 + terms.standing;
  const writ = Math.round(Math.max(0, Math.min(1, here * scale)) * 10000) / 10000;

  return {
    writ,
    regime: regimeFor(writ),
    terms,
    measured: measured.map(([name]) => name),
  };
}

function regimeFor(writ) {
  if (writ === null || writ === undefined) return null;
  if (writ >= GOVERNED_FLOOR) return 'governed';
  if (writ >= CONTESTED_FLOOR) return 'contested';
  return 'lawless';
}

// Built once for a whole pass rather than asked per person — the same
// lesson `traitDrift.indexRows` and `crime.dangerByCommunity` cost.
function writByCommunity(worldState) {
  const map = new Map();
  for (const community of worldState.communities || []) {
    map.set(community.id, writOf(worldState, community.id));
  }
  return map;
}

// Does the state prosecute this offence here?
//
// **The whole point of the file, in one function.** A governed area
// answers everything; a contested one answers what it cannot ignore;
// a lawless one answers nothing. `severityOf` is `crime.SEVERITY`, so
// which offences are serious is decided in one place.
function prosecutes(worldState, communityId, category, options = {}) {
  const crime = require('./crime.js');
  const { reading = writOf(worldState, communityId) } = options;

  // **Unobserved is not lawless.** A world nobody has policed, fought
  // over or formed an opinion in has no reading, and refusing to
  // prosecute there would make every fresh world ungoverned by default.
  if (reading.writ === null) return { prosecutes: true, regime: null, reason: 'unmeasured' };

  if (reading.regime === 'governed') {
    return { prosecutes: true, regime: 'governed', reason: 'the state rules here' };
  }
  if (reading.regime === 'lawless') {
    return {
      prosecutes: false,
      regime: 'lawless',
      reason: 'the state does not reach here',
    };
  }

  const severity = crime.SEVERITY[category] ?? 0;
  if (severity >= CONTESTED_SEVERITY_FLOOR) {
    return {
      prosecutes: true,
      regime: 'contested',
      reason: `${category} is too serious to ignore, even here`,
    };
  }
  return {
    prosecutes: false,
    regime: 'contested',
    reason: `the state here answers what it cannot ignore, and ${category} is not that`,
  };
}

// Who holds this ground when the state does not. Returns the faction's
// organization id, or null — an area with no faction and no state is
// answerable to nobody, which is a real state of affairs and not a bug.
function holderOf(worldState, communityId) {
  const blocks = (worldState.territoryBlocks || [])
    .filter((b) => b.community_id === communityId && b.status !== 'contested');
  if (blocks.length === 0) return null;

  // The strongest hold, so two factions in one area do not both count
  // as the authority there.
  let best = null;
  let bestScore = -Infinity;
  for (const block of blocks) {
    const live = getLiveEntity(worldState, block.faction_id);
    if (!live) continue;
    const scores = [
      Number(live.traits?.organization?.territory),
      Number(live.traits?.organization?.power),
    ].filter(Number.isFinite);
    if (scores.length === 0) continue;
    const score = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (score > bestScore) { bestScore = score; best = block.faction_id; }
  }
  return best;
}

function describeAuthority(worldState, communityId) {
  const reading = writOf(worldState, communityId);
  return {
    communityId,
    ...reading,
    holder: reading.regime === 'governed' ? null : holderOf(worldState, communityId),
  };
}

module.exports = {
  GOVERNED_FLOOR,
  CONTESTED_FLOOR,
  CONTESTED_SEVERITY_FLOOR,
  REGIMES,
  PATROL_HALF_DISTANCE_M,
  proximity,
  trustTerm,
  reachTerm,
  gripTerm,
  standingTerm,
  writOf,
  regimeFor,
  writByCommunity,
  prosecutes,
  holderOf,
  describeAuthority,
};
