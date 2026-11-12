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

GET  /api/events                          — recent events; filterable by tick range (`sinceTick`), by an entity's own real community/city (`near=<entityId>`, with `scope=community|city`, default `city`), or by an explicit `communityId`/`cityId` — not by severity, despite this line's prior claim (checked directly against `server.js`, never supported)
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

**Leader mode built 5 Nov 2026** (`server/leadership.js`), reopened by
explicit instruction after being deferred since Day 1 — see
`CLAUDE.md`'s forty-seventh standing rule. `leader-dashboard` below is
built exactly as named here; `promote-to-leader` was not in this
original plan and is added because something has to move a player from
Citizen to Leader mode, gated on the player's own linked entity already,
really holding an `organizations.leader_id` seat. Simulation mode's
`simulation-controls` stays unbuilt and deferred.

```
POST /api/players                         — { mode, linkedEntityId } -> create a player reference
GET  /api/players/:id                     — player detail, joined with linked NPC or Organization
POST /api/players/:id/action              — generic player action dispatcher, routes to the right Key/decision

GET  /api/players/:id/citizen-dashboard   — Citizen mode: career, relationships, family, property summary
POST /api/players/:id/promote-to-leader   — Citizen -> Leader, granted only if the linked entity already leads a real organization
GET  /api/players/:id/leader-dashboard    — Leader mode: organization management view
GET  /api/players/:id/simulation-controls  — Simulation mode: world variable adjustment endpoints — still deferred

GET  /api/missions/available/:entityId    — missions available to a specific player's linked entity
```

**The influence economy and character creation, built 5 Nov 2026**
(`server/influence.js`, `server/characterCreation.js`) — see
`CLAUDE.md`'s forty-eighth standing rule. `relationships.influence` and
`families.political_influence` were real schema columns with no reader
or writer anywhere before this; `net-worth`'s own route above is the
precedent these four reads follow (computed on read, never stored).
`POST /api/characters` is the one new write — everything else here is
a real, computed read.

```
GET  /api/entities/:id/influence-rating       — influenceRatingOf: the real, derived baseline a brand-new relationship seeds from
GET  /api/entities/:id/personal-influence     — personalInfluenceOf: real influence accumulated across every real relationship
GET  /api/families/:id/political-influence    — familyPoliticalInfluenceOf: the mean of living members' own personal influence
POST /api/characters                          — createCharacter: player picks occupation/country/community; family is random and revealed
```

**Three gaps closed and one extension, 6 Nov 2026 — see CLAUDE.md's
forty-ninth standing rule.** Parents/siblings now get a seeded `family`
relationship with a real, named bonus over a cousin's own baseline
(`influence.seedFamilyBond`); both dashboards above now also carry
`influenceRating` and `extendedFamily`, read live; and ordinary NPCs
`worldgen.js` generates can now get real aunts/uncles/cousins too
(`config.extendedFamily`, opt-in).

```
GET  /api/entities/:id/family-tree            — describeFamilyTree: the same real parents/siblings/cousins shape, looked up live for ANY entity
```

**Weapons/ammo, alt-policing, multi-faction heat and real contacts,
built on direct instruction — see CLAUDE.md's fiftieth standing rule.**
Two new player verbs, both **deliberately NOT given a dedicated REST
route**: each is reachable only through the real player dispatcher
(`POST /api/players/:id/action`), the identical posture
`direct-mission`/`broadcast-message` already have, because nothing
besides a player action calls for either one — a player manufactures
ammunition or finds a contact, a dashboard or an external caller never
needs to.

```
POST /api/players/:id/action { "action": "manufacture-ammunition", "ammoName": "pistol_rounds" }
                                          — weapons.manufactureAmmunition: one bounded batch, era- and occupation-gated
POST /api/players/:id/action { "action": "find-contact", "relationshipTypes": [...], "outsideHomeCity": true|false }
                                          — contacts.findOrCreateContact: real search first, generation only once nothing qualifies
POST /api/players/:id/action { "action": "intimidate", "targetId": 123 }
                                          — bluff.intimidate: brandish an equipped firearm, real or empty; raises real fear through perception.js's own calibrated belief math
POST /api/players/:id/action { "action": "assess-threat", "targetId": 123 }
                                          — bluff.assessThreat: read-only, reports only the real standing fear value, never the real armed ground truth
POST /api/players/:id/action { "action": "call-bluff", "targetId": 123 }
                                          — bluff.callBluff: deterministic and real both ways — a bluff's exposure costs real standing; a real threat called escalates through crime.recordEscalation
```

Bluffing (`bluff.js`) is likewise **not a separate endpoint** — same
dispatcher-only posture as the row above it, for the same reason.

Alt-policing (`policing.factionCapacityOf`) and multi-faction heat
(`heat.js`) are **not separate endpoints at all** — both are real,
tick-driven mechanics with no player-initiated action of their own.
Heat is surfaced as a new `heat` field on both existing dashboard
routes (`GET /api/players/:id/citizen-dashboard`,
`GET /api/players/:id/leader-dashboard`), the identical posture
`influenceRating`/`extendedFamily` already have there — read live,
never stored, never a route of its own.

## Phase 4 — Digital Planet (ecosystem link-outs) — built

**These are outbound link generators, not functional endpoints** —
VACANCY never implements the actual streaming/commerce/fashion logic
itself; see `server/ecosystemLinks.js` and `CLAUDE.md`'s fifty-eighth
standing rule for the real tech-era gate and the per-sibling route
verification behind each line below.

```
GET  /api/ecosystem/vault-studios-link/:contentId?entityId=  — real deep link into Vavlt Stvdios' GET /api/channels/:id
GET  /api/ecosystem/vulture-link/:contentType?entityId=&contentId=  — real deep link into Vvltvre's Music (/api/releases/:id) or Flix (/api/titles/:id); "touring" refused, no dedicated app exists yet
GET  /api/ecosystem/dreams-link/:screenId?entityId=  — real deep link into DREAMS' GET /api/screens/:id
GET  /api/ecosystem/venvs-link/:storefrontId?entityId=  — real deep link into VENVS' GET /api/marketplace/sellers/:id; also covers every SVMIKO DEGVCHI brand storefront (the same route named "vozzana-link" below)
```

**"Vozzana da Gucci" was a stale name — it is SVMIKO DEGVCHI, a real
17-brand fashion house living INSIDE VENVS as ordinary marketplace
sellers, not a separate app.** There is no `vozzana-link` route: a
brand storefront is addressed by the exact same `venvs-link` route
above, since it is a real VENVS seller with a runtime-assigned id and
no separate product-id namespace to address. Building a fifth route
would have meant fabricating a slug-resolution capability VENVS does
not have.

Every route above refuses with a specific reason (missing `entityId`,
an unresolvable city, or the `computing` era/real `internet`
infrastructure not yet reached in the requester's own city) rather
than defaulting to a link. All generated URLs are resource locators
into the sibling's own real API — no deep-link/hash-route convention
exists anywhere in this ecosystem yet, so none is claimed.

## Phase 5 — Multiplayer endpoints

```
GET  /api/world/shared-state              — persistent shared world snapshot (multiplayer)
POST /api/world/join                      — { playerId } -> join the shared world
GET  /api/rankings/:tier                  — leaderboards (individual|family|organization|city|civilization)
```

## Cross-cutting endpoints (all phases)

All three built. The first two were documented here as built for some
time while neither existed in `server.js` — the backing tables
(`historical_records`, `decision_log`) were real, written every tick
and persisted, with no way to read them back over HTTP until now.

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
