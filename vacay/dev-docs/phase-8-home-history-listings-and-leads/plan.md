# Plan — Phase 1: Listings and Leads

## Goal
Build VACAY's Zillow-comparable division: real estate listings with
real Premier Agent-style lead monetization, one of the real, distinct
divisions VACAY was split into (alongside Stays, Experiences, Auto).

## Design
The single most important design decision: this division does NOT
reuse the escrow-then-settle pattern every other VACAY division uses.
Real Zillow doesn't take a cut of a home sale or lease — its real
revenue is Premier Agent, agents paying for buyer/renter leads. So:
- `lib/listings.js` is a plain property record + lifecycle, no money
  attached to it at all.
- `lib/leads.js` is where real money moves, and only in one direction:
  the agent pays a real flat `LEAD_FEE` to purchase a lead's contact
  info. `requestTour` (the buyer/renter side) never touches
  `transferFn`.
- Real, deliberate data-gating: `contactInfo` is withheld from every
  read until the specific requesting agent has purchased that specific
  lead — the actual product being sold, not just a documented
  intention.

## Explicitly NOT in this task
Any UI. Real map search/filtering. Zestimate-style valuation.
Mortgage/financing tools. A real lead-purchase auction (Zillow's own
real pricing is market-based; a flat fee is a deliberate
simplification here).

## Verification approach
Plain-Node pass (19 checks): listing validation/lifecycle, the free
tour-request path proven via zero transfer calls, contact-info gating
proven in both directions (withheld pre-purchase even for the
listing's own agent; still withheld for a *different* agent after
someone else purchases), the purchase charge proven to hit the agent
not the buyer, double-purchase rejection, per-agent redaction in the
listing-scoped lead query. Then a live pass against the real,
independently running V3 mock ledger: a tour request confirmed to move
zero money via the renter's live balance, a lead purchase confirmed
via the agent's live balance, and the contact-info reveal confirmed
before and after purchase.

## Done when
- The free tour-request path is proven to move zero money, not just
  documented as free.
- The contact-info paywall is proven genuinely gated per-agent, not
  just per-lead.
- The agent-pays-not-buyer charge direction is proven against a real
  ledger.
