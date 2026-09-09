# VACANCY — File Inventory and Completion Audit

**VACANCY and VACON-C are the same project — the game.** The folder was
renamed `vacancy/` → `vacon-c/` on 15 Aug 2026 (commit `02f16de`) via
`git mv`, so the full VACANCY commit history is intact and reachable
with `git log --follow`. The handoff documents deliberately kept their
original `VACANCY_*` filenames. Read every "VACON-C" below as VACANCY.

This document exists to be **cross-referenced against the master
records**, so it states what is on disk, what is reachable, and what is
missing — separately, because those are three different questions.

---

## The one-line answer

**Phases 1 and 2 are built, proven and reachable.**

There is a working simulation — traits across four tiers, seven Key
resolvers, family, economy, territory, tick, players, artifacts and
missions, plus Property, Culture DNA, Named Flow Templates, contest
resolution and the Behavior Engine — and its HTTP surface is real:
**76 routes**, up from 8 before any of this.

This paragraph named Property and Culture as "genuinely not built" for
some time after both shipped. Re-checked directly on 29 Aug 2026, which
is the only way any line in this file should be trusted.

What actually remains: Phase 3's player experience beyond the citizen
dashboard, Phase 4's ecosystem link-outs, Phase 5 multiplayer, and the
Leader/Simulation modes — all deferred by CLAUDE.md rather than
half-finished. The one genuinely large piece of engineering left is the
sync-to-async conversion behind moving off in-memory `WorldState` onto
the Postgres schema that already exists.

---

## 1. Server code — `vacon-c/server/`

All present on disk, all committed. 231 KB total.

| File | Size | What it holds | State |
|---|---|---|---|
| `engine.js` | 23,482 | The simulation core. Re-exports 33 functions across every subsystem. | Built |
| `tick.js` | 19,682 | Tick pipeline, environmental conditions. | Built |
| `keys.js` | 16,492 | **All 7 Key resolvers** — Resilience, Adaptability, Trust, Scarcity Response, Fear, Aggression, Territory. | Built |
| `migrate.js` | 14,314 | WorldState → PostgreSQL migration. | Built, see §4 |
| `economy.js` | 8,340 | Resources, scarcity, market listings, price resolution, individual finances, net worth. | Built |
| `territory.js` | 7,598 | Cities, communities, territory blocks, control resolution, city reemergence and community health (both computed on read). | Built |
| `culture.js` | 11,476 | **Culture DNA (Phase 2)** — sixteen named families stored three ways, tier-level attachment. | Built |
| `flows.js` | 15,151 | **Named Flow Templates (Phase 2)** — one resolver, ten rows, seventeen signals. | Built |
| `property.js` | 14,184 | **Property Engine (Phase 2)** — generation, derived value, append-only ownership, lifecycle. | Built |
| `behavior.js` | 19,085 | **The Behavior Engine** — routine, mood and habits: the three tables architecture §4.5 named as genuinely new (`schedule_events`, `entity_state`, `habits`), all of which sat in the schema with zero code. | Built |
| `actions.js` | 9,674 | **The player action dispatcher** — a registry over verbs that already exist. The actor is always the player's own linked entity, never a request field. | Built |
| `contest.js` | 12,409 | **Contest resolution** — rates entities from their live `combat`/`sports` traits and resolves a bout deterministically from a seeded draw, so a settled result can be re-verified. The first code anywhere to read either trait family. | Built |
| `players.js` | 7,698 | Player generation, citizen dashboard — now including mood, habits and routine. | Built |
| `entityTraits.js` | 5,781 | Per-entity trait rows, trait sheets, Key modifiers, live entity resolution. | Built |
| `traits.js` | 5,346 | Trait families, random trait values, sheet generation. | Built |
| `traitDefinitions.js` | 4,562 | Individual / organization / family definitions, id and definition lookup. | Built |
| `worldStore.js` | 4,530 | Memory, relationships, knowledge — the write-back layer the contract requires. | Built |
| `missions.js` | 8,757 | Artifacts and missions, with a real available -> accepted -> completed/failed/abandoned state machine. | Built |
| `organizationTraits.js` | 2,395 | Organization trait families. | Built |
| `familyTraits.js` | 2,082 | Family trait families. | Built |
| `db.js` | 2,017 | Postgres connection and `query()` helper. | Built, see §4 |

## 2. Handoff documents — `vacon-c/`

