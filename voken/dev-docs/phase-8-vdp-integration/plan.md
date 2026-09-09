# Plan — Phase 8: VDP integration (VEX/VADO made canonical)

See `../vdp/dev-docs/phase-7-vex-vado-repointed-to-voken/plan.md` for
the full investigation and design record (this was one combined piece
of work spanning `venvs`, `voken`, and `vdp`). This file covers only
what changed in this project specifically.

## Goal
Become the single, real source VDP's own VEX/VADO districts render,
replacing VENVS's earlier, independent implementation. Requires one
small, real addition to this project's own API before VDP's side can
work at all.

## Real investigation before any code
Every existing VADO route required a known auction id — `createAuction`,
`getAuction`, `getCurrentDutchPrice`, `placeBid`, `endAuction`,
`acceptOffer`. Nothing could answer "what's actually open right now."
This project's own `/api/vado/explore` looks like the answer but isn't
— it ranks `category === 'art'` Cvltvre Cards by engagement generally
(`vadoExplore.js`), unrelated to live `Auction` records. Confirmed
directly by reading the function, not assumed to be equivalent.

## Design
`lib/auctions.js` gains `listOpenAuctions(store)` — a real, minimal
filter over `store.auctions` for `status === 'open'`, the same shape
as every other list function in this codebase. `server.js` gains
`GET /api/auctions/open`. No other real code changed here — VDP's own
`vexMarket.js`/`vadoMarket.js`/`VexView.jsx`/`VadoView.jsx` do the
integration work on that side.

## Verification approach
4 real plain-Node checks (empty initially, appears after creation,
returns the real record, still open after a bid). Live-verified as
part of VDP's own full cross-app Playwright pass — see that project's
own dev-docs for the complete record.

## Done when
VDP's VADO district can browse real, currently-open auctions without
guessing ids or reusing a differently-scoped feature's data.
