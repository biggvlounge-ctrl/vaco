# VACANCY — Seed File

**The working file for the game.** Everything about pricing VACANCY and
finishing VACANCY collects here. Opened 28 Aug 2026.

## How this file works

**VACANCY is its own thing.** It does not get folded into the ecosystem
docs, and the ecosystem docs do not get rewritten around it. Where
something genuinely needs to reflect back into an app already built —
V3 for money, Shield for identity, VDP for the district, DREAMS or
Vvltvre for a link-out — that reflection gets added deliberately and
noted here. Everything else stays in VACANCY.

**The goal is two numbers**: what it costs to finish, and what "finished"
means. Neither can be stated honestly yet, and §4 says exactly what is
missing before they can be.

**Every figure in this file is sourced.** Repo figures name the file
they were read from. Figures from incoming documents name the document.
Anything estimated is marked as an estimate. No number appears here
because it sounded right.

---

## 1. What VACANCY is, per its own documents

A civilization/life simulation game. NPCs with trait sheets across four
tiers (individual, family, organization, entity), decisions resolved
through seven named **Keys**, a real economy, territory and community
control, families that persist across generations, and player modes —
Citizen, Leader, Simulation.

The world is global by design: Cesium / Google Photorealistic 3D Tiles
give backdrop coverage across 2,500+ cities and 49 countries, with
St. Louis's four districts as the launch playable tier.

The architecture separates two layers on purpose, and this is the
single most important cost fact in the project:

> **Simulation and visual environment are separate systems.** Population
> and economy can grow everywhere from day one; the expensive
> human-artist build-out only happens where the simulation shows real
> demand.
> — `vdp/VDP_DESIGNER_AND_VACANCY_GLOBAL_COST.md`

That is what keeps a global game from being a global art bill.

## 2. Verified build baseline — as of commit `b6b7a08`

Read out of the code, not from a status document. Full detail in
`VACANCY_INVENTORY.md`.

| Layer | State |
|---|---|
| Simulation engine | **Substantially built** — 127 KB across 15 modules |
| All 7 Key resolvers | Built (`server/keys.js`, 16 KB) |
| Traits, 4 tiers | Built |
| Family / economy / territory / tick / players | Built |
| Artifacts and missions | Built |
| **HTTP API** | **6 of 58 contract endpoints** (+2 beyond contract) |
| PostgreSQL schema | Written (34.7 KB) and loads; **engine still runs in-memory** |
| Frontend | VDP district, 283 lines, covers the live 5-endpoint contract |
| Tests | None specific to vacon-c in `run-all-tests` |

**The shape of the remaining work is unusual and favourable**: most of
the 52 unbuilt endpoints already have their logic written and simply
have no route in front of them. That is routing work, not simulation
work, and it is the cheapest kind of remaining work there is.

## 3. Cost material already on file

Four documents in this repository already price parts of this. Their
figures, gathered in one place for the first time:

### Global playable coverage — `vdp/VDP_DESIGNER_AND_VACANCY_GLOBAL_COST.md`

| Scale | Environment-art cost |
|---|---|
| Backdrop-only, full global coverage | near-zero (Google Maps API fees only) |
| Per additional city to full playable quality | **$3,000 – $5,000** |
| Top 10 world cities, full playable | $30,000 – $50,000 |
| Top 50 world cities, full playable | $150,000 – $250,000 |
| All 2,500+ Cesium cities, full playable | $7.5M – $12.5M |

Its own recommendation: full-globe playable is **not a near-term goal.**
Backdrop everywhere, playable cities added gradually, funded by proven
revenue and prioritised by real player demand.

That document also makes a hiring call: VDP's expansion is continuous
rather than a finite launch scope, which is a genuine case for an
**in-house World/Level Designer** instead of indefinite freelance.

### Engine sharing — `vdp/VDP_VACANCY_SHARED_ENGINE_COST_REDUCTION.md`

VDP and VACANCY sharing one engine — one schema, one API, one Key
resolver set — is identified as the single largest cost reduction
available, potentially cutting combined engineering cost significantly.
**Not yet acted on.**

