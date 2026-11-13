# VACON-C — Server

**Naming note**: this project's correct, official name is VACON-C
(earlier docs, including the `VACANCY_*.md` source files kept under
their original filenames in this directory, call it VACANCY — retired
in favor of VACON-C going forward, a naming correction only, no
functional rebuild). Not to be confused with VACON (no "-C"), the
real operating network V4 and its agents run inside — see
`CLAUDE.md`'s own naming note for more.

Civilization simulation engine. See `CLAUDE.md` for scope, the locked
Day 1 order, and standing rules; `dev-docs/` for a phase-by-phase build
log of everything implemented so far.

## Setup

```bash
npm install
```

## Running against real Postgres (step 9)

`server/db.js` connects to a real Postgres instance;
`server/migrate.js` exports the current in-memory `WorldState` into it
in one transaction. To try it yourself:

```bash
# 1. Start Postgres and create the database (adjust for your system —
#    this assumes a local install with a postgres superuser available)
sudo service postgresql start
sudo -u postgres psql -c "CREATE ROLE vacancy WITH LOGIN PASSWORD 'vacancy_dev' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE vacancy OWNER vacancy;"

# 2. Load the real schema
PGPASSWORD=vacancy_dev psql -h localhost -U vacancy -d vacancy -f VACANCY_POSTGRESQL_SCHEMA.sql

# 3. Copy the env file (or export DATABASE_URL yourself)
cp .env.example .env
```

Then, from Node:

```js
const engine = require('./server/engine.js');
const { migrateWorldStateToPostgres } = require('./server/migrate.js');

engine.generateNPC({ name: 'Marcus Whitfield' });
// ...generate whatever else, run engine.advanceTick(), etc.

migrateWorldStateToPostgres(engine.WorldState).then(console.log);
```

## What "migrate off in-memory WorldState" does and doesn't mean here

`server/migrate.js` is a **one-way, one-time export** — a snapshot of
whatever `WorldState` currently holds, written into real Postgres
tables in one transaction (rolled back whole on any failure). It is
not a live sync, and it does not convert `engine.js`/`economy.js`/
`keys.js`/`tick.js` to query Postgres directly instead of their
in-memory arrays — every function in those files is still synchronous
and `WorldState`-based. Converting all of them to async, Postgres-
backed reads/writes is a substantially larger rewrite than this pass
covers; see `dev-docs/phase-9-postgres/tasks.md` for exactly what was
and wasn't done, and why.

## Real `/api/*` routes now exist (Phase 11)

`CLAUDE.md` requires keeping `/api/state`, `/api/tick`,
`/api/npc/generate`, `/api/mission`, and `/api/health`'s exact shape —
this was flagged repeatedly (since `dev-docs/phase-1-trait-split/tasks.md`)
as never actually built in any handoff: no Express routes file, no
`package.json` entry for one, no dev server. `server.js` (new) is that
real routes file, live on port 8809, wrapping `engine.js`'s already-
real, already-tested functions — no new simulation logic, purely the
HTTP layer that was missing.

**A second, real, false claim caught while building this**: CLAUDE.md's
own "What this project is" section lists "Artifact/Mission system" as
already running, and the Locked Day 1 scope marks it "(already
built)." Checked directly, not assumed: no `generateArtifact`,
`generateMission`, or any Artifact/Mission code existed anywhere in
`server/*.js`, and `WorldState` had no `artifacts`/`missions` arrays.
`VACANCY_POSTGRESQL_SCHEMA.sql` does have real `artifacts`/`missions`
tables, under a comment reading "already built since Volume 1" — the
schema was written assuming code that was never actually delivered.
`server/missions.js` (new) is that real, missing code, built from the
real schema shape. `/api/mission` also needed a real
`POST /api/artifacts` added beyond the API map's own literal Phase 1
list (which only names `GET /api/artifacts`) — without it,
`/api/mission` could never actually be called over HTTP; a real,
necessary completion, not scope creep.

`package.json`'s own broken `test` script (pointing at a
`server/selftest.js` that doesn't exist on disk) was also fixed —
replaced with real `start`/`dev` scripts matching every other app in
this ecosystem's own convention.

