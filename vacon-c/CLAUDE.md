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

**A third, found by being asked whether it was already documented.**
`VACANCY_TRAIT_DATABASE_ATTACHMENT.md` defines FIVE tier-level trait
sheets — FAMILY, ORGANIZATION, CITY, CIVILIZATION and CULTURE. The
engine built four. `CITY_TRAIT_FAMILIES` and
`CIVILIZATION_TRAIT_FAMILIES` name thirty-three dimensions between
them and `grep -rn "CITY_TRAIT\|CIVILIZATION_TRAIT\|tourism"
server/*.js` returned nothing at all, which is where §7's last three
`absent` urban systems had been sitting the whole time: Government
Services, Military / National Guard and Tourism are `healthcare`/
`education`/`security`, `military`, and `tourism` in a document this
project has had since day one. §49 CITY DNA names "tourism city" and
"military city" among nine identities in the same breath.

`server/tierTraits.js` and `server/statecraft.js` are the answer, and
the shape of the lesson is worth more than the systems: **before
building a system that a spec document lists by name, find the
document that already specifies it.** The eleventh rule is "a generator
nothing calls is indistinguishable from one that does not exist"; this
is its paper twin — a specification nobody opens is indistinguishable
from one that was never written, and the cost is not a gap but a
reinvention that disagrees with it.

**A fourth, and it is the paper twin's twin: a channel nobody modelled
makes a variable a constant.** `politics.broadcastGovernmentKnowledge`
wrote one `entity_knowledge` row per NPC, unconditionally — so every
announcement reached every person in the world the instant it was made,
and `computeApproval`'s `spread`, the share of a population who have
heard of their own government, was a constant **1.0** (measured, 153 of
153). `assessRevolutions` needs approval below 35 AND spread at or
above 0.25, so one of its two conditions could never fail and §63's
"Public Opinion + Information Spread + Government" mechanic was a
public-opinion mechanic with a decorative second term.

§7's only two `absent` systems were 23 Media and 24 Social Media, and
they were the reason. `server/media.js` is §61's own channel list —
word of mouth, bulletins, local news, radio, networks — each gated on
the `technology.ERA_NAMES` entry that makes it possible, because §61
says "in the reset era, communication should begin locally and reemerge
technologically over time" and the ten eras were already there. An
outlet is an `organizations.type = media` row, a type the schema
already enumerated. A government announces from the building it
operates (`properties.operating_organization_id`) and the news travels:
awareness 0.2 at founding, still 0.2 fifty ticks later, 1.0 once radio
came back. `entity_knowledge.spread_rate` and `.distortion_level` — two
columns `addKnowledge` had always accepted and no caller had ever
passed — are what carry a fact from one person to the next.

**Nothing in §7 is `absent` any more.** And two mistakes were made
here first, both of them rules already in this file: the outlet was
founded behind an era gate that generation could never pass (rule 14,
one commit after adding a rule about it), and the first routing
announced in every community of every city, which reproduced
spread 1.0 under a new name.

`tierTraits.js` also carries the reconciliation of all thirty-three
names against the column, rollup or system that already answers
twenty-eight of them. That list is the deliverable, not a comment:
"we checked, and this one is answered elsewhere" is exactly the
knowledge that evaporates, and losing it is how a schema grows two
disagreeing answers to the same question.

**A fifth, and it took four files because two of the three things it
was built on turned out not to exist.** The takeover key —
`COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md`'s `ControlKeyComposition`
and `TakeoverAttemptResolution` — is `server/control.js`, and it needed
`server/occupations.js` and a writer for `families.unity` first. See
the nineteenth standing rule; the short version is that
`employment_records.position` was a column no caller had ever written
and `families.unity`/`.conflict` were 50 and 0 on every family in every
world, so "a Hospital needs medical experts" had nothing to ask and the
cohesion multiplier had two constants in it.

The shape worth keeping: **the composition is the document's own
5:10:1 used as a RATIO against however many people hold the target
now**, so its worked example falls out of the model instead of being
copied into it, and no per-scale constants had to be guessed. A flat
with one occupant takes one person; a city measures 105.

