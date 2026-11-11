# VDEX 0.3.18 build status

## Implemented
- Curated national source directory covering MLS/RESO access, Spark authorized MLS API, Crexi listing partnership, GSA real-estate sales, USDA resales, HUD Home Store, Fannie Mae HomePath, FDIC disposition resources, GSA Federal Real Property Profile, and Census TIGER geography.
- Search and filters by query, source family, VDEX domain, and connection status.
- Summary endpoint with source counts by family and connection state.
- Access model and evidence notes on every source record; no entries are marked connected.

## Verified semantics
- RESO is a standards organization; listing access must be requested from MLSs or authorized providers.
- Spark API access is authorized and role/license dependent.
- Crexi's documented Listing API is for qualifying partners to push listings to Crexi; not treated as an inbound VDEX API.
- Federal listing portals are public discovery destinations, not automatic feed licenses.

## Not implemented / blockers
- No live provider credentials, contracts, data feeds, or source adapter connections.
- No national county/parcel public-record ingestion completed.
- No nationwide commercial listing or MLS database connected.
- Public portal links do not confer permission to scrape, republish, or retain listing data.

## Verification
- Run `npm run check`, `npm test`, and `npm run db:dry-run` before handoff.
