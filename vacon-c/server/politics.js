// server/politics.js
//
// Governments, laws, elections, public opinion and regime change —
// the six tables that made up the largest dead spot in the schema.
//
// **What this closes.** `governments`, `elections`, `votes`, `laws`,
// `public_opinion` and `revolutions` were all defined and **no engine
// module touched one of them.** `urbanSystems.js` marked Political
// `modelled` on the strength of those six definitions, which was
// wrong: nothing governed, elected, voted, legislated or revolted.
// Six tables and zero lines of code.
//
// ---------------------------------------------------------------------
// The schema wrote the brief, and it is worth reading before the code
//
// Two of the six carry comments that are design instructions rather
// than descriptions:
//
//   public_opinion  "Rollup from beliefs/entity_knowledge on a topic,
//                    not new source data"
//   revolutions     "Ties Public Opinion + Information Spread +
//                    Government into a real regime-change mechanic,
//                    not just a lower stability number."
//
// So opinion is derived, never invented, and a revolution is a
// consequence of opinion plus spread rather than a die roll against a
// stability figure. Both are honoured below.
//
// `governments.organization_id` is a PRIMARY KEY referencing
// `organizations(id)`, which is standing rule 4 written into the
// schema: a government is an organization SUBTYPE, not a second root
// entity. `foundGovernment` therefore requires an existing
// organization of type `government` rather than creating one.
//
// ---------------------------------------------------------------------
// How approval is computed, and the version I rejected
//
// **Knowledge decides WHO has an opinion; live traits decide WHAT it
// is.** An NPC who has never heard of a government has no stance on
// it and is not counted — which is the "Information Spread" leg. An
// NPC who has heard of it holds a stance derived from their own live
// trait sheet (Group Loyalty, Paranoia, Trust Threshold), damped
// toward neutral by how confident their knowledge is.
//
// **`knowledgeCharge()` in keys.js looks like the right tool and is
// not.** It scores epistemic status: `verified` and `known` count
// fully positive, `false` inverts, everything else is neutral-leaning.
// That is the correct signal for "how sure am I", and using it for
// approval would mean a *verified* famine reads as +1 — a population
// would approve of a government precisely because it had confirmed how
// badly things were going. It is not a bug there; it is a different
// question.
//
// **A belief outranks a trait when somebody has one.** The first
// version of this module read traits only, and its note here said the
// cost was that **approval did not depend on what a law said** — a
// harsh law and a generous one moved it identically, because knowledge
// only establishes that somebody has heard of a government.
//
// That note went on to say a `valence` column on `entity_knowledge`
// would be the way to fix it, and **that was wrong: the schema already
// had the field.** `beliefs.strength` is a valenced position on a
// named subject, and `public_opinion`'s own comment asks for a rollup
// from "beliefs/entity_knowledge" — beliefs first. It was simply an
// unbuilt table. `server/beliefs.js` now exists, so:
//
//   a political belief about the topic  -> that strength is the stance
//   no belief, but knowledge of it      -> the trait-derived stance,
//                                          damped by confidence
//   neither                             -> not counted at all
//
// The trait path stays because it is the right answer for a population
// that has heard of a government and formed no view of it: their
// disposition is all there is to go on.
//
// **What still is not invented:** whether a law is good.
// `enactLaw` takes an optional caller-declared `favourability`, and
// with none it shifts no belief. Deciding that a `criminal` law pleases
// one NPC and offends another is game design no source document
// specifies — the line `actions.js` already declined to cross.
//
// ---------------------------------------------------------------------
// Where this runs
//
// Inside `runOrganizationPhase`. The tick pipeline is locked at eleven
// phases and a government is an organization, so politics is not a
// twelfth thing.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { seededDraw } = require('./seeded.js');
const entityTraits = require('./entityTraits.js');
const worldStore = require('./worldStore.js');
const beliefs = require('./beliefs.js');
const perception = require('./perception.js');

let nextElectionId = 1;
let nextLawId = 1;
let nextRevolutionId = 1;

// Straight from the schema comments — not invented, and not extended.
const SYSTEM_TYPES = [
  'democracy', 'monarchy', 'council', 'corporate', 'tribal',
  'technocracy', 'military', 'religious', 'hybrid',
];
const LAW_CATEGORIES = [
  'criminal', 'business', 'property', 'environmental', 'technology',
  'family', 'financial', 'trade', 'international',
];

// **Added for the full political hierarchy (town/city/state/country),
// by direct instruction.** `runElections`/`runLegislation`/
// `assessRevolutions` below were already generic over
// `worldState.governments` — every one of them loops `for (const
// government of worldState.governments || [])` and had simply never
// been handed more than the one civilization-wide government
// `worldgen.js` founds. `GOVERNMENT_SCOPE_TYPES` is what a NEW
// government row names as its own real jurisdiction, using the
// engine's own existing geography rather than a fourth, invented tier:
// `regions` already sits between `civilizations` and `cities` in
// `VACANCY_POSTGRESQL_SCHEMA.sql` — exactly where a US-style "state"
// sits between country and city — so `region` IS this engine's state
// tier, not a new table. `community` is deliberately NOT a scope here
// — see `foundGovernment`'s own header for why.
//
// A government founded with no scope (every existing caller, before
// this round) defaults to `'civilization'` with `scope_id: null`,
// which every scoping helper below treats as "the whole world" — the
// exact behaviour this file already had. Only a government founded
// WITH a real `scopeId` changes anything.
const GOVERNMENT_SCOPE_TYPES = ['city', 'region', 'civilization'];

