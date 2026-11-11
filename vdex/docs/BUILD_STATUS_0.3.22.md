# VDEX 0.3.22 build status

## Implemented
1. Retained all 0.3.21 Census ACS functionality and Data Intelligence UI.
2. Added a Census Geocoder adapter for address-to-geography lookup with current address benchmark and geography vintage.
3. Added a 1–20 address batch API; each address is queried server-side and results are normalized into the existing observation staging queue.
4. Preserved matched address, approximate coordinates, county/tract/block GEOIDs and TIGER line reference when available. Original user input is not stored; a normalized one-way hash is used for idempotent duplicate suppression.
5. Added geocoder status and shared public-data run-history endpoints; updated the Data Intelligence screen with address submission and execution history.
6. Explicitly labels coordinates as address-range interpolations and geographic matches as non-parcel evidence.
7. Updated README, CHANGELOG and Claude Code handoff.

## API
- `GET /api/public-data/census-geocoder/status`
- `POST /api/public-data/census-geocoder/run` — body: `{ "addresses": ["123 Main Street, Florissant, MO 63031"] }`; 1–20 address strings.
- `GET /api/public-data/runs` — combined execution history; ACS-specific history route remains for compatibility.
- ACS routes from 0.3.21 remain available.

## Verification
- `npm run check`: passed.
- `npm test`: 77 passed, 0 failed.
- Provider adapters are fixture-tested; no live Census ACS key is configured and no live Census Geocoder request is claimed by this release.
- `npm run db:dry-run` passed against an isolated empty JSON fixture; the package intentionally excludes demo `data/db.json`.

## Remaining limitations
- Geocoder coordinates may be interpolated along an address range. They are not rooftop or survey-grade coordinates and do not prove parcel situs.
- Census ACS context is county-level, not parcel-level. Neither adapter provides active property listings, owners, title, assessed values, zoning or development feasibility.
- No nationwide parcel/assessor/deed/tax/foreclosure/listing feed is connected.
- No production PostgreSQL runtime, identity provider or deployment is connected.
- Rights review and human review remain mandatory before downstream use.
