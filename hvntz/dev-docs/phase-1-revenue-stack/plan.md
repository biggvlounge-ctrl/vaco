# Plan — Phase 1: Revenue Stack, Location Participation, DREA placement rules, Ad pricing

## Goal
Three uploaded docs (`HVNTZ_COMPLETE_REVENUE_STACK.md`,
`HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md`,
`VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md`) describe a much larger
system than this phase covers — drone delivery routing, physical
station hardware, smart benches/tables/mirrors, safety-critical
dispatch. None of that is software this session can build or
meaningfully verify. What's genuinely buildable and testable as real
code: the revenue/payout logic, the tiered participation model, DREA's
deterministic placement-rule enforcement, and ad-tier pricing — the
pieces that are actually data models and business logic, not physical
infrastructure.

## Design
- `lib/revenueStack.js`: `REVENUE_EVENT_TYPES` — the 14 streams named
  in `HVNTZ_COMPLETE_REVENUE_STACK.md`, with the VOID Station doc's
  `station-transaction`/`midpoint-relay-use` folded in as items 4-5
  (that doc explicitly frames them as formalizing what the "complete"
  doc's streams 4-5 already cover). `recordRevenueEvent()` is the
  literal implementation of `HubHostRevenueEvent` — one event, one
  real payout, for any of the 14 stream types, proving the doc's own
  point that the payout mechanism is identical regardless of which
  stream triggered it. Reuses this project's established injected-
  `transferFn` pattern (from `world-layer`/`venvs`) rather than a
  hardcoded wallet call, and the real server wires that to V3's actual
  `/api/vcoin/transfer` contract.
- `getFranchiseList()`: one row per location, not one flattened total
  — a direct, literal read of the source doc's own stated reasoning
  ("rather than one flattened total that hides where the value is
  actually coming from").
- `lib/participation.js`: the three/four participation tiers
  (`own-hunt-location`, `paid-screen-presence`, `paid-hub-presence`,
  `hub-as-store`). **No fee-to-share formula is given anywhere** — the
  doc only says "a larger percentage yields more screen time/priority"
  qualitatively. Modeled as a real, linear, capped formula (share =
  `min(1, feesPaid / REFERENCE_FEE_FOR_FULL_SHARE)`), with
  `hub-as-store` requiring the same full-share threshold explicitly —
  read literally as the top of one continuum ("a high enough
  participation tier" unlocking full treatment), not a separate
  pricing model. Flagged as interpretive throughout.
- `lib/drea.js`: **not DREA itself** (the actual AI matching agent
  isn't built — no such agent exists in this session) — this is the
  deterministic rule-enforcement layer underneath it:
  `setPlacementRule`/`checkPlacementAllowed` implement the doc's
  competitor-exclusion requirement literally (`excludedCompetitorCategories`,
  `excludedSpecificSellers`), and `flagPlacement`/`resolveFlag` implement
  the two-source flagging workflow (`drea-borderline-detection` vs.
  `business-owner-initiated`) exactly as specified.
- `lib/adPricing.js`: the 4 named ad tiers, each requiring a QR code
  (universal per the doc). **No base price or dynamic-pricing formula
  is given anywhere** — both `BASE_PRICES` and the traffic/revenue
  multiplier formula are invented, flagged, and bounded (capped
  influence per factor) rather than unbounded.
- `server.js`: a real Express API wrapping all four modules,
  CommonJS (matching `world-layer`'s convention, not
  `vaco-analytics`/`venvs`'s ESM — picked to keep this new project's
  `require()`-based `lib/` files and `server.js` consistent with each
  other rather than forcing an ESM/CJS interop point for no reason).

## Explicitly NOT in this task
- No drone routing/dispatch algorithms (Tier A in the pricing doc —
  genuinely novel, safety-critical logic, explicitly priced separately
  from the Tier B integration work this phase covers).
- No physical hardware modeling: VOID Stations, Smart Benches, Smart
  Tables, Smart Mirrors, Viral Pack displays, elevator screens, lift-
  and-learn shelving — all real physical infrastructure, not software
  this session can build or test.
- No actual DREA/HVNTER AI agents — both are named, described as
  responsible for contextual matching and proactive suggestions, but
  neither exists as a real agent anywhere in this session; only the
  deterministic rule-checking underneath DREA's stated behavior is
  built.
- No third-party integrations (Square/Toast/Fivestars rewards APIs,
  real Instagram/TikTok social posting, Google Photorealistic 3D
  Tiles) — all named as real external services this session has no
  access to.
- No CVNVO placement, community threads, package pickup, rideshare
  hotspot, or full-service delivery handoff data models built as
  working logic yet — they're named in `REVENUE_EVENT_TYPES` (so a
  revenue event of that type can be recorded and paid out through the
  same real mechanism), but no dedicated business logic beyond that
  generic event-recording exists for any of them individually.

## Verification approach
Plain-Node pass first (39 checks across all four modules — a single
CommonJS script, `.cjs`, since mixing `require()` and top-level
`await` in a `.mjs` file throws immediately; wrapped in an async
`main()` instead). Then a live pass: both `hvntz/server.js` and
`venvs-mock-backend` running together for real, a full business →
location → revenue event → Franchise List flow exercised through
actual HTTP calls, with the payout **independently confirmed against
the mock V3 ledger** — not just trusted from HVNTZ's own response —
proving the cross-service payout genuinely works, not just the
in-process logic.

## Done when
- All four modules validate their inputs correctly and reject every
  invalid case tested (bad event types, bad location types,
  insufficient payer balance, invalid participation tiers, threshold
  violations, invalid flag sources/statuses, invalid ad tiers).
- `recordRevenueEvent` correctly attributes payouts to the right
  business regardless of which of the 14 stream types is used.
- `getFranchiseList` correctly rolls up per-location revenue and lists
  the real event types seen at each location, not a flattened total.
- Location participation share scales correctly and linearly with
  fees paid, capped at 100%, with `hub-as-store` correctly gated
  behind the same full-share threshold.
- DREA's exclusion check correctly blocks by category and by specific
  seller ID independently, and correctly defaults to allowed when no
  rule exists for a venue.
- The flagging workflow enforces the correct state machine (pending →
  resolved once, not twice).
- Ad pricing correctly scales with both tier and location performance,
  with every tier requiring a QR code.
- Live: a real revenue event recorded via the HTTP API results in a
  real, independently-verifiable balance change on the actual V3 mock
  ledger, and the Franchise List reflects it correctly.