// `elections.status` defaults to 'scheduled' in the schema; the rest
// are the states it has to pass through to be tallied.
const ELECTION_STATUSES = ['scheduled', 'open', 'closed', 'cancelled'];
const LAW_STATUSES = ['active', 'repealed'];
const REVOLUTION_OUTCOMES = ['pending', 'succeeded', 'failed'];

//: Flagged interpretive. No source document sets an approval floor for
//: unrest. 35 of 100 is low enough that a merely unpopular government
//: is not perpetually on the brink, and reachable by a population whose
//: traits genuinely run against it.
const REVOLUTION_APPROVAL_FLOOR = 35;

//: Also interpretive, and the more important of the two. **A government
//: nobody has heard of cannot be overthrown by public opinion**, so a
//: revolution needs the topic to have reached a real share of the
//: population first. Without this floor, a brand-new government with
//: one informed and disapproving citizen would show 0% approval and
//: fall immediately — an artefact of a tiny sample, not unrest.
const REVOLUTION_SPREAD_FLOOR = 0.25;

function topicForGovernment(organizationId) {
  return `government:${organizationId}`;
}

// -- governments --------------------------------------------------------

// `scopeType`/`scopeId` are new, in-memory-only fields on the
// `governments` row (real schema columns too — see
// `VACANCY_POSTGRESQL_SCHEMA.sql`'s `governments.scope_type`/
// `.scope_id`, added this round). `community` is deliberately NOT a
// valid scope: a community's own real `leadership_npc_id` stays
// appointment-only, the same posture it already had, because a formal
// election/legislature/revolution cycle over a population the size of
// one neighbourhood is the eleventh standing rule's own trap — a
// mechanism with nothing real to contest is indistinguishable from a
// label glued onto one NPC.
function foundGovernment(worldState, options = {}) {
  const {
    organizationId, systemType, scopeType = 'civilization', scopeId = null,
  } = options;
  if (!organizationId) throw new Error('foundGovernment requires an organizationId');
  if (!SYSTEM_TYPES.includes(systemType)) {
    throw new Error(`foundGovernment: systemType must be one of ${SYSTEM_TYPES.join(', ')}`);
  }
  if (!GOVERNMENT_SCOPE_TYPES.includes(scopeType)) {
    throw new Error(`foundGovernment: scopeType must be one of ${GOVERNMENT_SCOPE_TYPES.join(', ')}`);
  }

  const organization = worldState.organizations.find((o) => o.id === organizationId);
  if (!organization) throw new Error(`foundGovernment: no organization ${organizationId}`);
  // Standing rule 4, and the schema's own primary key: a government is
  // an organization subtype. An organization of some other type
  // becoming a government would leave two disagreeing answers to "what
  // kind of thing is this".
  if (organization.type !== 'government') {
    throw new Error(
      `foundGovernment: organization ${organizationId} is type "${organization.type}", `
      + 'not "government" — a government is an organization subtype, not a second root entity',
    );
  }
  if (worldState.governments.some((g) => g.organization_id === organizationId)) {
    throw new Error(`foundGovernment: organization ${organizationId} is already a government`);
  }

  const row = {
    organization_id: organizationId, system_type: systemType,
    scope_type: scopeType, scope_id: scopeId,
  };
  worldState.governments.push(row);
  return row;
}

function getGovernment(worldState, organizationId) {
  return worldState.governments.find((g) => g.organization_id === organizationId) || null;
}

// The real cities a government's own jurisdiction actually covers.
// `'civilization'` (the default, and every pre-existing caller's
// behaviour) is every city in the world — unchanged from before this
// round. A government founded WITH a real `scopeId` narrows to
// exactly that city, or every city in that one region
// (`cities.region_id`, the real FK already in the schema).
function scopeCitiesOf(worldState, government) {
  const cities = worldState.cities || [];
  if (!government || government.scope_type == null || government.scope_type === 'civilization') {
    return cities;
  }
  if (government.scope_type === 'city') {
    return cities.filter((c) => c.id === government.scope_id);
  }
  return cities.filter((c) => c.region_id === government.scope_id);
}

// The real population a government's own election/legislature should
// draw from — through `communities.city_id`, the identical real field
// `events.js#cityIdForCommunity` already resolves, rather than a
// second location mechanism. `'civilization'` scope (and anything with
// no scope at all) is every NPC in the world, the exact pre-existing
// behaviour.
function scopePopulationOf(worldState, government) {
  if (!government || government.scope_type == null || government.scope_type === 'civilization') {
    return worldState.npcs || [];
  }
  const cityIds = new Set(scopeCitiesOf(worldState, government).map((c) => c.id));
  const communityIds = new Set(
    (worldState.communities || [])
      .filter((c) => cityIds.has(c.city_id))
      .map((c) => c.id),
  );
  return (worldState.npcs || []).filter((n) => communityIds.has(n.communityId));
}

