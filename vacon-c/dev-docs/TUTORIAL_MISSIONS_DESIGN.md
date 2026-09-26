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

## A correction, found while researching Mission Chain #2

**The first version of this note said "a meeting moves trust, not
knowledge" as a blanket claim. That is wrong, and the real picture is
richer than what it replaced.** `meetings.hold`'s `PURPOSES` table
carries two independent flags, not one:

- **`teaches`** — true only for `purpose: 'teach'`. The deepest-trade
  holder at the table becomes the teacher and `hold()` calls
  `knowledge.study(...)` **internally**, for real, for every other
  attendee — the exact `experienced NPCs` mechanic Mission Chain #1
  uses, already wired into the meeting itself.
- **`shares`** — true for every real purpose (`sit-down`, `plan`,
  `negotiate`, `teach`, `recruit`, `form alliance`). `shareAround`
  copies every fact an attendee holds (`entity_knowledge`, excluding
  facts about people in the room) to every other attendee, confidence
  degraded by the teller's own distortion. CLAUDE.md's own line was
  narrower than it reads: "no [takeover] modifier" was about the
  takeover-composition multiplier specifically, not about knowledge in
  general.

So a meeting **always** moves facts (any purpose), and **additionally**
teaches a trade (only `purpose: 'teach'`, and only if a real teacher is
present). Mission Chain #1's mentor mission still calls `study`
explicitly after the meeting rather than relying on the automatic
`teach` path — that stays correct regardless of which purpose the
player picks, and a second, deliberate study session on top of an
automatic one is a real second gain, not a bug.

**This is also the real substrate behind Mission Chain #2, below**:
`shareAround` is a genuine "ask around and the story changes in the
retelling" mechanic, already built, already tested — nothing here
needed to be invented for Carmen Sandiego's clue-gathering to be real.

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
faction, a real building someone else may hold); Contra-style combat
missions (needs a real "this fight is dangerous" framing around
`contest.js`, and a decision about what a lost fight costs the player).
Each is a real next chain, not invented here.

## Mission Chain #2 — "Ask Around", Carmen Sandiego's own loop

A single-step objective (`missions.objective` is one string, not a
tracked multi-part list) about a real fact somebody holds, learned by
asking them — not the "gather three clues across town" full version
that note above still correctly leaves open, but a real, complete first
loop rather than nothing.

**The substrate, found already built, not invented:**

- `crime.recordCrime(worldState, { category, perpetratorId, victimId,
  tick })` — a real incident, and the victim comes away with a real,
  confidence-weighted fact naming the (possible) perpetrator
  (`policing.evasionOf` against `perception.receivedConfidence` — an
  unskilled offender is easy to identify, a careful one is not).
- `meetings.shareAround` — any real meeting purpose copies what an
  attendee knows to everyone else at the table, confidence degraded by
  the teller's own distortion. This is the "ask around, the story
  changes a little each time" mechanic.
- `GET /api/npcs/:id` already answers `knowledge:
  worldStore.getKnowledge(...)` — a player reading their own NPC
  already sees every fact it holds. No new read route needed.

**The chain:** `offerMysteryMission` seeds one real `theft` incident
(mundane, not disturbing — Carmen Sandiego's own register) between two
real NPCs in the citizen's community, which gives the victim a real
fact. A real Mission is opened, objective naming the victim, tied to a
real property in the community. The player accepts it, `call-meeting`s
the victim (any purpose — `shares` is true for all of them), the fact
copies onto the player's own NPC via `shareAround`, `GET /api/npcs/:id`
shows them what they now know, and they resolve the mission
`completed`. Nothing verifies the player actually read the fact before
resolving — the same trust model every other mission in this engine
already uses (`resolveMission`'s outcome is caller-declared).

## Where the code lives

`server/tutorialMissions.js` — `seedTutorialStart(worldState, npcId)`
for Chain #1, `offerMysteryMission(worldState, npcId)` for Chain #2,
both following the same "takes worldState explicitly" convention as
every other module here. Not a new player mode, not a new schema
table — real calls into `inventory.give`/`missions.generateMission`/
`crime.recordCrime` with content chosen for a first-time citizen.
