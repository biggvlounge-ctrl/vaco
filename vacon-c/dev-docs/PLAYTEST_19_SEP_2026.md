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

### Two tests that were asserting the opposite of what they said

The suite came out of this session at 1,158 pass / 2 fail. Both
failures were fixtures rather than engine bugs, and one of them was
covering a real defect.

**`authority`: "a lived-in, owned home holds; an empty one rots".** The
fixture listed `occupants: [1, 2]` in a world with no `npcs` array at
all. `upkeepFor` reads `occupants.length` for the base and then scales
it by `control.upkeepOf`, which resolves those ids against
`worldState.npcs` — so a fully occupied house measured as staffed by
nobody, ratio 0, upkeep 0. Failing since `03bbc7e`, three commits back,
and not from this session's work.

Giving the fixture real people exposed what it had been hiding, which
is the twenty-third standing rule and finding 1 below: the one-decimal
rounding on `condition` was a coarser quantum than the 0.05 a tick it
was rounding, so a maintained house sat at exactly 80.1 for two hundred
ticks. The assertion was `condition > 80`, which 80.1 satisfies — **an
assertion on the DIRECTION passes for a mechanism that has stopped.** It
asserts the RATE now.

**`justice`: "a generated world reaches it, and reaching it is RARE".**
It asserted that every cleared incident with a named perpetrator becomes
a court case. `runJustice` charges where the state's writ reaches and
files a `groupSanctions` row where it does not, which is the entire
point of `authority.prosecutes` — so the assertion silently asserted
that no area in the world is contested, and passed only while the seed
happened not to produce one. It did: incident 2, community 2, regime
`contested`. A working decline was reported as a broken cascade. It now
asserts every cleared incident is DISPOSED OF, as a case or a sanction,
and never both. That is the twenty-fourth standing rule.

**After both: 1,178 tests, 1,161 pass, 0 fail, 17 skipped.** world-layer
106 of 106.

---

## Found and NOT fixed — these are open, and deliberately so

Each of these is real, reproducible, and larger than a constant. They
are written down rather than patched, because three of the four are
arguably design decisions somebody should make on purpose.

### 1. 81% of all buildings are ruins by tick 600

`properties at condition 0: 166 of 206.`

**This was 176 of 206, and the ten that moved are worth more than the
number.** Chasing the first of the two test failures above led into
`advancePropertyLifecycle`'s rounding, which was quantising a +0.05 a
tick recovery at 0.1 — so a maintained building sat frozen instead of
improving, and the 176 was measured with the inverse switched off by a
tidiness measure. The rounding is two decimals now and buildings really
do recover. It moved 85% to 81%.

Which means the finding survives its own fix, and the broken-down
measurement says why. Same world, 600 ticks, split by whether anybody
lives there and whether anybody owns it:

| | n | at 0 | median | max |
|---|---|---|---|---|
| lived in + owned | 46 | 19 | 4.95 | 100 |
| lived in only | 66 | 56 | 0 | 36 |
| owned only | 16 | 13 | 0 | 39.45 |
| **neither** | **78** | **78** | **0** | **0** |

Three separate things, and only the first is a constant anybody should
consider retuning:

- **The inverse is about eight times weaker than the decay it
  opposes.** Gross decay is 0.4 a tick; the best case, a lived-in owned
  home, nets +0.05. A building that reaches zero needs **2,000 ticks —
  five and a half years — to climb back to 100**, which is why the
  lived-in-and-owned column has a median of 4.95: those are buildings
  that fell early and are now crawling back at the only rate available.
  A fall takes 250 ticks and a recovery takes 2,000.
- **Understaffing is doing what it was built to do.** `upkeepFor`
  scales by `control.upkeepOf(...).ratio`, so a landmark needing a crew
  of sixty with four people in it decays at nearly the full rate. That
  is deliberate and documented; it is not part of this finding.
- **78 of 206 buildings have nobody in them and no owner at all** —
  38% of the stock in a 148-person world. Those cannot be anything but
  ruins under any constant, because both halves of the inverse are
  absent. This is a worldgen question rather than a decay question:
  the generator builds more buildings than the population it generates
  can occupy or own.

The earlier salvage control still holds — 96 of 196 at 200 ticks with
stripping disabled, and `stripProperty` accounted for five buildings
out of 196 over 200 ticks — so none of this is the new system.

It remains the thirteenth rule's shape at the scale of a city, with the
diagnosis sharpened: the inverse EXISTS, it is not missing, it is
outmatched, and a third of the stock is outside its reach entirely. A
world older than about two years is a ruin field with a few kept
buildings in it. That may be exactly right for a collapse setting — but
it should be a decision, and the three causes above are three different
decisions, not one.

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

**That last sentence was wrong when I wrote it and is corrected
here.** The claim was that a world where everybody gets richer forever
makes poverty-driven mechanics — `crime.deprivation`, `distress_sale`,
the migration pressure — progressively unreachable. It does not follow,
and one look at `areaStats.povertyLine` would have said so:

```js
const mid = median(worths);
return mid === null ? null : mid * POVERTY_MEDIAN_FRACTION;
```

**The line is relative — half the median.** If every wage-earner's
savings inflate tenfold, the line inflates tenfold with them and the
SHARE below it barely moves. `isBelowPovertyLine` is relative on both
sides. So deprivation does not become unreachable; the nominal figures
just get bigger. Writing that down without checking the consumer was
the same "citation is not presence" habit this project keeps finding,
applied to my own reasoning.

What survives is narrower and still real, and it is a different defect:

**`economy.getNetWorth` is `assets + savings - debt` from
`individual_finances` and does not include the property somebody
owns.** `property.currentValue` computes value from condition — it
exists, it is correct, and `players.js` rolls it up as
`propertySummary.totalValue` in the same dashboard, right beside
`netWorth`. Eleven call sites read `getNetWorth`: the poverty line
itself (`areaStats`, twice), `crime.js` twice — who is deprived and who
is worth stealing from — `births.js`, `trade.js`, `motivation.js`,
`tick.js`, `statistics.median_net_worth` and `engine.getFamilyWealth`,
which is just a sum of them.

So **a person who owns three buildings and no cash reads as
destitute**, and a saver with no home reads as comfortable. The largest
asset class in the world is invisible to every wealth-dependent
mechanic. That is the third standing rule's shape — Property Value is a
computed rollup, it IS computed, and the function that most needs it
does not read it.

It also explains the monotonic rise better than the missing sink does:
property decays (169 of 206 buildings at condition 0 by tick 600, so
that value is being destroyed) while savings inflate, and `getNetWorth`
sees only the inflating half. **The headline was measuring one side of
a two-sided ledger.**

The missing sink is still real — production creates money from nothing
(`employer.assets += wage × WAGE_TO_OUTPUT × productivity`), payroll,
barter and inheritance only move it, there is no taxation anywhere in
`statecraft.js`, and nothing destroys money. But with a relative
poverty line it inflates nominal figures without changing who is poor
relative to whom, which is a far smaller problem than "10× and rising"
made it sound.

**Not fixed here on purpose.** Adding property to `getNetWorth` moves
the poverty line, and the poverty line moves deprivation crime, birth
rates and trade eligibility at once — the twelfth rule's first clause,
where a change centred wrong recalibrates the world. It needs the
before/after distribution measured first, and that measurement is the
next thing to run rather than a change to make on a second guess.

### 4. Four of five neighbourhoods sit at crime 100 and health 0 — FIXED, and re-played

**Resolved, and the re-play is the proof.** Same world size, same 600
ticks, after the fix described below:

| | before | after |
|---|---|---|
| c1 | health 27, crime **0** | health 30, crime **25** |
| c2 | health **0**, crime **100** | health 30, crime **25** |
| c3 | health **0**, crime **100** | health 39, crime **32** |
| c4 | health **0**, crime **100** | health 33, crime **35** |
| c5 | health **0**, crime **100** | health 28, crime **19** |
| stability | 1 STRUGGLING, 4 **COLLAPSING** | **5 STRUGGLING**, none collapsing |

Five distinct crime values across a real spread, health off the floor
in every area, and nothing else moved: 148 alive, 2,865 events, jobs
62 → 96, both guards clean, 21 of 21 landmarks named.

**Two causes, one fix, and the second was not the one that looked
obvious.** Measured across five seeded 600-tick worlds, 24 communities:

- **Calibration.** `DANGER_REFERENCE_PER_1K` was 40, chosen from a
  sentence about a real society written before anybody measured what
  this engine produces. The engine's own world rate is ~90 per 1,000
  per year and per-area rates run p50 80, p90 364. Every populated area
  was two to four times over the reference, so 18 of 24 read 100 and
  the other 4 read 0 — four distinct values in the whole sample.
- **Resolution.** A per-1,000 rate cannot be estimated from the 13–43
  people this engine puts in a community. One incident read as 58–100;
  the extreme in the sample was a community of **one person with six
  incidents = 6,000 per 1,000**, which is not a rate, it is a division.

Shrinkage toward the world rate fixes the second — a published method
for small-area estimation, not something invented here. **k was
estimated from the data, not picked**: method of moments gives 19.5,
stable at either population floor. The unfiltered estimate is 1.8, and
that is the part worth keeping — the single one-person community
contributed **87% of the observed between-area variance** and was about
to set the constant for the whole engine by itself.

The reference is now 280, the p95 of the shrunk distribution.
`dangerByCommunity` moved onto the same rate: it had been returning
exactly 1 for those same 18 areas, so `traitDrift`'s pull toward
criminality was the same constant in nearly every neighbourhood in
every world.