// Where a government's own election winner is actually installed,
// beyond `organizations.leader_id` (every scope gets that — see the
// fix in `closeElection` below). A `'city'`-scoped government's winner
// is also that city's real `mayor_npc_id`; `'region'` is the new
// `governor_npc_id` this round adds (the schema's own state-equivalent
// tier — see `GOVERNMENT_SCOPE_TYPES` above); `'civilization'` is the
// new `head_of_state_npc_id` this round adds, and ONLY when a real
// `scopeId` was given — a civ-wide government founded the old way
// (`scopeId: null`) has no single civilization row to point at and
// correctly installs nowhere beyond the organization itself, the exact
// pre-existing behaviour.
function installScopedLeader(worldState, government, winnerId) {
  if (!government) return;
  if (government.scope_type === 'city') {
    const city = (worldState.cities || []).find((c) => c.id === government.scope_id);
    if (city) city.mayor_npc_id = winnerId;
  } else if (government.scope_type === 'region') {
    const region = (worldState.regions || []).find((r) => r.id === government.scope_id);
    if (region) region.governor_npc_id = winnerId;
  } else if (government.scope_type === 'civilization' && government.scope_id !== null) {
    const civ = (worldState.civilizations || []).find((c) => c.id === government.scope_id);
    if (civ) civ.head_of_state_npc_id = winnerId;
  }
}

// -- laws ---------------------------------------------------------------

// Enacting a law is also the main way a population learns a government
// exists: every NPC gets a knowledge row on the government's topic.
// That is the "Information Spread" leg of the revolutions brief, and
// without it `computeApproval` would have nothing to read and would
// return null forever — the standing-rule-6 failure, where a signal
// reads a field nothing ever writes.
function enactLaw(worldState, options = {}) {
  const {
    jurisdictionCityId = null, category, description = null,
    governmentOrganizationId = null, tick = worldState.tick ?? 0,
    factType = 'known', confidence = 0.8, favourability = null,
  } = options;
  if (favourability !== null && !Number.isFinite(favourability)) {
    throw new Error('enactLaw: favourability must be a finite number or null');
  }

  if (!LAW_CATEGORIES.includes(category)) {
    throw new Error(`enactLaw: category must be one of ${LAW_CATEGORIES.join(', ')}`);
  }

  const law = {
    id: nextLawId++,
    jurisdiction_city_id: jurisdictionCityId,
    category,
    description,
    enacted_tick: tick,
    status: 'active',
  };
  worldState.laws.push(law);

  if (governmentOrganizationId !== null) {
    if (!getGovernment(worldState, governmentOrganizationId)) {
      throw new Error(`enactLaw: organization ${governmentOrganizationId} is not a government`);
    }
    broadcastGovernmentKnowledge(worldState, {
      governmentOrganizationId,
      factContent: `law ${law.id} (${category}) enacted`,
      factType,
      confidence,
      tick,
    });

    // **Only when the caller says which way.** With no
    // `favourability`, a law is news and nothing more — which is the
    // original behaviour, kept rather than replaced, because this
    // module still has no basis for judging a law.
    if (favourability !== null) {
      beliefs.shiftPopulationBelief(worldState, {
        beliefType: 'political',
        beliefName: topicForGovernment(governmentOrganizationId),
        delta: favourability,
        tick,
      });
    }
  }

  return law;
}

function repealLaw(worldState, options = {}) {
  const { lawId } = options;
  const law = worldState.laws.find((l) => l.id === lawId);
  if (!law) throw new Error(`repealLaw: no law ${lawId}`);
  if (law.status !== 'active') throw new Error(`repealLaw: law ${lawId} is ${law.status}`);
  law.status = 'repealed';
  return law;
}

function listLaws(worldState, options = {}) {
  const { jurisdictionCityId = null, category = null, status = 'active' } = options;
  return worldState.laws.filter(
    (l) => (jurisdictionCityId === null || l.jurisdiction_city_id === jurisdictionCityId)
      && (category === null || l.category === category)
      && (status === null || l.status === status),
  );
}

// -- information spread -------------------------------------------------

// One knowledge row per NPC, through `worldStore.addKnowledge` rather
// than pushed directly, so distortion and source tracking behave the
// same way they do for every other fact in the world.
function broadcastGovernmentKnowledge(worldState, options = {}) {
  const {
    governmentOrganizationId, factContent, factType = 'known',
    confidence = 0.8, tick = worldState.tick ?? 0,
  } = options;

  const topic = topicForGovernment(governmentOrganizationId);

  // **Through a channel, and this used to be a loop over every NPC in
  // the world.** Every announcement reached every person instantly,
  // wherever they lived and whatever had been built, so
  // `computeApproval`'s `spread` was a constant 1.0 — measured, 153 of
  // 153 on a 400-tick world. `assessRevolutions` needs approval below
  // 35 AND spread at or above 0.25, so one of its two conditions could
  // never fail and §63's "Public Opinion + Information Spread +
  // Government" mechanic was a public-opinion mechanic with a
  // decorative second term.
  //
  // `server/media.js` is §7's systems 23 and 24, and §61's own
  // sentence is the design: "in the reset era, communication should
  // begin locally and reemerge technologically over time". A collapsed
  // settlement hears its government by word of mouth, over weeks, if
  // anybody there knows anybody. One that has recovered writing can
  // read a bulletin; electricity brings radio.
  //
  // **Made in ONE place — where the government sits — and this is the
  // whole difference.** The first attempt at this announced in every
  // community of every city, on the reasoning that a community-reach
  // channel has to be spoken somewhere so it should be spoken
  // everywhere. That reproduced the old behaviour under a new name:
  // measured, `spread` came back at 1.0 on tick 0 of a fresh world and
  // not one fact was ever passed from one person to another, because
  // there was nobody left who had not already heard it.
  //
  // An announcement happens at the seat of government, and then it
  // travels — by word of mouth along real relationships, over weeks,
  // or instantly if the world has recovered radio. `media.seatOf`
  // reads `properties.operating_organization_id`, the schema's own
  // link from a building to whoever runs it, so the government has a
  // location without `organizations` needing an address column.
  const media = require('./media.js');
  const seat = media.seatOf(worldState, governmentOrganizationId);

  // A government with no building announces wherever there is somebody
  // to announce to. That is a fixture or a world mid-restore rather
  // than a real settlement, and falling back to the first community
  // keeps those working without putting the announce-everywhere
  // behaviour back.
  const fallback = (worldState.communities || [])[0] ?? null;
  const cityId = seat.cityId ?? fallback?.city_id ?? null;
  const communityId = seat.communityId ?? fallback?.id ?? null;

  return media.broadcast(worldState, {
    factContent: `${topic} ${factContent}`,
    factType,
    subjectEntityId: governmentOrganizationId,
    sourceEntityId: governmentOrganizationId,
    confidence,
    cityId,
    communityId,
    tick,
  });
}

