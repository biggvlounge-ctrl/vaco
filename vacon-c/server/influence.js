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
const areaStats = require('./areaStats.js');
const mortality = require('./mortality.js');
const { getLiveEntity } = require('./entityTraits.js');

function clamp0to100(x) {
  return Math.max(0, Math.min(100, x));
}

// ---------------------------------------------------------------------
// Weights — sum to 1.0, so influenceRatingOf stays on the same 0-100
// scale as every other relationship dimension without a separate
// rescale step. Re-balanced for tasks #150/#235 (closing this file's
// own real "aura"/local-prominence gap): the original three weighted
// 0.3/0.4/0.3; AURA_WEIGHT and LOCAL_PROMINENCE_WEIGHT are carved out
// of OCCUPATION_WEIGHT and SOCIAL_WEIGHT rather than ORG_WEIGHT,
// because leading a real organization is already the single strongest,
// most concrete real signal this rating has, and diluting it to make
// room for two smaller, newer terms would be backwards.
// ---------------------------------------------------------------------
const OCCUPATION_WEIGHT = 0.25;
const ORG_WEIGHT = 0.4;
const SOCIAL_WEIGHT = 0.25;
const AURA_WEIGHT = 0.07;
const LOCAL_PROMINENCE_WEIGHT = 0.03;

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

// ---------------------------------------------------------------------
// Task #235 — a real word-of-mouth/fame "aura" component, distinct
// from SOCIAL_TRAITS above
// ---------------------------------------------------------------------
// Checked directly before building: `grep -rln "aura" server/*.js`
// before this hit `landmarks.js`/`discovery.js` only by matching
// "restaurant", never a real concept — task #206 built fear (into
// `leadership.js#directMission`'s compliance chance), not the
// word-of-mouth/fame half this task names, and `influenceRatingOf`
// itself had no such term. `reputation.Notoriety` is the real,
// already-generated trait that means exactly this — how KNOWN
// somebody is, independent of whether that fame is earned by charm
// (already SOCIAL_TRAITS' job) or by something else entirely. Reusing
// it rather than averaging it into SOCIAL_TRAITS keeps the two
// concepts separate the way this file's own header already keeps
// Charisma/Persuasion (moving people) apart from Reputation/Network
// Reach (how many people there are to move) — Notoriety is a third,
// different thing: whether people who have never met this person have
// still heard of them.
const AURA_TRAIT = 'Notoriety';

// ---------------------------------------------------------------------
// Task #150 — a real per-community "local prominence" boost, for the
// task's own named archetypes, plus a youth-popularity analogue
// ---------------------------------------------------------------------
// The task names six archetypes (athletes, musicians, business wealth,
// clergy, politicians, criminal hierarchy) and a youth-specific pair
// (star athlete, prom king/queen). Five of the six map onto real,
// already-existing `occupations.js` entries at this taxonomy's own
// grain — `manager` is the honest substitute for "business wealth":
// this taxonomy has no dedicated "owner"/"entrepreneur" occupation,
// checked directly rather than assumed, so the closest real leadership
// role in a business is reused instead of inventing one. "Criminal
// hierarchy" needs no new entry at all — leading ANY real organization
// (already `ledOrgs` above, gang/cartel included) already identifies
// that hierarchy; this file does not re-derive it a second way.
const VISIBLE_OCCUPATIONS = ['athlete', 'entertainer', 'preacher', 'politician', 'manager'];

// The real default `worldgen.js` config (`populationPerCommunity: 30`)
// is the reference population a "normal" community has — a visible
// local figure in a community at that size gets the neutral ×1
// multiplier, smaller communities scale up (same person, same real
// visibility, carries further in a town of ten than a town of thirty),
// larger ones scale down. Measured from this engine's own real
// default rather than picked to sound right.
const LOCAL_PROMINENCE_REFERENCE_POPULATION = 30;
// Bounded the same way every other real multiplier in this registry
// is (`nightLightsPacks.ACTIVITY_MULTIPLIER_BOUNDS`,
// `crimeHotspotPacks.weightFor`) — a tiny hamlet does not get
// unbounded local fame, it gets a real, capped boost.
const LOCAL_PROMINENCE_CAP = 3;

