# Plan — Phase 7: VEX/VADO repointed to VOKEN

## Goal
Make VOKEN the single canonical home for VEX and VADO, per direct
instruction. Both districts stop iframing into VENVS's own,
independently-built `vex.js`/`vado.js` and instead render real clients
of VOKEN's own separate API — the same shape already proven for the
Village District (VXLLAGE) and Dating Village (CVNVO).

## Real investigation before any code
The user's own belief was that VEX/VADO had been "moved" into VOKEN.
Checked directly via `git log --diff-filter=A` rather than assumed
either way: VENVS's own `vex.js`/`vado.js` were added Aug 11 (Phase 9,
a generic trading floor + auction gallery, per `CLAUDE.md` §1/§4's
original 5-tab list). VOKEN's own `vex.js`/`vadoExplore.js` were added
Aug 13 (Phase 4-5, real brokerage trading + auctions of actual Cvltvre
Card editions). Grepped both codebases for cross-references — zero.
These were never one feature "moved"; they were built twice,
independently, two days apart, each unaware of the other.

Also checked the real, honest trade-off before proposing a direction:
VOKEN's own `vex.js`'s `placeTradeOrder()` is gated behind a real
`vex-brokerage` compliance flag (`complianceGate.js`), pending
broker-dealer legal review — VENVS's version had no such gate.
`voken/lib/auctions.js` was checked separately and confirmed to carry
**no** compliance gate at all — only VOKEN's distinct fractional-
ownership feature is gated. So making VOKEN canonical costs real,
temporary function for VEX specifically, but nothing for VADO.

## Design
- `vdp/src/lib/vokenClient.js` — real, thin HTTP client into VOKEN's
  own running server, same posture as `cvnvoClient.js`/`vxllageClient.js`.
- `vdp/src/lib/vexMarket.js` — surfaces the real `vex-brokerage` gate
  status plus browsable vehicle-category Cvltvre Cards (a real,
  flagged interpretive category choice — VEX's own "Robinhood-style
  trading floor" framing fits vehicles most directly among VOKEN's
  real categories).
- `vdp/src/lib/vadoMarket.js` — browses real open auctions. Required
  one real, small addition on VOKEN's own side first: `listOpenAuctions`
  (`GET /api/auctions/open`) — no existing VOKEN route could list what
  was open, only look up one auction by a known id, and VOKEN's
  separate `/api/vado/explore` ranks art cards by engagement generally,
  not live auction state (checked directly, not assumed to be
  equivalent).
- `VexView.jsx`/`VadoView.jsx` — real UI. VEX shows the real gate
  status honestly (Buy disabled while locked, not a silent failure
  after the fact); opening a broker account is never gated. VADO
  supports real bidding across all four of VOKEN's auction types,
  including offer-type (which correctly moves no money, just records
  a real offer for a seller to review later — VDP has no seller-side
  UI for that yet, flagged as a real gap).
- `world.js`: `vex`/`vado` districts' `contentType` changed from
  `venvs-embed` to a new `voken-embed`. `WorldView.jsx`: new render
  branches for both, replacing the old generic iframe handling for
  these two ids (Publisher keeps `venvs-embed`).
- VENVS's own `vex.js`/`vado.js`, their view components, tab entries,
  and seed data are deleted outright — not deprecated in place.

## Explicitly NOT in this task
Any VDP-side seller UI for reviewing/accepting VADO offers
(`acceptOffer` is a real, seller-only VOKEN action). Trading categories
beyond vehicles inside VDP's own VEX district. Real cross-origin SSO
between VDP and VOKEN (same pre-existing limitation as every other
cross-app district).

## Verification approach
A real plain-Node check for `listOpenAuctions` before touching any UI.
`npm run build` confirmed clean on both `venvs` (VEX/VADO genuinely
removed) and `vdp` (new districts wired) after every edit. A full live
Playwright pass against `venvs-mock-backend` + `voken` + `vdp` running
together: real cards/auctions seeded directly on VOKEN's server, then
walked to both districts in VDP, confirmed real data render (not a
VENVS iframe), a real bid placed and independently re-confirmed
server-side, a real broker account opened and independently
re-confirmed server-side, Buy correctly disabled while VEX's real
compliance gate is closed. A separate live pass on VENVS's own side
confirmed exactly 3 tabs remain, VEX/VADO genuinely gone from the tab
bar.

## Done when
- VOKEN is the only place VEX/VADO logic lives; VENVS has none left.
- VDP's VEX/VADO districts are real, live clients of VOKEN, proven end
  to end, including the real compliance-gate distinction between the
  two.
- The "moved vs. built twice" finding and the real gate/no-gate
  trade-off are both documented directly, not silently resolved.