The seven-document package the build was specified from. **All seven
are now accounted for** — Documents 4, 5 and 6 arrived on 28 Aug 2026.
The four below marked "received" were read and cross-referenced but are
not stored in this repo; their findings live in `VACANCY_SEED.md` §7,
§11 and §12.

| Document | Status |
|---|---|
| 1 — `VACANCY_CLAUDE_CODE_BUILD_PROMPT.md` (7.5 KB) | Present |
| 2 — `VACANCY_POSTGRESQL_SCHEMA.sql` (34.7 KB) | Present |
| 3 — `VACANCY_API_ENDPOINT_MAP.md` (8.1 KB) | Present |
| 4 — `VACANCY_REACT_FRONTEND_STRUCTURE.md` | Received 28 Aug — **its premise does not hold**, see SEED §11 |
| 5 — `VACANCY_PROTOTYPE_DEVELOPMENT_ROADMAP.md` | Received 28 Aug — checklist verified, SEED §12 |
| 6 — `VACANCY_500_SYSTEM_MASTER_INDEX.md` | Received 28 Aug — **status column stale in 7 places**, SEED §7 |
| 7 — `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` (8.6 KB) | Present |
| — `VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md` (29.3 KB) | Present |
| — `VACANCY_MASTER_SESSION_INDEX.md` (14.9 KB) | Present |

Document 6 gave the denominator: **~494 unique systems, not 500** (six
duplicate pairs named). The percentages in this file remain against the
API contract only — a system-level completion figure needs the category
audit re-run against the code, since Doc 6's own status column was
seven entries out of date when it arrived.

**Still outstanding:** the React app Document 4 says already exists.
See §5.

## 3. The API — 45 map lines built of 58, across 79 registered routes

### The five-endpoint contract, unchanged

```
GET  /api/state    POST /api/tick    POST /api/npc/generate
POST /api/mission  GET  /api/health
```

CLAUDE.md fixes their shape and nothing in the Phase 1 pass touched
them; `test/routes.test.js` asserts it.

### By phase

| Phase | Specified | Built | Remaining |
|---|---|---|---|
| Existing contract | 5 | 5 | 0 |
| Phase 1 — DNA Prototype | 22 | **22** | **0** |
| Phase 2 — World Expansion | 13 | **13** | **0** |
| Phase 3 — Player Experience | 7 | **5** | 2 |
| Phase 4 — Digital Planet link-outs | 5 | 0 | 5 |
| Phase 5 — Multiplayer | 3 | 0 | 3 |
| Cross-cutting | 3 | 0 | 3 |
| **Total** | **58** | **45** | **13** |

**79 routes are registered in `server.js`** (counted, not remembered:
`grep -cE "^app\.(get|post|put|patch|delete)\(" server.js`). Of those,
**28 have no line anywhere in the map** — every path below was checked
against the map text with `:param` names normalised, so a rename cannot
hide one:

`GET /api/artifacts/:id`, `GET` and `POST /api/conditions`,
`POST /api/resources`, `GET` and `POST /api/territory-blocks`,
`POST /api/entities/:id/finances`, `GET /api/entities/:id/net-worth`,
`GET /api/entities/:id/holdings`, `GET /api/missions/:id`,
`POST /api/missions/:id/accept`, `POST /api/missions/:id/resolve`,
`GET /api/entities/:id/rating`, `POST /api/contests/resolve`,
`POST /api/contests/verify`, `GET`/`POST /api/cultures`,
`GET /api/cultures/:id`, `POST /api/cultures/:id/members`,
`GET`/`POST /api/flows`, `GET`/`POST /api/entities/:id/habits`,
`GET`/`POST /api/entities/:id/schedule`, `POST /api/entities/:id/stress`,
`GET /api/entities/:id/behavior`, `GET /api/players/:id/actions`.

The last of those is this file's own thesis in miniature. The map
specifies `POST /api/players/:id/action` — the dispatcher — and no way
to ask what may be dispatched. Without the menu route every client
hard-codes the action list, and then the list lives in two places.

They exist for one of two reasons, and the first is the pattern this
whole file exists to record: **the map specifies what to read and what
to advance, and consistently omits what CREATES the thing being read.**
Each of those was found the same way — by trying to demonstrate a
system and discovering it could not be populated over HTTP. The second
reason covers the twelve most recent: missions gained a real accept /
resolve state machine, contests gained a resolver, and the Behavior
Engine gained six — none of which the map anticipated at all, because
none of those systems existed when it was written.

The 45/58 figures in the table above count MAP LINES that are built,
which is a different question from how many routes are registered, and
the two numbers do not reconcile by subtraction — several map lines are
served by more than one route. Do not derive one from the other.

