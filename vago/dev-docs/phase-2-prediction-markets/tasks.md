# Tasks — Phase 2: Prediction Markets (Kalshi-model)

- [x] Create `lib/predictionMarkets.js`: `MARKET_SOURCES`,
      `MARKET_SIDES`, `MIN_PRICE`, `MAX_PRICE`, `TRADING_FEE_RATE`,
      `computeTradingFee`, `getMarketPrice`, `createPredictionMarket`,
      `getPredictionMarket`, `listMarketsBySource`, `buyContract`,
      `sellContract`, `resolveMarket`.
- [x] Extend `createVagoStore()` with `predictionMarkets`/
      `nextMarketId`.
- [x] Wire `server.js`: 7 new endpoints (`POST`/`GET /api/markets[/:id]`,
      `POST /api/markets/:id/buy`, `POST /api/markets/:id/sell`,
      `POST /api/markets/:id/resolve`, `GET /api/predictions/vdp`,
      `GET /api/predictions/vacancy`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 13 checks):
      - A brand-new market starts at a real 50c price; invalid source
        rejected.
      - `computeTradingFee` genuinely peaks at 50c and is symmetric
        around it.
      - `buyContract` charges real cost + fee, both independently
        reflected in the ledger; real price movement proven against a
        two-sided-liquidity baseline (a single-sided market correctly,
        immediately saturates to `MIN_PRICE`/`MAX_PRICE` — real
        behavior, not a bug, and the reason the price-movement check
        needed a NO-side trade first).
      - Repeat buys from the same user/side accumulate real
        volume-weighted quantity; invalid side/non-integer
        quantity/unknown market all rejected.
      - `sellContract` rejects over-selling, real-shifts price down on
        success, removes the contract record entirely once a position
        is fully closed.
      - `resolveMarket` distributes the real pool pari-mutuel-style —
        solvent (total paid out never exceeds the real collected pool)
        and proportional; losers receive nothing; a resolved market
        rejects further buy/sell/resolve; invalid outcome rejected.
      - `listMarketsBySource` correctly scopes real-world/vdp-in-world/
        vacancy-in-game, including the two dedicated feed endpoints.
- [x] Verify live with both `vago/server.js` and `venvs-mock-backend`
      running together: a VDP-sourced market created and correctly
      surfaced on `GET /api/predictions/vdp`; two real trades' costs
      and fees **independently confirmed** via `GET /api/vcoin/balance`
      across both traders and the house account; resolution's real
      payout independently confirmed, with the house's post-resolution
      balance matching exactly its collected fee revenue — live proof
      the pool-based settlement is solvent and the fee never leaks
      into the payout pool.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Bugs fixed during verification
1. **Test bug**: an early price-movement assertion assumed a single-
   sided buy would show gradual upward price movement on the very next
   trade — it actually saturates to `MAX_PRICE` immediately, since the
   pricing ratio is undefined/degenerate with zero liquidity on the
   other side (correct real behavior of a demand-driven pool). Fixed
   by establishing two-sided liquidity (a NO-side trade) before
   testing YES-side price movement.
2. **Test bug**: a proceeds-vs-ledger-delta comparison failed on raw
   floating-point drift, since the throwaway `fakeTransferFn` does
   plain floating-point arithmetic with no rounding. Fixed by rounding
   the comparison to cents, matching how the real app functions round.
3. **Real app bug, caught live, not just in a unit test**: the first
   `resolveMarket` design paid a fixed $1 per winning contract,
   mirroring Kalshi's real matched-pair settlement. Since this
   project's simplified design (no real matching engine) only ever
   collects `price × quantity` per contract — always less than $1 —
   this promise is structurally insolvent once winning quantities are
   large enough. A live test surfaced exactly this: `insufficient
   funds: vago-house has 16.42, needs 180`. Fixed by redesigning
   settlement as pari-mutuel-style pooled distribution (see `plan.md`
   for the full real-mechanic writeup) — solvent by construction,
   verified with an explicit "total paid out never exceeds the real
   collected pool" assertion, not just a happy-path number.

## Next
Phase 3: sportsbook (house-set odds, VCoin-only) and esports staking
(1v1Me-style skill-based staking, including live "Flash Stakes"),
reusing the same real currency and settlement patterns proven in
Phases 1-2.
