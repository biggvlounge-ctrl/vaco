# VDEX 0.3.21 build status

## Implemented
1. Added a browser Data Intelligence panel to check adapter configuration, run county/state imports and review execution history.
2. Added a real read-only Census ACS 2024 5-year county API adapter with state/county FIPS validation.
3. Added population, housing units, vacant units, owner/renter occupancy, median household income and median gross rent estimates; estimates and margins of error are preserved separately.
4. Added a derived county vacancy-rate percentage with an explicit warning that it is not property-level vacancy evidence.
5. Added API status, execution and run-history endpoints. Credentials are read only from server environment variable `CENSUS_API_KEY`; they are not stored in records or returned.
6. Successful adapter responses are normalized and staged into the existing human-review queue with provenance and duplicate suppression. Failed runs are recorded with safe error metadata.
7. Added PostgreSQL migration 006 for adapter run history with forced tenant RLS and JSON migration support.
8. Updated README, CHANGELOG and Claude Code handoff.

## API
- `GET /api/public-data/census-acs/status`
- `POST /api/public-data/census-acs/run` — body: `{ "stateFips": "29" }` or `{ "stateFips": "29", "countyFips": "189" }`
- `GET /api/public-data/census-acs/runs`

## Verification
- `npm run check`: passed.
- `npm test`: 73 passed, 0 failed.
- Adapter tests use deterministic fixtures; no live Census API key is configured, so external connectivity is not claimed.
- The release archive omits demo `data/db.json`. Migration dry-run must be supplied an existing JSON database path; it is being verified against an isolated empty fixture for this package build, not user production data.

## Remaining limitations
- ACS context is county-level, not parcel-level. It is not a listing, owner, title, assessed value, zoning, environmental or feasibility source.
- No nationwide parcel/assessor/deed/tax/foreclosure/listing feed is connected.
- No production PostgreSQL runtime, identity provider or deployment is connected.
- Rights review and human review remain mandatory before downstream use.