**`getCommunityHealth` subtracts `crime / 2`**, which is why one fix
moved both numbers. That was the whole of finding 4: not two symptoms,
one cause seen twice.

### 4b. The original crime entry, kept for the record

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

### 5. Migration fires on two ticks out of six hundred — OPEN

Found by chasing something else. The 1,200-tick run left c2 with **one
person** and c3 with eight while c1/c4/c5 held ~46, which looked like a
death spiral. It is not: **16 deaths in the whole world over 1,200
ticks**, against communities swinging by twenty-five people between
samples. People were moving, not dying.

Counted off `worldState.migrationEvents`, which is one row per person
per move — not off the tick event log, which is what the first probe
read and which reports the pass rather than the people:

```
total person-moves: 21 over 600 ticks
ticks with any move: 2 of 600
  tick 295: 11 moves, every one of them into c5
  tick 453: 10 moves, every one of them c3 -> c2
c1 and c4: no arrival and no departure in 600 ticks
```

**598 of 600 ticks had no migration at all**, and on the two that did,
every mover went to the same place. That is not a migration system, it
is two evacuations. A player watching this world sees nothing happen
for nine months and then half a neighbourhood leaves at once.

#### The first diagnosis was wrong, and the way it was wrong is the point

`destinationFor` returned the highest-scoring acceptable community, and
every term it reads — danger, vacancies, work — lives on the `shared`
snapshot `runMigration` builds once per pass. So everybody pushed on
the same tick computed the same number and got the same answer:
`willingness` and `MOVE_CHANCE` vary WHETHER somebody goes, and nothing
varied WHERE. That reads exactly like `drawOccupation`'s old mistake —
take the top instead of weighting and drawing — which this repository
had already diagnosed and fixed once.

So the draw was built: acceptable destinations weighted by
`score - current`, the quantity `PULL_MARGIN` is already a threshold
on, so no new constant. Three tests hold it, including two hundred
draws reaching all three of three acceptable destinations.

**Re-measured on the same world, the result was byte-for-byte
identical.** Same two ticks, same eleven and ten moves, same
destinations. A draw and an argmax agree when there is only one thing
to choose between, and the fix is inert on a real world.

That is standing rule 20 turned on my own work: a change whose effect
was argued rather than measured, and the measurement says zero. The
draw is kept because the argmax is still wrong in principle and the
tests are real, but **it is not the fix for this finding and must not
be recorded as one.**

#### What is actually being investigated

If the acceptable set has one member at the moment anybody decides,
the herd is a property of the SCORE, not of how the winner is picked.
`desirability` is two coarse terms — danger and work — both read from
a world snapshot shared by every person alive, with **no per-person
component at all**. `pushFor` already returns which need is pushing
somebody, and that is exactly the per-person term the destination
choice never consults: a person driven out by housing wants vacancies,
a person driven out by income wants work, and today they are handed
the same ranking.

That is the next thing to measure and it is not yet measured, so it is
not yet a finding.

### 5b. Two things measured while chasing finding 5, and left open

Both are structural rather than defects with an obvious fix, and both
are stated here rather than quietly patched.

- **`desirability` reads an unknown as a zero.** `workByCommunity`
  deliberately omits a community with no residents — its comment says
  "an empty community is unknown, not jobless" — and `desirability`
  then does `shared.work.get(id) ?? 0`, which is exactly the coercion
  the guard exists to prevent. Verified directly: an empty community
  with a free house and no crime at all scores **0.5**, read as
  definitely jobless. This is the `Number(null)` corollary in CLAUDE.md
  with a `??` instead of a cast.
- **The labour market is global, so the pull term is not a fact about
  the destination.** `runLabour`'s applicants are every unemployed NPC
  in the world and its employers every staffed organization, with no
  community term anywhere — and an `organizations` row has **no
  community field at all**, so it could not filter locally without
  going through `properties.operating_organization_id`, which it does
  not. Measured at generation, 56 of 56 placeable hires are local,
  because `worldgen` loops per community; every hire after generation
  is location-blind. So "share of residents who hold a job" — half of
  `desirability` — cannot be changed by moving, and the pull half of
  the migration model rests on a quantity that is not a property of
  the place.

### 5c. Two wrong turns on the way, kept because the wrong version was the plausible one

- **c2 is not collapsing, it is sloshing.** Over 600 ticks it went
  30 -> 19 -> 29 -> 30. The 1,200-tick endpoint of one person is a
  trough in an oscillation, not an absorbing state, and writing it up
  as a one-way ratchet would have been the twenty-fifth rule again — a
  correct measurement with a wrong consequence attached.
- **`households.syncHouseholds` is not uncalled.** It looked like a
  generator nothing invokes (rule 11), which would have frozen
  `properties.occupants` at generation and broken `upkeepFor`,
  `salvage` and the takeover composition at once. `runHouseholds`
  wraps it and runs in the cross-cutting slot at `tick.js:1341`.
  Occupants are live.

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
