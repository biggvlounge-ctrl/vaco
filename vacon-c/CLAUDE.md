# CLAUDE.md — VACON-C

**Naming note**: this project's correct, official name is **VACON-C**.
Earlier planning docs (including the `VACANCY_*.md` source files in
this directory, kept under their original filenames rather than
renamed) call it VACANCY — that name is now retired in favor of
VACON-C going forward. No functional rebuild — this is a naming
correction only. Not to be confused with **VACON** (without the
"-C"), a distinct system: the real operating network V4 and its named
agents run inside, with V4 as the interface layer to it. See
`../v4-proxy/README.md` and `../v4-proxy/V4Prototype.jsx` for what's real there
so far.

## What this project is
A civilization simulation engine (VACON-C). Extending an existing,
working prototype — do not rebuild from zero.

**The "foundation already running" list in this file was wrong in three
places and is corrected here** (checked directly, 29 Aug 2026 — the
same "citation is not presence" failure that keeps turning up):

| Claimed | Actually |
|---|---|
| NPC generation, 18-19 trait families | **True.** 128 trait definitions across families. |
| Faction system | **True**, and since upgraded to the full organization trait sheet. |
| Economy prototype | **True**, and since made real: supply/demand, scarcity, prices. |
| Event engine | **True** — events are outputs of tick phases, never rolled independently. |
| Competition/league system | **Half true, and the half matters.** *Contest resolution* is now real (`server/contest.js`, 29 Aug 2026): it rates entities from their live `combat`/`sports` traits and resolves a bout deterministically, seeded so a settled result can be re-verified. *League structure is still false* — no season, table, fixture list, standings or tournament exists anywhere in `server/`. The engine can now decide who wins a fight; nothing yet organises fights into a competition. (The `relationships.competition` rivalry dimension and the `competition` Culture trait remain unrelated to both.) VDP's Combat Sports district books and validates cards and can now call this resolver instead of being told the winner. |
| Artifact/Mission system | Was **false** when written; built since, and missions now have a real accept/complete/fail state machine. |
| Express API + React frontend | The API is real (79 routes). **There is no React frontend and never was** — `public/index.html` on the shared VACO kit is the frontend. See `VACANCY_SEED.md` §11. |

## Source of truth — read before writing code
- **Database shape**: `VACANCY_POSTGRESQL_SCHEMA.sql` — the literal
  schema. Don't invent table shapes; check here first.
- **API contract**: `VACANCY_API_ENDPOINT_MAP.md` — existing endpoints
  (`/api/state`, `/api/tick`, `/api/npc/generate`, `/api/mission`,
  `/api/health`) must keep their exact shape. New endpoints follow the
  phased list there.
- **Everything else** (trait families, tick pipeline order, scope,
  status of all 500 systems, what NOT to build): `VACANCY_MASTER_
  SESSION_INDEX.md` — the map to the rest of the package. Open the
  specific referenced doc, don't guess from memory.

Point to these files, don't paste their contents in here — they're
long and will go stale duplicated.

## Locked Day 1 / Phase 1 scope — exactly these 10, nothing more
NPC/Individual traits, Organization full trait sheet, Family
(minimal), 5-8 Key resolvers, real resource tracking, real supply/
demand economy, the 11-phase tick pipeline, Territory/Community,
Artifact/Mission (already built), Citizen-mode binding.

**Explicitly deferred — do not touch**: Leader/Simulation/Multiplayer
modes, Transportation, subscription tiers, ecosystem link-outs,
anything gambling-adjacent.

