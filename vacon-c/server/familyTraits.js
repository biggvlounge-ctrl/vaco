// server/familyTraits.js
//
// Family-tier trait data — locked Day 1 step 6 ("build the minimal
// Family Engine"). VACANCY_TRAIT_DATABASE_ATTACHMENT.md's
// FAMILY_TRAIT_FAMILIES lists 10 dimensions: unity, loyalty,
// reputation, wealth, resources, traditions, leadership,
// generationalKnowledge, cooperation, conflictLevel.
//
// Applying the lesson from step 5's correction (see
// dev-docs/phase-5-organization-trait-sheet/tasks.md): cross-check
// each dimension against `families`' own columns in
// VACANCY_POSTGRESQL_SCHEMA.sql *before* deciding it needs an
// entity_traits row. Four don't:
//   - unity      -> families.unity      (DEFAULT 50, real column)
//   - reputation -> families.reputation (DEFAULT 50, real column)
//   - conflictLevel -> families.conflict (DEFAULT 0, real column;
//                       name differs slightly but is unambiguously
//                       the same concept — there's no other candidate)
//   - wealth     -> families.wealth, and explicitly NOT a directly-set
//                   value at all — the schema comments it "computed
//                   rollup from individual_finances of members, not
//                   independently tracked", which is standing rule 3
//                   verbatim ("Never duplicate computable rollups...
//                   Family Wealth are all computed, never stored").
//                   engine.js#getFamilyWealth() computes this live;
//                   nothing stores a wealth field on the family object.
// A fifth, `traditions`, maps to families.traditions but that column
// is JSONB, not a 0-100 score — structurally a list of traditions, not
// a trait. Handled as its own field (default `[]`), not an
// entity_traits row.
//
// That leaves 5 dimensions with no dedicated column anywhere in the
// schema — these go through entity_traits, same pattern as
// Organization's remaining 9.
//
// =====================================================================
// COHESION — and the two constants that made the mapping above a lie
// =====================================================================
//
// **`families.unity` was 50 on every family in every world, and
// `families.conflict` was 0.** `generateFamily` sets both and
// `grep -rn "\.unity" server/` returned two hits before this section
// existed: the line above, and `players.js` reporting the number to a
// client. Nothing in the engine ever moved either one.
//
// That is standing rule 14's shape and it matters because of what reads
// them. `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` specifies the
// takeover key's second factor as "the Tribe's actual internal
// cohesion... using the existing Family/Tribe trait fields already
// built (unity, cooperation, conflictLevel) as a real, direct
// multiplier on whether an attempt actually succeeds". A multiplier
// built on those fields as they stood would have been
// `(50 + cooperation) / 2 * (1 - 0)` — one live term out of three, and
// the same near-constant for every tribe in the world. The document's
// whole argument is that a takeover must be able to fail because the
// people do not work together, and it could not have.
//
// ---------------------------------------------------------------------
// A stock with momentum, not a rollup — which is why it is stored
// ---------------------------------------------------------------------
// Standing rule 3 forbids storing what can be computed, and the honest
// question here is whether unity is just the mean trust between family
// members. It is not, for the same reason `statecraft` keeps `tourism`
// separate from `tourismAppeal`: `unityTarget` is what a family's
// relationships currently JUSTIFY, and `families.unity` is what the
// family currently HAS. A household that fell out last winter does not
// feel like a different family the following morning. The gap between
// the two is the thing, and `advanceCohesion` closes it slowly.
//
// **The rate has to be slower than its own inputs.** Relationship
// friction converges at `crime.FRICTION_RATE` (0.02 a tick, and a tick
// is a day). Family unity is an aggregate of many relationships, and an
// aggregate that moves faster than the things it aggregates is not an
// aggregate — so `COHESION_RATE` is half of it, which closes half the
// gap in about a season. `test/family-cohesion.test.js` holds the
// inequality rather than the number, because the inequality is the
// argument and the number is a consequence of it.
//
// ---------------------------------------------------------------------
// Unknown is not a zero here either
// ---------------------------------------------------------------------
// A family whose members have no relationships with each other — a
// lone founder, or two people the neighbourhood graph never connected —
// has no measurable cohesion. Both targets return null and
// `advanceCohesion` leaves the row alone, rather than dragging unity
// toward 0 for a family the engine simply has nothing to say about.
// That distinction is why the pass is idempotent on a world it cannot
// measure, which standing rule 15 asks of anything that writes a
// durable field.

