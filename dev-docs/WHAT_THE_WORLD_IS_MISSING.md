# What the world is missing

Measured, not estimated. Every number here comes from one command:

```
node vacon-c/scripts/measure-world.mjs            # a generated world
node vacon-c/scripts/measure-world.mjs --empty    # the world before worldgen.js
```

Run it rather than trusting this document to have aged well. If the two
disagree, the script is right.

---

## The headline

`server/statistics.js` carries **67 statistics** across §9's eleven
MASTER BLOCK KEY categories. What a world can actually answer:

| World | Answered | Computable but silent | Declared gaps |
|---|---|---|---|
| **Empty** — people placed in communities, nothing built | **36** | **23** | 8 |
| **Generated** — `server/worldgen.js`, 200 ticks | **57** | **2** | 8 |

The middle column is the finding. Those 23 statistics were **not
missing models**. Every mechanism was built and tested. They came back
null because:

> the generator existed, was tested, and nothing ever called it.

No code anywhere assembled a world, so every world this engine had run
was a crowd of people standing in an empty field. `server/worldgen.js`
is the fix, and it introduces no new modelling at all — it calls
functions that were already there.

### What the empty world could not answer, and why

| Silent statistics | Cause |
|---|---|
| 5 housing | nothing called `generateProperty` |
| 5 community | nothing called `generateInfrastructure` |
| 5 demographic | nothing set religion, language or education |
| `median_wage` | nothing called `hireEntity` |
| `mean_household_size` | nothing called `generateFamily` |
| `contested_block_share`, `max_organization_influence` | no factions, no blocks |
| `patrol_frequency`, `clearance_rate` | no public-safety infrastructure to investigate with |
| `public_safety_trust` | no cases, so no belief ever formed |
| `teenage_birth_share`, `mean_stress` | see below — these need the world to *run*, not to be built |

---

## Per-category coverage, on a generated world

| Category | Answered | Silent | Declared gap | Total |
|---|---|---|---|---|
| population | 11 | 1 | 1 | 13 |
| demographic | 6 | 0 | 1 | 7 |
| economics | 6 | 0 | 1 | 7 |
| housing | 5 | 0 | 0 | 5 |
| crime | 11 | 0 | 0 | 11 |
| organization | 3 | 0 | 0 | 3 |
| territory | 3 | 0 | 0 | 3 |
| **surveillance** | **1** | 0 | **3** | 4 |
| community | 5 | 0 | 0 | 5 |
| environment | 4 | 0 | 2 | 6 |
| psychological | 2 | 1 | 0 | 3 |

Surveillance is the thinnest block and it is honest about why: cameras,
street lighting and private security have no substrate anywhere in the
schema. That is a data problem, not a modelling one.

---

## The two that still need the world to run

**`teenage_birth_share`** — needs a birth, and a birth needs a
partnership. Bonds accumulate through repeated contact over a few
hundred ticks, so a freshly generated world has none. Run it and they
appear: in an 800-tick run of 50 people, 7 died, 8 were born, and the
population held at replacement.

**`mean_stress`** — and this one is a live gap rather than a matter of
patience. **Nothing in the tick pipeline ever applies stress.**
`behavior.applyStress` is reachable only through the API;
`runBehavior` decays what is already there and creates nothing. So a
world nobody pokes has no `entity_state` rows at all, and the Behavior
Engine's mood model — which is real, and tested — never engages on its
own. `test/worldgen.test.js` holds a check that fails if a module ever
starts applying stress, so this note cannot quietly go stale.

---

## The eight declared gaps, and what each would take

These are not oversights. Each one is declared in
`statistics.unavailable()` with a reason that names the missing
substrate, so a caller showing a user a dashboard can say *why* a
number is absent rather than showing a zero.

| Statistic | What it needs | Where it would come from |
|---|---|---|
| `migration_rate` | somebody to move. `migration_events` is schema-only and `runMigrationPhase` produces a risk signal that relocates nobody | engine work |
| `race_and_ethnicity_composition` | **deliberately absent.** No column, no document asking for one, and §9 forbids demographics determining morality, criminality, intelligence or worth — so adding one is an explicit decision, not a side effect | a decision |
| `informal_economy_share` | a formal economy to be outside of. Everything goes through `market_listings` or payroll | engine work |
| `camera_coverage` | any surveillance device in the schema | schema + data |
| `street_lighting` | `infrastructure.type` has ten values and lighting is not one | schema + data |
| `private_security_presence` | a security service somebody sells. Organizations have a `security` trait, which is their own defensive capacity | engine work |
| `pollution` | a pollution column anywhere. `environment_state` has weather, climate and disasters | schema + EPA data |
| `terrain_and_water` | `regions.geography_key`/`climate_key` are TEXT written by nothing | USGS 3DEP, NHD, NLCD, FEMA — see `LAND_AND_MAP_DATA.md` |

