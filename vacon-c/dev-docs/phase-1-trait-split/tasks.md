# Tasks — Trait Split

- [x] Open `server/engine.js`, locate `TRAIT_FAMILIES` and every
      function `generateNPC()` calls that touches trait data
- [x] Create `server/traits.js`
- [x] Copy `TRAIT_FAMILIES` into `traits.js` verbatim — copied from
      `engine.js`'s existing inline copy at the time (the real
      `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` wasn't available yet in
      this handoff). **Resolved**: now that the doc has been provided,
      verified `traits.js`'s `TRAIT_FAMILIES` (post-Skills) is
      byte-identical to that doc's literal object — 20 families, 114
      traits. The "18/92" and "19/98" figures quoted here and in that
      same doc's prose undercount their own listed array by one family
      — a pre-existing documentation bug, not a data mismatch.
- [x] Move trait-generation/scoring helper functions into `traits.js`,
      export what `engine.js` needs (`randomTraitValue`,
      `generateTraitSheet`)
- [x] Create `server/keys.js` with the empty resolver-shape stub (see
      context.md) — no logic yet
- [x] Update `engine.js` to `require` from `traits.js`. **Deviation**:
      does not also `require` `keys.js` — `keys.js` has no exports yet
      for `engine.js` to use (that's step 4), so requiring it now would
      be an unused import. Wiring it in is one line whenever step 4
      adds real resolvers.
- [x] Delete the now-dead inline copies from `engine.js`
- [x] Run the existing test/dev server, generate a handful of NPCs,
      confirm trait output is unchanged from pre-split behavior —
      **resolved**: `server.js`/routes now exist (built when VDP's
      VACON-C district was added). Booted the real server, called
      `POST /api/npc/generate` live: 20 trait families, 114 total
      traits per NPC, matching the pre-split shape exactly.
- [x] Hit `/api/npc/generate` and `/api/state` directly, confirm
      response shape is byte-for-byte unchanged — **resolved**: same
      live call above; `GET /api/state` confirmed `entityTraits` is a
      real array on `WorldState`, `npc.traits` stayed the nested
      family/name/value shape.
- [x] Commit as its own change, separate from step 2 (DB migration)
      and step 3 (Skills family) — keep the diff reviewable

## Next task after this one
`dev-docs/phase-2-trait-definitions-migration/` — migrate `traits.js`
data into `trait_definitions` + `entity_traits` per
`VACANCY_POSTGRESQL_SCHEMA.sql` (step 2 of the locked Day 1 order).
Don't start this until the split above is committed and verified.