### Asset pipeline — `vacon-c/AI_3D_ASSET_GENERATION_COST_REDUCTION.md`, `CHARACTER_MODEL_ANIMATION_PIPELINE.md`

Techniques for cutting 3D asset and character/animation cost. Both are
method documents rather than quotes — they reduce a rate, they do not
state one.

### Already commissioned as briefs

Real 3D art and sound design briefs were written for freelancers
(tasks #75, #76). Those are ready to send out and are a live input to
any quote.

### Built, and load-bearing for the money

`vdp/src/lib/worldExpansion.js` (17 tests) decides where the
$3,000–$5,000 per city goes. Three properties of it matter to pricing:
`realGrowthSignal` is derived and cannot be assigned; "no signal" and
"no growth" are different verdicts; and **the trigger reports, it never
spends** — a person makes the call.

## 4. What pricing still needs

Cannot be answered from this repository. These are the blockers on a
real number:

1. ~~`VACANCY_500_SYSTEM_MASTER_INDEX.md`~~ — Document 6 arrived
   28 Aug 2026 and was cross-referenced; its status column was stale
   against the code in seven places. **A denominator now exists**, but
   it lives in a pasted document rather than in this repository, so any
   "X% of 500 systems" figure is quoted from it, not derived here.
2. ~~`VACANCY_PROTOTYPE_DEVELOPMENT_ROADMAP.md`~~ — Document 5 arrived
   and was verified item by item (§12).
3. ~~`VACANCY_REACT_FRONTEND_STRUCTURE.md`~~ — Document 4 arrived; its
   premise does not hold (§11). The five tabs it names are now built on
   the shared kit rather than in the React app it assumes.
4. **Scope decision: what ships first.** A playable St. Louis is a very
   different quote from a global backdrop with 50 playable cities.
5. **Team shape.** In-house designer, contractors, or both — the
   difference between a one-off cost and a monthly burn.
6. **Whether VDP and VACANCY share one engine.** The largest single
   lever on the engineering line, and it is a decision, not an estimate.

## 5. Reflections into apps already built

Nothing added yet. Anything that lands here is a deliberate change to a
finished app, made once and recorded:

| Target | Reason | Status |
|---|---|---|
| VDP | Vacancy district already exists (283 lines) | Live |
| V3 | Any in-game money must settle through the ledger, not a parallel one | Not needed yet |
| Shield | Player identity | Not needed yet |
| Vvltvre / DREAMS / VENVS / Vavlt Stvdios | Phase 4 link-outs — **link generation only**, VACANCY never implements their logic | Not built |

The contract is explicit that there is to be **no standalone
`/api/banking/*`** and **no gambling or casino endpoints** ahead of the
compliance review. Both stand.

## 6. Intake log

| Received | Document | Taken from it |
|---|---|---|
| 28 Aug 2026 | `VACANCY_500_SYSTEM_MASTER_INDEX.md` (Doc 6) | Category audit across all 500 systems; dedup list; two resolved architecture decisions. **Its status column is stale in 7 places — see §7.** |
| 28 Aug 2026 | `VACANCY_REACT_FRONTEND_STRUCTURE.md` (Doc 4) | Per-phase component plan; the mode-split for Phase 3; build boundaries. **Its premise does not hold — see §11.** |
| 28 Aug 2026 | `VACANCY_PROTOTYPE_DEVELOPMENT_ROADMAP.md` (Doc 5) | The Phase 1 checklist, verified item by item in §12. Carries the 9→11 phase pipeline correction. |

**All seven handoff documents are now accounted for.**

### Recovered 10 Sep 2026 — six Core Gameplay Systems documents

Supplied by the founder as pasted text after
`VACANCY_DOCUMENT_MANIFEST.md` showed which documents the index names
but the repository does not hold. Written to `vacon-c/` verbatim; only
an `# ` title line was added to each, matching the convention every
other document here follows.

| Recovered | Document | What it settles |
|---|---|---|
| 10 Sep 2026 | `PLAYER_DEATH_GENERATIONAL_CONTINUITY.md` | Death is neither permadeath nor respawn: the player continues as an heir, sibling or grown child. Composes four systems already built — Inheritance priority, Legacy Score, Family Bloodline, and Memory/grief. |
| 10 Sep 2026 | `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` | Recruiting a specialist whose occupation matches a nearby location's Control Key requirement *is* the mission trigger. The engine behind "the game opens up as the Tribe grows". |
| 10 Sep 2026 | `THE_KEY_BUILDING_TYPES.md` | The definitive hero-tier category list (23 categories), confirmed as the global standard rather than St. Louis-specific. |
| 10 Sep 2026 | `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` | A Control Key's population requirement is role-based (enforcers/youth/elder), and existing `unity`/`cooperation`/`conflictLevel` traits multiply the success probability. |
| 10 Sep 2026 | `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` | Per-type discovery pools for hero locations, and information spreading person-to-person only during the Chaos Era, widening as the tech tree climbs. |
| 10 Sep 2026 | `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` | Ten retail location types, each with its own discovery pool, and the Control Key → merchandise access flow for the capturing group. |

**None of this is built.** `server/` has no player-death succession,
no mission unlock triggered by recruitment, no Control Key composition
check, no discovery pools and no retail location types. Read them as
the design they are.

#### Their "already built" claims, checked against `server/`

Each of these six argues its mechanic is the right one *because* it
composes systems that already exist. That is a good argument and it is
why they read as buildable — but the claim is checkable, so it was
checked, the same way §7, §11 and §12 checked Documents 6, 4 and 5.
**Roughly half of what they cite as built is not there.**

Real, cited correctly:

| Cited as built | Where it actually is |
|---|---|
| Memory system, traumatic memories resisting decay | `server/worldStore.js` — `memories`, exactly as described |
| Relationships with trust/loyalty | `worldStore.js`, `traits.js`, `contest.js` |
| Habits, Crime, NPC Needs | `behavior.js`, `flows.js`, `territory.js`, `tick.js` |
| Reemergence phases | `engine.js`, `keys.js`, `flows.js`, `tick.js` |

Cited as built and **absent**:

| Cited as built | What is actually there |
|---|---|
| Inheritance resolution priority (Will → Family → Organization → Government → Auction → Abandoned → Disputed) | Nothing. `'inherited'` is one value in `property.js`'s acquisition-method enum — how a property was obtained, not who resolves a claim |
| Legacy Score | Nothing. The word appears twice: a comment about the *legacy* nested trait format, and `historical_legacy` as a property value modifier |
| Family Bloodline / generational succession | Nothing |
| Occupation Taxonomy | Nothing — no occupation or profession field exists on an NPC at all |
| Control Key system, and its specialist/population requirements | Nothing |
| Family/Tribe `unity`, `conflictLevel` | Nothing. `cooperation` and `conflictResolution` are real but are **culture** dimensions (`culture.js`), not family or tribe traits |
| Information Spread Key | Nothing |
| Rural Resource system | Nothing |
| Bullet scarcity | Nothing |
| Healthcare system | Nothing |

This does not make the documents wrong — they are design, and design
is allowed to describe a target. It makes their phrasing wrong, and
that matters here for one reason: a reader who takes "already built"
at face value will scope the work as wiring rather than building.
`TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` in particular describes itself
as tying together "three systems already built" — two of the three
(Control Key, Occupation Taxonomy) do not exist, so it is a
specification for three systems, not an integration of them.

Six of the twelve documents in the index's "Core Gameplay Systems"
group are still missing; `VACANCY_DOCUMENT_MANIFEST.md` lists them.

### Standing directives on the wider package (28 Aug 2026)

Given ahead of the remaining documents, and recorded here so they hold
whenever those documents do arrive:

1. **`VACANCY_FINAL_ARCHITECTURAL_QUESTIONS_RESOLVED.md` supersedes
   `VACANCY_RECONCILIATION_ADDENDUM.md` §5.** Where the Addendum lists
   the AI-content and digital-ownership questions as "unresolved
   forks," that is stale. Both are closed. This agrees with Document 6,
   which already marked categories 421–440 and 441–450 RESOLVED.
2. **`VACANCY_MASTER_SESSION_INDEX.md` maps to further named files**
   beyond the handoff package — paused world-building content, in scope
   once the architecture is confirmed solid and content population
   begins. Not needed for the architecture pass.

**Both closed decisions were checked against the code, and both hold:**

| Decision | Verified |
|---|---|
| Ownership stays in-simulation-only, permanently | No tokenization, NFT, on-chain or minting code anywhere in `server/`. `ownership_records` exists in the schema (line 658) as the in-simulation record it is meant to be. |
| Core decision-making stays deterministic; AI-assisted layers link out via V4 | No model SDK and **no outbound HTTP at all** in `server/` — no `fetch`, no axios, no `@anthropic-ai`, no `openai`. `keys.test.js` additionally asserts that the same entity and the same setback resolve identically every time. |

So these are not decisions still waiting to be honoured. The code
already reflects them, which is the useful thing to know before the
documents that close them arrive.

### What Document 6 settles

- **The real system count is ~494, not 500.** Six duplicate pairs:
  Research (#152/#214), Investigation (#212/#342), Tournament
  (#267/#283), Sports Betting (#273/#295), Creator Ranking
  (#320/#379), Achievement (~#29/#412). Dedup before implementation.
- **Two architecture decisions are closed.** Core decision-making
  stays deterministic (Key/Archetype/Goals/Needs), with AI-assisted
  layers linking out through V4. VACANCY's ownership stays
  **in-simulation-only permanently** — real tokenization, if ever
  pursued, is VENVS's scope via link-out.
- **Gambling/casino (#291–305) is compliance-flagged** and stays
  closed. This matches the API contract's own "What NOT to build".
- **Streaming/creator (#306–320) belongs to Vavlt Stvdios** — link
  out, never rebuild.
- Phase 1's locked scope draws on only 6 of ~30 categories, which
  confirms the scope is genuinely narrow rather than narrow-sounding.

## 7. Document 6 is stale against the code — 7 corrections

Document 6 was written with the handoff package, **before Day-1 steps
1–9, territory/community, and citizen-mode binding were built.** Its
design content stands; its *status* column does not. Checked function
by function:

| Doc 6 says | Code says | Evidence |
|---|---|---|
| 31–50 Relationships — **GAP**, "no relationship graph exists between NPCs at all" | **Built** | `worldStore.js` — `findRelationship`, `getOrCreateRelationship`, `adjustRelationship`, plus Memory and Knowledge stores |
| 51–65 Family — **GAP** | **Built** | `generateFamily`, `addFamilyMember`, `getFamilyWealth`; `dev-docs/phase-6-family-engine/` |
| 66–80 Community — **GAP** | **Built** | `territory.js` — `generateCommunity`; `dev-docs/territory-community/` |
| 81–100 Organization — needs `ORGANIZATION_TRAIT_FAMILIES` upgrade | **Done** | `organizationTraits.js`, "locked Day 1 step 5" |
| 101–120 Economy — Supply/Demand/Pricing are gaps | **Built** | `resolveMarketPrice`: `imbalance = (demand − supply) / supply`, price moves on it |
| 136–150 Resources — flat scarcity only | **Per-type built** | `generateResource` requires `resourceType`; food, water, energy, oil, gold, minerals |
| 401–420 Player Modes — "none are implemented in code yet" | **Citizen mode built** | `generatePlayer`, `getCitizenDashboard`; `dev-docs/citizen-mode-player-binding/`. Leader / Simulation / Multiplayer remain unbuilt, as stated. |

Everything else in Doc 6 holds, including every deferral and both
compliance positions.

## 8. The actual state of Phase 1

The architecture document (§11) locks Phase 1 at **10 systems** with a
specific definition of done. Checked individually:

| # | Locked system | State |
|---|---|---|
| 1 | NPC/Individual traits | **Built** |
| 2 | Organization full trait sheet | **Built** |
| 3 | Family (minimal) | **Built** |
| 4 | Key resolvers ×5–8 | **Built — 7 of them** |
| 5 | Resource tracking, real per-type | **Built** |
| 6 | Economy, supply/demand-driven | **Built** |
| 7 | Cascade tick pipeline | **Built** |
| 8 | Territory/Community, block-tier | **Built** |
| 9 | Artifact/Mission | **Built** |
| 10 | Citizen-mode player binding | **Built** |

**All ten are built.** `tick.js`'s `addEnvironmentalCondition` was
written explicitly as the drought trigger the definition of done calls
for, and says so in its own header.

### But the definition of done has never been demonstrated

> "A drought-style cascade runs correctly through at least 4 of the 10
> systems in sequence, with a Citizen-mode player able to observe and
> be affected by it."
> — Architecture Document §11

There is **no `test/` directory, no test script, and `vacon-c` does not
appear in the ecosystem's 33 test suites.** Every other significant app
in this repository is tested; the flagship game is the one that is not.

So Phase 1 is built and unproven. Those are different things, and the
distance between them is the first real piece of work.

## 9. What is actually left

Items 1-3 below are **done** and struck through; they are kept rather
than deleted so the record shows what the position was and what closed
it.

1. ~~**Prove the definition of done.**~~ Done —
   `test/drought-cascade.test.js` drives a drought through resources →
   economy → territory → citizen dashboard and asserts each leg.
2. ~~**Test the engine.**~~ Done — 185 tests across 8 files. Every
   suite was mutation-tested before being trusted: a deliberate bug is
   introduced, the suite must fail, and the bug is reverted. Two
   mutations survived the first attempt and the tests were strengthened
   until they did not.
3. ~~**Expose the API.**~~ Done for Phases 1 and 2 — 64 routes
   registered, 43 of them named in the map, **all of Phase 2 except the
   deferred trade-routes line**, plus 3 of Phase 3's 7
   (`VACANCY_INVENTORY.md` §3).

Still open, in priority order:

4. **Postgres conversion** — every engine function is synchronous and
   array-based; Postgres is async. The single largest engineering item,
   and known.

   **Its migration script was carrying half the world (fixed 29 Aug
   2026).** `server/migrate.js` was written at step 9 and never updated
   as Territory/Community, Artifact/Mission, Citizen-mode binding,
   Property and Culture landed. It carried 13 of WorldState's 26
   arrays, reported a clean summary, and silently dropped every
   property, deed, city, ward, territory block, artifact, mission and
   player. Eight arrays were stale; three systems (cultures,
   culture_memberships, flow_templates) had no table in the schema at
   all. All closed, and `test/migrate.test.js` now checks coverage
   structurally — including that every column the migration names
   exists in the table it names, which is the check that works in an
   environment with no database.
5. ~~**Phase 2's two remaining engines.**~~ Culture DNA is built
   (`server/culture.js`) and so is the flow system
   (`server/flows.js`). Both turned out to be fully specified rather
   than open design questions — the trait attachment names all sixteen
   Culture families, the architecture document names all ten flows, so
   neither required inventing world content. Movement/trade routes
   remains, and is deferred by CLAUDE.md rather than merely unbuilt.
6. ~~**`GET /api/players/:id/citizen-dashboard`.**~~ Done — built with
   `POST /api/players` and `GET /api/players/:id`, three of Phase 3's
   seven routes, ahead of their phase because this one is named in the
   Phase 1 Definition of Done. Verified against a live seeded world: a
   citizen sees their family and its wealth, their net worth, the
   property they hold with its derived value, and the memories the
   drought wrote. The other four Phase 3 routes stay unbuilt — two serve
   deferred modes, and the action dispatcher has no specified actions.
7. **Migration has nowhere to move anyone.** Property, Territory and
   Community all exist now, so there are destinations; nothing scores
   one against an NPC's situation and nothing writes
   `properties.occupants`. The Migration phase still stops at a risk
   signal, and says so in its own comment.

### The three environment-art figures — corrected reading (29 Aug 2026)

An earlier pass in this file treated $2.58M-$6.48M, $1.75M-$4.76M and
$420K-$960K as **three competing methodologies** and recommended
adopting the smallest. That framing was wrong, and the correction
matters because it changes what the money buys.

They are **coverage tiers of one methodology**, not rival estimates.
`world-layer/UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` §7 sets out the
hierarchy the figures are priced against:

| Tier | What it covers | How it is made |
|---|---|---|
| 1 — hero | ~1,200 UNESCO-grade global icons | real, paid human work |
| 2 — regional | major cities | AI-assisted refinement |
| 3 — filler | everything else — houses, stores, roads | fully automated |

So: **$420K-$960K is Tier 1**, the ~1,200 locations players recognise
emotionally. The multi-million figures are the full world across all
three tiers. `world-layer/OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md`
then revises the full-world number down to **$2.3M-$5.8M** and gives a
North America figure of **$240K-$315K** — a regional slice, which is
the tier the earlier reading had no place for at all.

The architecture document's own conclusion is the line that settles it:
*"the largest remaining real human expense is not world creation itself
— it's selective artistic refinement of the roughly 1,200 UNESCO
locations players actually recognize emotionally"*, against a target of
**90%+ automated world construction, 10% human refinement**.

**Global coverage is therefore not the expensive part.** The automated
data stack — Cesium World Terrain, Cesium OSM Buildings, Overture Maps
(3.7-4.2 billion features, free, CDLA-Permissive), UNESCO, NRHP — is
what carries Tiers 2 and 3. The recommendation stands but for a
different reason than stated: fund Tier 1 first because it is the only
tier a person has to make, not because the other tiers are unaffordable.

### `world-layer/` is built, and nothing consumes it

Found while checking the above. `world-layer/` is a real app — six
modules, a Postgres schema, a UNESCO import pipeline — implementing
every system the architecture document consolidates.

Three things were true of it before this pass:

1. **No app requires it.** Its README said it is "read by VACON-C,
   VENVS, and HVNTZ". A repo-wide search finds no `require` from any
   app; every hit is a code comment citing it as a *pattern*. The
   README has been corrected.
2. **No tests, at all** — the only app in the ecosystem without them,
   and the layer the entire 90%-automation cost argument rests on.
   Now 28 tests, mutation-tested, in the shared runner.
3. **Not in the deploy manifest.**

The integration with VACON-C is a real decision, not an oversight:
`world-layer/dev-docs/phase-8-vacon-c-reconciliation/plan.md`
deliberately chose "linked, not replaced", because the two systems do
not share an identity scheme and a speculative sync has real failure
modes. **That decision is worth revisiting now** — it was made when
VACON-C had no Property, Culture or City depth, and it now has all
three, which removes part of the premise. It stays a decision for the
owner rather than something to half-build.

### Phase 2 status (29 Aug 2026)

| System | State |
|---|---|
| Property Engine | **Built** — generation, derived value, append-only ownership, lifecycle in the tick, routes, seed, frontend |
| Community depth | **Built** — Community Health computed on read, community detail route |
| City depth | **Built** — city detail, Reemergence computed on read with a four-part breakdown that labels which sub-indices are city-scoped and which are not |
| Relationships API | **Built** — over `worldStore.js`, which had held the logic since the Key resolvers |
| Business reads | **Built** — a filtered read over organizations, per standing rule 4 |
| Culture DNA | **Built** — sixteen named families stored three ways (8 scored, 3 styles, 5 lists), tier-level attachment that refuses individuals |
| Named Flow Templates | **Built** — one resolver, ten rows, seventeen signals. A flow added as data fires with no code change, and a test asserts exactly that |
| Movement / trade routes | Not started — deferred by CLAUDE.md (Transportation), not merely unbuilt |
| Gambling-adjacent systems (#291-305) | **Closed pending compliance review** — a legal gate, not a scope decision. Phase 2 opening does not open these. |

## 10. Status

**The pause is lifted (confirmed 28 Aug 2026). VACANCY is active work.**

---

## 11. Document 4 — its premise does not hold

Document 4 opens: *"Existing structure (already built — extend, don't
replace): `src/main.jsx`, `src/App.jsx`… 5-tab bottom-nav — WORLD,
FACTIONS, NPCS, MISSIONS, ECON. Shared components: MoraleBar, Tag."*

**None of that is in this repository.** `vacon-c/` has no `src/`. A
repo-wide search for `FactionsTab`, `MoraleBar` and the FACTIONS tab
returns nothing. What exists is `vacon-c/public/index.html` — **151
lines of plain HTML** on the shared VACO design system, showing tick,
NPC cards and world state. Not React, no tab navigation, no
`MoraleBar`.

So that React app is either on another machine or was never carried
over. **This materially changes Phase 2 and Phase 3 costing**: the
document prices those phases as *adding components to a working React
app*. If the app cannot be produced, they are "build the app, then add
the components," which is a different quote.

**Action: find `src/App.jsx` and the tab components, or accept that
the frontend starts from 151 lines of HTML.** This is now the highest-
value retrieval, the same slot Document 6 held before it arrived.

Everything else in Document 4 stands and is useful: the Phase 3
mode-split (Citizen / Leader / Simulation), the boundaries (no native
media player, no storefront, **no local or session storage for game
state** — API and Postgres only), and the observation that a real
design pass is needed before Citizen mode because immersive
third-person is a different visual language from a data terminal.
That design pass is a real, unpriced cost line.

## 12. Document 5 — Phase 1 checklist, verified item by item

| # | Roadmap item | State |
|---|---|---|
| 1 | Split `traits.js`/`keys.js` out of `engine.js` | **Done** — Day 1 step 1 |
| 2 | Migrate to `trait_definitions` + `entity_traits` | **Done** — step 2 |
| 3 | Add the 19th trait family (Skills) | **Done** — and see below |
| 4 | 5–8 Key resolvers reading `entity_knowledge` | **Done — 7**, and they read subjective knowledge, not raw world state |
| 5 | Upgrade factions to `ORGANIZATION_TRAIT_FAMILIES` | **Done** — step 5 |
| 6 | Minimal Family Engine (`families` + `family_memberships`) | **Done** — step 6 |
| 7 | Real per-resource tracking | **Done** |
| 8 | Real supply/demand economy | **Done** |
| 9 | Rebuild `advanceTick()` into the 11-phase pipeline | **Done — all 11** |
| 10 | Stand up Postgres, migrate off in-memory, keep `/api/*` identical | **PARTIAL** — Postgres stands up and the schema loads; the engine still runs on in-memory arrays |

**Nine of ten complete. Item 10 is the only unfinished one**, and it
is the largest: every engine function is synchronous and array-based,
Postgres is async.

### The pipeline correction was already made

Document 5 corrects the Master Architecture Document's 9-phase pipeline
to 11, adding Decision and History. **The code already implements all
eleven** — `runEnvironmentPhase` … `runDecisionPhase` … `runHistoryPhase`
… `runReemergencePhase`, in the corrected order, with `tick.js`'s own
header naming it. Doc 5's recommendation to fix the *Architecture
Document* still stands; §6 of that document still says nine.

### Both standing rules are honoured in code

`keys.js` reads pre-filtered `entity_knowledge` via `context.knowledge`
rather than raw ground truth, and its `writeBack()` writes all three
targets — Memory, Relationship, and world state via `applyKeyModifier`
— on every resolution.

### Trait counts have moved past the documents

Document 5 says 92 traits / 18 families in Phase 0, "superseded by the
confirmed 98 traits / 19 families." **The code has 114 traits across 20
families**, Skills included. The documents are behind the code again,
which is now a pattern rather than an incident: every status figure in
the handoff package should be re-read against `server/` before it is
used for planning.
