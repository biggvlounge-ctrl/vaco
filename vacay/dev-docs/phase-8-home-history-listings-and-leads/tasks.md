# Tasks — Phase 1: Listings and Leads

- [x] `lib/listings.js` — purposes/statuses, `createPropertyListing`,
      `getPropertyListing`, `listActiveListings`,
      `listListingsForAgent`, `markPending`/`markClosed`.
- [x] `lib/leads.js` — `requestTour` (genuinely free), `getLead`,
      `getLeadForAgent` (gated), `listLeadsForListing` (per-agent
      redaction), `purchaseLead` (real agent-pays charge).
- [x] `lib/store.js`, `server.js`, `package.json`, `.gitignore`.
- [x] `npm install`.
- [x] Verify in plain Node (19 checks): listing validation/lifecycle,
      free tour-request proven via zero transfer calls, contact-info
      gating proven both directions, purchase charge direction proven,
      double-purchase rejection, listing-scoped redaction.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: a listing created, a tour request confirmed to move zero
      money, contact info confirmed null pre-purchase, a real purchase
      confirmed via the agent's live balance, contact info confirmed
      revealed post-purchase.
- [x] Shut down test server; confirmed via port check.
- [x] Write `README.md`, this plan/tasks pair.

## Next
Real map-based search/filtering. Zestimate-style valuation.
Mortgage/financing tools. A real lead-purchase auction instead of a
flat fee.
