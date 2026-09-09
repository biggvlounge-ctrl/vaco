# Plan — Phase 6: real lat/lng + Map Search sync + business/location lookups

## Goal
Close two real, named cross-app gaps that both explicitly cited this
project's own missing pieces: Vavlt Stvdios' own README flagged
`registerLocation` as having no lat/lng field, blocking its Map
Search; CVNVO's own README flagged HVNTZ as having no
`GET /api/business/:id` lookup route, blocking BarBuddy's own venue
validation. Both are real, this project's own side to close.

## Real investigation before any code
Read `revenueStack.js`'s own `registerLocation` directly — confirmed
it only ever took `{businessId, locationType, address}`, a string
address with no coordinates. Read `neighborProgram.js` and found real
lat/lng and a real Haversine implementation already exist there, but
scoped only to businesses that explicitly opt into the Neighbor
Program (`optInToNeighborProgram`) — not on the base `Location` entity
itself, which is what Map Search actually needs (any registered
location, not just neighbor-program participants).

Read Vavlt Stvdios' own `mapSearch.js` directly to get its real,
existing `MapSearchListing` shape and validation bounds exactly
(`{businessId, lat, lng, category}`, lat -90..90, lng -180..180) rather
than inventing a new one. Read `hunts.js`'s own real
`postToVavltStvdios` injected-client pattern (already proven, already
live-verified) to reuse the same shape for a second real cross-app
call, not invent a different one.

## Design
`registerLocation` gains real, required `lat`/`lng` (matching Vavlt
Stvdios' own bounds exactly, so a location registered here can never
fail that project's own real range check). A real, separate
`syncLocationToMapSearch(store, {locationId, mapSearchCategory,
syncToMapSearch})` — deliberately not folded into `registerLocation`
itself, for two real reasons: plain-Node tests stay free of any live
network dependency, and not every location is meant to be a real
Yelp-style discoverable business, so forcing a category decision at
registration time would be wrong. `server.js` gains a real
`postMapListing` client (same shape as `postToVavltStvdios`), a new
`POST /api/location/:id/sync-map-search` route, and real
`GET /api/business/:id` / `GET /api/location/:id` lookup routes that
simply never existed (only creation was ever exposed).

## Explicitly NOT in this task
Automatic syncing on every `registerLocation` call. Any change to
Vavlt Stvdios' own code — its Map Search API already existed and
needed nothing new, confirmed by reading `mapSearch.js`/`server.js`
directly before assuming otherwise.

## Verification approach
8 plain-Node checks on `registerLocation`/`syncLocationToMapSearch`
directly. A live pass with `venvs-mock-backend`, `hvntz`, and
`vavlt-stvdios` all running: a real business and location registered,
synced live, and **independently confirmed searchable** via a direct
`GET /api/map-search` call on Vavlt Stvdios' own server (not just
trusted from HVNTZ's own response) — `distanceKm: 0` at the exact
registered coordinates. A second live pass (see CVNVO's own
`dev-docs/phase-10-barbuddy-hvntz-validation/`) reused this same real
business to prove the `GET /api/business/:id` route also closes
CVNVO's own gap.

## Done when
A location registered here carries real, valid coordinates, can be
synced live into Vavlt Stvdios' own Map Search, and both business and
location can be looked up by id over real HTTP — closing both
cross-app gaps this project's own README had flagged.
