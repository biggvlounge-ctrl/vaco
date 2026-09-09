# Phase 14 — real pack charge — tasks

- [x] `lib/cardPacks.js` — import `VOKEN_PLATFORM_ACCOUNT` from
      `lib/vex.js`, make `openPack` async, require `transferFn`, fire
      the real charge after contents are resolved but before minting,
      return `pricePaid`.
- [x] `server.js` — `POST /api/pack-tier/:id/open` becomes async,
      passes `transferFn: transferVCoin`.
- [x] `node --check` on both files.
- [x] 3 real unit tests: correct charge amount/parties + `pricePaid`,
      missing-`transferFn` rejection, unfillable-pack failure never
      calls `transferFn`. All passed; scratch test file removed after.
- [x] Live verification against real running `v3` + `voken`: minted 2
      real cards, created a real $15 pack tier, opened it for a buyer
      starting at a real 1000 VCoin balance, confirmed real balances
      afterward (985 buyer / 1015 `voken-platform`) and the real
      `pricePaid: 15` in the response.
- [x] Live-verified the negative case too: an unfillable-pack request
      failed with the same real error as before, and the buyer's real
      balance stayed at 985 — confirming the ordering guarantee
      against the real running server, not just the mocked unit test.
- [x] Test artifacts cleaned up (`voken/data`, `v3/data`).
- [x] README.md — new "Real pack charge (Phase 14)" section.
- [x] plan.md / tasks.md (this file).

## Next
- No further work identified for this gap — it's closed. The broader
  "no real economic backing behind VOKEN's own PACK_TIER_NAMES" class
  of gap this closed is now fully addressed for all real purchase
  paths (VEX orders, fractional shares, secondary resale, and now pack
  opens all move real VCoin).