**Property was on that list and is not any more.** Phase 2 was opened
on 29 Aug 2026 and the Property Engine is built (`server/property.js`).
Nothing else moved off the deferred list — in particular, gambling and
casino systems (#291-305) stay closed pending compliance review, which
is a legal gate rather than a scope decision, and the API map's own
"What NOT to build" says the same.

## Phase 2 — complete except what is deferred
Property Engine, Community/City depth, Culture DNA, and Named Flow
Templates are all built. Movement/trade routes is the one Phase 2 line
not built, and it stays deferred under "Transportation" above rather
than being an open gap. See `VACANCY_SEED.md` §9.

## Beyond the phases — two systems the map never anticipated
Both were found the same way: by grepping for a table the schema
defines and finding no code that touches it.

- **Contest resolution** (`server/contest.js`) — rates entities from
  their live `combat`/`sports` traits and resolves a bout
  deterministically from a seeded draw. Those two trait families were
  generated on every NPC and read by nothing.
- **The Behavior Engine** (`server/behavior.js`) — routine, mood and
  habits. The architecture document's §4.5 named exactly three tables
  as genuinely new rather than restatements of systems already built:
  `schedule_events`, `entity_state`, `habits`. All three were in the
  schema from the start with **zero lines of code**.

Neither is a twelfth tick phase. The pipeline is locked at eleven and
both run in the same cross-cutting slot as `flows.js`.

**A tick is a day** — `TICK_INTERVALS` in `behavior.js`. Nothing in the
package says how many ticks a day is, so that file chooses and says so;
`worldState.tickIntervals` overrides it wholesale.

**A sixth standing rule, learned from flows.js**: a signal that reads a
field which does not exist returns nothing forever and no test built on
hand-made fixtures will notice. Three flow signals read `.scarcity` and
`.power` — both computed, neither stored — so three of the ten named
flows could never fire on a real world. Build fixtures with the real
generators, or seed a world and look at it.

**A seventh, learned from behavior.js**: an event that fires on a
CONDITION rather than on a CROSSING fires every tick for as long as the
condition holds. A habit sitting at 100 would put an identical row in
the event log every tick forever, burying the tick it actually happened
on. And a crossing has to be noticed where the value moves, not
re-derived inside the tick pass — otherwise anything a Key resolver or
an API call changes between ticks is silent, which is the half worth
noticing. Both mistakes were made here before being fixed.

**An eighth, learned the hard way in the same pass**: a test whose
SUBJECT is randomly generated is not testing what it says it is. A
behavior test built its citizen with a bare `generateNPC()` and asserted
they reached crisis — but `loadMultiplier` bottoms out at 0.25 for a
resilient, non-volatile person, so a stress of 100 could land at 25 and
never cross. It passed on every direct run and failed once in the
ecosystem sweep. Fix the traits in the fixture; keep randomness only
where the assertion is statistical and its bounds are stated.

**A corollary on `Number()`**: `Number(null)` is `0`, and `0` is
finite. A bare `Number.isFinite(Number(x))` guard therefore reports an
unobserved value as a real zero — which shipped in `moodFor()` and
made a person nobody had observed read as "content". Unknown is not a
zero, and the check for it has to test for null explicitly.

## Phase 3 — the player verb is built
`POST /api/players/:id/action` (`server/actions.js`) is the map's
"generic action dispatcher, routes to the right Key/decision". It was
skipped for a while on the grounds that no document said what actions
exist and guessing would invent game design. That was right at the time
and stopped being right once the engine grew concrete verbs: accept a
mission, resolve one, adopt a routine, practise a habit, enter a
contest. The dispatcher invents nothing — it routes to what exists.

**A player acts as themselves.** The actor is always
`player.linked_entity_id`, taken from the player record. A body naming
an `entityId` is refused rather than ignored, because the mission state
machine's "only the holder can resolve" check would otherwise be handed
its own bypass.

Leader-dashboard and simulation-controls remain unbuilt because Leader
and Simulation modes are deferred above — not because they were missed.

## Definition of done for Phase 1
A drought-style cascade running through at least 4 of the 10 locked
systems, with a Citizen-mode player able to observe and be affected
by it. Not done until this specific test passes.

## Order of operations
1. Split `traits.js`/`keys.js` out of `engine.js`
2. Migrate to `trait_definitions` + `entity_traits`
3. Add the 19th trait family (Skills)
4. Implement 5-8 Key resolvers
5. Upgrade `factions` to the full trait sheet
6. Build the minimal Family Engine
7. Real resource tracking, real economy
8. Rebuild `advanceTick()` into the 11-phase pipeline
9. Stand up Postgres, migrate off in-memory `WorldState`, keep
   `/api/*` identical — **done, 10 Sep 2026, and deliberately not in
   the literal sense of that wording.** `/api/*` is unchanged.

   Postgres is the durable record; memory stays the working set.
   `server/persistence.js` loads the world before `app.listen` and
   checkpoints every 10 ticks; `server/restore.js` is the inverse of
   `server/migrate.js`. What was NOT done is converting engine.js /
   economy.js / keys.js / tick.js to async Postgres reads, and that is
   a design decision rather than a deferral. Three reasons, in
   restore.js's header at length: a tick sweeps the whole world, so
   per-row round-trips would be thousands of queries to compute what
   the process already holds; it buys no durability, since what lost
   the simulation was that nothing read the database back; and
   interleaved async reads through the tick pipeline is precisely how
   a deterministic engine stops being one.

   **Five real defects came out of building the read half**, every one
   of them invisible until a world went through a real database and
   back:

   - four `missions` columns and `market_listings.resource_type`
     silently unwritten — a mission migrated as `completed` with no
     holder, no acceptance tick and no outcome;
   - two FK ordering violations (`resources`/`market_listings` before
     `cities`) that rolled the whole migration back for any world with
     a city that had a resource in it;
   - `properties` and `cultures` drawing ids from `nextEntityId` with
     no `entities` row ever written for them;
   - a second circular FK, `properties.history_ref` ↔
     `historical_records.where_location_id`;
   - two flow signals reading the **denormalised** trait sheet, which
     is built once at generation and never refreshed — so
     `population.meanVolatility` and `organization.meanPower` reported
     birth values forever.

   The migration had never been executed by anything. `migrate.test.js`
   said so in its own header — its checks were structural "because
   Postgres is not reachable from this environment" — and that was an
   honest and correct thing to write. It stopped being true, and the
   difference showed up immediately.

## Standing rules (apply to every change, not just Day 1)
1. Every Key resolver writes back to Memory, Relationships, and World
   state — that's the definition of "done" for a Key, not optional.
2. Key resolvers read subjective `entity_knowledge`, never raw world
   state directly.
3. Never duplicate computable rollups (Reemergence, Property Value,
   Community Health, Family Wealth are all computed, never stored).
4. Organization is a parent table; Faction/Business are subtypes, not
   separate root entities.
5. Ecosystem apps (Vavlt Stvdios, Vvltvre, DREAMS, VENVS, V4, VASH)
   are linked to, never rebuilt.

**A ninth, learned building the restore.** The sixth rule above says a
signal reading a field that does not exist returns nothing forever.
Its sibling is worse: **a signal reading a field that is frozen returns
the same plausible number forever.** `npc.traits` / `org.traits` are a
sheet built once in `generateNPC()`/`generateOrganization()` and never
refreshed; the live values are the `entity_traits` rows every tick
phase and Key modifier writes to. `behavior.js` and `contest.js` knew
this and went through `getLiveEntity()`. `flows.js` did not — and its
own header already recorded the *first* version of the same bug, where
those signals read `organization.power`, got `undefined`, and returned
null. The fix at the time pointed them at `o.traits.organization.power`,
which is a real number, so the signal started firing and looked fixed.
It had moved from "always null" to "always the birth value", which is
harder to see, because a null is visible and a plausible frozen number
is not. Read traits through `getLiveEntity()`, always.

**A tenth, from the same pass.** Postgres returns BIGINT and NUMERIC as
strings. A missed conversion in a restore does not throw — it produces
a world that looks restored and is wrong. `trait_id` came back as the
string `"1"`, matched no trait definition, and every entity was
restored with an empty trait sheet and no error anywhere.

## Active work
Phase 2. `dev-docs/` holds a folder per completed phase; `VACANCY_SEED.md`
is the live working document and `VACANCY_INVENTORY.md` is the file and
route inventory. Both are kept current — if either disagrees with the
code, the code is right and the document is a bug.
