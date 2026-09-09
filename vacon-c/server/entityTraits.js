// server/entityTraits.js
//
// The "instance" half of the trait definition/instance split (locked
// Day 1 step 2) — entity_traits rows (VACANCY_POSTGRESQL_SCHEMA.sql),
// one row per (entity, trait_definition) pair. traitDefinitions.js is
// the "definition" half.
//
// current_value/base_value are seeded equal at generation time — no
// modifiers exist yet beyond what Key resolvers write (key_modifier,
// Section 4.3 — see applyKeyModifier() below). entity_traits
// .current_value is a plain stored column in the schema, not computed
// — whatever writes a modifier must also update current_value itself
// (base_value + the sum of all modifier columns); Postgres won't do
// that automatically.
//
// getEntityTraitsForEntity()/applyKeyModifier()/getLiveEntity() below
// used to live in engine.js (steps 2 and 4); moved here in step 8 so
// server/tick.js (the 11-phase pipeline) can use them without creating
// a circular dependency on engine.js, which itself needs to wrap
// advanceTick(). engine.js still re-exports the same
// getEntityTraits()/applyKeyModifier() names, taking the same
// arguments as before (minus worldState, which it closes over) — no
// change for any existing caller.

'use strict';

const { getDefinition, getTraitId } = require('./traitDefinitions.js');
const { randomTraitValue } = require('./traits.js');

// Generate a full set of entity_traits rows for one entity — one row
// per row in `definitions` (required, no default: callers must pass a
// tier-scoped subset — traitDefinitions.js's INDIVIDUAL_DEFINITIONS or
// ORGANIZATION_DEFINITIONS — so an NPC never picks up organization-tier
// traits, or vice versa). Mirrors what generateTraitSheet() used to do
// directly for individuals, now going through the definition/instance
// split and generalized to any tier.
function generateEntityTraits(entityId, tick, definitions) {
  return definitions.map((def) => {
    const value = randomTraitValue();
    return {
      entity_id: entityId,
      trait_id: def.trait_id,
      current_value: value,
      base_value: value,
      temporary_modifier: 0,
      permanent_modifier: 0,
      experience_modifier: 0,
      environmental_modifier: 0,
      relationship_modifier: 0,
      key_modifier: 0,
      last_updated_tick: tick,
    };
  });
}

// Convert entity_traits rows back into the legacy nested
// { family: { traitName: currentValue } } shape — what generateNPC()
// exposes as npc.traits, unchanged from before the split, so existing
// consumers (routes, frontend) don't need to know storage moved to a
// definition/instance split.
function traitsToSheet(rows) {
  const sheet = {};
  for (const row of rows) {
    const def = getDefinition(row.trait_id);
    if (!def) continue;
    if (!sheet[def.family]) sheet[def.family] = {};
    sheet[def.family][def.name] = row.current_value;
  }
  return sheet;
}

// entity_traits rows for one entity — mirrors a
// `SELECT * FROM entity_traits WHERE entity_id = ?` query. Works for
// any tier since it only filters by id.
function getEntityTraitsForEntity(worldState, entityId) {
  return worldState.entityTraits.filter((row) => row.entity_id === entityId);
}

function findEntityTraitRow(worldState, entityId, family, name) {
  const traitId = getTraitId(family, name);
  return worldState.entityTraits.find(
    (row) => row.entity_id === entityId && row.trait_id === traitId
  );
}

// The "World state" leg of a Key's three-way write-back (Section 4.3).
// Keys write to key_modifier, never to base_value directly — that's
// the schema's own comment on entity_traits.key_modifier. current_value
// is a plain stored column, not computed by Postgres, so writing a
// modifier here also recomputes and clamps it to the trait's own
// [min_value, max_value] range. Tier-agnostic, like getEntityTraitsForEntity().
function applyKeyModifier(worldState, entityId, family, name, delta, tick) {
  const row = findEntityTraitRow(worldState, entityId, family, name);
  if (!row) return null;
  const def = getDefinition(row.trait_id);
  row.key_modifier += delta;
  const recomputed = row.base_value + row.temporary_modifier + row.permanent_modifier +
    row.experience_modifier + row.environmental_modifier + row.relationship_modifier +
    row.key_modifier;
  row.current_value = Math.max(def.min_value, Math.min(def.max_value, recomputed));
  row.last_updated_tick = tick;
  return row;
}

// A "live" view of an entity for the tick pipeline: the stored
// npc/organization/family object (whichever array holds it), but with
// .traits recomputed fresh from entity_traits rather than the
// generation-time snapshot every generate*() function stores. Matters
// because Key resolvers read entity.traits directly — without this,
// a Key resolved later in the same tick (e.g. Migration, phase 6)
// would see pre-tick trait values even though an earlier phase
// (Decision, phase 5) already wrote key_modifier changes to the
// underlying entity_traits rows this tick. Flagged as a known gap in
// dev-docs/phase-4-key-resolvers/tasks.md; this is where it's actually
// fixed for pipeline-driven resolution. Direct/manual Key calls
// outside the pipeline still need to pass a fresh entity themselves —
// this helper doesn't retroactively fix every past call site.
function getLiveEntity(worldState, entityId) {
  const base = worldState.npcs.find((e) => e.id === entityId)
    || worldState.organizations.find((e) => e.id === entityId)
    || worldState.families.find((e) => e.id === entityId);
  if (!base) return null;
  return { ...base, traits: traitsToSheet(getEntityTraitsForEntity(worldState, entityId)) };
}

module.exports = {
  generateEntityTraits,
  traitsToSheet,
  getEntityTraitsForEntity,
  applyKeyModifier,
  getLiveEntity,
};