Only these 5 required endpoints plus the 2 necessary artifact routes
are built. `VACANCY_API_ENDPOINT_MAP.md`'s own further ~40 endpoints
across Phases 1-5 (entities, keys, families, organizations, economy,
properties, communities, cities, players, multiplayer, and more) are
real, separate, much larger future scope — not attempted in this pass.

**That stopped being true and this section was never updated past its
Phase 11 snapshot** — checked directly rather than assumed, the same
failure CLAUDE.md keeps finding (and found drifting on its own stated
figure too: it says 79, `test/inventory.test.js` counts every real
`app.get`/`app.post`/.../`app.delete` in `server.js` against the
number `VACANCY_INVENTORY.md` states and currently holds both to 94).
`server.js` covers most of Phases 1-3 of the endpoint map —
organizations, families, economy, properties, communities, cities,
keys, politics, culture, flows and more, built across the phases
`dev-docs/` holds a folder for. `VACANCY_API_ENDPOINT_MAP.md` and
`VACANCY_INVENTORY.md` are the live, checked contracts; this paragraph
is kept as the historical record of what Phase 11 actually shipped,
not as a current count.

## Run
```
npm install
npm start   # localhost:8809
```

## Test
```
curl http://localhost:8809/api/health
curl -X POST http://localhost:8809/api/npc/generate -H "Content-Type: application/json" -d '{"name":"Marcus Whitfield"}'
```