// Youth popularity: the task's own two named examples (star athlete,
// prom king/queen) map onto `sports` (Speed/Coordination/Competitive
// Drive/Team Chemistry/Injury Resistance, averaged the same way
// `efficiency`/SOCIAL_TRAITS already are) and `social.Charisma`
// specifically — Charisma alone, not the whole SOCIAL_TRAITS list,
// because "well-liked" is a narrower, more on-topic claim than
// "persuasive" or "well-connected" for a teenager with no real
// occupation or organization yet to be judged by. Either real measure
// above the trait scale's own centre (standing rule 12) counts — a
// kid does not need to be both to be the one people talk about.
const YOUTH_SPORTS_TRAITS = ['Speed', 'Coordination', 'Competitive Drive', 'Team Chemistry', 'Injury Resistance'];
// 5 is `statecraft.SCHOOL_AGE_MIN`, reused by value rather than by
// import to avoid a backwards dependency (an economy-tier file
// requiring a higher-level statecraft module); 18 mirrors
// `tutorialMissions.CHILD_SCHOOL_AGE_MAX` for the identical real
// reason that file states it — the question here is "a literal
// school-age teenager", not `statecraft.SCHOOL_AGE_MAX` (30)'s much
// broader "could still realistically be in school during the
// reemergence era," which is a different real question this
// component is not asking.
const YOUTH_POPULARITY_MIN_AGE = 5;
const YOUTH_POPULARITY_MAX_AGE = 18;

//: How much one real event moves one relationship's influence. Reused
//: from `meetings.js`'s own `PURPOSES` table / `control.SHARED_
//: UNDERTAKING` — see this file's header for why the number is not
//: re-guessed per call site.
const INFLUENCE_DELTA = 2;

//: A broadcast's weight — deliberately half a direct interaction's,
//: see the header.
const BROADCAST_INFLUENCE_DELTA = 1;

//: How much more a parent or sibling starts with than the baseline
//: `influenceRatingOf` already gives a brand-new relationship (which a
//: cousin or aunt/uncle gets as-is, no bonus — see
//: `characterCreation.js`'s own header: cousins are real people, not
//: strangers, but immediate family is closer still, by direct
//: instruction). Five real `INFLUENCE_DELTA`-sized events' worth,
//: reused rather than re-guessed for the same reason `INFLUENCE_DELTA`
//: itself is reused from `meetings.js`/`control.SHARED_UNDERTAKING`: a
//: childhood of small, ordinary moments is not literally five events,
//: but it is not zero either, and the number is named here rather than
//: hidden inside an unlabelled bonus.
const IMMEDIATE_FAMILY_BOND_BONUS = INFLUENCE_DELTA * 5;

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

  // Task #235's aura component — see the constant's own comment.
  const auraValue = Number(live?.traits?.reputation?.[AURA_TRAIT] ?? 50);
  const auraComponent = auraValue * AURA_WEIGHT;

  // Task #150's local-prominence component — see VISIBLE_OCCUPATIONS'
  // own comment. Reuses `occupation`/`ledOrgs` already computed above
  // rather than re-deriving either.
  const localProminenceComponent = localProminenceOf(
    worldState, entityId, { occupation, hasOrgLeadership: ledOrgs.length > 0, live },
  ) * LOCAL_PROMINENCE_WEIGHT;

  return clamp0to100(
    occupationComponent + orgComponent + socialComponent + auraComponent + localProminenceComponent,
  );
}

