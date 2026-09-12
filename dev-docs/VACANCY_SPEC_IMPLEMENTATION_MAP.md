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

**On the two names.** The spec is titled VACANCY; the app is
**VACON-C**, and `vacon-c/CLAUDE.md` states that VACANCY "is now
retired in favor of VACON-C going forward", with the `VACANCY_*.md`
files kept under their original filenames rather than renamed. This map
uses VACANCY when quoting the spec's sections and VACON-C when
describing the code, which is the same convention the repo already
follows. Neither is a different system. (VACON without the `-C` **is** a
different system — the V4 operating network.)

**Three further deferrals `CLAUDE.md` sets, which this map respects
rather than re-proposing:** Leader mode, Simulation mode and
Multiplayer are all explicitly deferred, so §84's Phase 11 and §87's
leader/simulation dashboards are closed scope rather than missing work.
Gambling and casino systems stay closed pending compliance review — a
legal gate, not a scope call.

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

**Measured, and my own first estimate here was too generous.** This
section used to read "roughly 25 of the 40 are represented" — a guess
from memory with nothing in the repo to check it against. The forty are
now data in `vacon-c/server/urbanSystems.js`, every citation verified
by `vacon-c/test/urban-systems.test.js`, and the real breakdown is:

**11 modelled, 18 partial, 5 slot-only, 6 absent**

| Level | Means | Systems |
|---|---|---|
| **modelled** (11) | Real mechanics; something advances or decides on it each tick | Population, Housing, Economy, **Employment**, Infrastructure, **Political**, Cultural, Community Organizations, Real Estate, Environmental, AI Decision |
| **partial** (18) | A trait family or a live table with little driving it, or one phase covering two systems | Education, Health, Food Supply, Water, Law Enforcement, Crime, Gang, Organized Crime, **Court**, Communication, **Religion**, Business, Construction, Weather, Disaster, Technology, Migration, Reputation |
| **slot** (5) | Storage exists and nothing reads it | Transportation, Energy, Waste, Fire & Emergency, Supply Chain |
| **absent** (6) | No representation at all | Prison, Government Services, Media, Social Media, Military/National Guard, Tourism |

**Beliefs closed a loop Political left open, and corrected a guess I
had written into the code.** `public_opinion`'s comment asks for a
rollup from "**beliefs**/entity_knowledge"; `beliefs` was dead, so
approval came from live traits, and `politics.js` recorded the cost —
**approval did not depend on what a law said.** That note went on to
say a `valence` column on `entity_knowledge` would be the fix.

It was wrong. **`beliefs.strength` is already a valenced position on a
named subject** — the field existed and the table was simply unbuilt.
No schema extension was needed. Approval now reads:

| | Stance |
|---|---|
| holds a political belief about the topic | that strength, undamped — the belief *is* the view |
| knows of it, holds no belief | the trait-derived stance, damped by confidence |
| neither | not counted, so the spread floor still means something |

What is still not invented: **whether a law is good.** `enactLaw` takes
an optional caller-declared `favourability` and shifts no belief
without one. Deciding that a `criminal` law pleases one NPC and
offends another is game design no source document specifies.

Religion rises to `partial` on the same table — `religious` is one of
the six belief types, so a religious conviction is now a real thing an
entity holds at a strength that moves. No institutions, no practice,
no clergy, and nothing religious drives a decision yet.

**`values_db` is deliberately still dead**, and that is a decision
rather than an omission: no column defaults, and no source document
gives value distributions, priorities or influence weights, so a
generator would be fifteen invented numbers per person. CRUD nothing
calls would be worse than the dead table — it would look alive and
hold nothing. A test asserts the restraint, so whoever builds it has
to delete that test rather than find a stale claim in a comment.

