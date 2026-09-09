# HVNTZ

Revenue Stack — one business onboarding decision, many independent
real revenue streams from the same physical location. Fresh build in
this repo; no prior HVNTZ codebase exists anywhere in this session.

Source docs: `HVNTZ_COMPLETE_REVENUE_STACK.md` (the definitive,
consolidated list — read this first), `HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md`,
`VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md`.

**Scope note**: these docs describe a much larger system than this
project covers — drone delivery routing/dispatch, physical station
hardware, smart benches/tables/mirrors, safety-critical logic. None of
that is software this session can build or meaningfully test. What's
here is the genuinely buildable slice: revenue/payout logic, tiered
location participation, DREA's deterministic placement-rule
enforcement, and ad-tier pricing.

## Run
Two processes — the wallet backend (shared with `venvs`) and this
service. A third, `vavlt-stvdios`, is optional and only needed for the
real hunt-checkpoint photo-proof integration below:
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791
cd hvntz && npm install && npm start                    # localhost:8792
cd ../vavlt-stvdios && npm install && npm start          # localhost:8808 (optional)
```

## Test
```
curl -X POST http://localhost:8792/api/business -H "Content-Type: application/json" \
  -d '{"name":"Cherokee Fitness","ownerId":"gym-owner"}'
curl -X POST http://localhost:8792/api/location -H "Content-Type: application/json" \
  -d '{"businessId":1,"locationType":"screen","address":"123 Cherokee St"}'
curl -X POST http://localhost:8792/api/revenue-event -H "Content-Type: application/json" \
  -d '{"locationId":1,"eventType":"screen-ad","amountEarned":12.5,"payerId":"advertiser-1"}'
