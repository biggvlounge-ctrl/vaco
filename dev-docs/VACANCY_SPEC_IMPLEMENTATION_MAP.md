# VACANCY — spec to implementation map

**Read this before writing any VACANCY code.** The consolidated master
spec (`vacon-c/VACANCY_CONSOLIDATED_MASTER_SPEC.md`) arrived with an
explicit instruction: treat it as the design specification, then
inspect the existing codebase and map each requirement to what is
already implemented **before rewriting anything**. This is that map.

**Why it matters more than it sounds.** A good deal of the spec is
already built and tested — the 11-phase tick loop, the trait
definition/instance split, contests, property, territory, culture,
missions, the 63-table schema. Someone reading §84's twelve-phase
development order cold would start at "PHASE 1 — create project,
database, authentication" and rebuild what exists.

Every figure below was read out of the code by a command, not recalled.
Where a section is partly built, the split is stated rather than
rounded to "done" or "not started".

| Mark | Means |
|---|---|
| **BUILT** | Implemented and covered by `vacon-c/test/`. |
| **PARTIAL** | The mechanism exists; the content or scope does not. The gap is quantified. |
| **NOT BUILT** | No implementation. |

---

## The five numbers that frame everything

| | Figure | Read from |
|---|---|---|
| Trait definitions | **128** (114 individual, 20 families) | `server/traitDefinitions.js` |
| ...against the spec's §19 | **2,100** | a target, ~5% populated |
| Database tables | **63** | `VACANCY_POSTGRESQL_SCHEMA.sql` |
| Tick phases, ordered | **11** | `server/tick.js:481-518` |
| HTTP routes | **79** | `server.js` |
| Tests | **317** | `dev-docs/TEST_COUNTS.json` |

**The trait number is the single most important line in this
document.** §19 asks for a 2,100-characteristic matrix and the
architecture for one is real and correct — a `trait_definitions` /
`entity_traits` split, generated per tier, with modifiers, exactly as
§19's last paragraph asks ("structured data rather than hard-coded into
individual NPC logic"). What does not exist is 1,972 of the 2,100
entries. The sender said so plainly at intake; this repeats it because
a 5%-populated catalogue behind a correct architecture is very easy to
mistake for a finished system.

---

## §§1–5 · Premise, principle, hierarchy, initial state, geography

| § | State | Detail |
|---|---|---|
| 1 Premise | **BUILT** | The collapse premise is the model's basis throughout, not a setting. |
| 2 World continues without the player | **BUILT** | `server/tick.js` advances every phase with no player input. `runDecisionPhase` drives NPC choice. |
| 3 World hierarchy | **PARTIAL** | `cities`, `communities`, `territory_blocks`, `properties`, `organizations`, `entities` are real tables and generators. **`regions` exists as a table but `region_id` is left null** — `server/territory.js:9` says so in its own header. No `countries`. So the hierarchy is built from CITY down, not from WORLD down. |
| 4 Zero civilization period | **BUILT** | `getCityReemergence` and `runReemergencePhase` compute recovery from an offline baseline. |
| 5 Real geography, St. Louis prototype | **PARTIAL** | One city, named. No road/river/terrain/landmark geometry, no 180–200-mile region, no coordinates beyond property-level fields. The scalability §5 asks for is a schema property, not a populated world. |

## §6 · The 12 core simulation engines

Eleven tick phases exist, in a fixed order. The mapping is not
one-to-one and the difference is worth seeing:

| Spec engine | Phase / module | State |
|---|---|---|
| 1 Population | `runMigrationPhase`, `generateNPC`, `generateFamily`, `addFamilyMember` | **BUILT** |
| 2 Economy | `runEconomyPhase`, `server/economy.js` — resources, scarcity, market listings, price resolution, individual finances, net worth | **BUILT** |
| 3 Property | `server/property.js` — generate, value, ownership records, ownership history, holdings, lifecycle | **BUILT** |
| 4 Organization | `runOrganizationPhase`, `generateOrganization`, `generateFaction`, membership table | **BUILT** |
| 5 Territory | `server/territory.js` — blocks, `resolveTerritoryControl`, community health | **BUILT** |
| 6 Crime | `runSecurityPhase` | **PARTIAL** — one phase covers crime and policing together; the spec's crime-density/retaliation/hotspot tracking is not separately modelled. |
| 7 Law enforcement | `runSecurityPhase` | **PARTIAL** — same phase. No patrols, investigations, raids, arrests or clearance rates as distinct mechanics. |
| 8 Social influence | `runSocialPhase`, `server/worldStore.js` relationships | **BUILT** |
| 9 Resource | `advanceResourceTick`, `getScarcity`, `runResourcePhase` | **BUILT** |
| 10 Infrastructure | `infrastructure` table, `runReemergencePhase` | **PARTIAL** — recovery is modelled; outages and per-system quality are thin. |
| 11 Event | `runEventPhase`, `runHistoryPhase`, `events` + `historical_records` | **BUILT** — and cascading events are real: `test/drought-cascade.test.js` covers a chain. |
| 12 AI decision | `runDecisionPhase`, `server/behavior.js`, `server/keys.js` | **BUILT** — see §§21–23. |

**No phase is missing entirely.** The two PARTIALs are both the
crime/policing split, which is one phase doing two engines' work.

## §7 · The 40 urban systems

**PARTIAL, and the honest answer is that nothing enumerates them.**
Roughly 25 of the 40 are represented by a table, a phase or a trait
family; the rest (Court, Prison, Waste, Fire & Emergency, Social Media,
Tourism, Military/National Guard) have no representation. There is no
list of 40 anywhere in the code to check against, which means "how many
of the 40 are built" cannot be answered by a command — the first real
task here is writing that list down as data.

## §§8–12 · City, block key, property control, territory

| § | State | Detail |
|---|---|---|
| 8 City simulation | **BUILT** | `generateCity`, `getCityDetail`, cities evolve per tick. |
| 9 Master block key | **PARTIAL** | `territory_blocks` carries control, loyalty and pressure fields. The key's 17 categories — surveillance, mobility, reputation, psychological, community, environment — are largely absent. This is the biggest single content gap after traits. |
| 10 Property control & stewardship | **PARTIAL** | Ownership, history and holdings are real. Stewardship ROLES and member ASSET CONTRIBUTION are not modelled. |
| 11 Property control scale 1–10 | **PARTIAL** | Control is computed; the 1–10 scale and the seven named status values are not the implementation's vocabulary. |
| 12 Territory expansion | **BUILT** | `resolveTerritoryControl` accounts for loyalty, resources and pressure. |

## §§13–16 · Organizations, hierarchy, influence, social graph

| § | State | Detail |
|---|---|---|
| 13 Organization / faction system | **BUILT** | Identity, leadership, membership, resources, territory, reputation. `organizationTraits.js` gives factions a full trait sheet. |
| 14 Gang / organization structure | **PARTIAL** | Hierarchical roles are not enumerated. **The spec's own safety rule IS honoured**: nothing equates affiliation with personality — behaviour comes from the individual's live trait sheet via `getLiveEntity()`. |
| 15 Reputation & influence economy | **PARTIAL** | A `reputation` trait family (4 traits) and `public_opinion` exist. Influence RADIUS and DECAY, which §15 names specifically, are not implemented. |
| 16 Social graph | **BUILT** | `relationships` with weighted values; `getOrCreateRelationship`, `adjustRelationship`. **The five default weights in §16 should be checked against the code before being treated as live** — they are documented as defaults, not as universal values. |

## §§17–23 · NPCs, life history, traits, generation, psychology, emotion, decisions

This block is the most complete in the whole spec.