// -- public opinion -----------------------------------------------------

// **One NPC's stance, from their LIVE trait sheet.** `getLiveEntity`,
// not `npc.traits` — the denormalised sheet is built once at
// generation and never refreshed, so reading it would return a
// plausible birth value forever. That is standing rule 9, and it is
// the failure mode that is hardest to see because a frozen number
// looks exactly like a real one.
function stanceOf(worldState, entityId, confidence, topic) {
  // A belief is a position somebody actually holds on this subject, so
  // it is used as-is: not damped by the confidence of a knowledge row,
  // because the belief IS the view. Damping it would mean somebody who
  // firmly distrusts a government on hearsay is recorded as neutral.
  if (topic) {
    const held = beliefs.beliefStrength(worldState, entityId, topic);
    if (held !== null) return Math.max(0, Math.min(100, Number(held)));
  }

  const live = entityTraits.getLiveEntity(worldState, entityId);
  if (!live) return null;
  const trait = (family, name, fallback = 50) => {
    const value = Number(live.traits?.[family]?.[name]);
    return Number.isFinite(value) ? value : fallback;
  };

  const loyalty = trait('social', 'Group Loyalty');
  const paranoia = trait('psychological', 'Paranoia');
  const threshold = trait('psychological', 'Trust Threshold');

  // Centred on 50 and bounded. Loyalty pulls up; paranoia and a high
  // trust threshold pull down, the threshold at half weight because it
  // is a disposition to withhold judgement rather than to disapprove.
  const raw = 50
    + (loyalty - 50) * 0.5
    - (paranoia - 50) * 0.5
    - (threshold - 50) * 0.25;

  // Damped toward neutral by confidence: a low-confidence rumour
  // produces a weaker opinion than verified knowledge, rather than an
  // equally strong one.
  const damped = 50 + (raw - 50) * Math.max(0, Math.min(1, confidence));
  return Math.max(0, Math.min(100, damped));
}

// The rollup the schema comment asks for: computed from
// `entity_knowledge`, never stored as its own source of truth.
//
// Returns null rather than 0 when nobody knows the topic. **Unknown is
// not zero** — the distinction `moodFor()` got wrong when
// `Number(null)` made an unobserved value read as a real zero, which
// made a person nobody had observed read as "content". Here, a zero
// would mean total disapproval and would trigger a revolution against
// a government nobody has heard of.
// **`populationIds`, added for the full political hierarchy round.**
// Every pre-existing caller omits it and gets the exact old behaviour
// — the whole world's living population as the denominator, correct
// for a civilization-wide government, whose real audience IS
// everyone. A city- or region-scoped government's real audience is
// only its own residents (`scopePopulationOf`, the identical real
// scoping `closeElection`'s turnout and `candidatesFor`'s fallback
// already use) — without this, `spread` for a sub-civilization
// government would divide its own small number of informed residents
// by the ENTIRE WORLD'S population and could never cross
// `REVOLUTION_SPREAD_FLOOR`, the fourteenth standing rule's own shape:
// a threshold whose denominator sits behind a wider population than
// the mechanism it gates was ever built to reach.
function computeApproval(worldState, options = {}) {
  const { topic, populationIds = null } = options;
  if (!topic) throw new Error('computeApproval requires a topic');

  // **`spread` could exceed 1, and did — measured at 1.0272.** The
  // denominator is the living population and the numerator counted
  // knowledge rows, which the dead keep: `mortality` moves an NPC out
  // of `npcs` and deliberately leaves their `entity_knowledge` alone,
  // because what somebody knew is part of the record. So a world that
  // had buried anybody reported more people informed about its
  // government than it had people, and a share above 1 is not a share.
  //
  // The living only, on both sides. The same argument `runPayroll`
  // makes about walking contracts rather than people: this walks facts,
  // and it has to ask.
  const livingIds = populationIds === null
    ? worldState.npcs.map((n) => n.id)
    : populationIds;
  const living = new Set(livingIds);
  const people = living.size;
  const byEntity = new Map();
  for (const row of worldState.entityKnowledge) {
    if (typeof row.fact_content !== 'string' || !row.fact_content.startsWith(topic)) continue;
    if (!living.has(row.entity_id)) continue;
    // The most confident thing a person knows about the topic is what
    // they act on. Two rows for one person are two tellings of the
    // same subject, not two opinions.
    const existing = byEntity.get(row.entity_id);
    if (!existing || (row.confidence_level ?? 0) > (existing.confidence_level ?? 0)) {
      byEntity.set(row.entity_id, row);
    }
  }

  const stances = [];
  for (const [entityId, row] of byEntity) {
    const stance = stanceOf(worldState, entityId, row.confidence_level ?? 0.5, topic);
    if (stance !== null) stances.push(stance);
  }

  if (stances.length === 0) {
    return { topic, approval: null, informed: 0, spread: people === 0 ? null : 0 };
  }

  const approval = stances.reduce((a, b) => a + b, 0) / stances.length;
  return {
    topic,
    approval: Math.round(approval * 100) / 100,
    informed: stances.length,
    spread: people === 0 ? null : Math.round((stances.length / people) * 10000) / 10000,
  };
}

