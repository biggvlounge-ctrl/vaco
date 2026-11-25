// server/plays.js
//
// Closes tasks #184 and #225 together, because they are the same real
// ask from two different messages in the same conversation.
//
// Task #184, verbatim: "once you get a certain level of leadership,
// you can actually put people in order. Okay, we need 2 people
// defending door 1, door 2. You can actually put them where you need
// to put them to defend the location. And then also you can put how
// many weapons, or if they need to defend it aggressively, light,
// medium. Also... you can set their aggression, their tone. You can
// set some of them in for education, knowledge, some for defense,
// some on offense."
//
// Task #225, from the master spec (§19) and the user's own framing:
// "the sports play concept... if you have the right person, you can
// set up a strategy or a play, per se, to do a mission." A play is a
// named, SAVED, reusable coordinated plan — not a one-off order.
//
// Read together, #184 names the real CONTENT of a play (who, where,
// how aggressively, to what end) and #225 names the real SHAPE
// (named, retained, run more than once). This file builds one real
// mechanism for both rather than two that would disagree.
//
// ---------------------------------------------------------------------
// Nothing here is a new authority or compliance mechanism
// ---------------------------------------------------------------------
// `leadership.js#assignRole` already establishes exactly how a real
// leader directs a real subordinate in THIS engine: the leader must
// actually hold the real seat (`organizations.leader_id` or
// `families.head_npc_id`), the subordinate must actually be a real
// member, and compliance is `leadership.complianceDraw` — a real draw
// against the subordinate's own `relationships.loyalty`, never
// guaranteed. `drawPlay` below reuses those exact two ownership checks
// (duplicated rather than imported, since `assignRole` does not
// expose them as a standalone helper — see the inline comments at each
// check for what it mirrors) and `runPlay` calls `complianceDraw`
// directly, never a second draw.
//
// ---------------------------------------------------------------------
// The two real vocabularies, both named by the user, neither invented
// ---------------------------------------------------------------------
// `AGGRESSION_LEVELS` ("light, medium" — the user's own two named
// levels, plus "aggressively" as the real third point past "medium")
// and `INTENTS` ("education, knowledge... defense... offense" — the
// user's own three named purposes, "knowledge" folded into
// "education" rather than kept as a fourth, since the user names them
// as one idea in the same breath) are both read directly off the
// user's own words, not flagged interpretive the way this project
// flags a vocabulary nobody specified.
//
// ---------------------------------------------------------------------
// "Capacity scaled by leadership" — reused, not re-derived
// ---------------------------------------------------------------------
// The user's own words: "depending on your leadership, is depending
// on how many people you can have accommodate you." `influence.
// influenceRatingOf` is already the real, derived (never stored)
// composite this engine uses for exactly this question — occupation
// tier, real organization leadership scaled by real member count, and
// real social traits (the forty-eighth standing rule). `MAX_PLAY_SIZE`
// reuses `meetings.MAXIMUM_ATTENDANCE` — the same "crowd, not a
// leadership" cap `leagues.js`'s own roster already draws on — as the
// real ceiling a maximum-influence leader's play can reach, rather
// than inventing a second cap. `capacityFor` scales linearly between
// 1 (the lowest real influence reading) and that ceiling.
//
// ---------------------------------------------------------------------
// What "retained and refined" honestly means here, and what it
// deliberately does NOT do
// ---------------------------------------------------------------------
// A play is pushed to `worldState.plays` once, by name, and `runPlay`
// can be called on it any number of times after — "retained" in the
// most literal sense. `timesRun`/`timesSucceeded` are real, reported
// counters (a play's own track record), the same posture `leadership.
// serviceRecordOf` already takes for a PERSON's track record, applied
// here to a PLAN instead.
//
// Deliberately NOT built: a mechanical bonus to compliance odds from
// reuse ("refined" as a stat buff). The seventeenth standing rule's
// own lesson is that a modifier on a compliance/escalation draw needs
// to be measured against this engine's real distributions before it
// is added, not assumed from the word "refined" in a spec document.
// `timesRun`/`timesSucceeded` are declared and readable now; wiring
// them into `complianceDraw` is real, separate, future work once
// there is a real distribution to calibrate against.
//
// Also deliberately NOT built: branching contingency trees. The
// honest, minimal real form of "contingency" this engine already has
// is `playbook.js#assignToPlaybook`'s own per-member catch — one
// subordinate's refusal is reported without discarding what every
// other subordinate actually did. `runPlay` takes the identical
// shape: a full per-assignment report, compliance and refusal side by
// side, never a single boolean for the whole play.
//
// ---------------------------------------------------------------------
// A play's location is a real property, validated the way
// missions.generateMission already validates one
// ---------------------------------------------------------------------
// "Door 1, door 2" is a real place, not a label — each assignment's
// `locationPropertyId` is checked against `worldState.properties`,
// the same real-property validation `missions.js`'s own header
// describes for `location_property_id`. An assignment naming no real
// property is refused outright, never silently accepted as a
// decoration.

