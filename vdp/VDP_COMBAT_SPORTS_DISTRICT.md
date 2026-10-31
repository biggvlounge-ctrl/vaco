# VDP — Combat Sports District (v1)

A real, new feature for VDP: a genuine combat sports and wrestling
district, covering every real match format and skill level, from
street-level to professional, generalized to any combat sport, not
wrestling alone.

## Real confirmed match formats

- Royal Rumble-style (multi-person elimination)
- Tag team
- Cage match (enclosed, stipulation-style)
- One-on-one (standard singles)

**Any combat sport confirmed** — not limited to wrestling: boxing,
MMA-style formats, any other real combat discipline.

**All levels, confirmed, not professional-only**: covers every real
skill level, street/amateur through professional-tier — a real complete
progression path.

```
CombatSportsMatch {
  matchId,
  matchFormat: "royal-rumble" | "tag-team" | "cage-match" | "one-on-one",
  combatSportType: string,   // genuinely open — wrestling, boxing, mma,
                             // or any other discipline
  skillLevel: "street" | "amateur" | "semi-pro" | "professional",
  participantIds: [string]
}
```

## Direct integration with already-established systems

- **Vavlt Stvdios** — real matches stream live using the existing
  multi-channel architecture (multiple camera angles as separate,
  monetizable channels).
- **VAGO** — real VCoin-settled predictions on match outcomes, the same
  in-world prediction mechanic already established.
- **VOKEN** — real rookie Culture Cards for emerging combat sports
  talent, the same mechanic already established for musicians/actors,
  capturing a fighter's early career.

**Status: ready for Claude Code** — a real, complete combat sports
district inside VDP, directly integrated with Vavlt Stvdios' streaming,
VAGO's predictions, and VOKEN's rookie card system.

---

## Implementation status — filed and **built** 2026-08-27

Filed per `VACO.md`'s filing form. Classified **CODE-BEARING**, and
built the same day as `vdp/src/lib/combatSports.js`,
`CombatSportsView.jsx` and a `combat-sports` district in `world.js`
(8th row, second slot — no world growth needed). 25 tests in
`vdp/test/combatSports.test.js`, all ten rules mutation-verified.

Unlike the casino document filed alongside it, this one's three
integration claims all check out against real code, which is why it
was the cleaner of the two to build:

- **Vavlt Stvdios multi-channel** is real: built in
  `vavlt-stvdios/dev-docs/phase-1-multi-channel-core/`, with the
  8-screen session work in `phase-3-eight-screen-sessions/` and the
  casino events slice in `phase-7-casino-events-minimal-slice/`. VDP
  already consumes it through `vavltStvdiosClient.js` and the `stage`
  district.
- **VAGO predictions** are real: VCoin-settled contest and prediction
  mechanics exist in `vago/`, reached from VDP via `vagoClient.js`.
- **VOKEN rookie cards** are real: the card mechanic exists in
  `voken/`, reached from VDP via `vokenClient.js`.

So all three seams this district needs already exist as clients in
`vdp/src/lib/`. The district is new work; none of its dependencies are.

### What was built

All four formats with their real headcount rules — one-on-one and cage
match take exactly two, tag team needs whole teams of two, a rumble
takes three to thirty. `combatSportType` stayed an open string, per the
document's own "genuinely open," validated for being a real name rather
than constrained to a list.

The three integrations are **seams, not calls**: `broadcastChannels()`
returns the channel specs Vavlt Stvdios would open (with format-specific
angles added — a cage match gets `cage-top`, a rumble gets
`entrance-ramp`), `predictionMarketEligibility()` is the gate before
VAGO, and `isRookieEligible()` is the gate before VOKEN. Nothing here
calls them, for the same reason `venusResort.js` does not settle a
stake: a second place that computes a payout is how two systems start
disagreeing about what somebody is owed.

### The one thing that had to be decided

`skillLevel: "street"` is a progression tier in a fighting district,
and VDP is an avatar world with real VCoin settlement behind it. The
tier itself is fine as a label. What needs a deliberate answer, not a
default, is whether *street-tier matches settle money* — an unlicensed
underground-fight economy is a different compliance object than a
professional bout, and this document does not address it.

**Answered conservatively, and stated rather than defaulted:** street
matches are real, streamable and rankable, and cannot open a prediction
market. `SETTLING_TIERS` holds the three tiers that may have money on
them, and `predictionMarketEligibility()` returns the reason rather
than a bare false, because "why can I not bet on this" is the question
a player actually asks.

If it is decided the other way, `SETTLING_TIERS` is the one line to
change — the decision is deliberately not spread across the module.

