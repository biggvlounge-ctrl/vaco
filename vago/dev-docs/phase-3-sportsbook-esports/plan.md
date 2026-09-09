# Plan — Phase 3: Sportsbook + Esports Staking

## Goal
Build the two remaining wagering surfaces the architecture doc
explicitly models as structurally different from prediction markets:
`SportsBet` (house-set odds) and `EsportsBet` (1v1Me-style skill-based
staking, deliberately NOT house odds). Both VCoin-only.

## Design
- `lib/sportsbook.js`: real, standard American odds math (negative =
  favorite, positive = underdog) — not invented, the same formula
  every real US sportsbook uses. Odds are locked in at the moment a
  bet is placed (the real, standard rule — a bet's payout never
  changes even if the posted line moves afterward), a deliberate
  contrast with `predictionMarkets.js`'s live-price contracts.
  Settlement pays directly from the house account rather than a
  pari-mutuel pool, since real bookmakers manage risk via
  balanced odds/vig and capitalization, not a segregated per-bet
  reserve — a genuinely different real mechanic from predictions/
  esports staking, not an oversight.
- `lib/esportsStaking.js`: the doc's own `EsportsBet` shape has no
  price/odds field at all, matching 1v1Me's real "priced by the market
  rather than house odds" framing — implemented as pari-mutuel pooled
  settlement, mirroring `predictionMarkets.js`'s own, separately
  solved solvent-by-construction pattern. Flash Stakes get real,
  structural enforcement: `isFlashStake` is derived automatically from
  the match's real state at stake time (true once `live`), never
  trusted from the caller's request body — a deliberate hardening
  over a plain, spoofable boolean flag. LANDuel's self-staking
  precedent is naturally supported (nothing prevents
  `backedPlayerId === userId`).

## Explicitly NOT in this task
- No real odds feed/live line movement — odds are set once at event
  creation (a real, simple sportsbook operator flow), not continuously
  updated from a real provider.
- No fantasy contests, no brackets/tournament structures, no live
  video/stream integration — later phases or a different layer
  entirely (VENVS/VDP-side, not this backend).
- No real-money settlement anywhere in either module.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 17
checks, one test-fixture bug fixed: a self-staking player account
wasn't seeded in the throwaway ledger). Sportsbook odds math checked
against real, hand-computed favorite/underdog payouts; esports
staking's Flash Stake flag checked by deliberately sending a false
claim once a match is live and confirming the server overrides it to
true regardless. Both modules' settlement checked for correctness
(sportsbook: exact locked-in payout; esports: solvent pari-mutuel
distribution, reusing the same invariant check pattern proven in
Phase 2). Then a live pass: both servers running together — a
sportsbook bet's real payout independently confirmed against the mock
ledger, and an esports match's real pari-mutuel payout independently
confirmed, including live proof that a spoofed `isFlashStake: false`
claim is genuinely overridden by real match state.

## Done when
- Sportsbook payouts match real, standard American-odds math exactly,
  locked in at bet time regardless of later changes.
- Esports staking settlement is solvent by construction, matching
  Phase 2's own proven pattern.
- Flash Stake status is real and structural, never caller-trusted —
  proven with an adversarial test, not just a happy path.
- Live: both a sportsbook payout and an esports pari-mutuel payout
  independently confirmed against the mock V3 ledger.
