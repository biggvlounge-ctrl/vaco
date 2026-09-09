# VACANCY — Claude Code Build Prompt
### Document 1 of 7 — Final Handoff Package

**Confirmed real connection**: this is Document 1 of the same seven-
document technical handoff package that included the Trait Database
Attachment (Document 7, already integrated). This is the actual
directive meant to be handed directly to Claude Code — a distilled,
actionable summary of the full Master Architecture Document, not a
separate design exercise.

## Role

You are extending an existing, working prototype into a full
civilization simulation engine. **Do not rebuild from zero.** The
foundation is already validated and running: NPC generation with a
full multi-family trait system, Faction system (territory, morale,
status resolution), Economy prototype (VCoin, scarcity), Event engine,
Competition/league system, Artifact/Mission system, and a working
Express API + React frontend, deployable to Replit.

**Read `VACANCY-MASTER-ARCHITECTURE.md` in full before writing any
code** — it is the canonical source of truth. Where this document and
the master architecture disagree, **the master architecture wins.**

## What VACANCY is

A civilization operating system, not a traditional game. The world
runs without the player.

## The Three DNA Layers

1. **System DNA** — what can happen (500+ systems, indexed in
   `VACANCY-SYSTEM-INDEX.md`)
2. **Trait DNA** — what an entity is (19 trait families today, scaling
   toward 2,100)
3. **Key DNA** — how traits resolve into outcomes

## Master Simulation Equation

```
OUTCOME = ENTITY TRAITS + ACTIVE KEYS + ENVIRONMENT + TIME + HISTORY + DECISIONS
```

Every Key resolver must read subjective, per-entity knowledge
(`entity_knowledge`), not raw world state. Every Key must write back
to three places: Memory, Relationships, World state. **This is the
definition of "done" for any single Key.**

## Entity Hierarchy — corrected

**Social hierarchy**: Individual → Family → Community → City →
**Region** → Civilization. Region is a real tier with its own table —
do not collapse it into a string field or skip it.

**Physical/spatial hierarchy (distinct)**: Planet → Continent →
Country → Region → City → District/Neighborhood/Block (handled by
`communities.tier`, not three separate tables) → Property → Building
→ Room.

Every entity type: NPC, Family, Organization (parent) with Faction and
Business as subtypes, Community, City, Region, Civilization, Property,
Artifact, Digital Asset, Player.

## Database

**Use the full schema (~50+ tables), not a simplified list.**

- Traits and Keys each need a definition/instance split —
  `trait_definitions` + `entity_traits`, `key_definitions` +
  `keys_log` — built split from the start.
- Organization is a parent table; Faction and Business are subtype
  specializations, not separate root entities.
- `territory_blocks` is its own table — do not flatten it into a
  column on `factions`.
- **Rollups, not duplicated data**: Reemergence Categories, Property
  Value, Community Health, Family Wealth are all *computed*, never
  independently stored.

A standalone SQL schema file follows as Document 2 — the literal
source of truth for table shapes.

## Simulation Tick Pipeline

```
1. ENVIRONMENT   — weather, climate, disasters, active conditions
2. RESOURCE      — production/consumption per resource type
3. ECONOMY       — supply/demand keys resolve price + scarcity
4. SOCIAL        — trust/relationship keys update, culture mutation
5. DECISION      — NPC/business/organization choices resolve via Keys
6. MIGRATION     — NPCs may relocate based on scarcity+fear keys
7. ORGANIZATION  — factions/orgs gain or lose territory, resources
8. SECURITY      — conflict probability resolved from aggression+territory keys
9. EVENT         — events emerge FROM the above phases, never rolled independently
10. HISTORY      — every significant action writes to historical_records
11. REEMERGENCE  — composite score recalculated from full system state
```

Events must never be pure random rolls once this pipeline is live —
they are outputs of phases 1-8.

## Player Modes

Four modes, all on the same simulation state — a player is never a
new entity type, just a `players` table reference into an existing
`npcs` or `organizations` row: **Citizen** (one NPC), **Leader** (one
organization), **Simulation** (god/observer), **Multiplayer** (any of
the above, shared world). Build Citizen mode first — cheapest, a thin
interaction layer over existing NPC data.

## Game DNA — mechanics only, never names or assets

Zelda, GTA, Sims, Civilization, Crusader Kings, Minecraft, Maniac
Mansion, Carmen Sandiego, River City Ransom — references for which
mechanics to build, never licenses to reuse branding.

## Ecosystem — link out, do not rebuild

| Domain | Links to |
|---|---|
| Streaming/broadcast | Vavlt Stvdios |
| Music, Film, Live Events | Vvltvre |
| Fashion (design/retail/marketing) | Vozzana da Gucci |
| AI-assisted prediction/personalization/creative tools | V4 |
| Digital screens/advertising/digital real estate | DREAMS |
| Virtual storefronts/digital commerce space | VENVS |
| Payments, banking, cash-out | VASH |

VCoin is the shared ecosystem currency — extend the existing `vcoin`
index, never create a second currency.

## Compliance flags — do not resolve in code

Two areas need a real legal/compliance pass before implementation, not
a code-level decision: Gambling/Casino mechanics, and Subscription +
cash-out-capable rewards + competitive payouts (age-gating, payment
compliance, tax handling).

## Subscription tiers — resolved, final

Free → Plus ($9.99/mo) → Pro ($19.99/mo) → Vault Creator ($49.99/mo) →
Vault Elite ($99.99/mo). Confirmed three independent times — final,
not provisional.

## Development Order

**Phase 1 — DNA Prototype**: NPC, Traits (definition/instance split),
Keys, Families, Organizations (with Faction/Business subtypes),
Economy, Events. Locked First Prototype Scope — 10 systems, not all
500.

**Phase 2 — World Expansion**: Property, Movement, Communities,
Businesses, Culture.

**Phase 3 — Player Experience**: Citizen Mode, Leader Mode,
Exploration, Missions.

**Phase 4 — Digital Planet**: Digital twins, DREAMS integration, VENVS
integration, virtual commerce. Deliberately late — ecosystem link-
outs, not blocking work.

**Phase 5 — Global Civilization Network**: Multiplayer, full creator
economy, planet-scale simulation.

## The one instruction that matters most

**Build the smallest version that proves the DNA.** Do not attempt
all 500 systems immediately. The goal: one living city — St. Louis —
with people, families, businesses, relationships, economy, history,
culture, and emergent stories. If one city works, the civilization
engine works.

## Status

**This is Document 1 of the real, seven-document technical handoff
package** — the actual, literal instruction set meant to be given
directly to Claude Code, distilling the full Master Architecture
Document into an executable build order. Document 7 (Trait Database
Attachment) is already integrated in this package. **Documents 2
through 6 are referenced directly in this document** (Document 2:
the standalone SQL schema file) and would be genuinely valuable to
bring in if available — this document alone confirms they contain
real, concrete implementation detail (the literal schema, presumably
API contracts, seed data, and similar) beyond what's captured in the
Master Architecture Document's prose.
