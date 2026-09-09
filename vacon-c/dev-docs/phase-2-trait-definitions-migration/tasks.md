# Tasks — Trait Definitions Migration

- [x] Create `server/traitDefinitions.js`, build `TRAIT_DEFINITIONS`
      (114 rows) from `traits.js`'s `TRAIT_FAMILIES`, using the
      schema's column defaults verbatim. Verified: sequential
      `trait_id` 1..114, all 14 schema columns present, spot-checked
      against `trait_definitions`'s `CREATE TABLE`.
- [x] Create `server/entityTraits.js`:
      `generateEntityTraits(entityId, tick)` — one row per
      `trait_definitions` row, `current_value === base_value`, all
      modifier columns `0`. `traitsToSheet(rows)` — converts rows back
      to the legacy nested shape.
- [x] Update `engine.js`: `WorldState.entityTraits` (flat array,
      mirrors the real table), `getEntityTraits(entityId)` helper,
      `generateNPC()` now builds `entity_traits` rows and derives
      `npc.traits` from them via `traitsToSheet()`.
- [x] Verify: generated 2 NPCs, confirmed 114 `entity_traits` rows
      each (228 total), all rows valid (current=base, in `[0,100]`,
      modifiers `0`), `npc.traits` unchanged in shape (20 families, 114
      traits) and `traitsToSheet(rows)` round-trips to exactly
      `npc.traits`.
- [x] Hit `/api/npc/generate` and `/api/state` directly, confirm
      response shape unchanged — **resolved**: `server.js` now exists
      (built when VDP's VACON-C district was added). Live call to
      `POST /api/npc/generate` confirmed 114 real `entityTraits` rows
      landed on `WorldState` for the generated NPC, and `npc.traits`
      is still the nested shape. `GET /api/entities/:id/traits` and
      the `GET /api/keys`-adjacent reads named here are still real,
      separate, not-yet-built future scope — not implied to exist by
      this check.
- [x] Commit as its own change, separate from step 1 (split) and step 3
      (Skills family).

## Next task after this one
Step 4 (5-8 Key resolvers) per `CLAUDE.md`'s locked order — needs
`VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md` Section 4.3 (Key Framework),
now available in this handoff. `key_modifier` on `entity_traits` is
ready to be written to; nothing writes to it yet.
