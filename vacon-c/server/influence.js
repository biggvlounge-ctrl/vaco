// server/influence.js
//
// The influence economy. Every entity — every NPC, every player avatar
// (a player is just an NPC with a `players` row pointing at it, no
// special case) — has real, growing influence over the specific people
// they actually interact with, starting from a real baseline that
// varies by who they are, never a flat zero for everyone and never an
// invented flag.
//
// ---------------------------------------------------------------------
// Two real, already-schema-defined columns that sat completely dormant
// ---------------------------------------------------------------------
// `relationships.influence` (NUMERIC DEFAULT 0) and
// `families.political_influence` (NUMERIC DEFAULT 0) have been in
// `VACANCY_POSTGRESQL_SCHEMA.sql` since this project's first version.
// `grep -rn "\.influence\b" server/*.js` before this file returned
// exactly one place either was ever READ (the family column, only by
// `migrate.js`'s own round-trip persistence, which reads back whatever
// was already there) and never a real WRITE beyond the generation-time
// default. This file is what finally reads and writes them for real.
//
// **`relationships.influence` is a single shared value per pair, not
// two independent directional numbers — the same model this engine
// already uses for `trust`, `respect` and `loyalty`.** `leadership.js`'s
// own `directMission` already reads a subordinate's `loyalty` "toward
// their leader" from this same single-field, order-independent table,
// and that is the established precedent this file follows rather than
// inventing a second, directional influence table the schema does not
// have. A call like `raiseInfluence(worldState, a, b, delta)` moves the
// ONE number the pair (a, b) shares; which argument is "a" only matters
// for seeding a brand-new row (see below), never for which direction
// the stored value points, because it does not point.
//
// **Where a new relationship's influence starts is the real thing that
// had to be built, not left at the schema's bare 0.** `influenceRatingOf`
// is a real, derived, NEVER-STORED rating (standing rule 3 — the exact
// treatment `economy.getNetWorth`/`engine.getFamilyWealth` already give
// every other computed rollup), built from three real things every NPC
// already carries: their real occupation tier (`occupations.js`), the
// real organization they lead if any (`organizations.leader_id`,
// `organizations.influence`, real member count), and their real
// `social` trait family (Charisma, Reputation, Network Reach,
// Persuasion — generated for every NPC, player avatar included). A
// gang leader starts a brand-new relationship carrying more influence
// than a janitor does, because the rating that seeds it says so, not
// because anybody typed a bigger number for "leaders."
//
// `seedInfluenceIfNew` is the one place that rating is actually
// applied: the FIRST time two specific entities' relationship is ever
// touched by this file's own raise/lower, the brand-new row (which
// `worldStore.getOrCreateRelationship` would otherwise leave at its
// generic `influence: 0`) is overwritten with the acting entity's own
// `influenceRatingOf` before the event's own delta is applied on top.
// `worldStore.js` itself is NOT changed — every other caller of
// `getOrCreateRelationship`/`adjustRelationship` keeps the exact
// behaviour it always had, which is what every existing test in this
// project already asserts about it.
//
// ---------------------------------------------------------------------
// Growth and decay — specific real events, never a tick-driven drift
// ---------------------------------------------------------------------
// `INFLUENCE_DELTA` is the same magnitude `meetings.js`'s own
// `PURPOSES` table and `control.SHARED_UNDERTAKING` already use for
// "how much one real event moves one relationship" (2 points, on the
// 0-100 scale every other relationship dimension here uses) — reused
// rather than re-guessed, for the exact reason `meetings.js`'s header
// gives: "giving two events of the same size different numbers would be
// asserting something nobody knows." `BROADCAST_INFLUENCE_DELTA` is
// deliberately half that: a broadcast reaches many people at once but
// shallowly (one outlet, no real conversation), where a direct
// interaction — a meeting, a mission actually carried out, a contest
// actually fought — reaches one person but deeply. Giving a broadcast
// the SAME weight as standing in the same room would say a radio spot
// moves a relationship as much as actually meeting someone, which
// nobody has measured and this file does not assert.
//
// Wired into five real, already-existing events, raising or lowering
// the one real number each already produces a real outcome for:
//
//   - `meetings.js`'s `negotiate`/`recruit` purposes, alongside the
//     trust `hold()` already moves — on the SAME sign as the real
//     `trustDelta` it already computes, so a negotiation that already
//     moves trust down (two people with real bad history — the one
//     purpose whose delta can go negative, per `trustDelta`'s own
//     code) now moves influence down too, never invented separately.
//     `recruit` has no contested branch at all in `PURPOSES` — its
//     `trustDelta` is always the flat positive figure — so it only
//     ever raises influence; this file does not invent a failure mode
//     `meetings.js` itself does not have.
//   - `leadership.js#directMission` — a compliance raises influence
//     between leader and subordinate; a refusal lowers it. True on
//     BOTH of `directMission`'s paths: the existing org-leader path
//     (compliance still gated on `loyalty`, exactly as before) and the
//     new organization-free path this file makes possible (compliance
//     gated on the pair's own real influence instead — see below).
//   - `media.js#broadcast` — the source's influence over every real
//     person the broadcast actually reached rises, at the smaller
//     broadcast weight.
//   - a resolved contest (`engine.js#resolveContest`) — the winner's
//     influence over each loser rises. There is deliberately no
//     separate "the loser's influence falls" call: `influence` is the
//     one shared number the pair already has, so raising it once IS
//     the loss from the other side — a second, opposite-signed call on
//     the same event would cancel its own effect, which is worth
//     stating plainly rather than silently getting half right.
//
// ---------------------------------------------------------------------
// Directing someone with no organization at all — influence as its own
// real gate, with no invented cutoff
// ---------------------------------------------------------------------
// `leadership.js`'s own header already explains why ordering someone
// always succeeding would be a mechanic that asserts something nobody
// measured. The organization-free path in `directMission` reuses the
// exact same shape: it never tests influence against a fitted number
// ("70 sounds high enough") — that specific mistake is this project's
// own seventeenth standing rule, the `resolveAggression` escalation-
// floor case study, and the fix there was never "pick a better
// number", it was removing the need for one. Influence is mapped
// straight onto `[0,1]` as a real probability and run through the same
// `seededDraw` every other determined-but-uncertain outcome in this
// engine already uses — so there is no threshold anywhere to have
// guessed wrong about, only a number that is more often true than not
// once it is actually high.