| § | State | Detail |
|---|---|---|
| 17 NPC human simulation | **BUILT** | `generateNPC` + `npcs` + `entities`. |
| 18 NPC life history | **PARTIAL** | `memories`, `employment_records` and `historical_records` exist. A generated childhood/trauma/achievement narrative at creation does not. |
| 19 2,100 trait matrix | **PARTIAL — architecture BUILT, catalogue 114/2,100** | The definition/instance split, per-tier generation and modifier support are all real. Every definition currently uses the schema's literal column defaults, and `traitDefinitions.js` says so — no per-trait tuning is invented. |
| 20 NPC generation engine | **PARTIAL** | Identity, traits, family, organization affiliation, location and finances are generated. Of the 20 pipeline steps, birthplace, cultural/language context, childhood, life experiences and memories at creation are the gaps. |
| 21 AI psychology engine | **BUILT** | `server/keys.js` resolves resilience, adaptability, trust, scarcity response, fear, aggression and territory from live traits. |
| 22 Emotion system | **BUILT** | `server/behavior.js` — `applyStress`, `moodFor`, `recoveryRate`, `loadMultiplier`, behaviour states. |
| 23 AI decision model | **BUILT** | `runDecisionPhase` + `dispatchAction`. **Nonviolent options are present** — `listActions` is asserted to be real by `assertActionsAreReal`. |

**Two self-checks in this code worth knowing about**, because they are
the same kind of guard the rest of the repo uses:
`assertBehaviorReadsRealTraits` and `assertDisciplinesReadRealTraits`
fail if behaviour or contests stop reading the live trait sheet. That
is what stops §23's decision model quietly degrading into fixed
behaviour, which §82 forbids.

## §§24–29 · Knowledge, education tiers, barter, resources, supply chain

| § | State | Detail |
|---|---|---|
| 24 Knowledge recovery | **PARTIAL** | `entity_knowledge` exists but models something different: information SPREAD — `confidence_level`, `spread_rate`, `distortion_level`, `source_entity_id`. That is rumour and transmission, not knowledge-as-civilization-resource. |
| 25 Education & knowledge tiers 1–10 | **NOT BUILT** | No tiers, no prerequisites, no book languages, no translation. `educational` has 4 traits. This is a clean greenfield piece. |
| 26 Barter economy | **PARTIAL** | `market_listings` + `resolveMarketPrice` + `getScarcity` are the mechanism, and scarcity moves price. The `economic` trait family includes `Barter Skill`. |
| 27 Master barter key | **NOT BUILT** | No item catalogue. The spec gives 17 example values against a ~3,750-item target; none of the 17 are in the code. The seven per-item fields (Base_Value, Rarity, Environment_Modifier, Population_Modifier, Final_Barter_Score) have no table. |
| 28 Resource engine | **BUILT** | Produced, consumed, stored, scarce, priced. |
| 29 Supply chain | **PARTIAL** | `trade_routes` is a table. No route mechanics, hubs, lanes or transport tiers. |

## §§30–35 · Buildings, artifacts, control nodes, missions

| § | State | Detail |
|---|---|---|
| 30 Building & location key | **PARTIAL** | `properties` and `THE_KEY_BUILDING_TYPES.md` + `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` exist as documents. The eleven building-type groups are not a populated taxonomy in code. |
| 31 Artifact system | **BUILT** | `generateArtifact`, `getArtifact`, `listArtifacts`, `artifacts` table. |
| 32 Control node system | **PARTIAL** | Territory control is computed; the four named node states (LOCKED / CONTESTED / CONTROLLED / FORTIFIED) are not the implementation's vocabulary. |
| 33 Artifact mission engine | **BUILT** | `generateMission` from artifact + location + state; `acceptMission`, `resolveMission`, `payMissionReward`. |
| 34 Two simultaneous layers | **BUILT** | The artifact layer sits over the base simulation and does not replace it. |
| 35 Missions emerge, no quest markers | **BUILT** | `availableMissions` is derived from world state. |

## §§36–49 · Civilization recovery, events, time, weather, neighbourhoods, city DNA

