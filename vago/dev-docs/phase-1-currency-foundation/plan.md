# Plan — Phase 1: Gold Coin / VCoin Currency Foundation

## Goal
Build the one piece both source docs treat as non-negotiable before
anything else: a genuinely separate, non-interchangeable Gold Coin
ledger alongside VCoin, plus the real AMOE (Alternate Method of Entry)
free-play path. VAGO_CLAUDE.md: "not a later migration... the
structural requirement that keeps the sweepstakes model legally
distinct from real-money gambling." VAGO_COMPARABLES.md confirms
Stake.us's real, operating dual-currency sweepstakes model as genuine
legal precedent for this exact shape.

## Design
- `lib/goldCoin.js`: a real, standalone ledger (`store.goldCoinBalances`),
  entirely separate from VCoin (which lives in V3/venvs-mock-backend
  and only ever moves through the injected `transferFn`, the same
  pattern VOID and VOKEN already established). The enforcement is
  architectural: no function in this module, or anywhere in this
  project, converts between Gold Coin and VCoin in either direction.
  That absence is the compliance boundary, not a flag to check.
- `lib/amoe.js`: `submitAmoeEntry()` is the real, required free-entry
  path — genuinely credits usable Gold Coin, rate-limited to one grant
  per real cooldown window so it stays legitimate rather than an
  unlimited faucet. No exact grant amount or cooldown is given in any
  source doc; both (`AMOE_GOLD_COIN_GRANT_AMOUNT = 1000`,
  `AMOE_COOLDOWN_HOURS = 24`) are real, deterministic, bounded, flagged
  interpretive choices, matching this session's established pattern —
  a real daily cadence like Chumba/LuckyLand's own free-entry caps.
- `lib/casinoSession.js`: `startCasinoSession()` is the real currency-
  routing proof point. A `gold-coin` session can only ever debit the
  local Gold Coin ledger; a `vcoin` session can only ever call the
  injected `transferFn`. The two branches share no code path — there
  is no single function through which both currencies flow, which is
  what makes "genuinely non-interchangeable" real rather than
  asserted. Game outcomes (live-dealer results, Originals RNG,
  game-show results) are deliberately NOT built this phase — this is
  the currency foundation only, per both docs' framing of the split as
  the structural requirement everything else sits on top of.

## Explicitly NOT in this task
- No real-money gambling code of any kind — per VAGO_CLAUDE.md §7,
  this isn't even a gated-but-built code path (unlike VEX in VOKEN);
  it's not to be built at all without an explicit legal go-ahead.
- No game outcome/RNG logic, no prediction markets, no sportsbook, no
  esports staking — those are later phases building on this
  foundation.
- No Gold Coin purchase flow (real payment processing doesn't exist
  anywhere in this ecosystem's build) — AMOE is the sole real
  acquisition path this phase.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 16
checks): the Gold Coin ledger checked for genuine isolation (including
asserting its own module exports contain no vcoin-referencing
function), AMOE's cooldown checked from both sides (rejects inside the
window, genuinely allows after), and the casino session currency
routing checked with a tracking `transferFn` wrapper proving a
gold-coin session never calls it at all, plus failure-path checks
proving an insufficient-funds error on one currency never corrupts the
other's balance. Then a live pass: both `vago/server.js` and
`venvs-mock-backend` running together — a gold-coin session's local
debit confirmed, a vcoin session's real payout **independently
confirmed against the mock V3 ledger** on both the player and house
accounts, and cross-checks proving each currency's balance is
genuinely untouched by the other currency's session.

## Done when
- Gold Coin and VCoin are stored in genuinely separate structures with
  no conversion path between them anywhere in the codebase.
- AMOE grants real, usable Gold Coin and is genuinely rate-limited.
- A gold-coin casino session never calls `transferFn`; a vcoin session
  never touches the Gold Coin ledger — proven, not asserted.
- Live: a vcoin session's payout independently confirmed against the
  mock ledger, and both currencies' isolation confirmed via live
  cross-checks after each other's operations.