'use strict';

const occupations = require('./occupations.js');
const membership = require('./membership.js');
const worldStore = require('./worldStore.js');
const { getLiveEntity } = require('./entityTraits.js');

function clamp0to100(x) {
  return Math.max(0, Math.min(100, x));
}

// ---------------------------------------------------------------------
// Weights — sum to 1.0, so influenceRatingOf stays on the same 0-100
// scale as every other relationship dimension without a separate
// rescale step.
// ---------------------------------------------------------------------
const OCCUPATION_WEIGHT = 0.3;
const ORG_WEIGHT = 0.4;
const SOCIAL_WEIGHT = 0.3;

// A leader's own organization contributes by its real influence column
// (0-100, already wired and correct — see media.js's outletReach for
// the one place it is already read) and by its real member count,
// split 70/30: an organization with real reach but few people is still
// mostly its own reach, and a large membership with no real influence
// of its own is not a leader's personal power, it is a crowd.
// SIZE_CAP is the member count at which the size term maxes out — a
// street gang's real leader and a national party's real leader both
// cap here rather than the second scaling forever past the first;
// twenty is the same order of magnitude `meetings.js`'s own
// MAXIMUM_ATTENDANCE (12) draws the line at for "this is still a
// gathering, not a crowd", one tier up for "this is still a
// leadership, not a census".
const ORG_SIZE_CAP = 20;
const ORG_SIZE_SHARE = 0.3;
const ORG_REACH_SHARE = 1 - ORG_SIZE_SHARE;

// Which real `social` traits contribute to the personal component, and
// why these four: Charisma and Persuasion are directly about moving
// other people; Reputation and Network Reach are directly about how
// many people there are to move. The other eleven `social` dimensions
// (Group Loyalty, Social Mobility) are about the person's OWN standing
// inside a group, not their pull over individuals, so they are left
// out rather than averaged in and quietly diluting the four that are
// actually on-topic.
const SOCIAL_TRAITS = ['Charisma', 'Persuasion', 'Reputation', 'Network Reach'];

//: How much one real event moves one relationship's influence. Reused
//: from `meetings.js`'s own `PURPOSES` table / `control.SHARED_
//: UNDERTAKING` — see this file's header for why the number is not
//: re-guessed per call site.
const INFLUENCE_DELTA = 2;

//: A broadcast's weight — deliberately half a direct interaction's,
//: see the header.
const BROADCAST_INFLUENCE_DELTA = 1;