'use strict';

// **Nothing is required at module scope, and that is load-bearing.**
// `traitDefinitions.js` requires THIS file for `FAMILY_TRAIT_FAMILIES`
// while it is building `TRAIT_DEFINITIONS`, and `entityTraits.js`
// requires `traitDefinitions.js`. A top-level `require('./entityTraits')`
// here therefore closes a three-file cycle: whichever of the three
// loads first hands one of the others a half-built module object, and
// `FAMILY_DEFINITIONS` comes out empty with nothing thrown anywhere.
// `getLiveEntity` is required inside `cohesionOf` instead, which is the
// same lazy-require `authority.gripTerm` uses on `statecraft` and for
// the same reason.

const FAMILY_TRAIT_FAMILIES = [
  'loyalty', 'resources', 'leadership', 'generationalKnowledge', 'cooperation',
];

//: Half of `crime.FRICTION_RATE`. See the note above — the inequality
//: is the reasoning, not this figure.
const COHESION_RATE = 0.01;

//: `families.unity` and `.conflict` are 0-100 like every other index in
//: this schema, and `cohesionOf` divides by this rather than by a
//: literal so the scale is named once.
const COHESION_SCALE = 100;

// ---------------------------------------------------------------------
// Who is in the family, and who is still alive
// ---------------------------------------------------------------------
// The living only, on both sides. `politics.computeApproval` had to be
// fixed for exactly this — its `spread` counted rows the dead keep and
// could exceed 1 — and a family's cohesion is a fact about the people
// in it now, not about everybody who was ever born into it.
function livingMembers(worldState, familyId) {
  const ids = (worldState.familyMemberships || [])
    .filter((m) => m.family_id === familyId)
    .map((m) => m.entity_id);
  return (worldState.npcs || []).filter((n) => ids.includes(n.id));
}

// Every relationship BETWEEN two living members, in either direction.
function internalRelationships(worldState, familyId) {
  const ids = new Set(livingMembers(worldState, familyId).map((n) => n.id));
  if (ids.size < 2) return [];
  return (worldState.relationships || []).filter(
    (r) => r.entity_a_id !== r.entity_b_id
      && ids.has(r.entity_a_id) && ids.has(r.entity_b_id),
  );
}

// ---------------------------------------------------------------------
// The two targets
// ---------------------------------------------------------------------

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// What this family's relationships justify calling unity. Mean trust
// between members, on trust's own 0-100 scale — so a family whose
// members all sit at the schema's default 50 targets 50, which is
// exactly where `generateFamily` starts it. **Nothing recalibrates**
// (standing rule 12's first clause): switching this pass on does not
// move an ordinary family by a digit.
//
// Co-residence and shared wealth are deliberately NOT added in. Both
// are real and both would be a bonus term, which would push every
// measurable family above 50 the day this shipped — a modifier centred
// off zero, which is the same rule again.
function unityTarget(worldState, familyId) {
  const trust = internalRelationships(worldState, familyId)
    .map((r) => Number(r.trust ?? 50))
    .filter((t) => Number.isFinite(t));
  return mean(trust);
}

// And what they justify calling conflict. `relationships.conflict` is
// driven by `crime.advanceFriction` from distrust, rivalry and strain,
// so a feuding household is a household whose members are feuding —
// there is no second model of the same thing.
function conflictTarget(worldState, familyId) {
  const conflict = internalRelationships(worldState, familyId)
    .map((r) => Number(r.conflict ?? 0))
    .filter((c) => Number.isFinite(c));
  return mean(conflict);
}

