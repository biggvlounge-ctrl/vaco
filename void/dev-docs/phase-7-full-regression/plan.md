# Plan — Phase 7: Full cross-phase regression

## Goal
Every prior phase was verified individually (and Phase 4's checks
already cross-touched Phases 1–4, Phase 6's cross-touched Phases 1/3).
This phase runs one comprehensive pass exercising **all six phases
together against a single shared store**, in a connected, realistic
scenario rather than isolated calls — matching this session's
established pattern (HVNTZ's own Phase-4 regression, VENVS's Phase 7)
of proving a whole project composes correctly before declaring it
"complete," not just that each piece works alone.

## Design
One script, one `createVoidStore()`, exercised in a single realistic
narrative: a real 3-station network is built (Phase 1); a real
multi-stop drone route and a VRP-D grouping run against those same
stations (Phase 2); a real vehicle profile and trip declaration are
registered for the region's ground fleet (Phase 4); a real marketplace
job is requested, matched, completed with a real payout, and rated
(Phase 3); all four scheduling surfaces are exercised (Phase 5); and
finally Gibson/Kyle's deterministic rules, a real relay path across
the *same* Phase 1 stations, a VOID Direct manifest that creates a
*second*, non-colliding marketplace job, and affiliate stations
referencing the *same* real station IDs are all exercised together
(Phase 6). A final sanity check asserts every top-level store
collection holds exactly the expected count — the real test for
cross-module interference (a bug in one module writing into another's
collection, or an ID collision between the direct marketplace job and
the VOID-Direct-created one, would show up here).

## Verification approach
Plain-Node pass (throwaway `.cjs` script, deleted after — 16 checks;
one test-script bug found and fixed: an initial VRP-D grouping test
case put one of its two candidate orders far enough from the origin
(~33km one-way, ~66.5km round trip) to correctly exceed the 50km
`maxRangeKm` and be marked unassigned rather than forming a second
route — the app was correct, the test's assumption that both orders
would each get their own route was wrong; fixed by moving the second
order to a distance that still forces a payload-driven split without
exceeding range). Then a live smoke pass: `void/server.js` started
fresh with all six phases' modules wired in, confirming a clean
startup and a correct `/api/health` response listing data from every
phase (station types, optimization modes, job statuses, vertical
count, affiliate roles, the Gibson default window) — proof the fully
assembled server has no import/wiring errors introduced by six phases'
worth of accumulated `require()` statements.

## Done when
- All 16 regression checks pass, confirming Phases 1–6 compose
  correctly with no cross-module interference.
- The final store-collection sanity check confirms no ID collisions
  and no cross-contamination between collections.
- `void/server.js` starts cleanly with every phase's modules wired in
  and responds correctly on `/api/health`.
