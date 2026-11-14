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

**Explicitly deferred — do not touch**: Simulation/Multiplayer modes,
Transportation, subscription tiers, ecosystem link-outs, anything
gambling-adjacent.

**Property was on that list and is not any more.** Phase 2 was opened
on 29 Aug 2026 and the Property Engine is built (`server/property.js`).
**Leader mode was on that list and is not any more either** — reopened
by explicit human instruction on 5 Nov 2026; see the forty-seventh
standing rule below for the real design and what it deliberately
diverges from. Nothing else moved off the deferred list — in
particular, gambling and casino systems (#291-305) stay closed pending
compliance review, which is a legal gate rather than a scope decision,
and the API map's own "What NOT to build" says the same.

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

**Twelve verbs now, not five.** `break-down`, `strip-building`,
`make-thing` and `search-location` joined on 18 Sep 2026 under the same rule as the three
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

**Leader-dashboard is built — see the forty-seventh standing rule.**
Simulation-controls remains unbuilt because Simulation mode is still
deferred above — not because it was missed.

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
The first time that was done (`vacon-c/scripts/playtest.mjs`, 17 Sep 2026)
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

**A twenty-first, and it is the paper twin's twin's twin. The
consumers of a shared system are a system nobody builds.**

`world-layer/UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` is the parent
document behind `world-layer/` — one shared Earth model every gameplay
system reads from, seven real modules, a hero/regional/filler tier
vocabulary, and a runnable UNESCO importer. Its own status section ends:

> **Genuinely unbuilt**: the consumers. VACON-C is paused, so the world
> model is generated and read by nothing yet.

**VACON-C is not paused.** It is the most built thing in this repo, and
`server/landmarks.js` was written here — thirty-three categories, its
own significance scale, its own per-city placement — without anybody
finding `world-layer/locations.js`, which already had `landmarkData`, a
tier model and an import path for real named sites. That is the third
standing rule at the level of whole systems rather than columns: **two
disagreeing answers to the same question**, one of them anonymous and
generated per city, the other real and imported per region.

The lesson is not "check harder". It is that a document saying a system
is waiting on its consumer **goes stale in exactly one direction** —
the consumer gets built, nobody re-reads the file that was waiting for
it, and the integration is the one piece of work neither side's
documentation lists as outstanding. When a module's status says it is
waiting on something, that sentence needs re-checking every time the
something changes, and nothing prompts you to.

Two constraints that shape the fix, both real:

- **`world-layer/` may not be imported across the directory
  boundary.** Ten apps reference it in comments and none require it;
  that is what keeps the per-app Docker build context valid
  (`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`). So the integration is by
  DATA — a region pack VACON-C reads the way it already reads
  `worldState.barterItems` and `flows.js`'s templates — not by
  `require('../world-layer')`.
- **The real data sources are unreachable from here**, re-checked
  rather than trusted: `query.wikidata.org`, `whc.unesco.org` and
  `services1.arcgis.com` all return 403 CONNECT at the agent proxy.
  Per `/root/.ccr/README.md` that is report-do-not-work-around, so the
  pipeline is built and a network that can reach them makes it one
  function call, exactly as `imports/unescoImport.js` already says.

**The world-layer integration landed the same day the rule was
written.** `server/landmarkPacks.js` reads a region pack as DATA;
`world-layer/exportRegion.js` produces one; neither app requires the
other, and `test/landmark-packs.test.js` asserts the two copies of the
Key category list are identical so the duplication cannot become drift.
`data/st-louis.landmarks.json` is the worked example the import
documents point at, and it declares `source: "sample"` rather than
claiming to be a register import it could not perform.

Three columns had to exist first and all three were simply missing:
`properties.name`, `communities.name`, and shops placed per AREA rather
than per city. Measured: 11 anonymous landmarks and two empty
neighbourhoods before; 38 named ones across six named areas after.

**A twenty-second, and it is the twentieth rule pointed at version
control. An ignored file is invisible, not untracked.**

`data/st-louis.landmarks.json` was written, `git add -A`ed, named in a
commit message and **never committed.** `**/data/` is gitignored, and
`git status` reports nothing for an ignored file — so the commit
succeeded, said it had the file, and did not. It would have gone with
the container.

The repo's own `.gitignore` already records this happening: six real
source files under `vex-business/packages/data/` sat untracked for two
weeks after a rename moved the carve-out out from under them, and its
comment says exactly why nobody noticed — "`git status` was clean,
because ignored files are not untracked files, they are invisible."
There is even a test, `scripts/test/gitignore-carveouts.test.mjs`,
which asserts that every path a negation names actually has tracked
files under it. It failed the moment the carve-out was added and
passed once the file was really in, which is the whole point of it.

**Check that a file you meant to commit is in `git ls-files`, not that
`git status` is clean.** The two are different questions and only one
of them is about your file.

**A twenty-third, and it is the thirteenth rule killed by a tidiness
measure. A rounding quantum coarser than the per-step change erases
the change — or doubles it, and which one depends on float noise.**

`property.advancePropertyLifecycle` rounded `condition` to one decimal,
for a good and stated reason: repeated subtraction of 0.4 in binary
floating point produces `86.39999999999998`, which is the same number
wearing fourteen digits of noise. The reason was right and the quantum
was wrong. A lived-in, owned home nets **+0.05 a tick** — 0.3 of
occupant upkeep plus 0.15 of owner upkeep against 0.4 of decay — and
the file's own header says such a home "slowly improves".

It does not. Measured: a maintained house went 80 → 80.05 → rounded up
to **80.1, and sat at exactly 80.1 for two hundred ticks**, because
`80.1 - 0.4 + 0.45` lands on `80.14999999999999` and rounds back down.
Had the float noise fallen the other way it would have rounded up every
tick instead and the house would have gained 0.1 a tick — **double** the
real rate. So the guard added to remove float noise made the outcome
depend on float noise, in the one place it decided whether an inverse
existed at all.

This is the thirteenth rule with a new cause. Buildings were the third
one-way ratchet this project found and the inverse was built; the
rounding then quietly took it back, and `dev-docs/PLAYTEST_19_SEP_2026
.md`'s "85% of all buildings are ruins by tick 600" was measured with it
in place. **When a value is rounded, check the quantum against the
smallest real per-step change**, not against how many digits look tidy.

And the reason it survived: `test/authority.test.js` asserted
`lived.condition > 80`, which 80.1 satisfies. An assertion on the
DIRECTION passes for a mechanism that has stopped; the assertion has to
be on the RATE, because the rate is what was claimed.

**A twenty-fourth, and it is the eighth rule's mirror image. A fixture
whose subject is generated is untrustworthy; so is one whose ASSERTION
encodes an accident of the seed.**

`test/justice.test.js`'s "a generated world reaches it, and reaching it
is RARE" built a seeded world, ran 200 ticks, and asserted that **every
cleared incident with a named perpetrator becomes a court case.**
`runJustice` does no such thing and never claimed to: `authority
.prosecutes` charges where the state's writ reaches and files a
`groupSanctions` row where it does not, because a contested area charges
what it cannot ignore and lets the rest go. That branch is the entire
point of `server/authority.js`.

So the assertion silently asserted that **no area in this world is
contested** — and passed for as long as the seed happened not to produce
one. The day it did, incident 2 went unanswered in community 2 under
regime `contested`, and a green suite reported a working decline as
"the cascade is broken between policing and justice".

The eighth rule is about the subject of a test being random. This is
about the EXPECTATION being random: a two-branch decision asserted as
though it had one branch, where the untaken branch is not a bug but the
feature. **When the code under test can take more than one correct
path, the assertion has to name all of them** — here, that every cleared
incident is DISPOSED OF, as a case or as a sanction, and never left in
limbo. That is the claim worth holding, and it is the one that does not
depend on which way a seeded world happened to fall.

**A twenty-fifth, and it is the only one of these found in my own
reasoning rather than in the code. A measurement is not its
consequence.**

`dev-docs/PLAYTEST_19_SEP_2026.md` recorded a real, correctly measured
fact — median net worth rises tenfold over 600 ticks, monotonically, at
every sample — and then drew a conclusion from it in the next sentence:
that this "makes poverty-driven mechanics — `crime.deprivation`,
`distress_sale`, the migration pressure — progressively unreachable."

**The measurement was right and the conclusion was wrong**, and one
look at the consumer would have said so. `areaStats.povertyLine` is
RELATIVE:

    const mid = median(worths);
    return mid === null ? null : mid * POVERTY_MEDIAN_FRACTION;

Half the median. If every wage-earner's savings inflate tenfold, the
line inflates tenfold with them and the SHARE below it barely moves;
`isBelowPovertyLine` is relative on both sides. Deprivation does not
become unreachable. The nominal figures just get bigger.

This is "citation is not presence" turned on an inference instead of a
document. The whole file is about not trusting that a thing named
somewhere is present — and the same discipline applies one step
further along: **do not trust that a number moving somewhere means
anything downstream until you have read what reads it.** A measured
fact plus a plausible mechanism is still a guess, and it is a
particularly convincing one because half of it is true.

The tell is grammatical. "X rises, SO Y becomes unreachable" is a claim
about Y, and Y has a file. Open it.

What the correction produced was a better finding than the original,
which is the usual outcome: `economy.getNetWorth` is `assets + savings
- debt` and does not include the property somebody owns, while
`property.currentValue` computes value from condition and `players.js`
already rolls it up beside `netWorth` in the same dashboard. Eleven
call sites read `getNetWorth`, including the poverty line itself and
both of `crime.js`'s deprivation checks — so **a person who owns three
buildings and no cash reads as destitute**, and the largest asset class
in the world is invisible to every wealth-dependent mechanic. The third
standing rule's shape, and it was sitting underneath a claim that
sounded finished.

**A twenty-sixth, and it is about what to do when a rule keeps
recurring. When the same defect lands in a THIRD place, stop fixing
instances and change the contract.**

`seededUnit` takes a number. `seededDraw` takes the parts of a draw.
They are one word apart at the call site and the wrong one is
completely silent: the extra arguments are ignored, `'world' || 1`
keeps the string, the bitwise operations coerce it to 0, and every call
returns **0** for the life of the world.

Three systems, each found separately, each by accident:

- **`environment.drawWeather`** — measured, 200 ticks, three cities,
  every one of them `clear` the entire time and not one weather event
  in any world this engine had ever generated. Its header carries the
  post-mortem.
- **`migration.runMigration`, in TWO places.** `0 >= chance` is false
  for any positive chance, so **`MOVE_CHANCE` has never gated anything**
  — every pushed person with an acceptable destination moved
  immediately, and there was no per-person randomisation left in the
  pass at all. That is why moves arrived as whole cohorts: 21 in two
  herds over 600 ticks, which became **2 moves by two individuals**
  once the call was right. Most of the depopulation in
  `dev-docs/PLAYTEST_19_SEP_2026.md` finding 5 was this bug, and the
  finding's own explanation of the SHAPE had to be corrected.
- **`tribeMissions.runTribeMissions`** — every mission reward came out
  at exactly its floor, which is how the other two were found.

The environment post-mortem was already written, in this repository,
with the measurement attached. It did not stop the next two, because a
comment in one file is invisible at a call site in another. **A
warning is not a guard.**

So `seededUnit` now throws a `TypeError` naming `seededDraw` when
handed anything but a finite number, and the mistake is a crash at the
call site instead of a constant somewhere downstream. The whole suite
passed unchanged, which is the evidence that nothing legitimately
relied on the coercion.

Two smaller things worth keeping from the same pass. `server/seeded.js`
— the substrate under §88's replay guarantee, imported by seven modules
— **had no test file at all**, which is why none of this was ever
asserted. And the test that would have caught it is not a range check:
a constant passes "is it in [0,1)" every time. The assertion has to be
on the DISTRIBUTION — 1,000 draws, more than 990 distinct, mean between
0.45 and 0.55, all ten deciles occupied — which is the twenty-third
rule's lesson in a new place: **assert the property that was claimed,
not the one that is easy to check.**

**A twenty-seventh, and it is the twenty-first rule's own sequel: the
join it made for landmarks was not the whole join.**
`world-layer/imports/censusImport.js`, `blsImport.js`, and
`hifldImport.js` had been sitting next to `unescoImport.js` the whole
time, turning real Census ACS, BLS OES, and HIFLD Open data into
exactly the shapes three of this engine's own invented bands stand in
for — age structure and adult attainment (`worldgen.js`'s population
loop), occupation weighting (`occupations.drawOccupation`'s `1/tier`
pyramid) and wages (`worldgen.js`'s flat `random.range(8, 90, ...)`
hire), and per-type infrastructure capacity
(`DESIGN_CAPACITY_PER_1K * cityPopulation / 1000`). Nobody had asked
whether `landmarkPacks.js`'s join was the only one these three
importers were waiting for.

`server/populationPacks.js`, `labourPacks.js`, and
`infrastructurePacks.js` are the same join, three more times, same
shape as `landmarkPacks.js` throughout: a pack is data, never a
`require('../world-layer')`; a bad pack is refused outright, never
half-applied; a world with none of the three still generates exactly
as it always did (every new call site is a `realValue ?? inventedBand`
fallback, verified by running the full suite before and after with no
behavior change on the no-pack path). The one new wrinkle: a tract or
a metro has no NAME an auto-generated community can be matched to the
way a landmark's own `area` field matches it to a neighbourhood, so
packs are assigned by POSITION (city index * communitiesPerCity +
community index) — standing rule 8 (§88) applied to data this engine
did not generate, not just data it did.

See `world-layer/README.md`'s own corrected header for what this
closes on that side.

**A twenty-eighth, and it is the twenty-seventh rule's own sequel:
three more real sources were sitting beside the three that closed it,
asked for in the same breath as "corporations, businesses... disease...
weather" and never checked separately.**
`world-layer/imports/overtureImport.js` (real named businesses, mapped
onto this engine's ten retail types), `cdcImport.js` (real CDC PLACES
chronic-disease prevalence), and `noaaImport.js` (real NOAA climate
normals, classified into the published Köppen-Geiger vocabulary) had
each already been built and tested in isolation, same as the census/
BLS/HIFLD trio was before the twenty-seventh rule closed that join.

`server/businessPacks.js`, a `healthBaseline` extension to
`populationPacks.js`, and `server/climatePacks.js` are the same three
joins, same shape throughout — a pack is data, never a
`require('../world-layer')`; a bad pack is refused outright, never
half-applied; a world with none of the three still generates exactly
as it always did. Three real wrinkles, not one:

- **Retail is matched BY NAME, not position — the landmark rule, not
  the tract rule.** A real Overture business has an `area`, the same
  field a landmark pack's `byArea` groups on, so `worldgen.js`'s
  existing shop-placement loop (draw-without-replacement from
  `landmarks.RETAIL_CATEGORIES`, per area) now checks a real business
  queue for that area first and falls through to the random draw only
  once it is empty. A real business's significance still comes from
  its category's own band — Overture knows a business exists, not what
  it is worth remembering, and inventing a score would be exactly the
  mistake `landmarkPacks.js`'s own `significanceFor` was written to
  avoid on the hero side.
- **A multiplicative baseline needs a starting point other mechanisms
  can still move.** `mortality.diseasePressure` already multiplies in
  each active condition's `mortalityMultiplier` against an implicit
  starting pressure of 1; a real CDC baseline (itself already centred
  on 1, per `toHealthPressure`) replaces that implicit 1 rather than
  replacing the function. `city.healthBaseline` is the mean of its
  covered communities' real tract baselines, set once at generation —
  **known, stated limitation: in-memory only**, no column in
  `VACANCY_POSTGRESQL_SCHEMA.sql`, so a world rebuilt from Postgres
  loses the enrichment and falls back to the unmeasured default, same
  as a world with no pack at all. Not a silent loss: this is the
  declaration, same posture as a statistic this engine declares it
  cannot compute.
- **One climate per region, because this engine generates one region
  per world — and scoped to the one column confirmed to be read by
  nothing.** `migration.js#generateRegion`'s `climateKey` parameter and
  `barter.js`'s "`regions.climate_key` is written by nothing" were both
  already on file, waiting for exactly this caller. Deliberately NOT
  wired into `environment.climateForLatitude`'s own per-city value,
  which already feeds live weather mechanics with an incompatible,
  invented vocabulary — Köppen letters are a different classification,
  and overriding a live reader's enum with a different one is the
  mistake worth avoiding here.

Found and fixed in the same pass: `world-layer/exportRegionStats.js`'s
own `exportPopulationPack` gated a tract's inclusion on
`data.source === 'us-census-acs'` alone, which would have silently
dropped a location's real CDC health baseline on any tract CDC covered
but ACS did not — `importPlacesTract` nests its own data under
`healthPrevalence` without necessarily being the import that set a
location's top-level `populationData.source`. The fix checks for
either real source, not one specific string — the sixth rule's shape,
a field read that assumes a vocabulary narrower than the one the
writer actually uses.

**A twenty-ninth, and it is the first of these that is not a bug. Two
more real sources closed the same way as the twenty-seventh and
twenty-eighth rules' six — and one of them is not like the rest, and
says so rather than pretending otherwise.**

`world-layer/imports/femaImport.js` (real FEMA National Risk Index
hazard ratings) and `imports/religionImport.js` (real U.S. Religion
Census shares) had been sitting fully built and tested, same posture
as every other importer, when a direct question ("what else could we
add for consistency?") surfaced them.

**FEMA risk closes the same way everything else has: `server/
riskPacks.js` is `landmarkPacks.js`'s shape again, assigned by city
position (§88).** `environment.js`'s own header already named the gap
— "a climate profile is not a hazard profile... two temperate river
towns, one on a floodplain and one on a bluff, get the same storms" —
and a real county's weight now boosts `environment.drawWeather`'s own
climate-weighted draw, **narrowing WITHIN what the climate already
allows, never outside it**: `CLIMATES.arid.storm` stays 0 however a
real county's flood rating reads, because a desert does not get
coastal flooding. `city.hazardRisk` is in-memory only, same known
limitation as `city.healthBaseline`.

**Religion Census is not the same shape, and the difference was
caught before it shipped rather than after.** Every pack before this
one replaces an invented NUMBER with a real one. `worldgen.js`'s
religion vocabulary (`'Tidewater', 'Ridge', 'None'`) is invented for a
different, stated reason — the same file renames its ethnicities too,
"because borrowing real ethnonyms would attach real-world associations
to a simulation that models none of them." The U.S. Religion Census
uses real tradition names (Protestant, Catholic, Muslim, Jewish, and
so on), and this engine's NPCs are also subject to its own crime,
death and disease mechanics — wiring real religious identity onto a
procedurally generated crime record is a different kind of call than a
real wage band or a real climate key.

This was raised directly rather than decided silently either way, and
the explicit answer was to wire it in — against the recommendation
given when it was raised. `server/religionPacks.js` exists and is
wired into `worldgen.js` exactly that way, with the tension recorded in
its own header rather than smoothed over, and the §9 firewall carried
through unchanged: this reader draws one NPC's value from real local
shares the same way `attainmentFor` already does for education, and
nothing in this engine's generators reads `religion` to gate morality,
criminality, intelligence or worth. A world built with no religion
pack keeps the invented vocabulary, exactly as before — the judgement
about whether to supply one belongs to whoever builds that world.

The general shape, for whichever of this project's remaining unwired
sources comes up next: most of them are the twenty-seventh rule's kind
— a real number standing in for an invented one, wire it the same way
every time. A few, where the real vocabulary carries a real-world
identity onto simulated people, are not, and the difference is worth
surfacing before writing the reader, not after.

**A thirtieth, and it is the twenty-seventh rule's third case: not
every real source needs a new join at all.** A full pass over
`world-layer/sources.js`'s remaining entries found four shapes, not
one:

- **`cmsImport.js` and `ncesImport.js` are REFRESH sources for a join
  that already existed**, not new ones. Both write a real capacity
  onto the exact `buildingData.infrastructureType`/`.capacity` fields
  HIFLD already fills — CMS a fresher, legally-required hospital bed
  count (`preferByDate` decides the winner at import time, not by
  which source is declared authoritative), NCES a real pupil count
  for `schools`. `world-layer/exportRegionStats.js`'s
  `exportInfrastructurePack` gated on `source === 'hifld-open'`
  alone, which would have silently dropped every CMS-refreshed or
  NCES-sourced facility — the twenty-eighth rule's
  `exportPopulationPack` bug, in a third place. Fixed the same way:
  check for any of the real sources, not one string.
- **`gnisImport.js` and `overtureImport.js`'s
  `importOvertureDivisions()` needed no new code anywhere.** GNIS
  writes real natural features (caves, summits — the two Key
  categories nothing else in the registry names) onto `landmarkData`
  with a category already in `exportRegion.js`'s `KEY_CATEGORIES`, so
  the existing exporter already reads them with zero changes; its own
  `places` output and Overture Divisions' `byLevel.community` are
  both already the exact shape `landmarkPacks.js`'s `areas` field
  wants. `world-layer/test/exportRegion.test.js` now asserts this
  rather than leaving it as a claim nobody checked.
- **`usgsImport.js` (elevation/terrain) is a real, tested transform
  with no VACON-C consumer to join it to**, and that is a declared
  choice rather than an oversight: nothing in this engine currently
  decides anything from a terrain fact, and wiring real data into a
  field nothing reads is the eleventh rule read backwards — a real
  import nothing reads is indistinguishable from not importing it.
  `statistics.terrain_and_water`'s own entry already named this
  precisely ("two importers and a pack reader away") before this
  pass; re-read rather than re-guessed, and still correctly
  unavailable — closing it needs a design decision about what
  terrain should DO, not a reader.
- **`overtureImport.js`'s `importOvertureBuildings()` (real footprint/
  height/floor data) is real and matches no existing per-city or
  per-community join** — every other pack here is assigned one real
  row per city or community; a building pack would need one real row
  per ordinary generated HOME, a materially larger structural change
  left for its own round rather than folded into this one.
  `wikidataImport.js`/`wikimediaCommons` overlap UNESCO/NRHP/GNIS with
  little marginal value (and Commons is images this engine has no
  renderer for); `naturalEarthImport.js`/`openweatherImport.js` sit at
  a grain this engine's city/community model does not currently ask
  for.

**A thirty-first, from a direct question about mental health,
addiction, childbirth and crime data — and it is two findings and a
correction to my own prior framing, in that order.**

**First, a clean extension of an existing join.** CDC PLACES publishes
real tract-level DEPRESSION and BINGE (binge drinking) prevalence —
the only two measures it publishes at this grain for mental health and
alcohol use — and `cdcImport.js` now maps both, same `behaviour` kind
and weight as `CSMOKING`/`OBESITY` already have. No specific drug is
estimated at this grain by CDC at all.

**Second, a real curve closed the twenty-seventh rule's way.**
`births.js#fertilityForAge` and `BASE_ANNUAL_BIRTH_RATE` are both
flagged interpretive — "no document gives a fertility curve" — and
real CDC/NCHS Natality data is exactly that curve, measured: live
births per 1,000 women, per county, per standard five-year age band.
`natalityPacks.js` resolves a real county onto `community.
fertilityRates` at generation (the same in-memory-only posture as
`healthBaseline`/`hazardRisk`, for the same reason — no schema
column), and `births.js#runBirths` reads it fresh every tick, since a
bearer's age moves and a tract's age bands do not need to be re-read
that way. `statistics.js`'s `teenage_birth_rate` was already a real,
computed statistic over whatever `births.js` generated; this is the
generator becoming real underneath it.

Drug-overdose mortality is real too, and folds into a mechanism that
already exists rather than adding one: this engine has no drug or
substance mechanic of any kind — `crime.js`'s own `CATEGORIES.drug`
entry says "no substance, contraband or trade in one exists... a drug
offence has no object," and `mortality.DEATH_CAUSES` has no overdose
entry. A real county overdose-death rate is still the same KIND of
fact `cdcImport.js`'s chronic-disease baseline already is — excess
mortality a place genuinely carries — so `populationPacks.
overdoseBaselineFor` is a SECOND real input to `mortality.
diseasePressure`, compounding with the CDC PLACES baseline rather than
replacing it or introducing a category this engine does not have.

**Third, and this one reverses something I had proposed one turn
earlier: `fbiImport.js` stays unwired, because the premise for wiring
it was wrong.** Its own header describes `crime.DANGER_REFERENCE_PER_
1K` as currently 40 and broken — "crime: 100" in most areas — and
argues real FBI rates are the safe fix because this only anchors a
DISPLAYED scale, never the escalation floor the seventeenth rule
protects. Reading `crime.js` directly found the constant is 280, not
40, already corrected through an INTERNALLY-measured method: "280 is
the 95th percentile of the SHRUNK distribution... Measured, not
chosen." That is the seventeenth rule's own preferred answer for
exactly this kind of constant — the right reference was inside the
model, and somebody already found it. Wiring real FBI data in now
would not fix a bug; it would silently replace a correct, internally-
measured constant with an external one, on a premise (`= 40`) that
was itself stale. **A proposal approved before the premise was
checked is not a decision to execute anyway once the premise turns
out to be wrong** — the twenty-fifth rule's shape, pointed at my own
reasoning instead of at a measurement.

**A thirty-second, from the "is there a more accurate gang/criminal-
organization picture" question, and it closes three more real joins
while declining a fourth that was never real to begin with.**

**First, the twenty-seventh rule's gap, found a second time.**
`world-layer/imports/censusImport.js` had been writing
`medianHouseholdIncome`, `incomeQuantiles` and `giniIndex` onto
`economicData` since round 1, with zero VACON-C consumer — the exact
shape of the twenty-seventh rule's `censusImport`/`blsImport`/
`hifldImport` trio, sitting unread a second time in the same file.
`server/incomePacks.js` is the join: a real median income and Gini
RE-CENTRE and RE-SPREAD `worldgen.js`'s invented `[4000, 60000]`
home-value range (`valueRangeFor`) rather than replacing it outright,
because this engine has no other anchor for what a home should be
worth absent a real figure — the same posture `riskPacks.js` takes
narrowing a climate's storm odds rather than replacing them outright.

**Second, a real structural inverse for a margin that could only ever
go one way.** `worldgen.js`'s `homesPerResident` is a flat 1.15,
always above 1 — structurally incapable of expressing a housing
deficit. HUD's Point-in-Time count is a real per-capita homelessness
rate, and `realHomesPerResident = 1 - realHomelessnessRate` is the
opposite condition the invented margin can never produce on its own.
`server/populationPacks.js#homelessnessRateFor` reads it (bounded
`[0, 0.05]`, a conservative sanity ceiling — HUD's own PIT counts run
far below that even in the highest-rate CoCs) and `worldgen.js`'s
`homeCount` computation uses it in place of the invented margin only
when a real rate is present.

**Third, the gang-database question asked three times this round, and
answered for real rather than invented.** FBI NGIC's "National Gang
Report" is qualitative/PDF, not structured; GangNET and CalGang are
both restricted, non-public law-enforcement systems (CalGang
additionally carries documented, court-flagged accuracy problems).
OJJDP's National Youth Gang Survey is the one real, public, structured
option — and it is also not current: `LAST_SURVEY_YEAR = 2012` is
enforced in both `world-layer/imports/nygsImport.js` (the importer
throws on a later year) and `server/gangPacks.js` (the pack reader
refuses one), and a `staleness` string is carried on every row rather
than left in a comment where the fourteenth rule's own "a warning is
not a guard" would apply. `gangPacks.js` replaces `worldgen.js`'s
invented `factionsPerCity`/`gangMembershipRate` with a real jurisdiction's
gang count (including a real zero — `gangCountFor` returns it, not
null) and membership rate, assigned by city position (§88).

**Fourth, and this is the twenty-ninth rule's distinction applied
again rather than relearned: a request for Antifa/political-
organization "terrorist" data was declined outright, not deferred.**
Antifa carries no formal U.S. terrorist designation — there is no real
data of the kind asked for to wire in, and inventing a designation
that does not exist is a different and worse mistake than any of the
ones this file catalogues, because the other thirty-one are all about
a real fact sitting unread. There was no fact here. Separately, a
request to derive "an accurate assessment" from scraped Reddit content
was also declined on its own terms — not an access problem
(`world-layer/sources.js` already distinguishes `access: blocked` from
`access: none`), but a sampling-bias problem: a self-selected posting
population is not a representative one at any access level, so the
word "accurate" in the request was the premise that needed correcting,
not the data source.

**Disability/veteran status (Census ACS shares, also real and also
approved) and real race/ethnicity + marital-status data (approved,
reversing the deliberately-fictional-ethnicity rule the twenty-ninth
rule's religion section already named) are deliberately NOT part of
this round** — both need a new per-NPC field rather than reusing an
existing mechanism's invented band, the same complexity class as
`religionPacks.js` was, and are left for their own round rather than
folded in here.

**Roads/Overture Transportation was raised again this round and
excluded again, on the same policy grounds the thirtieth rule already
recorded — restated here because it was proposed a second time before
being checked a second time.**
`world-layer/imports/overtureTransportationImport.js`'s own header
opens with "VACON-C DEFERS TRANSPORTATION BY POLICY. READ THIS FIRST,"
and every row it produces carries a `DEFERRED_BY` field. That is an
explicit, binding project policy, not a design-philosophy tension like
religion or ethnicity where the user's own sign-off can reasonably
override it — the distinction the twenty-first rule's "two disagreeing
answers" shape does not capture, because here there is only one
answer and it says not yet.

**A thirty-third, and it is the thirty-second rule's own fourth case —
real, clean, and deliberately a report rather than a mechanism.**

Asked directly whether every locality's "political status — red,
blue, Democrat, Republican" could be added, the answer is yes and it
is real: MIT Election Lab publishes county-level presidential returns
(CC0), and `server/politicalPacks.js` reads a real two-party
Democratic vote share onto `city.politicalLean`, assigned by city
position (§88), same as every other pack here.

**This one earns a header of its own because it has no invented
constant to replace.** Every pack before it either replaces a flagged
invented band (`incomePacks.js`) or narrows an existing one
(`riskPacks.js`). VACON-C's elections (`politics.js`) are a procedural
mechanism — candidates, votes cast by generated citizens — with no
real-world left/right baseline anywhere in it. So the twenty-seventh
rule's shape ("a real number standing in for an invented one") does
not apply, and reaching for the NEXT thing that shape suggests — read
the real share, then have it bias something, a crime rate or a
policing intensity or a law-strictness term — would not be closing a
gap. It would be fabricating a causal political claim this project has
no research behind and no business asserting, which is a different
and worse mistake than any of this file's other thirty-two entries,
because every one of those is a real fact sitting unread and this
would be a real fact put to a use nothing licenses.

So `political_lean` is a new `statistics.js` entry, reported, null for
a world with no political pack, and read by nothing else in the
engine. That is the correct scope, not an unfinished wiring — see
`politicalPacks.js`'s own header for the point stated in full, so a
future pass checks this reasoning before adding a behavioral hook, not
after.

The same question also asked for (1) crime statistics by age, broken
out for literally every town, and (2) an official LA/Chicago
gang-territory map. Both needed a correction rather than a build.
**(1) is real in part and impossible as stated**: FBI NIBRS carries
real offender-age data where an agency reports it, but participation
has real gaps, and no dataset gives real per-capita crime for every
town — some report inconsistently, some not at all. **(2) does not
exist**, and for Chicago specifically that is policy, not an
oversight: CPD has stated publicly it does not release gang-boundary
data because of how it could be used for retaliation. A 2019 WBEZ/
Sun-Times FOIA'd one internal CPD dataset and reported it as already
outdated by CPD's own account — a single investigative project's
one-time release, not a live structured source, and treating it as
current coverage would repeat the NYGS staleness problem with none of
the labelling. What IS real for those two cities: `data.lacity.org`
and `data.cityofchicago.org` both publish real, geocoded, incident-
level crime data at neighborhood/beat grain — genuinely strong, but a
two-city exception to "one source, every region" that every other pack
in this registry follows, and not yet built pending that scope call.

Two further real sources from the same conversation, both approved and
both NOT yet built, for the complexity reasons stated when raised:
Census ACS ancestry/national-origin tables (B04006/B05006) for real
community character (Somali/Minneapolis, Bosnian/St. Louis-style), and
Census ACS nativity/year-of-entry/citizenship-status shares as the
honest substitute for "ICE records and immigration status" — individual
enforcement records are not public and a per-NPC immigration-status
field would violate this file's own §9 firewall, so the real
substitute is place-level, same as everything else in this registry.
Both need a new per-NPC field, the same complexity class already
deferred once for disability/veteran status and real ethnicity.

**A thirty-fourth, closing the LA/Chicago crime-hotspot half of the
thirty-third rule's own correction.** What IS real for those two
cities — LAPD and Chicago PD's own geocoded, incident-level open-data
portals — is now wired, and it is the one source in this registry
that is a two-city exception rather than a national one, named as
such rather than generalized: `imports/cityCrimeImport.js` and
`server/crimeHotspotPacks.js` cover Los Angeles and Chicago only, and
every other generated city gets no pack and is unaffected.

**Self-normalizing, because there is no external "ordinary crime
rate" worth inventing.** Every other real multiplier in this registry
(`healthBaseline`, `overdoseBaseline`) centres on an external
reference the source itself implies (CDC's own national baseline is
implicitly 1). A property-crime rate has no equivalent universally
agreed "ordinary" figure, so `crimeHotspotPacks.weightFor` centres
each area against the MEAN of its own pack's areas — the seventeenth
standing rule's "the right reference is usually inside the model,"
applied to a real import rather than an internal constant.

**Deliberately scoped to the one crime mechanism that was already
flagged as chosen rather than measured.** `crime.js#runDeprivationCrime`
draws property/theft risk from `BASE_DEPRIVATION_RISK` (0.0006), flat
and already labelled interpretive. The real weight multiplies that
constant only. It does NOT touch `keys.resolveAggression` — that
mechanism's floor and rate cost four measured, written-down attempts
(the seventeenth rule's own case study) to calibrate against this
engine's internal distributions, and grafting an external real-world
weight onto it without equivalent measurement would risk re-breaking
exactly the balance those four attempts fixed. A test
(`crime-hotspot-packs.test.js`) checks the wiring directly — that
`crimeHotspotWeight` is read in `crime.js` and that `resolveAggression`
is not defined there — rather than trying to prove a negative through
a seeded draw.

**A thirty-fifth, closing the ancestry/national-origin half of the
thirty-third rule's correction — the reversal explicitly approved,
built the same way `religionPacks.js` was.**

`world-layer/imports/ancestryImport.js` and `server/ancestryPacks.js`
replace `worldgen.js`'s invented ethnicity vocabulary
(`'Riverborn', 'Highland', 'Coastwise', 'Outlander'`) with real Census
ACS ancestry/national-origin groups (Table B04006), the same shape
`religionPacks.js` already took for `npcs.religion` — a real
vocabulary standing in for an invented one, wired on explicit
instruction after the tension (borrowing real ethnonyms attaches
real-world associations to a simulation that models none of them) was
raised and the call made anyway.

**Somali and Bosnian are kept as their own groups, not folded into a
region.** B04006 enumerates roughly ninety specific ancestry codes;
this importer generalises most of them into major groups the way
`religionImport.js` generalises denominations into traditions, but the
two groups the request named directly — "Somali community in
Minnesota," "Bosnian community in St. Louis" — stay their own entries
rather than being absorbed into `subsaharan-african` or a generic
European bucket. Collapsing the two specific examples the request gave
into a regional average would have defeated the entire point of
building this.

**The §9 firewall is easier to hold here than it was for religion, and
the reason is the existing guard rather than a new one.**
`test/ethnicity.test.js` already asserted, before this round, that
NOTHING in this engine reads `npc.ethnicity` to decide an outcome, and
that exactly one module (`demographics.js`) measures it. Adding
`ancestryPacks.js` as a second permitted reader — it supplies the
VALUE the field is set to, the same relationship `religionPacks.js`
has to `npcs.religion` — required updating that test's own allowlist,
and nothing else. The firewall test is the proof: it would have failed
loudly had this reader tried to make a DECISION with the field instead
of just filling it, and it did fail once, for the right reason, before
the allowlist was updated — see the test's own comment on why
`ancestryPacks.js` belongs there now.

**A thirty-sixth, from being asked directly to use academic papers for
gang information where no structured database exists — and it found
a real, independent SECOND measurement rather than new jurisdiction
data.**

Pyrooz & Sweeten (2015, *Journal of Adolescent Health*) is a national
self-report estimate of youth gang membership from the NLSY97 cohort
(youths born 1980-84, nine survey waves), combined with 2010 Census
population figures: 2.0% overall prevalence ages 5-17, peaking at 14
(5.0%), implying roughly 1,059,000 youth gang members nationally in
2010 — more than three times the ~300,000 contemporary
law-enforcement-based estimate, which the authors attribute to police
records favouring older, more criminally-involved youth.

**This could not be wired in as a pack, and the reason is worth
naming rather than working around.** It has no geography at all — a
single national number, the opposite grain from NYGS's per-
jurisdiction counts — so there is nothing for `jurisdictionFor` to
assign by position; §88 has nothing to seed on here. Blending it into
a real jurisdiction's NYGS rate would also average two different
grains measuring different-aged populations, which is a worse
mistake than leaving them separate.

So `gangPacks.SELF_REPORT_REFERENCE` carries the finding as flagged
data, and `describeUndercountCaveat` reports it ALONGSIDE a real
jurisdiction's NYGS rate, never blended into it — the caveat that
every real NYGS-derived rate this module reads is likely a floor,
attached to the number rather than left in a comment where the
fourteenth rule's "a warning is not a guard" would apply again.

Also checked at the same time, with a real, concrete, negative
result: RAND's actual LA County Sheriff's Department research is
about DEPUTY gangs/cliques inside the department (a real, separate,
well-documented scandal — "Vikings," "Banditos," and so on), not
inmate or street gangs, and even that report says membership counts
are unknown. The last LA County gang-membership snapshots found were
one-time historical figures (a 2000 DOJ count and a 2007 City of LA
estimate) — old, uncorroborated by anything current, and not wired in
for the same staleness reason NYGS itself is already flagged for.

**Jail/prison gang (STG) classification data — checked directly,
also a real no, and a worse one than CalGang.** CDCR abandoned its
validation-based indefinite SHU isolation approach in 2012 after
*Ashker v. Brown* successfully challenged it as a due-process
violation; the only public figure is a single 2012 press snapshot
(~3,100 STG members/associates, ~20% formally validated), not a
dataset. LA County's own Office of Inspector General found the
Sheriff's Department has a "confusing collection of databases and
processes" for jail statistics and recommended NOT releasing numbers
until their accuracy could be confirmed. This is the CalGang pattern
one level deeper into the system — individual custody-classification
data, restricted for the same safety reason, with an oversight body
actively flagging it as unreliable rather than merely non-public.
Nothing wired in; nothing fabricated.

**A thirty-seventh, closing the DHS/CBP migration-pathway statistic
offered and approved, and the first real source in this registry with
no geography of its own.**

Asked for "how people are crossing the border" reframed correctly as a
statistics question rather than an operational one: DHS's Yearbook of
Immigration Statistics (real annual LPR admissions by country and
category) and CBP's own Enforcement Statistics (real encounter counts
by sector and nationality) are the real, citable answer. Neither
publishes a single "predominant pathway" per ancestry group — that is
one step of generalisation this project took itself, the same shape
`religionImport.TRADITION_MAP` already takes, anchored to specific,
checked, real facts rather than assumed: Somali and Bosnian read as
`refugee-asylee` (documented federal refugee resettlement, the same
two examples that approved the ancestry work itself); Haiti as
`humanitarian-parole` (TPS since the 2010 earthquake, named in the
2022-23 CHNV parole process); El Salvador's TPS population is the
largest of any country, dating to 2001; Mexico and the Northern
Triangle (newly added to `ancestryPacks.GROUPS` for exactly this) as
`mixed`, the nationalities CBP's own statistics name most often
alongside substantial long-standing family-sponsored admissions;
Asian-Indian as `employment-based`, one of the most consistently
documented H-1B/EB patterns on file; most legacy European ancestries
as `legacy-not-applicable`, because ACS ancestry counts everyone who
REPORTS an ancestry, the overwhelming majority of whom are many
generations removed from any migration event — a pathway classification
would misdescribe most of the people in those groups.

**`migrationPathwayPacks.js` has no `validatePack`/`assertPack`/
`packFor`/position assignment, and that absence is the point, not an
omission.** Every other pack in this registry reads per-LOCATION data
assigned by §88 position. This source has no location at all — DHS/CBP
publish by country and year, not by U.S. tract or county, so there is
nothing to assign a position to. It is a static, cited reference table
keyed on `ancestryPacks.GROUPS`, checked against that list at load
time (a group here that is not a real `ancestryPacks.GROUPS` entry
throws immediately, the same drift-prevention `religionPacks.js`'s and
`gangPacks.js`'s cross-checked vocabularies already hold elsewhere).

**Reported through `demographics.compositionOf`'s ethnicity block
(`dominantPathway`), not through `statistics.js`.** Every unit in that
catalogue is numeric; a pathway classification is categorical, and
forcing it into a share or an index would misrepresent what it is.
`compositionOf` already carries nested, non-scalar fields this way
(`education.meanLevel` alongside its diversity and dominant share), so
this follows that precedent rather than inventing a new unit type.
`npc.ethnicity` itself is still read by nothing that decides an
outcome — `migrationPathwayPacks.js` never touches the field directly,
it only maps a group NAME to a classification, and the one place that
calls it (`demographics.js`) was already the sole permitted reader.

**A thirty-eighth, from being asked to go a step deeper on tribes,
sects and political subcultures — three real, two declined, and one
unrelated defect found along the way.**

**African ethnic/tribal composition** is real as a fact about the
COUNTRY and not real as a fact about the American population this
engine models — Census ACS ancestry data (B04006) tracks country of
origin, never sub-national tribe, so there is no U.S. per-tract
source to name Hausa-Fulani/Yoruba/Igbo shares within Nigerian-
American ancestry specifically. `nigerian`/`ethiopian`/`ghanaian`/
`kenyan` were split out of `subsaharan-african` into their own
`ancestryPacks.GROUPS` entries, and `africanEthnicGroupPacks.js`
reports each country's own documented composition (CIA World
Factbook-style figures) — a fact about the country, reported through
`demographics.compositionOf` exactly like `dominantPathway`, never a
claim about any one generated person's tribal affiliation.

**Sunni/Shia is real, and checked directly rather than assumed to
exist.** The U.S. Religion Census reports Muslims as one undifferentiated
category at the county level in every edition (2000, 2010, 2020) —
there is no county-level sect split anywhere in that source. Pew
Research's own national surveys of American Muslims DO ask this
directly, but only nationally, and the published shares move
noticeably between survey waves (2007: ~50% Sunni/16% Shia; 2011: 65%
Sunni/11% Shia) — `islamicSectPacks.js` uses the 2007 wave's actual
published numbers rather than averaging the waves into an invented
blend neither survey published. `npc.islamicSect` is a new per-NPC
field, drawn only when a real religion pack resolves `religion` to
`'muslim'`, and holds the exact §9 firewall `npc.ethnicity` already
holds — enforced by `test/islamic-sect-packs.test.js`'s own copy of
`test/ethnicity.test.js`'s forbidden-file scan, not left to a comment.

**U.S. political ideological factions ("neocon" and similar labels)
were declined, not researched and then declined — there is nothing
to research.** Party registration and county vote share are real and
already wired (`politicalPacks.js`). A finer ideological label like
"neocon" has no operational definition any survey counts against —
unlike Sunni/Shia, which Pew asks directly, no comparable national
survey asks Americans to self-identify into factional labels like
this one, and the term itself is used inconsistently even in its own
usual context. The real analogue, if this is wanted later, is Pew's
own published political typology (named, survey-derived ideological
clusters, re-run periodically) — a different and considerably more
defensible category than inventing one.

**Israeli domestic politics and the secular/religious Israeli divide
were declined outright, on scope grounds rather than a data gap.**
Every real source in this registry — Census, HUD, FBI/NYGS, DHS/CBP,
Pew — is about the United States, because this engine generates one
U.S. region per world; it has no concept of a non-U.S. location to
attach foreign domestic politics to in the first place. Beyond the
scope mismatch, modelling a live, actively contested foreign
political and religious fault line onto generated people who are also
subject to this engine's own crime/death/disease mechanics is a
sharper version of the tension `religionPacks.js`'s own header already
raised once about U.S. religion, and unlike Somali/Bosnian refugee
resettlement (a settled historical fact), there is no settled,
uncontested version of this one to report.

**A real, unrelated defect found while checking how `ethnicity`
persists, not fixed here.** `migrate.js`'s `INSERT INTO npcs` names
`name` and `ethnicity` columns; neither exists on `npcs` in
`VACANCY_POSTGRESQL_SCHEMA.sql`, and `name` does not exist on
`entities` either. Against a real Postgres instance this would throw
on every single NPC, which is likely why it has never been caught —
Postgres has been unreachable from this environment for the life of
this project, the same condition `restore.js`'s own header already
names for a different defect.

**Correction, checked directly rather than trusted from this entry's
own words (13 Nov 2026): this claim is stale and the real defect it
describes does not exist.** Both columns are real, confirmed directly
by reading the file rather than assumed from this note:
`server/schema-extensions.sql` (NOT the locked base schema,
`VACANCY_POSTGRESQL_SCHEMA.sql`, which this entry correctly says has
neither) adds `ALTER TABLE npcs ADD COLUMN IF NOT EXISTS name TEXT;`
and, separately, `ALTER TABLE npcs ADD COLUMN IF NOT EXISTS ethnicity
TEXT;` — both already real when this correction was written, not
added by it. `test/migrate.test.js`'s own structural assertion ("every
column `schema-extensions.sql` adds is written by the migration")
and `test/restore.test.js`'s real round-trip check both already pass.
The error here was mine, not the code's: checking only
`VACANCY_POSTGRESQL_SCHEMA.sql` at the repo root and missing
`server/schema-extensions.sql` in the subdirectory entirely — the
exact "citation is not presence" lesson this file opened with, aimed
at my own re-reading of an old entry instead of at the code. Left in
place rather than deleted, per this file's own rule that a correction
is appended, never a silent rewrite. Flagged rather than fixed: `islamicSect`
was deliberately NOT added to this same broken INSERT, so it doesn't
compound this, and it stays in-memory-only, the same documented
posture `npc.ethnicity` already has.

**A thirty-ninth, and it is the decision this project's entire real-
data discipline has been implicitly deferring: whether to expand
beyond the United States at all.**

Every real source wired before this point — Census, HUD, FBI/NYGS,
DHS/CBP, Pew, CDC, NOAA, FEMA — is U.S. federal or U.S.-focused
academic data, because this engine generates exactly one region per
world (`migration.generateRegion`, called once in `worldgen.js`) and
nothing in it has ever had a concept of a non-U.S. location. Asked
directly whether to expand to other countries — militaries, first/
second/third-world realism, war-level chaos, realistic landscape —
the choice was made explicitly to expand, not assumed.

**`countryPacks.js` is the first real step, not the whole thing, and
says so.** It carries a real, cited income level (World Bank's own
current classification — the real, standard replacement for the
retired Cold War "first/second/third world" framing, which measured
political alignment, not poverty), conflict level (UCDP's own
distinction between nationwide state-based war, localized conflict,
high non-state/cartel-style violence, and none), and government type,
for 35 named countries keyed on `ancestryPacks.GROUPS` — not all
190-odd countries on Earth, and not claimed to be. Attached to a
region via an optional `countryKey` on `migration.generateRegion`,
in-memory only (no `country_key` column), reported and nothing more.

**Deliberately NOT wired into `authority.js`'s regime system or
`environment.js`'s weather, for the exact reason `crimeHotspotPacks.js`
stayed out of the violent-crime mechanism.** Both were calibrated
through measured, written-down work (the seventeenth and twenty-
eighth standing rules); a real conflict-level multiplier dropped in
without equivalent measurement risks re-breaking exactly the balance
that work fixed. That wiring is a real, separate, future round with
its own calibration pass — this round is the real reference data
existing first, same order every other extension here has followed.

**Two things asked for in the same breath were declined outright,
not deferred — see the thirty-eighth rule's shape repeated here.**
Occupation tied to ethnicity (a "Mexican police officer," a "black
influencer" as their own categories) stays declined: occupation is
drawn independent of ethnicity by design, and §9 forbids a demographic
determining a person's role. Modelling which real ethnic groups or
countries are "in conflict" or do not "coincide" with each other as a
mechanic feeding this engine's own violence generator stays declined
too — a sharper version of the tension already named for Israeli
politics, now at the level of entire peoples rather than one country's
politics, and there is no settled, uncontested version of that claim
to report the way Somali/Bosnian refugee resettlement is settled
history.

**What real occupation and "chaos bar" coverage already existed,
pointed to rather than rebuilt.** SOC major group 27 (Arts, Design,
Entertainment, Sports, and Media) is already wired in `labourPacks.js`
onto `athlete`/`reporter`/`curator` — entertainers and performers are
already real, BLS-sourced occupations, generalised the same way every
other SOC major group here is. `authority.js`'s governed/contested/
lawless regime, `crime.js`'s per-community danger score, and
`statecraft.js`'s stability bands are, between them, the "chaos bar"
already asked about — a war-torn place already reads as more chaotic
under the existing mechanics once real inputs (like `countryPacks.js`'s
conflict level, once calibrated in) feed them.

**A fortieth, and it is a correction to the thirty-eighth rule's own
mistake, plus the principled line that mistake obscured, plus one
more real source checked and wired.**

**The "secular vs. religious Israeli" ask was wrongly declined.**
What was actually asked for — real representation of secular and
religious Jewish identity — is not Israeli domestic politics at all.
It is the same real, Pew-surveyed American demographic split
`islamicSectPacks.js` already built for Muslim Americans, one
tradition over: Pew's "Jewish Americans in 2020" survey reports
Reform (37%), Conservative (17%), Orthodox (9%), other (4%) and "no
particular branch" (32%) — "no particular branch" being Pew's own
term for what gets called secular colloquially.
`jewishObservancePacks.js` builds this, same shape, same firewall.
The earlier answer folded two different questions together and
declined both; only one of them should have been declined.

**The line on inter-group conflict is narrower than "decline it," and
worth stating precisely rather than repeating the blanket version.**
Real representation of tribes and sects — Hausa-Fulani/Yoruba/Igbo in
Nigeria, Reform/Conservative/Orthodox among American Jews, Sunni/Shia
among American Muslims — is built, real, and reported, exactly like
every other demographic fact in this registry. What stays declined
is narrower and specific: making a real-world group pairing (which
tribes, which countries) an INPUT that shifts an individual NPC's
modelled probability of violence. That is the literal text of §9 —
"demographics... must never determine an NPC's morality,
criminality... or worth" — applied here exactly as it is already
applied, with a test, to `npc.ethnicity`, `npc.islamicSect` and
`npc.jewishObservance`. The two cases are not parallel: two NPCs
fighting because of their own relationship history (trust, rivalry,
strain) is the existing mechanism, blind to ethnicity for every NPC
regardless of group; wiring a group-pairing multiplier into that
same escalation would make ethnicity the reason, for the first time
in this registry, which is the one thing every other demographic
dimension here has been built specifically to avoid doing. Real,
documented historical fact ABOUT groups or places remains entirely
fair game to report — the line is reporting a fact versus using it to
decide an outcome, the same line this file draws everywhere else.

**`regionalTemperamentPacks.js` closes the "does a New Yorker have a
different temperament than someone in Iowa" question with a real,
peer-reviewed answer**: Rentfrow, Gosling & Potter's "Divided We
Stand" (JPSP, 2013) surveyed over half a million people and found the
contiguous U.S. clusters into three real psychological regions —
Friendly and Conventional (Great Plains/South), Relaxed and Creative
(the coasts), Temperamental and Uninhibited (the Northeast). Reported
on the region via an optional `temperamentKey`, exactly the same
posture `countryPacks.js` took and for the same reason: `Aggression`
and `Volatility` are real, existing trait names, and `Aggression`
specifically feeds `keys.resolveAggression` — the seventeenth
standing rule's four-attempt calibrated escalation system. Wiring a
real regional bias into that trait's draw without equivalent
calibration work is the third time this session has named that exact
risk (`crimeHotspotPacks.js`, `countryPacks.js`, now this), and it
stays a separate, future round each time for the same reason.

**Forty-first: "collect real data from around the world... do
military... oil data... specific political parties" extended
`countryPacks.js` with three more real, cited, confidence-flagged
fields rather than three new modules**, because these are facts about
the same 36 countries `countryPacks.js` already names, not a new
dimension needing its own vocabulary. `regimeType` (EIU Democracy
Index 2024, four published bands: full/flawed/hybrid/authoritarian)
is the deliberate, honest substitute for "specific political
parties" — a currently-ruling party goes stale at the next election
and could not be verified with confidence across three dozen
countries from here, while a country's scored democratic character
is durable and stable. `militaryExpenditurePctGDP` is confidence-
flagged per entry: only Russia (7.1% of GDP) and Ukraine (34%, the
highest in the world) are SIPRI's own published figures; every other
value present is a third-party estimate `confidence:
'secondary-estimate'`, never presented as equally solid. `oilProducer`
is `null` for the great majority of entries on purpose — Norway,
Russia, Nigeria, Mexico and the United States are real major
exporters with real 2024 EIA figures; forcing a number onto every
other country would misstate them, and China is explicitly `null`
despite large domestic production because it is the world's largest
net crude IMPORTER, not an exporter. Somalia's `regimeType` stays
`null` because no EIU score for it was found — not guessed from
its neighbours or its conflict level. All three fields are wired into
`migration.generateRegion` the same report-only way `incomeLevel`/
`conflictLevel`/`governmentType` already were, with the same
in-memory-only, no-schema-column posture, and the same deliberate
absence from any calibrated mechanic.

**Forty-second: three real builds answering "do all of them" — all
occupations including entertainers, and a direct challenge on why
Israel got skipped when the United States didn't.**

`occupations.js` gained three real occupations — `entertainer`
(singers, actors, movie stars, all at the one grain `athlete` already
covers every sport at), `influencer` (the "no institution, no
credential" shape `athlete`/`enforcer` already hold), and `politician`
(an elected officeholder, available to `government` but deliberately
NOT replacing `diplomat` as that organization type's `DEFINING_POST` —
diplomacy is a narrower, different real role). "Mexican police" needed
no new occupation: `enforcer`/`officer` already exist and are not
ethnicity-gated, so they already generate for any NPC regardless of
ancestry context.

**Israel was missing from `countryPacks.js` for a structural reason,
not a political one, and saying so plainly matters more than fixing
it quietly.** That table is keyed on `ancestryPacks.GROUPS`, and there
was no `israeli` group in that vocabulary — the earlier Jewish-
observance work (`jewishObservancePacks.js`) answered a RELIGION
question (Reform/Conservative/Orthodox), never a nationality/ancestry
one, so it never created this key, while `united-states` was always
an explicit hardcoded baseline outside the ancestry-group vocabulary
entirely. Checked directly before building: Census ACS table B04006
reports "Israeli" as its own named ancestry code (variable
B04006_050E), the same kind of real, already-existing source code
`nigerian`/`ethiopian`/`ghanaian`/`kenyan` were split out from before.
Israel's entry carries EIU Democracy Index 2024 (7.80, flawed
democracy, rank 31/167 — confirmed directly), SIPRI-adjacent military
expenditure (8.8% of GDP, 2024, world's second-highest after Ukraine,
flagged `secondary-estimate` like most of this table), and
`conflictLevel: 'active-armed-conflict'` — checked the same direct way
Russia/Ukraine's was: UCDP's 2025 report counts Gaza among its
state-based conflicts and ACLED separately rates it "Extreme"
severity, real and current, not a judgement call, though no single
citable UCDP conflict-ID was found and that gap is stated rather than
papered over. `oilProducer` stays `null` — Israel is a real natural
GAS producer/exporter (Leviathan field), a different resource than
this field tracks, not the same fact understated.

**`politicalTypologyPacks.js` is the real, durable substitute for
"different types of American politicians... neocons, Republicans,
different organizations"** that the thirty-eighth standing rule left
unbuilt. "Neocon" was never built because it has no survey behind it
— no polling organisation measures who is or is not one, unlike
Sunni/Shia or Reform/Conservative/Orthodox, which this registry
already reports from real surveys. Pew Research's own Political
Typology is the real, rigorous, nonpartisan answer: nine named groups
from 30 questions on social/political values, not party registration.
**Checked directly rather than assumed from memory**: a 2021 wave
(Faith and Flag Conservatives, Progressive Left, etc.) was what came
to mind first, but Pew published a fully revised NINTH edition on 10
June 2026 — "Beyond Red vs. Blue" — that supersedes it with nine
different named groups (Leftward Progressives 7%, Loyal Liberals 11%,
Left-Out Left 12%, Order and Opportunity Left 18%, Tuned-Out Middle
9%, Pragmatic and Polite Right 11%, Unconventional Right 12%, Faith
First Conservatives 12%, No Apologies Right 9%). Using the 2021 names
would have been exactly the stale-data mistake this project already
corrects elsewhere. `npc.politicalTypology` is drawn unconditionally
— unlike `islamicSect`/`jewishObservance`, there is no upstream real
field to gate it on, which is stated as an honest limitation (this
reports the U.S. adult public's distribution for every generated
person) rather than hidden. Same §9 firewall, same `demographics
.compositionOf` reporting, same in-memory-only posture as every other
field in this family.

**A forty-third, closing three real sources `world-layer/sources.js`
had already built and tested as real, declared-consumerless
transforms — the same category `usgsImport.js` itself sat in before
this round, and found by asking directly whether those three had a
real join waiting the way the twenty-seventh rule's trio did.**

**`world-layer/imports/gladImport.js`'s real global forest-cover
reading closes a comment, not a gap this file invented.**
`worldgen.js`'s own header already named the problem: the city-
resource loop's canonical list was once `['food','water','medicine',
'energy','timber']`, and `timber` "is not a §28 resource type at all
(the spec says `wood`)" — checked directly before writing
`server/woodPacks.js`, rather than trusted from that comment, which
was itself a citation-is-not-presence artefact one layer further in.
`wood` is real, generated on every city since Phase 1, and drawn from
an invented `[60, 140]` supply band with no citation. `woodPacks.js`
re-centres that band on a real tree-cover percentage the same way
`incomePacks.js` already re-centres home value — and a `lost-forest`
plot (forest that stood in 2000 and was cleared since) reads as 0%
effective cover for TODAY rather than its stale baseline, because the
stock it would describe is gone.

**`world-layer/imports/earthenvImport.js`'s Consensus Land Cover has
no VACON-C consumer, and `landCoverPacks.js` does not invent one** —
same posture as `usgsImport.js`'s own elevation import before this
engine had a terrain mechanic. `city.landCoverClass` is stored
directly, read by nothing. **Deliberately kept out of
`statistics.js`, not just out of a behavioral mechanic** — every unit
that catalogue uses is numeric or ordinal (count, currency, index,
share, tier, years, checked directly), and a twelve-class label has
no honest place in it, the same reasoning `migrationPathwayPacks.js`
already gives for keeping `dominantPathway` out of it too.
`climatePacks.js`'s own `regions.climate_key` is the real precedent
for a categorical geographic fact, not `politicalPacks.js`'s
`political_lean`.

**`world-layer/imports/earthEngineImport.js`'s real VIIRS nighttime-
light reading compounds into `incomePacks.valueRangeFor`, the same
shape `populationPacks.overdoseBaselineFor` already takes compounding
with `healthBaseline` in `mortality.diseasePressure`** — a second,
independent real signal of the same underlying fact real income
already measures, not a new relationship to invent.
`nightLightsPacks.activityMultiplierFor` is bounded
(`ACTIVITY_MULTIPLIER_BOUNDS`) so a very dark or very bright reading
narrows the income-based range rather than overwhelming it, the same
caution `crimeHotspotPacks.weightFor` already applies multiplying a
real external weight into an internal one. `valueRangeFor`'s new
`activityMultiplier` option defaults to 1 — every existing call site
is unaffected, checked by running `income-packs.test.js` unchanged
before adding a line.

**A forty-fourth, closing the question the forty-third rule's own
land-cover section left open on purpose.** That section declared
`city.landCoverClass` deliberately unwired — no crop yield, fire-risk
or building-cost mechanic had been asked for, and inventing one would
have been fabricating a mechanic nobody requested. Asked directly
whether to wire it in anyway, into wood supply and home value
specifically, the answer was yes to both — not a reversal of the
reasoning, an answer to the one question that reasoning had
deliberately left open.

Both nudges land the same way every multi-signal pack in this
registry does: bounded (`±15%`, `WOOD_MULTIPLIER_BOUNDS`/
`HOME_VALUE_MULTIPLIER_BOUNDS`), compounding onto an existing real
signal rather than replacing or inventing one, and defaulting to `1`
so every pre-existing call site is unaffected. `woodPacks.
woodSupplyRangeFor`'s new `landCoverMultiplier` option and
`incomePacks.valueRangeFor`'s new one (joining `activityMultiplier` as
a third independent compounding signal) are both the same shape
`nightLightsPacks.activityMultiplierFor` already established.

**Only the two directions this file's own reasoning can actually
defend were built, not a continuous scale for every class.**
`landCoverPacks.woodMultiplierFor` corroborates on the five real
forest classes and damps on the other seven — there is no published
ratio between a land-cover class and a wood yield to scale by, the
same "no cited ratio" posture `woodPacks.js` itself already takes
scaling GLAD's own continuous percentage. `landCoverPacks.
homeValueMultiplierFor` moves exactly three classes:
`urban-and-built-up` up (real infrastructure and amenities),
`regularly-flooded-vegetation` down (the documented flood-plain
discount: insurance cost, building restriction), and `snow-and-ice`/
`barren` down (extreme or undeveloped terrain). The other eight
classes — every vegetation class not already forest, plus cultivated
land — stay at `1`. Whether a wooded or rural setting raises or lowers
a home's value has no equivalent well-established, one-directional
real-estate fact the way those three do, and this file's own
thirty-third rule already names the cost of asserting a causal
mechanic this project has no research behind: inventing a direction
for those eight would have repeated exactly the mistake the land-cover
section's original header was written to avoid, just a few paragraphs
after re-opening it.

**A forty-fifth, closing the four real demographic sources approved in
an earlier round and left unbuilt as their own "new per-NPC field"
complexity class — race, marital status, disability and veteran
status, all real Census ACS tables with no VACON-C reader until now.**

`server/racePacks.js` (table B02001) and `server/maritalStatusPacks.js`
(table B12001, population 15+) are the categorical `cutsFor` shape
`ancestryPacks.js`/`religionPacks.js` already established, read onto
two NEW fields — `npc.race` and `npc.maritalStatus` — rather than
reused existing ones. **Race is deliberately not folded into
`npc.ethnicity`**: ACS asks race and ancestry as two separate
questions, and a person who answers "Mexican" to one and "White" to
the other is answering both honestly, not contradicting either — the
same distinction `jewishObservancePacks.js` draws giving branch its
own field alongside `religion` rather than overloading it.
`server/disabilityPacks.js` (table B18101) and `server/veteranPacks.js`
(table B21001, civilian population 18+) are a simpler shape than
either: ACS reports each as ONE real share, not a vocabulary of more
than two outcomes, so `hasDisabilityFor`/`hasVeteranStatusFor` are a
weighted coin flip against a real local rate — the same single-number
shape `nightLightsPacks.activityMultiplierFor` already takes, not the
multi-category machinery a real vocabulary needs.

**Marital status and veteran status are gated on the same adult
threshold `education` already uses, for the same reason.** ACS
publishes marital status for population 15+ and veteran status for
the civilian population 18+; this engine has no concept of a married
or veteran child in any of its own generators, and drawing one would
assert a fact ACS itself does not measure. Both fields are set `null`
in the initial `generateNPC` call and resolved only inside the
existing `if (age >= 18)` block education already uses — `null` for a
child carries the same meaning `education`'s own header already
argues for: not "unmarried"/"not a veteran", simply a question that
does not apply yet. Race and disability carry no such gate — ACS asks
both at any age, so both are drawn unconditionally in the initial call
alongside `ethnicity`.

**Same §9 firewall discipline as every per-NPC real field before it,
and the same proof.** Each of the four new fields gets its own test
file holding a copy of `test/ethnicity.test.js`'s forbidden-file scan
— `race-packs.test.js`, `marital-status-packs.test.js`,
`disability-packs.test.js`, `veteran-packs.test.js` — asserting that
no generator of crime, policing, wages, mortality, traits or any other
outcome reads the new field, and that `demographics.js`'s composition
statistic is the only reader. `world-layer/imports/censusImport.js`'s
own `importAcsTract` was extended with the same four real ACS tables,
writing shapes onto a PLACE exactly as it already does for age,
household size, attainment and income — never a per-person fact, the
same §9 note that file's own header already carries.

**A forty-sixth, closing the one real source `world-layer/CLAUDE.md`'s
own thirtieth standing rule named and explicitly deferred as its own
round: Overture building footprints.** Every other pack in this
registry is assigned one real row per city or community; a building
is a fact about ONE structure, and this engine generates far more
homes than communities, so there was no fixed `c`/`b` multiplier to
derive a position from. `server/buildingPacks.js` closes it with a
running count of homes actually built in the generation loop — one
level finer than every pack before it, still standing rule 8 (§88),
just counted differently.

**A pack is scoped to ONE real property type, and a building of a
KNOWN, disagreeing type is refused rather than silently used** — the
same "a pack is refused, never partly used" discipline every reader
here holds, applied to the building's OWN recorded fact rather than to
the pack's shape. A building Overture never classified is tolerated,
since Overture does not classify every footprint, and that is a real
property of the source rather than a defect. `world-layer/
exportRegionStats.js#exportBuildingPack` is the writer that filters a
region's real buildings down to one type before this reader ever sees
them.

**Height is read by nothing, and that is declared rather than
quietly dropped.** Overture carries a real `heightMetres` per building
and `property.js` has no height column; wiring it in with no consumer
would be the eleventh standing rule's own trap, so `heightMetresFor`
exists for a future caller and nothing stores it on a generated
property this round. `landSize` and `floors` ARE wired, because
`property.js`'s own existing fields consume them immediately — the
same "replaces an invented value a real consumer already reads" shape
every other wired pack in this file takes.

**A forty-seventh, and it is the only one of these that reopens a
locked scope line rather than finding a gap inside it.** Leader mode —
named in this file's own "Locked Day 1 / Phase 1 scope" section as
"Explicitly deferred — do not touch" since the project began — was
reopened by explicit human instruction on 5 Nov 2026, scoped to exactly
what was asked for: one embodied avatar throughout, who can direct or
influence other characters once that avatar actually holds a real seat
of authority.

The schema's own one-line plan for the mode (`players.linked_entity_id`'s
comment: "organization for Leader mode") was never built against — a
plan, not a shipped contract — and this build deliberately diverges
from it, on instruction: `linked_entity_id` stays an NPC in Leader mode
too, same as Citizen mode. The player does not become an abstract
organization; they stay the one person they always were, who now holds
a real seat. "Leader" and "influencer" are not new concepts either —
both are `organizations.leader_id`, already real, already written at
generation, already moved by `control.js` on takeover and cleared by
`succession.js` on death, read live rather than cached on the player
record (the ninth standing rule, applied to authority instead of
traits). `server/leadership.js` is the new module and its own header
carries the rest of the design, including the one real decision that
had to be made rather than found: directing a subordinate is a real
probability draw against their own `relationships.loyalty`, never a
guaranteed command, for the same reason meetings.js's own header gives
for not inventing a persuasion modifier — a mechanic that always
succeeds asserts something nobody measured.

`server/actions.js`'s existing 17 verbs all gained `'leader'` alongside
`'citizen'` in their `modes` array — a leader is still a person who can
accept a mission or hold a meeting — and two genuinely new verbs,
`direct-mission` and `broadcast-message`, are `'leader'`-only, because a
citizen has no subordinates to direct and no outlet to broadcast
through. `GET /api/players/:id/leader-dashboard` is
`VACANCY_API_ENDPOINT_MAP.md`'s own named, never-built route, built for
the first time here. A directed mission is still the one real mission
state machine `missions.js` already has — `directMission` composes
`generateMission` then `acceptMission` rather than fabricating an
already-accepted row by hand, so it still pays through the one real
`payReward` path and still obeys "a mission is never about nothing."

**A known, stated limitation, not a silent gap**: there is no automatic
demotion back to Citizen mode when a leader is overthrown, succeeded, or
their organization dissolves. `getLeaderDashboard` re-checks
`organizations.leader_id` live on every call and throws a clear, specific
error the moment it no longer holds, rather than showing stale command —
but `player.mode` itself stays `'leader'` until something explicit moves
it. Wiring that into `succession.js`'s own `leader_id`-clearing path is
real, separate, future work.

Simulation and Multiplayer modes remain deferred and untouched — only
the one mode named in the instruction was reopened.

**A forty-eighth, and it is two things built together because the
second was always going to gate the first: an influence economy over
two real, dormant schema columns, and character creation, built by
explicit instruction on 5 Nov 2026.**

`relationships.influence` (NUMERIC DEFAULT 0) and `families.
political_influence` (NUMERIC DEFAULT 0) had been in `VACANCY_
POSTGRESQL_SCHEMA.sql` since this project's first version, read or
written by nothing beyond their own generation-time default —
`grep -rn "\.influence\b" server/*.js` before this returned exactly one
place either was ever touched, and that was `migrate.js`'s own
round-trip persistence reading back whatever was already there.
`server/influence.js` is what finally reads and writes them for real.

**The first version of this would have started every brand-new
relationship at a flat 0, and a direct correction arrived before it
shipped: starting influence has to vary by real, existing statistics —
a gang leader starts with meaningfully more real influence than a
janitor, derived from stats the engine already has, never an invented
flag.** `influenceRatingOf(worldState, entityId)` is the real, derived,
NEVER-STORED rating that closes this (standing rule 3's own treatment,
exactly what `getNetWorth`/`getFamilyWealth` already get) — three real
components, weighted to sum to 1.0 so the result stays on the same
0-100 scale every other relationship dimension uses: occupation tier
(`occupations.tierOf`, 0.3), real organization leadership scaled by
that org's own `influence` column and real member count
(`membership.memberCount`, capped at 20 the same order of magnitude
`meetings.js`'s own `MAXIMUM_ATTENDANCE` draws the "crowd, not a
leadership" line at, 0.4), and real social traits — Charisma,
Persuasion, Reputation, Network Reach, averaged, defaulting to the
trait scale's own centre (50) when none have been generated, never a
zero (0.3). `raiseInfluence`/`lowerInfluence` apply this rating to seed
a pair's relationship the FIRST time it is ever touched, rather than
leaving `worldStore.getOrCreateRelationship`'s own generic default
underneath a real event — `worldStore.js` itself is unchanged, so
every other caller keeps the exact behaviour every existing test
already asserts about it.

**Influence moves down from real actions too, not only up — the
second half of the same correction.** `relationships.influence` is a
SINGLE SHARED VALUE per pair, the same model this engine already uses
for `trust`/`respect`/`loyalty` — `leadership.js`'s own `directMission`
already reads a subordinate's `loyalty` "toward their leader" from
that same single-field, order-independent table, which is the
precedent followed here rather than inventing a second, directional
influence table the schema does not have. One consequence worth
stating plainly: a contest's resolution calls `raiseInfluence(winner,
loser)` exactly ONCE, never a second, opposite-signed call for "the
loser's influence falls" — that second call would cancel the first on
the identical stored field, which is a mistake worth naming rather than
silently almost making. Three other real events now move it down for
real: a refused `direct-mission` order (on BOTH its paths, see below);
a `meetings.js` `negotiate` between two people with real bad history,
on the same sign as the real (negative) `trustDelta` that purpose's
own `keys.feelingToward` call can already produce — checked directly
rather than assumed, and `recruit` was checked the same way and found
to have no contested branch in `PURPOSES` at all, so it only ever
raises influence, which is reported here rather than quietly inventing
a failure mode that purpose does not have.

**`leadership.js#directMission` gained a second real path, additive to
the org-leader one.** `organizationId` is now optional: given, nothing
changes (compliance still gated on the subordinate's real `loyalty`
toward their leader, membership still required). Omitted, there is no
organization and no membership check at all — compliance gates
instead on the pair's own real, growing `relationships.influence`
(or, for a brand-new pair, the acting entity's own `influenceRatingOf`).
Either way the gate is `seededDraw` against the gating value mapped
straight onto `[0,1]`, never a fitted cutoff — the seventeenth standing
rule's own `resolveAggression` case study, applied before the mistake
could be made rather than after.

**`server/characterCreation.js#createCharacter` (`POST
/api/characters`) is the other half, built to the same brief: a player
picks a few real things, and everything else — especially family — is
randomly generated and REVEALED, never chosen.** Player-chosen:
occupation (validated through the exact real qualification gate any
NPC's own hire already goes through — `occupations.qualifiedFor`/
`tierReachable` — refused with a specific reason rather than a silent
fallback when no real employer exists or the character is not really
qualified), country (`countryPacks.js`'s own real keys — checked
directly and confirmed to have no structural link to this engine's own
generated cities, so this is real-world context, not geography), and
community (an existing real one, or a real random draw across whatever
the world actually has). Random and revealed: whether each parent is
alive or dead (a real draw, recorded through `mortality.recordDeath`
on the same real status transition and estate settlement any other
death in this engine goes through — never a second "is dead" flag); a
living parent's own real occupation, drawn the identical way any NPC's
is; a real sibling count; and real cousins — per explicit instruction,
each one a FULLY SIMULATED NPC, not a count. A cousin is the child of
the player's own living parent's own sibling, and that aunt or uncle is
a real NPC heading an ENTIRELY SEPARATE real family record of their
own, at its own real, independently-drawn (possibly different)
location — cross-linked to the player's own family through the
schema's own real `relationships.relationship_type` value `'family'`,
never a role invented on the wrong table. Grandparents, and any
generation beyond parents/siblings/cousins, are explicitly out of
scope for this round, named here rather than silently omitted.

**Why every generator `characterCreation.js` calls is INJECTED rather
than required** — `generateNpc`/`generateFamily`/`addFamilyMember`
have no separate module the way `missions.js` or `territory.js` do;
their real logic lives directly inside `engine.js`, which is this
file's own caller, so requiring it back would be circular. The exact
same seam `missions.js#resolveMission` already uses for `payReward`,
for the identical stated reason: keeping the module taking `worldState`
explicitly rather than reaching into the module that wraps it.

`GET /api/entities/:id/influence-rating`, `GET /api/entities/:id/
personal-influence` and `GET /api/families/:id/political-influence`
are real, computed reads, never stored — the same posture `GET
/api/entities/:id/net-worth` already has.

**Found live-verifying this, not in a fixture: the real player-facing
dispatcher still refused the path it was built to add.**
`leadership.js#directMission` makes `organizationId` optional, but
`server/actions.js`'s `'direct-mission'` verb still listed it in
`requires` and forced it through `Number(body.organizationId)` — so
every call through the one interface an actual player uses
(`POST /api/players/:id/action`) turned an omitted organization into
`Number(undefined)` (`NaN`) before `leadership.js` ever saw a real
`null`, and the dispatcher's own `requires` check 400'd the request
before that. The module-level function was correct and reachable only
by calling it directly — the eighteenth standing rule's own shape
("a fixture checks what a function returns; nothing checks what its
caller does with it") one layer closer to the player than usual, since
here the "caller" is the one route a real person calls through.
Fixed in `actions.js` itself: `organizationId` dropped from `requires`,
and passed through as `null` rather than `NaN` when omitted. Confirmed
live through the real dispatcher, not just the module: a leader with no
shared organization and a real `influenceRatingOf` of 44.5 complied
once end-to-end (`issuing_organization_id: null`, influence rising from
44.5 to 46.5), and a leader with a real, pre-existing zero-influence
relationship was refused deterministically with influence held at its
real floor.

**A forty-ninth, closing three concrete gaps the forty-eighth left
behind, plus the extension explicitly asked for once they were found:
"the user's family should have priority and have upper scales, but for
the game to be accurate... everybody, all the NPCs should advance so
all the worlds would advance accurately."**

**Gap 1 — the player's own parents and siblings had NO seeded
relationship at all, while cousins/aunts-uncles got one at the flat
schema default.** `grep -n "raiseInfluence\|lowerInfluence\|influence\."
server/characterCreation.js` before this returned nothing — the
forty-eighth's own `influenceRatingOf`-derived baseline was never
actually wired into `characterCreation.js`; every family link there
still called `worldStore.adjustRelationship(..., 'family', {})`
directly, and parents/siblings got no call at all. `influence.js#
seedFamilyBond(worldState, a, b, { immediate })` is the fix — seeded
once per pair (same `existedAlready` guard `raiseInfluence` already
uses), from the real `influenceRatingOf`, with `relationship_type:
'family'` (never `raiseInfluence` itself, which hardcodes
`'social'` — wrong for kin). `immediate: true` (parents, siblings)
adds `IMMEDIATE_FAMILY_BOND_BONUS` on top; omitted (cousins,
aunts/uncles), the baseline is untouched. The bonus is
`INFLUENCE_DELTA * 5` (= 10) — five real `INFLUENCE_DELTA`-sized
events' worth of closeness, named as a multiple of an already-justified
constant rather than an invented number, the same documentation
discipline `PARENT_DECEASED_CHANCE` already states its own figure with.

**Gap 2 — neither dashboard surfaced an entity's own `influenceRatingOf`
or `characterCreation.describeFamilyTree`.** Both
`players.js#getCitizenDashboard` and `leadership.js#getLeaderDashboard`
now carry `influenceRating` and `extendedFamily`, read live on every
call exactly like `netWorth`/`familyWealth` beside them (standing rule
3) — never cached from generation time.

**Gap 3 — `characterCreation.createCharacter`'s own return value was
the only place a family tree was ever reported, once, at creation.**
`characterCreation.describeFamilyTree(worldState, entityId)` is a new,
separate LOOKUP function (never a refactor of `createCharacter`'s own
return-construction code, which `test/characterCreation.test.js`
already asserts a specific shape against — `parents[].role` in
`['mother', 'father']` order, among others) that reads the same real
`family_memberships`/`relationships`/`families.head_npc_id` rows back
for ANY entity, live, whether or not they were ever created through
`createCharacter`. `GET /api/entities/:id/family-tree` (`server.js` →
`engine.getFamilyTree` → this function) exposes it.

**Gap 4 — extended family (siblings, aunts/uncles, cousins) existed
only for a player's own `createCharacter()`; every ordinary NPC
`worldgen.js` generates had none.** Read end to end first: ordinary
NPCs are assigned to a `familiesPerCommunity`-sized household roster
with a flat `'member'` role, round-robin, no parent/child/sibling
structure and no aunts/uncles/cousins at all — a different, much
simpler mechanism than `characterCreation.js`'s own generator.

**Measured before touching anything** (`node scripts/measure-world.mjs
--seed measure-gap4 --ticks 1`, the DEFAULTS-sized world:
1 city, 5 communities, 30 residents each): **150 people, 30 families,
0 extended family** — the same world every one of the 50+ test files
calling `worldgen.generateWorld()` already builds and asserts exact
counts against (`test/worldgen.test.js` itself asserts
`added.npcs === 24` on its own `SMALL` fixture).

**That measured fact is why this is opt-in** (`config.extendedFamily`,
default `false`) — the same posture every other real-data pack in this
file already has (`populationPack`, `religionPack`, `ancestryPack`,
`racePack`, ...): every existing call to `generateWorld()` omits it and
gets the byte-for-byte unchanged world those 50+ files already assert
against, rather than a silent default-on change rippling through
assertions this closure has no way to re-verify one by one. Turned on
(`--extended-family`, same seed): **183 people (+33, +22%), 46 families
(+16), 16 real aunts/uncles, 17 real cousins** — `summary.
extendedFamilyAdults`/`extendedFamilyChildren` report the real counts
either way, 0 when off.

**Reuses `characterCreation.generateAuntOrUncle` directly — now
exported — rather than a second copy of "a new NPC, a new family, a
cross-family `relationship_type: 'family'` link."** That function
gained one new optional parameter, `maxCousins` (default
`MAX_COUSINS_PER_AUNT_UNCLE`, so every existing caller is unchanged):
`worldgen.js` passes a tighter `maxCousinsPerAuntUncle` (default 2, vs.
character creation's own 4), because this runs once per FAMILY in
EVERY community a world generates, not once for a single player.
Generated **once per family, never per member** — an aunt/uncle
belongs to the family as a whole, and generating one for every sibling
would multiply the same two people once per child; `extendedFamilyChance`
(default 0.5) gates whether a given family gets one at all, using the
family's own just-computed `head_npc_id` as the aunt/uncle's sibling.

**No recursion, by construction rather than by a guard that could be
bypassed.** `generateAuntOrUncle` only ever calls
`generators.generateNpc`/`generateFamily`/`addFamilyMember` and
`influence.seedFamilyBond` — never `createCharacter` or itself — and
the loop that calls it iterates the community's own original `families`
array, built before this block runs, never the families this block
itself creates. Mutation-verified: temporarily made the block also
generate a second round of extended family FOR the aunt/uncle it had
just created (the exact bug this guards against) and confirmed
`test/worldgen.test.js`'s "never recurses" test catches it
(`extendedFamilyAdults` doubled, 24 vs. the expected 12) before
reverting the mutation.

**A fiftieth, closing four real gaps opened in the same round by
direct instruction: real weapons and finite, era-gated ammunition,
alt-policing where government does not reach, multi-faction heat, and
friends/classmates/associates surfaced on demand rather than
front-loaded.**

**Weapons and ammunition, kept separate on purpose, because the first
draft of this conflated them and was corrected before it shipped.**
`server/weapons.js` closes a gap `crime.js` had declared explicitly in
its own words: "no weapon exists anywhere in the schema... so nothing
distinguishes an armed offence from an unarmed one." `pistol`/`rifle`
are remnant-only, same reasoning `items.js` already gives gold ingots
and cut gems; `machine_gun` is remnant-only AND restricted to a
`government-building` in a region with a real, tracked
`countryPacks.militaryExpenditurePctGDP` — global by construction,
never a US-only ATF/FFL assumption, read through the one real chain
that already existed from a landmark to a country
(`properties.city_id` → `cities.region_id` → `regions.country_key` →
`countryPacks.countryFor`). `zip_gun`, the street-level firearm, lives
in `salvage.js`'s own `PRODUCTS`/`RECIPES` as a real Tier 2 craftable
— reusing that machinery rather than duplicating `canMake`/`make` — and
`weapons.js` only adds its name to the firearm vocabulary.
`auto_sear_switch` ("a switch") is a real, separate item that turns a
semi-automatic firearm's fire into `machine_gun`'s burst; it is
registered so the rest of the engine recognises it by name and
deliberately placed in no `discovery.js` loot pool at all — a real
thing this round does not build an acquisition path for, named rather
than left to look like an oversight. **Missiles and drones are
explicitly out of scope**, named as a real, deliberate boundary in
`weapons.js`'s own header rather than a silently missed request —
both are organisation/military-asset-tier capabilities that do not fit
the holder/item/quantity/equipped shape everything else here uses, and
drones specifically fall inside this file's own already-locked
Transportation deferral.

**A firearm with no held ammunition is a real object that does
nothing — `isFunctioningFirearm` is equipped AND a held round of its
own real ammunition, and this is the question `crime.js#recordEscalation`
now asks instead of a plain `inventory.hasEquippedCategory(...,
'protection')`, which would have called an equipped `shield` a gun the
day one existed and would have called an unloaded firearm armed.** An
unloaded gun falls back to whatever an unarmed offence would classify
as. `GUN_SEVERITY_RATIO` (`SEVERITY.gun / SEVERITY.violent`, measured
at ~1.14, not an invented "guns double everything" number) is reused
twice rather than guessed twice: `tick.js#GUN_CHAOS_MULTIPLIER` scales
how often an armed aggressor's flashpoint fires, and
`recordEscalation` scales severity again when a real switch turns the
burst up. Pinned with a boundary draw rather than a statistical trial
— the real multiplier is modest enough that a sample average would
need an impractical number of ticks to separate from noise with
confidence — a specific, found-not-chosen tick where the real seeded
draw lands between the unarmed chance and the armed one, so the
identical pair at the identical tick must flash when armed and must
not when unarmed (`test/tick-security.test.js`).

**Ammunition is finite from world start and manufacturing is real,
bounded and gated** — `MANUFACTURING_ERA = 'industrialization'`, the
first era on `technology.ERA_NAMES` with the industrial capacity a
cartridge factory needs, and `manufactureAmmunition` reuses the exact
real-employment-record gate `produce.js#harvest` already established:
a real `engineer` at a real `business`, one small bounded batch per
call, never a passive per-tick regen. `discovery.js`'s own
`'gun-store': null` entry — named in the type union, given no pool,
same as `landmarks.js` recorded it — is closed to `{ itemCategories:
['protection'] }`, with `weapons.RESTRICTED_DISCOVERY_NAMES` keeping a
`machine_gun` or the switch out of an ordinary civilian search even
though they share that category; `government-building`'s own existing
pool is the honest substrate for "a military/security installation,"
since `landmarks.js` has no separate military-base category and none
is invented here.

**Alt-policing: government does not have to be what polices an area,
and the real mechanism for the alternative was already half built
under a different name.** `server/authority.js` already computed a
real `governed`/`contested`/`lawless` regime per area, and
`server/justice.js#answerByGroup` already let the real faction holding
the ground (`authority.holderOf`) make real restitution, expel its
own, or start a real feud instead of nothing happening where the state
does not answer. Neither had ever been asked whether a LAWLESS area
with NO `public_safety` infrastructure at all could ever actually
reach either of them — and it could not: `policing.investigate` only
ever marks `cleared` from a `clearanceChance` that is a hard 0 against
a null `policingCapacity`, and `answerByGroup` only ever runs from
`runJustice`'s own `incident.cleared === true` filter. A gang holding a
block with no nearby government station forever could hold that
ground and never once get the chance group law already gives it. This
is the fourteenth standing rule's own shape one file over: a threshold
(clearance) gating a mechanism (group law) sat entirely behind a gate
(government capacity) that the mechanism exists specifically to answer
the absence of.

`policing.factionCapacityOf` is the fix, and it adds no new mechanism
— it gives clearance a second real source. A faction that actually
holds this ground has its own real capability derived the identical
way `authority.gripTerm` already rates a hold: the faction's own live
`organization.power` trait, scaled by the same
`fortified`/`controlled`/`contested` block-status weights `gripTerm`
already uses, for the identical reason a fortified gang enforces
harder than a merely controlled one. `investigate` now reads
`Math.max(governmentCapacity, factionCapacity)` (treating either
`null` as absent, not zero) rather than government capacity alone, so
a case in a lawless area with a strong holding faction can finally be
cleared and reach `answerByGroup` the way the model always intended.
**A stated real limitation, not blurred over**: the `TRUST_BELIEF`
("trust in public safety") this file moves is a belief about the
STATE's own police, and a faction-only clearance (no government
infrastructure existed here at all) does not move it — conflating the
two would be reporting a belief about an institution that had no part
in the event. Mutation-verified: temporarily removed that gate and
confirmed a real test caught a faction-only clearance moving state
trust it had no business moving.

**Multi-faction heat: real, independent per faction, never one
"wanted" scalar — by direct instruction** ("it could be a heat bar,
but not just for the police... you could be on a gang's radar").
`organizations.leader_id REFERENCES entities(id)` means organisations
and people already share the same `entities(id)` space, so a
`relationships` row between a person and an organisation-as-entity was
already structurally valid; `grep -rn "adjustRelationship"
server/*.js` against "organization" before this round returned
nothing, so `server/heat.js` is the first thing in this engine to
actually use that. `relationships.conflict` is the real column reused
as the heat value — the same column `crime.js`/`tick.js` already read
as "tension that can escalate" one relationship type over —
`relationship_type: 'enemy'` is the real, already-enumerated value
that fits a person a faction now targets, and `HEAT_GAIN` is
`justice.GROUP_FEUD_GAIN`, the identical real magnitude that file
already assigns to the victim's own side of the identical event, not a
second number for it. **The one real trigger is
`justice.answerByGroup` actually acting** (`acts.length > 0`) — never
omniscience about every offence that happens inside a faction's own
territory, a real, stated scope boundary rather than an invented
detection mechanism. Mutation-verified: temporarily raised heat
unconditionally, before that gate, and confirmed a real test caught an
offender gaining heat for an offence the faction had genuinely done
nothing about.

**Government/police heat is deliberately out of scope, and the reason
is that the state's own mechanism is already stronger, not missing.**
`justice.js`'s real chain — `judge` → `imprison` — already resolves a
governed area's answer immediately and completely: a prosecuted
offence ends in a real conviction and sentence, not a growing
suspicion level. A parallel "heat with the government" would either
duplicate that chain or disagree with it. `heatProfile` is surfaced
live on both dashboards (`players.js#getCitizenDashboard`,
`leadership.js#getLeaderDashboard`), same posture every other
never-stored dashboard field here already has.

**Friends, classmates and associates — real relationships, searched
for before they are ever front-loaded or generated**, closing the
worked example given directly: "a cousin in Arkansas isn't 'in effect'
until the player needs a real distribution contact outside their home
region — the engine should check for a real existing match first, and
only generate a new one if none exists." `server/contacts.js#findOrCreateContact`
reuses the real, already-enumerated `friend|business|educational|
neighbor|student` values (`VACANCY_POSTGRESQL_SCHEMA.sql`'s own
comment on `relationships.relationship_type`) — a classmate is
`educational`/`student`, an associate is `business`/`friend` — rather
than inventing a vocabulary for them, and real extended family
(`characterCreation.describeFamilyTree`'s own cousins/aunts-uncles) is
read as an ordinary candidate pool alongside them, never a special
case in this file's own logic. Only once nothing real qualifies is a
brand-new NPC actually generated, placed via the identical real
cross-world community draw `characterCreation.js#generateAuntOrUncle`
already uses — never a fixed default community.

**"Outside home region" is honestly scoped to what this engine's real
geography actually supports, and said so rather than overclaimed.**
The thirty-ninth standing rule already named the real constraint: this
engine generates exactly ONE region per world. There is no second real
region for a generated NPC to live in, so the option is
`outsideHomeCity` — the one geography grain `worldgen.js` routinely
generates more than one of — and a world with only one real city
refuses the request outright rather than silently handing back a
home-city contact. **A refusal leaves no partial state behind it**:
the "no other real city" check runs before any NPC is generated, not
after, a real ordering bug caught by mutation-verifying with a
`generateNpc` stub that throws if generation is ever reached in that
case.

`manufacture-ammunition` and `find-contact` are two new `actions.js`
verbs, both reachable only through the real player dispatcher
(`POST /api/players/:id/action`) — same posture `direct-mission` and
`broadcast-message` already have, with no dedicated REST route of
their own, because nothing besides a player action calls for one.
Live-verified through that real dispatcher, not just the modules: a
real generated world where `manufacture-ammunition` is refused with
the real "industrialization era, not yet reached" reason, and
`find-contact` generates a real new contact on its first call and
reuses that identical real contact (`generated: false`) on the second
— the whole search-before-generate claim, confirmed end to end rather
than only in a fixture.

**A fifty-first, and it is the most honest round yet about this file's
own real limits — asked for "crime all over the globe... conflicts,
wars... temperature... hunger... road conditions, animals, eating
conditions, cultures, all over the globe," and the right answer was to
build a real but SMALLER thing than the phrase asks for, and say so.**

A read-only research pass first checked what real source exists for
each of those nine asks, the same discipline this file's own thirty-
second rule's Antifa section and thirty-ninth rule's "not all 190-odd
countries" already model: never guess a source exists, check. It found
six real candidates (UNODC/World Bank homicide rate; UCDP/ACLED
conflict events; World Bank Climate Change Knowledge Portal/Beck et
al. temperature; ILOSTAT occupations; FAOSTAT undernourishment; WHO
road safety) and resolved two genuinely ambiguous asks by direct
instruction (`animals` → IUCN Red List wildlife status AND FAO
livestock, kept separate; `cultures` → declined outright).

**The real finding that reshaped this round: this session's own
tooling (WebSearch only, no direct page retrieval and no further
research subagent) could not reach the primary tables for most of
those six candidates — only their secondary mirrors, which disagree
with each other and are incomplete.** For `homicideRatePer100k` that
still produced real, cross-checkable figures for 28 of this table's 37
`COUNTRIES` entries, because secondary aggregators mirror the UNODC/
World Bank homicide series closely. For climate and road safety,
repeated differently-worded searches surfaced a usable figure for only
3-5 countries each — so `globalIndicators2026.avgTemperatureC` and
`.roadTrafficDeathRatePer100k` are built the same deliberately SPARSE
way `oilProducer` already was (present only where a real figure was
actually found, `null` everywhere else), rather than either faked to
look complete or abandoned to look like nothing was tried.
`undernourishmentPct` (FAOSTAT) is the same shape, 5 real entries.

**Attempting the rest at the same thin coverage would have been its
own kind of dishonesty, one level up from this file's usual mistake.**
Every other entry here declares a real fact sitting unread; this round
found facts that mostly weren't REACHABLE with the tools at hand, and
the twenty-fifth standing rule's lesson — a measurement is not its own
consequence — has a sibling here: a handful of real data points is not
its own completeness. So conflicts/wars, eating conditions and animals
were not attempted at all this round (the existing `conflictLevel`
band stands unchanged; FAO Food Balance Sheets and IUCN/FAO animal
data turned up no usable compiled figures in the searches tried), and
cultures (Hofstede; World Values Survey) is declined outright rather
than deferred — the research pass found WVS's own terms explicitly
non-redistributable and Hofstede's bulk-licensing terms unconfirmed,
the same "a real source exists but its access terms are not clean
enough" posture this file already took declining the Chicago gang-
boundary FOIA release.

**Occupations needed no building at all, and that is itself the
finding.** `occupations.js`'s `enforcer`/`officer` are already ungated
by ethnicity or nationality — the forty-second standing rule already
confirmed this checking "Mexican police officer" — so this table's own
occupation coverage is global by construction. A request is not
automatically a gap; sometimes the honest answer is that the thing
asked for was already built for an unrelated reason.

**New `COUNTRIES` entries for Africa/Middle-East/Europe gaps (Spain,
Egypt, Saudi Arabia) were considered and declined this round too** —
a new key needs a real `ancestryPacks.GROUPS` entry first, the Israel
addition's own real prerequisite (verifying a real Census ACS ancestry
code), and that is a separate piece of research this round's tooling
could not do with confidence.

**A found-and-fixed process mistake, worth recording because it cost
the whole round once and was recovered rather than silently
re-derived from memory.** Mutation-verifying the riskiest new check
(a fabricated homicide figure on an entry that should read `null`)
was done correctly the first time — but reverting that mutation used
`git checkout -- server/countryPacks.js` instead of undoing the one
edit, which discarded the ENTIRE round's uncommitted work on that
file, not just the mutation. `git status` immediately after showed
the file back at its last-committed state; `grep -c globalIndicators`
confirmed zero. The fix was mechanical — replay the same edits in the
same order against the now-reverted file, which matched cleanly
because the file was back to the exact state those edits were
originally written against — but the general form is worth keeping
as its own rule: **`git checkout -- <file>` discards every uncommitted
change to that file, not just the one you're trying to undo** — it is
the twenty-second standing rule's sibling, about a different way an
uncommitted change can vanish without `git status` ever looking
wrong. Revert a single mutation with a targeted edit (or `git diff`
reviewed before a stash/checkout touches the whole file), never a
whole-file checkout, while real uncommitted work sits in the same
file.

**A fifty-second, and it is the bluffing mechanic asked for by name:**
"a lot of the initial power will come from people thinking there are
guns and ammunition, but that will soon change. People realize those
guns aren't used, but people will try to fake it. But a lot of people
will realize the con, and that's when things will change."

**The real divergence this needed was already named in the fiftieth
rule's own closure, one function away.** `weapons.isFunctioningFirearm`
is the real, verified ground truth for "is this person actually armed"
— equipped AND a held round of its own real ammunition. A bluff is
exactly the gap between that real fact and what somebody else BELIEVES
about it, and `server/bluff.js` is built to never duplicate that
question, only ever read its answer at the one moment (`callBluff`)
that is allowed to.

**What creates the belief is not a new persuasion system — it is
`perception.receivedConfidence`, already built for `tick.js`'s scarcity
broadcasts and `politics.js`'s election results, read a second way.**
That function already answers "the confidence THIS person ends up
holding a fact at, given the confidence it was broadcast with."
`intimidate` treats the bluffer's own real `Deception`/`Charisma`/
`Persuasion` traits as the broadcast confidence and lets that function's
own already-calibrated math decide how much the target actually takes
in — never a second, disagreeing modifier, which is the exact mistake
`meetings.js`'s own header already argues against for persuasion in
general.

**`relationships.fear` turned out to already carry the real, directed
meaning this needed, written by a resolver nobody had connected to
bluffing.** `keys.js#resolveFear` already writes "entity's fear of a
named source entity" onto this column, `relationship_type: 'social'`,
the moment a source entity is known — its own comment says so
("targets that entity's `fear` column directly instead of a self-
relationship"). `raiseFear`/`lowerFear` in the new file follow that
exact precedent rather than inventing a parallel one, reusing its own
threshold (fear above 50 moves the relationship) and its own magnitude
(`fear / 10`) rather than guessing a second pair of numbers for the
identical underlying quantity — the seventeenth standing rule's
four-attempt case study is exactly the cost of skipping this step, and
this file introduces no new threshold or rate of its own to pay it
twice.

**A real, already-accepted limitation carried over rather than
discovered fresh**: `fear`, like `influence`/`trust`/`respect`, is a
single shared value per pair — the schema gives it no second column,
the same limitation `influence.js`'s own header already states for
itself. "How much A fears B" and "how much B fears A" are the same
stored number, and this file's own header says so rather than quietly
inheriting a simplification nobody wrote down twice.

**`callBluff` is the one check, and it is deterministic — no second
random draw was added anywhere in this file.** The real fact either
holds or it does not, and the two branches are real and asymmetric,
exactly as asked: an actually-armed target's bluff was never a bluff,
and calling it escalates through `crime.recordEscalation` — the
identical real mechanism `tick.js#runSecurityPhase` already uses for an
armed confrontation, reused rather than building a second combat
outcome that would disagree with it. An empty gun's bluff is exposed:
the challenger's own standing fear resets, and the bluffer's real
social standing with the challenger falls through `influence
.lowerInfluence`, at `INFLUENCE_DELTA` — the same magnitude every other
single real social event in this registry already uses, not a second
number invented for this one.

**`assessThreat` is read-only, and the thing it deliberately never
returns is the whole point.** It reports only the real, standing `fear`
value already on record — never `weapons.isFunctioningFirearm`'s
ground truth. `assess-takeover`'s own precedent is "look before you
commit" at the level of odds, never at the level of the hidden roll
itself; revealing the real armed answer here would let a player always
check first, and the bluff would never be a bluff. Mutation-verified
directly: temporarily added the real ground truth to `assessThreat`'s
return value and confirmed a real test catches it before reverting.

**A real ritual gap closed as a byproduct, not a regression this round
introduced.** `test/actions.test.js`'s own `REQUIRED_VERBS` fixture is
a hand-written list asserted against the dispatcher's real, derived
verb set — the exact "a list lives in two places and one of them goes
stale" risk `engine.js`'s own Phase 3 section already names for the
player verb generally. Three new real verbs (`intimidate`, `assess-
threat`, `call-bluff`) needed that fixture updated in the same commit,
the same way `VACANCY_INVENTORY.md`'s own file-count and per-file row
checks (twenty-second standing rule) needed a row and a recount for
`bluff.js` itself — both caught by the full suite, neither a defect in
the new mechanism.

**A fifty-third, and it closes "chaos ripple effects" by finding that
half of it was already real, naming the half that was not, and adding
exactly that half rather than a second, disagreeing mechanism.**

**Out-migration from a violent area was NOT a gap — it was already
real, and checking before building found it.** `motivation.js#safety`
already read `crime.dangerByCommunity` (`(1 - ctx.dangerIn(...))`) a
full round before this one, and `migration.js#desirability` already
weighs that same `danger` map choosing where somebody goes. So an
unmet `safety` need was already a real `forced` push
(`migration.PUSH_BY_NEED`) out of a dangerous community, into
somewhere that reads safer — this file's own thirty-ninth standing
rule's shape, pointed at my own assumption instead of at code: the
request read like a gap, and one look at the consumer said it was not.
Building a second migration pathway for the identical fact would have
been the third standing rule's mistake with a new name.

**What was genuinely missing, and the only thing built: a dangerous
area's BUILDINGS do not decline, only its PEOPLE'S safety need does.**
`property.js#advancePropertyLifecycle` read occupancy and ownership and
nothing else — `crime.dangerByCommunity` existed, was real, and had
exactly one reader in the whole engine before this. `property.
dangerDecayMultiplier` closes it the way every other real-signal
multiplier in this registry already does — compounding onto the
existing flat `CONDITION_DECAY_PER_TICK` term, never replacing it, and
never touching `crime.DANGER_REFERENCE_PER_1K` or
`keys.resolveAggression`'s own four-attempt calibrated floor/rate.
**One-sided, unlike `landCoverPacks.HOME_VALUE_MULTIPLIER_BOUNDS`**: a
land-cover class can raise or lower a home's value, but danger has no
protective direction for a building, so `DANGER_DECAY_MULTIPLIER_
BOUNDS` is `[1, 1.15]` rather than symmetric around 1 — neutral at zero
danger, never better. `crime.dangerByCommunity` is computed once per
tick in `tick.js`'s own Environment phase, the same "built once for a
whole pass" discipline that map's own header already states for why it
exists, and passed into `advancePropertyLifecycle` as a new, OPTIONAL
fourth argument — every existing call site (including five test files)
omits it and gets the exact byte-for-byte unchanged decay this engine
has always produced, which the new `dangerDecayMultiplier` tests assert
directly rather than trusting the argument's optionality to make it true.

**A second, genuinely separate real signal, added because it is not
redundant with the first.** `heat.js` (last round) is scoped to the
PERSON a faction actually acted on, not their neighbourhood —
`crime.dangerByCommunity` cannot see it, because every heat-raising
event is also a counted crime incident that already feeds the
community rate, so folding heat INTO that same map would double-count
the identical fact under two names. A person personally targeted by a
real faction has a real reason to want out that is independent of
whether their block reads as dangerous on paper, and the reverse holds
too — an uninvolved resident of a dangerous-reading block carries none
of it. `heat.worstHeat` is the WORST single faction's heat, 0..1, never
a sum — the same "take the worst, not the total" reduction `migration.
pushFor` already uses picking one need to act on, because this file
has no measurement to justify a mechanic where three factions' radars
at once is three times as motivating as one. Wired into `motivation.
js#safety` as a second multiplicative term, zero for the overwhelming
majority who have never had heat raised against them — the twelfth
standing rule's own discipline, applied to a brand-new term rather than
relearned: a modifier that is 0 for almost everyone is the correct
shape, not a sign that it does nothing.

**Measured on a real generated world, not asserted from the formula
alone.** Two communities, 30 residents each: one seeded with 60 real
violent incidents via `crime.recordCrime` (danger 1.000), the other
left at the world's own ambient rate (danger 0.571 — worth recording
plainly, because it means there is no such thing as a zero-danger
control community in a generated world; every area carries some real
crime). Run 300 ticks forward on `engine.advanceTick()` (the identical
function every real route this engine exposes already calls): the
seeded community's average property condition fell 61.87 points
against the ambient community's 53.01 — the right direction, a real
and attributable gap, but smaller than the formula's own bound would
suggest in isolation, because BOTH communities' buildings are also
subject to the pre-existing, separately-documented upkeep collapse
this project's own dev-docs already measured (most generated homes
settle on low staffing ratios, so the flat decay term dominates
regardless of this round's multiplier). Net migration moved in
opposite directions (the seeded community net-emptied; the ambient one
had a real net inflow) — the pre-existing push/pull mechanism
responding to the real data exactly as designed, not a new mechanism
being proven. The raw per-1,000 magnitude on the seeded side is not
meaningful on its own once a community's population falls this far —
`migration.netRatePer1k` has no shrinkage treatment the way `crime.
dangerByCommunity`'s own `SHRINKAGE_EXPOSURE` already gives the
identical small-sample problem for a different statistic, a real,
separate, future gap named here rather than smoothed over.

**A fifty-fourth, closing the gap this file's own sixteenth standing
rule's spirit names directly — a player could be standing next to real
chaos and never see it, because the event log only ever showed events
that named them.** `VACANCY_POSTGRESQL_SCHEMA.sql`'s own `events` table
has no location column at all, checked directly rather than assumed —
not even a dormant one, unlike `historical_records.where_location_id`,
which exists and is hardcoded `null` on every write in `tick.js
#runHistoryPhase`. So "something happened two blocks over" had no
substrate to even ask the question from.

**`server/events.js#locationOfEvent` invents no second location
mechanism — it generalises one that already existed in one file.**
`crime.js#communityForIncident` already derives a crime incident's
`community_id` from its victim, falling back to its perpetrator,
reading the real `npcs.communityId` each carries. This file asks the
identical question of EVERY candidate event's `affected_entity_ids`
array, not just crime's two named roles, and adds one more real path
for the cases a person can't answer: an ORGANIZATION-named event (a
business founded or closed) resolves through a property that
organization actually operates (`properties.operating_organization_id`
→ its own real `community_id`), and a `territory_status_change` event
prefers its own explicit `territoryBlockId` hint over reaching through
the faction that holds it, since a faction can hold several blocks in
several communities at once and the block's own stored `community_id`
is the more direct fact. `communities.cityId` (set once, at generation,
by `territory.generateCommunity`) is the one further step from
community to city. An event naming nobody with any of these — or
naming only entities with none of them resolvable — stores `{null,
null}`, the honest absence this registry's own thirtieth standing rule
already argues for, never a guessed location.

**Resolved once, at the moment of storage, inside `tick.js
#runEventPhase` — not re-derived later.** An entity's own community can
move (`migration.js`'s real push/pull), and an event re-asked "where
did this happen" after that move would answer with wherever the entity
is NOW, not where the event actually occurred. Mutation-verified: a
test asserts the stored `community_id` survives an entity's later
`communityId` change unchanged.

**The read side is `eventsNear`/`eventsIn`, surfaced three ways, and
the one real design question — what grain counts as "nearby" — was
answered from what this engine's own geography actually supports, not
invented.** This engine has no per-property coordinate system real
enough to support a numeric distance radius; `community` and `city`
are the two real, available containment tiers `crime.dangerByCommunity`
and `heat.worstHeat` already report at, so those are the two scopes
`eventsNear` takes, defaulting to `city` — narrower than "the whole
world," wider than "the one block," and genuinely the grain this engine
generates more than one of. An event naming the viewer directly is
always included regardless of scope, the one guarantee every existing
caller of `GET /api/events` already relied on and this file does not
narrow. Both dashboards gain a `nearbyEvents` field, same live-read
posture as `heatProfile`/`influenceRating` beside it; `GET /api/events`
gains `near`/`communityId`/`cityId`/`scope` filters additive to the
existing `sinceTick` — a call using none of them is bit-for-bit the
same route it was before this round. Mutation-verified: the scope
filter's own exclusion check was disabled and three tests caught events
leaking across communities/cities that should have been excluded.

**A smaller, real finding from the same pass, corrected rather than
left wrong in the map: `VACANCY_API_ENDPOINT_MAP.md`'s own `/api/events`
line claimed it was "filterable by tick range/severity."** It never
was — checked directly against `server.js`, which has only ever
supported `sinceTick`. A citation-is-not-presence mistake in this
project's OWN map, not a third party's, caught while adding the filters
the line should have already described.

**Also checked, per the queued claim that "organization-membership
milestones, ordinary price changes don't fire events at all yet": true,
and not a dropped-output bug like the eighteenth standing rule's own
case.** `businesses.js`/`economy.js` both construct and correctly
return real events (`business_founded`, `business_closed`, `hired`,
`laid_off`, `payroll_missed`, ...) that DO reach `candidateEvents` and
DO get stored — the pipeline itself is sound. There simply is no event
TYPE for an ordinary price change or a membership-count milestone
anywhere in this engine; nobody ever built one. A real, smaller,
separate gap, left for its own round rather than folded into this one,
which was about where an event happened, not which events exist.

**An operational finding about THIS environment, worth recording
because it cost real time and will cost it again if not written down:
`node --test`'s default concurrency starves itself in a CPU-constrained
sandbox.** Running the full suite as `node --test test/*.test.js` (or
the equivalent bare `node --test`/`npm test`) repeatedly appeared to
hang at the identical test — always the same ~71st test printed,
regardless of which files were in the run — because several genuinely
CPU-bound test files (`authority.test.js`, `businesses.test.js`,
`construction.test.js` among them) were scheduled to run truly in
parallel by the test runner's own default concurrency, and this
sandbox's CPU allocation could not actually run them in parallel
without each one starving the others, so wall-clock time per file grew
far past what it costs run alone. It was not a hang, a regression, or a
deadlock — `--test-concurrency=1` (sequential) finished the entire
2029-test suite cleanly in about twenty minutes, where the default
concurrency setting never finished at all across several real attempts.
Also confirmed this is pre-existing and unrelated to any change in this
round: reproduces identically on the clean, unmodified tree (`git
stash` and re-run). Use `--test-concurrency=1` for a full run in this
environment.

**A fifty-fifth, and the premise it was asked to fix turned out to be
stale — the real gap was one system over from where it was pointed.**

**"`property.js` has no `prison` type" was checked directly and found
false before a line was written.** `server/landmarks.js` has carried a
real `prison` Key category since before this round — real significance
band, `propertyType: 'government'`, staffed with a real `officer` at
generation exactly like every other hero-tier building — and
`world-layer/exportRegion.js`'s own `KEY_CATEGORIES` already lists it,
so a real NRHP/Overture-imported prison already lands on a real
`properties` row wherever a region pack supplies one, with an invented
one filling the gap exactly like every other Key category does when it
doesn't. That whole pipeline — generation, staffing, real-data import —
was already running. Building a second property type for a landmark
category that already exists and already works would have been the
third standing rule's mistake with a new name.

**The real gap was narrower and had already been written down.**
`server/justice.js`'s own header carries three quotes from
`urbanSystems.js` naming "§7 Prison is absent" because `imprisoned` had
nowhere to point, and `imprison` closed the STATUS half of that months
ago — `npcs.status = 'imprisoned'`, real — while leaving
`where_location_id: null` on every conviction's own historical record,
unconditionally, forever. A sentence changed what somebody was; it
never said where. `justice.prisonFor(worldState, cityId)` is the fix:
the real prison standing in the SAME city `judge` already recorded on
the case (`caseRow.city_id`, set from the incident's own community weeks
before this round), found deterministically (lowest real `id` — see
below for why this is not a seeded draw) rather than searched city-blind.
`imprison` and `release` both now point their historical record's
`where_location_id` at it, and name it in the record's own description,
when one exists; a city with no real prison keeps exactly the behaviour
it already had, `null`, an honest absence rather than an invented
building.

**Deterministic on purpose, not a missing seed.** Every other draw in
this registry that picks among several real candidates is a seeded
draw, because the thing being decided is genuinely uncertain. This is
not one of those: `judge` has already decided the one real city a
conviction happened in, and a city either has a real prison standing in
it or it does not. There is nothing left for randomness to resolve, and
reaching for `seededDraw` here would have been inventing a coin flip
over a question the world has already answered.

**Warden/staffing needed no new code, and that absence is itself the
finding — the forty-second standing rule's shape, one round later.**
`landmarks.js#KEY_BUILDING_TYPES.prison.staff` has always been
`'officer'`, and every hero-tier building is staffed at generation, not
on request — so a generated prison already has a real `officer` working
there before this round touched anything. A "warden" occupation was
asked about in the conversation that queued this work and was not
built, because the honest answer, checked rather than assumed, is that
the role this engine can actually represent already exists under a name
it already uses elsewhere.

**Prison capacity stays exactly as excluded as it already was — this
round did not re-open that question, because it was never this round's
to re-open.** `justice.js`'s own header has said, since before this
round, that `infrastructure.INFRASTRUCTURE_TYPES` is a fixed ten and
none of them is a prison, so nothing in this engine can overflow, queue,
or release early for want of a cell, and that the document naming real
capacity figures is not in this repository. That stays true. Checked
separately while scoping this round: `world-layer/imports/
hifldImport.js`'s own real `prisons` facility entry (a real `capacity`
field, unit `inmates`) would land in `infrastructurePacks.js`'s single
`public_safety` bucket alongside police and sheriff facilities whose
own capacity (officers, not inmates) means something else entirely —
wiring it in now would silently blend two incompatible units into one
number, which is a worse mistake than the honest absence this file
already declares. Closing that for real is a structural change to how
`infrastructurePacks.js` groups facilities, not a line added here.

**`caseRow.prison_property_id` is new and in-memory only, the same
documented posture `community.fertilityRates`/`city.healthBaseline`
already carry and for the identical reason.** `court_cases` is a real
table `migrate.js`/`restore.js` already round-trip; adding a column to
it is real, separate schema work this round does not take on. A world
rebuilt from Postgres falls back to the same `null` a city with no real
prison already produces — not a silent loss, the same known, stated
limitation every other in-memory-only field in this registry already
carries.

**Mutation-verified the one check that actually matters here**: with
the city-scoping condition in `prisonFor` removed, a real prison
standing in a different city was used anyway, and the test asserting a
prison never crosses city lines caught it immediately; reverted, the
full suite returned to green. Live-verified on a real generated world
(two cities, `worldgen.generateWorld`): a real `prison` landmark
generated in city 1, a real resident convicted of theft under a real
enacted law, `imprison` called directly — `caseRow.prison_property_id`
and the conviction's `where_location_id` both pointed at the real
prison's own id, and its name appeared in the record's own description.
Full suite on the merged tree, after rebasing onto the local-area
events round above: 2034 tests, 2017 pass, 0 fail, 17 skipped — this
file's own 5 new tests included, zero regressions from either round.

**A fifty-sixth, and it is the full political hierarchy asked for by
name — "town to continental, country, state, city... politics for
everything" — closed by finding that most of it was already real and
only ever handed one subject, plus one real bug the generalisation
itself surfaced.**

**The real hierarchy, read from the schema rather than guessed.**
`VACANCY_POSTGRESQL_SCHEMA.sql` names four geographic tiers:
`communities` → `cities` → `regions` → `civilizations`, each a real FK
into the one above it. `regions` sits directly between civilization
and city — exactly where a US-style "state" sits between country and
city — so **region IS this engine's state tier**, not a fifth table to
invent. `communities.leadership_npc_id` and `cities.mayor_npc_id` both
already existed as real leader fields; `regions` and `civilizations`
had none at all.

**The real structural ceiling, confirmed rather than assumed: this
engine generates exactly ONE region and ONE civilization per world**
(`migration.generateRegion` and `technology.foundCivilization` are
each called exactly once in `worldgen.js`, already named in the
thirty-ninth standing rule). "Continental" has no table, no column,
and no real per-continent political dataset researched this round — a
generated continental leader would be political theater for a
population of zero, the eleventh standing rule's own trap one tier
further out than usual. Declined outright rather than faked, same
posture `countryPacks.js` already took for country-level real data:
report-only, not a mechanic.

**The real substrate for "politics" turned out to already be fully
generic, and had simply never been handed more than one subject.**
`politics.js#runElections`/`runLegislation`/`assessRevolutions` all
loop `for (const government of worldState.governments || [])` — a
civilization, if `worldgen.js` ever founded more than the one
civ-wide `"${civilizationName} Assembly"` it always has, would
already get a real election cycle with no changes to those three
functions at all. The actual gap was narrower than "build politics
for every tier": it was giving a `governments` row a real SCOPE
(`scope_type`/`scope_id`: city, region, or civilization — `community`
deliberately excluded, the same "population of one" reasoning above,
one tier down: a formal election over one neighbourhood's worth of
people is a label, not a mechanism), and then scoping every READER
that had silently assumed there was only ever one government in the
world: `candidatesFor`'s fallback ranking and the voter pool in
`runElections` both used to draw from `worldState.npcs` — EVERY NPC on
the planet — for ANY government's election; `runLegislation` legislated
every city for every government, which was correct by accident when
there was only one government and would have had a city government
enacting laws for cities it does not represent the moment a second one
existed; and `computeApproval`'s `spread` denominator was the whole
world's population, which would have made `REVOLUTION_SPREAD_FLOOR`
structurally unreachable for any government smaller than the whole
civilization — the fourteenth standing rule's own shape, a threshold
whose denominator sits behind a wider population than the mechanism
was ever built to reach. `politics.scopeCitiesOf`/`scopePopulationOf`
are the one real fix underneath all four, reused by each rather than
patched four separate times.

**A real, previously-uncaught bug surfaced by generalising the
mechanism to a second tier, not by looking for one.**
`closeElection` wrote `organization.leader_npc_id` — a field that does
not exist on the schema, on `engine.js#generateOrganization`'s real
object shape (`leader_id`), or anywhere else `leadership.js`/
`control.js`/`succession.js` read. Every election this engine has ever
run, since `politics.js` was first built, had its winner go nowhere.
The sixth standing rule's own shape — a writer using a field name that
does not exist succeeds silently, forever — compounded by the
twenty-fourth's: `test/politics.test.js`'s own fixture built its
organizations with `leader_npc_id: null`, the identical wrong name, so
a passing suite could never have caught it. Fixed to write `leader_id`
(the real column), and the fixture corrected to match a real generated
organization's actual shape rather than the bug's.

**What's genuinely new, generalised, and report-only, named
separately rather than blurred together.** New: `regions
.governor_npc_id`, `civilizations.head_of_state_npc_id`, and
`governments.scope_type`/`.scope_id` are real schema columns (ALTER-
free, declared inline the same way `communities.leadership_npc_id`
already was), round-tripped through `migrate.js`/`restore.js` the same
documented way every other BIGINT leader field already is, and vacated
on death by `succession.js` alongside `mayor_npc_id`/
`leadership_npc_id`. Generalised, not duplicated: `installScopedLeader`
is the one place a government's election winner lands on the right
tier's own field, so city/region/civilization each get a real election
from the SAME `runElections` cycle rather than three parallel,
disagreeing ones. Report-only, unchanged from its own prior round:
`countryPacks.js`'s real country-level political/military/conflict
data stays exactly as deliberately uncalibrated into any live mechanic
as the thirty-third and thirty-ninth standing rules already left it —
this round does not touch that posture.

**Opt-in, same posture as `config.extendedFamily`, for the identical
reason.** `worldgen.js#config.scopedGovernments` (default `false`)
founds one real government per city and one for the region, in
addition to the civ-wide one every world already got. Off, every
existing call to `generateWorld()` is byte-for-byte unchanged — more
governments means more elections, more enacted laws, and more events
in a long-running world, none of which the 50+ test files already
asserting exact counts against a world built the old way could have
anticipated.

**Mutation-verified the riskiest two checks.** With `scopeCitiesOf`
reverted to ignoring scope entirely (the exact pre-fix shape), four
tests caught it immediately — a city-scoped election drawing
candidates and voters from another city, a city government legislating
for a city it does not represent, and turnout computed against the
wrong population; reverted, suite green again. With the `leader_id`
fix reverted back to `leader_npc_id`, both the corrected pre-existing
election test and the new scoped-election test caught it; reverted,
suite green again.

**Status, after whatever else had landed on this branch in the
meantime (VDEX's VULCAN/VOKEN reconciliation, unrelated)**: full
suite, 2046 tests, 2026 pass, 0 fail attributable to this round, 17
skipped — 3 failures present are all traced to a different, concurrent
sibling fork's own in-progress, not-yet-committed file
(`server/prisonPacks.js`, task #151's own prison-depth round), not to
anything here: `grep -n race server/prisonPacks.js` finds the exact
word that trips `race-packs.test.js`'s own module allowlist, and that
file's own inventory row did not exist yet either, which is the other
two. 2034 (this branch's own last landed count) + 12 (this round's own
new tests) = 2046, exactly.

**A fifty-seventh, and it is task #151 — "prison gang politics... prison
gang leaders... COs... after the reset, they head to their family.
Prison breaks. Taking over prisons... races in all the penitentiaries,
county jails... juvenile and women's facilities... camps... all the
crimes" — closed by reusing four systems already built rather than
inventing a fifth, and one hard line held for exactly the reason it is
held everywhere else in this file.**

**The line, stated before anything else, because it was decided before
anything else was designed.** Real incarceration demographics BY RACE
are real, public, well-known government statistics — the Bureau of
Justice Statistics publishes exactly this, by facility type, the same
kind of fact `racePacks.js`/`religionPacks.js`/`ancestryPacks.js`
already report elsewhere — and reporting them is fine, with the
identical §9 firewall every one of those already carries. Race must
never determine which prison gang an NPC joins, never feed a prison
violence or conflict mechanic, and never otherwise decide an outcome.
That is not a data-availability question; it is the same boundary this
project has already drawn and held for ethnicity, religion, sect and
tribe across dozens of these entries, and a prison is not a setting
that gets to redraw it. `server/prisonPacks.js` reports the real
demographic composition of three real facility kinds; nothing reads it
to decide anything.

**What was found, at what grain, and what was left `null` rather than
guessed.** BJS's own summary of *Prisoners in 2022* gives sentenced
state-and-federal composition (32% Black, 31% White, 23% Hispanic —
BJS's own published figure, cross-checked against EPI's chart of the
same BJS table, not a third party's invention) and a newer, separately-
dated female share (7.3% of the combined population at yearend 2023).
BJS's own *Jail Inmates* series gives local jails (49% White, 35%
Black, 14% Hispanic at midyear 2021; 14% female at midyear 2022).
OJJDP's Census of Juveniles in Residential Placement gives the one real
source for juvenile facilities specifically — 2021's own published
race-by-age counts, divided here into percentages since OJJDP's own
page does not print them directly, and a separately-dated 2023 female
share (14.5% of committed youth) kept at its own year rather than
blended with 2021's, because OJJDP's own release note says the two
waves are not directly comparable. A *Prisoners in 2023* report exists
and its own race table could not be retrieved this round — named as a
real gap rather than silently worked around with the 2022 figure
passed off as current. A believable facility-COUNT distribution (how
many of each real kind exist, which is what `landmarks.js` would need
to assign county-jail/women's-facility/camp sub-types at generation
with any real backing) was checked for and not found at a confidence
this round would stand behind, so `property.facilityType` carries one
honest default — `'state-or-federal-prison'` — rather than an invented
split. The same sparse-rather-than-guessed posture `countryPacks.js`'s
`globalIndicators2026` already took.

**Every crime this engine actually tracks, named rather than quietly
narrowed.** `prisonPacks.describePopulationCaveat` cross-checks against
`crime.CATEGORIES` at call time and names all eight — the five this
engine can actually generate a perpetrator for (violent, property,
theft, gun, domestic) against the three that stay a declared absence
(drug, fraud, sex_offense, per `crime.js`'s own header, from before this
round and not reopened by it) — so a reader of a population this engine
reports is never left assuming a narrower taxonomy exists than the
engine's own vocabulary already names.

**COs needed no new occupation, the forty-second standing rule's own
precedent, checked rather than assumed a second time.**
`landmarks.js#KEY_BUILDING_TYPES.prison.staff` has been `'officer'`
since before this round, and `officer` is not ethnicity- or role-
gated — the identical fact that already closed "Mexican police
officer" with no new occupation closes "corrections officer" too.

**Gang politics, leaders, "taking over a prison" and prison breaks are
four consequences of ONE reused mechanism, not four new ones.** The
real question — whether a prison needs its own interior geography (a
"wing" or "cell block") to model a takeover — was checked against the
schema before anything else was designed, and the schema's answer is
no: `territory_blocks.community_id` is the finest geography this
engine has, with no building-interior subdivision anywhere in it.
So a prison gang is `orgArchetypes.js`'s new `'prison gang'` archetype
(`type: 'gang'`, `isFaction: true`, the identical shape `militia`/
`insurgent cell` already have), scoped to the prison's own real
COMMUNITY — `control.js`'s real takeover machinery and `authority.js`'s
real `governed`/`contested`/`lawless` regime need no new code at all to
let it contest, hold, or lose that ground, because a prison is a real,
bounded, government-controlled area by default and "taking it over" IS
that area's regime crossing into `lawless`, the same mechanic every
other neighbourhood in this engine already has. Membership is
structural (whoever this engine has actually imprisoned at that one
real property, read live every time a new conviction lands there) and
leadership is deterministic — lowest real id among current inmates —
for the identical reason `justice.prisonFor`'s own header already gives
for declining a seeded draw: nothing in this engine's substrate
survives imprisonment real enough to weight a contested choice from
(no occupation, no `npc.combat` reader this file owns), and a draw
dressed as one would be worse than an honest rule. `runPrisonBreaks` is
the other half of the same reused mechanism: a crossing, not a
condition — the seventh standing rule, in a new place — fires exactly
once per transition into `lawless` for a prison's own community and
releases everyone currently serving there, unserved, through the same
real `release` function an ordinary completed sentence already uses,
tagged so the historical record says so rather than looking identical
to a sentence that actually ran out.

**"After the reset, they head to their family" is a release that finally
asks a question this engine already had an answer to.** `justice.release`
now calls `characterCreation.describeFamilyTree` — filtered to the
living, because that function reports the dead too and an early version
of this did not filter on it, which would have sent somebody "home" to
a parent `mortality.recordDeath` had already closed out — and names the
real family on record, or says plainly that this engine has none,
rather than inventing a reunion. Not a new family system; the one this
engine already built for `characterCreation.js`, asked a question
nothing had asked it from this direction before.

**A new per-NPC field was deliberately NOT added this round, and the
reason is the same complexity class this file has already named four
times for the other demographic dimensions.** This engine has no
`npc.sex`/`npc.gender` field anywhere — checked directly, not assumed —
so a male-adult-never-in-a-women's-facility correctness property is not
buildable without inventing one, the identical "new per-NPC field"
complexity class race/marital-status/disability/veteran status were
each already their own round for. What the real substrate DOES support
is age (`mortality.ageInYears`, already read by `control.ageOf`/
`roleOf` for every other age-gated decision in this engine), so that is
the one individual-routing axis this round actually closes: a known
minor is never routed into the one adult-typed facility a city has —
`prisonFor` returns `null`, the same honest absence a city with no
prison at all already gets, rather than a fabricated juvenile building
or a silently-wrong placement. Sex-based routing stays a declared,
named gap, not a quietly narrower claim.

**Mutation-verified two checks, one of them caught live during
development rather than staged afterward.** With the juvenile-safety
condition in `prisonFor` disabled, both tests that depend on it failed
immediately; reverted, suite green again. And `race-packs.test.js`'s
own forbidden-word firewall caught a real false positive while this
module was still being written — a single occurrence of the standalone
word "race" inside a string literal in `prisonPacks.js` (a sentence
about the 2021 and 2023 census waves, nothing to do with `npc.race`),
tripped the exact same scan `racePacks.js`'s own §9 test holds. Fixed
by rewording the sentence rather than relaxing the test's allowlist —
the firewall is supposed to be strict about the word, not about intent,
and a module that reports real-world race statistics for an unrelated
reason earning a second look is the test doing its job, not a false
alarm to code around.

**A concurrent sibling fork (task #150, the full political hierarchy)
caught this same in-flight bug independently, from the other side,
while this round's own commit was still uncommitted — see this file's
own fifty-sixth entry, written before this one landed, naming
`server/prisonPacks.js` and the exact word that tripped it. Both forks
reached the same diagnosis from opposite directions and neither one
touched the other's files**, the same collision discipline a prior
two-fork round on this branch already established and this round
followed again: this file, `README.md`, `VACANCY_API_ENDPOINT_MAP.md`
and `VACANCY_INVENTORY.md` were re-fetched and re-read fresh from
origin immediately before this entry was written, rather than from
whatever was on disk when this round started, and this round's own
commit rebased cleanly onto the political hierarchy's landed tip with
no merge conflict in any file either round touched.

**Tests and status.** `test/justice.test.js` (+6: juvenile-safety
routing both through the full `runJustice` pass and directly through
`prisonFor`, gang formation with a real deterministic leader, the
one-inmate-founds-nothing floor, a prison break on a real regime
crossing that does not repeat on a second lawless tick, and a release
that names real family on record) and `test/prison-packs.test.js` (new,
6: every real facility entry resolves and an unknown one does not, no
share is fabricated past what BJS/OJJDP actually published, the real
under-100% BJS/FBOP reporting gap is reported rather than normalised
away, `landmarks.js`'s own default lines up with this module's own
entries, the crime taxonomy is named honestly, and the §9 firewall).
Full suite after rebasing onto the political hierarchy's landed tip:
2058 tests, 2039 pass, 0 fail attributable to this round, 17 skipped —
2046 (that round's own landed count, the three failures it reported
being exactly this round's own in-flight state) + 12 (this round's own
new tests) = 2058, exactly.

**A fifty-eighth, and it closes the API map's own Phase 4 — the five
"ecosystem link-outs" named since the earliest handoff document and
never built, because the map's own words are explicit that they are
link generators, not functional endpoints: "VACANCY should never
implement the actual streaming/commerce/fashion logic itself."**

**The gate is reused, not invented — the fourth time this round that a
new threshold reaches for an existing one rather than guessing a
number.** `media.js`'s own `CHANNELS.social_media` is already exactly
"the internet is back, world-reaching, needs a real `internet`
infrastructure row standing in this specific city" — one tier past
`radio` (`electricity`) on the same `technology.ERA_NAMES` ladder
`weapons.js#MANUFACTURING_ERA` already reuses. `media
.availableChannels(worldState, cityId).includes('social_media')` is
the entire real check — `computing` reached AND a real, non-failed
`internet` row in that city, read once rather than re-derived.
`server/ecosystemLinks.js#digitalPlanetReady` is that one call, named
for what it answers; a `cityId` that cannot be resolved (no community,
no city) is refused outright rather than defaulted to ready, the same
posture `events.js#communityIdForEntity`'s own null case already
holds.

**Each destination was checked against the sibling's own real route
table before a link into it was generated, not invented in isolation.**
Vavlt Stvdios' real addressable unit is a channel
(`GET /api/channels/:id`); Vvltvre is three real sub-apps sharing one
home, so the map's own `:contentType` param (not `:contentId`) is taken
literally and dispatches to Music's real `GET /api/releases/:id` or
Flix's real `GET /api/titles/:id` — "touring" has no dedicated app in
this repo yet and is refused rather than guessed; DREAMS' real unit is
a screen (`GET /api/screens/:id`); VENVS' real unit is a seller
(`GET /api/marketplace/sellers/:id`). No frontend deep-link convention
(hash routes, a resolver) exists anywhere in this ecosystem yet —
checked directly — so every link generated is a resource locator into
the sibling's own real API, stated as such in its own response rather
than implied to be a confirmed UI route.

**"Vozzana da Gucci," named in the map since the original handoff, was
a stale name — corrected directly, mid-build: it is SVMIKO DEGVCHI, a
real 17-brand fashion house that lives INSIDE VENVS
(`venvs/src/lib/svmikoDegvchi.js`), not a separate app, and never was
one to build a fifth route toward.** Checked before deciding what to
build, not assumed from the correction alone:
`seedSvmikoDegvchiStorefronts` registers every brand as an ordinary
VENVS marketplace seller through the identical real `registerSeller`
call every other seller uses, which assigns a runtime integer
`seller.id` — `brand.slug` (`'degvchi'`, `'vvlgari'`, …) is a
human-readable label on the brand's own data definition, never stored
as or usable as a real lookup key, and VENVS exposes no slug-to-id
resolution route anywhere in its own code. So there is no separate,
stable product-id namespace a fifth route could honestly address
beyond what `venvs-link` already covers — a SVMIKO DEGVCHI brand's
storefront IS a real VENVS seller, at the identical granularity as any
other. Building a separate, more-specific route would have meant
fabricating a slug-resolution capability VENVS does not actually have,
the exact mistake this file already declined once for VULCAN not
existing. **Folded entirely into `venvsLink`; there are four real link
generators this round, not five**, and the map's original fifth line is
closed by the fourth rather than left unclosed or faked.

**A real, unrelated conflict found while sourcing VENVS' own real base
URL, flagged rather than silently fixed** (out of this task's own
files): `venvs/server.cjs` defaults to `PORT = process.env.PORT ||
8829` — the exact port `start-ecosystem.sh` separately assigns to VDEX
(home #19, a wholly different app) — and VENVS' real backend is not in
that manifest's boot list at all, only its Vite dev server is. Both are
real, pre-existing mistakes in two files neither belonging to this
round; named here so they are not mistaken for something this change
caused.

**Verification.** `test/ecosystemLinks.test.js` (7 tests) follows
`test/media.test.js`'s own fixture shape exactly, since the gate reused
here reads the identical era/infrastructure/organization rows — a real
mistake surfaced immediately the first time the suite ran: the fixture
carried no `type: 'media'` organization, and `social_media` (like
`radio`/`local_news`) also requires a real outlet to exist, not only
the era and the infrastructure; every "ready" case failed until the
fixture carried one, the same way a fixture missing a real row has
silently hidden a gap elsewhere in this file before. Mutation-verified
the gate itself: weakening `GATE_CHANNEL` to `'word_of_mouth'` (always
available) turned three tests red immediately; reverted, confirmed
green. Live-verified through the real `server/engine.js` wrapper
(`cityOf` → `events.locationOfEvent` → `ecosystemLinks.*Link`, the
identical call chain `server.js`'s own routes make) against a real
constructed civilization at both sides of the threshold — refused with
the real reason pre-`computing`, and all four generators returning
their real sibling URLs once the gate passed — plus the real HTTP
route confirmed live for the `entityId`-missing and
unresolvable-city refusals.

**A second, real regression caught by the full suite rather than by
this round's own new tests**: `VACANCY_INVENTORY.md`'s own
self-checking guard (`test/inventory.test.js`) failed twice the moment
this round's new file and routes existed — its stated file count (121,
a plain directory-entry count) disagreed with the test's own real
definition (`.js` files only, excluding `server/schema-extensions.sql`,
the one non-`.js` entry — 120), and its stated route count (105, the
document's own running headline) had simply never been updated past an
earlier round. Both are the exact three-time drift this file's own
header already names as its reason for existing; fixed to the real,
counted numbers rather than left for a fourth. Full suite: 2066 tests,
2049 pass, 0 fail, 17 skipped, zero regressions (one unrelated,
pre-existing flake in `tutorialMissions.test.js` — passes in isolation,
23/23, and passed clean on this round's own final full run; not this
round's doing, named rather than quietly ignored).

**A fifty-ninth, and it is two systems built together because the
founder's own request fused them: a real local power hierarchy, and
real missions that fall out of a player simply visiting what it
controls.**

"There'll be a kingpin, there'll be the strongest gangs, the strongest
political party, the strongest religious party... a power hierarchy
in every town" is `server/mainCharacters.js` — four real leader
lookups, computed live, never stored (standing rule 3), over four
genuinely different real substrates. Criminal reuses `authority
.holderOf` outright — the faction already holding this community's
ground, scored by its own live territory/power. Political reads the
real installed leader of whichever real `governments` row's scope
actually covers this community (its city, else its region, else the
civilization every world always has one of) — the office-holder, not
an archetype's own leader, since `politics.js#candidatesFor` already
runs this engine's one real election cycle directly on a government
organization. Business is the real highest-influence (ties broken by
assets) business organization actually operating a property here.

**Religious needed real building, because nothing of its kind had
ever existed.** `orgArchetypes.js` had eleven archetypes and zero of
type `'religion'`; its own `describeArchetypes` header already
recorded that nothing in `worldgen.js` founds ANY archetype at all.
The new `'religious order'` archetype (`posts: ['teacher']` — no
priest/clergy occupation exists, the same honest-substitute posture
`aid organization`'s own posts already take) is the first real caller
of `orgArchetypes.found()` from `worldgen.js`, opt-in
(`config.religiousOrdersPerCommunity`, default `false`, same posture
as `extendedFamily`/`scopedGovernments`), and it is given a REAL
founding leader — the community's own highest-`influence
.influenceRatingOf` family head — rather than the `leader_id: null`
every other organization in this engine starts with. **The §9
firewall holds here exactly as everywhere else**: nothing in the new
archetype, or in the code that founds one, ever reads an NPC's own
`npc.religion` field to decide who founds, leads or joins it — a
world's real institutions and its NPCs' own private real-world-sourced
religious identity stay the two deliberately unconnected facts they
already were. Mutation-verified: injecting a real `head.religion`
read into the founding block was caught immediately by
`test/mainCharacters.test.js`'s own comment-stripped scan
(`test/ethnicity.test.js`'s established pattern), and reverting it
restored a clean thirteen-test baseline.

**A real, pre-existing gap surfaced rather than retroactively fixed.**
Checked directly: `generateOrganization` only ever writes a real
`leader_id` when a caller passes one, and no caller anywhere in
`worldgen.js` — businesses, gangs, governments — ever does; the ONLY
two places `organizations.leader_id` is written anywhere in this
engine are a real election (`politics.js:704`) and a real takeover
(`control.js`'s own `seize`), and neither runs automatically from the
tick pipeline. So on a freshly generated, never-ticked world, the
criminal and business categories resolve honestly `null` almost
always — measured directly, a six-community generated world produced
real faction holders and real business operators with `leader_id` set
on none of them. This round fixes that only for its own new religious
archetype; fixing it retroactively for the three pre-existing
categories is real, separate, future work, named here rather than
guessed at. `GET /api/communities/:id/main-characters` exposes all
four, honestly, live.

**The second half — "explore skyscraper, explore library... every
time we learn how to fish, we read a book... finding [main characters]
will help us build missions" — is `server/missionTriggers.js`.**
`missions.generateMission`'s own `controllingFactionId` validation
requires `organizations.isFaction === true`, which is the schema's own
reason this wires to the criminal category alone, not political/
religious/business — a government, a religious order and a business
are none of them a faction, and the founder's own worked example (a
kingpin, a gang) is exactly the one category that is. `search-location`
needed no new wiring to cover the two named examples: `landmarks.js`
already has real `skyscraper` and `library` categories among its
thirty-three, and `discovery.search` already runs against any of
them, so the trigger covers both, and every other landmark category,
as a direct consequence of being general rather than special-cased.
`practise-habit` had no location at all, and — checked directly —
`habits.habit_name` is free text with no controlled vocabulary
anywhere in this engine, so gating the trigger on habit-name strings
like "fishing" or "reading" would have invented a vocabulary this
engine has never had. The honest wiring is the one `adopt-routine`
already established: an optional `locationPropertyId`, mirroring that
verb's own real field, added to `reinforceHabit` without being stored
on the `habits` row itself — there is no schema column for it, and a
habit is reinforced repeatedly, often at a different place each time,
so a per-habit field would misrepresent a per-EVENT fact as a durable
one. A dedicated fishing-spot landmark category and gating by habit
name are both named here as deliberately deferred, not silently
missing.

**The rate is measured, not guessed — standing rule 17's own
discipline, applied to a mechanism with a different risk shape.**
Unlike `resolveAggression`'s per-tick draw against every eligible pair,
this draw only ever runs on an explicit player action, and a location
already carrying an open job from its own main character is skipped
outright (`missionTriggers.hasOpenMissionAt`) — so there is no
feedback loop to guard against, only how CHANCE maps to calls-to-
first-trigger to choose well. Measured over 200 distinct draws per
candidate rate: 0.05 → mean 19.9/median 12 calls; 0.10 → mean 10.2/
median 7; 0.20 → mean 5.1/median 4; 0.30 → mean 3.5/median 3. `0.1` is
chosen: a real job shows up after a handful of visits to a real
controlled location, neither instant nor decorative, the same judgment
`discovery.js`'s own depletion rate was picked against, pointed at a
different real distribution. Mutation-verified: disabling the
no-duplicate-mission cap was caught immediately by
`test/missionTriggers.test.js`; reverting it restored a clean
six-test baseline. Live-verified end to end through the real player
dispatcher (`POST /api/players/:id/action`) for both `search-location`
and a location-aware `practise-habit`, not only through the modules
directly: a real faction holding real ground with a real installed
leader eventually handed out a real, location-tied job with a real
`controlling_faction_id`, at the measured rate, and a bare
`practise-habit` with no location never did, however many times it
was tried.

Full suite, this round's own final run: 2086 tests, 2069 pass, 0
fail, 17 skipped — exactly the prior round's 2066 tests (2049 pass, 17
skipped) plus this round's own 20 new ones (13 in
`test/mainCharacters.test.js`, 6 in `test/missionTriggers.test.js`,
one new route test in `test/routes.test.js`), zero regressions.

**A sixtieth, and it is four real audits in one round rather than one
new mechanism — occupation breadth, country scope, the nativity/
citizenship half of the thirty-third rule left standing, and whether
every demographic pack this registry now has actually adds up to a
full person.**

**First, a real BLS SOC major-group audit, the same discipline the
labour-wiring work already established: `labourPacks.
SOC_GROUP_BY_OCCUPATION` is a real, checkable map against a real,
fixed 22-group federal classification, so "is every group covered" is
a question with a yes/no answer rather than a judgment call.** Six
groups had zero occupation mapped to them — 15 (Computer and
Mathematical), 23 (Legal), 37 (Building and Grounds Cleaning and
Maintenance), 39 (Personal Care and Service), 41 (Sales and Related),
43 (Office and Administrative Support) — meaning a real labour pack
reporting real employment share and wage in those groups had nobody
in this engine to draw into them. `programmer`, `lawyer`, `custodian`,
`stylist`, `salesperson` and `clerk` close them, one each, named by
the real SOC group itself rather than a §25 subject or an
`organizations.type` — a fourth, real source this file's own
`occupations.js` header now documents alongside its original three.
**The same audit found a real miscoding, not a gap**: `plumber`
(47-2152) and `electrician` (47-2111) are both really SOC major group
47 (Construction and Extraction), and both had been coded 17
(Architecture and Engineering) alongside `engineer`/`architect` since
the labour-wiring round that first built this map — fixed in both
required-identical copies (`server/labourPacks.js` and `world-layer/
imports/blsImport.js`), with `test/labour-packs.test.js`'s own
identity assertion holding across the fix.

**Second, the real Census ancestry-code check the thirty-ninth
rule's own Israel paragraph used, run against six more named
countries, and the finding split three ways rather than one.** Direct
confirmation against the Census API's own variable metadata (the same
standard Israel's `B04006_050E` was held to) found: `iranian` is real
(`B04006_048E`, present across every ACS vintage checked from 2005
through 2024); `canadian` is real too (`B04006_026E`) but was NOT
wired in, because this file's own thirty-ninth-rule-adjacent comment
on `countryPacks.js` had already settled Canada for an independent
reason — "a real destination, not a US ancestry source" — that a real
code existing does not override; `yemeni` has no real code at
all — B04006's own Arab breakdown is a closed, confirmed list
(Egyptian, Iraqi, Jordanian, Lebanese, Moroccan, Palestinian, Syrian,
Arab, Other Arab) with no separate Yemeni row, so Yemeni ancestry is
counted under `arab`'s own residual categories, the same real finding
Saudi Arabian already had. **`venezuelan`, `cuban`, `colombian` and
`dominican` are real too, and the honest finding here is a citation
correction, not just four new entries**: none of the four is in table
B04006 at all — Census's own guidance is explicit that the large
Hispanic-origin groups are deliberately excluded from the ancestry
question because they are measured by the separate Hispanic-origin
question, table B03001 ("Hispanic or Latino Origin by Specific
Origin"). `cuban` is confirmed to the exact variable (`B03001_006E`);
the other three are that same real, standard, widely-published table's
own rows, not independently confirmed to the exact variable number
this round because `api.census.gov` is outside this environment's
outbound proxy allowlist, checked directly (403 CONNECT), the same
constraint this file's existing importers already name. **This almost
certainly means `mexican`/`guatemalan`/`honduran`/`salvadoran`,
already in this registry, came from B03001 too, not B04006 as an
earlier round's comment claims** — named plainly in `world-layer/
imports/ancestryImport.js`'s own header rather than silently
corrected, since re-sourcing four existing entries is a separate piece
of work from adding four new ones.

**Egypt was revisited, and the finding changes why it was declined,
not just its outcome.** The thirty-ninth rule's own `countryPacks.js`
comment declined Egypt "this round too" for lack of confidence doing
exactly this check, not because no real code exists — and the check
now has an answer: `egyptian` is `B04006_007E`, "Arab: Egyptian," a
real sub-row distinct from the generic `arab` row already in this
registry. Saudi Arabian was re-checked the same way and stays
declined — no matching row exists for it in that same breakdown — a
real finding independently confirmed rather than assumed still true.

Six new `ancestryPacks.GROUPS` entries (`iranian`, `cuban`,
`dominican`, `colombian`, `venezuelan`, `egyptian`) and six new
`COUNTRIES` entries follow the identical shape every entry here
already has — income level (World Bank, FY2026/27 classification,
checked directly rather than assumed, including Venezuela's real
move from "unclassified" to lower-middle-income), conflict level,
government type, EIU regime type (exact score where found, `null`
where a real category is known but the precise score was not),
SIPRI-adjacent military expenditure (flagged `secondary-estimate`
except where this table already holds a SIPRI-official figure), and
EIA/OPEC-adjacent oil-producer status. **Egypt's own oil/gas field is
the one real finding worth naming on its own**: not a simple
"exporter" label — Egypt still produces oil and gas domestically but
reversed from gas EXPORTER to net LNG IMPORTER by mid-2024 as the
offshore Zohr field's output fell roughly 30% from 2021 to 2024, and
`oilProducer.status` says exactly that rather than the older, now-
false "Egypt is a gas exporter" fact. Israel's own `warStatus` note,
which had said "Iran itself has no entry in this table," is corrected
to point at Iran's new entry instead of repeating a claim this round
made false.

**Third, the nativity/citizenship half of the thirty-third rule,
confirmed still unbuilt before building it** — `find . -iname
"*nativity*" -o -iname "*citizenship*"` returned nothing anywhere in
the repository. `server/nativityPacks.js` is the identical shape
`racePacks.js` already established: a real Census ACS table (B05001,
"Nativity and Citizenship Status in the United States"), five real
categories (us-born, born-in-territory, born-abroad-american-parent,
naturalized-citizen, non-citizen), a new `npc.nativity` field, drawn
unconditionally at any age exactly like `race`/`disability` rather
than gated like `maritalStatus`/`veteranStatus` — nativity and
citizenship status are, in the real Census question, ONE answer with
five outcomes, not two separate facts forced into two fields. Wired
into `worldgen.js`/`engine.js`/`demographics.js` the same way every
sibling field already is, and `world-layer/imports/censusImport.js`'s
`importAcsTract` gained the real table the same way it already holds
race, marital status, disability and veteran status. **Year-of-entry
(table B05005, "Period of Immigration") is a declared gap, not a
silent one**: it is a real, separate table that only applies to the
foreign-born slice of a tract's population and needs its own real
vocabulary of entry-period buckets — a second module's worth of work,
named in `nativityPacks.js`'s own header rather than forced into this
one field. **Nativity is also not persisted to Postgres, and that is
the EXISTING shape of every field in this family, not a new gap**:
`migrate.js` carries `ethnicity` by column name (the first of these
fields, added before the others existed) but none of `race`,
`maritalStatus`, `disability` or `veteranStatus` — there is no `npcs`
schema column for any of them — and `nativity` simply joins that real,
already-declared limitation rather than being a fifth, newly-
introduced one. Same §9 firewall discipline as every per-NPC real
field before it: `test/nativity-packs.test.js` holds its own copy of
`test/ethnicity.test.js`'s forbidden-file scan, mutation-verified by
temporarily making `crime.js` read `entity.nativity` and confirming
the test caught it before reverting.

**Fourth, and it is the only one of these four that is a measurement
rather than a build — asked whether this registry's seven
independently opt-in demographic packs (`ancestryPack`, `racePack`,
`maritalStatusPack`, `disabilityPack`, `veteranPack`, `nativityPack`,
`religionPack`) actually add up to a full person when all seven are
supplied at once, or whether non-overlapping gating conditions leave
real gaps nobody had checked for.** `scripts/measure-world.mjs` gained
`--all-demographic-packs`, a trivial one-bucket real-vocabulary sample
pack per field so every draw resolves rather than falling through to
a missing-tract null, and a `demographicCompletenessOf` report run
over the result. **The measured answer is clean: every adult gets the
full seven-field joint profile (105/105 and 109/109 across two
different seeds), every age-ungated field is set for every resident
regardless of age (150/150, 149/149), and the only "partial" profiles
are children correctly missing `maritalStatus`/`veteranStatus` — the
two fields ACS itself only measures for population 15+/18+, gated in
`worldgen.js` on the same `age >= 18` threshold `education` already
uses.** That is working as designed, the identical shape this file's
own forty-fifth rule already established when those two fields were
first built, not a bug this round needed to fix — checked directly
rather than assumed, which is the whole point of measuring it.

Mutation-verified the riskiest new check — temporarily made
`crime.js` read `entity.nativity`, confirmed `test/nativity-packs.
test.js`'s firewall test failed with the real offending module named,
reverted the mutation, confirmed green again. Live-verified
`--all-demographic-packs` over two differently-seeded real generated
worlds, not only a fixture.

Full suite, this round's own final run: 2111 tests, 2094 pass, 0
fail, 17 skipped — exactly the prior round's 2086 tests (2069 pass, 17
skipped) plus this round's own 25 new ones across
`test/occupations.test.js`, `test/labour-packs.test.js`,
`test/country-packs.test.js` and the new `test/nativity-packs.test.js`
(17 of the 25), zero regressions. Two real gaps surfaced and closed by
the suite itself before this count, not after: the new ancestry
groups left `migrationPathwayPacks.js`'s own load-time check with
nothing to classify them against (`cuban`/`dominican`/`venezuelan`/
`colombian`/`iranian`/`egyptian` added, each with the same real,
cited reasoning every existing entry there carries), and
`VACANCY_INVENTORY.md`'s own stated file count went stale the moment
`nativityPacks.js` landed (122 → 123) — exactly the drift
`test/inventory.test.js`'s own header already catalogues happening
twice before, caught a third time by the same guard.

**A sixty-first, closing the real structural cap on `countryPacks.js`'s
own country coverage rather than adding one more country under the
existing cap.** Asked directly to "take this as far as you can" and
"establish everything, all the countries," the real finding was not a
missing country -- it was that `COUNTRIES` has required a matching
real `ancestryPacks.GROUPS` code since round one, which is why Saudi
Arabia, Spain, Japan, Brazil and dozens of other real, significant
countries stayed out even once this module had real World Bank/EIU/
SIPRI/EIA data about every one of them. Checked directly against this
file's own prior rounds rather than assumed: that gate was never a
property of the country-level data itself. It is an artifact of
`COUNTRIES`'s first consumer, `migration.generateRegion`'s
`countryKey`, which genuinely needs a US ancestry link because it
answers "where is this player's family from" -- a question a
country's income level, conflict status, government type, regime
score, military spending or oil-producer status has no reason to
depend on.

`server/countryPacks.js#COUNTRY_PROFILES` is the fix: the identical
field shape `COUNTRIES` entries already carry, keyed directly on a
real, hyphenated country name, with no ancestry-code check at load
time -- a real, additive second path, not a replacement. `COUNTRIES`
and its ancestry gate are unchanged, because character creation's own
real need for that link has not gone anywhere. `countryProfileFor(key)`
reads it, and `regionalContextFor`'s own fallback chain (already real
since the ninth standing rule's ninth-round work) now checks it as a
second tier, between a dedicated `COUNTRIES` entry and the standalone/
regional-overview fallbacks that already existed. `GET /api/country-
packs/:key` was carrying a 404 condition that checked `dedicatedEntry`/
`standaloneEntry`/`region` but not the new `profileEntry` -- found and
fixed in the same round, live-verified over a real spawned server
rather than left for the fixture suite to catch, since a key with a
real profile entry but no region classification would otherwise have
404'd despite having real coverage.

**Ten real countries this round, prioritised by population and G20
membership rather than alphabetically**: Japan, South Korea, Brazil,
Argentina, Indonesia, Saudi Arabia, Turkey, Spain, Australia and South
Africa. Spain and Canada are the two gaps this specific round closes
that this file had already named by name in two separate prior
rounds — `EU_MIGRATION_OVERVIEW_2025`'s own note named Spain as a real
top-4 EU destination this module could not give a dedicated entry to
for exactly this structural reason, and the thirty-ninth standing
rule's note on Canada ("a destination, not a source") is restated
rather than overridden: Canada deliberately stays on its existing
`STANDALONE_REFERENCES` path, not duplicated into `COUNTRY_PROFILES`,
because its real reason for having no dedicated country-level entry
was never the ancestry gate this round closes.

**This round hit the same WebSearch-only tooling ceiling the fifty-
first standing rule already named, and the honest response is the
same: keep what was actually confirmed, flag what was not, never
guess the gap closed.** Brazil's `regimeScore` is `null` with its real
rank (57th of 167, 2024, flawed-democracy) recorded instead -- every
search that found the rank and category never surfaced the EIU's own
numeric score. Japan's 8.48 and Saudi Arabia's 2.08 both came from a
single secondary ranking table apiece that did not label its own
edition year; both are kept and flagged `regimeScoreConfidence:
'edition-year-unconfirmed'` rather than silently presented as settled
2024 figures the way every other `regimeScore` in this file is.
Several `militaryExpenditurePctGDP` values came from a secondary
ranking site whose own page title read "2025" while its values
matched other sources' 2024 figures -- kept as found, `confidence:
'secondary-estimate'`, the ambiguity stated rather than resolved by
guessing. Two real, non-default conflict classifications were made
rather than assumed: Brazil and South Africa are `high-nonstate-
violence` (not a UCDP state-based conflict, but both real homicide
figures in this same round support the classification); Indonesia
(the real, long-running Papua separatist insurgency) and Turkey (the
real PKK conflict, with a reported-but-unverified 2025 disarmament
process explicitly flagged as unconfirmed) are `localized-conflict`.

**Brazil's oil-producer entry is the one fully confirmed figure in
this batch, not a sparse placeholder, and it overturns Brazil's own
long-standing reputation as a pure importer.** Brazil became a real
net crude exporter for the first time in its history in 2024 -- IBP/
Ineep industry figures, ~3.4M bpd produced, 52.1% of production
exported because refining capacity lags production -- checked directly
this round rather than assumed stale.

A `COUNTRY_PROFILES` key colliding with a `COUNTRIES` key is refused
at load time, the same "checked once, never left to drift" posture
`ancestryPacks.GROUPS`'s own existing check already holds for
`COUNTRIES` -- mutation-verified by writing a sandboxed copy of the
module with an injected `german`/`COUNTRY_PROFILES` collision
alongside the real file (so its own relative `require`s still
resolve) and confirming the real guard's own error message, not a
generic one, before deleting the throwaway copy.

Full suite, this round's own final run: 2124 tests, 2107 pass, 0 fail,
17 skipped, 0 regressions.

**What this round explicitly did not attempt, named rather than
silently skipped**: the other roughly 175 real sovereign states this
file still has no dedicated entry for at either tier. Ten real,
significant countries is genuine progress against a ~195-country
world, not a claim of comprehensive coverage -- the same honest-ceiling
posture the fifty-first standing rule already set for this exact
phrase ("all over the globe"/"all the countries") once before.

**A sixty-second, and it is the record of a round that landed before
this one but deliberately left its own entry unwritten to avoid
colliding with the round above, written now rather than left
missing.** Asked directly to add "certain racial organizations, well,
nationalist organizations," confirmed in scope to cover both a
civilian archetype and the existing prison-gang system, two new
`orgArchetypes.js` entries closed it: `'nationalist movement'`
(`type: 'club'`, dispersed rather than territorial, citing ADL's own
H.E.A.T. Map FAQ -- "membership draws from fairly wide geographic
areas... cannot be accurately represented by a single point" -- for
that choice) and `'racially-affiliated prison gang'` (a sub-category
of the existing `'prison gang'`, same community-scoped faction shape,
cited cohesion raised on real academic literature rather than a
specific current membership dataset).

**No real, named organization appears anywhere in either entry, by
the same discipline this file has held for real named individuals all
session.** Every real source -- SPLC's 2024 hate-group count, ADL's
2024 extremist-murder report, DHS's Racially or Ethnically Motivated
Violent Extremism threat category, FBI UCR hate-crime bias statistics,
and the real academic literature on racially-organized prison gangs
(Skarbek; a 2014 *Prison Journal* Texas segregation study; Infante,
Morse, Fahmy & Wright 2023; the *SAGE Encyclopedia of Race and Crime*)
-- is cited in the module's own header as real-world grounding for a
structural number (growth band, cohesion band, which posts an
archetype carries), never as the name of a generated entity. The
thirty-sixth standing rule's own finding on prison-gang racial-
validation data was re-checked rather than trusted this round, and
still holds: no current public STG dataset exists (CDCR abandoned its
validation approach after *Ashker v. Brown*; LA County's own
Inspector General found its jail gang data too unreliable to
release). A real 2014-2025 CDCR gang-enhancement chart was found and
is named in `prisonPacks.js`'s own header as a declared, deliberately
unused fact -- a different real measurement (sentencing enhancement,
not STG validation) that would have misrepresented itself if wired in
as a stand-in for the thing that doesn't exist.

**The real §9 question -- whether a real-world-documented,
race-restricted recruitment pattern can gate who may join one of
these two archetypes -- was reasoned through on the page rather than
picked silently, and the answer is no, on the identical precedent
`'religious order'` already set for `npc.religion`.** Two real,
true facts about a person (what they believe; what they are) do not
have to be wired together just because a real-world analogue often
correlates them -- `orgArchetypes.js` founds and staffs both new
archetypes exactly as it does every other one, blind to
`npc.race`/`npc.ethnicity`. `orgArchetypes.js` was added to both
`test/ethnicity.test.js`'s and `test/race-packs.test.js`'s own
forbidden-file-scan lists, and mutation-verified the same way every
other firewall addition in this file has been: a real `.race` read
was injected, and all three guards -- those two plus a new,
file-local test -- caught it before being reverted.

This round's own targeted run (org-archetypes, ethnicity, race-packs,
prison-packs) passed 44 of 44 at landing time; this file's own
subsequent full-suite run (the sixty-first standing rule's own 2124
tests, 2107 pass, 0 fail) is the real, confirming result for the
whole repository with both rounds in it together.

**A sixty-third, continuing the sixty-first's own COUNTRY_PROFILES
path rather than stopping at the first ten.** Direct instruction to
keep pushing real country coverage "as far as you can genuinely"
toward the ~195-country world, same discipline throughout: real
WebSearched figures only, confidence-flagged where a source is
secondary, honest `null` where nothing citable was found, no
fabrication regardless of how large the ask is. Twelve more real
countries this round, prioritised by population and real current
significance: Pakistan, Bangladesh, the Democratic Republic of the
Congo, Thailand, Myanmar, Iraq, Afghanistan, Syria, Morocco, Peru,
Chile, Malaysia -- `COUNTRY_PROFILES` now carries twenty-two real
entries, up from the sixty-first standing rule's original ten.

**Three real conflict classifications made rather than defaulted, each
checked rather than assumed.** The DRC is `active-armed-conflict` --
the real, ongoing M23 offensive (Goma captured Jan 2025, Walikale Feb
2025, 500,000+ newly displaced, Rwandan backing alleged and disputed,
mediation efforts repeatedly collapsing) is unambiguous. Myanmar is
`active-armed-conflict` -- the real civil war between the 2021 coup
junta and resistance/ethnic armed organisations continues, and SIPRI's
own confirmed figure (military spending +66% in 2024, 6.8% of GDP, the
highest military burden in the Asia-Pacific) is itself evidence of an
active war economy, not just a conflict-tracker label. Syria is
`active-armed-conflict` -- real, current violence continues under the
transitional government (the March 2025 Latakia/Tartous/Hama clashes,
Israeli strikes on military targets, Aleppo clashes with the SDF), not
a settled peace. Pakistan, Thailand and Morocco are `localized-
conflict` -- real, long-running, sub-national insurgencies, with
Morocco's Western Sahara dispute kept distinct from its own domestic
conflict level the same way Saudi Arabia's combatant role in Yemen is
reported on Yemen's own entry rather than folded into Saudi Arabia's.
Afghanistan and Iraq are also `localized-conflict`, not `no-active-
conflict` or `active-armed-conflict` -- the large-scale wars in both
have ended, but real ISIS-Khorasan (Afghanistan) and ISIS-remnant/
sectarian (Iraq) violence has not, and neither extreme would describe
either honestly.

**Syria's `regimeType`/`regimeScore` could not get a real figure, and
the reason is structural, not a research gap.** The EIU's 2024 edition
reflects conditions as of 2024, and the Assad regime it would have
scored fell on 8 Dec 2024 -- inside that index's own final measurement
window, replaced by Ahmed al-Sharaa's transitional government (a
five-year transitional period, a real October 2025 parliamentary
election, uneven territorial control with the SDF-held northeast).
Scoring the fallen government would misrepresent the country today;
no post-transition EIU score exists yet as of this round. Both fields
are `null` with this reasoning stated directly in the entry, the same
honest-null posture Somalia's own `regimeType` already set a
precedent for. The DRC's `regimeType`/`regimeScore` are `null` for a
plainer reason -- no real EIU 2024 score was found at all this round,
and Freedom House's 19/100 "Not Free" rating is a different
methodology, not substituted here as though it were the same
measurement.

**Chile's `regimeType`/`regimeScore` are also `null`, for a third,
different reason this round found rather than papered over.** Three
separately-sourced claims about Chile's 2023-edition rank
(15th/7.98, 19th/"full democracy", 25th/"flawed democracy") actively
disagree with each other, and the one 2024 figure found (7.83) came
from a secondary site that did not clearly cite the EIU as its source
at all. Rather than pick one disagreeing claim or present an
unconfirmed secondary number as settled, both are left null and the
real disagreement is stated in the entry's own comment -- the same
"both kept, neither picked" discipline this file has held since its
very first France entries.

**Iraq's oil-producer entry is the second fully confirmed figure in
this table, not a sparse placeholder.** Real 2024 EIA/OPEC+ figures:
~4.2-4.4M bpd produced (sources differ on whether condensates are
included), ~3.26-3.36M bpd exported -- a nine-year low, driven by
OPEC+ quota compliance and a real pipeline outage, with Iraq itself
pledging to compensate 1.44M bpd of its own 2024 overproduction
through September 2025. Both ranges are kept rather than collapsed to
one number, since the real sources differ on methodology, not on the
underlying fact.

**Three entries carry an honest sourcing caveat no entry in the sixty-
first standing rule's batch needed.** The DRC (low-income), Iraq
(upper-middle-income) and Afghanistan (low-income) are each stated
from well-established general knowledge of the standard World Bank
classification, NOT from a primary table this round's searches
actually surfaced -- flagged in each entry's own comment rather than
presented with the same confidence as Bangladesh/Morocco/Peru/Chile,
whose classifications this round did find and confirm directly
against a real July-2025 World Bank list. Myanmar's `lower-middle-
income` carries the identical caveat, inherited directly from the
search result that surfaced it rather than independently re-verified.

Found and fixed live, over a real spawned server, not left for the
fixture suite: three of this round's own tests (written against the
sixty-first standing rule's original ten-country assumptions) asserted
an exact country count, a rigid "every regimeType is a real published
band" with no `null` case, and "every militaryExpenditurePctGDP is a
secondary estimate" with no SIPRI-official case -- all three had to be
loosened to describe what this round's own real, honestly-mixed data
actually looks like, rather than relaxed by weakening what they prove.

**A real, severe, pre-existing problem found while running this
round's own full suite, and confirmed NOT caused by this round before
being reported rather than quietly worked around.** `test/
worldgen.test.js` does not complete -- it ran at 100%+ CPU and still
had not finished after 60s, 120s, and 180s of isolated, contention-
free runtime (three separate direct checks, not one assumption). Before
naming it a pre-existing defect rather than this round's own
regression, it was checked the honest way: `git stash` to remove every
uncommitted change from this round, re-run `test/worldgen.test.js`
alone, and the identical timeout reproduced on the clean, already-
pushed `ecd4397` HEAD with none of this round's edits present. `git
log -- server/worldgen.js test/worldgen.test.js` shows neither file
has been touched since the global occupation/demographic completeness
round (599b937) -- this is not a defect this round introduced, and
not one the nationalist/racial-org round introduced either. It is
real, it is severe (full CPU, not a blocked wait -- a genuine runaway
computation, not a deadlock), and it is now a named, open problem
rather than a silent gap: whichever round touches `worldgen.js` or
`worldgen.test.js` next should check this before assuming the file is
healthy.

Full suite, this round's own final run, with that one pre-existing
file's real status named rather than hidden: 2020 tests enumerated,
1996 pass, 0 fail, 7 cancelled, 17 skipped -- `test/worldgen.test.js`
itself is the one cancelled-by-timeout entry among those seven, every
other cancellation downstream of it in the same run. Zero regressions
from this round's own 42 real new tests (`test/country-packs.test.js`
going from 107 to 115 -- not 12 more exactly, because three of the
sixty-first standing rule's own tests were loosened rather than
weakened to describe this round's honestly-mixed real data, per this
file's own header).

**A sixty-fourth, and it is this round's own deferred entry, written
after the fact for the identical reason the sixty-second rule's was --
this file was mid-flight under a concurrent round at the time.** Asked
directly to add "other parts of the prison staff, COs, nurses,
warden... all the professions of the penitentiary," three real,
BLS-SOC-coded occupations closed it in `occupations.js`: `guard`
(SOC 33-3012, "Correctional Officers and Jailers," tiered with
`enforcer`'s basic-trades band rather than `officer`'s military-tactics
one), `warden` (SOC 33-1011, "First-Line Supervisors of Correctional
Officers" -- checked directly rather than assumed, and BLS genuinely
has no distinct "prison warden" title, so this is the real
closest-fitting supervisory code, stated plainly as a stand-in rather
than an exact match), and `nurse` (SOC 29-1141, "Registered Nurses" --
a different real code from `orderly`'s SOC 31-1133, confirmed as such
rather than assumed to be a duplicate).

**`organizations.type` has no `prison` value at all -- a real prison
in this engine is a `properties` row (`landmark_category === 'prison'`),
never an organization** -- so all three new occupations name
`government` as their real employer, the same way every other
government-adjacent role in this file already does, rather than
inventing a dedicated institution type the schema does not have.

**That surfaced a real structural gap, found rather than assumed, and
fixed at exactly the width it was found.** `landmarks.designate` never
set `operating_organization_id` for ANY hero landmark -- so a
generated prison had no real operator at all, and a hired `guard`
would have had nowhere real to work. `worldgen.js` now wires every
generated prison to the real region government (if scoped governments
are on) or the civilization government, right after that government is
founded -- the identical `operating_organization_id` link every other
employer-building in this engine already uses, not a new mechanism.
**Left deliberately open**: every OTHER hero landmark category (museum,
library, cathedral, and the rest) still has exactly the same missing
operator link -- named here as the honest, broader version of the gap
this round only closed for prisons, not silently expanded into.
Mutation-verified: the new wiring loop was temporarily disabled and
confirmed to fail the two new `worldgen.test.js` tests before being
reverted.

**The sixty-third standing rule's own `test/worldgen.test.js` hang was
re-confirmed as unrelated, not re-discovered as if new.** It still
reproduces with this round's changes present; the two new tests for
this round pass clean under `--test-name-pattern`, isolating them from
the pre-existing hang. Full suite excluding that one file: 2114 tests,
2097 pass, 0 fail, 17 skipped. Full suite with the same
`--test-timeout=60000` accounting the sixty-third rule used: 2010
tests, 1985 pass, 0 fail, 8 cancelled (the hang and everything
downstream of it), 17 skipped -- zero regressions from this round's
own additions either way. Live-verified the real server boots and
serves cleanly with these modules loaded; a full HTTP round-trip
through a generated world was not available in this environment for
the same pre-existing reason every round since this project's own
ninth standing rule has named -- Postgres unreachable here.

**A sixty-fifth, three related mechanics answering three instructions
given across one conversation: a real prison-to-street gang pipeline,
real danger-scaled recruitment with no invented threshold, and real
global incarceration data.**

**Part 1 -- "let certain gangs branch from the prisons to the
streets... connected depending on area, connections, organizations
that are connected."** `server/justice.js#ensureStreetAffiliate`/
`joinStreetAffiliate` reuse the exact substrate `ensurePrisonGang`
already established -- `engine.generateFaction` (the identical call
`worldgen.js`'s own ordinary street-gang generation makes, no new
archetype invented) and `membership.joinOrganization`, never a second
founding mechanism. `worldState.streetAffiliates` keys on
`${prisonGangOrganizationId}:${communityId}` -- one real affiliate
per (prison gang, community) pair, in-memory only, same posture
`worldState.prisonGangs` already carries. "Connected depending on
area" is the real, already-tracked `npc.communityId` a released
person is actually in -- nothing in this engine relocates a released
person, so this reports where they already are rather than inventing
a reunion mechanic. Wired into `release()`: a released prison-gang
member is connected to -- founding if necessary -- the real street
affiliate for their own gang in their own community; releasing a
non-member is a real no-op. Mutation-verified the area-branching
claim by collapsing the key to drop community scoping and confirming
three tests caught it.

**Part 2 -- "once the chaos starts to erupt, there will be a lot of
recruitment and added members for safety. This will depend on the
characteristics of people that they encounter. These things should
be put into our statistics as organizations, gangs, tribes, families
grow."** `server/recruitment.js#runChaosRecruitment` scales a flat
base rate (`crime.BASE_DEPRIVATION_RISK * 10`, a multiple of an
already-justified constant, the same documentation discipline
`influence.js`'s own `IMMEDIATE_FAMILY_BOND_BONUS` already holds)
directly by `crime.dangerByCommunity`'s own real 0..1 score --
deliberately no "chaos has erupted" threshold to calibrate, the
seventeenth standing rule's own four-attempt `resolveAggression`
lesson applied before the mistake rather than after. WHETHER a
recruitment happens is that danger-scaled seeded draw; WHO is
recruited is never that same draw -- it is the real eligible
candidate (resident, not already a member, not currently imprisoned)
with the highest real `influence.influenceRatingOf`, the literal
"characteristics of people they encounter," deterministic rather than
a second lottery. Scoped to real gangs only
(`membership.organizationPresence`'s own `isGang` flag) -- tribes
(`characterCreation.js`'s extended-family generation) and families
have no real "a stranger joins after the fact" mechanism anywhere in
this engine, named as an open, undone gap in both the module's own
header and a new `statistics.js` entry
(`tribe_family_recruitment_growth`, `unavailable`) rather than a
fabricated adoption mechanic. `chaos_recruitment_events` is the real
growth-over-time figure asked for, computed from a real in-memory
event log (standing rule 3), never a second stored counter. Wired
into `tick.js`'s existing Security phase, right after
`justice.runJustice` -- not a twelfth phase. The first mutation test
written for the deterministic-selection claim accidentally passed
against a broken version, because the planted high-influence
candidate happened to be first in iteration order anyway -- caught
and fixed by moving it to the last position before re-mutating, which
the fixed test then did catch. A second mutation (dropping the
imprisoned-exclusion filter) was also caught and reverted.

**Part 3 -- "tie this into the entire country prison system and out
the country prison system... in and out of the United States, North
America, South America, Africa, Europe, India, Asia."** A real
incarceration block (World Prison Brief / prisonstudies.org,
WebSearched fresh) was added to thirteen already-covered countries,
one representing each named region: `united-states`/`mexican` (North
America), `brazil`/`colombian` (South America), `nigerian`/
`south-africa`/`egyptian` (Africa), `german`/`russian`/`english`/
`french` (Europe -- `english` scoped explicitly to England & Wales,
not the whole UK, since Scotland and Northern Ireland run separate
prison systems), `chinese`/`filipino` (Asia). `india` is a new,
standalone `COUNTRY_PROFILES` entry -- no `ancestryPacks.GROUPS` key
needed, the fourteenth standing rule's own decoupled path -- added
because the instruction named it separately from "Asia" and it had no
entry of any kind in this file before now (World Bank
lower-middle-income FY2026-27; EIU rank 47/165, 2024, flawed
democracy, the real numeric score not found and left `null` rather
than guessed from the rank; SIPRI-derived 2.3% of GDP military spend;
a real net oil importer, not a producer). Same honest-sparseness
discipline as every prior round: Russia's and Mexico's own real
snapshots moved sharply between dates and both are kept side by side
rather than one picked; China's own headline rate is explicitly
scoped to Ministry-of-Justice sentenced prisoners only, with World
Prison Brief's own illustrative fuller estimate (pre-trial/
administrative detainees included) kept separate and flagged as
illustrative, never blended in. Mutation-verified by collapsing
China's scoped-vs-illustrative distinction and confirming a test
caught it.

**A real, unrelated gap the full suite caught, not introduced by this
round's own logic**: `server/recruitment.js` (Part 2, above) was
built and tested correctly and never added to
`VACANCY_INVENTORY.md` -- `test/inventory.test.js`'s own "every file
in server/ has a row" and "the stated file count is the real one"
caught it immediately or this would have been the two real failures
exactly the kind this file's own twenty-second standing rule already
warns about ("an ignored file is invisible, not untracked" -- this is
its sibling: a real, tracked, correct file simply never described).
Row added, count corrected 123 -> 124.

Full suite, this round's own final run across all three parts: 2028
tests, 2003 pass, 0 fail, 8 cancelled (the pre-existing, already-
documented `worldgen.test.js` hang plus seven collateral timeouts
under full concurrent load -- re-confirmed unrelated to any of this
round's own changes, same eight files every recent round has named),
17 skipped.

**A sixty-sixth, continuing `COUNTRY_PROFILES` with fourteen more real
countries plus Yemen's own new standard-field entry -- numbered the
seventeenth round in `countryPacks.js`'s own history, not the
sixteenth, because the global incarceration-system round (India,
World Prison Brief data) already claimed that number on this branch
between the fifteenth round and this one.** Same discipline
throughout: real WebSearched figures only, confidence-flagged where
secondary, honest `null` where nothing citable was found. Fourteen
countries, prioritised by population and real current significance:
Sudan, Algeria, Uganda, Tanzania, North Korea, Taiwan, the United Arab
Emirates, Nepal, Sri Lanka, Kazakhstan, Cambodia, Ecuador, Angola,
Mozambique -- plus Yemen, which gains the same six standard fields
every other `COUNTRY_PROFILES` entry carries, kept alongside its
existing, deeper `YEMEN_CONFLICT_2026` standalone narrative rather
than replacing it, the same two-tier pattern Venezuela and Cuba
already have.

Three real conflict classifications made rather than defaulted: Sudan
is `active-armed-conflict` (the real, ongoing SAF-RSF civil war,
CFR's own August 2026 tracker status "Worsening," ~14M displaced);
Ecuador is `high-nonstate-violence` (President Noboa's real January
2024 declaration of an "internal armed conflict" against criminal
gangs, following the "Fito" prison escape and a televised armed
takeover of a TV station); Uganda and Mozambique are `localized-
conflict` for the real ADF insurgency on the Uganda-DRC border and the
real ISIS-affiliated Cabo Delgado insurgency respectively.

Five countries got an honest `null` `regimeType`/`regimeScore` rather
than a wrong-year or unconfirmed figure, each for its own stated
reason: Uganda and Tanzania (the only figures found were explicitly
the 2023 score, not 2024); Nepal and Sri Lanka (the figures found
never clearly cited the EIU as their source); the UAE (no figure found
at all despite a dedicated search). Angola's pair are also `null`, for
the same "real disagreement, not picked" reason Chile's were in the
fifteenth round -- the one 2024 figure found (4.05) came from an
unnamed source and would sit right at this file's own hybrid/
authoritarian boundary (4.01) if real, exactly the kind of boundary
value not worth trusting on one unconfirmed source. North Korea's
`militaryExpenditurePctGDP` is deliberately `null` with a stated
structural reason, not an unresearched gap -- North Korea does not
publish usable military-expenditure data, and SIPRI's own database
excludes it for exactly that reason, the same shape this file already
gives Somalia's missing `regimeType`.

Three real, fully confirmed oil-producer figures, not sparse
placeholders: Angola's real 2024 output (Q1-Q3 average 1.134M bpd,
+4% YoY, falling to ~1.03M bpd by December, the lowest in years,
immediately after its real, dated OPEC exit); the UAE's real 2024
figure (~2.9M bpd under OPEC+ quota, ~60% of its own claimed
capacity); Yemen's — not a production figure at all, but the real,
current, World-Bank-confirmed fact that matters more: a Houthi
blockade on oil exports from IRG-held fields drove the IRG's own
revenue down to 2.5% of GDP in 2024.

Found and fixed live, not left for the fixture suite: three existing
tests (two from the fifteenth round, one from the global incarceration
round) had baked in an exact country count or an unconditional
assumption that this round's own honestly-mixed real data broke --
loosened to describe what the data actually is, same discipline every
prior round in this file has held to when the same thing happened.

Full suite, this round's own final run: 2048 tests, 2024 pass, 0 fail,
7 cancelled (the pre-existing `worldgen.test.js` hang and its
downstream collateral timeouts, unrelated to this round), 17 skipped.

**A sixty-seventh, covering two further `COUNTRY_PROFILES` rounds
together -- forty-one more real countries, `countryPacks.js`'s own
eighteenth and nineteenth rounds -- committed as one batch rather than
two, since both landed in the same working session before either was
pushed.** Same discipline throughout: real WebSearched figures only,
confidence-flagged where secondary, honest `null` where nothing
citable was found. `COUNTRY_PROFILES` now carries 79 real entries,
up from the seventeenth round's 38.

**Eighteenth round, twenty-three countries**: Belgium, Austria,
Denmark, Finland, Romania, Bulgaria, Serbia, Croatia, Moldova,
Belarus, Libya, Tunisia, New Zealand, Singapore, Uruguay, Paraguay,
Bolivia, Jordan, Lebanon, Qatar, Kuwait, Bahrain, Oman. Three real,
confirmed, fully-sourced oil/gas figures, not sparse placeholders:
Kuwait's real 2024 production (5th-largest OPEC producer, 2.415M bpd
in July, 2.44M bpd wellhead output in December), Oman's real
full-year 2024 total from its own National Centre for Statistics
(363.3M barrels produced, 308.4M barrels exported), and Libya's real,
volatile 2024 picture kept as a range rather than smoothed into one
number (~1.18M bpd in July, a real ~700,000 bpd drop in August's armed
shutdown crisis, recovery above 1M bpd by October). Qatar's real LNG
export leadership is reported as a status, not forced into a daily-
barrels figure that would misrepresent a gas-exporting economy as an
oil one. Libya is `localized-conflict` with a `governmentType` that
states its real divided statehood directly (rival Tripoli/Tobruk
governments); Moldova is `localized-conflict` for the real, frozen
Transnistria dispute, the same treatment Morocco's Western Sahara
entry already set a precedent for. Four regimeType/regimeScore splits,
each for a different real reason: Belarus (`authoritarian-regime`,
confirmed qualitatively via the EIU's own new "closed regime"
category, but no exact score found), Uruguay (`full-democracy`,
confirmed as "the only full democracy in South America," but the one
score found was explicitly the 2023 citation and not reused), Paraguay
and Bolivia (both `hybrid-regime`, confirmed via a real, named 2024
EIU category list, but their only numeric scores carried no stated
year). Jordan's `upper-middle-income` is the one upgrade this round
actually confirmed against a primary-adjacent table (the World Bank's
own FY2027 release names it directly as one of six economies that
moved up that cycle), not carried over from general knowledge.

**Nineteenth round, eighteen countries**: Switzerland, Iceland,
Luxembourg, Malta, Cyprus, Botswana, Namibia, Malawi, Zambia,
Zimbabwe, Rwanda, Burundi, Mongolia, Uzbekistan, Laos, Mali, Burkina
Faso, Niger. Mali, Burkina Faso and Niger are `active-armed-conflict`
on the clearest evidence in this whole file: all three are real,
current military juntas that jointly withdrew from ECOWAS, and all
three are named directly in the real 2025 Global Terrorism Index
(covering 2024 data) among the world's most terrorism-affected
countries -- the Sahel accounted for 51% of all global terrorism
deaths that year, Burkina Faso ranked #1 in the world for the second
year running (1,532 deaths), Mali recorded 604 deaths from 201
attacks, and Niger's ranking climbed from 10th to 5th-worst. None of
the three has a found EIU score; `governmentType` states the real
junta/ECOWAS fact directly rather than describing a government
structure that does not functionally exist right now. Cyprus is
`localized-conflict` for the real, unresolved 1974 Green Line division
-- the same treatment as Moldova's Transnistria and Morocco's Western
Sahara. Zimbabwe's regimeType/regimeScore are deliberately `null`,
the same wrong-year discipline the seventeenth round already applied
to Uganda and Tanzania -- the only figure found is explicitly flagged
as likely the 2023 edition under a February 2024 dateline. Namibia's
`lower-middle-income` is confirmed directly as the one country whose
classification moved DOWNWARD (from upper-middle) in the prior World
Bank cycle, a real, notable direction against this file's own usual
upward-mobility framing.

Full suite, this round's own final run: 2051 tests, 2026 pass, 0 fail,
8 cancelled (the pre-existing `worldgen.test.js` hang and its
downstream collateral timeouts, unrelated to this round), 17 skipped.

**A sixty-eighth, `countryPacks.js`'s own twentieth round -- thirty-
two more real countries, `COUNTRY_PROFILES` from 79 to 111.** Same
discipline throughout: real WebSearched figures only, confidence-
flagged where secondary, honest `null` where nothing citable was
found. Thirty-two countries, closing out West/Central Africa's
remaining real gaps, South Sudan/Eritrea, Central America, the
English-speaking Caribbean's remaining three, the Caucasus, the
remaining Central Asian republics, the Baltics/Slovakia/Slovenia, and
the Western Balkans: Ivory Coast, Senegal, Cameroon, South Sudan,
Eritrea, Togo, Benin, Gabon, Guinea, Sierra Leone, Liberia, Gambia,
Panama, Costa Rica, Nicaragua, Guyana, Suriname, Trinidad and Tobago,
Georgia, Armenia, Azerbaijan, Kyrgyzstan, Tajikistan, Turkmenistan,
Estonia, Latvia, Slovakia, Slovenia, Montenegro, Albania, North
Macedonia, Kosovo.

**Kosovo's regimeType/regimeScore are deliberately null for a
structural reason stated directly, not a research gap -- the EIU's
own index does not include it at all,** the same kind of real
exclusion Taiwan's entry already names for the World Bank's own
country tables.

**Five countries this round honestly null their regimeType/
regimeScore for the same wrong-year discipline Zimbabwe's entry
already applies**: Montenegro, Albania and North Macedonia (every
figure found is explicitly the 2023 edition, not 2024), Senegal (its
2023 and 2025 figures bracket 2024 without naming it), and Liberia
(no figure of any year was found at all). Guyana gets the identical
treatment for its own reason -- the only figure found is explicitly
the 2022 edition.

**Two real, named, structural facts reported where a figure might
otherwise be expected, not invented to fill the slot.** Panama and
Costa Rica both have a real, constitutionally notable absence of a
standing military (Panama abolished its own in 1990; Costa Rica
abolished its own in 1948, the more famous and longer-standing case)
-- `militaryExpenditurePctGDP` is `null` for both, and this is the one
round where that null is itself the reported fact.

**Four real, non-default conflict classifications, each a currently-
live, named dispute rather than a historical footnote.** Georgia
(the real, frozen, Russian-backed breakaway regions of Abkhazia and
South Ossetia, unresolved since 2008), Armenia (the real, recent
Nagorno-Karabakh situation after Azerbaijan's 2023 takeover), Cameroon
(the real, ongoing Anglophone/Ambazonia separatist conflict alongside
real Boko Haram activity), and Guyana (the real, escalated Venezuela-
Guyana Essequibo territorial dispute). South Sudan is `active-armed-
conflict` -- real, current instability since independence, not a
settled post-independence peace.

Full suite, this round's own final run: 2068 tests, 2044 pass, 0 fail,
7 cancelled (the pre-existing `worldgen.test.js` hang and its
downstream collateral timeouts, unrelated to this round), 17 skipped.

**A sixty-ninth, `countryPacks.js`'s own twenty-first round -- eleven
more real countries, `COUNTRY_PROFILES` from 111 to 122, and the first
round in this whole multi-round effort where honest research returned
more declines (nine) than builds (eleven).** Built: Chad, the Central
African Republic, the Republic of the Congo, Equatorial Guinea,
Djibouti, Mauritania, Mauritius, Lesotho, Papua New Guinea, Fiji, and
Timor-Leste. Same discipline throughout: real WebSearched figures
only, confidence-flagged where secondary, honest `null` where nothing
citable was found.

**Chad, the Central African Republic, and the Republic of the Congo
all keep `authoritarian-regime` but null their `regimeScore`,**
because three real sources disagree on the exact figure for each (no
single source confirmed as the EIU's own primary table) rather than
one of the three being picked. The Central African Republic is
`active-armed-conflict`, a real finding given its documented
instability since the 2013 coup, not a settled peace. Mauritius is a
real `full-democracy` at 8.23, the only one this file has found
anywhere in Africa. Fiji's `hybrid-regime` score of 5.39 is flagged
`secondary-estimate` since it came from an aggregator, not a
confirmed EIU primary-table figure. Papua New Guinea's `hybrid-regime`
score of 5.97 is a real, documented downgrade from the prior edition's
flawed-democracy classification, not a reused stale figure.

**Nine real candidates this round are honestly declined outright
rather than built thin, the first time declines have outnumbered
builds in a single batch:** Seychelles, Comoros, and Eswatini (no EIU
Democracy Index data found for any of the three, at all); Bhutan, the
Maldives, and Brunei (only V-Dem data was found for these three, and
V-Dem is not substituted for the EIU's own table this file otherwise
uses); and the Bahamas, Barbados, and Belize (a real finding, sourced
to a Congressional Research Service compilation, that the EIU's own
published Caribbean coverage list appears to exclude these three
entirely). No World Bank income classification was confirmable for
any of the twenty candidates researched this round, built or declined.

**This is reported as a real, reproducible ceiling, not a stopping
point chosen out of fatigue.** The remaining uncovered countries are
overwhelmingly smaller Pacific-island and Caribbean microstates and
European microstates -- exactly the category this round's own 9-of-20
decline rate came from. Continuing to force further rounds into that
same thinning pool would trade this file's own honesty discipline for
raw count growth, which the standing instruction this file follows
explicitly rules out.

Full suite, this round's own final run: 2076 tests, 2052 pass, 0 fail,
7 cancelled (the pre-existing `worldgen.test.js` hang and its
downstream collateral timeouts, unrelated to this round), 17 skipped.

**A seventieth, and it is `recruitment.js`'s own declared gap closed --
written after the fact for the same reason the sixty-second, sixty-
fourth and sixty-eighth rules' entries were, this file being mid-flight
under a concurrent round at the time.** The chaos-driven recruitment
mechanic (the fifty-first-adjacent instruction, "organizations, gangs,
tribes, families grow") had scoped itself to gangs only, because a
gang recruiting a stranger off the street under danger and a family
absorbing someone are not the same shape of event -- a family does not
recruit peers. `statistics.js`'s own `tribe_family_recruitment_growth`
read a declared `'unavailable'` rather than guess at a mechanism that
did not exist yet.

**The real, narrower mechanism that actually fits this engine's own
substrate is kinship absorbing an already-orphaned child under local
danger, not a stranger joining as a peer.** "Tribe" needed no separate
mechanism at all -- `engine.tribeIdFor` already reads a tribe straight
off `family_memberships`, the same real structure `characterCreation
.js`'s own extended-family generation already builds.

**A real version of the sixth standing rule's own trap was found and
avoided rather than repeated.** The obvious way to find a child's
parent -- `family_memberships.role === 'parent'` -- is dead on arrival
against a real generated world: `worldgen.js` assigns every ordinary
NPC the flat role `'member'`, and `births.js` never relabels a bearer
`'parent'` anywhere. Checked directly against a real generated world
rather than assumed. `parentIdsOf` reads `births.js`'s own real birth
record (`what: 'birth', who: [child, bearer, other?]`) instead --
closing the identical shape of gap the sixth rule first named, in a
new place. **Honestly scoped, not hidden**: only a child actually born
during the running simulation has a birth record to read a parent's
identity from, so an NPC present from initial world generation can
never be detected as orphaned by this mechanism -- stated plainly
rather than silently narrowing the claim.

**The absorbing family is picked by the real, already-existing
`families.unity` field** -- the family-side mirror of picking a gang's
recruit by `influenceRatingOf`, never a second invented score for the
same real question (which group, among those eligible, is the one that
takes this person in). Writes go directly to the passed `worldState`,
never through `engine.addFamilyMember` -- the same two-`worldState`-
divergence hazard `justice.js#ensurePrisonGang`'s own header already
names for a different function, avoided here on sight rather than
rediscovered.

12 new tests in `test/recruitment.test.js`; mutation-verified both of
this round's riskiest claims -- weakening "every parent dead" to "any
parent dead," and removing the own-family exclusion -- and both were
caught cleanly before being reverted. Full suite at landing time: 2111
tests, 2088 pass, 0 fail, 6 cancelled (the pre-existing `worldgen
.test.js` hang and its collateral, a separate concurrent fork's own
fix target at the time -- unrelated to this round), 17 skipped.

**A seventy-first, and it is the real root cause of the hang the
sixty-third and sixty-fourth standing rules documented twice without
ever finding why.** Traced with `--cpu-prof` rather than guessed:
`server/entityTraits.js#getLiveEntity`/`getEntityTraitsForEntity` did
an unindexed `.filter()`/`.find()` over the ENTIRE `entity_traits`
array on every single call -- 29% and 8% of CPU samples respectively.
`traitDrift.js` had already found and fixed this exact shape once,
locally, with its own `indexRows`/`rowsFor` (its own header already
says "ten million comparisons a tick... added twenty seconds to the
test suite") -- but that fix never reached `entityTraits.js` itself,
the canonical version 111 call sites across 31 files actually use.
`test/worldgen.test.js` hit the catastrophic case specifically because
it accumulates a module-global world across every test in the file by
its own design, with no reset, and one test runs 60 real ticks over
whatever had piled up -- measured at 300 NPCs and 38,000+ trait rows
before that test's own `generateWorld` call even ran.

**Fixed at the canonical layer, not patched locally a second time.** A
`WeakMap`-keyed, per-`worldState` cache in `entityTraits.js`, the same
proven shape `traitDrift.js` already uses. It invalidates on the
array's identity changing (a full replacement, e.g. after a restore)
or its length changing (an ordinary append) -- `entity_traits` rows are
append-only everywhere in this engine, confirmed directly rather than
assumed (every real writer is `births.js` plus three sites in
`engine.js`; nothing splices or reassigns a row out), so a length check
catches every real mutation, and rows already indexed are the same
object references the flat array holds, so an in-place write needs no
invalidation at all. Mutation-verified: disabled invalidation,
confirmed a newly-generated NPC's traits vanished from a warmed cache
(0 rows instead of the real 122), then confirmed the real fix finds
them.

**`test/entity-traits.test.js` is this file's first test file ever** --
the same gap the twenty-sixth standing rule closed for `seeded.js`
(imported by seven modules); this one is imported by thirty-one. Nine
new tests cover the exact failure mode mutated against, plus the
restore-shaped full-array-replacement case, the in-place-write case
that needs no invalidation, and structural reuse of the cached map
across repeated reads.

**Fixing the hang surfaced a second, real, previously-masked
regression rather than causing one.** Letting `test/worldgen.test.js`
run to completion for the first time exposed a stale assertion whose
expected declared-gap count had drifted to a transiently-real `10` --
two concurrent rounds in the same session, one opening a tribe/family
recruitment gap and another closing it before either had committed --
corrected to the real current `9`.

`test/worldgen.test.js` now completes in ~133s (was: never, for the
entire life of this defect). **Full suite, genuinely complete for the
first time this session with no exclusion and no `--test-timeout`
workaround**: 2216 tests, 2199 pass, 0 fail, 0 cancelled, 17 skipped.

**A real, separate, declared-not-fixed finding from the same
profile**: `technicalSkillIn` (10% of samples) and
`ownedPropertyValue` (7%) are secondary hot functions, unrelated to
this hang -- the file now completes in bounded time without either
being touched -- named here as a real future optimization target
rather than silently left for someone to re-discover from scratch.

**A seventy-second, and it is a third real path layered onto
`countryPacks.js` rather than a fourth keying scheme invented to hold
it.** Asked directly for "known resources in that country... what
they're known for, what they produce, what they import,"
`RESOURCE_PROFILES` covers 23 of this module's own ~165 real countries
-- `COUNTRIES` keys on an `ancestryPacks.GROUPS` code, `COUNTRY_
PROFILES` keys on a hyphenated country name, and several ancestry keys
already collapse onto one real country (`english`/`scottish`/`welsh`
-> United Kingdom); a resource fact is a fact about the COUNTRY, so a
third table keyed a third way would only have multiplied the lookup
problem this file has already reconciled once. `resourceProfileFor()`
instead resolves ANY real key this module already accepts onto one
real `RESOURCE_PROFILES` entry, keyed on `canonicalCountryKey()`'s own
derived name.

**Chosen for real economic distinctiveness and research tractability,
named as such rather than left to look comprehensive.** Top exports
(and what each country is "known for") are real and WebSearched for
all 23; top imports are real for exactly 5 (United States, China,
Germany, Saudi Arabia, India), with an honest `null` everywhere else --
the same sparse-rather-than-guessed posture this file has held since
the fifty-first standing rule, applied to a new dimension.

**Every export/import source this round disagreed with at least one
other source, for a real structural reason worth stating once rather
than re-discovering per entry**: different trade-data aggregators
group HS (Harmonized System) codes at different levels -- a
"machinery" category versus "electrical machinery" versus both
combined -- so two real, correctly-sourced figures for the same
country and year can legitimately disagree without either being wrong.
Nigeria's crude-petroleum export share is the clearest case on file:
63.5% (Trading Economics/NSW), 71.39% for crude alone and 88.26% for
the wider petroleum-products category (Intelpoint) -- all three real,
all three kept, none picked, the same "neither picked over the other"
posture this file has used for disagreeing homicide-rate figures since
the fourteenth round.

Same report-only posture as every other field here, proven rather than
asserted: a real test greps `server/` and asserts `RESOURCE_PROFILES`/
`resourceProfileFor`/`describeResourceProfile` appear in exactly one
file, `countryPacks.js` itself. Wiring a country's real resource
profile into `barter.js`/`economy.js` trade mechanics is separate,
future, calibrated work -- the same boundary `conflictLevel` and
`oilProducer` already hold. Full suite at landing time: 2216 tests,
2199 pass, 0 fail, 0 cancelled, 17 skipped.

**A seventy-third, and it is the real training-loop design discussed
and queued earlier this session, built now -- plus a real bug caught
by its own test before it ever committed.** Asked directly for "a
progression of a person could depend on who they're around... a small
organization that is congruent and all act as one is more valuable
than a large organization... that don't act as one," this generalizes
the real, already-existing `familyTraits.cohesionOf` rather than
inventing a second, disagreeing "group synergy" score.

**`organizationTraits.cohesionOf` is the organization-tier sibling,
with one real, stated asymmetry rather than a silently-approximated
copy.** `familyTraits.cohesionOf` reads `families.unity`/`.conflict`
-- STORED, slow-moving stocks `advanceCohesion` nudges a little at a
time. Organizations have no equivalent column, and adding one is a
real, separate, future schema change, not folded into this round. So
the organization version computes its unity/conflict terms LIVE, off
`relationships.trust`/`.conflict` between the org's own real current
members, every call -- an organization's cohesion can swing in a
single tick where a family's cannot, an honest consequence of what
each entity type's schema actually offers rather than an inconsistency
to paper over. `internalLoyalty` (the real, already-generated
organization trait) stands in for `cooperation`'s role, read through
`getLiveEntity` per the ninth standing rule, never the frozen sheet.

**`traitDrift.groupCohesionMultiplierFor` is the actual mechanism,
and it changes RATE, not direction, deliberately not touching the
file nearby that already models direction.** `driftRelationships`'s
own header already says widening its influence list further would be
"inventing a theory of influence" -- this is a narrower, different
claim: practising a habit pays off faster inside a cohesive group,
exactly like a real training partner or a well-drilled team, and
touches only `driftExperience`'s existing growth-rate calculation.
Reads the MAX cohesion score across an entity's family and every
organization they belong to (never an average -- a person training
inside their one genuinely tight-knit crew should get that crew's
benefit, not have it diluted by also belonging to a loose, uninvolved
group) and shifts it to centre on 1 (`0.5 + cohesion`), so an ordinary
person in an ordinary group trains at exactly the rate they always
did -- the twelfth standing rule's first clause, carried into a third
place.

**The bug, caught by the test written to prove the MAX claim, before
this round ever committed.** The first version of this function
computed the AVERAGE of available cohesion scores -- the literal
opposite of its own header's stated reasoning, and the test named
"takes the MAX cohesion across every group, never an average" failed
against it immediately: `1.025 !== 1.25` on a world built specifically
so the organization was the more cohesive group. A test that states
the property it is proving, the way this one does in its own name,
is what caught a real implementation bug a vaguer assertion would
have missed. Fixed to `Math.max(...scores)`, and the header's own
measured distribution was re-measured against the corrected version
rather than left describing the one that shipped with the bug still
in it -- measured on a real generated world (180 NPCs, 152 in at
least one family or organization): this multiplier ranges 0.841-1.172
(p10 0.92, p50 1.078, p90 1.16) across that population.

28 tests (`test/trait-drift.test.js` extended, plus the new
`test/organization-traits.test.js`). Full suite: 2230 tests, 2213
pass, 0 fail, 0 cancelled, 17 skipped.

**A seventy-fourth: mission triggers, open to all four main-character
categories, through two real fields instead of one.** The per-location
power hierarchy round scoped `missionTriggers.js` to criminal only,
because `missions.generateMission`'s own `controllingFactionId`
validation requires `organizations.isFaction === true` -- never a
government, religious order, or business. Asked to close that gap, the
other three categories route through a different real field instead of
forcing a faction check they could never pass: no `controllingFactionId`
at all, then `mission.issuing_organization_id`/`.issued_by_entity_id`
set directly -- the identical in-memory-only pair
`leadership.js#directMission` already established for exactly this "a
real organization is behind this job, and it is not a faction" shape.
Reused rather than duplicated, and confirmed to have no schema column
either (`migrate.js`'s own `missions` INSERT does not name them, the
same honest posture `city.healthBaseline`-class fields already hold
elsewhere in this registry).

`maybeTriggerMission` checks `mainCharacters.mainCharactersOf`'s four
categories in that function's own listed order (criminal, political,
religious, business) and uses the first one with a real, installed
leader. **One combined roll, not four** -- the overall trigger rate is
unchanged from the criminal-only version, so this widens WHO a job can
come from without widening HOW OFTEN one appears, the same discipline
the fifty-first standing rule's own country-coverage work held for a
different kind of expansion. 8 new tests, including all three
real priority-order permutations; mutation-verified directly by
reversing `CATEGORY_ORDER`, which broke exactly the 3 tests written to
prove it.

**A seventy-fifth: the two hot functions the seventy-first standing
rule's own `--cpu-prof` run named and declared, now actually fixed.**
`technicalSkillIn` (10% of samples) and `ownedPropertyValue` (7%) share
the identical root shape the `entityTraits.js` fix already closed one
layer down: a full-array rescan repeated far more often than the
underlying data actually changes.

`infrastructure.technicalSkillIn` now caches its result per
(`worldState`, `cityId`, `tick`) in a `WeakMap` keyed on `worldState`
itself. `advanceInfrastructure` calls `effectiveMaintenance` once per
infrastructure ROW, and a city ordinarily has several, so the full NPC
scan ran once per row per city per tick instead of once per city per
tick. **This cache needed a different invalidation rule than
`entityTraits.js`'s own, and the reason is stated rather than copied
blindly**: it caches a computed AGGREGATE (a mean over live traits),
which an in-place trait write changes without touching any array's
length -- so it invalidates on the TICK NUMBER changing, not on array
identity or length, correct specifically because trait drift runs as
its own, separate tick phase, never interleaved with the
infrastructure pass that reads this.

`property.getCurrentOwner` now reads a real per-worldState index (one
pass over `ownershipRecords`, grouped by property id) instead of
rescanning the whole array on every call -- `economy.ownedPropertyValue`
calls it once per property in the world for a SINGLE entity's net
worth, the real O(properties × records) cost the profile caught. This
one DOES use `entityTraits.js`'s own array-identity/length invalidation,
because the underlying fact is different in exactly the way that
matters: `ownershipRecords` is append-only everywhere in this engine
(confirmed via `grep`, one real writer, no splice or reassignment), and
an ownership record is never edited in place once written -- so there
is no in-place mutation this index could ever miss, unlike the live
trait sheet `technicalSkillIn` reads. `property.getHoldings` benefits
from the same fix for free, since it already calls `getCurrentOwner`
once per property too, and was not touched separately.

**Both caches are tested for invalidation, not just for the values
they return** -- a real in-place trait mutation confirmed invisible
within the same tick and visible the moment the tick advances; a real
new ownership record confirmed to invalidate the cached owner rather
than ever serving a stale one. Mutation-verified twice each: disabling
caching entirely, and disabling the invalidation condition specifically,
each broke the test written to prove the corresponding property.

Full suite: 2240 tests, 2223 pass, 0 fail, 0 cancelled, 17 skipped --
measurably faster end to end (roughly 266s this run against roughly
357s the round before, same machine, not a controlled benchmark but
consistent with the fix doing real work).

**A seventy-sixth, and it closes the broader gap the forty-sixth
standing rule's prison fix named and deliberately left open: "every
OTHER hero landmark category... still has exactly the same missing
operator link."** Asked directly, by name, for museums, libraries,
cathedrals, mosques, synagogues, rabbis, imams, priests, gyms,
skyscrapers -- "everything incorporated with all of that." Runs AFTER
the civilization seat is chosen, deliberately: the seat picks "the
first property with no operator yet," and wiring more landmarks before
that check would change which property becomes the seat on worlds that
already generate one today. Three real shapes, one per landmark
category of staff, read from `landmarks.KEY_BUILDING_TYPES` itself
rather than a second, hand-copied list.

**Government-propertyType landmarks** (university, hospital, library,
school, government-building) get the same real operator prisons
already use. **Religious landmarks** (church/mosque/synagogue/temple)
reuse the community's own real religious order if one was founded
(`religiousOrdersPerCommunity`) and now carry a real, reported title
matching the specific building -- priest, imam, rabbi, or "religious
leader" for a temple -- while the underlying EMPLOYABLE occupation
stays `preacher` throughout, the same single-grain discipline
`athlete`/`entertainer` already hold (a title does not need its own
tier/skill/employer set to be real). **Everything else with a real
staff slot** (skyscraper, airport, train-station, art-museum, theater-
concert-hall, zoo-aquarium, stadium-arena) gets a real, freshly founded
business organization, the identical shape this file's own ordinary
business generation already uses -- `leader_id` left null on purpose,
since giving every organization in this engine a real founding leader
at generation is its own real, separate, future round.

**A real bug caught before landing, not after.** A community with MORE
than one real religious landmark (the random hero-landmark draw does
not cap how many a community can get -- measured directly: a seed
produced one community with a temple, a synagogue, AND a church all
sharing one order) let the second and third landmarks silently
overwrite the first's title on the one shared organization, since the
original wiring had no guard against re-claiming an order that had
already claimed a different building. One real organization cannot
coherently be both "the synagogue" and "the mosque." Fixed with a
claim guard keyed on whether the order already carries a
`religiousTitle` -- first real landmark wins, a second, DIFFERENT one
in the same community is left honestly unoperated rather than wired
under the wrong title. Mutation-verified: disabling the guard broke
exactly the test written to prove it.

**A real, pre-existing interaction found along the way, not caused by
this round, and not fought with.** A commercial-ranked hero landmark
can already be claimed by the `CITY_INSTITUTIONS` housing pass
(school/hospital/library) or by a real faction, both of which run
earlier in the same per-city pass and grab "the first free, ranked-
commercial-first property" with no regard for landmark category --
measured directly: a real skyscraper ended up operated by a city's own
library institution on one seed, which is a legitimate real outcome
(a library occupying space in a commercial tower), not a bug. This
round's own pass only creates a fresh business for whatever is STILL
unoperated by the time it runs; the tests check for any of these real
outcomes rather than asserting away mechanisms this round does not
own.

6 new tests. Full suite: 2245 tests, 2228 pass, 0 fail, 0 cancelled,
17 skipped.

**A seventy-seventh, and it closes the forty-eighth standing rule's own
measured gap: "on a freshly generated, never-ticked world, the
criminal and business categories resolve honestly null almost
always."** Only the religious-order archetype ever installed a real
founding leader at generation; gangs, governments, and businesses all
waited on a real election or a real takeover, neither of which runs
automatically from the tick pipeline. `config.foundingLeaders`
(opt-in, default false, the identical posture `extendedFamily`/
`scopedGovernments`/`religiousOrdersPerCommunity` already hold)
generalizes the religious order's own real `influenceRatingOf`
selection to the three remaining types.

**No new bookkeeping was added to find each organization's real
scope** -- every scope is read from a real, already-existing link,
never inferred or guessed: a gang's scope is the communities it
actually holds real territory in (`territoryBlocks.faction_id`); a
business's scope is the community of a real property it actually
operates (`properties.operating_organization_id`, this file's own
long-standing link and the seventy-sixth standing rule's own
landmark-operator pass's output); a government's scope is its own
real `governments.scope_type`/`.scope_id` row. An organization with no
real scope to read -- a gang holding no territory, a business
operating no building -- gets no founding leader this round, an
honest gap rather than a guess.

5 new tests, including a dedicated two-real-city check proving the
city-government scoping is real rather than vacuously true against a
world that can only ever generate one city (`cities: 1` is this
file's own real default). Mutation-verified directly: disabling the
city-scoping branch broke exactly the two tests written to prove it.

Full suite: 2250 tests, 2233 pass, 0 fail, 0 cancelled, 17 skipped.

**A seventy-eighth, and it closes a gap standing rule 5 itself had
named since before this file had a numbered rule at all.** That rule
has always listed six ecosystem apps to link to, never rebuild:
"Vavlt Stvdios, Vvltvre, DREAMS, VENVS, V4, VASH." The Phase 4
"Digital Planet" round (see this file's own fifty-eighth standing
rule) built real routes for only four of the six and said so plainly
at the time -- "four real link generators this round, not five"
(counting Vvltvre's two sub-apps as one line). V4 and VASH sat
unlinked the whole time, found again only when asked directly to
check everything this ecosystem touches.

**Each real address was checked against the sibling's own route table
first, the same discipline every other line in `ecosystemLinks.js`
already holds -- neither was guessed.** V4: this file's own naming
note at the very top already says "the real operating network V4 and
its named agents run inside, with V4 as the interface layer to it" --
a real, addressable unit there is a named agent's own twin profile,
`GET /api/twins/:agentId` in `../v4-proxy/server.js`, public, no auth,
the exact route that app's own frontend-coverage pass already named
"Look up a twin profile." VASH: this file's own "What NOT to build"
section already says a VACANCY banking API should "route through VASH
conceptually, not a parallel banking API" -- a link-out is exactly
that routing, so building one is following that line, not working
around it. The real, addressable, UNAUTHENTICATED unit is a Tap's own
public resolution, `GET /api/taps/:tapCode/resolve` in
`../vash-tap/server.js` -- the one VASH route with no session
requirement at all, deliberately NOT the plain record lookup (which
returns less) and deliberately NOT `.../pay` (which moves money and
requires a real session this file's link generators have never
asked for).

**`v4TwinLink`/`vashTapLink` reuse the identical `gatedLink` helper
every other generator in this file already calls** -- no second gate,
no new threshold. Mutation-verified directly: temporarily had
`v4TwinLink` build its response without going through `gatedLink` at
all, confirmed the dedicated "refused pre-threshold" test caught it
immediately, then reverted.

**A seventy-ninth, and it is three real gaps closing at once rather
than one new mechanic: who can go rogue, what they become, and why
nobody had ever been able to answer the first question at all.** By
direct instruction: "after the police forces disassemble after the
chaos... officers who already were crooked... will organize
underground military and police forces," with real access to
weaponry, scaling "from small towns all the way to all the
countries," and who "try to use that force" as soon as they form.

**The real trigger needed no new flag: `authority.writOf` reading
`lawless` already IS the state's writ collapsing somewhere.** No
second "the government disbanded" event was invented -- a government
organization can persist elsewhere in the world while one real
community it nominally covers simply stops being reached by it,
exactly the granularity "small towns" asked for.

**Who defects turned out to have nobody to defect, and that was a
real, already-documented decision, not a bug -- found by trying to
measure it before building anything.** `occupations.js#OCCUPATIONS
.officer`'s own `employers` have always included `government`, and a
direct measurement (`generateWorld` with real population, counted)
confirmed zero officers in every world, at any size. `worldgen.js`'s
own `founding` posts block already explained why, in its own words:
"an officer belongs to a military organization, which no world
generates yet." That reasoning was sound on its own terms in 29 Aug
2026 and is why the fix is a NEW opt-in flag (`config.securityForces`,
default false) rather than a retroactive change to the same posture
-- one real officer founding post per real city a government's own
scope covers (`politics.scopeCitiesOf`), the identical "small town to
country" scaling the request itself asked for. Off, every existing
call to `generateWorld()` gets the exact unchanged world the whole
suite already asserts against -- confirmed directly, byte-for-byte,
same seed, officer count 0 either way until the flag is set.

**"A lot of them already were crooked" is a real trait nothing had
ever read: `leadership.'Corruption Risk'`, generated on every NPC
since the twelfth standing rule's own pass.** Measured across ten
generated worlds (40 real officers, `securityForces: true`): roughly
uniform 13-95, mean ~56. `CORRUPTION_DEFECTION_THRESHOLD` is the trait
scale's own neutral centre (50) -- the twelfth standing rule's "centre
on the average person" read here as a selection cut rather than a
modifier -- and against the measured distribution it captures a real
majority, which is what "a lot of them" asked for rather than a rare
tail.

**What they become is the archetype vocabulary `orgArchetypes.js`
already built and never called, not a new mechanism.** That file's
own header already anticipated exactly this: "a scenario that wants a
specific named organisation supplies the name... nothing here founds
one." `'rogue security force'` is the new entry, `isFaction: true`
for the identical reason `militia`/`prison gang` already are -- a
body that cannot hold a real `territory_blocks` row cannot "try to
use that force" against anything real. `server/roguePolice.js` is the
one real, scenario-side caller that file's header always said would
eventually exist.

**What they keep is gated by the one honest line this engine already
drew for military-grade weaponry, never a second one.** Every
defector keeps an ordinary `pistol` (plausible remnant stock for
anyone who carried one on the job); only the new force's own leader
-- chosen by the real highest `influence.influenceRatingOf` among the
defectors, the founding-leaders round's own selection rule, not a
second "most corrupt wins" rule -- gets an upgraded `rifle`, and only
where `weapons.regionHasTrackedMilitaryCapability` is real and open.
Never `machine_gun`: that stays restricted to a government actually
holding the building, not a faction that has just lost it.

**"Try to use that force" is the real territorial read every other
faction's hold is already judged by, not a second conquest system.**
`territory_blocks` already tolerates more than one faction's claim in
the same community, with `authority.holderOf` already resolving which
one is actually stronger by real live traits. So the new force's
first act is exactly a real `generateTerritoryBlock` call, resolved
the same tick by the real `resolveTerritoryControl` -- no new logic,
the identical mechanism `tick.js#runOrganizationPhase` already
resolves every other faction's hold by, now wired to run immediately
before that same loop so a freshly formed claim is read in its first
tick rather than its second.

**Idempotence is structural, not a guard that has to be remembered.**
A community that has already defected has no real officer left
employed by the government that lost them -- `corruptOfficersOf`
reads empty the next time the scan runs, the same way `justice.js`'s
own answered cases cannot be answered twice, because the real
substrate the check reads has already moved.

**Wired unconditionally into `tick.js#runOrganizationPhase`, the
identical posture `runPolitics` itself already holds there** -- no
second opt-in flag at the tick level, because `scanForCollapsedPolicing`
is a real no-op by construction in every world that never turned on
`securityForces` at generation: there is no officer corps anywhere
for it to act on. Confirmed live on a real generated, ticked world
(two real cities, `securityForces: true`, 20 ticks): two real rogue
security forces formed, zero crashes.

Mutation-verified: temporarily widened the regime gate from `!==
'lawless'` to `=== 'governed'` (letting a merely `contested` community
through), confirmed the dedicated "refuses a merely contested
community" test caught it, reverted.

**An eightieth, closing `crime.js`'s own declared, ungenerated `fraud`
category -- by direct instruction, among a wider request for
"corruption at all levels... scamming and scheming all over."**
`CATEGORIES.fraud`'s own substrate note had already named the real
gap precisely: "market_listings resolve honestly and there is no
contract, claim, insurance or instrument to falsify." `server/
fraud.js` adds no invented instrument to falsify -- a false PROPERTY
SALE is the one real transaction type `properties`/`ownership_records`
already support without one: a perpetrator offers a real property
they do not hold title to (`property.getCurrentOwner`), a real victim
pays a real deposit, and no title is ever actually transferred because
the perpetrator never had one to give.

**Gated on the real, already-read `criminal.Deception` trait --
`policing.evasionOf` and `bluff.js` already treat it as "how good this
person is at making someone believe something false," reused rather
than a second, disagreeing "scheming" trait.** `BASE_FRAUD_RISK`
(0.0006 at Deception 100) is the same order of magnitude `crime
.BASE_DEPRIVATION_RISK` already uses at full pressure, scaled by
`deception / 100` directly -- a gate deciding whether the offence
happens at all, the same shape deprivation's own pressure term already
is, not a modifier perturbing an existing baseline the twelfth
standing rule's "centre on 50" would otherwise apply to. Measured on a
400-tick, 2-city generated world: 37 real fraud incidents against 12
real theft/property incidents in the same world -- fraud reads as the
more common offence once deception alone gates it, with no poverty
line to clear first, which is the real shape "scamming and scheming
all over" asked for.

**The real wealth movement reuses the one precedent this engine
already has for crediting money into somebody's savings, generalized
to debit the other side too.** There is no general "adjust this
person's money" function anywhere in `economy.js` -- only a generator
and a reader of the latest `individual_finances` row.
`engine.js#payMissionReward` is the one real precedent for moving
money this way; `fraud.moveSavings` is the identical two-row shape,
applied to both sides of a transfer rather than one.

**A victim's own knowledge of what happened needed no new mechanism
either.** `crime.recordCrime` already draws the victim's post-incident
knowledge from the offender's own `criminal` family (Stealth,
Deception, Black Market Ties, Heat Tolerance) against the victim's
perception -- the exact "how good was the con, and how perceptive was
the mark" question a fraud victim's own partial, sometimes-wrong
knowledge already needed, read by nothing new.

Mutation-verified: a single call's own `seededDraw` is a real per-tick
probability, not a guarantee, the same reason `test/crime.test.js`'s
own `runDeprivationCrime` tests loop hundreds of ticks rather than
asserting on one call -- `test/fraud.test.js`'s own end-to-end test
does the same, looping until a real incident lands. Temporarily
removed the `seededDraw` gate entirely (every eligible NPC defrauds on
every tick); confirmed the dedicated "only fires probabilistically"
test failed immediately, reverted.

**A second, separate real gap found while building this: `occupations
.js`'s own `guard`/`warden`/`nurse` ("COs, nurses, warden — all the
professions of the penitentiary") were exactly the `officer` shape all
over again -- defined, real employers named, and never once hired.**
Measured directly before writing anything: zero guards, zero wardens,
zero nurses in a four-city generated world, at any population size.
`config.prisonStaffing` (opt-in, default false, the identical posture
`securityForces` already holds) hires one real warden and one real
guard per real prison, drawn from that prison's own real city
residents -- the same `cityResidents.find(unemployed, adult,
tier-reachable)` pattern the `CITY_INSTITUTIONS` hiring block already
uses for a school's teacher. A dirty-CO-in-league-with-a-real-prison-
gang mechanic needs a real CO to begin with; this is that prerequisite,
not the mechanic itself.

**Idempotence had to be added by hand to both flags, not assumed --
the fifteenth standing rule's own case study, twice over.** This
file's own test suite calls `generateWorld()` many times against one
shared, growing `WorldState`, and the first versions of both hiring
blocks iterated every government/property that has EVER existed in
it, with no check for whether a given city or prison already had its
real officer or its real warden and guard. A second call would have
hired a second, third, unbounded corps for the exact same city every
time it ran. Fixed by marking the real, already-covered case directly
-- an officer corps checked per (government, city) pair via a real
employment-record lookup, a prison checked via a new in-memory-only
`staffed` flag on the property itself, the identical posture
`organization.archetype` already holds. Caught by this round's own
new tests failing with inflated counts, not assumed correct from a
clean read of the diff.

**A third, real, and strictly separate bug the same debugging pass
surfaced: `officer` candidates were never scoped to the hiring city at
all.** The first version of `config.securityForces`'s own hiring loop
searched every NPC in the whole world for "the first unemployed adult
who reaches tier 5," with no city filter — which could, and in one of
this round's own tests' seeds did, station "this city's officer" in a
city they do not actually live in. That would have silently broken
`roguePolice.js`'s own `localOfficersOf`, which correctly reads an
officer's real `communityId` and would have found nobody for a city
whose nominal officer was never really there. Fixed to search only
`cityCommunityIds`-matching residents, the same scoping `prisonStaffing`'s
own hiring already uses. Found by a test assertion failing with a
plausible-looking but wrong count (2 of 3 cities staffed), not by
inspection.

**A fourth, found and deliberately left alone: `politics.scopeCitiesOf`
returns every real city for ANY civilization-scoped government,
regardless of that government's own real `scope_id`.** Surfaced while
debugging the third bug above, in a world carrying two real
civilization-scoped governments (`scope_id: 1` and `scope_id: 2`) from
two different real civilizations — both ended up trying to hire an
officer in the exact same handful of cities, neither correctly scoped
to its own civilization. This is real, pre-existing, and strictly
`politics.js`'s own concern, not `securityForces`'s or
`prisonStaffing`'s — named here rather than fixed in passing, since
fixing it would change `scopeCitiesOf`'s own behavior for every other
real caller that already depends on its current shape (elections,
legislation, revolutions), which is exactly the kind of retroactive
change this file's own standing discipline warns against making
without being asked.

**An eighty-first, and it is a real actor-driven cause sitting right
beside an area-wide one that already existed.** `justice.js#
runPrisonBreaks` already fires exactly once, for every inmate, the
moment a prison's own community crosses into `lawless` — a real
mechanism, built before this round, for "the state's own writ gave
out here." It does not cover the user's own distinct request: "the
dirty COs... in cahoots with the gangs in jail... are the ones that
start the prison breaks" — a corrupt STAFF MEMBER acting on behalf of
a specific gang, which has to be able to fire before the surrounding
area ever goes fully lawless, and has to release only that gang's own
members, never the whole population the way an area-wide collapse
does.

`justice.js#runCorruptGuardBreaks` is the new, additive function,
gated on three real, already-measured signals, never an invented one:
a real prison gang already exists at this prison
(`worldState.prisonGangs[prison.id]`, founded the identical way
`ensurePrisonGang` already founds one); at least one real `guard`/
`warden` employed there reads `leadership.'Corruption Risk' >= 50` —
restated locally as `CORRUPT_STAFF_THRESHOLD` rather than importing
`roguePolice.CORRUPTION_DEFECTION_THRESHOLD`, since the two modules
have no real dependency on each other and a local constant says so
honestly; and the prison's own community reads `contested` OR
`lawless` (never `governed`, never unmeasured) via the same real
`authority.writOf` this project's other collapse-triggered mechanics
already read — deliberately NOT requiring full `lawless`, because a
dirty CO in league with the inside does not need the whole area to
fall apart first, which is the whole point of distinguishing this
from `runPrisonBreaks`. Idempotent per-prison via a new in-memory
`worldState.corruptGuardBreakState` marker, the same shape
`prisonProperty.staffed` already took one round earlier. Releases
only the real gang's own still-imprisoned members, via
`membership.membersOf`, reusing the existing `release(..., { reason:
'prison-break' })` path rather than a second one — which is also what
already reports real living family on release, so "head back to
their family" for a broken-out inmate was already built.

Both new gates were mutation-verified: removing the regime check made
the "refuses a governed prison" test fail, and removing the
corrupt-staff check made the "no real corrupt staff, even with a gang
and real chaos" test fail — each reverted once confirmed. 4 new tests
in `test/justice.test.js`, full file 47/47, no regression to the
pre-existing `runPrisonBreaks`/`release`/`ensurePrisonGang` coverage.

**An eighty-second, and it is a stale declaration my own change left
behind rather than a pre-existing defect.** `crime.js#CATEGORIES.fraud`
still read `generated: false` with a `substrate` note saying "no
contract, claim, insurance or instrument exists to falsify" after
`server/fraud.js` (the eightieth standing rule) had already built
exactly that object. This is `gun`'s own precedent exactly — that
category's comment already records "joined the generated set when
server/inventory.js gave an offence something to be armed WITH," and
`fraud` needed the identical correction the moment its own declared
reason stopped being true, not a separate round to notice it. Flipped
to `generated: true` with a real `note`; `GENERATED_CATEGORIES` now
reads `[domestic, fraud, gun, property, theft, violent]`.

Two further callers had the same fact baked into fixed text rather
than derived from the flag, and both needed a real edit rather than
updating automatically: `test/crime.test.js`'s own `GENERATED_CATEGORIES`
assertion, and `prisonPacks.describePopulationCaveat`'s hand-written
`note` string (its `declaredAbsent` field is computed from the live
flag and updated itself; the prose beside it did not). **A derived
value updates itself when its source changes; a sentence describing
that value does not** — the twenty-fifth standing rule's shape, a
measurement (here, a category flag) and a claim about it drifting
apart, except the claim here was prose rather than an inference.

**An eighty-third, and it is two real, already-named gaps closing
together because the user's own words treated them as one authority:
"tribe, organization, delegation."** By direct instruction: "you can
assign things that can be done from your organization tribe... assign
them different tasks, and depending on your leadership, if they will
follow." `leadership.js#directMission` already covered one shape of
this — order a subordinate onto a real mission, gated on their real
`relationships.loyalty` — but a mission needs a real artifact or place
(`missions.js`'s own "never about nothing"), and "take care of the
kids," "on security" are not that.

`leadership.js#assignRole` is the new, lighter verb, and it adds no
invented vocabulary on either of its two real paths:

- **Organization path**: `organizations.leader_id` directing a real
  member's `role_in_org` — already open TEXT for any non-gang org per
  `membership.js`'s own header ("stores whatever role its own caller
  passes"). Refused outright for a gang or faction
  (`membership.isGang`), because `membership.assignGangTiers` runs
  every tick and would overwrite a player-assigned value on the very
  next pass — a refusal that says so, not a silent value that cannot
  stick.
- **Family path, and this is the real find.** `families.head_npc_id`
  had no directive of its own at all — Leader mode (the forty-seventh
  standing rule) is granted only by `organizations.leader_id`, so a
  pure family head could direct nobody. `family_memberships.role` is
  open TEXT too, but its OWN schema comment, unlike the organization
  table's, already names an exact set: "parent|child|grandparent|
  sibling|partner|guardian|mentor|founder|heir|black_sheep|leader|
  protector|caregiver." `characterCreation.js` had only ever written
  two of those (`parent`, `child`) — five real, functional values —
  `guardian`, `mentor`, `protector`, `caregiver`, `black_sheep` — sat
  defined and never once written, the eleventh standing rule's exact
  shape, found in the same table the twelfth and nineteenth rules
  already mined once each. `protector` is the real substrate for "on
  security," `caregiver` for "take care of the kids" — the user's own
  two examples, confirmed to already exist rather than invented to fit
  them. The other seven stay refused, because they are structural
  facts this engine already computes (kinship, succession's `heir`,
  `head_npc_id`'s own `leader`) and not a task a head hands out.

Compliance on both paths reuses `directMission`'s identical
loyalty-gated `seededDraw`, factored into one shared `complianceDraw`
rather than copied — the twenty-sixth standing rule's lesson, applied
to avoid a second, silently-different cutoff rather than to fix one
after the fact. `assign-role` is a new `actions.js` verb, and unlike
`direct-mission`/`broadcast-message` it is open to BOTH citizen and
leader mode — the family path needs no promotion to Leader mode at
all, the identical precedent `attempt-takeover`/`call-meeting` already
set for a real seat of authority that is not `organizations.leader_id`.
Both new refusal gates (the gang/faction check, the family-role
vocabulary check) were mutation-verified — each one caught by a real
test when removed, each reverted once confirmed. 10 new tests in
`test/leadership.test.js`, 2 more wiring tests in `test/actions.test.js`
(appended at each file's own end, for the same id-ordering reason the
file's existing comment already states), full suite 2291/2291 real
(17 honestly skipped), no regression.

**An eighty-fourth, and the "already run a certain amount of a town"
half needed no new code at all — only the conversion did.** By direct
instruction: "gang, tribes, organizations, religions, families could
already run a certain amount of a town or city or block through
drugs, religion, or whatever their organization holds power over that
community, through business. This will automatically put them into a
power position when the chaos kicks off. And then it is, from there,
it is their security and infrastructure that maintains it or loses
it." `membership.organizationPresence(worldState, communityId)` had
already answered the first half since the membership round that built
it — real member count per real organization resident in a community,
tagged by real `type` and real `influence`. The gap was narrower than
it looked: `territory_blocks.faction_id` can only ever name a real
`isFaction: true` organization, and `orgArchetypes.js`'s own
`'religious order'` entry deliberately set `isFaction: false`
("persuades rather than holds ground") — a real, considered decision
this round does not reverse for a GOVERNED area.

`server/dominance.js#claimDominantGround` is the new, narrow
conversion: the real organization that already dominates a community
(`dominantOrganizationOf`, government-type excluded — the state's own
collapse cannot make the state the beneficiary of it) flips its own
real `isFaction` to true and claims a real `territory_blocks` row the
moment the area's `authority.writOf` reading leaves `governed` —
`contested` or `lawless` both qualify, the same wider gate
`runCorruptGuardBreaks` (the eighty-first standing rule) already chose
over `roguePolice.js`'s stricter one, for the identical reason: an
actor already standing on the ground does not need the state to
finish collapsing first. The "try to use that force" step itself —
`territory.generateTerritoryBlock` + `resolveTerritoryControl` — is
reused verbatim from `roguePolice.js`, not reinvented a second time.

**"From there, it is their security and infrastructure that maintains
it or loses it" was already real and needed nothing new.**
`tick.js#runOrganizationPhase` already calls
`resolveTerritoryControl` for every real block, every tick, reading
the holder's own LIVE `power`/`territory` traits. The only new event is
the conversion; staying in power or losing it afterward was a live
mechanism before this file existed, which is itself a small instance
of this document's own eleventh standing rule's inverse — a mechanism
that already runs on everything it is handed does not need to be told
about a new kind of thing to hand it.

**Families (tribes) are named rather than folded in.**
`territory_blocks.faction_id` references `organizations.id`; a family
is a distinct root entity under standing rule 4's own parent/subtype
split, which does not make `families` a subtype of `organizations`.
Forcing a family through the organization-shaped structure here would
invent a second, disagreeing model of the same fact `control.js`'s own
takeover key already covers for a family's real route to holding
ground. Both new gates (the regime check, the already-held idempotence
check) were mutation-verified — each one caught by a real test when
removed, each reverted once confirmed. 9 new tests in
`test/dominance.test.js`, full suite 2300/2300 real (17 honestly
skipped), no regression.

**An eighty-fifth, and it is two real things built together because
the user's own message tied them together — a spy, and the record a
spy's own real success leaves behind.** By direct instruction: "gangs,
organizations, tribes, drug organizations, gangs, families can send
out a listener or spy to get information in the neighborhood...
multiple spies, however, whatever they want to do... the better they
are at listening, infiltrating, spying, is the more information they
will come back with... you can choose a range... close range,
mid-range, far away... keep a close eye, don't be seen, infiltrate the
whole organization." And in the same breath: "this allows NPCs to
become main characters in your tribe through their actions and their
usage."

`server/espionage.js#sendSpy` is sponsored through the IDENTICAL real
seat-of-authority check and loyalty-gated draw the eighty-third
standing rule's `assignRole` already established
(`leadership.complianceDraw`, exported for exactly this reuse rather
than copied) — a spy is SENT, not self-dispatched, so a reluctant
member can refuse the same way they can refuse any other order. "The
better they are" is a real, weighted composite —
`criminal.Stealth` (0.4), `criminal.Deception` (0.3), `social.
'Network Reach'` (0.3) — the `influenceRatingOf` shape applied to a
new question rather than a fourth composite invented from nothing.
"Close range, mid-range, far away" and "keep a close eye, don't be
seen, infiltrate the whole organization" are the user's own six words,
kept as six real, named values (`RANGES`, `STANCES`) rather than
expanded into an invented taxonomy — closer range and deeper
infiltration both raise a real, bounded detection chance and raise how
much a spy can plausibly return with, flagged interpretive like every
other hand-fitted band in this engine that has no document to cite a
real number from.

**What a spy brings back is real substrate this engine already had,
never a second information model.** `dominance.dominantOrganizationOf`
(the eighty-fourth standing rule) and `authority.writOf` already
answer "who runs this place and how far does the state's own writ
reach it" — exactly what a listener sent into a neighbourhood would
learn. `deep_infiltration` against a named organization additionally
reads that organization's own real, already-public-ish facts
(`leader_id`, `influence`, `isFaction`, real member count via
`membership.memberCount`) — never a private fact this engine has no
mechanism for an outsider to actually observe.

**Getting caught raises real heat with the specific organization that
caught them, and this does not reopen `heat.js`'s own declared
scope.** That file's header is explicit that faction heat rises only
when a faction actually ACTS on an offence
(`justice.answerByGroup`), never from passive, omniscient crime
awareness — and a spy detection is not that: it is the target
organization directly, personally catching the one specific person
who infiltrated it, a narrower and different event than the one that
header declines. `heat.raiseHeat` is reused with its own default
`HEAT_GAIN`, never a second number invented for the same idea.

**The "main characters through actions and usage" half did not reuse
the term, because the term was already taken.** `mainCharacters.js`
already owns "main character" for a specific, different, real thing —
the four per-community power-hierarchy leaders (criminal/political/
religious/business). Reusing the name for "a rank-and-file member who
has done a lot for their own tribe" would be two disagreeing answers
to what sounds like the same question — this document's own
twenty-first standing rule, aimed at a name instead of a data source.
`leadership.js#recordService`/`serviceRecordOf` is the real, measured
fact underneath the user's words instead: a running per-entity count,
incremented only on an actual COMPLIED outcome (never a refusal) at
all three real call sites — `directMission`, `assignRole`, and a
spy mission that returns undetected — and surfaced on
`getLeaderDashboard`'s own members list, so a human player can see who
has a real track record without this file guessing at a threshold for
"important" that nobody measured.

All three new gates (compliance short-circuits before any report; a
detection raises heat only against the specific named target; service
is recorded only on an undetected return) were mutation-verified —
each one caught by a real test when removed, each reverted once
confirmed. 11 new tests in `test/espionage.test.js`, 2 more in
`test/leadership.test.js` for the shared service-record counter, 1
more wiring test in `test/actions.test.js`, full suite 2314/2314 real
(17 honestly skipped), no regression.

## Active work
Phase 2. `dev-docs/` holds a folder per completed phase; `VACANCY_SEED.md`
is the live working document and `VACANCY_INVENTORY.md` is the file and
route inventory. Both are kept current — if either disagrees with the
code, the code is right and the document is a bug.
