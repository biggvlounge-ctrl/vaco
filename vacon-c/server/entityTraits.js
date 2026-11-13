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
// `valueFor` is optional and defaults to a fresh random roll, which is
// what generation has always meant here. It exists so a trait sheet
// can be built from something other than chance without duplicating
// this row shape — `server/births.js` passes a function that blends
// the two parents' LIVE values, because a child who rolled fresh
// traits would make lineage decorative.
function generateEntityTraits(entityId, tick, definitions, valueFor = null) {
  return definitions.map((def) => {
    const value = valueFor === null ? randomTraitValue() : valueFor(def);
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

// **Indexed once per world, not filtered per call.** `traitDrift.js`
// found this exact shape once already — "four lookups per NPC per
// tick, against 17,000 rows and 150 people, which is ten million
// comparisons a tick" — and fixed it locally with its own
// `indexRows`/`rowsFor`. It never reached here, the canonical
// definition every OTHER caller across the engine actually uses (111
// call sites in 31 files via `getLiveEntity`/`getEntityTraitsForEntity`
// directly) — so the same unindexed `.filter()`/`.find()` over the
// WHOLE `entity_traits` array, on every single call, stayed the real
// cost everywhere else. `test/worldgen.test.js` genuinely hung (100%+
// CPU, never completing) rather than just slowing down, because this
// one file accumulates a module-global world across every test with no
// reset between them (by design — see its own header) and one test
// runs 60 real ticks over it: by the time that test starts, the
// accumulated world already held 300 NPCs and 38,000+ trait rows, and
// `advanceTick` calls `getLiveEntity` per entity per phase — tracked
// down with `--cpu-prof`, not guessed: `getLiveEntity` alone was 29% of
// samples, `getEntityTraitsForEntity` another 8%.
//
// The cache is a `WeakMap` keyed on the `worldState` object itself —
// never a field ON `worldState`, so persistence/migrate/restore never
// see it and can't accidentally serialize or restore a stale one.
// Invalidated on EITHER the array's identity changing (a full
// `entityTraits` replacement, e.g. after a restore) or its length
// changing (an ordinary append) — `entity_traits` rows are append-only
// everywhere in this engine (`grep -rn "entityTraits\.push"` finds
// every real writer: `births.js` and three sites in `engine.js`;
// nothing splices or reassigns a single row out of the array), so a
// length check alone is enough to detect every real mutation, and rows
// already in the index are the SAME object references the flat array
// holds — an in-place write to `row.current_value` elsewhere needs no
// invalidation at all, because the index never copied the row.
const traitIndexCache = new WeakMap();

function getTraitIndex(worldState) {
  const rows = worldState.entityTraits || [];
  const cached = traitIndexCache.get(worldState);
  if (cached && cached.arrayRef === rows && cached.length === rows.length) {
    return cached.byEntity;
  }
  const byEntity = new Map();
  for (const row of rows) {
    const existing = byEntity.get(row.entity_id);
    if (existing) existing.push(row);
    else byEntity.set(row.entity_id, [row]);
  }
  traitIndexCache.set(worldState, { arrayRef: rows, length: rows.length, byEntity });
  return byEntity;
}

// entity_traits rows for one entity — mirrors a
// `SELECT * FROM entity_traits WHERE entity_id = ?` query. Works for
// any tier since it only filters by id.
// `|| []` rather than a bare read: a world with no trait rows at all is
// a real state (a fixture, a world mid-restore), and it means "this
// entity has no traits", not "crash". A reader that throws on it forces
// every caller to guard the array itself, which is how one of them ends
// up not doing it.
function getEntityTraitsForEntity(worldState, entityId) {
  return getTraitIndex(worldState).get(entityId) || [];
}

function findEntityTraitRow(worldState, entityId, family, name) {
  const traitId = getTraitId(family, name);
  const rows = getTraitIndex(worldState).get(entityId) || [];
  return rows.find((row) => row.trait_id === traitId);
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
  const base = (worldState.npcs || []).find((e) => e.id === entityId)
    || (worldState.organizations || []).find((e) => e.id === entityId)
    || (worldState.families || []).find((e) => e.id === entityId);
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