| § | State | Detail |
|---|---|---|
| 36 Community development ladder | **PARTIAL** | `communities` + `getCommunityHealth`. The six named stages (camp → civilization) are not an explicit progression. |
| 37 Civilization reemergence engine | **BUILT** | `runReemergencePhase`, `getCityReemergence`, `technology_eras` (10 named eras with `requirements`), `civilization_technology_progress`. |
| 38 Regional states | **PARTIAL** | A reemergence index is computed; the four named bands are not applied as labels. |
| 39 Reemergence systems | **PARTIAL** | The ladder is by technology era, not by the five named system groups. **The spec's own restraint on weapons infrastructure is respected** — nothing models construction instructions. |
| 40 Bottleneck logic | **BUILT** | `technology_eras.requirements` is the dependency chain, and `test/drought-cascade.test.js` proves a real cascade. |
| 41 Historical memory | **BUILT** | `historical_records`, `runHistoryPhase`, `memories`, `decision_log`. |
| 42 Probability system | **BUILT** | `winProbability`, `seededUnit`, `hashSeed` in `contest.js`; probability throughout the tick. |
| 43 Event engine | **BUILT** | With cascades. |
| 44 Movement system | **NOT BUILT** | No routes, patrols, commutes or deliveries. |
| 45 Time system | **PARTIAL** | Ticks, schedules (`schedule_events`, `isDue`) and intervals are real. Day/night, weekday/weekend, season and aging are not. |
| 46 Weather & environment | **PARTIAL** | `environment_state`, `addEnvironmentalCondition`, `runEnvironmentPhase`, and drought cascades to the economy. Temperature/rain/snow/storm specifics are not modelled. |
| 47 Neighborhood outcome variables | **PARTIAL** | `getCommunityHealth` computes a composite. The 20 named variables are not individually tracked. |
| 48 Neighborhood stability bands | **PARTIAL** | Health is computed; the five bands are not labels. |
| 49 City DNA | **NOT BUILT** | No city identity types, no DNA modifiers. One of the four documents this consolidation replaced was the City DNA framework. |

## §§50–59 · Player, legacy, combat, sports, training, family, memory, mentors

| § | State | Detail |
|---|---|---|
| 50 Player system | **BUILT** | `generatePlayer`, `getCitizenDashboard`, `players` table. |
| 51 Player legacy | **PARTIAL** | Actions write to `decision_log` and `historical_records`. Generational continuity is documented (`PLAYER_DEATH_GENERATIONAL_CONTINUITY.md`) rather than built. |
| 52 Combat system | **BUILT** | `server/contest.js` — `resolveContest`, `verifyContest`, weighted disciplines, probabilistic outcome. **"Combat must not be guaranteed" is honoured**: `winProbability` is seeded and probabilistic, so a weaker character can win. |
| 53 Fighting styles | **PARTIAL** | A `combat` discipline reads Melee Skill, Weapon Mastery, Tactical Awareness and Composure Under Fire. The nine named styles are not separate. **The spec's framing is respected** — these are character-development attributes, not instruction. |
| 54 Sports system | **PARTIAL** | A `sport` discipline exists (Speed, Coordination, Competitive Drive, Injury Resistance) and a `sports` trait family. **No teams or leagues: zero matching tables in the schema.** Athletes/coaches/promoters/owners are not modelled. |
| 55 Training & progression | **PARTIAL** | `reinforceHabit` and trait growth/decay rates exist. Explicit training against the nine progression categories does not. |
| 56 Family system | **BUILT** | `families`, `households`, `family_memberships`, `generateFamily`, `addFamilyMember`, `getFamilyWealth`, `familyTraits.js`. |
| 57 NPC memory | **BUILT** | `memories` + `addMemory`, read by decisions. |
| 58 Mentor system | **NOT BUILT** | No teacher/student/apprentice relationships, no knowledge transfer requiring trust and time. |
| 59 Development system | **PARTIAL** | Property lifecycle and migration exist. Gentrification and redevelopment as named dynamics do not. |

## §§60–66 · First-world city, media, culture, politics, health, education, technology