---

## Live wrestling — filed and **built** 2026-10-31

**"people can wrestle other players live too" (direct instruction),
with the mechanic given directly too: a turn-based move exchange, not
an instant simulation.** Everything above this section books and
sanctions a card; nothing above it lets two real people decide a match
themselves. This closes that gap for the one case a simultaneous move
exchange can resolve cleanly: `one-on-one` and `cage-match`, exactly
two wrestlers. A live `royal-rumble` or `tag-team` needs a genuinely
different turn structure (elimination order, tag mechanics) and is
real, later work, not silently implied by this section.

### What was built

`src/lib/liveWrestling.js` — a pure, storage-agnostic engine, the same
discipline `combatSports.js` itself holds: `startLiveMatch(match)`
seeds both wrestlers at 100 health/100 stamina; `submitMove(liveMatch,
wrestlerId, move)` records a round's pick and resolves the round the
moment both wrestlers have one in; `forfeitMatch` and
`describeLiveMatch` round it out. Six real moves (`strike`, `grapple`,
`highRisk`, `reversal`, `pinAttempt`, `submissionAttempt`) forming a
real rock-paper-scissors triangle (strike beats grapple beats
high-risk beats strike) plus a defensive reversal that nullifies a
strike/grapple and hard-punishes a high-risk, and two finishers gated
on the opponent's health/stamina being worn down enough — a failed
finisher leaves its own wrestler fully exposed to real offense that
round. A match ends by pin, submission, or stoppage (health reaches 0
from ordinary offense with neither finisher ever attempted). Every
number is a flagged, invented balance choice, the same posture every
other invented constant in this document already carries — there is
no source here to be unfaithful to.

**This module never decides a winner on `combatSports.js`'s behalf.**
Same seam discipline the three existing integrations above hold: a
live match's "ended" fact is handed to `combatSports.recordResult` by
the caller (`server.cjs`), the exact same settlement path an
operator-declared result already uses — one place decides a winner,
not two.

**Server wiring (`server.cjs`):** `POST
/api/combat-sports/matches/:id/live/start` (`requireCallingService` —
opening a live broadcast is operational, the same footing as booking
and starting the card itself), `GET
/api/combat-sports/matches/:id/live` (open read), `POST
.../live/move` and `.../live/forfeit` (`requireActor('wrestlerId')` —
proven against a real Shield session, the one real thing a specific
player does themselves). Deliberately **not** the raw WebSocket:
`onMessage`'s existing `move`/`chat` handlers trust a caller-claimed
id for cosmetic world state, and that is the wrong trust model for who
actually wins a match. A resolved round (and a finished match) is
broadcast over the one real shared WebSocket channel
(`messageSocket.cjs`) as `wrestling-round` / `wrestling-match-over`
frames, so both wrestlers (and any spectator) see it the instant it
happens, not on their next poll.

**Frontend:** `CombatSportsView.jsx` gained a Live Wrestling panel —
watch a live match by its id, and if you're one of its two wrestlers,
pick your move each round from the real six. `WorldView.jsx`'s one
shared WebSocket connection now also recognizes `wrestling-*` frames
and passes the latest one down as a prop, rather than this panel
opening a second connection of its own.

### Verification