curl http://localhost:8792/api/franchise-list/1
```

## What's here
- `lib/revenueStack.js` — the core mechanic: `recordRevenueEvent()`
  performs one real payout (via an injected `transferFn`, wired to
  V3's real `/api/vcoin/transfer` contract in `server.js`) for any of
  the **14 named revenue streams**, proving the doc's own point that
  the payout mechanism is identical regardless of which stream
  triggered it. `getFranchiseList()` rolls up revenue **per location**,
  not one flattened total, per the doc's own stated reasoning.
- `lib/participation.js` — the tiered participation model
  (`own-hunt-location`/`paid-screen-presence`/`paid-hub-presence`/
  `hub-as-store`). No fee-to-share formula exists in any source doc —
  modeled as a real, linear, capped formula, flagged as interpretive.
- `lib/drea.js` — **not DREA itself** (no AI agent exists here) — the
  deterministic rule-enforcement layer underneath it: competitor-
  category and specific-seller exclusion checks, plus the two-source
  flagging workflow (`drea-borderline-detection` /
  `business-owner-initiated`) exactly as specified.
- `lib/adPricing.js` — the 4 named ad tiers (all requiring a QR code),
  with a real, flagged, bounded dynamic-pricing formula (no formula
  is given in any source doc).
- `lib/digitalTwin.js` — Digital Twin auto-scaling (Phase 2):
  `computeDigitalTwinLevel()` computes a real Level 1-3 directly from
  a business's Franchise List and participation tiers — no separate
  purchase decision, per the doc's own instruction. Built as a real,
  self-contained computation rather than a fake connection to `venvs`'s
  Digital Twin Level system, which doesn't exist as working code yet.
- `lib/neighborProgram.js` — Hunts Local Neighbor Program (Phase 2):
  real Haversine great-circle distance matching (verified against real
  St. Louis-area coordinates) within each business's own chosen
  radius, and genuinely mutual trade recording — one call creates both
  sides' records. **Real DREA-driven automatic neighbor-match
  suggestions (Phase 7)**, closing this file's own previously-flagged
  gap: `suggestNeighborTrades` is the real, deterministic ranking
  layer underneath DREA (the same posture `drea.js` already takes
  toward placement rules — the actual AI agent isn't built here, this
  is the real, testable logic underneath it). A business's own
  optional `category` (a real, minimal schema addition) excludes
  same-category candidates, grounded directly in the doc's own real,
  cited "avoid direct competitor conflicts" constraint; already-
  established trade partners are excluded too, since there's nothing
  to suggest about a trade that already exists. Ranks the real
  remaining candidates by the same location + activity scoring formula
  `explore.js`'s own Explore Page already established — moved into
  this file so both real callers share one real scoring function
  instead of two independent copies.
- `lib/cvnvoPlacement.js` — CVNVO date-location placement tiers (Phase
  2): a real, flagged visibility-boost scale (no tier names or values
  are specified anywhere).
- `lib/hunts.js` — Hunts, the original core mechanic (Phase 3): the
  actual hunt/checkpoint/check-in flow the Phase 1-2 revenue layer was
  built around. `checkInAtCheckpoint()` performs **two real payouts
  from one sponsor budget** — a VCoin bounty straight to the hunter,
  and a real `hunt-participation` revenue event for the checkpoint's
  host business via Phase 1's own `recordRevenueEvent()`. Seeded with
  the source doc's own worked example: a hunt spanning Cahokia Mounds,
  the Gateway Arch, and the Confluence of the Missouri/Mississippi
  Rivers. `recommendBreak()` implements HVNTER's stated proactive
  break behavior on action-based hunts as real, deterministic
  Haversine-distance ranking — not a fake AI call. **Real Vavlt
  Stvdios integration**: `checkInAtCheckpoint()` takes an optional
  `photoUrl` plus an injected `postToVavltStvdios` client (real fetch
  POST to Vavlt Stvdios' own `/api/posts`, the same cross-app pattern
  used throughout this session) — a real check-in with a photo creates
  a real story-post on the checkpoint's **business** profile, per
  `VAULT_STUDIOS_IG_LAYER.md`'s own "tagged to the relevant business's
  ...profile," not the individual hunter's. Confirmed directly before
  building: neither side had any photo-proof mechanic before this
  change. **`registerLocation` now takes real lat/lng (Phase 6)**,
  closing the other, longer-standing half of this same integration:
  every location requires real, bounded coordinates (matching Vavlt
  Stvdios' own real range check exactly), and a real, separate
  `syncLocationToMapSearch` call — given a real `mapSearchCategory` and
  an injected `syncToMapSearch` client — mirrors it live into Vavlt
  Stvdios' own Map Search via a real `POST /api/map-listings` call,
  the same injected-cross-app-client shape as `postToVavltStvdios`
  above. Kept as a real, separate step (not folded into
  `registerLocation` itself) so plain-Node tests stay free of any live
  network dependency, and so registering a location never forces a
  Map Search category decision up front. `GET /api/business/:id` and
  `GET /api/location/:id` were also added — real lookup routes that
  simply didn't exist before (only creation was ever exposed) —
  closing CVNVO's own separately-flagged BarBuddy validation gap too
  (see `../cvnvo/README.md`'s own matching entry).
- `lib/explore.js` — HVNTZ Explore Page (Phase 3): a real, deterministic
  ranking combining location score (real Haversine distance) and
  attention score (checkpoint count/budget use for hunts, trade count
  for neighbor matches) into one unified feed, closing a gap explicitly
  flagged as not-yet-attempted after Phase 2.
- `lib/adReview.js` — Ad Content Review Workflow (Phase 4): a real
  `pending -> approved/rejected` state machine around the Phase 1 ad
  tiers. Running an approved submission triggers the actual
  `screen-ad` revenue event via Phase 1's `recordRevenueEvent()`,
  closing the loop between ad pricing/review and real payout rather
  than leaving review as a disconnected moderation queue.
- `lib/screenAnalytics.js` — Screen Analytics (Phase 4): a real,
  deterministic rollup (no invented formula) of a business's revenue
  and ad-submission activity, scoped to its `screen`-type locations —
  total revenue, revenue by event type, distinct advertiser count, and
  ad submissions by status.
- `server.js` — a real Express API (CommonJS) wrapping all eleven
  modules.

## Verified
102 plain-Node checks across all eleven modules (including a 20-check
cross-phase regression exercising all nine `hvntz` modules together
against one shared store — Phase 4), plus live passes with
`hvntz/server.js` and `venvs-mock-backend` running together: a real
business → location → revenue event → Franchise List flow through
actual HTTP calls, with the payout **independently confirmed against
the mock V3 ledger** (not just trusted from HVNTZ's own response); a
business grown from Digital Twin Level 1 to Level 3 live through
actual location registrations; a real neighbor-program trade between
two businesses at real coordinates, reciprocated correctly on both
sides; the full Cahokia Mounds/Gateway Arch/Confluence hunt worked
example run end to end through the real HTTP API — hunt creation,
3 checkpoints, check-ins triggering real dual payouts, break
recommendations sorted by real distance, progress tracking, and the
Explore Page surfacing the hunt — with every payout independently
confirmed per user against the mock ledger and matching the plain-Node
pass's hand-computed expectations exactly; a real ad submission run
through submit → reject-early (before review) → approve → run, with
the resulting payout independently confirmed against the mock ledger
and live screen analytics matching the actual data.

Live cross-app pass with `vavlt-stvdios`: a real check-in through
HVNTZ's own `/api/hunt/:huntId/checkin` route, with a real `photoUrl`
and both servers actually running, made a real HTTP call into Vavlt
Stvdios' own `/api/posts` — the resulting post independently confirmed
via three separate Vavlt Stvdios read endpoints. **A real bug was
found and fixed live during this test**: the post was created but
`GET /api/authors/:id/posts` on the Vavlt Stvdios side came back
empty, because HVNTZ's `businessId` is a real JavaScript number while
Express route params are always strings, so the equality check
silently failed — fixed on the Vavlt Stvdios side (normalizing
`authorId` to a string at write time) and re-verified via a full
restart-and-rerun of this same cross-app test. See `dev-docs/` for the
full record.

**Phase 6 (real lat/lng + Map Search sync + business/location
lookups)**: 8 plain-Node checks (rejects missing/out-of-bounds lat/lng,
real coordinates stored, sync stores the real returned listing id,
repeat lookups reflect it, rejects a missing category), plus a live
pass with `venvs-mock-backend`, `hvntz`, and `vavlt-stvdios` all
running together: a real business registered, a real business lookup
confirmed via the new `GET /api/business/:id`, a real location
registered with real St. Louis-area coordinates, synced live to Vavlt
Stvdios' own Map Search, and **independently confirmed searchable**
via a direct `GET /api/map-search` call on Vavlt Stvdios' own server
(`distanceKm: 0` at the exact registered coordinates). See
`../cvnvo/README.md`'s own matching entry for the second half of this
same pass (BarBuddy's live venue validation against this same real
business).

**Phase 7 (real DREA-driven automatic neighbor-match suggestions)**: 6
plain-Node checks (suggestions ranked closest-first among real
opted-in candidates, a same-category direct competitor correctly
excluded, an already-established trade partner excluded from fresh
suggestions, a candidate outside the searching business's own radius
excluded, businesses with no declared category never excluded on that
basis, and real trade activity confirmed contributing to a
candidate's combined ranking score), plus an `explore.js` regression
check confirming the moved `computeLocationScore` function still
produces identical results, and a live pass against the real running
server: three real opted-in businesses (two coffee shops, one
bookstore) registered, `GET /api/neighbor-program/1/suggestions`
correctly excluding the closer, same-category coffee shop and
suggesting only the real, non-competing bookstore.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8792) — HVNTZ's own real state now survives a
restart. Live-verified: registered a real business, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-8-real-persistence/`.

