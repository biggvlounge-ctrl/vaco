# Tasks — Phase 16: VEX district repointed to standalone VEX app

- [x] New `src/lib/vexClient.js`: `getVexComplianceGateStatus()`,
      `openBrokerAccount(userId)`, `placeVexOrder(...)`, pointed at
      `VITE_VEX_API_URL` (default `localhost:8813`).
- [x] `src/lib/vokenClient.js`: removed `openBrokerAccount`/
      `placeVexOrder` (moved out); kept `getBrandInfo`,
      `listCardsByCategory`, generic `getComplianceGateStatus`
      (VADO still needs it), auctions.
- [x] `src/lib/vexMarket.js`: `getVexMarketState` now calls
      `getVexComplianceGateStatus()` from `vexClient.js` instead of
      VOKEN's (now-deleted) `vex-brokerage` gate; `ensureBrokerAccount`/
      `buyCardEdition` now call `vexClient.js`.
- [x] Grepped for any other caller of the removed
      `vokenClient.openBrokerAccount`/`placeVexOrder` — none found.
- [x] `npm run build`: clean.
- [x] Live end-to-end check via a throwaway plain-Node script
      replicating the real client calls exactly: brand + vehicles
      cards fetched from VOKEN, `vex-brokerage` gate checked on VEX,
      real broker account opened, real buy order filled, edition
      independently re-confirmed on VOKEN's own `/api/card/:id` —
      all real, all passed.