`server/knowledge.js` (§24 KNOWLEDGE RECOVERY),
`server/meetings.js` (the spec's `negotiate`/`teach`/`recruit`/`form
alliance`, which had no home anywhere) and `server/orgArchetypes.js`
came out of the same pass. Two of them are worth a line each:

- **Knowledge closes a wire that was complete except for the book.**
  `technology.learningOf` has always averaged the `educational` family
  to lower the reemergence bar for a literate people — and nothing in
  the engine had ever moved an educational trait, so that term was the
  population's birth draw for the life of every world. §24's first line
  is "Knowledge is a civilization resource" and its third is "Knowledge
  can unlock..."; both were wired and inert.
- **Meetings add no modifier at all, on purpose.** The obvious build is
  a planning bonus on a takeover's probability. It is not needed: a
  meeting moves trust, `familyTraits.unityTarget` IS the mean trust
  between a family's members, `advanceCohesion` converges unity on it,
  and `cohesionOf` is the multiplier. Four systems each built for its
  own reason, and the only new number is how much one afternoon moves
  one relationship — set equal to `control.SHARED_UNDERTAKING`, because
  giving two events of the same size different numbers would be
  asserting something nobody knows.

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

**Eleven verbs now, not five.** `break-down`, `strip-building` and
`make-thing` joined on 18 Sep 2026 under the same rule as the three
below. They are the one part of the engine a player is meant to touch
constantly rather than at a turning point, and `make-thing` carries a
`check` flag for the same reason `assess-takeover` is a separate verb
from `attempt-takeover`: a player has to be able to look before they
spend what they are carrying.

`call-meeting`, `assess-takeover` and
`attempt-takeover` were added on 18 Sep 2026, and the same rule held:
each routes to a system that already exists, and none of them was added
until the system was.

**A player acts as themselves.** The actor is always
`player.linked_entity_id`, taken from the player record. A body naming
an `entityId` is refused rather than ignored, because the mission state
machine's "only the holder can resolve" check would otherwise be handed
its own bypass.

The takeover verbs extend that one level up: a player takes a building
**for their own family**, read off `family_memberships` by
`engine.tribeIdFor`, so naming somebody else's tribe is not something
the API can be asked to do. A meeting works the same way — the actor is
added to their own attendee list rather than being nameable in it.

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

**A fifteenth, and the first one caught before it shipped.** A pass
that WRITES a field must not read that same field as its own baseline
— if it does, it is not a delivery, it is an accumulator, and the only
question is how many cycles it takes to hit the ceiling. `statecraft.
deliverTo` writes `maintenance_level` onto a city's infrastructure
every quarter, and its first version applied §49's CITY DNA upkeep as
`row.maintenance_level + DNA_UPKEEP`. A port's roads gained fifteen
points every ninety days and pinned at 100 inside two years. That is
the fifth one-way ratchet this project has found — resources, habits,
buildings, conditions, and now delivery — and the first that did not
have to be found in a measured world first, because the test for it is
mechanical: **a delivery pass run twice on an unchanged world must
leave the world unchanged.** Idempotence is checkable without knowing
anything about what the pass means, which is what makes it worth
asserting on every pass that writes a durable view.

**A sixteenth, and it is about how the other fifteen were found too
late.** **Play the world.** Not a fixture, not a 200-tick measurement —
build a world, run it four hundred ticks, and print what a PLAYER would
see: how many jobs there are, whether anyone finished school, whether
any two neighbourhoods differ, what the event log is actually full of.
The first time that was done (`/scratchpad/playtest.mjs`, 17 Sep 2026)
it found, in one run:

- **The tick threw and the world stopped.** `justice.answerByGroup`
  made restitution to a victim who had died since the offence, and
  `inventory.transfer` asserts its recipient is among the living. Not a
  wrong number — `advanceTick` raised, every tick after it was gone.
  876 passing tests and a green ecosystem sweep over the top, because
  the gap between an offence and a lawless area's answer has to be long
  enough for somebody to die in.
- **Nobody was ever hired.** `hireEntity` had exactly one caller in the
  whole engine — `worldgen`, at generation — while `justice.imprison`
  and death both took people out of work. A child born into the world
  could never hold a job; a released prisoner could never work again.
  55 jobs down to 51 over 400 ticks, only ever down, with
  `communities.employment` → `getCommunityHealth` → `cities.economy` →
  `statecraft.budgetOf` all quietly draining behind it.
- **No child could ever be educated.** `runSchooling` refuses a null
  attainment on purpose, and both `births.js` and `worldgen` recorded
  exactly that for everybody under 18 — so the school window and the
  null window overlapped almost exactly and the mechanism could never
  touch the people it was for.

Every one of those is a rule already in this file, and the suite could
not see any of them: a test asserts a mechanism works, and all three of
these were mechanisms that worked perfectly and were never reached. The
eleventh rule says measure a built world; the thirteenth says measure it
long. **The sixteenth says look at what it is like to be in it.**

**A seventeenth, and it cost four wrong answers in a row to learn.**
When a threshold reads several inputs, the population to measure is
the JOINT one, at the moment of the check — and if the check is
sampled repeatedly over time, a snapshot of that population is still
the wrong thing to measure.

`keys.resolveAggression`'s escalation floor is the case study, and
every attempt was measured; each measured the wrong set:

- **70** — set as if `0.6*agg + 0.4*provocation - 0.15*ta` spanned
  0..100. It spans about -15..+40 on a real population, because
  provocation arrives as `relationships.conflict`, whose ceiling is
  near 50, so its term contributes at most 20.
- **60** — measured the trait half over the whole population (max
  53.7) and conflict over its whole range (max ~50), and assumed the
  two maxima could co-occur. They cannot: `crime.frictionTarget`
  drives conflict from distrust, rivalry and strain and reads nothing
  about aggression, so **the people in the worst relationships are
  ordinary people**. A 1,200-tick world produced zero offences.
- **30 at a flashpoint rate of 0.01** — measured the joint
  distribution properly this time, `responseLevel` across the pairs
  the draw selects from: p50 5, p90 24, p95 28, max 36. Set the floor
  just above p95 so only the top few percent would ever escalate. But
  a snapshot percentile does not survive repeated sampling: every
  eligible pair gets a draw every tick while `advanceFriction` walks
  its conflict upward, so **43 of 44 eligible pairs escalated at least
  once** — 67 offences and a quarter of the town, spread thin at no
  more than three per pair.
- **30 at 0.0006** — the floor decides who CAN escalate, the rate
  decides how often the question is asked, and conflating them is what
  produced the warzone. Separated, the rate carries the volume:
  violent 1,217 and domestic 608 per 100,000 per year against the
  deprivation model's 4,867 for theft, across three pairs and three
  perpetrators.

Two further notes worth keeping. **A missing inverse cannot be fixed
by choosing a constant**: `resolveAggression` writes `conflict +=
responseLevel/10` on every call, so violence raised the tension that
causes violence, and no floor could have produced an equilibrium —
`runSecurityPhase` discharges the grievance when the fight happens and
`advanceFriction` is the restoring force. And **the right reference is
usually inside the model**: reaching for a real-world crime rate
imports a society with a functioning state, while every area in a
generated world here measures as `contested`. Violence below theft,
where theft comes from an independent mechanism, is the comparison
that means something.

The same commit carries the thirteenth rule's other half in a place
worth naming: `infrastructure.js` had been left with decay and no
inverse on purpose, because when utilities were built, every candidate
repair gain turned out to be a ratchet the other way. `maintenance_
level` is the honest inverse and it was in the schema the whole time —
it does not hand condition back, it stops the bleeding, and only for as
long as it is paid for. When a mechanism seems to need an inverse the
schema does not have, check whether the schema already has one nobody
has written to.

**An eighteenth, and it is one line long.** A function's tests can be
complete and correct and say nothing about whether anybody uses what it
returns. `advanceTick`'s phase 4 read

    runSocialPhase(worldState);                                  // 4

while every other phase on either side of it read
`candidateEvents.push(...runPhase(worldState))`. `runSocialPhase`
returns events — `feud_opened` from `crime.advanceFriction`,
`partnership_formed` from `births.advanceBonds` — and **not one social
event in the history of this engine had ever reached the event log.**
Measured on a 400-tick world once the spread operator was there: 485
partnerships and 25 feuds, all of which had happened, changed the world,
and been recorded nowhere. A player reading the log saw a town where
nobody ever fell in love and nobody ever fell out.

`test/births.test.js` asserts on `advanceBonds`' return value, which is
correct and complete for that function. The gap is one level up, and it
is the general form worth keeping: **a fixture checks what a function
returns; nothing checks what its caller does with it.** The same shape
as the eleventh rule (a generator nothing calls) and the twelfth's
second clause (a computed value written over) — a thing that is built,
correct, tested and then dropped on the floor. It was found by adding a
THIRD event to the same phase, measuring, and getting zero.

**A nineteenth, from the takeover key, and it is about specifications
rather than code.** When a document says a mechanic composes "three
systems already built", check all three before scoping the work as
wiring. `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` and
`COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` between them cite the
Occupation Taxonomy, the Control Key and the Family/Tribe cohesion
fields. `VACANCY_SEED.md` had already audited those claims and found
"roughly half of what they cite as built is not there" — and even that
audit was one table off in one place (`position` is on the employment
record, not the person). Two of the three had to be BUILT before the
takeover key could be: `employment_records.position`, accepted by
`hireEntity` and written by nobody, and `families.unity`/`.conflict`,
set to 50 and 0 and moved by nothing. A multiplier over two constants
and a column of nulls would have passed every test and meant nothing.

**A twentieth, and it is the fourteenth rule pointed at a measurement
rather than at a mechanism. A guard that includes its own output in its
evidence can never fail.**

`server/salvage.js` claims that everything in a world has value because
everything can become something. `describeSalvage` is the guard on that
claim, and it reported a clean bill of health **twice while the claim
was false**.

- Round one counted a material as reachable if anything in the item
  catalogue yielded it. Materials ARE in that catalogue — they are
  ordinary items, which is what lets `inventory`, `barter` and
  `control.materielOf` see them without a special case — and
  `salvageOf` returns a material unchanged. So every material vouched
  for itself and `unreachableMaterials` was structurally always empty.
- Round two excluded materials and was still wrong, because the
  PRODUCTS are in the catalogue too. A `blade` is §26 `protection`,
  `protection` yields cloth, and a blade is made of cloth. The crafting
  table vouched for its own inputs.

Each time the guard got quieter the real gap got louder. With materials
excluded it found rubber and plastic; with products excluded as well it
found that **cloth, paper and plastic reached a generated world through
nothing at all** — no item anywhere carries the §26 `textiles`,
`clothing`, `medicine` or `water` category, so four teardown rows
described a supply that did not exist. Measured: `blade`, the request's
own headline example, was makeable by **0 of 150 people**, along with
`furniture`, `bandage` and `notebook`. Four of eight products, and the
guard said fine.

The general form is the eleventh rule's inverse. That one says a
generator nothing calls is indistinguishable from one that does not
exist; this one says **a check that everything is fine, which counts the
thing being checked as evidence, is indistinguishable from no check at
all** — and it is worse, because it is reassuring. When writing a guard,
ask what would have to be true for it to fail, and if the answer is
"nothing", it is decoration.

Two smaller ones from the same file, both already rules here in other
clothes. `runSalvage`'s first version read `npc.community_id`, which
does not exist — an NPC is an engine object with `communityId`, a
property is a database row with `community_id` — so the pass would have
run on schedule forever and done nothing (rule 6). And every recipe
named a `skill` that `canMake` never read (rule 12's second clause),
which mattered more than it looks: the §25 tier gate excludes NOBODY
from these recipes, because Tiers 1 and 2 need no schooling by design,
so measured on a world 150 of 150 people qualified for all eight and the
only real gate was materials.

## Active work
Phase 2. `dev-docs/` holds a folder per completed phase; `VACANCY_SEED.md`
is the live working document and `VACANCY_INVENTORY.md` is the file and
route inventory. Both are kept current — if either disagrees with the
code, the code is right and the document is a bug.