'use strict';

const leadership = require('./leadership.js');
const influence = require('./influence.js');
const membership = require('./membership.js');
const meetings = require('./meetings.js');

const AGGRESSION_LEVELS = ['light', 'medium', 'aggressive'];
const INTENTS = ['education', 'defense', 'offense'];
const MAX_PLAY_SIZE = meetings.MAXIMUM_ATTENDANCE;

let nextPlayId = 1;

function capacityFor(worldState, leaderEntityId) {
  const rating = influence.influenceRatingOf(worldState, leaderEntityId);
  return Math.max(1, Math.round((rating / 100) * MAX_PLAY_SIZE));
}

// Mirrors `leadership.js#assignRole`'s own two ownership checks
// exactly (organization leader_id / family head_npc_id) — see that
// function's header for why gang/faction organizations are refused
// there; a play is a non-standing, per-operation assignment rather
// than `role_in_org`, so it carries no such refusal of its own, but
// still requires the leader to be real and the subordinate to be a
// real member of whichever seat the leader actually holds.
function requireRealSeat(worldState, leaderEntityId, { organizationId, familyId }) {
  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`drawPlay: no organization with id ${organizationId}.`);
    if (organization.leader_id !== Number(leaderEntityId)) {
      throw new Error(
        `drawPlay: entity ${leaderEntityId} does not lead organization ${organizationId} `
        + `(organizations.leader_id is ${organization.leader_id ?? 'nobody'}).`,
      );
    }
    return organization;
  }
  const family = (worldState.families || []).find((f) => f.id === Number(familyId));
  if (!family) throw new Error(`drawPlay: no family with id ${familyId}.`);
  if (family.head_npc_id !== Number(leaderEntityId)) {
    throw new Error(
      `drawPlay: entity ${leaderEntityId} does not head family ${familyId} `
      + `(families.head_npc_id is ${family.head_npc_id ?? 'nobody'}).`,
    );
  }
  return family;
}

function requireRealMember(worldState, subordinateId, { organizationId, familyId }) {
  if (organizationId != null) {
    const row = membership.findMembership(worldState, subordinateId, organizationId);
    if (!row) {
      throw new Error(`drawPlay: entity ${subordinateId} is not a member of organization ${organizationId}.`);
    }
    return;
  }
  const row = (worldState.familyMemberships || []).find(
    (m) => m.entity_id === subordinateId && m.family_id === familyId,
  );
  if (!row) {
    throw new Error(`drawPlay: entity ${subordinateId} is not a member of family ${familyId}.`);
  }
}