// A real community population to scale against is required for ANY
// local prominence at all — declared 0, not defaulted to neutral,
// when an entity has no real `communityId` (this file's own test
// fixtures included) or that community genuinely has nobody in it.
// "Local" prominence with no real locality to be prominent WITHIN is
// not a smaller version of the real thing, it is a different claim
// this file does not make.
function localProminenceOf(worldState, entityId, { occupation, hasOrgLeadership, live }) {
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc || npc.communityId == null) return 0;
  const population = areaStats.residentsOf(worldState, npc.communityId).length;
  if (population <= 0) return 0;
  const populationScale = Math.min(
    LOCAL_PROMINENCE_CAP,
    LOCAL_PROMINENCE_REFERENCE_POPULATION / population,
  );

  // Adult (or occupied) path: a real visible occupation or real
  // organization leadership, scaled by how small the real community
  // is — the task's own six named archetypes.
  if ((occupation && VISIBLE_OCCUPATIONS.includes(occupation)) || hasOrgLeadership) {
    return Math.min(100, 100 * populationScale);
  }

  // Youth path: a school-age resident with no real occupation yet
  // (nothing to be visible THROUGH otherwise) — the task's own
  // "star athlete, prom king/queen" examples.
  if (!occupation) {
    const age = mortality.ageInYears(worldState, npc, worldState.tick ?? 0);
    if (age !== null && age >= YOUTH_POPULARITY_MIN_AGE && age < YOUTH_POPULARITY_MAX_AGE) {
      const sports = live?.traits?.sports ?? {};
      const sportsValues = YOUTH_SPORTS_TRAITS
        .map((name) => Number(sports[name]))
        .filter(Number.isFinite);
      const sportsAvg = sportsValues.length > 0
        ? sportsValues.reduce((a, b) => a + b, 0) / sportsValues.length
        : 50;
      const charisma = Number(live?.traits?.social?.Charisma ?? 50);
      const youthScore = Math.max(sportsAvg, charisma);
      // Centred on 50 (standing rule 12), 0..1, same shape every other
      // modulator in this engine normalises a trait average into.
      const normalized = Math.max(0, (youthScore - 50) / 50);
      return Math.min(100, normalized * 100 * populationScale);
    }
  }

  return 0;
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

// ---------------------------------------------------------------------
// seedFamilyBond — the real `relationships.relationship_type: 'family'`
// link `characterCreation.js` needs, seeded from the real baseline
// (and, for immediate family, the real bonus) rather than left at the
// schema's flat `influence: 0` — see IMMEDIATE_FAMILY_BOND_BONUS above.
// ---------------------------------------------------------------------
// Deliberately NOT built on `raiseInfluence`: that function always
// creates a brand-new pair under `relationship_type: 'social'` (see its
// own header), and a family link is correctly `'family'` instead — a
// different real schema value, not an oversight to route around.
// Seeded exactly once per pair, the same "existedAlready" guard every
// other seeding path here already uses, so calling this a second time
// on the same real pair never clobbers whatever has genuinely
// accumulated since.
function seedFamilyBond(worldState, entityAId, entityBId, options = {}) {
  const { immediate = false } = options;
  const existedAlready = !!worldStore.findRelationship(worldState, entityAId, entityBId);
  const rel = worldStore.adjustRelationship(worldState, entityAId, entityBId, 'family', {});
  if (!existedAlready) {
    const bonus = immediate ? IMMEDIATE_FAMILY_BOND_BONUS : 0;
    rel.influence = clamp0to100(influenceRatingOf(worldState, entityAId) + bonus);
    if (immediate) {
      rel.trust = clamp0to100(Number(rel.trust) + IMMEDIATE_FAMILY_BOND_BONUS);
      rel.respect = clamp0to100(Number(rel.respect) + IMMEDIATE_FAMILY_BOND_BONUS);
      rel.loyalty = clamp0to100(Number(rel.loyalty) + IMMEDIATE_FAMILY_BOND_BONUS);
    }
  }
  return rel;
}

module.exports = {
  OCCUPATION_WEIGHT,
  ORG_WEIGHT,
  SOCIAL_WEIGHT,
  AURA_WEIGHT,
  LOCAL_PROMINENCE_WEIGHT,
  ORG_SIZE_CAP,
  SOCIAL_TRAITS,
  AURA_TRAIT,
  VISIBLE_OCCUPATIONS,
  LOCAL_PROMINENCE_REFERENCE_POPULATION,
  LOCAL_PROMINENCE_CAP,
  YOUTH_SPORTS_TRAITS,
  YOUTH_POPULARITY_MIN_AGE,
  YOUTH_POPULARITY_MAX_AGE,
  localProminenceOf,
  INFLUENCE_DELTA,
  BROADCAST_INFLUENCE_DELTA,
  IMMEDIATE_FAMILY_BOND_BONUS,
  influenceRatingOf,
  personalInfluenceOf,
  familyPoliticalInfluenceOf,
  raiseInfluence,
  lowerInfluence,
  seedFamilyBond,
};
