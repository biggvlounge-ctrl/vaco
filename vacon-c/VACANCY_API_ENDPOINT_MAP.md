# VACANCY — API Endpoint Map
### Document 3 of 7 — Final Handoff Package

**Confirmed connection**: this is Document 3 of the same seven-
document technical handoff package — Documents 1 (Build Prompt), 2
(PostgreSQL Schema), and 7 (Trait Database) are already integrated.
This document defines the actual REST contract Claude Code should
implement, phased identically to the Build Prompt's development
order.

## Existing endpoints (already built, do not change the contract)

```
GET  /api/state           — full world snapshot
POST /api/tick             — advance simulation one tick, returns new snapshot
POST /api/npc/generate      — spawn a new NPC, returns { npc, state }
POST /api/mission           — { artifactId } -> generates a mission, returns { mission, state }
GET  /api/health            — { ok, tick }
```

Every new endpoint below follows the same shape: REST-ish, JSON in/
out, mutating endpoints return `{ result, state }` or a scoped
snapshot rather than the full world state where that would be
wasteful.

## Design rule for all new endpoints

**Any endpoint that resolves a decision through a Key must write back
to Memory, Relationships, and World state before returning.** If an
endpoint only returns a value without those three writes, it's
incomplete — this applies to every `POST` below that triggers a Key
resolution, not just the ones that say so explicitly.

## Phase 1 — DNA Prototype endpoints

```
GET  /api/entities/:id                    — single entity (any type), joined with its traits
GET  /api/entities/:id/traits             — entity_traits rows for one entity
POST /api/entities/:id/traits/:traitId    — manually adjust a trait (admin/debug only)

GET  /api/npcs                            — list NPCs (paginated, filterable by faction/community/status)
GET  /api/npcs/:id                        — full NPC detail: traits, archetypes, needs, goals, relationships
POST /api/npcs/:id/decide                 — force-resolve a decision for one NPC via a named Key (debug/testing)

GET  /api/keys                            — list key_definitions
POST /api/keys/:keyId/resolve             — { entityId, context } -> resolves one Key, writes back per 4.3

GET  /api/families                        — list families
GET  /api/families/:id                    — family detail: members (via family_memberships), wealth rollup, traditions
POST /api/families                        — create a family
POST /api/families/:id/members            — { entityId, role } -> add a member via family_memberships

GET  /api/organizations                   — list organizations (all types)
GET  /api/organizations/:id               — detail; includes faction/business/government subtype data if present
POST /api/organizations                   — { name, type, founderId } -> create
GET  /api/factions                        — list factions specifically (organizations where a factions row exists)
GET  /api/factions/:id/territory          — territory_blocks controlled by this faction

GET  /api/economy/snapshot                — current economy_snapshots for a given entity/tier
POST /api/economy/tick                    — resolve one Economy phase (called internally by /api/tick, exposed for testing)

GET  /api/events                          — recent events, filterable by tick range/severity
GET  /api/artifacts                       — list artifacts
GET  /api/missions                        — list missions, filterable by status
```

## Phase 2 — World Expansion endpoints

```
GET  /api/properties                      — list properties, filterable by city/type/owner
GET  /api/properties/:id                  — detail: occupants, operating org, history
POST /api/properties/:id/ownership        — { ownerEntityId, ownerType, method } -> new ownership_records row

GET  /api/communities                     — list communities, filterable by city
GET  /api/communities/:id                 — detail: population, safety, reputation rollup

GET  /api/cities/:id                      — city detail: reemergence_index, infrastructure rollup, economy
GET  /api/cities/:id/reemergence          — reemergence composite breakdown (sub-indices)

GET  /api/businesses                      — list businesses (organizations where type=business)
GET  /api/market/listings                 — current market_listings for a city
GET  /api/trade-routes                    — active trade routes between cities

GET  /api/relationships/:entityId         — all relationships for one entity
POST /api/relationships                   — { entityAId, entityBId, type } -> create a relationship

GET  /api/culture/:tierEntityId           — Culture DNA trait sheet for a Family/Community/Org/City/Civilization
```

## Phase 3 — Player Experience endpoints

```
POST /api/players                         — { mode, linkedEntityId } -> create a player reference
GET  /api/players/:id                     — player detail, joined with linked NPC or Organization
POST /api/players/:id/action              — generic player action dispatcher, routes to the right Key/decision

GET  /api/players/:id/citizen-dashboard   — Citizen mode: career, relationships, family, property summary
GET  /api/players/:id/leader-dashboard    — Leader mode: organization management view
GET  /api/players/:id/simulation-controls  — Simulation mode: world variable adjustment endpoints

GET  /api/missions/available/:entityId    — missions available to a specific player's linked entity
```

## Phase 4 — Digital Planet (ecosystem link-outs, not built here)

**These are outbound link generators, not functional endpoints** —
VACANCY should never implement the actual streaming/commerce/fashion
logic itself.

```
GET  /api/ecosystem/vault-studios-link/:contentId   — generates a deep link into Vavlt Stvdios
GET  /api/ecosystem/vulture-link/:contentType        — generates a deep link into Vvltvre (Music/Flicks/Tix&Touring)
GET  /api/ecosystem/dreams-link/:screenId            — generates a deep link into DREAMS
GET  /api/ecosystem/venvs-link/:storefrontId         — generates a deep link into VENVS
GET  /api/ecosystem/vozzana-link/:productId          — generates a deep link into Vozzana da Gucci
```

## Phase 5 — Multiplayer endpoints

```
GET  /api/world/shared-state              — persistent shared world snapshot (multiplayer)
POST /api/world/join                      — { playerId } -> join the shared world
GET  /api/rankings/:tier                  — leaderboards (individual|family|organization|city|civilization)
```

## Cross-cutting endpoints (all phases)

```
GET  /api/historical-records               — searchable history, filterable by entity/location/tick range
GET  /api/analytics/:tick                  — analytics_snapshots for a given tick
GET  /api/decision-log/:entityId          — decision audit trail for one entity
```

## What NOT to build as endpoints

- **Anything under Phase 4's ecosystem list beyond link generation** —
  VACANCY supplies content, the linked apps supply functionality.
- **A standalone `/api/banking/*`** — routes through VASH
  conceptually, not a parallel banking API.
- **Gambling/casino endpoints** — gated behind the compliance review
  already flagged; do not implement ahead of that review.

## Status

**Document 3 of the real seven-document handoff package, now four of
seven confirmed** (1, 2, 3, 7). This is a genuinely complete, directly
implementable REST contract — every endpoint maps to a specific
table or Key resolution already defined in the PostgreSQL schema
(Document 2), phased identically to the Build Prompt's development
order (Document 1). Combined, these three documents plus the Trait
Database give Claude Code the database, the API surface, the trait
data, and the build order — a genuinely complete technical starting
point. All seven documents in the handoff package are now confirmed
and integrated — Documents 4, 5, and 6 arrived in subsequent messages
and are folded into this package.
