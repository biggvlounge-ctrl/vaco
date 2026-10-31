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
- No wrestler-specific stats (strength, agility, etc.) — every
  wrestler starts identical; the match is decided by move choice and
  stamina management alone. A real stat system is a genuinely separate
  feature, not something this section invents a placeholder for.
