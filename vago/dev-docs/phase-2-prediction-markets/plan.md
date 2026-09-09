# Plan — Phase 2: Prediction Markets (Kalshi-model)

## Goal
Build VAGO's flagship surface: real, peer-to-peer, market-priced
prediction contracts, including the `vdp-in-world`/`vacancy-in-game`
sourced markets the architecture doc calls "the genuinely unique
differentiator." Settled entirely in VCoin through the same real
`transferFn` pattern proven in Phase 1.

## Design
- `lib/predictionMarkets.js`: real, deterministic, demand-driven
  pricing (`yesPool`/`noPool` track real dollars staked per side; a
  brand-new market bootstraps at a real 50c price; `MIN_PRICE`/
  `MAX_PRICE` are Kalshi's own cited $0.01-$0.99 bounds). `buyContract`
  charges real cost plus a real, probability-weighted trading fee
  (peaks at a 50c price, shrinks toward certainty — the literal shape
  VAGO_COMPARABLES.md describes for Kalshi's real fee model, not a
  claim of its exact published multiplier). `sellContract` lets a
  holder exit early at the live price, real-shifting the price back
  down. Real code reuse: `VAGO_HOUSE_ACCOUNT` is imported from
  `casinoSession.js` rather than redefined.
- **A genuine mid-build correction, not a plan followed blindly**: the
  first draft of `resolveMarket` paid a fixed $1/contract to every
  winning holder, mirroring how Kalshi's real matched-pair contracts
  settle. A live test surfaced that this is NOT solvent in this
  project's simplified (no real matching engine) design — the house
  only ever collects `price × quantity` per contract (always less than
  $1), so a fixed $1 payout promise can exceed what was actually
  collected once quantities are large. Fixed by redesigning settlement
  as **pari-mutuel-style pooled distribution** — the same real
  mechanic real horse-racing totalizator pools use: the entire real
  remaining pool is split proportionally among winning-side holders by
  their share of the winning side's total quantity. This is solvent by
  construction. The trading fee is charged at buy time and never
  enters the pool, so "no fee on winning trades" still holds exactly.

## Explicitly NOT in this task
- No real continuous double-auction matching engine — the house
  account (well, the pool it holds) is the real counterparty, matching
  this project's own VEX precedent (buy/sell settle directly against a
  platform account, not a full order book).
- No real-money settlement of any kind, and no financial-market
  ("will stock X close up tomorrow") prediction category — both
  explicitly out of scope per the source docs.
- No actual AI-generated market suggestions — VAGO_COMPARABLES.md
  describes an AI suggesting in-world predictions, but per this
  session's "no fake AI" stance, only the real, deterministic market
  mechanics beneath that idea are built; any real Shell/Kenji-style
  process can call `createPredictionMarket` normally with
  `source: 'vdp-in-world'`/`'vacancy-in-game'`.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 13
checks, including two real bugs caught and fixed mid-verification: a
test-side floating-point comparison bug, and the real settlement
insolvency bug described above). Then a live pass: `vago/server.js`
and `venvs-mock-backend` together — two real trades' costs and fees
independently confirmed against the mock ledger, the market correctly
surfaced on the VDP-specific feed endpoint, and resolution's payout
independently confirmed live — with the house's retained balance after
resolution matching exactly its collected fee revenue (not a
coincidence: proof the pool-based settlement is solvent and the fee
never leaks into the payout pool).

## Done when
- Price is real and demand-driven; buying moves it, selling moves it
  back.
- The trading fee genuinely peaks at 50c and shrinks toward certainty.
- Settlement is provably solvent — total paid out never exceeds the
  real pool actually collected — verified both in plain Node and live.
- `vdp-in-world`/`vacancy-in-game` markets are correctly filterable via
  their own feed endpoints.
- Live: trade costs/fees and resolution payout all independently
  confirmed against the mock V3 ledger.
