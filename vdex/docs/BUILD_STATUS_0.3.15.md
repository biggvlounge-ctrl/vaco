# VDEX 0.3.15 Build Status

## Delivered
- Added a county-equivalent directory pilot for Missouri: 114 counties and the independent City of St. Louis, each identified by its Census GEOID.
- Added nine coverage categories per jurisdiction: assessor, recorder, tax collector, foreclosure/court/sheriff, auction, land bank/redevelopment, planning/zoning/permits, GIS/parcels, and code/vacancy.
- All category states default to `not_assessed`; the implementation does not claim that source portals have been found or connected.
- Added `GET /api/data-catalog/county-equivalents?state=MO` with optional `q`, `category`, and `status` filters.
- Added `GET /api/data-catalog/coverage?state=MO` for category-level coverage counts.
- Added the 2026 Census TIGER/Line County and Equivalent Entities national download to the curated data catalog.
- Health endpoint and package version advanced to 0.3.15.

## Official geography reference
- Census TIGER/Line 2026 County and Equivalent Entities: https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip
- Census geography page: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
- Census states that 2026 legal boundaries and names are as of January 1, 2026. The geography file provides GEOIDs and boundaries; it is not parcel ownership or local assessor data.

## Verification
- `npm run check`
- `npm test`
- `npm run db:dry-run`

## Limitations
- Missouri is the only county-equivalent directory loaded in this increment. Other states and territories remain not loaded.
- The national TIGER file is cataloged as the intended source but was not downloaded or parsed in this environment.
- All Missouri source category statuses remain `not_assessed`; source discovery and licensing review remain open.
- No live source adapters or feeds were connected. Existing local JSON persistence remains the active demo storage; PostgreSQL is not connected.
