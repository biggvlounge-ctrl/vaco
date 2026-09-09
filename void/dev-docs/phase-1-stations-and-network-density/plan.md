# Plan — Phase 1: VOID Station Network + Network Density Metric

## Goal
VOID's source docs describe a huge platform — three real AI agents
(V4, Gibson, Kyle), physical hardware (Hub/Port Stations, drones,
vehicles), 18+ service verticals, scheduling systems, load management,
and a whole cross-app integration map. Building this the same way as
`hvntz`: scope out what's genuinely software (real data models, real
deterministic logic, real algorithms) from what isn't (actual AI
agents, physical hardware itself, regulated verticals without real
licensing). This phase builds the foundational piece every later phase
references: the Station network data model and the real Network
Density Metric computed over it.

## Design
- `lib/geo.js`: `haversineDistanceKm` — a fresh copy for this project
  (matching this session's established pattern of each project keeping
  its own copy rather than a forced cross-project dependency; `hvntz`'s
  `neighborProgram.js` did the same relative to `world-layer`).
- `lib/stations.js`: `registerStation`/`getStation`/`getStationsByRegion`.
  `STATION_TYPES = ['port', 'hub-and-port']` — **interpretive**: the
  source doc's data model lists `"hub" | "port" | "hub-and-port"` as
  the type enum, but also states as a hard baseline rule "every Hub
  Station includes at least one Port Station... never zero." Read
  literally, a bare `"hub"` registration would immediately violate that
  rule, so it's rejected outright at registration time rather than
  accepted and left inconsistent. `bayCount` is a plain positive
  integer (the "double units" throughput upgrade, real precedent: A2Z
  Drone Delivery's multi-drone dock network).
- `lib/networkDensity.js`: `computeNetworkDensity(store, regionId)` —
  a real computation over a region's actual registered stations:
  `activeMidpointCount` (a real count), `averageInterMidpointDistance`
  (real Haversine distance, averaged across every station pair),
  `routingOptionsAvailable` (real count of station pairs within a relay
  range). **No canonical relay range is given anywhere** — the doc
  cites real precedents (Zipline P2 ~16km, Wing ~9.66km) without
  picking one for this metric; `DEFAULT_MAX_RELAY_RANGE_KM = 16` (the
  larger, more conservative Zipline figure) is used as a flagged,
  overridable default.
- `server.js`: a real Express API (CommonJS, matching `hvntz`'s
  convention within this ecosystem) — 4 endpoints.

## Explicitly NOT in this task
- No actual station hardware, drone docking mechanics, or physical
  deployment — this is the data model and metric only.
- No AI agents (V4, Gibson, Kyle, or the Business Executive roster
  Qvan/Leslie/Deskins) — none exist as real agents anywhere in this
  session, matching this project's consistent "no fake AI" stance.
- No regulated verticals (Medical Transportation, Cannabis Delivery)
  activated — both remain licensing-gated per the source docs' own
  flags, not attempted here regardless.
- No marketing/budget content — explicitly excluded from this project's
  scope per direct instruction (the marketing strategy doc was sent by
  accident and isn't part of VOID's build).

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after).
Validates `registerStation`'s rejection of a bare `"hub"` type and
every other invalid input, real Haversine-based density computation
against real coordinates (checked by hand), and the region-scoping of
`getStationsByRegion`. Then a live pass: `void/server.js` running
alone (no cross-service payout needed yet in this phase), a real
region built up from 0 to several stations through actual HTTP calls,
with `/api/network-density/:regionId` confirmed to genuinely change
(average distance shrinking, routing options growing) as stations are
added — not a cached or static value.

## Done when
- `registerStation` rejects a bare `"hub"` stationType, non-integer/
  non-positive `bayCount`, non-boolean `supportsRelay`, and missing/
  non-numeric `lat`/`lng`.
- `computeNetworkDensity` returns `null`/`0` correctly for 0 or 1
  stations in a region (not a divide-by-zero crash), and correct real
  averages/counts for 2+.
- `getStationsByRegion` correctly scopes to one region, not leaking
  stations from other regions.
- Live: adding stations to a region through the real HTTP API produces
  a genuinely recomputed (not cached) network density result.
