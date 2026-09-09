# Tasks — Key Resolvers

- [x] Create `server/worldStore.js`: `addMemory`, `findRelationship`,
      `getOrCreateRelationship`, `adjustRelationship`, `addKnowledge`,
      `getKnowledge` — flat-array stores mirroring `memories`,
      `relationships`, `entity_knowledge` verbatim.
- [x] Add `memories`, `relationships`, `entityKnowledge` arrays to
      `engine.js`'s `WorldState`.
- [x] Add `engine.js#applyKeyModifier(entityId, family, name, delta, tick)`
      — writes `entity_traits.key_modifier`, recomputes `current_value`
      from all modifier columns, clamps to the trait definition's own
      `[min_value, max_value]`.
- [x] Implement 7 resolvers in `server/keys.js`: `resolveResilience`,
      `resolveAdaptability` (World), `resolveTrust` (Social),
      `resolveScarcityResponse` (Economic), `resolveFear` (Human),
      `resolveAggression`, `resolveTerritory` (Power). Each takes
      `(entity, context)`, returns a deterministic outcome object, and
      performs the three-way write-back via a shared `writeBack()`
      helper.
- [x] Verify against a live `WorldState`:
      - Generated 2 NPCs (Alice, Bob); `generateNPC()` output unchanged
        (20 families / 114 traits) — Key-resolver work didn't regress
        step 1-3.
      - Seeded two `entity_knowledge` rows for Alice: one with no
        source/subject entity (a general drought fact), one with
        `source_entity_id: bob.id` (a rumor about Bob).
      - Ran all 7 resolvers in sequence against Alice (4 introspective/
        drought-flavored, 3 targeting Bob via the sourced knowledge).
      - Confirmed 7 `memories` rows, all attributed to Alice.
      - Confirmed 2 `relationships` rows: a self-relationship (4
        interactions — ScarcityResponse, Fear falling back to self
        since its knowledge had no source entity, Resilience,
        Adaptability) and a real Alice-Bob relationship (3
        interactions — Aggression, Territory, Trust — correctly using
        Bob as the second party since that knowledge *did* carry
        `source_entity_id`).
      - Confirmed all 7 touched `entity_traits` rows: `key_modifier`
        applied, `current_value` recomputed and still in `[0,100]`
        after the writes.
- [x] Commit as its own change, separate from steps 1-3.

## Known follow-up, not a bug in this task
`npc.traits` on the object `generateNPC()` returns is a **snapshot**
taken at generation time (via `traitsToSheet()`), not a live view.
After Key resolvers write `key_modifier` changes, that specific object
no longer reflects the entity's current trait values — confirmed
directly: `alice.traits.economic["Resource Hoarding"]` still reads the
original 16 after `resolveScarcityResponse` changed the underlying row.
Whoever builds the `/api/npcs/:id` route (not yet written — no
routes/`package.json` exist in any handoff so far) needs to call
`traitsToSheet(getEntityTraits(npcId))` fresh at read time, not read
the stored `npc.traits` field, once Key resolvers are actually running
against live NPCs.

## Next task after this one
Step 5 (upgrade `factions` to the full trait sheet) per `CLAUDE.md`'s
locked order — the 5-8 Key resolver requirement is now satisfied (7
implemented). `key_definitions`/`keys_log` (the Key definition/
instance split) and the tick pipeline wiring these resolvers into an
automatic phase remain open, tracked as "explicitly NOT in this task"
in `plan.md`.