// A tick-stamped row per (city, topic), which is what the table's
// (city_id, topic, tick) primary key is for.
//
// **This is not the rule-3 violation it looks like.** Rule 3 forbids
// storing a rollup that should be computed — Reemergence, Property
// Value, Community Health and Family Wealth all have no table for
// exactly that reason. `public_opinion` HAS a table, keyed by tick,
// which makes it history rather than a second source of truth: the
// current value is always `computeApproval`, and these rows are what
// it was. Same relationship `individual_finances` has to a balance.
function snapshotPublicOpinion(worldState, tick, options = {}) {
  const { cityId = null } = options;
  const written = [];
  for (const government of worldState.governments) {
    const topic = topicForGovernment(government.organization_id);
    const { approval } = computeApproval(worldState, { topic });
    if (approval === null) continue;
    const row = {
      city_id: cityId,
      topic,
      approval_score: approval,
      tick,
    };
    worldState.publicOpinion.push(row);
    written.push(row);
  }
  return written;
}

function latestOpinion(worldState, topic) {
  const rows = worldState.publicOpinion.filter((r) => r.topic === topic);
  if (rows.length === 0) return null;
  // `>=` so a tie resolves to the later-recorded row, the same rule
  // `getLatestFinances` and `getCurrentOwner` already use.
  return rows.reduce((latest, r) => (r.tick >= latest.tick ? r : latest));
}

// -- elections ----------------------------------------------------------

function scheduleElection(worldState, options = {}) {
  const {
    organizationId, electionType = null,
    startTick = worldState.tick ?? 0, endTick = null,
  } = options;
  if (!getGovernment(worldState, organizationId)) {
    throw new Error(`scheduleElection: organization ${organizationId} is not a government`);
  }
  const election = {
    id: nextElectionId++,
    organization_id: organizationId,
    election_type: electionType,
    start_tick: startTick,
    end_tick: endTick,
    status: 'scheduled',
  };
  worldState.elections.push(election);
  return election;
}

function openElection(worldState, options = {}) {
  const { electionId } = options;
  const election = findElection(worldState, electionId);
  if (election.status !== 'scheduled') {
    throw new Error(`openElection: election ${electionId} is ${election.status}`);
  }
  election.status = 'open';
  return election;
}

function findElection(worldState, electionId) {
  const election = worldState.elections.find((e) => e.id === electionId);
  if (!election) throw new Error(`no election ${electionId}`);
  return election;
}

// One vote per voter per election — the table's own primary key is
// (election_id, voter_entity_id), so a second vote is not a second row
// but a constraint violation waiting for the next migration. Refused
// here, where it can be explained, rather than at the database.
function castVote(worldState, options = {}) {
  const {
    electionId, voterEntityId, candidateEntityId, tick = worldState.tick ?? 0,
  } = options;
  const election = findElection(worldState, electionId);
  if (election.status !== 'open') {
    throw new Error(`castVote: election ${electionId} is ${election.status}, not open`);
  }
  if (!voterEntityId || !candidateEntityId) {
    throw new Error('castVote requires a voterEntityId and a candidateEntityId');
  }
  const already = worldState.votes.find(
    (v) => v.election_id === electionId && v.voter_entity_id === voterEntityId,
  );
  if (already) {
    throw new Error(
      `castVote: entity ${voterEntityId} has already voted in election ${electionId}`,
    );
  }

  const vote = {
    election_id: electionId,
    voter_entity_id: voterEntityId,
    candidate_entity_id: candidateEntityId,
    tick,
  };
  worldState.votes.push(vote);
  return vote;
}