// ---------------------------------------------------------------------
// influenceRatingOf — a real, derived, NEVER-STORED baseline
// ---------------------------------------------------------------------
function influenceRatingOf(worldState, entityId) {
  const occupation = occupations.occupationOf(worldState, entityId);
  const tier = occupation ? occupations.tierOf(occupation) : 0;
  const occupationComponent = (tier / occupations.TIER_COUNT) * 100 * OCCUPATION_WEIGHT;

  const ledOrgs = (worldState.organizations || [])
    .filter((o) => o.leader_id === Number(entityId));
  let orgComponent = 0;
  if (ledOrgs.length > 0) {
    // The organization that gives the most real reach, when someone
    // leads more than one — the same "best one carries it" posture
    // `media.js#outletReach` already takes for a world with several
    // outlets.
    const best = ledOrgs.reduce(
      (a, b) => ((Number(b.influence) || 0) > (Number(a.influence) || 0) ? b : a),
    );
    const reach = Number(best.influence) || 0;
    const memberCount = membership.memberCount(worldState, best.id);
    const sizeBoost = (Math.min(memberCount, ORG_SIZE_CAP) / ORG_SIZE_CAP) * 100;
    orgComponent = (reach * ORG_REACH_SHARE + sizeBoost * ORG_SIZE_SHARE) * ORG_WEIGHT;
  }

  const live = getLiveEntity(worldState, entityId);
  const social = live?.traits?.social ?? {};
  const socialValues = SOCIAL_TRAITS
    .map((name) => Number(social[name]))
    .filter(Number.isFinite);
  // 50 (the trait scale's own centre, standing rule 12) when nothing
  // has been generated at all — unknown is not a zero, the same
  // corollary CLAUDE.md states for `moodFor()`.
  const socialAvg = socialValues.length > 0
    ? socialValues.reduce((a, b) => a + b, 0) / socialValues.length
    : 50;
  const socialComponent = socialAvg * SOCIAL_WEIGHT;

  return clamp0to100(occupationComponent + orgComponent + socialComponent);
}

// ---------------------------------------------------------------------
// personalInfluenceOf / familyPoliticalInfluenceOf — real, computed
// rollups, never independently stored (standing rule 3)
// ---------------------------------------------------------------------
// The sum of the real influence this entity actually holds across
// every relationship they are a real party to — not the baseline
// rating above, which is what a BRAND NEW relationship starts from,
// but what has actually accumulated across every real interaction so
// far.
function personalInfluenceOf(worldState, entityId) {
  return (worldState.relationships || [])
    .filter((r) => r.entity_a_id === entityId || r.entity_b_id === entityId)
    .reduce((sum, r) => sum + (Number(r.influence) || 0), 0);
}

// `families.political_influence` stays at its real schema default (0)
// forever and is never written — the exact treatment `families.wealth`
// already gets from `engine.getFamilyWealth`. The mean, not the sum, of
// living members' own personalInfluenceOf: a family of five ordinary
// people should not outrank a family of one real power broker just by
// having more members, which summing would do.
function familyPoliticalInfluenceOf(worldState, familyId) {
  const memberIds = (worldState.familyMemberships || [])
    .filter((m) => m.family_id === familyId)
    .map((m) => m.entity_id)
    .filter((id) => (worldState.npcs || []).some((n) => n.id === id));
  if (memberIds.length === 0) return 0;
  const total = memberIds.reduce((sum, id) => sum + personalInfluenceOf(worldState, id), 0);
  return total / memberIds.length;
}

// ---------------------------------------------------------------------
// raiseInfluence / lowerInfluence — the one real write path
// ---------------------------------------------------------------------
// Seeds a brand-new pair from the ACTING entity's own real rating
// before applying delta on top, exactly once — an existing row is just
// adjusted and clamped, same as every other relationship dimension.
function raiseInfluence(worldState, actorId, targetId, delta = INFLUENCE_DELTA) {
  const existedAlready = !!worldStore.findRelationship(worldState, actorId, targetId);
  const rel = worldStore.adjustRelationship(worldState, actorId, targetId, 'social', { influence: delta });
  if (existedAlready) {
    rel.influence = clamp0to100(Number(rel.influence));
  } else {
    // `adjustRelationship` just created this row via `getOrCreateRelationship`
    // at the schema's generic `influence: 0` and added `delta` on top of
    // it. Overwrite with the real baseline instead of leaving the flat
    // default underneath a real event.
    rel.influence = clamp0to100(influenceRatingOf(worldState, actorId) + delta);
  }
  return rel;
}

function lowerInfluence(worldState, actorId, targetId, delta = INFLUENCE_DELTA) {
  return raiseInfluence(worldState, actorId, targetId, -Math.abs(delta));
}

module.exports = {
  OCCUPATION_WEIGHT,
  ORG_WEIGHT,
  SOCIAL_WEIGHT,
  ORG_SIZE_CAP,
  SOCIAL_TRAITS,
  INFLUENCE_DELTA,
  BROADCAST_INFLUENCE_DELTA,
  influenceRatingOf,
  personalInfluenceOf,
  familyPoliticalInfluenceOf,
  raiseInfluence,
  lowerInfluence,
};
