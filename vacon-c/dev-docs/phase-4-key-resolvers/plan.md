# Plan — Key resolvers (locked Day 1 step 4)

## Goal
Implement 5-8 real Key resolver functions in `server/keys.js`
(currently an empty stub), each satisfying the unconditional rule from
`VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md` Section 4.3 / `CLAUDE.md`
standing rule 1: every Key resolution writes back to Memory,
Relationships, and World state.

## Which 7 Keys, and why
No document in the handoff package lists specific Key names outright
— the architecture doc names 5 *categories* (Human, Social, Economic,
Power, World, Section 4.1) and describes the resolver *framework*
(4.2-4.4), but the actual instances only surface as incidental
language elsewhere:

| Key | Category | Where named/implied |
|---|---|---|
| Resilience | World | 6.1, explicitly named for Reemergence |
| Adaptability | World | 6.1, explicitly named for Reemergence |
| Trust | Social | Tick pipeline phase 4: "trust/relationship keys" |
| ScarcityResponse | Economic | Pipeline phase 3 ("supply/demand keys") and phase 6 ("scarcity...keys") |
| Fear | Human | Pipeline phase 6: "...+fear keys" |
| Aggression | Power | Pipeline phase 8: "aggression+territory keys" |
| Territory | Power | Pipeline phase 8: "aggression+territory keys" |

Seven lands inside the locked 5-8 range and covers all 5 categories.

## Two interpretive choices — not directly specified, flag for confirmation

1. **What resolvers may read.** Only "never raw world state directly"
   is explicit (Section 4.4 / standing rule 2). Applied narrowly here:
   resolvers read the acting entity's *own* traits (the equation's
   "ENTITY TRAITS" term, always available) and any pre-filtered
   `entity_knowledge` rows the *caller* supplies via `context.knowledge`
   — never another entity's raw traits, never a ground-truth number
   (e.g. an actual scarcity level) passed directly as context.
   Retrieving/filtering knowledge is the caller's job; interpreting it
   into an outcome + write-backs is the resolver's job.

2. **Relationships write-back for introspective Keys.** Resilience,
   Adaptability, and ScarcityResponse have no natural second party.
   The "every Key writes to Relationships" rule has no carve-out for
   this, so these three write a self-relationship row
   (`entity_a_id === entity_b_id`). This will likely change once
   Community becomes a real `WorldState` entity for these to relate to
   instead of self — flagged, not resolved, here.

## Scope for this task only
- `server/worldStore.js` — minimal in-memory stores + helpers for the
  three write-back targets (`memories`, `relationships`,
  `entityKnowledge`), added to `WorldState` in `engine.js`.
- `engine.js` gains `applyKeyModifier()` — the "World state" leg
  specifically: writes to `entity_traits.key_modifier` (never
  `base_value` directly, per the schema's own comment), recomputes
  `current_value` from all modifier columns, clamps to the trait's own
  `[min_value, max_value]`.
- `server/keys.js` — the 7 resolvers, each: reads self traits +
  supplied knowledge, computes a deterministic outcome, writes Memory +
  Relationship + World state.

## Explicitly NOT in this task
- The 11-phase tick pipeline that would call these automatically —
  step 8. These are called directly/manually for now, same as
  `generateNPC()` before any routes exist.
- `key_definitions`/`keys_log` tables (the Key definition/instance
  split, parallel to traits) — not asked for by "5-8 Key resolvers";
  these 7 are hardcoded functions, not data-driven definitions yet.
- Needs/Goals tables (Section 4.4's "genuinely new" requirements) —
  separate from Key resolvers themselves.

## Done when
- 7 resolvers exist, each independently callable and each performing
  all three write-backs, verified against a running `WorldState`.
- `generateNPC()`'s output is unaffected by Key writes happening
  afterward (regression check).
- A multi-Key scenario (several Keys resolved in sequence against the
  same two entities) produces internally consistent state: memories
  attributed correctly, relationships accumulate rather than
  overwrite, `entity_traits.current_value` stays in range after
  repeated modifier writes.
