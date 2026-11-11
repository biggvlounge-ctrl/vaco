# VDEX 0.3.12 Build Status

## Delivered
- Nationwide data discovery catalog with 40+ curated sources and categories spanning parcels/assessment, deeds/liens, distress/foreclosure, auctions, land banks, zoning/permits, environmental risk, hazards, terrain/soils, demographics, housing, markets, infrastructure, public finance, commercial vendors, MLS/IDX, FSBO and owner-authorized leads.
- `GET /api/data-catalog/jurisdictions` lists all 56 jurisdictions with source categories and explicit `not_assessed` coverage status.
- `GET /api/data-catalog` filters by category, access type and text.
- `POST /api/acquisition-imports/stage` accepts batches of 1–100 records from a catalog source, normalizes common field aliases, checks external record IDs, matches parcel IDs by jurisdiction and normalized addresses, and places records into review states.
- `GET /api/acquisition-imports/staged` returns the organization-scoped queue.
- Normalized records exclude owner names, emails and phone numbers; only raw field names are retained for mapping diagnostics.
- Migration 004 creates tenant-scoped staging storage with RLS. JSON import supports staged records; unknown tenant IDs are not fabricated and remain unassigned.

## Verification
- `npm run check` — passed.
- `npm test` — 47 passed, 0 failed.
- `npm run db:dry-run` — passed; 2 sample properties, 2 jobs, 0 orphan references; source JSON preserved.

## Not delivered / limitations
- No nationwide live data feed or source provider integration.
- No universal national official parcel/assessor/recorder/zoning/foreclosure/land-bank database exists; these records are fragmented across local jurisdictions.
- Catalog entries are leads for integration research; each source requires coverage, rights, retention, attribution, and refresh validation.
- Commercial property, ownership, lease, sale comp, mortgage/debt and MLS datasets require provider-specific licensing and permitted-use review.
- Import staging is not approval or property creation. No title, ownership, seller authority, availability, zoning/buildability or environmental condition is verified.
- Local JSON is still demo storage; PostgreSQL migration has not been run against a live database.
