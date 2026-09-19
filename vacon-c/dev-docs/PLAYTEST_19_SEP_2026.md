# Playtest — 19 Sep 2026, 600 ticks

CLAUDE.md's sixteenth standing rule: build a world, run it long, and
print what a PLAYER would see. Run with
`node vacon-c/scripts/playtest.mjs 600`.

This one follows a session that added four systems — salvage, discovery,
merchandise and the per-area landmark key — plus two tick passes, a
grant inside `control.attempt`, three schema columns and a 24th Key
category. **The world survived it.** No throw, 600 ticks, population
150 → 148 with eight deaths and six births.

That is worth saying plainly because the previous playtest found a
`advanceTick` that raised and stopped the world outright, and 876
passing tests had not noticed.

---

## Fixed in this pass

### Discovery stripped the world in eighty days

`SEARCH_CHANCE` was 0.01 per adult per tick. Measured on a generated
world — 150 people, 21 landmarks, a total supply of 81 finds — the pass
emptied **every landmark in the world in 81 ticks**, and 79% of it
inside sixty days.

A player arriving in the second season of the first year would find
every library already picked clean and never know there had been
anything in them. **That is worse than the system not existing**,
because the world still looks like it should hold something.

The rate was set from what the prose said — "a notable expedition" —
without checking what that came to against a real population. At 0.01 a
person searches three or four times a year, which is a habit, and
habits belong in `behavior.js`.

Re-measured across candidate rates, each in its own process because
`generateWorld` appends to the shared `WorldState` and the first attempt
silently compared 150 adults against 600:

| rate | world emptied at | |
|---|---|---|
| 0.01 | 81 ticks | 0.2 years |
| 0.004 | 181 ticks | 0.5 years |
| 0.002 | 373 ticks | 1.0 years |
| **0.001** | **996 ticks** | **2.7 years** |
| 0.0005 | 1,329 ticks | 3.6 years |

Set to **0.001** — one search per person every two or three years, which
is what the file's own header meant. The supply is finite and does not
replenish, on purpose: what a collapse left behind is what there is.
Discovery is deliberately an early-world system that fades, and this
rate decides that it fades over about three years rather than one
season.

### A column the migration never wrote

`communities.name` was added to `schema-extensions.sql`, written by
`territory.generateCommunity`, read by `landmarkPacks.byArea` — and
never added to the `INSERT INTO communities` column list. A restored
world came back with every neighbourhood anonymous, so a pack that put
the Gateway Arch in Downtown before a restart would scatter it after
one, looking exactly like a pack that had never been used.

Fixed, and generalised: `test/migrate.test.js` now fails on any column
`schema-extensions.sql` adds that no INSERT writes. All 28 pass.

### The playtest was blind to everything built this session

Salvage, discovery, merchandise and the per-area key were all invisible
to it. **A system the playtest cannot see is a system the playtest
cannot find a bug in** — the eleventh rule pointed at the diagnostic
itself. It now prints landmarks per area, what has been found and made,
both guards, and the new event types.

---

## Found and NOT fixed — these are open, and deliberately so

Each of these is real, reproducible, and larger than a constant. They
are written down rather than patched, because three of the four are
arguably design decisions somebody should make on purpose.

### 1. 85% of all buildings are ruins by tick 600

`properties at condition 0: 176 of 206.`

Property decays 0.4 a tick and `upkeepFor` only offsets it for a
building somebody is actively keeping. Over 600 days that is 240 points
against a starting condition drawn 20–90, so everything unmaintained
reaches zero and stays there. Measured earlier with salvage disabled:
96 of 196 at 200 ticks **without** any stripping, so this is the
pre-existing decay and not the new system — `stripProperty` added five
buildings out of 196 over 200 ticks.

It is the thirteenth rule's shape at the scale of a city: a mechanism
whose inverse only applies to a minority. A world older than about two
years is a ruin field with a few kept buildings in it. That may be
exactly right for a collapse setting — but it should be a decision,
and right now it is an emergent consequence of one constant.

### 2. No mission is ever completed

`mAvail 3, mDone 0` — constant across all 600 ticks.

Three missions are available at generation and none is ever finished,
because **only a player can accept one**. There is no NPC pass that
takes a mission, so in a world with no player the entire artifact and
mission system is inert. `availableMissions` returns 3 forever.

This is the eleventh rule again: `missions.js` is complete, correct,
tested, and reached by nobody unless a human is driving.

### 3. Median net worth rises 10× and never falls

`2,682 → 25,947` over 600 ticks, monotonically, at every sample.

Wages are paid, goods are sold, and nothing removes money at the rate
it enters. `distress_sale` (62 events) moves goods for money and
`barter.exchange` is conservative between two parties, so the aggregate
only grows. There is no tax, no rent to an absent owner, no
depreciation of savings.

A world where everybody gets richer forever makes poverty-driven
mechanics — `crime.deprivation`, `distress_sale`, the migration
pressure — progressively unreachable. It is a slow absorbing state and
it is exactly what the thirteenth rule says to look for.

### 4. Four of five neighbourhoods sit at crime 100 and health 0

```
c1 pop 37 health 27 stab 37 STRUGGLING  crime   0
c2 pop 37 health  0 stab 24 COLLAPSING  crime 100
c3 pop 43 health  0 stab 26 COLLAPSING  crime 100
c4 pop 13 health  0 stab 24 COLLAPSING  crime 100
c5 pop 18 health  0 stab 23 COLLAPSING  crime 100
```

Crime is **capped at 100** in four of five areas and health is **floored
at zero** in the same four. Both are clamps, and a clamped value carries
no information: c2 and c4 have very different populations, employment
and education, and read identically on the two fields a player would
look at first.

The areas do differ on `writ`, `emp` and `edu`, so
`areaStats` is working. It is the two headline numbers that have
saturated.

---

## What is working, measured

- **Employment**: 62 jobs → 106 → 94. The labour market hires and lays
  off, and a released prisoner can work again.
- **Areas differ**: five communities with distinct populations,
  employment, education and writ.
- **The new systems reach people**: 69 discoveries, 12 things made, 616
  partnerships, 35 feuds, 12 conflict escalations, 10 crimes with 12
  clearances and 6 convictions.
- **Every landmark is named**, and every area has some: 21 landmarks
  across 5 communities, 13 of 34 categories present in a one-city world.
- **Both guards are clean**: salvage reports nothing worthless,
  unreachable, unused or unmakeable; discovery reports no empty item
  category and no unreachable knowledge field.
- **Artifacts come from somewhere**: 12 of 15 carry a `location_id`, a
  column no caller had ever passed before this session.
