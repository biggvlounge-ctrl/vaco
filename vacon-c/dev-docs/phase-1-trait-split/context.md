# Context — Trait Split

## Where this data currently lives
`server/engine.js`, inline in `TRAIT_FAMILIES`, used by `generateNPC()`.
Verified live: 18 families, 92 traits (per `VACANCY_TRAIT_DATABASE_
ATTACHMENT.md`, Document 7 of the handoff package).

## The 18 families currently live (move as-is, don't edit values)
physical, mental, emotional, psychological, behavioral, social,
economic, educational, criminal, combat, sports, health, technology,
environmental, leadership, reputation, faction, special, personality

Full trait lists per family are in `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`
— copy directly from there, don't retype from memory, to avoid
transcription drift.

## The 19th family (Skills) — NOT part of this task
Specified but not yet in code:
```js
skills: ["Communication", "Leadership", "Engineering", "Medicine",
  "Science", "Technology", "Art", "Music", "Business", "Agriculture",
  "Construction", "Combat", "Athletics", "Crafting", "Research",
  "Management"]
```
Leave this out of `traits.js` for now — add it in step 3, as its own
follow-up task, so the extraction and the addition aren't tangled in
one diff.

## keys.js — target shape for the empty shell
Keys are resolver functions (pure functions reading traits +
environment + time), not stored values. Stub the shape now so step 4
has somewhere to go:

```js
// keys.js
// Each Key resolver: (entity, context) -> outcome
// context includes: entity_knowledge (subjective, not raw world
// state), relationships, history — never traits alone.
// Every resolver MUST write back to: Memory, Relationships, World
// state. That three-way write-back is the definition of "done" for
// any Key — see VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md Section 4.3.

module.exports = {
  // resolvers land here in step 4 — empty for this task
};
```

## Target DB shape (for step 2, not this task — reference only)
`trait_definitions` + `entity_traits` (definition/instance split).
Full column shapes: `VACANCY_POSTGRESQL_SCHEMA.sql`.

## Related docs
- `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` — full trait lists, tier-level
  trait sheets (Family/Organization/City/Civilization), Values,
  Preferences, Beliefs, Archetypes.
- `VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md` Section 4 — Key Framework
  reasoning, why resolvers are functions not stored values.
