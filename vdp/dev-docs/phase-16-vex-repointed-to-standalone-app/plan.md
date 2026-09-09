# Plan — Phase 16: VEX district repointed to standalone VEX app

## Goal
VEX's real brokerage backend moved out of VOKEN into its own
standalone app (`../vex/`, sibling of `../vex-business/` inside the
new `../vex-trading/` shell). VDP's own VEX district (`VexView.jsx`,
built Phase 7) needs to keep working end to end against its new real
home, not silently break.

## Design
`src/lib/vokenClient.js` keeps only what's still genuinely VOKEN's:
`getBrandInfo`, `listCardsByCategory`, VADO's auctions, and the
generic `getComplianceGateStatus(gateName)` (still needed for VADO's
own `fractional-ownership` gate). VEX's own `openBrokerAccount`/
`placeVexOrder` moved to a new `src/lib/vexClient.js` pointed at the
standalone VEX app (`VITE_VEX_API_URL`, default `localhost:8813`), and
`vexMarket.js`'s `getVexMarketState` now calls a VEX-scoped
`getVexComplianceGateStatus()` there instead of the old generic call
against VOKEN.

Card browsing (`listCardsByCategory`) and brand info
(`getBrandInfo`) deliberately stayed on `vokenClient.js` — Cvltvre
Cards are still VOKEN's own real product; only the brokerage
mechanics (accounts, orders, the `vex-brokerage` gate) moved with VEX.

## Verification approach
`npm run build` confirmed clean (no broken imports after the split).
Then a real, live end-to-end check: a throwaway plain-Node script
literally replicating `vexClient.js`'s exact URLs/paths (not VDP's own
code directly, since `import.meta.env` only resolves under Vite) —
fetched VOKEN's brand + vehicles-category cards, checked VEX's real
`vex-brokerage` gate, opened a real VEX broker account, placed a real
buy order, then independently re-read VOKEN's own `/api/card/:id` to
confirm the edition genuinely landed on the buyer rather than trusting
the order response alone. All real, all passed.

## Done when
- VDP's VEX district has zero remaining calls into VOKEN's now-deleted
  `/api/vex/*` routes.
- A real, live round-trip through the new client wiring proves the
  same buy-order mechanic VDP's VexView.jsx exercises still works
  against VEX's new standalone home.
