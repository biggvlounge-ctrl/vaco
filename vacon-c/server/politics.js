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
// **The alternative I rejected** was adding a `valence` column to
// `entity_knowledge` so each fact could carry good/bad separately from
// true/false. It would work, and `schema-extensions.sql` exists for
// exactly that. Two reasons against: the engine would then need a
// favourability judgement for every fact it broadcasts, and deciding
// whether a `criminal` law is good or bad for a given NPC is inventing
// game design that no source document specifies — the same line
// `actions.js` declined to cross. Traits-for-stance needs no such
// judgement and no new column.
//
// The cost is stated rather than hidden: **approval does not depend on
// what a law says.** A harsh law and a generous one move approval
// identically, because both are only a reason for people to have heard
// of the government. When a source document specifies law
// favourability, that is where it goes.
//
// ---------------------------------------------------------------------
// Where this runs
//
// Inside `runOrganizationPhase`. The tick pipeline is locked at eleven
// phases and a government is an organization, so politics is not a
// twelfth thing.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const entityTraits = require('./entityTraits.js');
const worldStore = require('./worldStore.js');

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

function foundGovernment(worldState, options = {}) {
  const { organizationId, systemType } = options;
  if (!organizationId) throw new Error('foundGovernment requires an organizationId');
  if (!SYSTEM_TYPES.includes(systemType)) {
    throw new Error(`foundGovernment: systemType must be one of ${SYSTEM_TYPES.join(', ')}`);
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

  const row = { organization_id: organizationId, system_type: systemType };
  worldState.governments.push(row);
  return row;
}

function getGovernment(worldState, organizationId) {
  return worldState.governments.find((g) => g.organization_id === organizationId) || null;
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
    factType = 'known', confidence = 0.8,
  } = options;

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
  const written = [];
  for (const npc of worldState.npcs) {
    written.push(worldStore.addKnowledge(worldState, {
      entityId: npc.id,
      subjectEntityId: governmentOrganizationId,
      factType,
      factContent: `${topic} ${factContent}`,
      confidenceLevel: confidence,
      sourceEntityId: governmentOrganizationId,
      tick,
    }));
  }
  return written;
}

// -- public opinion -----------------------------------------------------

// **One NPC's stance, from their LIVE trait sheet.** `getLiveEntity`,
// not `npc.traits` — the denormalised sheet is built once at
// generation and never refreshed, so reading it would return a
// plausible birth value forever. That is standing rule 9, and it is
// the failure mode that is hardest to see because a frozen number
// looks exactly like a real one.
function stanceOf(worldState, entityId, confidence) {
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
function computeApproval(worldState, options = {}) {
  const { topic } = options;
  if (!topic) throw new Error('computeApproval requires a topic');

  const people = worldState.npcs.length;
  const byEntity = new Map();
  for (const row of worldState.entityKnowledge) {
    if (typeof row.fact_content !== 'string' || !row.fact_content.startsWith(topic)) continue;
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
    const stance = stanceOf(worldState, entityId, row.confidence_level ?? 0.5);
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
  const turnout = worldState.npcs.length === 0
    ? null
    : Math.round(([...tally.values()].reduce((a, b) => a + b, 0) / worldState.npcs.length) * 10000) / 10000;

  // A tied election elects nobody. The organization's leader is only
  // set on a clear result — a leader installed by sort order would be
  // indistinguishable from one the world chose.
  const winnerId = tied ? null : sorted[0][0];
  if (winnerId !== null) {
    const organization = worldState.organizations.find((o) => o.id === election.organization_id);
    if (organization) organization.leader_npc_id = winnerId;
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
    const { approval, spread, informed } = computeApproval(worldState, { topic });

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
function runPolitics(worldState, tick) {
  const opinions = snapshotPublicOpinion(worldState, tick);
  const { started, events } = assessRevolutions(worldState, tick);
  return { opinions: opinions.length, revolutions: started.length, events };
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
  runPolitics,
  reseedIds,
};
