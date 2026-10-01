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
| **Oregon Trail** | Resource pressure, having the right things to survive | `mortality.survivalScarcity` (real, measured 0..1 food/water/medicine shortage) + `areaStats.povertyLine`/`crime.js`'s real deprivation pressure + `barter.exchange` (now wired as the `trade` action) | Real — built as Mission Chain #3, see below |
| **River City Ransom**, 2026 | Gangs, tools/weapons, taking a city | The player's own real family as the tribe + `control.viableTargetsFor`/`assess-takeover`/`attempt-takeover` (already-built player actions, never yet used by a mission) + `control.materielOf`'s real §26 `tools`/`protection` categories | Real — built as Mission Chain #4, see below. Thinner than "buy a weapon at a shop": there is no dedicated weapon category, only tools (Hammer, Saw) and crafted `protection` items (a blade). Anything sold as a "weapon" is honestly a crafted `protection` item, not a new category. |
| **Contra** | The gameplay energy | `contest.js`'s combat resolver, now with real stakes wired in `engine.js#resolveContest` — real stress, a real memory, a real event, for entering `combat` through the dispatcher | Real as a *fight*, not as run-and-gun — built as Mission Chain #5, see below. VACON-C is a tick-based simulation (a tick is a day) behind a REST API — there is no real-time movement/aiming/shooting layer, and building one is a different kind of project, not a mission-content pass. What carries Contra's spirit honestly is real stakes in a real fight, not literal action gameplay. |

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

## Mission Chain #3 — "Keep Enough Set Aside", Oregon Trail's own loop

**The gap found researching this one, the same shape as `study()`
before Chain #1 wired it:** `barter.exchange` — the real function that
moves a real object and real money between two entities, seven fields
per item, buyer/seller barter-skill and trust read for real, a real
"seller must actually hold it, fall back to an untracked-goods proxy
otherwise" check — was reachable by nobody. No action verb, no route.
`grep -rn "barter\." server/actions.js server.js` returned nothing.
Fixed the same way `study` was: a `trade` action
(`server/actions.js`), `tradeWith`/`quoteTrade` engine wrappers
(`server/engine.js`) bound into `ACTION_VERBS`, `quoteTrade` carrying
the same look-before-you-spend `check` flag `make-thing` already uses.
`cityId` is derived from the actor's own community, never taken from
the caller — the same posture `tribeIdFor` holds for a takeover, so a
player cannot barter in a city they are not in to game the price.

**What "having the right things to survive" honestly maps to.** No
food, water or medicine item in this engine carries a real `Base_Value`
— §27 prices seventeen items (metals, gems, materials, two tools, a
musical instrument) and none of them are survival goods, and
`merchandise.js`'s own header already recorded this gap for `clothing`,
`food`, `repair` and `transport` categories. So a player cannot
literally buy a loaf of bread here, and inventing a price for one would
be exactly what `items.js`'s own rule forbids. What IS real: survival
pressure is measured at the CITY level
(`mortality.survivalScarcity` — the worst of food/water/medicine
scarcity, not the average) and a resident's own economic standing
(`areaStats.povertyLine`/`isBelowPovertyLine` against `getNetWorth`) is
the exact real threshold `crime.js`'s two deprivation checks already
read — a poor resident in a scarce city has a real, elevated per-tick
chance of being pushed into theft by `crime.advanceFriction`'s own
mechanism, already running. Staying above that line is the real stake;
`trade` (selling something real you carry, e.g. a tool) is the real
verb that raises it.

**The chain:** `offerSurvivalMission` reads the real scarcity for the
citizen's own city. If nothing is really short, it returns null — this
is the one chain of the three that is a correct, expected absence in an
ordinary well-supplied world, not a gap, unlike Chains #1/#2's
preconditions (a searchable landmark, two other real people) which are
closer to universal. When a real shortage exists, a Mission opens
naming it and the measured percentage, tied to a real property in the
community. The player accepts it, `trade`s something they carry for
money (or otherwise raises their own savings), and resolves the mission
`completed` — the same caller-declared trust model every mission here
uses. `GET /api/players/:id/survival-status` is the look-before/after
read, same shape as `study-sources`: real city id, real scarcity
reading, real poverty line and net worth, real `atRisk` boolean.

## Mission Chain #4 — "Take the Block", River City Ransom, 2026

**No gap this time — just two real verbs nobody had ever pointed a
mission at.** `assess-takeover`/`attempt-takeover` (`server/actions.js`,
`server/control.js`) have been real player actions since 18 Sep 2026.
What was missing was content: nothing had ever named a real target for
a fresh citizen to try them against.

**The substrate, all already built:**

- `control.viableTargetsFor(worldState, { tribeId, cityId })` already
  ranks every real target `assess()` would currently call winnable for
  a given tribe — real composition math (§26 `tools`/`protection`
  categories a tribe actually carries, `familyTraits.cohesionOf`), not
  a guess made here.
- The player's own real family IS the gang. `control.js`'s own
  cohesion math (unity pulling, conflict discounting, `roleOf`'s
  enforcer/labour/elder split) is exactly the tribe-loyalty mechanic
  the reference asks for, brought forward rather than invented —
  "2026" means real property and a real family, not 1989 Japan.
- "Tools and weapons": `control.materielOf` sums a tribe's real §26
  `tools`/`protection` holdings. There is no dedicated weapon category
  in this engine (the mapping table above says why), so the honest
  translation is a tribe that shows up with real tools, not an
  invented arsenal.

