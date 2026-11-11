# VDEX 0.3.14 Build Status

## Increment
County/county-equivalent source discovery pilot, focused on St. Louis City and St. Louis County, Missouri.

## Added
- `backend/local-source-inventory.js`: eight researched official local portal references.
- `GET /api/data-catalog/local-sources`: filter by state, jurisdiction, category and free-text query.
- Source records capture publisher, jurisdiction, source category, access method, available formats, stated cadence, expected data fields, evidence URL, discovery status and rights-review status.
- Tests validate the inventory and API behavior.

## Pilot coverage
- St. Louis City: LRA search; LRA inventory/offer/garden-permit CSV and GIS dataset; LCRA holdings CSV; city-owned property search; assessor property search; recorder land records.
- St. Louis County: GIS open-data/parcel lookup; Department of Revenue assessment search.

## Verification
Run `npm run check`, `npm test`, and `npm run db:dry-run`.

## Boundaries
All eight sources are discovery references, marked `discovered` and `review_required`. No feed is connected. The inventory does not imply bulk access, permission to republish, verified ownership, or availability. The 56 state/territory profiles remain a scaffold; national county-by-county portal discovery is not complete. Production storage remains local JSON unless a PostgreSQL deployment is configured.
