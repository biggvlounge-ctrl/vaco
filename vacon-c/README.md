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

## Real penitentiary-staff occupations (guard, warden, nurse)
See `CLAUDE.md`'s own sixty-fourth standing rule for the full account
(written after the fact for the same reason the sixty-second rule's
was — this file was mid-flight under the country-coverage round at the
time). Three new, real BLS-SOC-coded `occupations.js` entries: `guard`
(SOC 33-3012, Correctional Officers and Jailers), `warden` (SOC
33-1011, First-Line Supervisors of Correctional Officers — BLS has no
distinct "prison warden" title, so this is the real closest-fitting
code, stated as a stand-in rather than an exact match), and `nurse`
(SOC 29-1141, Registered Nurses — a different real code from
`orderly`'s). All three employ through `government`, since
`organizations.type` has no `prison` value — a prison here is a real
`properties` row, never an organization. Closing this surfaced a real
gap: no hero landmark, prison included, ever got a real operator from
generation alone. `worldgen.js` now wires every generated prison to
its real region or civilization government right after founding, the
same `operating_organization_id` link every other employer-building
already uses — every OTHER hero landmark category still has the same
missing link, named as the open, broader version of this gap rather
than fixed here.

## Prison-to-street pipeline, chaos recruitment, and global incarceration data
See `CLAUDE.md`'s own sixty-fifth standing rule for the full account.
Three related mechanics. **(1)** `justice.js#ensureStreetAffiliate`/
`joinStreetAffiliate` connect a released prison-gang member to a real
street-side counterpart gang in their own real community — founding
one if necessary, reusing `engine.generateFaction`/
`membership.joinOrganization` rather than a second mechanism. **(2)**
`recruitment.js#runChaosRecruitment` scales a flat base rate directly
by `crime.dangerByCommunity`'s own real score — no "chaos has erupted"
threshold to calibrate — and recruits the real eligible candidate
with the highest `influence.influenceRatingOf`, never a lottery;
`statistics.js`'s new `chaos_recruitment_events` is the real
growth-over-time figure, and `tribe_family_recruitment_growth` is
reported `unavailable` since neither tribes nor families have a real
"stranger joins after the fact" mechanism in this engine. **(3)** A
real World Prison Brief incarceration block was added to thirteen
already-covered countries across North America, South America,
Africa, Europe and Asia, plus a brand-new `india` entry (named
separately in the instruction, and previously missing from this file
entirely) — same honest-sparseness discipline as every other round,
including two real volatile snapshots (Russia, Mexico) kept side by
side rather than reconciled, and China's headline rate explicitly
scoped away from its own larger illustrative estimate.

## Fourteen more real countries plus Yemen (seventeenth round in countryPacks.js, sixty-sixth standing rule)
See `CLAUDE.md`'s own sixty-sixth standing rule for the full account
(numbered the seventeenth round in `countryPacks.js`'s own history,
not the sixteenth — the global incarceration round above already
claimed that number). Continuing `COUNTRY_PROFILES`: Sudan, Algeria,
Uganda, Tanzania, North Korea, Taiwan, the United Arab Emirates,
Nepal, Sri Lanka, Kazakhstan, Cambodia, Ecuador, Angola, Mozambique —
plus Yemen, which gains the same six standard fields every other entry
carries, kept alongside its existing, deeper `YEMEN_CONFLICT_2026`
narrative rather than replacing it. Three real, non-default conflict
classifications (Sudan and Ecuador's real declared gang conflict at
`active-armed-conflict`/`high-nonstate-violence`; Uganda and
Mozambique's real sub-national insurgencies at `localized-conflict`).
Five countries honestly null their regime figures rather than use a
wrong-year or unconfirmed one; Angola's are null for a real, named
source disagreement right at this file's own hybrid/authoritarian
boundary. Two real, fully confirmed 2024 oil figures (Angola, the
UAE), plus Yemen's real Houthi-blockade revenue fact reported in place
of an invented production volume. North Korea's missing military
figure is flagged with its real structural reason (SIPRI excludes it)
rather than left as an unresearched-looking gap.

## Forty-one more real countries (countryPacks.js's eighteenth and nineteenth rounds, sixty-seventh standing rule)
See `CLAUDE.md`'s own sixty-seventh standing rule for the full
account. Two rounds committed together: `COUNTRY_PROFILES` now
carries 79 real entries, up from 38. **Eighteenth round (23
countries)**: Belgium, Austria, Denmark, Finland, Romania, Bulgaria,
Serbia, Croatia, Moldova, Belarus, Libya, Tunisia, New Zealand,
Singapore, Uruguay, Paraguay, Bolivia, Jordan, Lebanon, Qatar, Kuwait,
Bahrain, Oman — three real, confirmed 2024 energy figures (Kuwait,
Oman, Libya's real volatility kept as a range), Qatar's real LNG
status reported instead of a forced crude figure, and four real
regimeType/regimeScore splits each for a different stated reason.
**Nineteenth round (18 countries)**: Switzerland, Iceland, Luxembourg,
Malta, Cyprus, Botswana, Namibia, Malawi, Zambia, Zimbabwe, Rwanda,
Burundi, Mongolia, Uzbekistan, Laos, Mali, Burkina Faso, Niger — Mali/
Burkina Faso/Niger at `active-armed-conflict` on the clearest evidence
in this file (all three real, current military juntas named directly
in the 2025 Global Terrorism Index among the world's most terrorism-
affected countries), Cyprus at `localized-conflict` for the real 1974
division, and Zimbabwe's regime figures honestly null for the same
wrong-year reason Uganda/Tanzania's were in the seventeenth round.

## Thirty-two more real countries (countryPacks.js's twentieth round, sixty-eighth standing rule)
See `CLAUDE.md`'s own sixty-eighth standing rule for the full
account. `COUNTRY_PROFILES` now carries 111 real entries, up from 79.
Ivory Coast, Senegal, Cameroon, South Sudan, Eritrea, Togo, Benin,
Gabon, Guinea, Sierra Leone, Liberia, Gambia, Panama, Costa Rica,
Nicaragua, Guyana, Suriname, Trinidad and Tobago, Georgia, Armenia,
Azerbaijan, Kyrgyzstan, Tajikistan, Turkmenistan, Estonia, Latvia,
Slovakia, Slovenia, Montenegro, Albania, North Macedonia, Kosovo.
Kosovo's regime figures are null for a real structural reason (the
EIU index does not cover it), not a research gap. Five countries
(Montenegro, Albania, North Macedonia, Senegal, Liberia) plus Guyana
honestly null their regime figures rather than reuse a wrong-year or
unconfirmed one. Panama's and Costa Rica's real absence of a standing
military is reported as the field's own null, not a gap. Four real,
non-default conflict classifications for currently-live named
disputes (Georgia's Abkhazia/South Ossetia, Armenia's post-2023
Nagorno-Karabakh situation, Cameroon's Anglophone/Ambazonia conflict,
Guyana's escalated Essequibo dispute with Venezuela), plus South
Sudan at `active-armed-conflict`.

## Eleven more real countries, and nine honest declines (countryPacks.js's twenty-first round, sixty-ninth standing rule)
See `CLAUDE.md`'s own sixty-ninth standing rule for the full account.
`COUNTRY_PROFILES` now carries 122 real entries, up from 111: Chad,
the Central African Republic, the Republic of the Congo, Equatorial
Guinea, Djibouti, Mauritania, Mauritius, Lesotho, Papua New Guinea,
Fiji, and Timor-Leste. Chad, the Central African Republic, and the
Republic of the Congo all keep `authoritarian-regime` but null their
`regimeScore`, since three real sources disagree on the exact figure
for each. Mauritius is a real `full-democracy` at 8.23, the only one
found anywhere in Africa. Fiji's score is flagged `secondary-estimate`
and Papua New Guinea's is a real, documented downgrade from the prior
edition. This round is also the first in the whole multi-round effort
where honest research returned more declines than builds: Seychelles,
Comoros, Eswatini (no EIU data at all), Bhutan, the Maldives, Brunei
(only V-Dem data found, not substituted), and the Bahamas, Barbados,
Belize (a real CRS-sourced finding that the EIU's own Caribbean
coverage excludes them). This is reported as a real, reproducible
coverage ceiling, not a stopping point chosen out of fatigue.

## Chaos-driven family/tribe absorption (seventieth standing rule)
See `CLAUDE.md`'s own seventieth standing rule for the full account.
`recruitment.js`'s chaos-driven recruitment mechanic scoped itself to
gangs only at landing, since a gang recruiting a stranger and a family
absorbing someone are not the same shape of event — a family does not
recruit peers. This closes the real, narrower mechanism that actually
fits: kinship absorbing an already-orphaned child under local danger.
"Tribe" needed no separate mechanism — `engine.tribeIdFor` already
reads one straight off `family_memberships`. A real version of the
sixth standing rule's own trap was found first: `family_memberships
.role` is never `'parent'` in a real generated world, so a child's
parent is read from `births.js`'s own real birth record instead.
Honestly scoped: only a child actually born during the running
simulation has one, so an NPC present from world generation can never
be detected as orphaned this way. The absorbing family is picked by
the real `families.unity` field, the family-side mirror of picking a
gang's recruit by `influenceRatingOf`.

## The test/worldgen.test.js hang, actually fixed (seventy-first standing rule)
See `CLAUDE.md`'s own seventy-first standing rule for the full account.
A real, pre-existing hang (documented twice, never diagnosed) is now
genuinely fixed rather than worked around: `--cpu-prof` traced it to
`entityTraits.js#getLiveEntity`/`getEntityTraitsForEntity` doing an
unindexed scan over the entire `entity_traits` array on every call —
the same shape `traitDrift.js` had already fixed locally once, but
that fix never reached the canonical version 111 call sites across 31
files actually use. A `WeakMap`-keyed per-`worldState` cache closes it
at the canonical layer, invalidated on the array's identity or length
changing — `entity_traits` rows are append-only everywhere, confirmed
directly. `test/entity-traits.test.js` is this file's first test file
ever. Full suite, genuinely complete for the first time this session
with no exclusion or timeout workaround: 2199 pass, 0 fail, 0
cancelled, 17 skipped.

## Real resource profiles per country (seventy-second standing rule)
See `CLAUDE.md`'s own seventy-second standing rule for the full
account. `countryPacks.js#RESOURCE_PROFILES` is a third real,
independent path — what a country is known for, its real top exports,
and (for 5 of them) its real top imports — keyed on a canonical
country name and resolved from any key this module already accepts,
rather than a fourth scheme invented to hold it. 23 of this module's
~165 real countries covered, chosen for economic distinctiveness and
research tractability. Every export/import source this round
disagreed with at least one other on the exact figure — a real,
structural fact about how trade-data aggregators group HS codes
differently — so disagreeing real figures are kept side by side with
their own sources, never silently averaged or picked. Report-only,
proven by a real grep-based test: nothing outside `countryPacks.js`
itself reads it.

## Training loop: practice pays off faster in a cohesive group (seventy-third standing rule)
See `CLAUDE.md`'s own seventy-third standing rule for the full
account. `organizationTraits.cohesionOf` generalizes the real
`familyTraits.cohesionOf` to organizations (computed live off member
relationships rather than a stored stock, since organizations have no
unity/conflict columns). `traitDrift.groupCohesionMultiplierFor` reads
the MAX cohesion across an entity's family and every organization they
belong to and scales `driftExperience`'s growth rate by it, centred on
1 so an ordinary person in an ordinary group is unaffected — a small,
congruent group speeds up practice more than a large, incohesive one.
**A real bug was caught before this landed**: the first version
averaged the available cohesion scores instead of taking the max,
directly contradicting its own documented design, and the test written
to prove that exact property failed against it immediately. Fixed and
re-measured against the corrected version.

## Mission triggers open to all four main characters (seventy-fourth standing rule)
See `CLAUDE.md`'s own seventy-fourth standing rule for the full
account. The per-location power hierarchy round scoped mission
triggers to criminal only, since `generateMission`'s
`controllingFactionId` requires a real faction. Political, religious,
and business missions now route through `issuing_organization_id`/
`issued_by_entity_id` instead — the same real fields
`leadership.js#directMission` already uses for a non-faction
organization behind a job. `maybeTriggerMission` checks all four
categories in a fixed priority order (criminal, political, religious,
business) with one combined roll — the trigger rate is unchanged,
only who a job can come from.

## Two hot functions, actually fixed (seventy-fifth standing rule)
See `CLAUDE.md`'s own seventy-fifth standing rule for the full
account. `technicalSkillIn` and `ownedPropertyValue`, both flagged
during the `worldgen.test.js` hang-fix profile, are fixed now rather
than left declared. `technicalSkillIn` caches per (city, tick) since
`advanceInfrastructure` recomputed the same city's mean technical
skill once per infrastructure row. `getCurrentOwner` reads a real
per-worldState ownership index instead of rescanning every record on
every call. Both caches are tested for invalidation, not just values,
and mutation-verified. Full suite genuinely faster end to end as a
result, not just by test count.

## Every hero landmark gets a real operator (seventy-sixth standing rule)
See `CLAUDE.md`'s own seventy-sixth standing rule for the full
account. Closes the broader gap the prison-staff round named and left
open — museums, libraries, mosques, synagogues, skyscrapers, and the
rest. Government-type landmarks get the same real operator prisons
already use; religious landmarks (church/mosque/synagogue/temple)
reuse the community's own real religious order and now carry a real
title — priest, imam, rabbi, or "religious leader" — while the
underlying occupation stays `preacher`; everything else with a real
staff slot gets a freshly founded business. A real bug was caught
before landing: a community with more than one religious landmark let
the second silently overwrite the first's title on the shared order —
fixed with a claim guard, mutation-verified. A real pre-existing
interaction was found, not caused: a commercial landmark can already
be claimed by the city's own school/hospital/library institutions or
a faction, which this round's pass correctly leaves alone.

## Real founding leaders for gangs, governments, and businesses (seventy-seventh standing rule)
See `CLAUDE.md`'s own seventy-seventh standing rule for the full
account. Closes the forty-eighth standing rule's own measured gap —
only the religious order ever got a real founding leader at
generation; gangs, governments, and businesses waited on a real
election or takeover that never runs automatically. `config
.foundingLeaders` (opt-in, default false) generalizes the religious
order's own real `influenceRatingOf` selection to all three, scoped
from real, already-existing links only — a gang's real territory, a
business's real operated property, a government's real scope row —
never invented. An organization with no real scope gets no founding
leader this round, an honest gap. Off, every existing world is
byte-for-byte unaffected.

## Bluffing and its exposure
See `CLAUDE.md`'s own hundred-and-twenty-first standing rule for the full design.
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

## Fraud: a false property sale closes crime.js's declared "fraud" gap
See `CLAUDE.md`'s own eightieth standing rule for the full reasoning.
By direct instruction, among a wider request for "corruption at all
levels... scamming and scheming all over": `server/fraud.js` closes
`crime.js`'s own declared, ungenerated `fraud` category with the one
real transaction `properties`/`ownership_records` already support
without inventing a contract or claim to forge -- a perpetrator (gated
on the real, already-read `criminal.Deception` trait) offers a real
property they do not hold title to, a real victim pays a real deposit,
and no title changes hands. Measured on a 400-tick, 2-city world: 37
real fraud incidents against 12 real theft/property incidents.

The same round also closed a second, separate real gap found while
building it: `occupations.js`'s `guard`/`warden`/`nurse` ("COs,
nurses, warden") had been defined with `government` as their employer
since an earlier round and never once hired, the identical "defined,
never called" shape `config.securityForces` already closed for
`officer`. `config.prisonStaffing` (opt-in, default false) hires a
real warden and a real guard for every real prison, drawn from that
prison's own real city residents -- the prerequisite a real
dirty-CO/prison-gang mechanic needs before it can do anything.

## Dirty COs break out their own gang
See `CLAUDE.md`'s own eighty-first standing rule for the full
reasoning. By direct instruction: `server/justice.js#
runCorruptGuardBreaks` closes the real actor-driven cause sitting
beside the pre-existing, area-wide `runPrisonBreaks` -- a corrupt
guard or warden (`leadership.'Corruption Risk' >= 50`, the real
threshold `roguePolice.js` already measures) already in league with
a real prison gang can break that gang's own members out the moment
the prison's community merely goes `contested` (never requiring full
`lawless`, which is what makes this a different, earlier-firing cause
than the area-wide one), and releases only that gang's own members,
never the whole population. Idempotent per prison; mutation-verified
on both new gates; 4 new tests, full `test/justice.test.js` 47/47.

## Delegation: assigning a real task, not a mission
See `CLAUDE.md`'s own eighty-third standing rule for the full
reasoning. By direct instruction: `leadership.js#assignRole` lets
either real seat of authority this engine has -- `organizations.
leader_id` or `families.head_npc_id` ("tribe, organization,
delegation") -- hand one of their own real people a named task,
gated on the identical loyalty-based compliance draw `directMission`
already uses. An organization task writes the real, already-open-text
`role_in_org` (refused outright for a gang/faction, whose role is
computed every tick); a family task writes `family_memberships.role`,
checked against five real, previously-unused values the schema's own
comment already named -- `protector` ("on security"), `caregiver`
("take care of the kids"), plus `guardian`/`mentor`/`black_sheep`.
Reachable in both citizen and leader mode, since a family head needs
no Leader-mode promotion. Both new refusal gates mutation-verified.

## Dominance: pre-existing local power converts into real territory at chaos
See `CLAUDE.md`'s own eighty-fourth standing rule for the full
reasoning. By direct instruction: a gang, business, or religious order
that already dominates a community's residents (`membership.
organizationPresence`'s own real member count, government excluded)
converts that real presence into a real territorial claim
(`server/dominance.js#claimDominantGround`) the moment the area's writ
leaves `governed` (`contested` qualifies, not only full `lawless`) --
`organization.isFaction` flips true and a real `territory_blocks` row
is claimed and resolved, reusing `roguePolice.js`'s own "try to use
that force" step rather than a second one. Staying in power or losing
it afterward needed no new code -- `tick.js` already resolves every
real block's hold from the holder's own live traits, every tick.
Families (tribes) hold ground through `control.js`'s own takeover key
instead, named rather than folded in. Both new gates mutation-verified.

## Espionage: sending a real spy, and the record a real success leaves
See `CLAUDE.md`'s own eighty-fifth standing rule for the full
reasoning. By direct instruction: an organization leader or family
head can send one of their own real people (`server/espionage.js
#sendSpy`) to listen, infiltrate, or watch a real community -- a real
range (close/mid/far) and stance (low_profile/close_watch/
deep_infiltration), sponsored through the identical real authority and
loyalty-gated compliance draw `assignRole` already established. A
real, weighted aptitude (Stealth/Deception/Network Reach) decides how
much detail a report carries and how likely detection is; `deep_
infiltration` against a named organization adds that org's own real
public-ish facts. Detection raises real heat with the specific
organization that caught them. A successful, undetected return records
real service for the spy (`leadership.recordService`) -- the real,
measured answer to "NPCs become main characters... through their
actions and usage," kept separate from `mainCharacters.js`'s own,
different use of that term. All three new gates mutation-verified.

## Heists: a real crew robs a real organization's own real assets
See `CLAUDE.md`'s own eighty-sixth standing rule for the full
reasoning. By direct instruction: `server/heists.js#attemptHeist`
closes "bank robberies... crew composition" with no new landmark
category and no new crime category -- a crew robbing a real business's
own real `assets` is a bigger instance of the real, already-generated
`theft` category. Sponsored through the identical real authority and
per-person compliance draw `assignRole`/`espionage.js` already
established; `robberyAptitudeOf` is a real, weighted composite
(Stealth/Deception/Tactical Awareness); crew size helps up to a real
cap of 4; `targetDefenseOf` counts a target's own real, currently
employed guards/enforcers rather than the dormant, never-written
`organizations.security` column. Success (loot splits across the
crew) and detection (real heat with the specific target) are two
independent draws -- service is recorded only on a clean, undetected
success. Three new gates mutation-verified.

## Hidden caches: secret compartments, buried finds, and stash houses
See `CLAUDE.md`'s own eighty-seventh standing rule for the full
reasoning. By direct instruction: `server/hiddenCaches.js` gates
`discovery.js`'s own existing landmark pools (and, newly, ordinary
homes and apartments) behind a real key, a real `architect`'s own
knowledge, or real word-of-mouth knowledge already spread by
`media.js`'s own channel -- scattered across the world at generation
(`config.hiddenCaches`, opt-in), boosted for historic/religious
categories (`masonic-building`, `historic-site`, mosque, church,
synagogue, temple, cave-system). Opening one ("these are all
missions") generates a real artifact and a real mission rather than an
instant grab, one real time per cache. `designateStashHouse` declares
which real organization or family a property belongs to, validated
against its own real current owner -- inventory itself still lives on
a real custodian NPC, never a second property-level storage system.
Two new gates mutation-verified.

**Chained caches, Maniac Mansion-style: see CLAUDE.md's ninety-sixth
standing rule.** By direct instruction ("incorporate Maniac Mansion
type characteristics"), and the one entry in this file that is a
design decision rather than a real-data claim. Measured first: 0 of 3
landmark caches in a freshly generated world ever had a real owner,
since `worldgen.js` only ever records ownership for ordinary homes --
so a landmark's key sat permanently unassigned. Now, an owner-less
landmark cache chains from one real, unclaimed residential cache in
the SAME real community (never across communities, and never when
either side has no real community at all); `revealCache` hands the
chained key over the moment the source is actually found, through the
identical real access gates (key/architect/word of mouth) and
`inventory.give` call this file already used. One residential cache
chains at most one landmark cache. Three new gates mutation-verified.

## Drug trade: a real hierarchy, real production chains, the prison tie-in
See `CLAUDE.md`'s own eighty-eighth standing rule for the full
reasoning. By direct instruction, with real research done first (DEA
National Drug Threat Assessment 2024/2025; DOJ National Gang
Intelligence Center): `server/drugTrade.js` closes `crime.js`'s last
ungenerated §9 crime category. Street-level dealing reuses the real
§14 gang hierarchy (`membership.gangTierFor`); "connected to the
cartel" is earned (`grantCartelConnection`, gated on a real leader's
own `criminal.'Black Market Ties'`), never free, and never names a
real cartel or gang -- `cartelConnection` is a real geographic
category (`mexican`/`colombian`) only. Marijuana is grown domestically;
crack is converted domestically from cocaine; cocaine, heroin,
methamphetamine, fentanyl and synthetic cannabinoids all require a
real, earned cartel connection to import, matching DEA's own real
sourcing facts ("if it can't be done in the states, it needs to tie
in"). `runStreetDealing` is the real generator; `runPrisonSmuggling`
ties into the real prison-gang pipeline a corrupt guard already
exploits elsewhere in this engine. Opt-in (`config.drugTrafficking`),
one organization per city. Four new gates mutation-verified.

## Tribe wealth and the standing escort/party
See `CLAUDE.md`'s own eighty-ninth standing rule for the full
reasoning. By direct instruction, two systems from one message.
**`server/tribeWealth.js`** answers "at the beginning there is no
cash... your wealth accumulates in your organization, your tribe,
your gang... property and inventory... the people you have" without
touching `economy.getNetWorth` at all -- there is no monetary-era
concept anywhere in this engine to gate, and retroactively suppressing
cash would reach into the poverty line and both of `crime.js`'s
deprivation checks. `tribeWealthOf` sums real property and inventory
value across a real organization's or family's own members and names
a real `notablePeople` roster -- leadership, the real `physician`/
`lawyer`/`teacher`/`nurse` occupations, a family's own oldest real
generation (elders, never a fixed age cutoff), and real assigned
family roles (`protector`/`caregiver`/`guardian`/`mentor`) -- never a
single invented composite score. **`server/party.js`** generalizes the
one-shot crew mechanic `heists.js`/`espionage.js` already use into a
STANDING escort: `assembleParty` gathers real org/family members via
the identical real sponsor/compliance draw, and the roster persists
until released. A person can only ever escort one leader at a time.
"Play different roles as you go" needed no second role system --
`assignPartyRole` checks the target is a real current escort, then
hands the decision entirely to the existing `leadership.assignRole`.
Two gates mutation-verified.

## AI tactical squad-split advisor, and real trade data "into America"
See `CLAUDE.md`'s own ninetieth standing rule for the full reasoning.
By direct instruction, two more systems from one message.
**`server/tacticalAdvisor.js`** answers "send two to the back door,
three to a window... options provided to you by AI, depending on what
your team's statistics look like" with the same real, weighted-trait
composite `influenceRatingOf`/`espionageAptitudeOf`/`heists.js
#robberyAptitudeOf` already use, applied over three real, bounded
approach types (`stealth_entry`/`forced_entry`/`social_entry`) rather
than one score -- "back door"/"window" are the player's own narrative
labels, never a new invented building schema. `recommendSplit` places
each real party member where they measure best; `applyRecommendedSplit`
reuses the real `party.assignPartyRole`/`leadership.assignRole` chain
rather than a second compliance system, which correctly preserves the
pre-existing rule that a gang's trait-computed `role_in_org` can never
be overwritten. **`countryPacks.js`** gained real "into America"
bilateral trade data (US Census Bureau Foreign Trade, 2024) --
Mexico's real #1-trading-partner figures, Canada's real mineral-fuels
figure (plus a brand-new Canada entry), China's real smartphone
figure -- kept separate from each country's own global export
profile, plus a real illegal-imports fact beyond narcotics: CBP's own
FY2024 counterfeit-goods seizure statistics (China + Hong Kong ~90%
of all seizures by quantity). Two gates mutation-verified.

## AI crafting advisor: turning excess inventory into something else
See `CLAUDE.md`'s own ninety-first standing rule for the full
reasoning. By direct instruction: "somebody has excess of cereal...
might choose to make granola bars... those who have oranges will
start to sell orange juice... the AI looks at your inventory, your
group members, and what it has, and will make an NPC make a
suggestion... by the accumulation of what you have."
**`server/craftingAdvisor.js`** is the fifth real "AI" advisor this
engine builds -- the identical real, weighted-trait-gate shape
`influenceRatingOf`/`espionageAptitudeOf`/`heists.js`/
`tacticalAdvisor.js` already use, pointed at `salvage.canMake` instead
of combat. It reports two honest, distinct facts rather than one:
`readyNow` (a real member who personally qualifies and already
personally holds enough) and `possibleIfPooled` (the group's own real
holdings, summed, would be enough, but nobody has moved the materials
together yet -- `salvage.make` only ever consumes from one holder, by
design). `granola_bar`/`orange_juice` are two new, real
`salvage.RECIPES` -- the request's own named examples -- built the
identical "cook, Tier 1" shape `bread` already has; "aluminum and
glass into different items" needed no new recipe at all, since
`scrap_metal`/`glass` were already real `salvage.js` materials. One
gate mutation-verified.

## Carmen Sandiego-style fugitive pursuit
See `CLAUDE.md`'s own ninety-second standing rule for the full
reasoning. By direct instruction: "it doesn't have to be for the
world... another town... another city... another state... it can be
for another country." **`server/fugitives.js`** reads a real,
pre-existing gap in `justice.js`'s own pipeline rather than inventing
a new "wanted" field: a cleared crime incident whose real
`groupSanctions` row went genuinely unanswered IS a real fugitive,
identified and free. Clues are real, named `landmarks.js` landmarks
in their own current real community (honestly null where none
exists), plus optional `countryPacks.js` flavour that never claims
they left the simulated world. A wrong guess reuses the real
`migration.relocate` mechanic to flee to a different real community
with a real vacant home; a correct guess reuses `justice.judge`/
`justice.imprison` entirely -- the identical real chain
`runJustice` itself uses for a governed area's own cleared incident.
"Town"/"city" are real, actually-simulated scales; "state"/"country"
are honest narrative labels over the same real mechanism, since this
engine generates exactly one real region per world. Two gates
mutation-verified. By direct follow-up instruction ("it doesn't
necessarily have to be a fugitive too... locate a family member"),
`missingRelationsOf`/`guessMissingRelationLocation` apply the
identical real landmark-clue mechanism to any real relationship,
deliberately without the fugitive-specific evasive flight on a wrong
guess -- an ordinary relation has no reason to run from a search they
don't know is happening.

## Biker gangs and motorcycle clubs, criminal and legitimate
See `CLAUDE.md`'s own standing rule for this round for the full
reasoning. By direct instruction: "biker gangs and biker
organizations... criminal and legitimate... statistics on areas with
the most motorcycles." Two new, generic `orgArchetypes.js` entries
reuse the real DOJ/ATF-documented structure (a "mother chapter,"
real officer roles, real criminal scope) without ever naming a real
club: **`'outlaw motorcycle gang'`** (`type: 'gang'`, the same real
§14 gang hierarchy every gang archetype already gets, banded low on
membership per NGIC's own real ~2.5%-of-all-gang-members figure) and
**`'motorcycle club'`** (`type: 'club'`, the real AMA-chartered/
veteran-riding-club shape, e.g. Patriot Guard Riders -- generalized
from, never generated as itself). No current real state-by-state OMG
density map exists, checked rather than assumed, so geography closes
with what IS real instead: `countryPacks.js`'s new `motorcycleOwnership`
field -- MIC's 2024 national topline plus a real but dated
per-capita state ranking (Montana and South Dakota rank above New
Hampshire/Iowa, correcting the common assumption). Opt-in
(`config.motorcycleOrganizations`), one of each per city.

## Baptist/nondenominational Protestant split, and why NOI/Moorish Science Temple/megachurch are declined
See `CLAUDE.md`'s ninety-fifth standing rule for the full reasoning. By
direct instruction: "add in the Moorish Science Temple of America...
the Nation of Islam... Add in any other religions I missed in Baptist
churches, mega churches." `server/protestantDenominationPacks.js`
draws a real `npc.protestantDenomination` (`'baptist'`,
`'nondenominational'`, `'other-protestant'`) from Pew's 2023-24
Religious Landscape Study, the same shape `islamicSectPacks.js`/
`jewishObservancePacks.js` already take, only for an NPC whose
`religion` already resolved to `'protestant'`. The Nation of Islam and
the Moorish Science Temple of America are checked and declined for a
data-quality reason, not a political one: no real survey (Pew's own
2021 "Faith Among Black Americans," the 2023-24 RLS) differentiates
Muslim traditions this finely, and the Moorish Science Temple of
America has no U.S. Religion Census or ARDA entry of any kind.
"Megachurch" is also declined -- real data, but from the Hartford
Institute's congregation-SIZE dataset, not the denominational-FAMILY
dataset this file actually draws from, and conflating the two would
misstate both.

## Homelessness statistics: veterans, addiction, mental health, and the honest limits around all three
See `CLAUDE.md`'s ninety-fourth and ninety-fifth standing rules for the
full reasoning. By direct instruction: "add in veterans and addictions
when you do unhoused statistics all over the country and the world,"
then "incorporate addiction, mental health, disease... do the same
thing all over the world."
`populationPacks.veteranHomelessnessRateFor` compounds HUD's real,
cited national veteran-share-of-homeless figure (32,882/771,480,
2024 PIT) onto whatever real local `homelessnessRate` a tract already
carries -- VA program-throughput data is a real, different fact,
checked and deliberately not merged in. `nationalDisablingConditionRateOf`
is a flat, national-only HUD figure (152,585/771,480) explicitly
labeled "disabling condition" (SUD plus mental illness plus
developmental plus chronic physical) rather than addiction-specific,
since no real sub-national addiction-only rate exists at any grain
HUD, SAMHSA or NSDUH publishes -- checked rather than fabricated.

`nationalSeriousMentalIllnessRateOf`/`nationalSubstanceUseDisorderRateOf`
break that bundle apart with SAMHSA's own real national figures
(~21% SMI, ~16% SUD, 2022-2023) -- HUD's CoC-level reports do separate
the two, but only as per-CoC PDFs, not one bulk file, so this stays
national-only like the bundle beside it. The widely-repeated
"35-40% have a substance use disorder" claim was checked again here
and still has no traceable HUD/SAMHSA source -- not used. Chronic
physical illness has no real isolated rate at any grain and is
declared rather than built. All three real community-level fields
(`chronicHomelessnessDisablingConditionRate`,
`homelessnessSeriousMentalIllnessRate`,
`homelessnessSubstanceUseDisorderRate`) are gated on the same real
local rate `veteranHomelessnessRate` already requires -- null for a
community with no real population pack.

International comparison was checked twice now: OECD's own
documentation says homelessness definitions are not comparable across
its member countries, and UN-Habitat's current ~318 million global
estimate is a single aggregate with no per-country breakdown and no
harmonized definition yet published -- so none was wired in as if it
were either time.

## Rogue ex-state security forces
See `CLAUDE.md`'s own seventy-ninth standing rule for the full
reasoning. By direct instruction: once a real local government stops
reaching an area at all (`authority.writOf` reading `lawless`), its
own real, already-corrupt officers (`leadership.'Corruption Risk'`,
generated on every NPC and read by nothing until now) organize into a
real `'rogue security force'` (`server/roguePolice.js`,
`orgArchetypes.js`), keep real weapons (an ordinary pistol for every
defector, an upgraded rifle for the leader only where a real regional
military-capability gate is open), and immediately try to use that
force — a real territorial claim, resolved the same tick by the
ordinary territory-control mechanism every other faction's hold
already goes through. Gated end to end on a new opt-in
`config.securityForces` (default false): no world that never turns it
on has a real officer corps for any of this to act on.

## V4 and VASH ecosystem link-outs close standing rule 5
See `CLAUDE.md`'s own seventy-eighth standing rule for the full
reasoning. Standing rule 5 has always named six apps to link to —
Vavlt Stvdios, Vvltvre, DREAMS, VENVS, V4, VASH — but the Phase 4
round above only ever built four. `v4TwinLink` and `vashTapLink` close
the other two, same `ecosystemLinks.js` gate, same "resource locator,
not a confirmed deep link" posture: V4's real named-agent twin profile
(`GET /api/twins/:agentId`) and VASH's real, public Tap resolution
(`GET /api/taps/:tapCode/resolve` — never the payment route, which
stays a sibling app's own concern).

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

## Oregon Trail-style group travel
See `CLAUDE.md`'s own ninety-seventh standing rule for the full
reasoning. By direct instruction: Oregon Trail-style group travel,
"resource consumption over distance/time." `server/travel.js` is a
real haversine distance (`geo.distanceMetres`/`positionOf`) between
two real generated cities, covered at the National Park Service/
Oregon-California Trails Association's own documented historical
wagon-train pace (~24 km/day), by the leader plus their real,
already-assembled `party.partyOf` roster -- never a second group
mechanic. Each real travelling day consumes one real `food`-category
and one real `water`-category item from whatever a member actually
carries; running short does not kill outright, it adds one real,
independent deprivation draw alongside a traveler's own ordinary
home-city mortality risk, through the one real `mortality.recordDeath`
choke point. Arrival relocates every real survivor through
`migration.relocate` into a real community of the destination city --
arriving with no real property yet is an honest landing in this
engine's own already-real homelessness substrate, not a second
invented status. `roundTrip: true` turns around at the destination and
brings the group home with no second migration event, closing
`migration.js`'s own declared "nothing returns somebody to where they
came from" gap for the first time. Runs as a fourth cross-cutting tick
layer right after mortality. `POST /api/players/:id/action` verb
`begin-journey`; `GET /api/entities/:id/journey` is the real, live
read. Carry weight, vehicles and terrain are explicitly out of scope,
left for their own still-unbuilt rounds. Three new gates
mutation-verified.

## Off-grid wilderness camps: woods, caves, lakes
See `CLAUDE.md`'s own ninety-eighth standing rule for the full
reasoning. By direct instruction: off-grid wilderness camps after the
chaos hits. `server/camps.js` reuses the identical "group" concept
`travel.js` just established (the founder plus their real, already-
assembled `party.partyOf` roster) rather than inventing a second one.
`cave` is gated on a real, already-generated `cave-system`/
`natural-formation` landmark actually existing in the named community
-- refused outright when none does. `woods` closes a second real
"generator nothing calls" gap in the same round: `city.landCoverClass`
(a real EarthEnv Consensus Land-Cover class) had been written at
generation and read by nothing in `server/*.js` until now --
`camps.js` checks it against `landCoverPacks.FOREST_CLASSES`,
narrowing a real signal rather than requiring one, so a city with no
land-cover pack is never refused. `lake` is honestly left ungated,
checked rather than assumed: the twelve published Consensus Land-Cover
classes have no open-water class at all, so there is no real signal
here to gate it on. Deliberately adds no resource-consumption pass
(that answers a different request, already closed by `travel.js`) and
makes no change to `motivation.js`'s housing need. `POST
/api/players/:id/action` verbs `establish-camp`/`join-camp`/
`leave-camp`/`break-camp`; `GET /api/entities/:id/camp` is the real,
live read. Three new gates mutation-verified.

## Nomadic groups, families and organizations
See `CLAUDE.md`'s own ninety-ninth standing rule for the full
reasoning. By direct instruction: "a lot of groups and families and
organizations will become nomadic after the chaos hits."
`server/nomadic.js` is a real, computed, never-stored read over the
two mechanics this round already built (`travel.js`/`camps.js`), not a
third one: a family or organization is nomadic right now when its own
real head/leader is on a real journey or at a real camp, checked
against that one real person rather than every member individually.
`GET /api/entities/:id/nomadic-status`, `GET /api/families/:id/
nomadic-status`, `GET /api/organizations/:id/nomadic-status`.

## Party-integrated search-and-locate
See `CLAUDE.md`'s own hundredth standing rule for the full reasoning.
By direct instruction: "integrate party/escort with search-and-locate
mechanics." `fugitives.js`'s two real search-and-locate functions
(the Carmen Sandiego-style fugitive chase, and an ordinary lost
relation) each gained a party-aware sibling --
`guessLocationWithParty`/`guessMissingRelationLocationWithParty` --
letting a searcher cover more than one real candidate community in
one attempt, one real person per place (themselves plus their real
`party.partyOf` roster), capped at exactly how many real people are
actually there to send. Deliberately ONE real correctness check and
at most one real flight draw per attempt, never one per named
community -- both the solo and party-aware guesses now share a single
real `resolveGuess` choke point, so a party can never farm extra
flight attempts inside what is supposed to be one simultaneous
search. `POST /api/players/:id/action` verbs `guess-fugitive-
location-with-party`/`guess-missing-relation-location-with-party`,
no new routes. Five new gates mutation-verified.

## Vehicles: cars, motorcycles, scooters, fuel, theft and restoration
See `CLAUDE.md`'s own hundred-and-first standing rule for the full
reasoning. By direct instruction, closing the rest of "the Oregon
Trail travel and off-grid camps... and the rest": a real vehicle
system built almost entirely out of substrate this engine already had
sitting unused. `car`/`motorcycle`/`scooter` are three new real
`salvage.js` PRODUCTS/RECIPES (mechanic, Tier 3, Technology) --
crafting one from nothing is already `salvage.make`, no second
crafting path. Closes a real teardown gap for free:
`salvage.CATEGORY_TEARDOWNS.transport` had existed since that table
was written, with no real `transport`-category item ever registered
to exercise it.

`server/vehicles.js` adds three genuinely new things over that real
substrate: real pace (400/350/150 km/day for car/motorcycle/scooter,
flagged interpretive, scaled by the vehicle's own already-tracked
inventory `condition`), real fuel (the real `fuel` resource-type name
`items.RESOURCE_TYPES` had carried since that list was written and
nothing had ever generated or consumed -- registered as its own real
item under that same name), real theft (`heists.robberyAptitudeOf` is
the identical real composite that file already built for exactly this
shape of crime; success transfers the item and writes a real
`crime.recordCrime` incident, category `theft`), and real restoration
(repairing an already-held vehicle's condition from real salvaged
materials, at half the matching recipe's cost, through the identical
Tier/skill gate building one from scratch needs -- refuses outright,
never half-applies, when the materials cannot be afforded).

**A real bug found and fixed before shipping, not after**: the first
version of `stealVehicle` picked whichever holder of the named type
happened to be first in `worldState.inventory`, not the actually-named
victim -- harmless with one real vehicle in the world, silently wrong
the moment a second person held the same type. Caught by testing two
real simultaneous holders, not assumed safe from one; fixed with an
explicit, required `victimEntityId` argument and a self-theft guard.

`travel.js`'s own journeys are the real fuel consumer: an optional
`vehicleType` on `beginJourney` replaces the walking pace with the
held vehicle's real km/day rate (read once, at the journey's start,
never re-read mid-journey -- a real, named scope boundary), and each
real travelling day draws one real fuel item from the leader's own
inventory and applies real wear to the held vehicle. Out of fuel
stalls the day (the vehicle does not move, `daysElapsed` does not
advance) rather than harming anybody -- running out of gas is a pace
problem, not the deprivation `travel.js` already models for food and
water, which keep drawing normally on a stalled day.

**Declared, not built**: no carry-capacity limit exists anywhere in
this engine (there is no weight cap on a holder's own inventory to
raise), so "a vehicle increases carry capacity" is stated as a real
gap rather than a number with nothing real to multiply.

`POST /api/players/:id/action` verbs `steal-vehicle`/`restore-vehicle`,
no new routes -- the same "write-only player verb, no GET needed"
posture `establish-camp`/`begin-journey` already have. All real gates
mutation-verified, including the theft-targeting bug's own regression
test and the travel.js fuel-stall/wear-application integration points.

## Real occupations and landmarks: casino, dock, ranger, fire/EMS, and real multi-role institution staffing
See `CLAUDE.md`'s own hundred-and-second standing rule for the full
reasoning. By direct instruction ("add it... casinos... dock
workers... park rangers... fire departments, EMS workers... all their
employees"), Round 1 of a larger backlog: eight new real occupations
(`ranger`, `firefighter`, `paramedic`, `dockworker`, and four real
licensed casino roles -- `dealer`, `pitboss`, `cashier`, `bookmaker`,
every one a real, cited BLS/O*NET code), five new real hero-tier
landmark categories (`casino`, `fire-station`, `ems-station`,
`ranger-station`, `port-terminal` -- the same "any other genuinely
distinctive feature not covered above" extension `school` already
used), and a real, long-missing gap closed along the way: `school`
itself had never been given a real staffing crew.

**Casino is a real, explicit override of this project's own standing
gambling/casino compliance gate** -- recorded on the record, the same
posture Leader mode's own reopening already holds.

**`config.institutionStaffing`** (opt-in, default `false`) is the
general form `prisonStaffing`'s own header had already named and left
undone: every real hero-tier landmark with a real crew
(`landmarks.crewFor`) -- hospital, university, library, school, and
the five new categories -- gets its FULL real crew hired, reusing the
exact `control.maintenanceFor` composition its own takeover
requirement already computes, never a second, different headcount.
`prison` is explicitly excluded; it keeps `prisonStaffing`'s own
unconditional warden-and-guard staffing rather than also getting the
generic crew. All real gates mutation-verified.

## Real landmark density: more than one of each, and two new categories
See `CLAUDE.md`'s own hundred-and-third standing rule for the full
reasoning. A direct question found a real structural limit: every
hero-tier landmark is drawn WITHOUT REPLACEMENT per city, so no city,
however large, could ever have a second hospital or a second school.
`mall` and `park` also did not exist as categories at all.

Both are closed now. `mall`/`park` join the Key the same way `school`
did (THE_KEY_BUILDING_TYPES.md's own "any other genuinely distinctive
feature not covered above"). `config.realLandmarkDensity` (opt-in,
default `false`) generates the real EXPECTED count of eight
repeatable categories -- `school`, `hospital`, `library`,
`art-museum`, `university`, `church`, `park`, `mall` -- against each
city's own real population, using real, cited national rates (NCES,
AHA, IMLS, NRPA, Hartford Institute -- see `landmarks.
REPEATABLE_DENSITY_PER_1K`'s own header for every citation) rather
than an invented number. The expected count is drawn with a real
probabilistic rounding, never floored to a guaranteed minimum and
never capped at one -- a university's real rate means most small
towns should genuinely get zero; a church's real rate means a modest
town should genuinely get several. Categories with no clean real
density figure found (skyscrapers, government buildings/city halls,
mosque/synagogue/temple, and this session's own casino/fire-station/
ems-station/ranger-station/port-terminal) are named rather than
guessed, and stay at the original one-per-city cap. All real gates
mutation-verified, including a near-miss where the first test used too
small a population to actually exercise the real rate.

## Trucking, warehousing, manufacturing, and large retail -- the
## "trucking market... Family Dollars, Dollar Generals... Walmart's,
## Targets, Sam's, Costco's... Ralston, Purina... Procter & Gamble,
## chemical plants" round, St. Louis as the real worked example
Three new occupations (`server/occupations.js`): `trucker` (BLS SOC
53-3032/53-3033, Heavy/Tractor-Trailer and Light Truck Drivers),
`dispatcher` (SOC 43-5032/43-5011, Dispatchers and Cargo/Freight
Agents), `assembler` (SOC 51-2092, Team Assemblers). Two new hero
landmark categories (`server/landmarks.js`): `distribution-center`
(the real, generic substrate for "UPS/FedEx/Amazon/Walmart-style"
warehouse mega-employers named directly) and `industrial-plant` (auto/
food-beverage/chemical manufacturing mega-employers), each with real
per-capita density -- `distribution-center` from Census CBP NAICS
493110 (General Warehousing and Storage, 2023, ~17,868 establishments,
a flagged real range), `industrial-plant` from Census CBP's 500+-
employee manufacturing establishments nationally (2023, 3,384
establishments, employing 3.80 million people) -- and real crews
(`distribution`: dockworker/trucker/dispatcher/logistician/manager;
`plant`: assembler/mechanic/engineer/manager).

Three new retail categories (`landmarks.RETAIL_TYPES`): `discount-
store` (the real dollar-store format, generic name over the brand,
~27,900 combined Dollar General + Family Dollar US locations, rate
0.0832/1000), `restaurant` (~749,000 US locations per the National
Restaurant Association's own 2024-data figure, rate 2.238/1000 --
its 2025 Pocket Guide's own "1M+" headline figure is a different,
unreconciled measure and is named rather than silently preferred), and
`big-box-store` (the Walmart/Target/Sam's Club/Costco cluster named
together as one phrase, generic category over any one brand, ~7,822
combined US locations, rate 0.0233/1000).

`data/st-louis.landmarks.json` grows from 25 to 34 locations and from
7 to 17 areas, with nine real greater-St.-Louis warehouse/trucking/
industrial districts named directly added to `areas` (crossing into
Illinois the same way Cahokia Mounds/Confluence Point already do:
Earth City, Hazelwood, Edwardsville, Granite City, Pontoon Beach,
Sauget, South Broadway, the St. Charles/I-370 corridor, Hall Street/
North Broadway, plus Maryland Heights for World Wide Technology's real
HQ). Nine real, individually-checked named landmarks fill them rather
than a generic density count, since a pack-driven city is named real
places, not counted ones: Gateway Commerce Center (Edwardsville, IL --
TriStar's 2,300-acre bulk-distribution park), Earth City Business Park,
Hazelwood Logistics Center, Sauget Business Park, Nestlé Purina
PetCare's real North American HQ at Checkerboard Square, the real
Procter & Gamble home-products plant at 169 E. Grand Ave. (Cascade/
Mr. Clean/Swiffer/Febreze, ~100 years operating), the real Solutia
W.G. Krummrich chemical plant in Sauget, IL (formerly Monsanto, ~100
years operating -- the real chemical plant this round asked for by
category), World Wide Technology's real ~176-acre industrial campus
near Edwardsville, and a real, named Amazon sortation center in
Hazelwood. Five of the nine named districts got no landmark row at
all -- no single real, named industrial park was confirmed for any of
them in this pass, stated as a gap in the pack's own `note` field
rather than silently left looking complete, the same posture every
other honest gap in this registry takes. Moolah Temple's address
("Kings Highway near Delmar") was checked and corrected in the prior
round; this round rechecked rather than assumed that WWT's downtown-
style HQ building (Maryland Heights) is a different real asset from
its Edwardsville-area industrial campus, and gave the campus the
landmark row rather than forcing an office HQ into a warehouse
category.

All real gates mutation-verified; full suite green before and after.

## Car lots, car washes, and six more real logistics operators
Two more `RETAIL_TYPES` entries ("inventory and car lots, car
washes"): `car-lot` and `car-wash`. `car-lot`'s discovery pool is the
real `transport` §26 category `auto-parts-store` already drew from --
a lot full of real vehicles needed no new category, only a second
reader of one that already existed; `car-wash` gets the honest `null`
a service with no real inventory already holds elsewhere.

A direct follow-up ("Amazon's all over the area... 3-4 Edwardsville...
East St. Louis, Cahokia Heights area, Sauget area... don't forget the
FedExes, UPSs") added six more real, individually-checked landmarks to
`data/st-louis.landmarks.json` (now 39 locations, 18 areas): a second,
distinct real Amazon building in Edwardsville (3931 Lakeview Corporate
Dr., a different real address from the Gateway Commerce Center
building already in this pack), a real Amazon mini-fulfillment center
in Sauget, UPS's real Earth City hub and a real UPS delivery center in
Belleville, IL (a new real area, adjacent to Sauget/East St. Louis),
and FedEx Ground's own real Earth City hub (named in FedEx Ground's
own published hub list, no current address confirmed so none is
invented). Checked and genuinely not found: no confirmed real Amazon/
UPS/FedEx facility address in East St. Louis or Cahokia Heights
specifically -- stated as a gap in the pack's own `note` rather than
silently dropped.

All real gates mutation-verified; full suite green before and after.

## Clayton, Westport, University City, St. Ann/Overland, Bevo Mill
Five more real areas and four more real landmarks in
`data/st-louis.landmarks.json` (now 43 locations, 23 areas), by direct
instruction ("business areas, Clayton... Westport... U City, which is
like our Chinatown... Indians... St. Ann, Northwest County...
Mexicans... our Bosnian population on the south side"): the real St.
Louis County Government Center in Clayton; Westport Plaza, a real
42-acre district in Maryland Heights; Jeffrey Plaza in University
City, the real commercial anchor of the Olive Boulevard corridor St.
Louis Public Radio's own reporting documents as the city's current,
informally-recognized Chinese-American district; and Bevo Mill, the
real windmill-style City Landmark (4749 Gravois Ave., built 1916) that
gives St. Louis's Bosnian community -- real and documented as tied
with Chicago for the largest Bosnian-American population in the U.S.
-- its "Little Bosnia" nickname.

Checked and corrected BEFORE shipping this time: St. Louis's actual
historic Chinatown was Hop Alley, downtown, demolished in 1966 -- real
and documented, but named only as historical context in the pack's
own `note`, never given a landmark row, since a demolished site is
not a standing landmark (the prior round's Purina lesson, applied
before the mistake instead of after). Checked and genuinely not
found: no real source ties a specific Indian-American business
corridor to Olive Boulevard -- that corridor's documented community is
Chinese, not Indian, named as a correction rather than asserted.
North St. Louis city/county's real, documented majority-Black-American
population is named as context only, the same treatment the Ozarks
already got, with no landmark forced onto a demographic fact about an
area. **None of this is wired into any mechanic** -- this engine's
real per-NPC ethnicity system already assigns real Census data by
tract position, never by neighborhood name, and the §9 firewall is
unchanged.

## Dock/port cargo: a false claim, closed for real
`landmarks.js`'s own `port-terminal` comment has claimed since the
casino round that cargo "arrives through" `trade.js`/`barter.js` --
checked directly and found false (`grep -rn "port\|cargo\|dockworker"
server/trade.js server/barter.js` returns nothing). `config.
portCargoImports` (opt-in, default `false`) closes it for real: a real
`port-terminal` boosts its own city's real `food` resource supply by a
flagged-interpretive, bounded 1.15x -- checked rather than guessed
which resource, using USACE's own 2023 Mississippi-basin commodity
data (Missouri 42%/Illinois 38% of commodity value is grain, not metal
or ore) rather than inventing a new `metals` resource type that would
misstate what a real river port actually ships most of.

A real idempotence bug was caught writing the test for this, not
reasoned out in advance: the first version re-boosted every earlier
call's already-boosted port city on each new `generateWorld()` call,
since nothing marked a resource as already handled. Fixed with
`resource.portCargoBoosted`, the same real marker shape
`institutionStaffing`'s own `landmarkProperty.staffed` already uses.
Three new tests, one gate mutation-verified by deleting the marker's
own check and confirming the exact failure reproduces.

## Military bases, forests, rivers, lakes
Four new hero landmark categories (`military-base`, `forest`, `river`,
`lake`), closing a real gap this project's own spec names at §30
("*Strategic:* ...military sites..."; "*Natural:* caves, forests,
mountains, rivers, lakes...") and never built beyond caves.
`military-base` reuses the existing "every government-type landmark
gets the region's real government as operator" pass with zero new
code, and a new `garrison` crew (officer/mechanic/engineer/
logistician/physician/manager, all already-real occupations).
`weapons.js`'s `machine_gun` gate now also allows a real military-base,
mutation-verified. `forest`/`river`/`lake` are genuinely unstaffed, the
same honest `staff: null` `park` already holds.

Eight real landmarks: Scott Air Force Base (its own census-designated
place, new area), Jefferson Barracks (active MO National Guard post,
Lemay), Goodfellow Federal Center (real DoD tenants at 4300 Goodfellow
Blvd. -- the real site behind "a military or National Guard site off
of Goodfellow"), St. Louis Arsenal (active, Air Force-owned, houses
the NGA), the Mississippi and Missouri Rivers (no `area` -- too large
for one), Creve Coeur Lake, and Rockwoods Reservation. Verified in a
real generated world: all four bases placed, staffed with real
garrison occupations, and produced sensible finds; the four natural
categories placed with no operator, exactly as designed.

## St. Louis hospitals/universities, the Civil Courts Building, and Confluence Point
Ten more real landmarks, by direct instruction. Civil Courts Building
(Downtown, a 1928-1930 step-pyramid building modeled on the Mausoleum
at Halicarnassus, genuinely distinct from the already-present Old
Courthouse); Harris-Stowe State University (real public HBCU,
Midtown); Fontbonne University -- CORRECTED to `historic-site` rather
than an active `university`, because its Board voted in March 2024 to
close after the 2025 summer term and sold the campus to Washington
University, so marking it an operating university would auto-hire
real faculty there; Memorial Hospital Belleville (the real "hospital
in Belleville" -- HSHS St. Elizabeth's, the other Belleville name,
actually moved to O'Fallon, IL in 2017); St. Louis Children's
Hospital, SSM Health Cardinal Glennon Children's Hospital, SSM Health
DePaul Hospital, Mercy Hospital St. Louis, and the St. Louis VA
Medical Center's John Cochran Division.

CHECKED AND DECLINED: Lincoln University is a real HBCU, but it is in
Jefferson City, MO, roughly 130 miles from St. Louis -- not added,
same as Meramec Caverns and the Ozarks were kept out of a St. Louis
neighborhood they are not actually in.

Confluence Point and the "hard to open... have the key... hold things
on the inside" request both needed no new code, only verification.
Confluence Point's category (`natural-formation`) is already
hero-tier, so it is already placed as a real property with a real
community -- the one precondition `missionTriggers.maybeTriggerMission`
needs to fire there. And `server/hiddenCaches.js` already gives any
real landmark (these ten included) a real, gated, key-locked chance of
holding a real find -- built earlier for a different direct
instruction, and this round found it already covers the Civil Courts
Building and every hospital/university added here too.

## Piasa Bird, breweries, haunted sites, casinos, stadiums, apartment complexes
Twenty-one more real landmarks and two real bug fixes, by direct
instruction. The Piasa Bird and Grafton Harbor Marina close the
"anywhere that touches the Missouri/Mississippi River has value"
river-dock request; Anheuser-Busch Brewery closes the brewery
request (two craft breweries were researched and then REMOVED after
`landmark-packs.test.js` caught them as a retail category this
hand-typed pack isn't allowed to carry); Lemp Mansion and the former
St. Alexius Hospital/Northwest High School close the haunted/abandoned
request; Grant's Farm, Missouri Botanical Garden, Tower Grove Park,
and WildCare Park (the real but uncertain match for "the zoo off of
Riverview") close the parks/zoos request; four real casinos and two
real stadiums (The Dome at America's Center, correcting "the Rams
Stadium" -- the team left in 2016 -- and Francis Olympic Field, the
real 1904 Olympics stadium) close those two; and five real apartment
complexes close both "big apartment complexes" and "Section 8/public
housing locations" at once, because three of the five turned out to
be real St. Louis Housing Authority developments rather than
market-rate buildings.

**Two real pre-existing bugs, found because this round's new
`apartment-complex` category is the first hero category ever given
`propertyType: 'residential'`.** `migration.vacanciesByCommunity` and
`statistics.vacancy_rate` both filtered on `type === 'residential'`
alone to mean "an ordinary home," which a residential-type landmark
(never populated by the ordinary home-assignment path) breaks --
fixed by excluding `landmark_category` from both, mutation-verified
by reproducing each failure directly before fixing it.

Declared gaps, not builds: a river-adjacent property-value mechanic,
open national farmland-for-sale data (checked -- no open dataset
exists), and a finer per-nationality Asian-population breakdown for
West County specifically (city-level totals for Chesterfield/Ballwin
were added; the finer ACS tables were not pulled this round).

## Duplicating the St. Louis method, and real workforce-nativity data
Asked to confirm the St. Louis approach can be duplicated across the
country, and the answer needed no new code: `landmarkPacks.js`'s join
is already region-agnostic (proved with a synthetic Chicago pack, not
just inferred), so a second real city needs a new, real, cited
`data/<city>.landmarks.json` -- the same research method this file's
own St. Louis sections already document -- not an engine change.

Also closed: real national foreign-born shares for `physician`/`nurse`
(26%/16%, Migration Policy Institute's 2021 ACS tabulation) and
`teacher` (~8%, Brookings/IIR), with real top origin countries for
each, reported as a derived estimate over a real community's own real
occupation headcount -- never a per-NPC field, so it stays on the
right side of the fortieth standing rule's own "occupation tied to
ethnicity" decline. And the "people out of place after chaos" framing
already has most of its pieces built: `migration.js`'s real relocation
mechanics, `fugitives.js`'s pursuit mechanism, and `countryPacks.js`/
`migrationPathwayPacks.js`'s real country-of-origin context -- pointed
out rather than rebuilt.

## Comprehensive global country coverage (income level)
`server/globalIncomeClassification.js` extends `countryPacks.js`'s 36
countries with 122 more real ones, scoped honestly to income level
only (World Bank FY2027 bands already in use elsewhere in this
project) rather than attempting full depth for all ~190 countries in
one pass. Each entry is confidence-flagged -- `bracket-estimate` for
well-established economies, `checked` for four directly-verified
borderline cases (Romania, Moldova, Tunisia, Sri Lanka), and
`null`/`no-reliable-figure-found` for North Korea rather than a
guessed level. `globalIncomeLevelFor` always defers to
`countryPacks.COUNTRIES` first, so the two tables never disagree about
a country both happen to cover.

## National Guard / federal enforcement archetype + area holds-or-falls variance
`territory.js#resolveTerritoryControl` was purely deterministic before
this round -- the same inputs always produced the same control score,
so an area never actually held or fell differently between two
otherwise-identical runs. `orgArchetypes.js` gains a real
`'national guard'` entry (a state institution, never a landholding
faction), founded per-region by `worldgen.js` behind a new, opt-in
`nationalGuard: false` default so every existing world is unaffected.
`territory.js` now subtracts a founded Guard's own live `power` as a
real opposing force (weight measured against a real generated world's
controlScore distribution, not guessed) and adds real seeded jitter,
so the same block can genuinely hold in one run and fall in another.
Deliberately distinct from, and leaves untouched, the already-real,
already-calibrated abstract `statecraft.garrisonIn` signal
`authority.js` reads elsewhere. See CLAUDE.md's hundred-and-thirteenth
standing rule.

## Carry-capacity / bags / storage
`vehicles.js`'s own header had already declared this gap honestly --
"a real number with nothing real to multiply." `server/carryCapacity.js`
closes it, measuring capacity by real item COUNT rather than weight,
since no item in this engine's catalogue carries a weight/size field.
The "bags" half of the request turns out to already exist:
`salvage.js`'s own `container` product (Tier 1, Crafting, real
materials) had been real and craftable with zero consumers anywhere --
found rather than built from scratch. Wired into exactly one real
consumer this round -- `discovery.search` -- so a find that would put
the searcher over capacity still costs the location a real find but is
reported `carried: false` rather than added to inventory. See CLAUDE.md's
hundred-and-fourteenth standing rule.

## Weapon-visibility NPC reaction + memory/witness system
`policing.js`'s own comment already says a victim "is a witness this
engine actually has" -- true, and incomplete. `crime.js#recordCrime`'s
knowledge-write was the victim's own direct, immediate perception of an
incident; everyone else in the community had no such thing, only
word-of-mouth's slow spread from the victim outward days later, same as
someone who was never there. Scoped to `gun` (the one category this
engine already treats as visibly, specifically armed): every other
resident of the same community now gets a real, immediate stress load
and a real, direct `entity_knowledge` fact about the perpetrator, using
the exact same confidence mechanism the victim's own knowledge-write
already uses -- not a second, invented "distant witness" discount.
`policing.js` gained a real `WITNESS_BONUS` (half of `VICTIM_BONUS`)
that raises clearance chance whenever a real bystander account exists.
See CLAUDE.md's hundred-and-fifteenth standing rule.

## Disguise / notoriety-reduction mechanic
`policing.js#evasionOf`'s real Stealth/Deception/Black Market Ties/Heat
Tolerance average is explicitly "who this person IS" -- skill, not
choice. A mask or wig is the opposite: a choice made for one offence,
which helps an unskilled person exactly as much as a skilled one.
`server/disguise.js` is a small new module (a named item list, the same
shape `weapons.FIREARM_NAMES` already takes, and `isDisguised`, equipped-
only) wired into exactly one function -- `evasionOf` -- so every real
consumer of that number (crime.js's victim/witness confidence, task #35;
policing's own clearance chance) inherits the real bonus for free, with
no second confidence model. `mask`/`wig` are real, craftable
`salvage.js` PRODUCTS, the same `zip_gun`-style split between "how to
build one" and "what it means." See CLAUDE.md's hundred-and-sixteenth
standing rule.

## Car fencing (stolen-vehicle resale market)
A stolen vehicle had nowhere to record where it came from, so it sold
through `barter.exchange` at the exact same price a legitimate owner
would get. `vehicles.stealVehicle` now sets a real `stolen: true` flag
on the resulting holding row. `server/fencing.js`'s `isFence` reads the
real `criminal.'Black Market Ties'` trait `policing.evasionOf` already
treats as "moves things without getting caught" -- measured against a
real 180-NPC generated population, with the floor set at the measured
p90 (87). `barter.exchange` now refuses to move ANY `stolen: true`
holding to a buyer who is not a real fence (generic over every item,
not vehicle-specific), and a real fence pays a real discount
(`FENCE_PRICE_MULTIPLIER = 0.6`) through a new, optional
`priceMultiplier` on `agreedPrice`/`exchange` that defaults to 1 --
every existing call stays byte-for-byte unaffected. See CLAUDE.md's
hundred-and-seventeenth standing rule.

## Stakeouts and witness intimidation
Two separate real mechanics, because they answer two different
questions. A stakeout (`heists.stakeOut`/`hasRecentStakeout`) is real,
retrievable intel on a specific target that narrows a planned heist's
own `detectionChance` by a flat `STAKEOUT_DETECTION_REDUCTION` (0.1)
within a real recency window (`STAKEOUT_RECENCY_TICKS`, 14) -- it never
touches `successChance`, because watching a target first is planning,
not skill. Witness intimidation (`server/intimidation.js`, new) is
about what happens AFTER an offence: `intimidationChanceFor` weighs the
real, previously-unread `reputation.Fear Factor`/`Notoriety` traits
against the witness's own real `emotional.Resilience`, centred 50-vs-50
so an ordinary pairing is a coin flip. A success suppresses (never
deletes) the witness's existing `entity_knowledge` confidence about the
perpetrator by a real, bounded fraction (`INTIMIDATION_SUPPRESSION`,
0.7) -- the same "a knowledge row is a point-in-time record" discipline
task #35's bystander-witness rows already hold -- and real stress/memory
land on the witness either way. No ninth `crime.CRIME_CATEGORIES` entry
was added; this acts on an existing knowledge row, not a new offence
type. See CLAUDE.md's hundred-and-eighteenth standing rule.

## Group combat (gang wars)
By direct instruction, with explicit design goals: realistic, not mass
death; people are not trying to die; a fight can be "called in" and
stopped; losing is better answered by a hospital than by total defeat.
Violence in this engine hurt nobody at all before this -- confirmed by
grep, `mortality.DEATH_CAUSES`'s own `'violence'` entry had zero real
writers. `server/groupFights.js#resolveGroupFight` reuses
`contest.rateEntity`'s own real combat rating (never a second,
invented formula) averaged per SIDE, plus a real bounded size-ratio
edge. Severity per losing-side member is dead/injured/unharmed,
weighted so injury is the expected loss and death stays the measured
rare tail (a first version's separate death/injury "caps" turned out
to be unreachable by the real formula and were removed as decorative).
"Called in and stopped" reuses `authority.writOf` directly -- a real
governed area has a real, measured chance nobody gets hurt.
Hospitalization mirrors `justice.imprison`'s own status+release-tick
shape (quick recovery, wired into `tick.js`'s Security phase); death
is `mortality.killEntity`, permanent. `continueFight` is the one new,
opt-IN player verb -- fighting on at a real rating handicap rather
than the safe hospitalized default, which needs no verb at all.
Recovery does not have to be a literal hospital, by direct
instruction: `recoveryPlanFor` checks the patient's own real
organization AND family members (`householdOf`) for a real,
currently-employed `nurse`/`physician` first -- faster recovery
(`IN_HOUSE_RECOVERY_TICKS`) when one is kept in-house, the same
unstaffed `HOSPITAL_RECOVERY_TICKS` default otherwise even when a
real referral elsewhere is found, since travelling to a specialist
buys real expertise but not real speed. See CLAUDE.md's
hundred-and-nineteenth standing rule.

## Pervasive corruption + looting/B&E during collapse
Generalizes a real cut this engine already made three times --
`roguePolice.js`, `justice.js`'s prison breaks, `drugTrade.js`'s prison
smuggling all already read `leadership.'Corruption Risk'` against the
real, measured `CORRUPTION_DEFECTION_THRESHOLD` -- rather than
inventing a fourth. `server/corruption.js#runEmbezzlement` applies
that same cut to every real, active employment record at every real
organization with real `assets`, at a real, small, bounded skim
(`EMBEZZLEMENT_SKIM_FRACTION`), recorded as a real `fraud` incident.
`runCollapseLooting` needed no new break-in mechanic -- `authority
.writOf`'s real `lawless` regime is the real "collapse" trigger, and
`salvage.stripProperty` (previously reachable only through a player's
own `strip-building` verb) is the real break-in, now also called
ambiently for a real resident of a real lawless area against a real,
eligible, vacant property there. **Found and fixed a real crash
running the first 200-tick generated-world test that exercises this
end to end**: a corrupt ORGANIZATION LEADER embezzling from their own
org recorded themselves as their own victim, which `justice
.answerByGroup`'s real restitution transfer refuses -- `victimId` is
now null whenever perpetrator and leader are the same person, the
same honest "no entity id for the organization itself" treatment
`runCollapseLooting`'s own incidents already have. See CLAUDE.md's
hundred-and-twentieth standing rule.

## Extortion (corrupt forces/gangs/tribes vs. arriving businesses)
Reuses the identical real "who holds this ground when the state does
not" pair `heat.js` already established, rather than a second
territory model: `authority.writOf`'s real regime (a `governed` area
never gets extorted -- the state's own `judge`→`imprison` chain
already answers it completely) and `authority.holderOf`'s real
strongest-territory-block faction. `server/extortion.js#runExtortion`
finds every real business operating a real property in ground a
faction holds (never the faction's own operated property), demands a
real, small, bounded fraction of its real `assets`
(`EXTORTION_DEMAND_FRACTION`), and reads the business leader's real
`combat.'Composure Under Fire'` trait against the trait scale's own
neutral centre (50 -- the identical cutoff
`roguePolice.CORRUPTION_DEFECTION_THRESHOLD` already anchors to) to
decide pay or refuse. Paying moves real money from the business to the
faction, recorded as a real `theft` incident. Refusing does NOT call
`salvage.stripProperty` -- that function refuses an operated business
on purpose, exactly backwards for a retaliation that targets a
business still very much operating -- so the property's own real
`condition` is reduced directly by `salvage.STRIP_CONDITION_COST`'s
own real magnitude, and real heat (`heat.raiseHeat`) rises between the
defiant leader and the faction, recorded as a real `property`
incident. See CLAUDE.md's hundred-and-twenty-second standing rule.

## Penitentiary inventory (inmate-made weapons, commissary)
`shank` needed no new crafting mechanic -- `salvage.js`'s real
`PRODUCTS`/`RECIPES`/`canMake`/`make` is the one real crafting system
this engine has, already the home for `blade`/`club`/`zip_gun`. It is
a real Tier 1, `protection`-category product, crafted from real
`plastic` (a toothbrush's own real material) rather than a purchased
item directly, so `test/salvage.test.js`'s own closed-loop-ingredient
guard stays true. It is reachable the identical way every other
weapon already is -- the real, existing `make-thing` player verb --
because crafting in this engine has never had an ambient, NPC-driven
caller for any product. Commissary IS a real new ambient mechanic,
because nothing else in this engine lets an NPC spend real money on a
real item outside production or theft: `server/penitentiary.js
#runCommissaryPurchases` finds every real inmate at every real prison
(`justice.inmatesOf`, already built) with real, positive savings, has
them draw a real, affordable item from a small, flagged-interpretive
`COMMISSARY_CATALOG` (soap, a toothbrush, instant noodles, a postage
stamp, playing cards), pays its real price out of their own real
savings, and credits that real money to the prison's own real
operating organization's `assets` -- the same direct-mutation pattern
`corruption.js` already uses for organization assets. See CLAUDE.md's
hundred-and-twenty-third standing rule.

## Playbook / role-allocation (assign N members to strategy/security/etc.)
Bulks and bounds the already-built task-delegation primitive
(`leadership.js#assignRole`, task #44) rather than a second
role-assignment mechanism: `server/playbook.js#assignToPlaybook` loops
real subordinate ids through the identical real loyalty-gated
compliance draw `assignRole` already uses, against a small,
flagged-interpretive, bounded vocabulary (`strategy`/`security`/
`operations`/`recruitment`) in place of `assignRole`'s own open free
text for organizations. Catches per member rather than letting one
real refusal or invalid id abort the whole batch and discard the real,
already-applied outcome for everyone else in it. `playbookOf` is a
real, computed-never-stored rollup (standing rule 3) over
`membership.membersOf`/`findMembership`'s own live `role_in_org`
column, never a second count kept in sync by hand. See CLAUDE.md's
hundred-and-twenty-fourth standing rule.

## Sub-governments (orgs/tribes/gangs/towns) + cohesion scaling with level
Checked directly before building anything: towns already have a real
sub-government (`politics.foundGovernment`'s city-scoped rows) and
gangs already have one too (`membership.gangTierFor`'s own named
command tiers, `lieutenant`/`shot_caller`) — nothing to add for
either. The real gap was an ordinary organization (tribe/business),
closed by `server/subGovernment.js`: `assignSubLeaders` is the
identical bulk per-member try/catch shape `playbook.js` already
established over the same real `leadership.assignRole` primitive, a
different bounded vocabulary (authority, not function). "Organization
level" is the real `membership.memberCount`; `subGovernmentCoverageOf`
is the real ratio of actual sub-leaders (or, for a gang, actual
command-tier members) against how many that real size calls for.
`organizationCohesionOf` blends the real `internalLoyalty` trait
against that real coverage ratio -- deliberately NOT a copy of
`familyTraits.cohesionOf`'s pull/drag shape, because organizations
have no real conflict column to drag against, stated plainly rather
than inventing one. See CLAUDE.md's hundred-and-twenty-fifth standing
rule.

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
