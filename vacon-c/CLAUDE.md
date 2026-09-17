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

**An eleventh, learned by measuring instead of counting.** A generator
that nothing calls is indistinguishable from a generator that does not
exist. `server/statistics.js` carried 67 statistics across every §9
category; a world built the only way one could be built answered **36**,
and **23 more were computable and came back null** — five housing
statistics because nothing ever called `generateProperty`, five
community statistics because nothing called `generateInfrastructure`,
five demographic statistics because nothing set religion, language or
education, and so on. Every mechanism was built, tested and green.
Nothing assembled a world, so every world this engine had ever run was
a crowd of people standing in an empty field.

`server/worldgen.js` closes it and adds no modelling at all: it calls
what was already there, and coverage goes to **57 of 67**. The general
form of the rule is that the suite cannot see this class of gap —
fixtures construct exactly the rows the code under test reads, which is
what makes them fixtures. **Measure a built world**
(`vacon-c/scripts/measure-world.mjs`), and write down the number.

Two corollaries found in the same pass, both of which had shipped:
`relationships.love` was initialised to 0 and written by nothing, so no
child could ever be born in a running world and eighteen passing tests
said otherwise because every one set the field directly; and a seeded
generator keyed on generated ids is not reproducible, because ids come
from a counter whose state depends on what was built before — **seed on
position, never on identity**.

**A twelfth, from wiring the seven trait families nothing read.**
`scripts/measure-world.mjs` counted 44 of 114 individual traits with a
reader anywhere in `server/`, and named seven whole families —
`criminal`, `environmental`, `technology`, `educational`, `reputation`,
`special`, `personality` — with zero between them. Generated on every
NPC, stored, migrated, restored, consulted by nothing. Giving each one a
reader produced three failures worth writing down, because all three
leave the code looking wired:

- **A modifier centred on zero recalibrates the world.** `1 - evasion *
  WEIGHT` reads like "skill reduces clearance" and actually means every
  ordinary criminal got 25% harder to catch the day the trait started
  being read — the same for deprivation deaths. A trait spreads a
  population out; it does not get to move the baseline it reads into.
  Centre on the average person, so an ordinary one's outcome is
  bit-identical to what it was before the trait existed, and hold that
  in a test.
- **A computed field above a spread of its own source is dead code that
  looks live.** `keys.js` computed a confidence from
  `personality.Confidence` and then wrote `...decision` over the top of
  it. All seven resolvers supply their own `confidence`, so the
  computed value was discarded on every call, for every Key, always.
  Nothing threw, the family had a reader, and the logged number was
  exactly the one it would have had if none of it existed.
- **A threshold picked from what a number sounds like is a guess.** 40
  out of 100 sounds like "below average" and excluded a quarter of a
  measured population. Measure the population a cutoff will be applied
  to before choosing it — and check what the cutoff actually gates:
  `generateMission` requires an artifact, so "artifact missions" is
  every mission, and a sensitivity floor on accepting one was a
  permanent lock on the engine's only player verb. `special` moved to
  `server/perception.js`, where it varies the confidence each person
  ends up holding a broadcast fact at — a field `knowledgeCharge`
  already reads, so it reaches real decisions and bars nobody from
  acting.

The general form: the suite cannot see any of these, because every
fixture in it builds a world with no `entity_traits` rows at all, so a
trait reader returns its neutral default and never executes. Five of
the seven readers passed the entire suite without once running on a
real trait. `test/trait-families.test.js` is the answer — build the
same world twice, differing in exactly one family, and assert both that
the outcome moves and that an ordinary person's does not.

**A thirteenth, from measuring a world's health.** Two halves, and the
second is why the first went unseen for the life of the project.

- **A mechanism with no inverse has no equilibrium.** Every
  environmental condition applied its supply/demand delta to a resource
  and nothing anywhere in `server/` ever raised a supply or lowered a
  demand — `grep '\.supply ='` returned exactly one writer, the
  condition applier itself. Every delta in the engine is negative, so
  `resources.supply` was a one-way ratchet: a two-city world at default
  settings took city 1's food from 107 to **zero** over 200 ticks with
  demand climbing 101 to 141, and water went the same way in the other
  city. **Every world this engine had ever run ended in total famine**,
  and the only variable was how long it took. `ticksRemaining` already
  promised the condition was temporary; the code never delivered it. The
  fix is a per-resource ledger of what each condition actually took —
  what was *taken*, not what was *asked for*, because the clamp at zero
  means a condition draining a nearly-empty resource takes less than its
  delta says and handing back the delta would create supply out of a
  famine.