## Not yet built
- Drone routing/dispatch algorithms (explicitly priced as separate,
  genuinely novel Tier-A work in the pricing doc — not attempted).
- Any physical hardware: VOID Stations, Smart Benches, Smart Tables,
  Smart Mirrors, Viral Pack, elevator screens, lift-and-learn shelving.
- The actual DREA/HVNTER AI agents — only the deterministic rule-
  checking underneath DREA's stated behavior exists.
- Third-party integrations (Square/Toast/Fivestars rewards APIs, real
  social platform posting, Google Photorealistic 3D Tiles).
- Dedicated business logic for most individual revenue streams beyond
  generic event recording — CVNVO placement, community threads,
  package pickup, rideshare hotspot, full-service delivery handoff are
  all payable via `recordRevenueEvent` but have no stream-specific
  mechanics of their own yet.
- Digital Twin level is computed (Phase 2), but not yet wired to
  `venvs`'s CHOPZ system — that Digital Twin Level system doesn't
  exist there as working code yet.
- No drone routing between hunt checkpoints, no hunt time limits or
  scheduling — hunts (Phase 3) are budget-bounded, not clock-bounded.
- No hunt discovery beyond the Explore Page's ranked feed — no text
  search or category filters over hunts.
- No analytics time-windowing (daily/weekly breakdowns) — Screen
  Analytics (Phase 4) is an all-time rollup; no source doc specifies a
  reporting period.
- No automated ad content moderation — review is a real, explicit
  human-in-the-loop `approved: boolean` decision, matching this
  project's consistent stance of never faking an AI call for DREA or
  HVNTER either.
- Map Search sync is real but manual (a real, separate
  `syncLocationToMapSearch` call, not automatic on every
  `registerLocation`) — a deliberate choice, not a gap, since not
  every location is meant to be a real Yelp-style discoverable
  business.

This closes the genuinely software-buildable slice identified across
all four phases. Every remaining gap above is either explicitly out of
scope (physical hardware, drone routing, real third-party
integrations, actual AI agents) or blocked on a system that doesn't
exist elsewhere in this session yet (`venvs`'s CHOPZ Digital Twin
system).
