# Tutorial missions — design notes, 26 Sep 2026

The owner's own reference points, checked against the engine rather
than borrowed as a mood board: each maps onto a real, tested system,
and only one of them needed a genuine gap checked before it could be
called real.

## The mapping

| Reference | What was asked for | Real system underneath | Status |
|---|---|---|---|
| **Zelda** | Progression gated by finding/learning the right thing | The mission state machine (`server/missions.js`) + `study` | Both real |
| **Maniac Mansion** | One place, several different things to find/do inside | `discovery.search` | Real — see below |
| **Carmen Sandiego** | Gather clues, including from NPCs | `discovery.search` (objects) + `study` from an `experienced NPCs` source (people) + `entity_knowledge` (a fact, held with confidence) | Real |
| **Oregon Trail** | Resource pressure, having the right things to survive | `economy.js`'s real supply/demand + `inventory.js` + real mortality from deprivation | Real |
| **River City Ransom**, 2026 | Gangs, tools/weapons, taking a city | `organizations` as factions + `control.js`'s takeover key + `contest.js` combat + `salvage.js`'s crafted `protection`-category items | Real, but thinner than "buy a weapon at a shop" — there is no dedicated weapon category, only tools (Hammer, Saw) and crafted `protection` items (a blade). Anything sold as a "weapon" is honestly a crafted `protection` item, not a new category. |
| **Contra** | The gameplay energy | `contest.js`'s combat resolver — a real, seeded, dangerous fight | Real as a *fight*, not as run-and-gun. VACON-C is a tick-based simulation (a tick is a day) behind a REST API — there is no real-time movement/aiming/shooting layer, and building one is a different kind of project, not a mission-content pass. What carries Contra's spirit honestly is real stakes in a real fight, not literal action gameplay. |

## The one thing that needed checking: Maniac Mansion

The open question was whether a single location supports several
distinct, separately-discoverable things, or just one draw per visit.

**It already does, for real.** `discovery.search(worldState, entityId,
propertyId)`:

- draws one of `book` / `artifact` / `item`, seeded on `[tick,
  propertyId, entityId]` — deterministic, not the same result twice at
  the same tick;
- decrements `property.discoveries_taken` against a real, finite
  `findsAt` capacity (`landmarks.significanceOf(propertyId) * 0.1`,
  floor 1) — a landmark runs out, it does not refill;
- so searching the SAME real landmark on different ticks yields
  different real finds until it is exhausted.

That is the Maniac Mansion loop — walk through the same house more than
once, find something different each time — without inventing a
room-by-room map layer this engine does not have and does not need for
a tutorial's purposes.

## A precise distinction worth keeping

**A meeting moves trust. Studying moves knowledge. They are not the
same mechanic**, and CLAUDE.md's own §24 pass says so explicitly:
"Meetings add no modifier at all, on purpose... a meeting moves the
trust between the people at it." `study`'s `experienced NPCs` source is
the real knowledge transfer — it reads a real occupation
(`occupations.occupationOf`) off a real nearby NPC and teaches the
field that occupation maps to.

A tutorial that wants "talk to someone, then learn from them" gets both
real steps rather than one pretending to be two: `call-meeting`
(purpose `teach`) builds the relationship, then `study` against that
same person as an `experienced NPCs` source is the actual learning.
Nothing here invents a bridge between the two — they are independently
real and happen to compose.

## Mission Chain #1 — "Start Here", the narrowest real slice

Three real, tested verbs, no new mechanic, no schema change:

1. **A starting book, seeded, not a mission.** A fresh citizen player's
   NPC is given one real book (`inventory.give`, the same primitive
   `worldgen.js`'s own starting inventory already uses) matched to a
   real field. This is not a `missions` row — `generateMission`
   requires an artifact or a location, and "study the book you were
   given" is about neither. Forcing it into the mission state machine
   would mean inventing a fourth kind of mission subject the schema
   does not have. The player can `study` it the moment they exist —
   that immediacy IS the tutorial: the first thing a new citizen can do
   is learn.
2. **A real Mission — explore a real landmark.** `generateMission({
   locationId, objective: "See what <landmark> still holds",
   reward })`. Accept it, `search-location` it (repeatable, per the
   Maniac Mansion finding above — a small capacity landmark still
   supports 2-3 real distinct finds), resolve `completed` once
   something is actually found. Pays on completion, same as every
   other mission.
3. **A real Mission — meet and learn from somebody in the trade.**
   `generateMission({ locationId: <their property>, objective:
   "Meet <name> and learn what they know", reward })`. Accept it,
   `call-meeting` (purpose `teach`) with a real NPC who holds a real
   occupation in the same community, then `study` against them as an
   `experienced NPCs` source, then resolve `completed`.

**Not built in this pass, named rather than skipped:** a river-city-
ransom-style "take a building" mission (needs `control.js`'s takeover
key, which is a much bigger real commitment — real money, a real
faction, a real building someone else may hold); anything Carmen-
Sandiego "gather three clues across town" (needs a multi-step objective
tracked across several searches, which the current single-objective
`missions.objective` field does not model without a real design
decision about what a multi-part mission record looks like); Contra-
style combat missions (needs a real "this fight is dangerous" framing
around `contest.js`, and a decision about what a lost fight costs the
player). Each is a real next chain, not invented here.

## Where the code lives

`server/tutorialMissions.js` — `seedTutorialStart(worldState, npcId)`,
scoped to this one chain, following the same "takes worldState
explicitly" convention as every other module here. Not a new player
mode, not a new schema table — three real calls into
`inventory.give`/`missions.generateMission` with content chosen for a
first-time citizen.