**Political was the largest dead spot in the schema and is now built**
— 12 Sep 2026, `vacon-c/server/politics.js`, running inside the
Organization phase because a government is an organization subtype
(standing rule 4, and the schema's own primary key). Six tables that
no engine module touched: governments, elections, votes, laws,
public_opinion, revolutions.

**Two of those tables carry schema comments that are design
instructions, and both are honoured rather than worked around:**

- `public_opinion` — *"Rollup from beliefs/entity_knowledge on a
  topic, not new source data."* Approval is computed from
  `entity_knowledge`: **knowledge decides who has an opinion, live
  traits decide what it is.** Somebody who has never heard of a
  government is not counted. Snapshots are written per tick, which is
  history rather than a second source of truth — the same relationship
  `individual_finances` has to a balance, and the reason this is not a
  standing-rule-3 violation.
- `revolutions` — *"Ties Public Opinion + Information Spread +
  Government into a real regime-change mechanic, not just a lower
  stability number."* A revolution needs low approval **and** enough of
  the population actually informed. Without that second floor, one
  disapproving citizen out of a hundred reads as 0% approval and the
  government falls on a sample of one — unrest that is a measurement
  artefact.

**`knowledgeCharge()` in `keys.js` looks like the right tool for
approval and is not**, which is worth recording because it is an easy
mistake to make twice. It scores epistemic status — `verified` and
`known` count fully positive — so using it for approval means a
*verified* famine reads as +1, and a population approves of a
government precisely because it has confirmed how badly things are
going. Not a bug there; a different question.

The honest cost, stated in the module too: **approval does not depend
on what a law says.** A harsh law and a generous one move it
identically, because both are only a reason to have heard of the
government. Encoding favourability would mean judging whether a
`criminal` law is good for a given NPC — inventing game design no
source document specifies, which is the line `actions.js` already
declined to cross.

Court rises to `partial` on the same work: laws are enacted, repealed
and queried, but **nothing applies a law to anybody** —
`runSecurityPhase` does not read `laws`, so this is legislation
without adjudication.

**Employment is the first `slot` taken off the list** — 12 Sep 2026,
and it is the worked example of what "deepen what exists" means here.
Payroll runs inside the Economy phase (the pipeline stays at eleven)
and **moves money rather than making it**: a wage leaves the employer
organization's `assets`, arrives in the employee's
`individual_finances`, and is recorded in the employer's `expenses`.
An employer that cannot cover it does not pay and emits
`payroll_missed` into the tick's events. `getEmploymentRate` is
computed, never stored — `communities.employment` stays the separate
seeded field it was, because two sources of truth for one concept is
what standing rule 3 exists to prevent.

That conservation is the part worth insisting on. Crediting the
employee and leaving the employer alone is half a line shorter and
passes most of the tests — and since `getNetWorth` and
`getFamilyWealth` both read `individual_finances`, the invented money
would have surfaced as real household wealth across the whole world.
Four tests fail against that version, verified by writing it.

**This breakdown has been revised down twice, and the second revision
is the instructive one.** It began as an estimate of "roughly 25 of the
40 represented". Writing the systems out as data with a test made it
12 modelled. Then checking whether the engine actually *touches* the
tables being cited made it **9**.

**`slot` means storage exists and nothing reads it, in two shapes.**

The first is `infrastructure.type`, a TEXT column whose comment
enumerates roads, bridges, rail, water_systems, electricity, internet,
hospitals, schools, public_safety and waste_management. A row can hold
any of those and nothing in the engine reads the distinction — no enum,
no CHECK constraint. Counting those ten as built is what takes a
truthful figure to a comfortable one.

The second was worse, because it was my own error rather than an
inherited ambiguity. **18 of the tables cited here as evidence are not
touched by any engine code** — with `migrate.js`/`restore.js` excluded
(they handle every table by definition) and comments stripped (so
`economy.js`'s "employment_records, investments, and trade_routes are
NOT built here" does not count as using them). Three levels were wrong
as a result:

| System | Was | Is | Why |
|---|---|---|---|
| **Political** | modelled | **slot** | Six tables — governments, elections, votes, laws, public_opinion, revolutions — and no engine module touches one of them. Nothing governs, elects, votes, legislates or revolts. |
| **Technology** | modelled | **partial** | `technology_eras` and `civilization_technology_progress` are equally untouched, which also makes the §40 claim below wrong. |
| **Employment** | partial | **slot**, then built | `economy.js` said in its own header that `employment_records` was not built. It is now — see above. |

`environment_state` is the instructive counter-example: it is
schema-only, and Environmental is still **modelled**, because
`runEnvironmentPhase` is real and mutates resource supply every tick —
it works on `worldState.activeConditions` rather than that table. The
mechanics were never in doubt; the citation was simply wrong.

The data now splits `tables` (the engine touches it) from `schemaOnly`
(the schema defines it, nothing does), and the test asserts **both**
directions — a `tables` entry no code touches fails, and a `schemaOnly`
entry that code does touch fails too, so neither label can rot as the
engine grows.

Two things the test enforces that are worth knowing. A system marked
`absent` must cite **nothing**, so the label cannot be quietly applied
to something that does exist — Prison is absent because `imprison`
appears nowhere in the schema or the engine, despite §17 listing
`imprisoned` as an NPC status. And a `slot` may not cite a phase or a
function: the moment one gains mechanics the test fails rather than
letting the level go stale.

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
| 29 Supply chain | **PARTIAL, and partly deferred** | `trade_routes` is a table. No route mechanics, hubs, lanes or transport tiers — and trade routes fall under the same Transportation deferral as §44. |

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
| 37 Civilization reemergence engine | **PARTIAL** | `runReemergencePhase` and `getCityReemergence` are real and compute a recovery index per city. The two technology tables are schema-only, so era progression itself is not driven. |
| 38 Regional states | **PARTIAL** | A reemergence index is computed; the four named bands are not applied as labels. |
| 39 Reemergence systems | **PARTIAL** | The ladder is by technology era, not by the five named system groups. **The spec's own restraint on weapons infrastructure is respected** — nothing models construction instructions. |
| 40 Bottleneck logic | **PARTIAL — and this row said BUILT, wrongly** | The claim was that `technology_eras.requirements` is the dependency chain. It is, in the schema, and **no engine code reads either the table or the column** — so nothing gates a technology on its prerequisites. What IS real is the cascade half: `test/drought-cascade.test.js` drives a drought through resources into the economy and out into social and migration effects. Cascades yes, technology prerequisites no. |
| 41 Historical memory | **BUILT** | `historical_records`, `runHistoryPhase`, `memories`, `decision_log`. |
| 42 Probability system | **BUILT** | `winProbability`, `seededUnit`, `hashSeed` in `contest.js`; probability throughout the tick. |
| 43 Event engine | **BUILT** | With cascades. |
| 44 Movement system | **DEFERRED, not merely unbuilt** | No routes, patrols, commutes or deliveries — and `vacon-c/CLAUDE.md` puts **Transportation** on its explicit "do not touch" list, alongside Leader/Simulation/Multiplayer modes. Its Phase 2 note says movement/trade routes "stays deferred under Transportation rather than being an open gap". So this is a scope decision the project already took, not an oversight. |
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
| 63 Political / government system | **BUILT, except the progression** | All six tables are live: `foundGovernment`, `enactLaw`/`repealLaw`, `scheduleElection`/`castVote`/`closeElection` (a tie elects nobody rather than the first candidate found), `computeApproval`, `assessRevolutions`, `resolveRevolution`. **§63's six-stage progression from informal rules upward is still not implemented** — a world either has a government or does not. A law with no government attached is the closest thing to stage one and is supported. |
| 64 Health system | **PARTIAL** | A `health` trait family (4). No disease, no medical knowledge loss and recovery, no clinics as a system. |
| 65 Education system | **PARTIAL** | `educational` traits (4). No schools, teachers, literacy or libraries as entities. |
| 66 Technology recovery | **PARTIAL** | `technology_eras` defines ten eras with a `requirements` column and nothing reads it. `runReemergencePhase` computes a recovery index, which is the part that works. |

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
| 2 | **Grow the trait catalogue toward 2,100 — with consumers, never ahead of them** | The architecture is done and the content is 5% there. See the warning below: this is the step most likely to produce 2,000 fields nothing reads. Generated entries must be labelled generated; they are not recovered source. |
| 3 | **Knowledge tiers 1–10 (§25)** | Clean greenfield, no conflict with the existing spread model, and §40's bottleneck logic already has somewhere to plug in. |
| 4 | **Map interface (§73)** | Largest remaining build, and the thing that makes the rest visible. |
| 5 | **Barter item catalogue (§27)** | The mechanism exists; this is content plus one table. |
| 6 | **Simulation detail levels (§69)** | The gate on §97's scale. Nothing else unblocks millions of NPCs. |
| 7 | **City DNA (§49), mentors (§58), sports leagues (§54)** | Self-contained additions. |
| 8 | **Stress tests (§83)** | Deferred deliberately until after §69 — stress-testing one fidelity level measures the wrong thing. |

**Movement (§44) was item 4 in the first version of this list and has
been removed.** §94's own definition of "playable" includes "the player
can move", so it looked like the highest-value unblock. But
`vacon-c/CLAUDE.md` defers Transportation explicitly, and recommending
work a project has closed is worse than leaving a gap open — it invites
someone to spend a week on something that will be rejected on scope.
**The tension is real and belongs to the owner**: §94 cannot be
satisfied while Transportation is deferred. That is a decision to take,
not a task to schedule.

**Not on this list, and deliberately:** multiplayer (§84 Phase 11) and
anti-cheat (§77). Both are real requirements and both are premature
while §§69 and 73 are open, and Multiplayer is deferred outright by
`vacon-c/CLAUDE.md`.

### A warning on step 2, from this project's own history

**Do not generate 2,000 trait definitions and stop.** VACON-C has
already found this defect twice, in two different disguises, and both
are recorded in `vacon-c/CLAUDE.md`:

- `combat` and `sports` traits were generated on every NPC and **read
  by nothing**, until `server/contest.js` was written specifically to
  consume them. Two whole trait families were dead weight on every
  entity in the world.
- Three of the ten named flow signals read `.scarcity` and `.power` —
  fields that are computed, never stored — so those flows **could
  never fire**, and no test built on hand-made fixtures noticed. That
  became a standing rule in its own right.

A trait nothing reads is indistinguishable from a trait that does not
exist, except that it costs a row per entity and makes the catalogue
number look healthy. Going from 128 to 2,100 in one pass would create
roughly 1,972 of them, and the count would then be the least
informative figure in this document.

**So grow the catalogue alongside the systems that consume it.** The 18
`partial` urban systems are the natural pairing: Education (§25 tiers,
4 traits today), Health (§64 disease, 4 traits), Employment (§4 wage
dynamics) and Reputation (§15 radius and decay) each need both traits
and the mechanics to read them. That order also means the trait count
rising is evidence of something rather than a target being hit.

And a third of the same lesson, worth repeating because it is the
hardest to see: **read traits through `getLiveEntity()`.** The
denormalised `npc.traits` sheet is built once at generation and never
refreshed. A signal reading it does not fail — it returns the birth
value forever, which is a plausible number, and a plausible frozen
number is far harder to spot than a null.

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
