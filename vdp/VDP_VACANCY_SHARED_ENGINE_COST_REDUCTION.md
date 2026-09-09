# VDP + VACANCY — Shared Engine, and Cost Reduction (v1)

Real, current open-source options that could genuinely reduce
implementation cost, plus the bigger, more impactful move: sharing one
underlying engine between VDP and VACANCY instead of building two.

VACANCY's own architecture is already an ECS pattern — entities, trait
"components," and Key "systems" that process them each tick. This is a
real, established, well-solved problem, not something needing building
from zero.

## Real, existing open-source ECS libraries, genuinely well-matched

- **ecs-js** — designed for deterministic, phase-agnostic simulations
  with step-based control and replay, a close match to VACANCY's own
  tick pipeline and history/replay requirements.
- **ape-ecs** — mature JavaScript ECS library with persisted queries,
  entity references, subscribable events, and export/import support for
  save/restore state — directly relevant to the entity_traits/
  entity_knowledge persistence patterns already designed.

Honest caveat: these libraries are typically in-memory-first, so the
Postgres-backed persistence layer still needs real, custom work
regardless — but using one of these for the in-memory tick-processing
logic itself, rather than hand-building the entity/component/system loop
from scratch, is a genuine time and cost savings on Phase 1's Key
Framework and cascade pipeline work specifically.

## The bigger cost-reduction move — VDP and VACANCY sharing one engine

VDP and VACANCY are both, fundamentally, city/world simulation systems
with real, substantial overlapping needs — locations, NPCs,
organizations, economy, ownership. Building two separate simulation
engines would genuinely duplicate a large amount of real work.

The real, recommended architecture: VACANCY's database schema and engine
become the shared simulation core both VDP and VACANCY build on top of,
with each getting its own real, distinct presentation/gameplay layer
rather than its own separate underlying data model.

```
SharedEngineArchitecture {
  coreSchema: "VACANCY_POSTGRESQL_SCHEMA",   // the single, shared source of
                                             // truth for entities, traits, keys,
                                             // organizations, properties, economy
  vdpLayer: "presentation-and-gameplay-only",      // VDP builds its own districts,
                                                   // casino, Venus Resort content
                                                   // ON TOP of the same entities
  vacancyLayer: "presentation-and-gameplay-only",  // same principle, VACANCY's own
                                                   // reemergence narrative/UI
  neverDuplicate: true   // a location, an NPC, an organization is the same real
                         // database row regardless of which game surfaces it
}
```

Why this is the right call: this is the exact same "shared
infrastructure, don't duplicate" principle already proven everywhere else
in the ecosystem — VCoin/VASH as one shared financial layer, the Geo
Engine as one shared location layer. VDP and VACANCY sharing one
simulation engine is that same principle applied to world-simulation
infrastructure specifically.

Real, direct cost impact: this could plausibly cut the combined VDP +
VACANCY engineering cost significantly, since the database schema, API,
trait system, and Key framework only get built once, not twice.

**Explicit instruction for Claude Code**: when building VDP's own
systems, check whether VACANCY's schema already covers the same real
entity type before creating a new, parallel table or system. The casino,
Venus Resort properties, and VDP's NPCs should be real rows in the same
properties/entities/organizations tables already specified — not a
second, separate VDP-specific schema.

**Status**: two real cost-reduction paths confirmed — existing
open-source ECS libraries for the tick-processing layer, and the larger
move: VDP and VACANCY sharing one underlying simulation engine rather
than building two separate ones.

---

## Implementation status — filed 2026-08-27; the instruction is **adopted and enforced**

Filed per `VACO.md`'s filing form. The ECS-library section is advisory
(**STRUCTURE-ONLY**) — no dependency was added, and none should be
without a decision to take one. The explicit instruction is
**CODE-BEARING**, and it is now enforced rather than merely agreed with.

### What the duplication check found — mostly good news

Unlike three of the four VDP documents filed earlier the same day, this
one's central premise **holds**:

- `vacon-c/VACANCY_POSTGRESQL_SCHEMA.sql` is real — 760 lines, 60+
  tables, including `entities`, `properties`, `organizations`, `npcs`,
  `cities`, `events` and `economy_snapshots`.
- `vacon-c/server/` is a real engine — `engine.js`, `tick.js`,
  `keys.js`, `entityTraits.js`, `economy.js`, `migrate.js` — and
  `vacon-c/server.js` requires it.

### The one qualification, and why it changes what could be built

`vacon-c/server/db.js` says plainly in its own header that converting
the engine's functions to query Postgres "is explicitly flagged as NOT
done in this pass" — every one of them is synchronous and array-based,
and the engine still reads an in-memory WorldState. `migrate.js` is a
real, tested, **one-way** export into the schema.

So there is a real schema, a real engine, and a real migration — and no
live table anything currently reads from. **"Real rows in the same
tables" is therefore not yet true of anything, including VACANCY's own
data.** Writing VDP code that pretended otherwise would be the failure
class this repo keeps finding.

### What was built instead: the half that can be true now

`vdp/src/lib/vacancySchema.js` declares which existing VACANCY table
each VDP world object belongs to — resort venues are `properties`,
resort staff are `npcs`, the licence-holder is an `organizations` row,
fighters are `entities`, simulated areas are `cities`. Four things are
deliberately **not** mapped, each with a stated reason, because an
omission with no reason is indistinguishable from an oversight.

`scripts/test/vacancy-schema-alignment.test.mjs` enforces it: every
table VDP names must be a real `CREATE TABLE` in the schema file, and
the failure message says explicitly *do not add a VDP-specific table to
resolve this — that is the parallel schema the instruction exists to
prevent*. It also fails if `engine.js` ever starts requiring `db.js`,
which is the structural signal that the Postgres conversion has landed
and this mapping should stop being declaration-only.

The result: no parallel schema exists, the mapping is stated and
checked, and when the conversion happens VDP's casino and NPCs slot into
the shared tables rather than needing a reconciliation nobody planned.

### A note on the test that had to be rewritten

The engine check first asserted on a sentence in `db.js`'s header — and
failed immediately, because that phrase wraps across two comment lines
and the regex could never match. A test that cannot pass is as useless
as one that cannot fail. Rewritten to check the structural fact instead
(does `engine.js` require `db.js`), which is both robust and the better
signal.
