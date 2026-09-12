# VACON-C — the game references, mapped to mechanics

The owner named a set of games as the design language for VACON-C:
**Where in the World is Carmen Sandiego, Maniac Mansion, Zelda, Grand
Theft Auto (including the direction of GTA VI), River City Ransom, the
EA Sports / 2K statistical model, Oregon Trail**, plus casino play and
ordinary house games — pool tables, cards.

This document turns each of those into a mechanic, says what is
already built, and says what it would take. It exists because a
reference is not a specification: "make it like Zelda" is a real
instruction and an ambiguous one, and the useful move is to name the
*mechanic* the reference is pointing at and then check whether this
engine has it.

**Two limits stated up front.**

**No code or internals come from any of these games.** For GTA VI in
particular: it is unreleased, and nothing here is drawn from its
implementation — what follows is the publicly-visible *design
direction* of the open-world crime genre, which is a different thing
and the only honest thing to work from. Everything below is built out
of VACON-C's own systems.

**Casino play stays closed.** `vacon-c/CLAUDE.md` keeps gambling and
casino systems (#291–305) shut pending compliance review, and that is
a legal gate rather than a scope decision. VAGO is the ecosystem's
gambling app and settles in VCoin and Gold Coin only. House games are
a separate thing and are built — see §8.

---

## The mapping, at a glance

| Reference | The mechanic it points at | Status |
|---|---|---|
| **Oregon Trail** | Party attrition — scarcity, disease, death as arithmetic you feel | ✅ **Built** |
| **House games** (pool, cards) | Skill contests with no stakes | ✅ **Built** |
| **EA Sports / 2K** | Rated attributes resolving a contest | ⚠️ Bouts yes, **leagues and seasons no** |
| **Carmen Sandiego** | Pursuit through clues that can be wrong | ⚠️ The knowledge layer exists and is unused for pursuit |
| **Zelda** | Progress gated on capability, not on a key | ⚠️ Two gates built, no third |
| **River City Ransom** | Fight → earn → buy → get stronger | ⚠️ Every piece exists, **the loop is not closed** |
| **GTA** | Territory, heat, consequence in an open world | ⚠️ Territory yes, **heat no** |
| **Maniac Mansion** | Several characters, a verb list, one building | ⚠️ Verbs and buildings yes, **no room interior** |
| **Casinos** | Wagering | 🔒 Closed pending compliance |

---

## 1. Oregon Trail — built, and it is the spine

**The mechanic:** you and yours are crossing something hostile, and the
world subtracts from you. Food runs out, disease arrives, people die,
and the arithmetic is the drama.

This is not a comparison — it is literally what `server/mortality.js`
now does. Annual death risk is
`(base + age + scarcity) × disease × vitality`, with **no minimum
age**, so:

- a famine kills children first (total food shortage: **1 in 4 annual
  risk at five years old**),
- an epidemic ignores birthdays,
- scarcity reads the **worst** of food, water and medicine rather than
  their average, because plenty of food and no water is a settlement
  that is dying,
- a drought kills through the shortage it causes rather than by being
  a drought, so the cascade does the work.

**What is missing from the Oregon Trail feel:** the journey. There is no
movement (§44) and Transportation is deferred, so a settlement can
starve where it stands but a party cannot set out and lose people on
the way.

## 2. House games — built

**The mechanic:** a pool table in a room is a social life. Not
gambling: a game somebody wins.

`server/contest.js` gained two disciplines:

- **`precision`** — pool, darts, horseshoes. Weighted on **Vision
  Acuity** (which was generated on every NPC and read by nothing),
  Coordination, Reflexes, Agility and Focus. **Strength and Endurance
  are deliberately absent**, so a frail person with a steady hand beats
  a powerful one who cannot see the shot.
- **`wits`** — cards, dominoes, board games. Risk Assessment, Memory,
  Focus, Problem Solving, and Charisma at low weight, because a card
  game is partly a performance and this is the one discipline where
  persuading somebody of something false is a skill.

Expressing them as disciplines rather than as a new subsystem means
everything `resolveContest` already guarantees comes free: a seeded,
replayable, re-verifiable result. **No stakes are attached and none
should be** — that is the line between a pool game and the casino
systems that stay closed.

## 3. EA Sports / 2K — half built, and the missing half is named

**The mechanic:** every competitor is a sheet of rated attributes, the
contest resolves from those ratings, and the *statistics* accumulate
into a record you care about.

**Built:** `rateEntity` turns a live trait sheet into one number, and
`resolveContest` decides a bout probabilistically from it, seeded so a
settled result can be re-verified. A weaker competitor can win — §52
requires that combat not be guaranteed.

**Not built, and `CLAUDE.md` already says so in its own words:** "no
season, table, fixture list, standings or tournament exists anywhere in
`server/`. The engine can now decide who wins a fight; nothing yet
organises fights into a competition." **Zero tables in the schema match
`teams` or `leagues`.**

So the 2K-shaped gap is exactly: seasons, fixtures, standings, and a
statistical record per competitor across them. `historical_records`
would hold the results; the aggregation is the work.

## 4. Carmen Sandiego — the mechanic is here and pointed the wrong way

**The mechanic:** you chase somebody through a world by collecting
testimony. Witnesses are unreliable, clues are partial, and geography
is knowledge.

**This engine already has the hard part.** `entity_knowledge` is not a
fact table — it carries `confidence_level`, `distortion_level`,
`source_entity_id` and `spread_rate` per entity. That is a
**testimony** model: different people know different things, with
different certainty, distorted by transmission, attributable to
whoever told them. Building that is normally the expensive part of a
deduction game and it was built here for rumour propagation.

**What is missing is a pursuit to point it at.** Nothing asks "where is
X", accumulates partial answers, or narrows a location from
contradictory reports. `missions.js` has a real accept/resolve state
machine, and a pursuit mission would be a mission whose completion
condition is a deduction rather than an arrival.

**This is the highest-value unbuilt mechanic in the list**, because it
needs no new subsystem — only a mission type that reads
`entity_knowledge` the way it already exists.

## 5. Zelda — two of the three gates exist

**The mechanic:** the world is open and your *capability* is what gates
it. You do not find a key; you become able.

**Built, twice:**

- `technology_eras` — an era needs its prerequisite era **and** a
  population whose reemergence index clears the level it asks for, and
  `canUnlock` returns *why* it refused rather than a bare boolean.
- Artifact control nodes — `LOCKED / CONTESTED / CONTROLLED /
  FORTIFIED` is dungeon gating in the schema's own vocabulary, and
  mission access keys off it.

**Missing:** the personal gate. Knowledge tiers 1–10 (§25) do not
exist, so nothing is locked behind what a *person* has learned — only
behind what a civilization has reached. Zelda's gate is individual;
both of VACON-C's are collective.

## 6. River City Ransom — every piece exists and the loop is open

**The mechanic:** beat somebody up, take their money, buy something at
a shop, become permanently stronger. A brawler with an economy welded
to character growth.

Every component is real and none of them are connected:

| Piece | Where it lives |
|---|---|
| The fight | `contest.js` — resolves, seeded |
| The money | `individual_finances`, and payroll already moves real money |
| The shop | `market_listings` with supply, demand and resolved prices |
| Permanent growth | `entity_traits` with `growth_rate`, and `applyKeyModifier` |

**What is missing is the four edges between them**: a contest that pays
the winner, a purchase that spends, an item that raises a trait, and a
trait that feeds back into the next contest rating. Each is small. The
loop is the thing that makes a brawler a game rather than a series of
fights, and it is the second-highest-value item here.

## 7. Grand Theft Auto — territory yes, consequence no

**The mechanic:** an open world where crime is a viable strategy with
escalating consequence. Territory is contested, and the law reacts in
proportion.

**Built:** `territory.js` resolves block control from loyalty,
resources and pressure. Factions carry full trait sheets. `criminal` is
a real trait family. `runSecurityPhase` exists.

**Missing, and this is the specific gap:** **heat.** One phase covers
crime and law enforcement together, and there are no patrols,
investigations, raids, arrests or clearance rates — so nothing
escalates. A wanted level is the mechanic the genre turns on, and it
would read the crime side of `runSecurityPhase` and feed the policing
side.

**Also missing:** vehicles (deferred with Transportation) and any
notion of a chase, which needs movement (§44).

**On GTA VI specifically:** the publicly-stated direction of that
generation is denser simulation — NPCs with their own routines,
schedules and economies rather than crowd scenery. **VACON-C is
already built that way**: `behavior.js` gives every NPC routines,
moods, habits and schedule events, and `runDecisionPhase` has them act
on needs. That is the one place where this engine is ahead of the
reference rather than behind it.

## 8. Casinos and wagering — closed, deliberately

Gambling and casino systems stay shut pending compliance review. That
is recorded in `CLAUDE.md` and in `VACANCY_API_ENDPOINT_MAP.md`'s own
"What NOT to build", and it is a legal gate.

**The distinction that matters for §2 above:** a pool game with no
stakes is a contest. A pool game with a wager is gambling. The
`precision` and `wits` disciplines resolve a winner and attach no
stakes at all, which is what keeps them on the right side of that
line. Anything that would settle a bet on one belongs behind the same
gate as the rest.

---

## What to build next, in the order that follows from this

Each of these is a mechanic somebody named, and each is stated with
what it actually needs.

| # | Build | Why here |
|---|---|---|
| 1 | **Inheritance and succession** | Death happens and nothing flows from it — employment does not end, property does not transfer, `npcs.generation` stays 1. This is what makes mortality into *continuity*, and three systems it needs (ownership history, families, political leadership) are all built. |
| 2 | **The River City loop** — contest pays, purchase spends, item raises a trait | Four small edges between four existing systems. Closes the first real gameplay loop in the engine. |
| 3 | **Pursuit missions** (Carmen Sandiego) | Needs no new subsystem: a mission type that reads `entity_knowledge`'s existing confidence and distortion. |
| 4 | **Heat** (GTA) | Splits `runSecurityPhase`'s two jobs and makes crime escalate. |
| 5 | **Leagues and seasons** (2K) | Contests resolve; nothing organises them. Needs `teams`/`leagues`, which the schema does not have. |
| 6 | **Knowledge tiers** (Zelda's personal gate) | §25, clean greenfield, and §40's prerequisite machinery is already built to copy. |

**Blocked on a decision rather than on effort:** movement and vehicles,
both deferred under Transportation in `CLAUDE.md`. Oregon Trail's
journey, GTA's chases and Zelda's overworld all need it, so that one
deferral is the common blocker behind three of the references.

**Held by a test:** `scripts/test/` does not check this document, and
it should not — it is design intent rather than measurement. The
*status* column above is measured, and
`dev-docs/VACANCY_SPEC_IMPLEMENTATION_MAP.md` is where those numbers
are held to the code.
