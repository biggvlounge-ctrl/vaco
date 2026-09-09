# Plan — Phase 3: Hunts (the original core mechanic) and the Explore Page

## Goal
Phases 1-2 built the entire business-revenue layer *around* hunts —
the Franchise List, Digital Twin auto-scaling, tiered participation,
DREA's placement rules, the Neighbor Program — without ever building
the thing those streams describe: an actual hunt with checkpoints a
hunter checks into. `HVNTZ_COMPLETE_REVENUE_STACK.md`'s stream #1
("Hunt participation revenue — the original HVNTZ model: real sponsor
budgets and VCoin bounty participation from being a scavenger hunt
checkpoint") was payable via `recordRevenueEvent` since Phase 1 but had
no hunt/checkpoint/check-in mechanic generating those events for real.
This phase closes that gap, plus the Explore Page — a real, separate,
previously-flagged-as-not-attempted gap ("HVNTZ Explore Page (location
+ attention-based content ranking) — a real, separate, more open-ended
piece not attempted yet," from the Phase 2 README).

## Design
- `lib/hunts.js`: `createHunt`/`getHunt`, `addCheckpoint`/`getCheckpoint`,
  `checkInAtCheckpoint`, `getHuntProgress`, `recommendBreak`.
  `checkInAtCheckpoint` is the actual mechanic: checking in at a
  checkpoint triggers **two distinct real payouts from one sponsor
  budget** — a VCoin bounty straight to the hunter (`transferFn`
  directly) and a real `hunt-participation` revenue event for the
  checkpoint's host business, routed through Phase 1's own
  `recordRevenueEvent()` rather than a second, parallel payout path.
  This is a direct, literal read of the doc's own framing: hunt
  participation is a genuine revenue stream for the host location, not
  just a bounty system for the hunter. Budget exhaustion is enforced
  before either payout fires (`bountyAmount + hostFee > remainingBudget`
  rejects the whole check-in, not a partial one).
- Seeded/worked example: the source doc's own concrete illustration —
  a hunt combining Cahokia Mounds, the Gateway Arch, and the Confluence
  of the Missouri and Mississippi Rivers, woven with participating
  local restaurants — used directly as this phase's verification
  fixture, matching this project's established St. Louis anchor
  (`world-layer`'s UNESCO import used Cahokia Mounds too).
- `HUNT_INTENSITY_LEVELS = ['leisurely', 'moderate', 'action-based']`:
  named in the source doc without an enumerated list — the three
  levels are read directly from the doc's own descriptive language.
- `recommendBreak`: HVNTER's stated proactive break-recommendation
  behavior on action-based hunts, implemented as **real** logic —
  returns `null` outright for non-action-based hunts (no fake
  recommendation), otherwise ranks the hunter's own unvisited
  checkpoints by real Haversine distance from their current position.
  Reuses `neighborProgram.js`'s existing `haversineDistanceKm` rather
  than a second distance calculation.
- `lib/explore.js`: `getExplorePage` — a real, deterministic ranking
  combining a location score (real Haversine distance to a hunt's
  first geolocated checkpoint, or to a neighbor-program business's
  coordinates, decaying linearly to 0 by `LOCATION_SCORE_DECAY_KM`)
  and an attention score (checkpoint count + budget-used fraction for
  hunts; recorded trade count for neighbor matches). **No exact scoring
  formula or location/attention weighting is given anywhere** in any
  source doc — both are real, deterministic, flagged interpretive
  choices, combined 50/50. Surfaces both content types (`hunt` and
  `neighbor-match`) in one ranked feed, matching the doc's framing of
  Explore as a single unified feed, not two separate lists.
- `createHvntzStore()` extended with `hunts: []` / `nextHuntId: 1`.
- `server.js`: 6 new endpoints (`POST /api/hunt`, `GET /api/hunt/:huntId`,
  `POST /api/hunt/:huntId/checkpoint`, `POST /api/hunt/:huntId/checkin`,
  `GET /api/hunt/:huntId/progress/:userId`,
  `GET /api/hunt/:huntId/break-recommendation/:userId`,
  `GET /api/explore`).

## Explicitly NOT in this task
- No drone routing between checkpoints, no physical hunt hardware.
- No actual DREA/HVNTER AI agents — `recommendBreak` is deterministic
  distance-ranking logic, not an AI agent making a judgment call.
- No hunt discovery/search beyond the Explore Page's ranked feed (no
  text search, no category filters).
- No time-limited hunts, expiration, or scheduling — hunts have a
  budget, not a clock, since no source doc specifies hunt duration
  mechanics.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 22
checks across both modules, using the real Cahokia Mounds/Gateway
Arch/Confluence worked example with three real host businesses). Then
a live pass: both `hvntz/server.js` and `venvs-mock-backend` running
together, the same worked example run through actual HTTP calls end to
end (business → location → hunt → checkpoints → check-ins →
break-recommendation → progress → Explore Page), with every payout
**independently confirmed against the mock V3 ledger** via a separate
`GET /api/vcoin/balance/:userId` call per user, not just trusted from
HVNTZ's own response.

## Done when
- `createHunt`/`addCheckpoint` correctly validate every required field
  and reject invalid `intensityLevel`/non-positive amounts.
- `checkInAtCheckpoint` performs both real payouts correctly, rejects a
  second check-in by the same user at the same checkpoint, and rejects
  a check-in that would exceed the hunt's remaining budget.
- `getHuntProgress` correctly reports partial and complete state.
- `recommendBreak` returns `null` for non-action-based hunts and a
  correctly-distance-sorted list of unvisited checkpoints otherwise.
- `getExplorePage` validates its inputs, surfaces both hunts and
  neighbor matches, and sorts by combined ranking score correctly.
- Live: the full worked-example flow run through the real HTTP API
  produces a final ledger that matches the plain-Node pass's
  hand-computed expectations exactly, confirmed independently per user
  via the mock ledger.
