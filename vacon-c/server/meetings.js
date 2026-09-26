// server/meetings.js
//
// **Sitting down together.** A conversation, a meeting, a sit-down, a
// planning session.
//
// ---------------------------------------------------------------------
// What the package says, and what it does not
// ---------------------------------------------------------------------
// `negotiate` is in the spec's NPC vocabulary three separate times —
// §"THE WORLD CONTINUES WITHOUT THE PLAYER" ("NPCs: work, eat, sleep,
// travel, form families, learn, teach, trade, fight, negotiate..."),
// the NPC capability list ("NPCs can independently work, learn, teach,
// trade, travel, marry... negotiate, form organizations...") and the
// decision vocabulary ("Possible decisions: trade, farm, travel,
// recruit, defend, retreat, negotiate, research, build, teach,
// explore, join organization, leave organization, form alliance,
// compete, fight"). §"NPCs remember favors, betrayals, conversations,
// victories, losses" makes a conversation a thing that is remembered.
//
// **None of it was built.** `grep -rn "negotiate\|meeting" server/`
// returned nothing before this file. Five of the six verbs those lists
// name that are about two or more people doing something TOGETHER —
// negotiate, teach, recruit, form alliance, and the sit-down the whole
// Tribe system is built on — had no home anywhere in the engine.
//
// The purposes below are exactly those verbs, and no others. `plan` is
// the one addition, and it is not an invention: it is what
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` describes a tribe doing
// before a takeover, and the spec's "The system must permit nonviolent
// solutions" is the line that makes a table worth as much as a fight.
//
// ---------------------------------------------------------------------
// It invents no modifier, and that is the whole design
// ---------------------------------------------------------------------
// The obvious way to build this would be a "planning bonus" on a
// takeover's success probability. That would be a number nobody chose,
// bolted onto a resolution whose every term is traceable — and it is
// not needed, because the loop already exists:
//
//     a meeting moves the trust between the people at it
//       -> `familyTraits.unityTarget` is the mean trust between a
//          family's own members
//       -> `advanceCohesion` converges `families.unity` on it
//       -> `cohesionOf` is the takeover key's multiplier
//
// So a tribe that sits down together really does take a building more
// easily, through four systems that were each built for their own
// reasons, and the only new number is how much one afternoon moves
// one relationship.
//
// The same is true of the other purposes. `teach` goes through
// `knowledge.study` with the teacher as the source, which is §24's
// "experienced NPCs" — a teaching meeting is that source, deliberately
// arranged. `negotiate` moves trust in both directions depending on
// what the parties already think of each other, through
// `keys.feelingToward`, which `resolveTrust` already reads.
//
// ---------------------------------------------------------------------
// What a meeting is NOT
// ---------------------------------------------------------------------
//   **Not a table.** There is no `meetings` table in the schema and
//   this file does not invent one. A meeting leaves exactly the traces
//   a meeting leaves: memories on the people who were there, with each
//   other in `related_entity_ids`, and moved relationships. That is
//   also what §"NPCs remember favors, betrayals, conversations" asks
//   for — the conversation IS the memory. An `events` row records that
//   it happened.
//
//   **Not a tick pass.** The pipeline is locked at eleven phases and
//   nothing here runs on its own. A meeting is called — by a player
//   through `actions.js`, or by `control.noteRecruitment`'s successor
//   when NPC tribes get their own agency. Until something calls it for
//   an NPC, this is a player verb, and `describeMeetings` reports how
//   many have happened so that stays visible rather than assumed
//   (standing rule 11).

'use strict';

const worldStore = require('./worldStore.js');
const knowledge = require('./knowledge.js');
const occupations = require('./occupations.js');
const keys = require('./keys.js');
const mortality = require('./mortality.js');
const { getLiveEntity } = require('./entityTraits.js');

// ---------------------------------------------------------------------
// The purposes
// ---------------------------------------------------------------------
//: Each one names the spec line it comes from, because the whole point
//: of this table is that it is not a list somebody thought up.
//:
//: `trust` is how much one afternoon moves one relationship, in points
//: on the 0-100 scale. Two is `control.SHARED_UNDERTAKING` — the same
//: figure for the same reason, and deliberately the same: doing
//: something hard together and sitting down together are the same size
//: of event, and giving them different numbers would be asserting
//: something nobody knows. `negotiate` alone can be negative, which is
//: what makes it a negotiation rather than a formality.
const PURPOSES = {
  'sit-down': {
    source: 'the Tribe sit-down COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md is built on',
    trust: 2,
    teaches: false,
    shares: true,
  },
  plan: {
    source: 'planning a takeover; "The system must permit nonviolent solutions"',
    trust: 2,
    teaches: false,
    shares: true,
  },
  negotiate: {
    source: 'spec NPC vocabulary, three times',
    trust: 2,
    teaches: false,
    shares: true,
    // The only purpose whose outcome depends on what the parties
    // already think of each other.
    contested: true,
  },
  teach: {
    source: 'spec NPC vocabulary: "learn, teach"',
    trust: 1,
    teaches: true,
    shares: true,
  },
  recruit: {
    source: 'spec decision vocabulary: "recruit"',
    trust: 2,
    teaches: false,
    shares: true,
  },
  'form alliance': {
    source: 'spec decision vocabulary: "form alliance"',
    trust: 2,
    teaches: false,
    shares: true,
  },
};

const PURPOSE_NAMES = Object.keys(PURPOSES);

//: The smallest gathering that is a meeting. Two people talking is a
//: conversation and it is in this file for that reason — the spec's own
//: word is "conversations", plural and ordinary, not "summits".
const MINIMUM_ATTENDANCE = 2;

//: The largest. Not a rule about rooms — it is that every pair at a
//: meeting has its relationship touched, which is quadratic, and a
//: meeting of the whole town would move ten thousand relationships in
//: one call while claiming everybody spoke to everybody. Twelve is the
//: point past which "they all sat down together" stops being true, and
//: a larger gathering is a `gathering` habit, which `behavior.js`
//: already models as a routine rather than an event.
const MAXIMUM_ATTENDANCE = 12;

// ---------------------------------------------------------------------
// Who can be at one
// ---------------------------------------------------------------------

// **`npcs.status` is `active | imprisoned | deceased`, and the first
// version of this tested for `'alive'`.** `generateNPC` writes
// `'active'` — the schema's own §17 vocabulary, quoted in
// `justice.js` — so the check excluded literally everybody and a
// meeting between two ordinary people was refused as a meeting of the
// dead. Caught by a fixture built with the real generator, which is
// the sixth standing rule's whole point: a fixture that constructs its
// own rows would have used whatever spelling the code under test
// expected and agreed with it forever.
//
// Being in `worldState.npcs` at all is what living means here — the
// dead are MOVED to `worldState.deceased` rather than flagged, which
// `engine.js` explains at length — so the only status this has to
// exclude is the one that keeps somebody in the array and out of the
// room. `actions.js` refuses a player serving a sentence for the same
// reason.
function attendable(npc) {
  return !!npc && npc.status !== 'imprisoned';
}

function livingAttendees(worldState, entityIds) {
  const seen = new Set();
  const out = [];
  for (const id of entityIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const npc = (worldState.npcs || []).find((n) => n.id === id);
    if (!attendable(npc)) continue;
    out.push(npc);
  }
  return out;
}

// ---------------------------------------------------------------------
// hold — one meeting
// ---------------------------------------------------------------------
// Returns what it changed, or throws for a meeting that could not take
// place. Throws rather than returning null because every caller here is
// somebody deliberately arranging one, and "it silently did not happen"
// is the shape this project keeps finding.
function hold(worldState, options = {}) {
  const {
    attendeeIds = [], purpose = 'sit-down', tick = worldState.tick ?? 0,
    topic = null, calledBy = null,
  } = options;

  const definition = PURPOSES[purpose];
  if (!definition) {
    throw new Error(`meetings: "${purpose}" is not a purpose (one of: ${PURPOSE_NAMES.join(', ')}).`);
  }

  const attendees = livingAttendees(worldState, attendeeIds);
  if (attendees.length < MINIMUM_ATTENDANCE) {
    throw new Error(
      `meetings: a ${purpose} needs at least ${MINIMUM_ATTENDANCE} people who can attend; `
      + `${attendees.length} of ${(attendeeIds || []).length} named could.`,
    );
  }
  if (attendees.length > MAXIMUM_ATTENDANCE) {
    throw new Error(
      `meetings: ${attendees.length} people is a crowd, not a meeting `
      + `(at most ${MAXIMUM_ATTENDANCE} — see MAXIMUM_ATTENDANCE).`,
    );
  }

  const ids = attendees.map((n) => n.id);
  const moved = { purpose, attendees: ids, relationships: 0, taught: [], shared: 0 };

  // ---- the relationships ------------------------------------------------
  for (let i = 0; i < attendees.length; i += 1) {
    for (let j = i + 1; j < attendees.length; j += 1) {
      const delta = trustDelta(worldState, attendees[i].id, attendees[j].id, definition);
      if (delta !== 0) {
        const rel = worldStore.adjustRelationship(
          worldState, attendees[i].id, attendees[j].id, 'social', { trust: delta },
        );
        // `adjustRelationship` adds and does not clamp — the same guard
        // `control.attempt` needs, for the same reason.
        rel.trust = Math.max(0, Math.min(100, rel.trust));
        moved.relationships += 1;
      }
      // Manipulation reads even where `delta` was 0 — a negotiation
      // between two people who already feel nothing for each other can
      // still be lopsided.
      if (definition.contested) {
        applyManipulation(worldState, attendees[i], attendees[j]);
      }
    }
  }

  // ---- what was taught --------------------------------------------------
  // §24's "experienced NPCs", deliberately arranged instead of
  // stumbled across. The teacher is whoever at the table holds the
  // deepest trade; everybody else is taught by them. Nobody teaches
  // themselves here — that is what a book is for.
  if (definition.teaches) {
    const teacher = deepestTrade(worldState, attendees);
    if (teacher) {
      const field = knowledge.fieldForSkill(
        occupations.skillOf(occupations.occupationOf(worldState, teacher.id)),
      );
      if (field) {
        for (const student of attendees) {
          if (student.id === teacher.id) continue;
          const learned = knowledge.study(worldState, student.id, {
            source: 'experienced NPCs',
            field,
            tier: occupations.tierOf(occupations.occupationOf(worldState, teacher.id)),
            via: 'person',
            teacherId: teacher.id,
          }, { tick });
          if (learned) moved.taught.push({ entityId: student.id, field });
        }
        moved.teacherId = teacher.id;
      }
    }
  }

  // ---- what was said ----------------------------------------------------
  // Everything anybody at the table knows, everybody at the table now
  // knows. A meeting is a channel, and this is the one place in the
  // engine where information moves because people chose to move it
  // rather than because it leaked outward from a broadcast.
  if (definition.shares) moved.shared = shareAround(worldState, attendees, tick);

  // ---- what they remember -----------------------------------------------
  // §"NPCs remember favors, betrayals, conversations, victories,
  // losses". The conversation IS the memory, which is why there is no
  // `meetings` table here.
  for (const npc of attendees) {
    worldStore.addMemory(worldState, {
      entityId: npc.id,
      memoryType: definition.contested ? 'neutral' : 'positive',
      category: 'social',
      description: topic
        ? `sat down with ${ids.length - 1} others about ${topic}`
        : `sat down with ${ids.length - 1} others to ${purpose}`,
      importance: MEETING_IMPORTANCE,
      emotionLevel: definition.trust,
      relatedEntityIds: ids.filter((id) => id !== npc.id),
      tick,
    });
  }

  return {
    ...moved,
    calledBy,
    topic,
    tick,
    events: [{
      type: 'meeting_held',
      severity: 'low',
      note: `${ids.length} people met to ${purpose}${topic ? ` about ${topic}` : ''}`,
      tick,
      affected_entity_ids: ids,
      global_effects: {
        purpose, topic, calledBy, taught: moved.taught.length, shared: moved.shared,
      },
    }],
  };
}

//: How much a meeting matters to somebody, on `memories.importance`'s
//: 0-100. Low: a sit-down is an ordinary event, and a memory system
//: where every conversation is as important as a death is a memory
//: system that cannot rank anything. `crime.js` writes a victim's
//: memory at the offence's own severity, which runs far above this.
const MEETING_IMPORTANCE = 20;

// What one pair takes away from it. Everything but a negotiation is
// worth the same to everybody; a negotiation is worth what the two of
// them already thought of each other.
//
// `keys.feelingToward` reads the memories one entity holds about
// another and returns -1..1, or null for two people with no history.
// It is what `resolveTrust` uses to decide whether a firmly-known fact
// should raise or lower trust, and it is exactly the right question
// here: two people who have wronged each other do not leave a
// negotiation closer.
function trustDelta(worldState, a, b, definition) {
  if (!definition.contested) return definition.trust;
  const feeling = keys.feelingToward(worldState, a, b);
  // No history at all: a negotiation between strangers is a
  // negotiation, and it goes the ordinary way.
  if (feeling === null) return definition.trust;
  return Math.round(definition.trust * feeling * 100) / 100;
}

// ---------------------------------------------------------------------
// Manipulation — the asymmetric edge a shared trust field cannot hold
// ---------------------------------------------------------------------
// `relationships.trust` is one number for the pair — every write in
// this file and every other module that touches a relationship applies
// the same delta to both parties, because there is only one row.
// "The manipulator comes out ahead at the other's expense" cannot live
// there. `relationships.debt` can: a real schema column, initialised to
// 0 by `worldStore.getOrCreateRelationship` and, before this, written
// and read by nothing anywhere in `server/` (confirmed by grep — every
// other `.debt` hit in the codebase is `individual_finances.debt`, an
// unrelated field). It is the schema's own home for "one of us owes the
// other," which is exactly what a lopsided negotiation leaves behind.
//
// Only `negotiate` reads it (`definition.contested` in the caller) —
// a teaching session or a sit-down has no side for Manipulation to
// favor.
//: How much of a Manipulation edge, in points, before a negotiation
//: counts as lopsided rather than merely uneven. Below this, ordinary
//: variance between two people is not manipulation.
const MANIPULATION_EDGE = 20;
//: How much debt one lopsided negotiation creates. This file's own
//: convention above is "one afternoon moves a relationship by about 2
//: points" (`trust: 2` on every non-contested purpose); a manipulator
//: walking away owed a favor is a comparably sized event, not a
//: life-changing one.
const MANIPULATION_DEBT = 2;

function manipulationOf(entity) {
  return entity?.traits?.psychological?.Manipulation ?? 50;
}

// `rel.debt`'s sign convention, since nothing else had ever set one:
// positive means `entity_b_id` owes `entity_a_id`. `a`/`b` are this
// call's own arguments and may not match `entity_a_id`/`entity_b_id`'s
// order — `getOrCreateRelationship` fixes that order on whichever
// caller reaches a pair first, which can be an earlier, unrelated
// event.
function applyManipulation(worldState, a, b) {
  const edge = manipulationOf(getLiveEntity(worldState, a.id))
    - manipulationOf(getLiveEntity(worldState, b.id));
  if (Math.abs(edge) < MANIPULATION_EDGE) return;
  const rel = worldStore.adjustRelationship(worldState, a.id, b.id, 'social', {});
  const aIsRelA = a.id === rel.entity_a_id;
  // edge > 0: `a` manipulated `b`, so `b` now owes `a`.
  const bOwesA = edge > 0;
  rel.debt += (bOwesA === aIsRelA) ? MANIPULATION_DEBT : -MANIPULATION_DEBT;
}

// Whoever holds the highest-tier occupation at the table, ties broken
// by id so a replay teaches the same lesson. Null if nobody works.
function deepestTrade(worldState, attendees) {
  let best = null;
  let bestTier = 0;
  for (const npc of attendees) {
    const occupation = occupations.occupationOf(worldState, npc.id);
    const tier = occupation ? occupations.tierOf(occupation) : 0;
    if (tier > bestTier || (tier === bestTier && best && npc.id < best.id)) {
      best = npc;
      bestTier = tier;
    }
  }
  return bestTier > 0 ? best : null;
}

// Everything anybody at the table knows about somebody NOT at the
// table, passed to everybody who does not already know it.
//
// Facts about the people in the room are deliberately excluded: a
// meeting is not an interrogation, and "everybody now knows everything
// about everybody present" is the kind of total-information sweep that
// made `computeApproval`'s spread a constant 1.0.
function shareAround(worldState, attendees, tick) {
  const ids = new Set(attendees.map((n) => n.id));
  let shared = 0;

  const pool = [];
  for (const npc of attendees) {
    for (const row of (worldState.entityKnowledge || [])) {
      if (row.entity_id !== npc.id) continue;
      if (row.subject_entity_id !== null && ids.has(row.subject_entity_id)) continue;
      pool.push({ from: npc.id, row });
    }
  }

  for (const { from, row } of pool) {
    for (const npc of attendees) {
      if (npc.id === from) continue;
      const already = (worldState.entityKnowledge || []).some(
        (k) => k.entity_id === npc.id && k.fact_content === row.fact_content,
      );
      if (already) continue;
      worldStore.addKnowledge(worldState, {
        entityId: npc.id,
        subjectEntityId: row.subject_entity_id ?? null,
        factType: row.fact_type,
        factContent: row.fact_content,
        // Heard from somebody in the room, so it carries their
        // confidence degraded by the distortion the telling adds —
        // the same treatment `media.runWordOfMouth` gives a retelling,
        // because it is the same act.
        confidenceLevel: Math.max(0, Number(row.confidence_level ?? 0.5)
          * (1 - Number(row.distortion_level ?? 0))),
        sourceEntityId: from,
        spreadRate: row.spread_rate ?? null,
        distortionLevel: row.distortion_level ?? null,
        tick,
      });
      shared += 1;
    }
  }

  return shared;
}

// ---------------------------------------------------------------------
// Who could be at one
// ---------------------------------------------------------------------
// The people somebody could actually sit down with: the living, in the
// same community, who are old enough to be party to anything. Offered
// as a list because a player has to choose attendees and guessing ids
// is not a user interface.
function couldAttend(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return [];
  return (worldState.npcs || []).filter((other) => {
    if (other.id === entityId) return false;
    if (!attendable(other)) return false;
    if (other.communityId !== npc.communityId) return false;
    const age = mortality.ageInYears(worldState, other, tick);
    return age !== null && age >= ATTENDANCE_AGE;
  });
}

//: Old enough to be party to a meeting. `control.WORKING_AGE` is 16
//: and this is the same threshold for the same reason — there is no
//: second opinion in the engine about when somebody counts as an
//: adult, and inventing one here would make two.
const ATTENDANCE_AGE = 16;

// ---------------------------------------------------------------------
// describeMeetings
// ---------------------------------------------------------------------
// **Standing rule 11's guard on this file specifically.** Nothing in
// the tick calls `hold`, so until a player does, or until NPC tribes
// get their own agency, this system is real and unexercised. Counting
// the meetings in a world's event log is how that stays a visible fact
// rather than an assumption.
function describeMeetings(worldState) {
  const held = (worldState.events || []).filter((e) => e.type === 'meeting_held');
  const byPurpose = {};
  for (const event of held) {
    const purpose = event.global_effects?.purpose ?? 'unknown';
    byPurpose[purpose] = (byPurpose[purpose] ?? 0) + 1;
  }
  return {
    purposes: PURPOSE_NAMES.length,
    held: held.length,
    byPurpose,
    taught: held.reduce((sum, e) => sum + (e.global_effects?.taught ?? 0), 0),
    shared: held.reduce((sum, e) => sum + (e.global_effects?.shared ?? 0), 0),
  };
}

module.exports = {
  PURPOSES,
  PURPOSE_NAMES,
  MINIMUM_ATTENDANCE,
  MAXIMUM_ATTENDANCE,
  MEETING_IMPORTANCE,
  ATTENDANCE_AGE,
  attendable,
  livingAttendees,
  trustDelta,
  deepestTrade,
  shareAround,
  couldAttend,
  hold,
  describeMeetings,
};
