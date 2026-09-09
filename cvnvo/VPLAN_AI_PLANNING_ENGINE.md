# VPLAN — AI Planning Engine (v1, proposed)

Extends Kevin (V4's date-planning agent) into a full, structured
planning engine — real inputs producing a real, generated plan output,
built as both a standalone app and shared infrastructure powering
multiple apps, following the same dual-role precedent as VSAFE.

Core mechanic: real inputs (people count, budget/price range,
preferences) → real output (a complete AI-generated plan: restaurant,
activity, timing, transportation, lodging where relevant, built to
budget).

Dual role: standalone app in VACO's App Store, AND a shared engine
powering three real apps — CVNVO (full date plan through Kevin's
interface), HVNTZ (full day's hunt/activity plan tied into HVNTER),
VACAY (full trip plan, multi-day).

Why one shared engine: the same core logic (people + budget +
preferences → generated plan) genuinely applies to all three contexts.
Kevin becomes the conversational interface presenting VPLAN's output,
not a separate planning brain.

Input set: budget/price range, people count, location/area, time limit
("3 hours," "full evening," "full day"), activity type selection
(restaurant, movie, activity/entertainment, or combination).

Output set: multiple location options (not just one plan), "average
date cost in that area" (real benchmark for budget comparison), a
complete combined itinerary with real sequencing/timing (dinner 6pm,
movie 8:15pm, accounting for real VOID travel time between stops), an
optimization algorithm scoring combinations against budget/time.

```
PlanRequest {
  id, userId, requestingApp: "cvnvo" | "hvntz" | "vacay" | "standalone"
  peopleCount: number
  budgetRange: { min: number, max: number }
  locationArea: string
  timeLimit: string
  activityTypes: [string]
  preferences: [string]
}

AreaBenchmark { locationArea, averageDateCost: number, sampleSize: string }

GeneratedPlanOption {
  id, planRequestId, optionRank: number
  items: [{ type: "restaurant" | "movie" | "activity" |
    "transportation" | "lodging", name: string, cost: number,
    startTime: string, endTime: string, locationAddress: string }]
  totalCost: number, totalDuration: string, optimizationScore: number
  travelTimeBetweenItems: [number]
}
```

Direct fit: location options draw from HVNTZ's business directory and
flagship Food & Wellness Brands; travel time uses VOID's existing
routing; lodging via VACAY. VPLAN's job is optimization/sequencing
logic, not sourcing new data from scratch.

---

## Implementation status (added when this file was placed into the repo)

**Still genuinely unbuilt, confirming a flag raised earlier.**
CVNVO's own dev-docs previously recorded that VPLAN "does not exist as
code anywhere in this session yet." That remains true: there is no
`vplan/` app, no planning module in any app, and no `PlanRequest`
anywhere. The only trace in the codebase is a comment in
`cvnvo/lib/seedDemoData.js` explaining the deliberate skip.

**Placed in `cvnvo/` rather than a new `vplan/` directory**, on
purpose. VSAFE's dual-role precedent is real — `vsafe/` exists as its
own app — but creating a directory containing only a specification
would make an unbuilt engine look like a shipped one in every directory
listing and every app registry. CVNVO is the primary consumer and
Kevin's home context, so the document lives with the app most likely to
need it first. It should move to `vplan/` on the day the engine
acquires code, not before.

**The dependencies this document assumes are real, which is the good
news.** Every input it needs already exists:

| Needed | Real today |
|---|---|
| Location options | HVNTZ's business directory, with real lat/lng and location lookups |
| Travel time between stops | VOID's routing (real hub-to-hub Dijkstra relay and TSP-D drone routing) |
| Lodging | VACAY Stays, real |
| Conversational presentation | Kevin, real agent in `vacon/lib/agents.js` — and now with a real call surface via V4's twin/call layer |

So the document's closing claim — "VPLAN's job is optimization/
sequencing logic, not sourcing new data from scratch" — is accurate
and is what makes this buildable rather than speculative. It is
genuinely a scheduling problem over data that exists.

**The one input with no real source: `AreaBenchmark`.** "Average date
cost in that area" is presented alongside the others as if it were
similarly available. It is not. Nothing in this ecosystem computes
average spend by area, and there is no obvious external source that
would be accurate for arbitrary neighbourhoods. Two honest options,
both worth naming before someone quietly picks the wrong one:

1. **Derive it** from real completed transactions — CHOPZ, VENVS, and
   VOID all record real spend with real locations. Genuinely accurate,
   but only where VACO already has volume, and it returns nothing at
   all in a new market.
2. **Omit it initially.** The optimizer does not need a benchmark to
   score plans against a budget; the benchmark is a *comparison*
   feature ("this is below average for your area"), not an input to
   the optimization.

Option 2 is the right first cut. Option 1 becomes possible later and
should be flagged as sparse when sample size is low rather than
returning a confident number from four transactions.

**One design note if this gets built.** The optimization is a
constrained sequencing problem — pick items fitting a budget and a time
window, ordered so travel between them fits too. That is close in shape
to work already done in VOID's routing (`multiModalRelay.js` chains
legs with real travel time; the drone router does nearest-neighbour
plus 2-opt over stops). A first version should reuse that posture —
greedy construction, then local improvement — rather than reaching for
anything heavier. It also means `travelTimeBetweenItems` should be
*computed by calling VOID*, not stored as an independent field that
can drift out of sync with VOID's own answer.

**Kyle's dead-time suggestion mechanic is adjacent but separate** —
per an earlier scope decision, that stays scoped to dead time and is
not a dependency here. VPLAN does not need it, and it does not need
VPLAN.