**Phase 2 is complete.** The last two — `GET /api/culture/:tierEntityId`
and the flow system behind it — turned out to be fully specified rather
than open design questions: the trait attachment names all sixteen
Culture DNA families and the architecture document names all ten flows.
Neither needed world content invented.

`GET /api/trade-routes` is the one Phase 2 line NOT built, and it is
counted here as out of scope rather than as a gap: Movement/trade
routes is named in the architecture document as a separate system
(Part 15M, alongside `migration_events`) and CLAUDE.md defers
Transportation explicitly. Building a route over an engine that is
deferred would be the "citation is not presence" failure in reverse.

**Three Phase 3 routes were built ahead of their phase, for one
reason.** `GET /api/players/:id/citizen-dashboard` is the "observe and
be affected by" half of the Phase 1 Definition of Done; it had no route,
so the one part of locked Phase 1 scope that could not be shown to
anybody was the part the definition of done names. `POST /api/players`
and `GET /api/players/:id` come with it because a dashboard needs a
player to exist. The remaining four are deliberately not built: two
serve Leader and Simulation modes, which CLAUDE.md defers explicitly,
and `POST /api/players/:id/action` is a "generic action dispatcher"
with no specified action list — building it would invent game design
rather than expose it.

### Phase 1's routes, and the logic each one exposes

All built and tested (`test/routes.test.js`). Recorded because the
mapping is what made the work small — each route is a call to a
function that already existed:

- **All 7 Key resolvers** (`keys.js`) → `POST /api/keys/:keyId/resolve`, `POST /api/npcs/:id/decide`
- `generateFamily`, `addFamilyMember`, `getFamilyWealth` → the four `/api/families` endpoints
- `generateOrganization`, `generateFaction` → the three `/api/organizations` and two `/api/factions` endpoints
- `generateCity`, `generateCommunity`, `generateTerritoryBlock`, `resolveTerritoryControl` → `/api/cities/*`, `/api/communities`, `/api/factions/:id/territory`
- `generateMarketListing`, `resolveMarketPrice`, `getScarcity`, `advanceResourceTick` → `/api/economy/*`, `/api/market/listings`
- `generateIndividualFinances`, `getNetWorth` → economy snapshots
- `listMissions` → `GET /api/missions`
- `getEntityTraits`, `applyKeyModifier`, `getLiveEntity` → the three `/api/entities/*` endpoints

**Two lines in this list were wrong and are corrected here.** An
earlier revision credited `getCitizenDashboard` to
`GET /api/players/:id/citizen-dashboard` and `worldStore.js` to
`/api/relationships/*`, under a heading saying all of them were built.
Neither route existed at the time. **Both have since been built**, and
this paragraph was itself stale until 29 Aug 2026 — it went on denying
the citizen dashboard after the route was added, which is the same
citation-is-not-presence failure in the opposite direction. Checked
directly this time, not remembered:

- `/api/relationships/*` — built (Phase 2, not Phase 1).
- `GET /api/players/:id/citizen-dashboard` — built, at `server.js:636`,
  and exercised over real HTTP by `test/routes.test.js:675` (200 with a
  dashboard, 404 for an unknown player).

That closes the "observe and be affected by" half of the Phase 1
Definition of Done at the HTTP layer: a citizen can now complete a
mission (`POST /api/missions/:id/resolve`), have the reward credited,
and read the change back out of the dashboard as net worth.

### Phase 2's routes

- `generateProperty`, `currentValue`, `recordOwnership`, `getCurrentOwner`, `getOwnershipHistory`, `getHoldings` (`property.js`) → `/api/properties/*`, `GET /api/entities/:id/holdings`
- `getCityDetail`, `getCityReemergence`, `getCommunityDetail`, `getCommunityHealth` (`territory.js`) → `GET /api/cities/:id`, `GET /api/cities/:id/reemergence`, `GET /api/communities/:id`
- `getOrCreateRelationship` (`worldStore.js`) → `GET /api/relationships/:entityId`, `POST /api/relationships`
- filtered reads over existing arrays → `GET /api/businesses` (standing rule 4: a subtype, not a second table), `GET /api/market/listings`

### Phase 3's player verb

- `dispatchAction`, `listActions` (`actions.js`) →
  `POST /api/players/:id/action` (on the map), `GET /api/players/:id/actions`
  (not on it — see above).
