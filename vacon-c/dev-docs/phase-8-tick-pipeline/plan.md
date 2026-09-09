# Plan — 11-phase tick pipeline (locked Day 1 step 8)

## Goal
Rebuild `advanceTick()` as the real 11-phase pipeline (Build Prompt):
Environment -> Resource -> Economy -> Social -> Decision -> Migration
-> Organization -> Security -> Event -> History -> Reemergence. Events
are outputs of phases 1-8, never rolled independently — explicit in
the Build Prompt. This is also what would make the locked Definition
of Done ("a drought-style cascade running through at least 4 of the 10
locked systems") literally runnable end to end, rather than
demonstrated by manually chaining function calls the way every
verification through step 7 has done.

## A correctness fix this step required
Key resolvers read `entity.traits` directly, but every `generate*()`
function stores a **generation-time snapshot** there (flagged as a
known gap back in `dev-docs/phase-4-key-resolvers/tasks.md`). Within a
single tick, an earlier phase (Decision) can write a `key_modifier`
change that a later phase (Migration) needs to see — reading the stale
snapshot would silently break that. Fixed by moving the WorldState-
generic trait-row helpers (`getEntityTraitsForEntity`,
`applyKeyModifier`) into `entityTraits.js` and adding
`getLiveEntity(worldState, entityId)` there too — recomputes
`.traits` fresh from `entity_traits` every call. `engine.js` still
exposes the exact same `getEntityTraits()`/`applyKeyModifier()` names
and arguments as thin wrappers; nothing changes for existing callers.
This also resolved the reason `tick.js` couldn't just live inside
`engine.js`: `engine.js` needs to require `tick.js` to expose
`advanceTick()`, so `tick.js` can't require `engine.js` back without a
cycle — it goes straight to `entityTraits.js`/`keys.js`/
`worldStore.js`/`economy.js` instead, taking `worldState` explicitly
like those modules already do.

## Design — one phase, one paragraph
1. **Environment** — a minimal, real, in-memory mechanism
   (`activeConditions`) since `environment_state` is city-scoped and
   City isn't built. A condition applies its supply/demand delta to
   matching resources every tick it's active, then expires. This is
   the actual trigger for "drought-style" — `addEnvironmentalCondition()`
   is the new public entry point.
2. **Resource** — runs `economy.advanceResourceTick()` for every
   tracked resource (already built, step 7).
3. **Economy** — resolves market prices (step 7); when a resource's
   scarcity crosses 60 (the threshold named elsewhere in the handoff
   package for "Black Market Engine"), broadcasts real, verified
   `entity_knowledge` to every NPC — the wiring `dev-docs/phase-7-economy/tasks.md`
   explicitly deferred to this step.
4. **Social** — resolves `resolveTrust()` for every existing NPC-NPC
   relationship (updates standing ties, doesn't invent new ones).
5. **Decision** — reacts to knowledge acquired *this tick* by resolving
   `resolveScarcityResponse`/`resolveFear` for whichever NPCs received
   it.
6. **Migration** — computes a migration-risk signal from each NPC's
   live `emotional.Volatility`/`economic.Resource Hoarding` — no
   Property/Territory/Community system exists yet to actually relocate
   anyone, so this honestly stops at the signal.
7. **Organization** — explicit no-op. No `territory_blocks`/faction
   membership data exists to operate on.
8. **Security** — resolves `resolveAggression()` for NPC-NPC
   relationships already showing meaningful conflict (escalates
   existing tension, doesn't invent new antagonists). `resolveTerritory()`
   is deliberately NOT reused here — it's calibrated for individual-tier
   `faction.'Territorial Instinct'`, not an Organization's own
   `'territory'` trait dimension, a different scale entirely.
9. **Event** — stores every candidate event the phases above returned
   as real `events` rows.
10. **History** — writes `historical_records` for events with
    `severity: 'high'` (an interpretive threshold — no doc specifies
    one).
11. **Reemergence** — Section 6.1: "tier-agnostic... with two real Key
    resolvers (Resilience and Adaptability) doing the actual work." No
    City/Civilization tier exists to attach `cities.reemergence_index`
    to, so this computes a world-level composite (the average of every
    NPC's live Resilience/Adaptability) as a stand-in.

## File-ownership deviation, flagged
Section 8 calls for `phases/` — one file per tick phase (11 files).
This keeps all 11 in one `server/tick.js` instead, matching the
pattern already used for `keys.js` (7 resolvers, one file). Splitting
later is mechanical — each phase function is already self-contained.

## Explicitly NOT in this task
- Actually implementing Organization territory gain/loss — no
  Territory/Community system to operate on (separate, not-yet-built
  locked-scope item).
- Citizen-mode player binding — the other half of the Definition of
  Done ("...with a Citizen-mode player able to observe and be affected
  by it"). Not part of the numbered 9-step "Order of operations" the
  way steps 1-9 are; still a genuine gap after this step.
- A structured "topic" system for `entity_knowledge` — Decision phase
  matches on `fact_content` substrings, a real limitation (schema has
  no topic column), not a design choice.

## Done when
- `advanceTick()` runs all 11 phases in order, verified against a live
  `WorldState`.
- A manually-triggered drought condition cascades automatically
  through Resource -> Economy -> Decision (Fear/ScarcityResponse) ->
  Migration -> Security (via pre-existing relationship conflict),
  generating real events and historical records, with zero manual
  Key-calling in between ticks.
- Full regression: every prior step's generation functions and direct
  Key calls still work unmodified.
