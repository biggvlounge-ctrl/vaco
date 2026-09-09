# Tasks — Phase 4: VEX Brokerage Trading (compliance-gated)

- [x] Create `lib/complianceGate.js`: `GATES`, `createComplianceGateState`,
      `isComplianceCleared`, `setComplianceStatus`.
- [x] Create `lib/vex.js`: `NET_CAPITAL_MODELS`, `ORDER_TYPES`,
      `ORDER_STATUSES`, `VOKEN_PLATFORM_ACCOUNT`, `openBrokerAccount`,
      `getBrokerAccount`, `placeTradeOrder`, `getTradeOrder`.
- [x] Extend `createVokenStore()` with `complianceGates`/
      `brokerAccounts`/`nextBrokerAccountId`/`tradeOrders`/
      `nextTradeOrderId`.
- [x] Wire `server.js`: 6 new endpoints (`GET`/`POST /api/compliance-gate/:gateName`,
      `POST /api/vex/account`, `GET /api/vex/account/:id`,
      `POST /api/vex/order`, `GET /api/vex/order/:id`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 10 checks, all passed clean on first run):
      - The `vex-brokerage` gate starts closed by default.
      - `openBrokerAccount` succeeds while the gate is still closed
        (moves no money, correctly ungated).
      - `placeTradeOrder` genuinely rejects with a compliance-specific
        message while the gate is closed.
      - `setComplianceStatus` genuinely opens the gate; rejects a
        non-boolean `cleared` and an invalid `gateName`.
      - `placeTradeOrder(buy)` once cleared: real payment to the
        platform (`$30` on 2×$15), real ownership confirmed (2 new
        digital editions minted to the buyer).
      - `placeTradeOrder(sell)` correctly rejects selling more
        editions than the account genuinely owns; correctly succeeds
        for a real, owned quantity, transferring the editions to the
        platform and paying the seller.
      - Invalid `accountId`/`orderType` both rejected.
      - `getTradeOrder` retrieves a real, filled order.
- [x] Verify live with both `voken/server.js` and `venvs-mock-backend`
      running together: a real order correctly rejected before
      compliance clears, correctly succeeded after, with the resulting
      $30 buy payout **independently confirmed** via
      `GET /api/vcoin/balance` on both the trader and platform
      accounts, and the two real minted editions confirmed via
      `GET /api/card/1`.
- [x] Shut down both servers cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 5: VADO (art gallery/auctions) — `ArtCultureCard`'s physical-
original + limited-digital-edition structure, VADO's own Explore page,
gallery accounts, and fractional ownership under the same real
compliance gate.
