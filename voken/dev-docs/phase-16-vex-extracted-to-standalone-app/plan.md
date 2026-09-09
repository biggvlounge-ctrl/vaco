# Plan — Phase 16: VEX extracted to its own standalone app

## Goal
Per direct instruction: VEX (the real Cvltvre Card brokerage) becomes
its own standalone app, a sibling of Vex Business (renamed from CALL)
inside the new Vex Trading shell — no longer a module living inside
VOKEN. VOKEN keeps VADO and fractional ownership; it stops owning
brokerage accounts, trade orders, or the `vex-brokerage` compliance
gate.

## Real investigation before any code
Grepped every real cross-reference into `lib/vex.js` before touching
anything, not assumed: `server.js` (the 4 `/api/vex/*` routes) and,
critically, two genuinely unrelated real features that happened to
import `VOKEN_PLATFORM_ACCOUNT` from `lib/vex.js` purely because that's
where it was first defined — `lib/cardPacks.js` (pack-opening charges,
Phase 14) and `lib/referralGrowth.js` (referral/spin bonus payouts,
Phase 15). Deleting `lib/vex.js` outright without addressing this would
have silently broken both. Fixed by splitting `VOKEN_PLATFORM_ACCOUNT`
into its own `lib/platformAccount.js` first, repointing both real
importers, confirmed via a second grep pass finding zero remaining
`require('./vex')` anywhere in the app.

## Design
Same real "extracted app calls back over HTTP" shape already proven by
V3 and Shield's own extraction from `venvs-mock-backend`, and by VDP's
own `vokenClient.js` pattern:
- New `../vex/` app: owns broker accounts, trade orders, and its own
  `vex-brokerage`-only compliance gate (`lib/complianceGate.js`,
  `lib/store.js`, `lib/brokerage.js` — the same real net-capital model
  and gated-sell/buy mechanic as the original `lib/vex.js`).
- `../vex/lib/vokenClient.js`: a real, thin HTTP client back into
  VOKEN for the one thing that stays VOKEN's own product — Cvltvre
  Card reads/mints/transfers (`GET /api/card/:id`, `POST
  /api/card/:id/edition`, `POST /api/card/:id/transfer`).
- VOKEN's own `lib/vex.js` deleted outright, not deprecated in place.
  `lib/complianceGate.js` drops back to its original single-gate shape
  (`'fractional-ownership'` only) — the `'vex-brokerage'` gate moved
  out whole, VOKEN never needs to know it existed. `lib/store.js` drops
  `brokerAccounts`/`tradeOrders`/their id counters. `server.js` drops
  the `/api/vex/*` routes and the now-dead `orderTypes` field from
  `/api/health`.

## Verification approach
Live, not just unit-level: booted `v3` + `voken` + the new `vex` app
together. Minted a real `vehicles`-category card on VOKEN. Opened a
real VEX broker account. Confirmed a real order correctly rejects
while `vex-brokerage` is closed (unchanged real gating behavior).
Cleared the gate, placed a real buy order, and confirmed — reading
back VOKEN's own `/api/card/:id`, not trusting the order response
alone — that a real second digital edition genuinely landed on the
buyer, minted through the real HTTP round-trip into VOKEN rather than
in-process. Confirmed VOKEN's `/api/vex/*` routes are gone (404).

## Explicitly NOT in this task
VADO stays exactly where it is — only VEX moved. No change to VOKEN's
fractional-ownership gate, auctions, or any other module. Real
cross-origin SSO between VEX and VOKEN wasn't needed (server-to-server
calls only, same as every other cross-app client in this ecosystem).

## Done when
- VOKEN has zero VEX-specific code or routes left.
- The new `vex` app is a real, live, verified brokerage client of
  VOKEN's card API, reproducing the exact same gated buy/sell behavior
  the in-process version had.
- The two real, unrelated features that borrowed `VOKEN_PLATFORM_ACCOUNT`
  from `lib/vex.js` keep working, now importing from their own real
  home (`lib/platformAccount.js`).