**The chain:** `offerTakeoverMission` reads the real targets available
to the citizen's own family and — scoped to `scale: 'property'` only,
since `missions.location_property_id` references a real property row
and the other three scales (`community`/`infrastructure`/
`organization`) have nowhere to sit in that column — names the single
easiest real one. Returns null when the citizen has no real family
(`control.js`'s own "a tribe of one has none [cohesion] to measure") or
when nothing reachable is currently winnable, both real possible
states. The player accepts the Mission, `assess-takeover`s it (look
before you leap — the same posture `make-thing`'s `check` flag holds),
`attempt-takeover`s it, and resolves the mission `completed` — the same
caller-declared trust model every mission here uses; nothing forces the
attempt to have succeeded first, since `resolveMission`'s outcome has
never been auto-verified for any mission in this engine.

## Mission Chain #5 — "Pick Your Fights", Contra's own stakes

**The one reference left with a genuine open question rather than a
missing system**, and this pass answers it. `contest.js` could already
resolve a real, seeded, dangerous fight from live `combat` traits — the
decision left open was what a LOST fight costs the player, since
`contest.js`'s own header is explicit that it "decides who wins. It
does not pay, book, or broadcast."

**Where the stakes live, and why not inside `contest.js` itself.**
`competition.js`'s tick-driven games hold the OTHER four disciplines
(`sport`/`teamSport`/`precision`/`wits`) and name, by name, why combat
is excluded from them: "it holds games, not fights" — reserving combat
for "a caller who means it". A player entering `combat` through their
own action IS that caller. So the stakes are wired into
`server/engine.js#resolveContest` — the bound layer every action
already goes through — rather than into `contest.js` (which VDP's
Combat Sports district calls directly and must stay exactly as pure)
or into `competition.js` (whose tick-driven games never touch combat at
all, and must keep not touching it).

**What actually happens, and to what.** Entering `combat` through the
dispatcher now applies, to BOTH entrants: real stress
(`behavior.applyStress` — more for the loser than the winner) and a
real memory (`worldStore.addMemory`, category `conflict`, positive or
negative by outcome) — plus one real event in the log. The other four
disciplines are completely unchanged: a friendly game entered through
the dispatcher must not suddenly cost more than one held by a tick.

**Pride, stamina, and skills — the follow-up ask, mapped onto real
traits rather than invented ones.** There is no trait literally named
"pride" in the 114-trait sheet; the owner picked `personality
.Confidence` as the real one it means — self-belief, moved
symmetrically by the outcome (unlike stress, there is no argument that
a pride swing should be lopsided; a win and a loss are the same event
from either side of it). Stamina is real too
(`physical.Stamina`) and costs the SAME for both entrants regardless
of outcome — a fight is equally tiring whether you win it or not,
which is why this one does not split win/loss the way stress and
confidence do. And "could also gain skills" is real, but earned the
same slow way `competition.js`'s friendly games already grow
athleticism: a new `sparring` entry in `traitDrift.EXERCISES`
(`skills.Combat`/`physical.Stamina`) is reinforced as a habit on both
entrants — one bout barely moves it, same as `compete`'s own measured
48.92→49.10 over 600 ticks; a habit of real fighting moves it for
real. All three live in `server/engine.js#resolveContest`'s combat
branch, right alongside the stress/memory/event write-back.

**Not gambling, on purpose.** `competition.js`'s own header already
states the constraint this had to respect: "nothing here stakes
anything, pays anything or prices anything" — gambling/casino systems
stay closed pending compliance review (CLAUDE.md's locked scope). So
the stakes here are never money: no wager, no side bet, nothing priced.
What is at risk is the mission's own ordinary reward (paid only on
`resolveMission`'s `completed`, exactly like every other mission) and
real, measured stress — a state change, not a financial one.

**The chain:** `offerShowdownMission` names the single toughest real
opponent in the citizen's own community, by real `combat` rating
(`contest.rateEntity`) — the reference asks for gameplay ENERGY, and a
fight against the easiest person in town has none. The player accepts
the Mission and `enter-contest`s the named opponent with
`discipline: 'combat'` — the existing action, now carrying real stakes
— and resolves the mission either way. `winProbability` is capped at
0.97, never certain, so a favourite can still lose; nothing here makes
the fight safe.

## Where the code lives

`server/tutorialMissions.js` — `seedTutorialStart(worldState, npcId)`
composes all five chains, and `offerMysteryMission`/
`offerSurvivalMission`/`offerTakeoverMission`/`offerShowdownMission`
individually for Chains #2–#5, all following the same "takes
worldState explicitly" convention as every other module here. Not a
new player mode, not a new schema table — real calls into
`inventory.give`/`missions.generateMission`/`crime.recordCrime`/
`mortality.survivalScarcity`/`areaStats.povertyLine`/
`control.viableTargetsFor`/`contest.rateEntity` with content chosen for
a first-time citizen. `server/actions.js`'s `trade` action and
`server/engine.js`'s `tradeWith`/`quoteTrade`/`survivalStatusFor` are
Chain #3's other half — `barter.exchange`, reachable at last. Chains #4
and #5 needed no new action verb at all: `assess-takeover`/
`attempt-takeover`/`enter-contest` were already real and simply had no
mission pointing at them yet (#4), or nothing real riding on the
outcome (#5) — `server/engine.js#resolveContest`'s combat-stakes branch
is that missing piece.