`test/liveWrestling.test.js` — 26 tests covering the triangle, the
reversal interactions, finisher eligibility and exposure, the
double-finisher tie-break, stoppage, forfeit, and determinism (no
hidden randomness: the same two moves against the same state always
resolve the same way). Five of those assertions were specifically
re-verified by deliberately breaking the behavior they cover and
watching the test fail, per
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md` — including
catching and fixing a real gap in the first version of the
double-finisher tie-break test, which happened to pass against a
hardcoded wrong answer because the "worse off" wrestler and "second
submitter" coincided in that one test.

New guard-proof tests in `test/server.test.js` (service-credential
success end to end, anonymous refusal, Shield-unreachable 502 for the
actor-gated routes) — 854 tests across the suite (summed per file and
cross-checked against the combined run), all passing.

Also run live, twice, against real spawned Shield + VDP servers: once
entirely over curl (book → start → go live → two real Shield sessions
submitting moves → a pin landing → the real combat-sports match
settling into `leaderboards.js` and the real news feed, exactly the
way an operator-declared result already does) and once through the
real React component in two separate real browser pages (one per
wrestler, via Playwright), confirming the real-time WebSocket push
updates both players' screens from a single round-resolving move,
not just the mover's own.

### Left for a follow-up round, deliberately

- Live `royal-rumble`/`tag-team` — a different turn structure, not
  built here.
- No timeout/auto-forfeit if a wrestler simply never submits a move —
  `forfeitMatch` exists for a player to concede, but nothing currently
  calls it on an opponent's behalf after a stall. Real, later work.

---

## Training — filed and **built** 2026-10-31

**"incorporate the training, the statistics, and everything where they
can improve by doing certain actions. They can get bigger, they can
work out. Incorporate working out and lifting weights." (direct
instruction), answered the same day the "no wrestler-specific stats"
gap above was named.**

**Not a second, parallel stat system.** `Athletics` and `Combat` were
already real, existing skills in `skills.js`, already rising from
three real sources (a matching job shift, a textbook, a relevant
conversation) and already decaying on the same real fade-per-tick
`npcs.js`'s habits use. A workout is a fourth real source for either
of them -- `WORKOUT_GAIN` (1.2, flagged/invented like the other three
gain constants) via `gainFromWorkout`, reachable at `POST
/api/gym/workout` (`requireActor('userId')`), restricted to
`GYM_TRAINABLE_SKILLS` (`Athletics`, `Combat`) at that one route --
training is physical, not a shortcut to `Business` or `Crafting`.

**And it actually changes a live match**, which is the real
difference between a stat that is tracked and a stat that matters.
`liveWrestling.js`'s `startLiveMatch` takes an optional, real
`attributesByWrestler` map; `server.cjs`'s `live/start` route reads
each wrestler's own current `Combat`/`Athletics` and seeds it. Combat
training raises `strengthBonus` -- a real, bounded (`MAX_STRENGTH_BONUS`,
0.3 at a maxed-out 100) multiplier on the damage THAT wrestler deals.
Athletics training raises `staminaDiscount` -- a real, bounded
(`MAX_STAMINA_DISCOUNT`, 0.3) discount on the stamina cost THAT
wrestler pays. Deliberately not a bonus to a wrestler's own max
health: training makes you hit harder and gas out slower, not
literally unkillable, and the health pool stays the one number every
wrestler starts level on regardless of training.

Omitting `attributesByWrestler` entirely (every existing caller before
this) seeds every wrestler at 0/0 -- untrained, identical to this
module's own behavior before training existed.

### Verification

`test/skills.test.js` gained 3 tests for the new real source.
`test/liveWrestling.test.js` gained 5 (seeding the real bounded max at
a maxed skill, an untrained opponent staying at zero, a trained
wrestler measurably dealing more damage and spending measurably less
stamina than an identical untrained wrestler throwing the identical
move, and training never leaking onto the opponent's own numbers) --
31 total in that file now, all passing. Two of the module's own new
formulas (`dealDamage`'s strength scaling, `chargeStamina`'s
discount) were mutation-verified per
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`: each was
deliberately disabled and the exact training-impact test that should
catch it was watched failing, then restored. `test/server.test.js`
gained 2 guard-proof tests for the new route -- 863 tests across the
full suite, all passing.

Also run live against a real spawned Shield + VDP: a real player
trained `Combat` to 49.2 across 41 real `POST /api/gym/workout` calls,
went live against an untrained opponent, and the live match's own
response showed the exact real seeded bonus
(`49.2 / 100 * 0.3 = 0.1476`) -- then a real strike landed for
exactly `20 * 1.1476 = 22.952` damage against the untrained wrestler's
real plain `20`, confirmed by reading the match state before and
after the round resolved, not assumed from the formula alone.

### Left for a follow-up round, deliberately