## Leader mode (5 Nov 2026)
Reopened by explicit instruction after being deferred since the
project began — see `CLAUDE.md`'s own forty-seventh standing rule for
the full design. One embodied avatar throughout: becoming a leader
means your Citizen-mode NPC already, really holds a seat
(`organizations.leader_id`), never a second kind of player.
`POST /api/players/:id/promote-to-leader` grants it;
`GET /api/players/:id/leader-dashboard` is the observe side. A leader
can `direct-mission` (order one of their own organization's real
members onto a real mission — compliance is a real draw against that
person's own loyalty, never guaranteed) and, if they lead a `media`
organization, `broadcast-message` (put a real fact in front of their
outlet's real audience) through the same `POST /api/players/:id/action`
dispatcher every other player verb already uses.

## The influence economy and character creation (5 Nov 2026)
See `CLAUDE.md`'s own forty-eighth standing rule for the full design.
`relationships.influence` and `families.political_influence` were real
schema columns nothing read or wrote beyond their generation-time
default; this is what finally does. Every entity — NPC or player avatar
— has real, growing influence over the specific people they actually
interact with, starting from a real baseline (`influenceRatingOf`:
occupation tier, real organization leadership scaled by its own size
and reach, real social traits) rather than a flat zero, and moving down
from real refusals and losses exactly as it moves up from real
successes (a lost contest, a refused `direct-mission` order, a
negotiation between people with real bad history). `direct-mission` now
has a second real path: an entity with real, high `relationships
.influence` over a target can attempt to direct them with no
organization involved at all, gated the same probability-draw way as
the org path — never a guessed cutoff.

`server/characterCreation.js`'s `createCharacter` (`POST
/api/characters`) is the other half: a player picks a few real things
— occupation (validated against the real qualification gate any NPC's
hire is held to), country, community — and everything else, especially
family, is randomly generated and revealed rather than chosen: whether
each parent is alive or dead (the real mortality pipeline, never a
second "is dead" flag), a living parent's own real occupation, real
siblings, and real cousins — each one a fully simulated NPC, child of a
real aunt/uncle who heads an entirely separate real family of their own
at its own real, possibly different, location. Grandparents and
anything beyond parents/siblings/cousins are explicitly out of scope.

## Weapons, alt-policing, multi-faction heat and real contacts
See `CLAUDE.md`'s own fiftieth standing rule for the full design.
`server/weapons.js` is real firearms (`pistol`/`rifle`, remnant-only;
`machine_gun`, remnant-only AND restricted to a `government-building`
in a region with a real, tracked `countryPacks.militaryExpenditurePctGDP`
— global, never US-only) and real, finite ammunition
(`pistol_rounds`/`rifle_rounds`), kept deliberately separate: a gun
with no held round of its own ammunition is a real object that does
nothing. `zip_gun`, the street-level firearm, is a real Tier 2
craftable in `salvage.js`; `auto_sear_switch` turns a semi-auto into
`machine_gun`'s burst and is never a discovery location. Missiles and
drones are explicitly out of scope. `POST /api/players/:id/action`
gains `manufacture-ammunition` — era-gated (`industrialization`) and
occupation-gated (a real `engineer` at a real `business`), one bounded
batch per call, never a passive regen.

**Government does not have to be what polices an area.**
`policing.factionCapacityOf` gives a real faction holding real ground
(`authority.holderOf`) its own real clearance capability, derived from
its own live `organization.power` and block-status weight — so a
lawless area with no `public_safety` infrastructure at all can finally
have an offence noticed and, through the already-real
`justice.answerByGroup`, answered by whoever actually holds the
ground. The real belief this file moves ("trust in public safety")
still only ever moves when government infrastructure genuinely
existed.

**Multi-faction heat is real and independent per faction** — never one
"wanted" scalar. `server/heat.js` reuses the real shared `entities(id)`
space between people and organizations and the real
`relationships.conflict` column; the one real trigger is
`justice.answerByGroup` actually acting, never omniscience about every
offence in a faction's own territory. Government/police heat is
deliberately out of scope — that chain already ends in a real
conviction, a stronger mechanism a parallel heat bar would only
disagree with. Surfaced live as `heat` on both the citizen and leader
dashboards.

**Friends, classmates and associates are searched for before they are
ever generated.** `POST /api/players/:id/action` gains `find-contact`
(`server/contacts.js#findOrCreateContact`): real existing
`friend`/`business`/`educational`/`neighbor`/`student` relationships
and real extended family (cousins/aunts-uncles) are checked first, and
a brand-new real NPC is generated — placed in a real, different city
via the same cross-world draw `characterCreation.js` already uses for
aunts/uncles — only once nothing real qualifies. "Outside home region"
is honestly scoped to the city, the one geography grain this engine
generates more than one of.

## Real global crime, hunger, climate and road-safety data (twelfth round)
See `CLAUDE.md`'s own fifty-first standing rule for the full account,
including the real tooling limitation that scoped this round down.
`countryPacks.js`'s `globalIndicators2026` adds a real UNODC/World
Bank homicide rate to 28 of 37 `COUNTRIES` entries — scoped honestly
to homicide, not crime broadly, with real source disagreements kept
visible rather than resolved (Nigeria, Guatemala, Honduras stay
`null`) and stale-but-real figures kept with their real year rather
than hidden (Russia 2018, Ethiopia 2012). `undernourishmentPct`
(FAOSTAT), `avgTemperatureC` (World Bank/Wikipedia, flagged where a
different real baseline was the only one found) and
`roadTrafficDeathRatePer100k` (WHO) are the same deliberately SPARSE
shape `oilProducer` already established — present only where a real
figure was actually found (5, 5 and 4 countries respectively), `null`
everywhere else.

**What this round explicitly did not build, and why**: real conflict-
event data (UCDP/ACLED) beyond the existing `conflictLevel` band, FAO
Food Balance Sheets (eating conditions), IUCN Red List wildlife status
and FAO livestock head-counts (animals), new `COUNTRIES` entries for
Spain/Egypt/Saudi Arabia (**Egypt was revisited and built in the
thirteenth round below — see CLAUDE.md's sixtieth standing rule**),
and — declined outright, not deferred — Hofstede/World Values Survey
cultural dimensions, whose licensing terms a prior research pass found
unclean. Occupations needed no building at all: `occupations.js`'s
`enforcer`/`officer` are already ungated by ethnicity or nationality,
so this table's own occupation coverage was already global by
construction.

## Global occupation/demographic completeness (thirteenth round)
See `CLAUDE.md`'s own sixtieth standing rule for the full account.
Four parts: (1) a real BLS SOC major-group audit found six groups
with zero `occupations.js` entry mapped to them in `labourPacks.js` —
`programmer`, `lawyer`, `custodian`, `stylist`, `salesperson`, `clerk`
close SOC 15/23/37/39/41/43, and the same audit found `plumber`/
`electrician` really are SOC 47 (Construction/Extraction), not 17
(Architecture/Engineering) as both had been coded. (2) Six named
countries' real ancestry-code status was checked directly: Iranian/
Egyptian are real B04006 codes, confirmed against the Census API's
own variable metadata (Egypt's own prior decline revisited and
reversed on that basis); Venezuelan/Cuban/Colombian/Dominican are real
codes too, in a different real table (B03001, Hispanic or Latino by
Specific Origin) than the one this registry's existing Latin-American
entries cite; Canadian is real but stays unwired for a reason that
predates this check (a destination, not a US ancestry source); Yemeni
and Saudi Arabian have no real code at all. Five new `COUNTRIES`
entries plus Egypt's revisited one. (3) `server/nativityPacks.js`
closes CLAUDE.md's own thirty-third standing rule's nativity/
citizenship half — real Census ACS table B05001, a new `npc.nativity`
field, the identical §9 firewall every demographic field here holds.
(4) Measured a real world with all seven independently opt-in
demographic packs supplied at once: every adult gets a full seven-
field joint profile, every field that applies to any age is set for
every resident, and the only "partial" profiles are children correctly
missing the two fields ACS itself only measures for adults — working
as designed, not a bug.

## Decoupling country coverage from the ancestry-code gate (fourteenth round)
See `CLAUDE.md`'s own sixty-first standing rule for the full account.
`countryPacks.js`'s `COUNTRIES` table has required a matching real
`ancestryPacks.GROUPS` code since round one — the real reason Saudi
Arabia, Spain, Japan, Brazil and dozens of other significant real
countries stayed out despite real World Bank/EIU/SIPRI/EIA data about
each of them existing. That gate was never a property of the real
country-level data — it is an artifact of `COUNTRIES`'s first
consumer, `migration.generateRegion`'s own US-ancestry-linked
`countryKey`. `COUNTRY_PROFILES` is a second, additive real path: the
identical field shape, keyed directly on a hyphenated country name,
no ancestry code required. Ten real countries this round — Japan,
South Korea, Brazil, Argentina, Indonesia, Saudi Arabia, Turkey,
Spain, Australia, South Africa — prioritised by population and G20
membership. Spain and Canada are the two gaps this file had already
named by name in two separate prior rounds (`EU_MIGRATION_OVERVIEW_
2025`'s own note on Spain; the thirty-ninth standing rule's "a
destination, not a source" on Canada, restated rather than
overridden — Canada deliberately stays on its existing standalone
path). `GET /api/country-packs/:key`'s 404 condition was missing the
new tier and was found and fixed live, over a real spawned server,
not left for the fixture suite. Honest about this round's own real
ceiling: ten countries against ~195 real sovereign states is genuine
progress, not comprehensive coverage, and several figures (Brazil's
`regimeScore`, Japan's and Saudi Arabia's edition-year) are flagged
rather than guessed where this round's WebSearch-only tooling could
not reach a primary table — the same ceiling the fifty-first standing
rule already named once before.

## Twelve more real countries in COUNTRY_PROFILES (fifteenth round)
See `CLAUDE.md`'s own sixty-third standing rule for the full account.
Continuing the fourteenth round's `COUNTRY_PROFILES` path rather than
stopping at ten: Pakistan, Bangladesh, the Democratic Republic of the
Congo, Thailand, Myanmar, Iraq, Afghanistan, Syria, Morocco, Peru,
Chile, Malaysia — `COUNTRY_PROFILES` now carries 22 real entries.
Three real, non-default conflict classifications (the DRC and Myanmar
at `active-armed-conflict` for the real M23 offensive and the real
post-2021-coup civil war respectively; Syria likewise, for real,
current violence under its transitional government). Three honest
`null` `regimeType`/`regimeScore` pairs, each for a different real
reason: Syria (the EIU's 2024 edition would have scored the now-fallen
Assad regime, which fell inside that index's own measurement window —
scoring it would misrepresent the country today), the DRC (no EIU 2024
score found at all), and Chile (three real sources disagree on its
2023-edition rank and the one 2024 figure found didn't clearly cite
the EIU as its source — kept unpicked, not resolved by guessing).
Iraq's oil-producer entry is a second fully confirmed figure, not a
sparse placeholder — real 2024 EIA/OPEC+ production and export ranges.
Found and fixed live: three of the fourteenth round's own tests had
baked in that round's exact country count and an unconditional "every
regimeType/every militaryExpenditurePctGDP is flagged" assumption —
loosened to describe this round's own honestly-mixed real data rather
than weakened to dodge it.

**A real, severe, pre-existing problem found running this round's own
full suite, confirmed not caused by this round before being reported**:
`test/worldgen.test.js` does not complete — 100%+ CPU for 60s, 120s,
and 180s of isolated runtime without finishing. Checked the honest
way: `git stash` to remove every one of this round's edits, re-run the
file alone, and the identical timeout reproduced on the clean,
already-pushed `ecd4397` HEAD. Neither `server/worldgen.js` nor its
test file has been touched since the global occupation/demographic
completeness round. Named here as an open, real, severe problem — not
a deadlock, a genuine runaway computation — for whichever round
touches either file next. Full suite with that one file's real status
named rather than hidden: 2020 tests, 1996 pass, 0 fail, 7 cancelled
(all downstream of `worldgen.test.js`'s own timeout), 17 skipped —
zero regressions from this round's own 42 new/adjusted tests.

## Nationalist/racial organization archetypes — generic, real-cited
See `CLAUDE.md`'s own sixty-second standing rule for the full account
(written after the fact to avoid colliding with the round above,
which was mid-flight on this same file at the time). Two new
`orgArchetypes.js` entries: `'nationalist movement'` (civilian,
dispersed rather than territorial) and `'racially-affiliated prison
gang'` (a sub-category of the existing `'prison gang'`). No real,
named organization appears anywhere in either — every real source
(SPLC, ADL, DHS's RMVE category, FBI UCR hate-crime data, and real
academic literature on racially-organized prison gangs) is cited as
structural grounding in the module's own header, never as the name of
a generated entity. Neither archetype gates membership on
`npc.race`/`npc.ethnicity` — the same answer `'religious order'`
already gives for `npc.religion`, reasoned through on the page rather
than picked silently, and enforced by the same forbidden-file-scan
tests every other demographic firewall in this registry carries.

## Bluffing and its exposure
See `CLAUDE.md`'s own fifty-second standing rule for the full design.
`server/bluff.js` models the gap between what `weapons
.isFunctioningFirearm` actually verifies and what somebody else
believes. `POST /api/players/:id/action` gains three verbs:
`intimidate` requires a real equipped firearm, loaded or not, and runs
the bluffer's real `Deception`/`Charisma`/`Persuasion` traits through
`perception.receivedConfidence` — the same already-calibrated belief
model `tick.js`'s scarcity broadcasts and `politics.js`'s election
results already use — to raise a target's real, shared
`relationships.fear`, never a second, invented persuasion modifier.
`assess-threat` is read-only and reports only that real standing fear
value — it never reveals the real armed ground truth, or the whole
mechanic collapses. `call-bluff` is the one place that is checked, and
it is deterministic and real both ways: an actually-armed target's
bluff was never a bluff, and calling it escalates through the real
`crime.recordEscalation`; an empty gun's bluff is exposed, resetting
the challenger's fear and costing the bluffer real standing through
`influence.lowerInfluence`. No new random draw is introduced anywhere
in this file.

## Chaos ripple effects
See `CLAUDE.md`'s own fifty-third standing rule for the full design and
the real measured numbers. Out-migration from a violent area was
already real before this round — `motivation.js#safety` already read
`crime.dangerByCommunity` to push people out via an unmet safety need,
and `migration.js#desirability` already steered them away from
dangerous destinations. The genuinely missing half was property:
`property.dangerDecayMultiplier` (bounded `[1, 1.15]`, one-sided —
danger has no protective direction for a building) compounds onto the
existing flat decay term in `advancePropertyLifecycle`, read from
`crime.dangerByCommunity` computed once per tick in `tick.js`'s
Environment phase and passed in as a new optional argument. A world
that never passes it — every pre-existing call site, including five
test files — decays exactly as it always has. `heat.worstHeat` (a
person's own worst standing heat with any one real faction, never a
sum) is a second, genuinely separate signal wired into the same
`safety` need, because it is scoped to the PERSON a faction actually
acted on rather than their neighbourhood, and is 0 for almost everyone.

## Local-area events
See `CLAUDE.md`'s own fifty-fourth standing rule for the full design.
`server/events.js` gives the tick-level `events` log a real geographic
anchor it never had — the schema's own `events` table has no location
column at all, so a player could only ever see what named them
directly via `affected_entity_ids`, never what happened two blocks
over. `locationOfEvent` derives `community_id`/`city_id` (in-memory
only, same posture as `city.healthBaseline`) from the real entities an
event already names — `npcs.communityId`, or an organization's own
operated property — preferring a real `territoryBlockId` hint when
`global_effects` carries one, resolved once at the moment of storage so
a later move never rewrites where an event actually happened. Both
dashboards gain a `nearbyEvents` field (same real `city` grain
`heatProfile` already reports on), and `GET /api/events` gains `near`,
`communityId`, `cityId` and `scope` filters additive to the existing
`sinceTick` — a call with none of them behaves exactly as before. An
event naming nobody with a resolvable community, or naming the viewer
directly from anywhere, is handled honestly rather than guessed.

## Prison institution system
See `CLAUDE.md`'s own fifty-fifth standing rule. The premise this
round was asked to fix — "`property.js` has no prison type" — was
checked directly and found stale: `landmarks.js`'s real `prison` Key
category, its real NRHP/Overture-imported location data, and its real
`officer` staffing at generation were all already wired and running.
The real gap was one system over: `justice.js#imprison`/`release`
wrote `where_location_id: null` on every conviction and release,
unconditionally, because nothing connected a sentence to an actual
place. `justice.prisonFor(worldState, cityId)` finds the real prison
standing in the same city `judge` already recorded on the case —
deterministic (lowest real id), never a seeded draw, because the city
is already decided and a real prison either stands there or does not.
A city with no real prison keeps exactly the behaviour it always had.
Prison capacity stays exactly as excluded as this file's own header
already declared it — not reopened, and a real reason checked and
written down for why it stays that way (HIFLD's real `prisons`
capacity would currently land in the same bucket as police capacity,
in incompatible units).

## The full political hierarchy (town/city/state/country)
See `CLAUDE.md`'s own fifty-sixth standing rule. "Region" in
`VACANCY_POSTGRESQL_SCHEMA.sql` already sits directly between
civilization and city — this engine's real state-equivalent tier, not
a new table — and `politics.js`'s election/legislature/revolution
cycle was already generic over `worldState.governments`, just never
handed more than the one civilization-wide government `worldgen.js`
founds. `regions.governor_npc_id` and `civilizations
.head_of_state_npc_id` are two new real leader fields (parallel to
`cities.mayor_npc_id`/`communities.leadership_npc_id`, vacated on
death the same way), and a government row's new `scope_type`/
`scope_id` (city\|region\|civilization) is what `scopeCitiesOf`/
`scopePopulationOf` read to keep a scoped election, its candidate
pool, its turnout, and its revolt-spread denominator confined to its
own real jurisdiction rather than the whole world. A real,
previously-uncaught bug came out of the same pass: `closeElection` had
written a field (`leader_npc_id`) that does not exist anywhere else in
the engine, so no election's winner had ever actually installed
anywhere — fixed to the real column (`leader_id`). Continental has no
real tier (this engine generates one civilization per world) and no
real per-continent political dataset researched this round, so it is
declined outright rather than faked. `config.scopedGovernments`
(opt-in, default `false`) founds the new per-city and per-region
governments; off, every existing generated world is unchanged.

## Prison depth: gangs, breaks, real demographics, family
See `CLAUDE.md`'s own fifty-seventh standing rule for the full
reasoning. A real prison's gang politics, takeover and breaks are four
consequences of ONE reused mechanism rather than four new ones:
`orgArchetypes.js`'s new `'prison gang'` archetype scopes a real
`organizations` row to the prison's own COMMUNITY (the finest geography
`territory_blocks` has — no "wing"/"cell block" concept exists
anywhere in this schema, so none was invented), and "taking over a
prison" is that community's `authority.js` regime crossing into
`lawless`, the identical mechanic every other neighbourhood already
has. `justice.runPrisonBreaks` fires exactly once on that crossing and
releases everyone currently serving there, unserved, through the same
real `release` path a completed sentence already uses.

Real BJS/OJJDP incarceration demographics by facility type (state/
federal prison, local jail, juvenile residential placement) are in
`server/prisonPacks.js` — a cited reference table, never a per-NPC
draw, with the identical §9 firewall `racePacks.js`/`religionPacks.js`
already carry: race must never decide which gang an inmate joins, feed
a prison conflict mechanic, or decide anything else. A believable
facility-type COUNT distribution (how many of each real kind exist, to
split a generated prison into county-jail/women's-facility/camp
sub-types) was checked for and not found at a confidence this round
would stand behind, so `property.facilityType` carries one honest
default. A known minor is never routed into the one adult-typed
facility a city has (`mortality.ageInYears`, `prisonFor` returns
`null` the same way a city with no prison already does) — the one
individual-routing axis this engine's real substrate supports, since
`npc.sex` does not exist anywhere in this engine and was not invented
to force a second axis. Corrections officers needed no new occupation:
`officer` has staffed every generated prison since before this round.
`justice.release` now calls the real `characterCreation
.describeFamilyTree` (filtered to the living) so somebody released, or
broken out, heads to real family on record where this engine has one.

## Phase 4: Digital Planet (ecosystem link-outs)
See `CLAUDE.md`'s own fifty-eighth standing rule for the full
reasoning. Closes the API map's own Phase 4 — five named link
generators, none built until now, because the map's own words say
"VACANCY should never implement the actual streaming/commerce/fashion
logic itself." `server/ecosystemLinks.js` gates all four real
generators on `media.js`'s own `social_media` channel (`computing` era
+ a real, non-failed `internet` row in the requester's city) — the
same "is the internet back" question `media.js` already answers, read
once rather than re-derived. Each destination was checked against the
sibling's own real route table first: Vavlt Stvdios' real channels,
Vvltvre's real Music/Flix releases/titles, DREAMS' real screens,
VENVS' real sellers.

The map's fifth line, "Vozzana da Gucci," turned out to be a stale
name for SVMIKO DEGVCHI — a real 17-brand fashion house living INSIDE
VENVS as ordinary marketplace sellers, not a separate app, so there is
no fifth route: `venvs-link` already covers it, since a brand
storefront is a real VENVS seller with a runtime id and no separate
product-id namespace to address. Four real link generators this
round, not five.

## Main characters — a real local power hierarchy, and real missions from it
See `CLAUDE.md`'s own fifty-ninth standing rule for the full reasoning.
"There'll be a kingpin... the strongest gangs, the strongest political
party, the strongest religious party... a power hierarchy in every
town" — by direct instruction. `server/mainCharacters.js` is the real,
computed (never stored, standing rule 3) read: criminal via
`authority.holderOf`, political via the real government whose scope
actually covers this community (city, else region, else civilization),
religious via a genuinely new `'religious order'` archetype
(`orgArchetypes.js`), business via the highest-influence business
actually operating a property here. `GET /api/communities/:id/
main-characters` exposes it. All four can be honestly `null` — most
sharply for criminal, since no faction gets a real `leader_id` from
generation alone; only a real `attempt-takeover` (or an election, for
political) ever installs one, a pre-existing gap this round documents
rather than retroactively fixes for anything but its own new religious
archetype.

The second half — "explore skyscraper, explore library... every time
we learn how to fish, we read a book... finding [main characters] will
help us build missions" — is `server/missionTriggers.js`: a real,
measured-rate chance (0.1 per visit; see that file's own header for
the measured calls-to-first-mission table) that `search-location` (any
landmark, `skyscraper`/`library` included, with no new wiring needed)
or a now-location-aware `practise-habit` (a new optional
`locationPropertyId`, mirroring `adopt-routine`'s existing one — no
habit-name vocabulary exists to gate "fishing"/"reading" on) generates
a real mission from the real criminal main character controlling that
ground, via `generateMission({ locationId, controllingFactionId })`.
A location already carrying an open job from its own main character
never gets a second one stacked on top. Dedicated fishing-spot
landmarks and gating by habit name are named as deliberately
out of scope, not silently missing.

## Verified
14 plain-Node checks on `server/missions.js` directly (rejects a
missing artifact name, rejects a nonexistent `artifactId`, rejects a
non-faction `controllingFactionId`, real ids/fields/status/tick
returned correctly, `listMissions` filters by real status), plus a
live pass against the real running server: `GET /api/state` confirmed
an empty real world; a real NPC generated and reflected in both the
response and a follow-up state fetch; `POST /api/tick` confirmed
advancing the real tick counter; a real artifact created via the new
`POST /api/artifacts`; a real mission generated from it via
`POST /api/mission`, confirmed carrying the real linked `artifact_id`
and default `available` status; a mission request against a
nonexistent artifact confirmed rejected with a real, specific error.
`vaco-shell`'s own registry updated with this project's real new URL
(`http://localhost:8809`), closing that side's own `url: null` gap.