---

## Ranked: what to build next

### 1. Migration — the highest-leverage single system

Nobody moves. `migration_events` is schema-only, and the consequence
runs deeper than one silent statistic: **every per-area statistic
silently assumes nobody has ever moved.** `births.birthsIn` already
carries the caveat in its own header — a birth is counted in the
child's *current* community, which is exact only because relocation is
impossible.

Migration is what makes a neighbourhood *change* rather than merely
differ from its neighbour, and it is the mechanism behind half of §47's
NEIGHBORHOOD OUTCOME VARIABLES — development pressure, migration
pressure, and everything downstream of who arrives and who leaves.

### 2. Time series — the highest-leverage single statistic

Every statistic in the catalogue is a **snapshot**. You cannot see a
block declining, only that it is poor today. `analytics_snapshots` is a
real table in the schema with nothing writing to it.

This is arguably worth more than any individual new statistic, because
it applies to all 67 at once. A declining block and a poor-but-stable
block are different places and the catalogue currently cannot tell them
apart.

### 3. Stress in the pipeline

The Behavior Engine models mood, stress and habits, and nothing
triggers it. Crime, death, unemployment, eviction and scarcity are all
already computed every tick and none of them stresses anybody. One or
two edges would make an entire built subsystem live.

### 4. Inequality within an area

`median_net_worth` exists; spread does not. Two blocks with the same
median and different distributions are different places. A Gini
coefficient over residents' net worth is a few lines and is directly
comparable across areas.

### 5. Items, so a `gun_crime` figure can ever be non-zero

There is no item, inventory or equipment table anywhere in the schema.
This blocks the `gun` crime category and — separately — it is the
missing edge in the loop `GAME_LANGUAGE_AND_REFERENCES.md` describes:
contest pays, purchase spends, **item raises a trait**, trait feeds the
next contest.

### 6. Enrolment

Schools exist now as infrastructure with a real capacity. Students do
not, so there is still nothing to drop out of, and
`school_dropout_rate` stays absent. §25's knowledge tiers are the
natural substrate.

### 7. Flows rather than stocks

In-migration, out-migration, job turnover, eviction, business
formation and failure. The catalogue measures what a place *is*; almost
nothing measures what is *happening to it*. This overlaps heavily with
items 1 and 2 and is the general form of both.

---

## Still dead in the schema

Seven tables are defined and touched by no engine code. `urbanSystems.js`
tracks them as `schemaOnly` and `test/urban-systems.test.js` fails if
that label ever stops being true in either direction.

| Table | What building it would unlock |
|---|---|
| `migration_events` | item 1 above |
| `analytics_snapshots`* | item 2 above |
| `environment_state` | weather, climate and disasters per city; `pollution` if a column were added |
| `households` | a household is not a family — `mean_household_size` currently measures families |
| `economy_snapshots` | economic time series, the economics half of item 2 |
| `investments` | capital that is not savings |
| `trade_routes` | deferred with Transportation |
| `values_db` | deliberately untouched — `beliefs.js` covers the same ground and two mechanisms for one idea drift apart |

\* `analytics_snapshots` is not in `urbanSystems.js`'s `schemaOnly`
lists because no §7 system cites it; it is equally unused.

---

## Real-world data

Covered in full by `dev-docs/LAND_AND_MAP_DATA.md`, which maps each
declared gap to the dataset that would close it and covers the
licensing traps. The short version for accuracy specifically:

- **ACS 5-year** — poverty, employment, educational attainment, housing
  tenure and vacancy, at block-group resolution, public domain. Carry
  the margins of error; at block-group resolution they are often large
  relative to the estimate, and z-scoring a figure with a wide margin
  produces a ranking that is mostly noise.
- **NIBRS + local police open data** — real crime, with the caveat that
  reported crime is partly a measure of policing, and that the
  crosswalk onto this engine's eight categories is a set of judgement
  calls that must be written down or two areas stop being comparable.
- **County assessor parcels** — the only source for real land. Overture
  has addresses and buildings, not lot lines.

And the discipline that makes any of it usable: **record provenance per
import** — source, vintage, resolution, licence, retrieval date,
crosswalk version. Two areas imported from different vintages are not
comparable, and nothing downstream can detect that.

---

## What this document is not

It is not a roadmap anybody has agreed to, and it is not a claim that
the engine is thin. Fifty-seven of sixty-seven statistics answer on a
generated world, across every category the spec names, and the world
runs at replacement — people are born, age, work, offend, are
investigated, and die. The ranking above is what would make it *more
accurate*, in the order that the measurement supports.