// ---------------------------------------------------------------------
// cohesionOf
// ---------------------------------------------------------------------
// The takeover key's `tribeCohesionScore`, 0..1, and the one place all
// three of the document's named fields come together.
//
//   unity        `families.unity`, moved by `advanceCohesion` above
//   cooperation  the `family cooperation` entity_traits row, read LIVE
//                through `getLiveEntity` (standing rule 9 — the sheet
//                on the row is a birth value and stays one)
//   conflict     `families.conflict`, as a discount rather than a third
//                averaged term
//
// Conflict is a discount and not an average because that is what the
// document asks for: "a Tribe can meet every technical requirement and
// still fail because the people involved don't actually work well
// together." Averaged in, a family at unity 90 and conflict 90 would
// score 0.6 and mostly succeed. Discounted, it scores 0.09 and mostly
// does not, which is the sentence turned into arithmetic.
//
// Returns null for a family that does not exist. A family that exists
// but cannot be measured still has a score — its stored fields are
// real, they are simply the ones it was founded with.
function cohesionOf(worldState, familyId) {
  const family = (worldState.families || []).find((f) => f.id === familyId);
  if (!family) return null;

  // eslint-disable-next-line global-require
  const { getLiveEntity } = require('./entityTraits.js');
  const live = getLiveEntity(worldState, familyId);
  const cooperation = Number(live?.traits?.family?.cooperation ?? 50);
  const unity = Number(family.unity ?? 50);
  const conflict = Number(family.conflict ?? 0);

  const pull = ((unity + cooperation) / 2) / COHESION_SCALE;
  const drag = 1 - Math.max(0, Math.min(1, conflict / COHESION_SCALE));
  return Math.round(Math.max(0, Math.min(1, pull * drag)) * 10000) / 10000;
}

// ---------------------------------------------------------------------
// advanceCohesion
// ---------------------------------------------------------------------
// The writer. Runs in the Social phase beside `births.advanceBonds` and
// `crime.advanceFriction` — the two passes this mirrors, both of which
// exist because a field with no writer made a threshold uncrossable.
//
// Converging, never accumulating: each family moves `COHESION_RATE` of
// the distance to its target, so the restoring force is the target
// itself and there is no ratchet to find later (standing rule 13). Run
// twice on an unchanged world it moves twice, which is what convergence
// means — but run on a world it cannot MEASURE it does nothing at all,
// and that is the idempotence rule 15 is about.
//
// Returns crossings only, never conditions (standing rule 7): a family
// that has been in open discord for a decade is one event.
function advanceCohesion(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, discordThreshold = null } = options;
  const events = [];

  for (const family of worldState.families || []) {
    const unity = unityTarget(worldState, family.id);
    const conflict = conflictTarget(worldState, family.id);
    // Unmeasurable. Left exactly as it is — see the header.
    if (unity === null && conflict === null) continue;

    if (unity !== null) {
      const before = Number(family.unity ?? 50);
      family.unity = round4(before + (unity - before) * COHESION_RATE);
    }

    if (conflict !== null) {
      const before = Number(family.conflict ?? 0);
      const after = round4(before + (conflict - before) * COHESION_RATE);
      family.conflict = after;
      if (discordThreshold !== null && before <= discordThreshold && after > discordThreshold) {
        events.push({
          type: 'family_discord',
          severity: 'medium',
          note: `the ${family.surname} family fell into open discord`,
          tick,
          affected_entity_ids: livingMembers(worldState, family.id).map((n) => n.id),
          global_effects: { familyId: family.id, conflict: after },
        });
      }
    }

    family.updatedTick = tick;
  }

  return events;
}

function round4(value) {
  return Math.round(Math.max(0, Math.min(100, value)) * 10000) / 10000;
}

// ---------------------------------------------------------------------
// describeCohesion
// ---------------------------------------------------------------------
// The measurement that would have caught two constants. Reports the
// spread of both stored fields across a world, and how many families
// the engine can say anything about at all.
function describeCohesion(worldState) {
  const families = worldState.families || [];
  const unity = families.map((f) => Number(f.unity ?? 50));
  const conflict = families.map((f) => Number(f.conflict ?? 0));
  const measurable = families.filter(
    (f) => internalRelationships(worldState, f.id).length > 0,
  ).length;
  const scores = families.map((f) => cohesionOf(worldState, f.id)).filter((s) => s !== null);

  return {
    families: families.length,
    measurable,
    unity: spread(unity),
    conflict: spread(conflict),
    cohesion: spread(scores),
  };
}

function spread(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean(values) * 100) / 100,
    distinct: new Set(values).size,
  };
}

module.exports = {
  FAMILY_TRAIT_FAMILIES,
  COHESION_RATE,
  COHESION_SCALE,
  livingMembers,
  internalRelationships,
  unityTarget,
  conflictTarget,
  cohesionOf,
  advanceCohesion,
  describeCohesion,
};
