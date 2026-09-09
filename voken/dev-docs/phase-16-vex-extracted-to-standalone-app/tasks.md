# Tasks — Phase 16: VEX extracted to standalone app

- [x] Grepped every real reference into `lib/vex.js` before deleting
      anything — found `server.js`'s 4 routes plus two unrelated real
      importers of `VOKEN_PLATFORM_ACCOUNT` (`cardPacks.js`,
      `referralGrowth.js`).
- [x] New `lib/platformAccount.js`; repointed both real importers;
      confirmed zero remaining `require('./vex')` in the app.
- [x] Deleted `lib/vex.js` outright.
- [x] `lib/complianceGate.js`: dropped back to single-gate shape
      (`'fractional-ownership'` only).
- [x] `lib/store.js`: dropped `brokerAccounts`/`tradeOrders` fields.
- [x] `server.js`: dropped the `/api/vex/*` routes and the vex import;
      dropped the now-dead `orderTypes` field from `/api/health`.
- [x] New `../vex/` app: `package.json`, `server.js`,
      `lib/{store,complianceGate,brokerage,vokenClient,persistence}.js`,
      `.gitignore`. Same real net-capital/gated-order mechanic as the
      original, card ops now real HTTP calls into VOKEN.
- [x] Live-verified: `v3` + `voken` + `vex` booted together; real card
      minted; broker account opened; order correctly rejected pre-gate,
      correctly filled post-gate with a real edition landing on VOKEN's
      own card record (read back independently, not trusted from the
      order response); `voken`'s `/api/vex/*` confirmed gone (404).