// Closes and tallies. A tie is reported as a tie rather than resolved
// by array order, which is the kind of silent arbitrariness that reads
// as a decision.
function closeElection(worldState, options = {}) {
  const { electionId, tick = worldState.tick ?? 0 } = options;
  const election = findElection(worldState, electionId);
  if (election.status !== 'open') {
    throw new Error(`closeElection: election ${electionId} is ${election.status}, not open`);
  }

  const tally = new Map();
  for (const vote of worldState.votes) {
    if (vote.election_id !== electionId) continue;
    tally.set(vote.candidate_entity_id, (tally.get(vote.candidate_entity_id) || 0) + 1);
  }

  election.status = 'closed';
  election.end_tick = tick;

  if (tally.size === 0) {
    return { election, winnerId: null, tally: [], tied: false, turnout: 0 };
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const tied = sorted.length > 1 && sorted[0][1] === sorted[1][1];
  // Turnout is a share of the government's OWN real population — the
  // whole world for a civ-wide government (unchanged), but a city- or
  // region-scoped one would otherwise report a turnout artificially
  // crushed toward zero against every NPC on the planet, most of whom
  // were never eligible to vote in it at all.
  const government = getGovernment(worldState, election.organization_id);
  const eligible = scopePopulationOf(worldState, government).length;
  const turnout = eligible === 0
    ? null
    : Math.round(([...tally.values()].reduce((a, b) => a + b, 0) / eligible) * 10000) / 10000;

  // A tied election elects nobody. The organization's leader is only
  // set on a clear result — a leader installed by sort order would be
  // indistinguishable from one the world chose.
  //
  // **`leader_npc_id` was this file's own real bug, found while
  // generalising it to more than one tier.** `organizations.leader_id`
  // is the real schema column, the one `leadership.js`, `control.js`
  // and `succession.js` all actually read — `leader_npc_id` does not
  // exist on the schema or on a real generated organization
  // (`engine.js#generateOrganization` sets `leader_id`), so every
  // election this engine had ever run wrote to a phantom property an
  // election's own winner never reached anywhere else in the engine.
  // The sixth standing rule's shape: a writer using a field name that
  // does not exist succeeds silently, forever. This file's own test
  // fixture had encoded the identical mistake (`leader_npc_id: null`
  // on a hand-built organization, never `leader_id`), which is why a
  // passing suite never caught it — the twenty-fourth standing rule's
  // own shape, a test whose fixture matches the bug it should have
  // found.
  const winnerId = tied ? null : sorted[0][0];
  if (winnerId !== null) {
    const organization = worldState.organizations.find((o) => o.id === election.organization_id);
    if (organization) organization.leader_id = winnerId;
    installScopedLeader(worldState, government, winnerId);
  }

  return {
    election,
    winnerId,
    tied,
    turnout,
    tally: sorted.map(([candidateId, votes]) => ({ candidateId, votes })),
  };
}

// -- revolutions --------------------------------------------------------

// The brief: "Ties Public Opinion + Information Spread + Government
// into a real regime-change mechanic, not just a lower stability
// number." Both floors have to be crossed — low approval AND enough of
// the population actually informed.
function assessRevolutions(worldState, tick, options = {}) {
  const {
    approvalFloor = REVOLUTION_APPROVAL_FLOOR,
    spreadFloor = REVOLUTION_SPREAD_FLOOR,
  } = options;

  const events = [];
  const started = [];
  for (const government of worldState.governments) {
    const organizationId = government.organization_id;
    const topic = topicForGovernment(organizationId);
    // Scoped to the government's own real audience — see
    // `computeApproval`'s own header for why an unscoped civ-wide
    // denominator would make a sub-civilization government's revolt
    // floor structurally unreachable.
    const populationIds = scopePopulationOf(worldState, government).map((n) => n.id);
    const { approval, spread, informed } = computeApproval(worldState, { topic, populationIds });

    if (approval === null || spread === null) continue;
    if (approval >= approvalFloor || spread < spreadFloor) continue;

    // One pending revolution per government. A second would be two
    // simultaneous uprisings against the same target, which is a
    // different thing than the one this models.
    const pending = worldState.revolutions.find(
      (r) => r.target_government_organization_id === organizationId && r.outcome === 'pending',
    );
    if (pending) continue;

    const revolution = {
      id: nextRevolutionId++,
      target_government_organization_id: organizationId,
      trigger_tick: tick,
      outcome: 'pending',
      new_government_organization_id: null,
    };
    worldState.revolutions.push(revolution);
    started.push(revolution);
    events.push({
      type: 'revolution_triggered',
      organizationId,
      approval,
      spread,
      informed,
      tick,
    });
  }

  return { started, events };
}

function resolveRevolution(worldState, options = {}) {
  const { revolutionId, outcome, newGovernmentOrganizationId = null } = options;
  const revolution = worldState.revolutions.find((r) => r.id === revolutionId);
  if (!revolution) throw new Error(`resolveRevolution: no revolution ${revolutionId}`);
  if (revolution.outcome !== 'pending') {
    throw new Error(`resolveRevolution: revolution ${revolutionId} is already ${revolution.outcome}`);
  }
  if (!REVOLUTION_OUTCOMES.includes(outcome) || outcome === 'pending') {
    throw new Error('resolveRevolution: outcome must be "succeeded" or "failed"');
  }

  if (outcome === 'succeeded') {
    if (newGovernmentOrganizationId === null) {
      throw new Error(
        'resolveRevolution: a succeeded revolution requires a newGovernmentOrganizationId — '
        + 'a regime change with no successor leaves the world with no government and no record '
        + 'of what replaced the old one',
      );
    }
    if (!getGovernment(worldState, newGovernmentOrganizationId)) {
      throw new Error(
        `resolveRevolution: organization ${newGovernmentOrganizationId} is not a government`,
      );
    }
    // The old government stops being one. Its organization row stays —
    // an organization that lost power still exists, and deleting it
    // would take its employment records and history with it.
    worldState.governments = worldState.governments.filter(
      (g) => g.organization_id !== revolution.target_government_organization_id,
    );
    revolution.new_government_organization_id = newGovernmentOrganizationId;
  }

  revolution.outcome = outcome;
  return revolution;
}

// -- the phase hook -----------------------------------------------------

// Called from `runOrganizationPhase`. Snapshot first, then assess:
// assessing before the snapshot would test this tick's opinion against
// a record that does not yet contain it, so the numbers in the event
// and the numbers on disk would disagree by one tick.
//: How long a term runs, and how long the polls stay open.
//:
//: **Flagged interpretive: no document sets either.** A tick is a day
//: (`behavior.TICK_INTERVALS`), so a four-year term is 1460 ticks and a
//: week of voting is 7. The point is not the exact number — it is that
//: `elections` and `votes` were empty in every world this engine had
//: ever built. `scheduleElection`, `openElection`, `castVote` and
//: `closeElection` were all written, tested and green, and nothing
//: anywhere called them in sequence, so no election had ever been held.
const ELECTION_TERM_TICKS = 1460;
const ELECTION_OPEN_TICKS = 7;

//: How many people stand. Drawn from the government's own membership
//: where it has one, so a candidate is somebody who is already part of
//: the institution rather than a name picked out of the population.
const CANDIDATES = 3;

// Who is standing in this government's election.
//
// Members of the government organization first — `entity_organization_
// memberships` is real substrate and a government's own people are the
// obvious candidates. Falling back to the strongest `leadership` traits
// in the world, because a government with no roster still has to be
// able to hold an election rather than silently skip one.
// **Scoped to the government's own real population, not the whole
// world.** Explicit members are candidates regardless of where they
// live — real membership in the government organization already says
// so — but the FALLBACK ranking (no roster to draw from) used to rank
// every NPC on the planet by Command Presence, which would hand a
// brand-new city-level election a candidate who had never set foot in
// that city. `scopePopulationOf` is the identical real scoping
// `closeElection`'s own turnout fix uses.
function candidatesFor(worldState, organizationId) {
  const living = new Map(worldState.npcs.map((n) => [n.id, n]));
  const members = (worldState.entityOrganizationMemberships || [])
    .filter((m) => m.organization_id === organizationId && m.status !== 'left')
    .map((m) => living.get(m.entity_id))
    .filter(Boolean);
  if (members.length >= 2) return members.slice(0, CANDIDATES).map((n) => n.id);

  const government = getGovernment(worldState, organizationId);
  const ranked = scopePopulationOf(worldState, government)
    .map((npc) => {
      const live = entityTraits.getLiveEntity(worldState, npc.id);
      const presence = Number(live?.traits?.leadership?.['Command Presence'] ?? 50);
      return { id: npc.id, presence: Number.isFinite(presence) ? presence : 50 };
    })
    .sort((a, b) => b.presence - a.presence);
  return ranked.slice(0, CANDIDATES).map((r) => r.id);
}

// Who this voter picks.
//
// The candidate they trust most, and Command Presence only where they
// know none of them — which is what an election between strangers is.
// Reading `relationships.trust` rather than drawing at random is what
// makes a result explicable: a well-connected candidate wins because
// people know them.
function voteOf(worldState, voterId, candidateIds) {
  let best = null;
  let bestTrust = -Infinity;
  for (const candidateId of candidateIds) {
    if (candidateId === voterId) continue;
    const rel = (worldState.relationships || []).find(
      (r) => (r.entity_a_id === voterId && r.entity_b_id === candidateId)
        || (r.entity_b_id === voterId && r.entity_a_id === candidateId),
    );
    const trust = rel ? Number(rel.trust) : null;
    if (trust !== null && trust > bestTrust) {
      bestTrust = trust;
      best = candidateId;
    }
  }
  if (best !== null) return best;

  // Knows nobody standing. Falls back to presence, which is the only
  // thing a stranger can judge somebody on.
  let fallback = null;
  let bestPresence = -Infinity;
  for (const candidateId of candidateIds) {
    if (candidateId === voterId) continue;
    const live = entityTraits.getLiveEntity(worldState, candidateId);
    const presence = Number(live?.traits?.leadership?.['Command Presence'] ?? 50);
    if (presence > bestPresence) {
      bestPresence = presence;
      fallback = candidateId;
    }
  }
  return fallback;
}

// One tick of the electoral cycle: schedule a term, open the polls,
// take the votes, close them.
//
// **Driven on a crossing, not a condition** — standing rule 7. A term
// elapsing is an event; "no election is open" is a state that holds
// most of the time, and scheduling on that would put an election in
// the log every tick forever.
function runElections(worldState, tick) {
  const events = [];

  for (const government of worldState.governments || []) {
    const organizationId = government.organization_id;
    const held = (worldState.elections || []).filter(
      (e) => e.organization_id === organizationId,
    );
    const open = held.find((e) => e.status === 'open');
    const scheduled = held.find((e) => e.status === 'scheduled');

    if (open) {
      if (tick < (open.start_tick ?? 0) + ELECTION_OPEN_TICKS) continue;
      const result = closeElection(worldState, { electionId: open.id, tick });
      events.push({
        type: 'election_closed',
        severity: 'medium',
        note: result.tied
          ? `election ${open.id} tied and elected nobody`
          : `entity ${result.winnerId} won election ${open.id}`,
        tick,
        affected_entity_ids: result.winnerId === null ? [] : [result.winnerId],
        global_effects: {
          electionId: open.id, winnerId: result.winnerId, turnout: result.turnout,
        },
      });
      continue;
    }

    if (scheduled) {
      if (tick < (scheduled.start_tick ?? 0)) continue;
      openElection(worldState, { electionId: scheduled.id });
      const candidates = candidatesFor(worldState, organizationId);
      if (candidates.length < 2) {
        // Nobody to choose between. Closed immediately rather than left
        // open forever, which would block every later term.
        closeElection(worldState, { electionId: scheduled.id, tick });
        continue;
      }
      // Scoped the identical way `candidatesFor`'s own fallback is —
      // a city's election is decided by that city, not by every NPC
      // on the planet voting in every government's election at once.
      for (const npc of scopePopulationOf(worldState, government)) {
        const choice = voteOf(worldState, npc.id, candidates);
        if (choice === null) continue;
        castVote(worldState, {
          electionId: scheduled.id, voterEntityId: npc.id, candidateEntityId: choice, tick,
        });
      }
      events.push({
        type: 'election_opened',
        severity: 'low',
        note: `election ${scheduled.id} opened with ${candidates.length} candidates`,
        tick,
        affected_entity_ids: candidates,
        global_effects: { electionId: scheduled.id, candidates: candidates.length },
      });
      continue;
    }

    // Nothing pending: schedule the next term from when the last one
    // closed, or immediately for a government that has never held one.
    const last = held
      .filter((e) => e.status === 'closed')
      .reduce((latest, e) => (
        (e.end_tick ?? 0) > (latest?.end_tick ?? -Infinity) ? e : latest
      ), null);
    const nextStart = last === null ? tick : (last.end_tick ?? tick) + ELECTION_TERM_TICKS;
    scheduleElection(worldState, {
      organizationId, electionType: 'leadership', startTick: nextStart,
    });
  }

  return events;
}

// -- legislation over time ------------------------------------------------

//: How often a government adds to the statute book. Flagged
//: interpretive: no document gives a legislative rate.
//:
//: A year of ticks, and **the first version was 730 for no better
//: reason than that two years sounds like a legislative cadence.**
//: Measured: a 600-tick world legislated exactly nothing, so the
//: mechanism was present and inert — standing rule 12's third clause,
//: in the same session that added that rule. A year is what a run of
//: the length anybody actually does can observe, and it means a
//: government builds out the nine categories over about a decade.
const LEGISLATION_INTERVAL_TICKS = 365;

//: A government only enacts what it does not already have. Without
//: this, the draw would re-enact `family` law for the ninth time while
//: theft stayed legal — and `justice.lawCovering` takes the first
//: active match, so duplicates change nothing at all.
function unlegislatedCategories(worldState, cityId) {
  const held = new Set(
    (worldState.laws || [])
      .filter((law) => law.status === 'active'
        && (law.jurisdiction_city_id === null || law.jurisdiction_city_id === cityId))
      .map((law) => law.category),
  );
  return LAW_CATEGORIES.filter((c) => !held.has(c));
}

// One pass of legislating. **A crossing, not a condition** — the
// seventh standing rule: a government that enacted a law whenever some
// state held would fill the table every tick forever.
function runLegislation(worldState, tick) {
  const events = [];
  if (tick <= 0 || tick % LEGISLATION_INTERVAL_TICKS !== 0) return events;

  for (const government of worldState.governments || []) {
    // **Scoped to the government's own real jurisdiction.** Before
    // this round there was only ever one government in the world (the
    // civ-wide Assembly), so looping every city for it was correct by
    // accident — a civilization genuinely does legislate for every
    // city. A city- or region-scoped government legislating for cities
    // outside its own jurisdiction would be exactly that accident
    // breaking the moment a second government exists.
    for (const city of scopeCitiesOf(worldState, government)) {
      const available = unlegislatedCategories(worldState, city.id);
      if (available.length === 0) continue;
      // Seeded on the city and the tick, never on an id — §88, and the
      // corollary that ids come from a counter whose state depends on
      // what was built before.
      const category = available[
        Math.floor(seededDraw([worldState.seed ?? 'politics', 'legislate', city.id, tick])
          * available.length)
      ];
      const law = enactLaw(worldState, {
        jurisdictionCityId: city.id,
        category,
        description: null,
        governmentOrganizationId: government.organization_id,
        tick,
      });
      events.push({
        type: 'law_enacted',
        severity: 'low',
        note: `city ${city.id}: ${category} law enacted`,
        tick,
        affected_entity_ids: [],
        global_effects: { lawId: law.id, category, cityId: city.id },
      });
    }
  }
  return events;
}

function runPolitics(worldState, tick) {
  const opinions = snapshotPublicOpinion(worldState, tick);
  const { started, events } = assessRevolutions(worldState, tick);
  const electionEvents = runElections(worldState, tick);
  const lawEvents = runLegislation(worldState, tick);
  return {
    opinions: opinions.length,
    revolutions: started.length,
    events: [...events, ...electionEvents, ...lawEvents],
  };
}

function reseedIds(worldState) {
  nextElectionId = nextAfter(worldState.elections);
  nextLawId = nextAfter(worldState.laws);
  nextRevolutionId = nextAfter(worldState.revolutions);
  return { nextElectionId, nextLawId, nextRevolutionId };
}

module.exports = {
  SYSTEM_TYPES,
  LAW_CATEGORIES,
  GOVERNMENT_SCOPE_TYPES,
  scopeCitiesOf,
  scopePopulationOf,
  installScopedLeader,
  LEGISLATION_INTERVAL_TICKS,
  unlegislatedCategories,
  runLegislation,
  ELECTION_STATUSES,
  LAW_STATUSES,
  REVOLUTION_OUTCOMES,
  REVOLUTION_APPROVAL_FLOOR,
  REVOLUTION_SPREAD_FLOOR,
  topicForGovernment,
  foundGovernment,
  getGovernment,
  enactLaw,
  repealLaw,
  listLaws,
  broadcastGovernmentKnowledge,
  computeApproval,
  snapshotPublicOpinion,
  latestOpinion,
  scheduleElection,
  openElection,
  castVote,
  closeElection,
  assessRevolutions,
  resolveRevolution,
  ELECTION_TERM_TICKS,
  ELECTION_OPEN_TICKS,
  CANDIDATES,
  candidatesFor,
  voteOf,
  runElections,
  runPolitics,
  reseedIds,
};
