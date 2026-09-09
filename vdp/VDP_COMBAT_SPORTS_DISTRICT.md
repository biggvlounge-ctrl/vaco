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
