# Plan — Split traits.js / keys.js out of engine.js

## Goal
`engine.js` currently owns trait generation directly (`TRAIT_FAMILIES`,
`generateNPC()`). Pull trait data and trait-resolution logic into their
own modules before anything else gets built on top of it — this is
step 1 of 9 in the locked Day 1 order, and everything else (DB
migration, Key resolvers, Family Engine) depends on this being clean
first.

## Why this first, specifically
- `trait_definitions` + `entity_traits` (step 2) can't be migrated
  cleanly if trait data is still inline in `engine.js`.
- Key resolvers (step 4) need a stable `keys.js` module to live in —
  build the empty shell now so step 4 has a home.
- Nothing here changes runtime behavior. This is a pure extraction:
  same NPCs, same traits, same `/api/*` responses — just relocated.

## Scope for this task only
- Move `TRAIT_FAMILIES` (18 live families, 92 traits) to `traits.js`.
- Move any trait-scoring/generation helper functions that `generateNPC()`
  calls into `traits.js` alongside the data.
- Create `keys.js` as an empty module with the Key resolver function
  signature stubbed (see context.md) — no resolvers implemented yet,
  that's step 4.
- `engine.js` imports from both; `generateNPC()` behavior is
  byte-for-byte identical after the split.

## Explicitly NOT in this task
- Adding the 19th family (Skills) — that's step 3, after this split.
- Postgres migration — that's step 2 and step 9.
- Any actual Key resolver logic — that's step 4.

## Done when
- `traits.js` and `keys.js` exist as separate files.
- `engine.js` no longer contains inline trait family data.
- `generateNPC()` produces identical output to before the split (spot
  check a few generated NPCs against pre-split output).
- Existing `/api/*` endpoints unchanged.
