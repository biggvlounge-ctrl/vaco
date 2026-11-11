# VDEX 0.3.16 Build Status

## Delivered
- Dependency-free TIGER county-equivalent import parser for CSV, JSON array/items and GeoJSON FeatureCollection exports.
- Strict validation for state/county FIPS, five-character GEOID consistency, names, state abbreviations and duplicate GEOIDs.
- Atomic import output with source label, vintage, import timestamp and record count.
- `npm run geography:import -- <file> [--vintage=2026]` command.
- County directory switches to imported national geography when the import file exists; otherwise Missouri's 114 counties and independent City of St. Louis remain available.
- API inventory status reflects whether national geography has been imported.

## Important distinction
This is a geography importer, not a property-data connector. County-level assessor, recorder, tax, foreclosure, auction, land-bank, planning/zoning, parcel GIS and code/vacancy coverage remains independently `not_assessed` until verified. No local source feeds are connected.

## Source and format
- Official Census 2026 TIGER/Line page: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
- Official 2026 county-equivalent ZIP: https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip
- 2026 TIGERweb County layer metadata: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/2
- The utility currently accepts extracted/converted CSV, JSON or GeoJSON, not raw ZIP/DBF archives. Confirm the actual input vintage before importing.

## Verification
- `npm run check`
- `npm test`
- `npm run db:dry-run`
- Import parser tests cover quoted CSV, independent city classification, JSON/GeoJSON, malformed and duplicate GEOIDs, and atomic output.

## Not delivered / blockers
- No national source dataset was downloaded or imported in this increment.
- No nationwide assessor/recorder/tax/auction/foreclosure/land-bank/GIS source portal directory was verified.
- No production database, identity provider or live source adapters are connected.