- `availableMissions` (`engine.js`) → `GET /api/missions/available/:entityId`
  (on the map).

**Two Phase 3 lines are still unbuilt and are not oversights.**
`leader-dashboard` and `simulation-controls` serve Leader and Simulation
modes, which CLAUDE.md defers explicitly. A dashboard for a mode nobody
can enter is a decoration, not a route.

### The Behavior Engine's routes

- `describeBehavior`, `listHabits`, `listScheduleEvents`, `applyStress`,
  `reinforceHabit`, `addScheduleEvent` (`behavior.js`) →
  `GET /api/entities/:id/behavior`, `GET`/`POST /api/entities/:id/habits`,
  `GET`/`POST /api/entities/:id/schedule`, `POST /api/entities/:id/stress`.
  None is on the map. `runBehavior` is deliberately **not** exposed:
  behavior advances with the tick and only with the tick, and a route
  that aged somebody's habits without time passing would let a caller
  run a person's life forward while the world stood still.

### Contest resolution's routes

- `rateEntity`, `resolveContest`, `verifyContest` (`contest.js`) → `GET /api/entities/:id/rating`, `POST /api/contests/resolve`, `POST /api/contests/verify`. None is on the map. They exist because the `combat` and `sports` trait families were generated on every NPC and read by nothing, and because VDP's `recordResult(match, winnerIds)` had to be TOLD who won.

## 4. Database — schema real, engine not on it yet

`VACANCY_POSTGRESQL_SCHEMA.sql` is a complete 34.7 KB schema. `db.js`
connects to a real Postgres instance and `migrate.js` moves WorldState
into it, and both were verified (`dev-docs/phase-9-postgres/tasks.md`).

**But the engine still runs on the in-memory `WorldState` object.**
`db.js` says so in its own header rather than implying otherwise: every
function in `engine.js`, `economy.js`, `keys.js` and `tick.js` is
synchronous and array-based, and Postgres access is necessarily async,
so converting them is a large rewrite that was flagged as not done
rather than silently skipped.

So the database exists and the app does not use it yet. That is a
known, recorded position, not a surprise.

## 5. Frontend

| File | Lines | What it is |
|---|---|---|
| `vdp/src/components/VacancyView.jsx` | 150 | The district inside VDP |
| `vdp/src/lib/vacancySchema.js` | 80 | Shared schema |
| `vdp/src/lib/vacancyClient.js` | 53 | Thin API client, covers the live 5-endpoint contract |
| `vacon-c/public/` | — | The app's own served frontend |

**Document 4 arrived, and describes a React app this repo does not
have**: `src/main.jsx`, `src/App.jsx`, a five-tab bottom nav, and
`MoraleBar`. There is no `src/` in `vacon-c` and a repo-wide search for
those components finds nothing. `vacon-c/public/index.html` now carries
the five tabs Document 4 names — WORLD, FACTIONS, NPCS, MISSIONS, ECON
— plus `moraleBar` and `tag`, on the shared design system rather than
in React. Property folded into FACTIONS rather than becoming a sixth
tab, for the same reason artifacts folded into MISSIONS: the document
fixes the count at five.

That app is either on another machine or was never carried over, and
it is now the highest-value outstanding retrieval: Document 4 prices
Phases 2 and 3 as *adding components to a working app*.

## 6. Phase records — `vacon-c/dev-docs/`

Ten phase folders, each with a plan and tasks: trait split, trait
definitions migration, Key resolvers, organization trait sheet, family
engine, economy, tick pipeline, postgres, territory/community,
citizen-mode player binding.

## 7. Standing decisions on this project

- **The pause is lifted** (28 Aug 2026). VACANCY is active work.
  Routes that advance world state stay behind `requireOperator`
  regardless — that guard is about blast radius, not about the pause.
- `POST /api/tick` is behind `requireOperator('vacon-c:tick')` — a tick
  advances the world for everyone, so it is not a plain session route.
- Gambling and casino endpoints are **not** to be implemented ahead of
  the compliance review, per the contract's own "What NOT to build".
- Phase 4 stays link-generation only. VACANCY supplies content; the
  linked apps supply the functionality.

## 8. Superseded copies

Three archives from before the rename (`vacancy-complete.zip`,
`vacancy-for-v4-4.zip`, `vacancy-missing.zip`) hold the pre-rename
tree. Diffed file by file: **14 of 15 server modules are byte-identical
to the repo**, `engine.js` is older there, and `missions.js` does not
exist in them at all. They contain nothing this repository is missing
and are not a recovery source.