- **A fixture cannot see a slope.** Every test in the suite was green
  throughout, because a fixture runs ten ticks and ten ticks of a
  ratchet looks exactly like ten ticks of a working mechanism. This is
  the eleventh rule's cousin: measure a built world, and measure it
  *long*. The guard that holds it now asserts on 200 ticks of a real
  world, not on a fixture.

**The same rule in a second place, found the next day.** Habit decay
was a flat 0.5 a tick against reinforcement that arrives per
occurrence. Flat decay against periodic reinforcement is the same step
function — `applyStress` in the same file already argues this for
stress, and the argument was never carried across. Measured on a
200-tick world: `rest`/`eat`/`work` (daily) at 75.3, and `gathering`
(weekly) at **0.3**. Seventeen people held a `gathering` schedule, it
fired every seventh tick for +2, and 3.5 of decay took it away in
between — so the weekly frequency was wired, firing, and inert, and
this file's own notes recorded having made it real. Downstream,
`traitDrift` weights a habit by `strength / 100`, so two social traits
had a drift path that moved them by 0.003 of their rate, and
`motivation.SATISFIERS.friendship` read a habit strength of 0.003.
Decay is proportional now; the constant is unchanged on purpose, so the
shape is the only variable. Daily ~80, weekly ~36, fortnightly ~22.

**And a resolver nothing calls is the eleventh rule's sibling.**
`server/contest.js` — five disciplines, live traits, a seeded
re-runnable result, its own green test file, named in this document as
a system the phase map never anticipated. `grep -n contest
server/tick.js` returned two matches, both the word "contested" about
territory blocks. No generated world had ever held a contest.
`server/competition.js` is the occasion. Note what the green test file
did NOT catch, because it could not: `verifyContest` re-ran the bout
against the LIVE world, so a result could only be verified in the
instant it was produced — a day later the tick had moved, the entrants
had drifted, and an honest settlement failed its own audit. A function
whose entire stated purpose is "anybody can verify a settlement without
trusting whoever reported it" verified nothing anybody would actually
want verified.

**A fourteenth, and it is the sharpest form of all of these.** A
threshold whose only writer sits behind that same threshold can never
be crossed. `runSecurityPhase` calls `keys.resolveAggression` for a
relationship whose `conflict` exceeds 30; `resolveAggression` is the
only code in the engine that raises `conflict`; `conflict` is
initialised to 0. So the resolver never ran, conflict never rose, and
**not one violent or domestic offence has ever occurred in any world
this engine has generated** — two of §9's four generatable crime
categories unreachable, with a resolver, a threshold, a category
vocabulary and a passing test suite all in place. Measured: 0 of 241
relationships above zero after 200 ticks.

This is `relationships.love` exactly, one field over: "initialised to 0
and written by nothing", so no child could ever be born, and eighteen
passing tests said otherwise because every one set the field directly.
The answer is the same shape both times — `births.advanceBonds` and now
`crime.advanceFriction`, a pass in the Social phase that moves the field
from real substrate. **Before adding a threshold, find the writer and
check what gates it.** If the answer is "the thing the threshold
guards", there is no mechanism, only a diagram of one.

And its first fix was wrong in the twelfth rule's third way, which is
worth recording because it looked fixed: `FRICTION_STRAIN_FLOOR` was set
to 50 because 50 sounds like the middle of a 0-100 scale. Measured
stress in a settled world runs 0 to 43.8 with a median of 0 — so the
strain term was dead on every person in the world, and averaging a dead
term in with two live ones capped conflict at 21.2 against a threshold
of 30. A mechanism that changed nothing, with a passing test that only
checked the field could move.

And the corollary about what to do when the substrate will not support
the statistic somebody asked for: **declare it, with the measurement
that killed it.** A body-composition index was derivable here and was
taken back out, because intake turned out to be a fact about a city and
exertion a fact about employment. `statistics.js`'s `body_composition`
entry names both, and names what would close it. A gap is visible; a
plausible wrong number is not.

## Active work
Phase 2. `dev-docs/` holds a folder per completed phase; `VACANCY_SEED.md`
is the live working document and `VACANCY_INVENTORY.md` is the file and
route inventory. Both are kept current — if either disagrees with the
code, the code is right and the document is a bug.