| § | State | Detail |
|---|---|---|
| 60 First-world city playability | **PARTIAL** | The reset-era model is what exists; the Chicago modern-city layer is a document, not code. Compatibility is a claim nothing currently tests. |
| 61 Media & communication | **PARTIAL** | `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` plus `entity_knowledge`'s spread and distortion fields are genuinely the word-of-mouth layer. Radio, news and social media are not. |
| 62 Cultural system | **BUILT** | `server/culture.js` — generate, attach, membership, lookup. |
| 63 Political / government system | **PARTIAL** | `governments`, `elections`, `votes`, `laws`, `public_opinion`, `revolutions` are all real tables. The six-stage progression from informal rules upward is not implemented. |
| 64 Health system | **PARTIAL** | A `health` trait family (4). No disease, no medical knowledge loss and recovery, no clinics as a system. |
| 65 Education system | **PARTIAL** | `educational` traits (4). No schools, teachers, literacy or libraries as entities. |
| 66 Technology recovery | **BUILT** | `technology_eras` with prerequisites. |

## §§67–71 · Graphs, precision, scalability, tick, persistence

| § | State | Detail |
|---|---|---|
| 67 Network / graph engine | **PARTIAL** | Relationship, family and organization graphs are real and weighted. Trade, transport, communication and influence graphs are not. |
| 68 Advanced precision systems | **PARTIAL** | Weighted scoring, conflict escalation, economic ripple, territory stability, resource consumption, historical memory and graphs are all present. **Influence radius and multi-scale simulation are the two that are not.** |
| 69 Simulation scalability | **NOT BUILT** | No detail levels. The whole world simulates at one fidelity, which is the single biggest obstacle to §97's "millions of unique AI-driven people". |
| 70 Simulation tick | **BUILT** | 11 ordered phases, configurable rate. |
| 71 Save / world persistence | **BUILT** | `server/persistence.js` + `restore.js` + a 63-table schema, with `test/persistence.test.js` and `test/restore.test.js` (both **skip without a real Postgres** — 17 of the repo's 49 skipped tests are these). |

## §§72–79 · Front end, map, services, database, API, security, separation, AI

| § | State | Detail |
|---|---|---|
| 72 Front end | **PARTIAL** | `public/index.html` + the shared VACO design system. Of the eighteen named panels, a minority exist. |
| 73 Map interface | **NOT BUILT** | No map, no eight zoom levels, no markers. §72/§73 together are the largest build remaining. |
| 74 Backend architecture (21 services) | **BUILT, differently** | 25 modules under `server/` rather than 21 named services. The spec's §86 requirement — modular, not one monolith — is met: the largest file is `engine.js` at 894 lines and every module has its own tests. |
| 75 Database model (36 entities) | **BUILT** | 63 tables, a superset. Gaps against §75 are `Books`, `Schools`, `Hospitals`, `Sports`, `Teams`, `Leagues`, `Countries`. |
| 76 API requirements | **BUILT** | 79 routes, held by `test/routes.test.js`. |
| 77 Security | **PARTIAL, and this is an ecosystem-level answer** | VACON-C sits behind the repo's shared `serviceAuth`, `shieldAuth`, `operatorAuth` and tracing, and its `vacon-c:tick` scope is a real operator scope. Input validation and server-side authority are real. **Anti-cheat controls are not built**, and matter only once §84's Phase 11 exists. |
| 78 Frontend / backend separation | **BUILT** | The client holds no authoritative state. |
| 79 AI agent architecture | **BUILT** | Deterministic where it must be — `hashSeed`/`seededUnit` make contests reproducible — probabilistic elsewhere. |

## §§80–92 · Worked examples and design rules

These are rules rather than features. Each is checkable, and each
currently holds:

- **§80 example AI decision** — the food-shortage path exists through
  `runDecisionPhase` and `resolveScarcityResponse`.
- **§81 ripple effects** — `test/drought-cascade.test.js` is exactly
  this, in the other direction.
- **§82 no static world** — enforced by the two `assert*ReadsRealTraits`
  guards and by `assertActionsAreReal`.
- **§86 modular, no monolith** — met; see §74 above.
- **§88 world seed** — `hashSeed`, `seededUnit` and `reseedIds` across
  eleven modules. Reproducibility is real.
- **§89 fog of knowledge** — `entity_knowledge` is per-entity with
  confidence and distortion, so NPCs genuinely know different things.
  **Whether the PLAYER's view is filtered by it is not established** —
  that is worth checking before claiming §89.

## §§83, 84, 87, 93–95 · Testing, order, tooling, definitions

| § | State | Detail |
|---|---|---|
| 83 Testing requirements | **PARTIAL** | 317 tests across 15 files. Of the 18 named subjects, roughly 12 are covered. **Stress testing is not done**: no large-population, large-graph or many-simultaneous-event runs. |
| 84 Development order | **See below** | Phases 1–8 are substantially done, 9 partly, 10–11 not at all. |
| 87 Debug / admin system | **PARTIAL** | `describeBehavior`, `describeFlows`, `getEntityState`, `listHabits`, `getCityDetail` and the tick controls are inspectors. There is no single admin surface. |
| 93 MVP definition | **PARTIAL** | Everything on the MVP list exists except the 2,100-trait catalogue, sports, and a map. |
| 94 Definition of "playable" | **MOSTLY MET** | Thirteen of the fourteen clauses hold. The one that does not: "the player can move" — there is no movement system (§44). |
| 95 Definition of "complete" | **NOT MET** | Missing: knowledge tiers, barter catalogue, map, movement, mentors, sports leagues, city DNA, scalability levels, multiplayer, stress tests. |

---

## What to actually do next, in order

This replaces §84's Phase 1 start for anyone working in this
repository. §84's order is right for a greenfield build; this is the
order for the build that exists.

| # | Work | Why here |
|---|---|---|
| 1 | **Write the 40 urban systems down as data** | §7 cannot be measured at all today. It is an afternoon, and it makes every later claim checkable. |
| 2 | **Generate the trait catalogue toward 2,100** | The architecture is done and the content is 5% there. Generated entries must be labelled generated — they are not recovered source. |
| 3 | **Knowledge tiers 1–10 (§25)** | Clean greenfield, no conflict with the existing spread model, and §40's bottleneck logic already has somewhere to plug in. |
| 4 | **Movement system (§44)** | The one unmet clause in §94's own definition of playable. |
| 5 | **Map interface (§73)** | Largest remaining build, and the thing that makes the rest visible. |
| 6 | **Barter item catalogue (§27)** | The mechanism exists; this is content plus one table. |
| 7 | **Simulation detail levels (§69)** | The gate on §97's scale. Nothing else unblocks millions of NPCs. |
| 8 | **City DNA (§49), mentors (§58), sports leagues (§54)** | Self-contained additions. |
| 9 | **Stress tests (§83)** | Deferred deliberately until after §69 — stress-testing one fidelity level measures the wrong thing. |

**Not on this list, and deliberately:** multiplayer (§84 Phase 11) and
anti-cheat (§77). Both are real requirements and both are premature
while §§44, 69 and 73 are open.

---

## Two honesty notes

**The four documents this consolidation replaced included the City DNA
framework and the Civilization DNA database.** §49 is NOT BUILT above,
and the detailed source for it is gone. Whatever gets built for city
identity is new design work, not recovery — and should say so.

**Two figures in here were wrong on the first pass, and the reason is
worth repeating.** "20 modules" and "eight modules with `reseedIds`"
came from a loop over twenty file names I had typed out, not from the
directory — the real answers are 25 and 11. A sample that looks like a
census is the easiest way to state a confident wrong number, and it is
the same failure this document exists to prevent at a larger scale.

**This map is a snapshot and nothing tests it.** The counts at the top
were read by command and can be re-read; the BUILT/PARTIAL judgements
are mine and will drift as the code moves. Re-derive them before
relying on them for a plan. The repo's own standing rule applies: a
citation is not a guarantee of presence, including this one.
