# Tasks — Minimal Family Engine

- [x] Create `server/familyTraits.js`: `FAMILY_TRAIT_FAMILIES`, the 5
      dimensions with no dedicated `families` column, after
      cross-checking all 10 `FAMILY_TRAIT_FAMILIES` names against the
      schema first (lesson from step 5's correction).
- [x] Extend `server/traitDefinitions.js` with the family tier —
      `trait_id` 124-128, `FAMILY_DEFINITIONS` export.
- [x] Add `engine.js#generateFamily(options)` — requires
      `options.surname` (no schema default), builds the entities+
      families merged object, generates its 5 `entity_traits` rows.
      No `wealth` field anywhere on the returned object.
- [x] Add `engine.js#addFamilyMember(familyId, entityId, role,
      generationNumber)` — matches `family_memberships`, increments
      `total_members`.
- [x] Add `engine.js#getFamilyWealth(familyId)` — computed rollup over
      members' most recent `individual_finances` (assets + savings -
      debt). `WorldState.individualFinances` added, empty (step 7 not
      built yet).
- [x] Update `engine.js`'s `WorldState` with `families`,
      `familyMemberships`, `individualFinances` arrays.
- [x] Verify against a live `WorldState`:
      - Catalog: 128 total definitions (114+9+5), sequential `trait_id`,
        family rows exactly matching `FAMILY_TRAIT_FAMILIES`'s 5 names.
      - Regression: NPC (20 families/114 traits) and Organization (9
        organization traits) generation unaffected.
      - `generateFamily({})` throws (no `surname`, no schema default).
      - `generateFamily({ surname: 'Whitfield', ... })` produces the 5
        family traits, no key overlap with `unity`/`reputation`/
        `conflict`, `traditions: []`, and confirmed no `wealth`
        property exists on the object at all.
      - `addFamilyMember()` twice: `total_members` correctly reaches 2;
        throws on an unknown `familyId`.
      - `getFamilyWealth()`: returns `0` with no `individualFinances`
        data seeded (honest, not a stub bug); after manually seeding 3
        finance rows across 2 members (including an older + newer row
        for the same member, to prove "most recent" wins), returned
        the exact hand-computed total (2160).
      - `applyKeyModifier()` (step 4) confirmed tier-agnostic against a
        family trait (`cooperation`) — correctly recomputed
        `current_value` after a `key_modifier` write (verified with a
        proper before/after snapshot, after an initial test-script
        mistake read a live object reference for both — not a code
        bug, see note below).
      - Re-ran an existing Key resolver (`resolveTrust`) after all this
        change — still works, no regression from steps 1-5.
- [x] Commit as its own change, separate from steps 1-5.

## Note on a test-script mistake (not a code bug)
First verification pass showed `applyKeyModifier` appearing to do
nothing (`cooperation before: 46, after: 46`). Cause: the test captured
`before` as a *reference* to the same row object `applyKeyModifier`
then mutated in place, so reading `.current_value` on it afterward
showed the post-mutation value both times. Re-ran capturing `before` as
a plain number *before* the mutation — confirmed correct behavior
(`48 -> 51` after a `+3` modifier). Flagging this explicitly since it's
exactly the kind of mistake worth being transparent about rather than
quietly re-running until it looked right.

## Next task after this one
Step 7 (real resource tracking, real supply/demand economy) per
`CLAUDE.md`'s locked order. This is what will actually start populating
`WorldState.individualFinances`, making `getFamilyWealth()` return real
numbers instead of 0 for ungenerated data.
