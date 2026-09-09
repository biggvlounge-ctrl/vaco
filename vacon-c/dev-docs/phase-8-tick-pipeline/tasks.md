# Tasks — 11-Phase Tick Pipeline

- [x] Move `getEntityTraitsForEntity`/`applyKeyModifier` from
      `engine.js` into `entityTraits.js` (worldState-first signature,
      matching `economy.js`/`worldStore.js`'s convention); add
      `getLiveEntity(worldState, entityId)` there too — recomputes
      `.traits` fresh from `entity_traits` instead of returning the
      generation-time snapshot every `generate*()` function stores.
- [x] `engine.js` re-exports `getEntityTraits()`/`applyKeyModifier()`
      as thin wrappers with the exact same names/arguments as before
      (minus `WorldState`, closed over) — verified no existing caller
      needed to change.
- [x] Create `server/tick.js`: `addEnvironmentalCondition()` and all 11
      phase functions plus `advanceTick()`, none of it requiring
      `engine.js` (avoids the circular dependency `engine.js` requiring
      `tick.js` would otherwise create).
- [x] Wire `engine.js`: `activeConditions`/`events`/
      `historicalRecords`/`migrationRisk`/`reemergenceIndex` added to
      `WorldState`; `advanceTick()`/`addEnvironmentalCondition()`
      exposed as bound wrappers.
- [x] Verify full regression first: generated an NPC, Organization,
      Family after all these changes — traits still 20/9/5 families
      respectively; a direct (non-pipeline) Key call still works
      unmodified.
- [x] Verify a complete, automated drought cascade:
      - Generated a `water` resource (`supply: 100, demand: 60`) and a
        `Bottled Water` market listing (`price: 1.50`); manually
        established an NPC-NPC relationship with `conflict: 40` (so
        Security phase would have something to escalate).
      - Baseline tick (no drought): 1 event (an unrelated startup
        scarcity check), water quantity unchanged, `reemergenceIndex`
        computed (54).
      - `addEnvironmentalCondition({ type: 'drought', resourceType:
        'water', supplyDelta: -40, demandDelta: 50, ticksRemaining: 3 })`
        — one call, no manual per-tick intervention after this.
      - **3 automatic ticks**, each correctly showing: supply falling /
        demand rising (Environment phase), scarcity climbing to 92 then
        100 (Economy phase reading the updated resource), a `scarcity`
        event, a `fear_spike` event (Decision phase — NPC received real
        broadcast knowledge and reacted), and a `migration_risk` event
        (Migration phase reading the NPC's *live*, post-Decision-phase
        trait values — the exact correctness fix this step made,
        actually exercised).
      - Confirmed side effects across the whole chain: market listing
        price moved from `1.50` to `1.27` (Economy phase); NPC actually
        holds `scarcity`-tagged `entity_knowledge` (Economy phase's
        broadcast); `historicalRecords` grew to 6 rows (History phase
        logging every high-severity event); the pre-seeded relationship's
        `conflict` climbed from 40 to 52 across the 3 ticks (Security
        phase's `resolveAggression()` actually firing, tick over tick).
      - One more tick after the drought's `ticksRemaining` expired:
        `activeConditions` correctly emptied (condition self-removed).
- [x] Commit as its own change, separate from steps 1-7.

## Definition of Done — status update
The locked test is "a drought-style cascade running through at least 4
of the 10 locked systems, **with a Citizen-mode player able to observe
and be affected by it**." The cascade itself is now real and verified,
touching well over 4 systems (Individual traits, 4 of the 7 Key
resolvers, real resource tracking, real economy, and the pipeline
itself). **Citizen-mode player binding is still missing** — it was
never given its own numbered step in `CLAUDE.md`'s "Order of
operations" (steps 1-9 map to a 9-item list; Citizen-mode binding,
Territory/Community, and Artifact/Mission are part of the broader
10-item locked *scope* but not that specific sequence). Worth explicit
attention before calling Phase 1 fully done by its own stated test —
flagging here rather than letting it quietly stay unaddressed now that
every numbered step is complete.

## Next task after this one
Step 9 (stand up Postgres, migrate off in-memory `WorldState`, keep
`/api/*` identical) — the last numbered step in `CLAUDE.md`'s locked
order. Every `WorldState` array has been built as a flat, row-shaped
mirror of its literal table specifically so this migration is a
straight data copy, not a reshape (repeated as a design goal in every
phase's dev-docs since step 2). Note: there is still no `/api/*` route
file anywhere in any handoff to keep identical — same gap flagged
since step 1's verification.
