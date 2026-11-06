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
Spain/Egypt/Saudi Arabia, and — declined outright, not deferred —
Hofstede/World Values Survey cultural dimensions, whose licensing
terms a prior research pass found unclean. Occupations needed no
building at all: `occupations.js`'s `enforcer`/`officer` are already
ungated by ethnicity or nationality, so this table's own occupation
coverage was already global by construction.

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