function drawPlay(worldState, leaderEntityId, options = {}) {
  const {
    name, organizationId = null, familyId = null, assignments,
    tick = worldState.tick ?? 0,
  } = options;

  if (!name) throw new Error('drawPlay requires a name — a saved play has to be nameable to be called later.');
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('drawPlay requires exactly one of organizationId or familyId.');
  }
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw new Error('drawPlay requires a non-empty assignments list.');
  }

  requireRealSeat(worldState, leaderEntityId, { organizationId, familyId });

  const capacity = capacityFor(worldState, leaderEntityId);
  if (assignments.length > capacity) {
    throw new Error(
      `drawPlay: this leader's real influence only supports ${capacity} assignment(s) `
      + `in one play; ${assignments.length} were given.`,
    );
  }

  const checked = assignments.map((a) => {
    const subordinateId = Number(a.subordinateEntityId);
    if (subordinateId === Number(leaderEntityId)) {
      throw new Error('drawPlay: a leader cannot assign themselves a position in their own play.');
    }
    requireRealMember(worldState, subordinateId, { organizationId, familyId });
    if (!AGGRESSION_LEVELS.includes(a.aggression)) {
      throw new Error(`drawPlay: "${a.aggression}" is not a real aggression level. The three are: ${AGGRESSION_LEVELS.join(', ')}.`);
    }
    if (!INTENTS.includes(a.intent)) {
      throw new Error(`drawPlay: "${a.intent}" is not a real intent. The three are: ${INTENTS.join(', ')}.`);
    }
    const property = (worldState.properties || []).find((p) => p.id === Number(a.locationPropertyId));
    if (!property) {
      throw new Error(`drawPlay: no real property with id ${a.locationPropertyId} — a play's position has to be a real place.`);
    }
    return {
      subordinateEntityId: subordinateId,
      locationPropertyId: property.id,
      aggression: a.aggression,
      intent: a.intent,
    };
  });

  const play = {
    id: nextPlayId++,
    name,
    organization_id: organizationId,
    family_id: familyId,
    created_by_entity_id: Number(leaderEntityId),
    assignments: checked,
    tick_created: tick,
    timesRun: 0,
    timesSucceeded: 0,
  };
  (worldState.plays || (worldState.plays = [])).push(play);
  return play;
}

// Runs a previously drawn play. Every assignment gets its own real
// compliance draw (`leadership.complianceDraw`) — never a single roll
// for the whole play — so "six held their doors, one didn't show" is
// the honest, complete report this returns, the same shape
// `playbook.js#assignToPlaybook` already established for a bulk
// assignment.
function runPlay(worldState, leaderEntityId, playId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const play = (worldState.plays || []).find((p) => p.id === Number(playId));
  if (!play) throw new Error(`runPlay: no play with id ${playId}.`);

  requireRealSeat(worldState, leaderEntityId, {
    organizationId: play.organization_id, familyId: play.family_id,
  });

  const results = play.assignments.map((assignment) => {
    const { complied, gatingValue, complianceChance } = leadership.complianceDraw(
      worldState, leaderEntityId, assignment.subordinateEntityId, 'run-play', tick,
    );
    if (complied) {
      influence.raiseInfluence(worldState, leaderEntityId, assignment.subordinateEntityId);
    } else {
      influence.lowerInfluence(worldState, leaderEntityId, assignment.subordinateEntityId);
    }
    return { ...assignment, complied, gatingValue, complianceChance };
  });

  play.timesRun += 1;
  const allComplied = results.every((r) => r.complied);
  if (allComplied) play.timesSucceeded += 1;

  return { play, results, allComplied };
}

// Every real play this leader's own organization or family currently
// holds — never a second, hand-kept count (standing rule 3).
function playsOf(worldState, { organizationId = null, familyId = null } = {}) {
  return (worldState.plays || []).filter((p) => (
    organizationId != null ? p.organization_id === organizationId : p.family_id === familyId
  ));
}

module.exports = {
  AGGRESSION_LEVELS, INTENTS, MAX_PLAY_SIZE,
  capacityFor, drawPlay, runPlay, playsOf,
};