- No wrestler-specific stats beyond `Athletics`/`Combat` (e.g. a
  separate "size" or "conditioning" attribute) -- the two skills this
  session already had covered the real ask ("get bigger... work out
  and lift weights") without inventing a third.
- Training currently only seeds a *live* wrestling match. An
  operator-declared (non-live) `combatSports.js` result still takes a
  bare `winnerIds` array and does not read either skill -- a
  deliberate, unaddressed gap, not a silent inconsistency: the two
  paths were already independent (see this document's own "this
  module never calls `combatSports.recordResult`" note above), and
  giving the declared-result path the same training-awareness is real,
  separate work.

## Real statistics and rating -- filed and built 31 Oct 2026

Per direct instruction: "all tribes, organization, users, NPCs should
all have statistics and rating on their combat, even if it's not in
professional settings. How many fights, how many wins, how many
knockouts, how many opponents, how many their rating... on the come
up, on the rise."

`leaderboards.js` already accumulated wins/losses per discipline and
across the league. Four real additions, all reading facts a match
already produces, none invented beyond flagged, retunable defaults:

- **A winning method breakdown** (`winsByMethod`) -- pin/submission/
  stoppage/forfeit/decision, read straight from `liveWrestling.js`'s
  own `endedBy` for a live match (the two live-settlement call sites
  in `server.cjs` now pass it through) or defaulted to `decision` for
  an operator-declared result with no live engine behind it.
  `knockouts()` reads `stoppage`; `finishes()` is every win that was
  not a plain decision.
- **Real opponents faced** (`opponents`), a distinct count from wins
  plus losses -- "how many opponents" answered directly rather than
  approximated.
- **A real Elo rating** (K=32, starting 1000 -- the real, standard
  chess/FIDE defaults, not tuned ones). Classic Elo is two-player;
  `combatSports.js` allows bigger rosters (tag-team, royal-rumble), so
  the extension here (`teamEloUpdate`) rates each fighter against the
  *average* rating of the opposing side -- exact textbook Elo whenever
  both sides have one fighter, a real, bounded extension otherwise
  (one rating change per fighter regardless of roster size, never nine
  for a one-sided royal rumble).
- **"On the come up"** (`risingLeaders`) -- ranked by real rating
  gained over a real recent window of fights (`ratingLog`, capped at
  20 entries), read directly rather than an invented momentum score.
  `window` (5) and `minFights` (3) are flagged, invented defaults.

This module stays generic over what a "fighter" id names, which is
what lets a tribe, gang, org, or city get the exact same accumulation
a player already gets -- see Conflicts below.

### Verification

`leaderboards.test.js` grew from 7 to 15 tests (method/finish
tracking, opponent counts, an exact textbook-Elo assertion for two
equally-rated fighters, an underdog-upset-moves-more-than-an-even-win
assertion, `ratingLeaders`, and two `risingLeaders` cases). The
`teamEloUpdate` function was mutation-verified (zeroed out the
winners' real rating delta, watched a rating-exactness test go red,
restored it) per `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

## Conflicts: disputes and street/turf fights -- filed and built 31 Oct 2026

Per direct instruction: "tribes, organization, gangs, cities,
cultures, families can choose to fight to settle disputes. And also,
these things can be done just on turf as well... It could be a 2-on-2,
a 1-versus-3, 5-versus-5, 10-versus-10. It could be any uneven
handicap on the streets. No rules, but the same type of things apply.
And people can also predict on street fights as well... bystanders or
users can bet on street fights or confrontations or conflicts going
on in the community as well... they can predict on everything. Will
there be a fight? Will there be an invasion?"

A new module, `src/lib/conflicts.js` -- deliberately **not**
`combatSports.js`. That module owns the sanctioned individual career
ladder, and its own header already records a considered compliance
decision: street-tier bouts there settle no money, because "an
unlicensed underground-fight economy is a different compliance object
than a sanctioned one" (`SETTLING_TIERS` excludes `street`). A dispute
between two tribes, or a no-rules turf fight with no career or
referee at stake, is a different real thing again -- an event between
groups, not a fighter's sanctioned bout -- so it is its own object
rather than reopening that decision. `combatSports.js` is untouched.

**Mechanic: a real gauntlet, not a new combat engine.** Each side is
an ordered queue of fighters. The current front fighter of each side
fights one real duel -- `liveWrestling.js`, the exact same turn-based
engine two individual players already use, reused via a minimal
synthetic "match" object (`server.cjs`'s own `syntheticDuelMatch`)
built from nothing but the four fields that function actually reads.
The loser is eliminated from their side's queue; the winner stays in
and faces the other side's next fighter. A side whose queue empties
has lost the whole conflict -- what makes a 12-versus-8 handicap a
real, run-able thing instead of a special case: the smaller side
simply has fewer fighters left to lose. No format/headcount rule
exists here at all, by design -- "no rules" is the direct instruction,
and the only real constraints are the ones that make a gauntlet
well-formed (each side needs at least one fighter, nobody fights for
both).

**Predictions are open from the moment a conflict exists**, with no
tier gate at all -- the opposite of `combatSports.js`'s conservative
default, and a deliberate one: the direct instruction is explicit that
bystanders should be able to bet on exactly this. `server.cjs`'s
`/api/conflicts/:id/start` opens a real VAGO market the same way a
sanctioned match's `/start` route does. A further route,
`/api/predictions/open`, takes the instruction's own "will there be an
invasion? will anything be predicted on?" literally: `openVagoMarket`
already accepts a free-text question with no required link to a
native object, so this route hands that capability straight through
for a speculative community event that may not even have a conflict
object yet.

**Group-level statistics reuse `leaderboards.js`, not a second stat
system.** `recordConflictResult` credits every individual who fought
for either side (discipline `conflict:<kind>`, so a tribal dispute
never mixes into a sanctioned boxing record) and, when both sides name
a real `groupId` (a tribe/gang/org/city, not an ad hoc street crew),
the two groups themselves a head-to-head result (discipline
`conflict:group`) -- the exact same `applyResult` accumulation a
player already gets, given to a tribe with nothing invented for it.

### War escalation

Per direct instruction (same day): "after so many people are involved
in a street confrontation, and for so long... once people have took
injuries, and so many people are involved, and so much of them, it
could be considered a war between two different factions."

Three real, compounding factors, not one: real injuries (every
resolved duel is a real loser -- `conflict.log.length` already counts
this, nothing new to track), real headcount (both sides' starting
rosters), and real elapsed time since the conflict went live
(`conflict.startedAt`). All three must hold at once
(`assessWarEscalation`); the thresholds themselves
(`WAR_THRESHOLDS` -- 3 injuries, 6 total participants, 10 real
minutes) are flagged, invented defaults, the one place to retune them.

A war is not a different object: `escalateToWar` just sets
`conflict.escalation` on the same two-faction conflict, refusing early
(nothing invents a war that has not crossed the threshold) and late
(a decided conflict has nothing left to escalate), idempotent once
already a war. `recordConflictResult` then credits an escalated
conflict under its own `conflict:war` discipline instead of
`conflict:<kind>` -- a faction's real war record, separate from its
ordinary dispute record.

### Server wiring

`server.cjs`: `store.conflicts` (list + id counter) and
`store.conflictDuels` (the current live duel per conflict, a separate
namespace from `store.liveWrestling` so a synthetic duel id can never
collide with a real combat-sports matchId). Routes: `GET /api/conflicts`
and `/:id`; `POST /api/conflicts` (declare, `requireCallingService`);
`POST /api/conflicts/:id/start` (opens the first duel + the VAGO
market); `POST /api/conflicts/:id/duel/move` and `/duel/forfeit`
(`requireActor('wrestlerId')`, same trust split as sanctioned live
wrestling -- the raw WebSocket is never trusted for who wins a real
duel); on a duel resolving, the next pair's duel starts automatically
if the conflict is still live, or `settleConflictIfFinished` runs
`recordConflictResult` + a real news event if a side's queue is now
empty; `POST /api/conflicts/:id/forfeit-side` (a whole side conceding,
operational); `POST /api/conflicts/:id/escalate`. Two new top-level
leaderboard routes, `GET /api/leaderboards/rating` and `/rising`,
registered outside `/api/combat-sports/leaderboards/:sport` on purpose
so "rating"/"rising" can never be swallowed as a literal sport name by
that param route. `POST /api/predictions/open` is the fully open-ended
market route described above.

### Verification

`test/conflicts.test.js` (new, 23 tests) covers side validation,
uneven handicaps up to a real 12-vs-8, the gauntlet's winner-stays/
loser-eliminated mechanics, forfeits, prediction eligibility (always
open while undecided), `recordConflictResult`'s individual and group
crediting (including the ad-hoc-street-crew no-group case), and the
full war-escalation conjunction (each factor alone is insufficient,
idempotency, refusal once decided). Two real logic bugs were
mutation-verified away per
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`: swapping which
side's queue is eliminated on a win (caught by 5 tests going red), and
loosening the war-threshold conjunction from AND to OR (caught by 2).
`test/leaderboards.test.js` grew to 15 (see above).
`test/server.test.js` gained 9 new tests against the real spawned
server, run end to end through a complete real path with no mocking:
declare a real 2-vs-1 conflict, start it (opens a real duel), forfeit
side B, and confirm `recordConflictResult` actually landed in
`/api/leaderboards/rating` for the winning tribe's own real `groupId`
-- 903 tests across the full VDP suite, all passing.

**Left for a follow-up round, deliberately:** the duel-by-duel
`POST .../duel/move` continuation path (each resolved duel
automatically opening the next one) is exercised directly by
`conflicts.test.js`'s own `recordDuelResult` tests, but not against a
live Shield over real HTTP in this round -- the same honest gap
`live/move`'s own full two-player path has, per that route's existing
comment ("verified manually... recorded in VDP_COMBAT_SPORTS_
DISTRICT.md"). A mixed-discipline conflict (boxer side versus wrestler
side) is not addressed; every duel in a gauntlet still goes through
`liveWrestling.js` regardless of what the conflict's `kind` says.
