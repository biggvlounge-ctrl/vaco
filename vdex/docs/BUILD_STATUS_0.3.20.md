# VDEX 0.3.20 build status

## Implemented
1. Added eight federal/public connector contracts: Census ACS, Census Geocoder, Data.gov Catalog API, EPA ECHO, EPA FRS, FCC Area API, FEMA NFHL and USDA soil data services.
2. Added a normalized observation schema preserving external ID, publisher, source URL, observation/publication timestamps, jurisdiction, FIPS/GEOID and coordinates, raw attribute map, rights status and verification status.
3. Added staged public-data observation API with duplicate suppression and human review. Accepted observations are research-only; no listing/property is automatically published.
4. Added jurisdiction/category source coverage records with HTTPS URL validation, access method, rights status, last checked time and conservative statuses.
5. Added unit and API tests, updated release metadata and Claude Code handoff.

## API
- `GET /api/public-data/connectors`
- `POST /api/public-data/stage`
- `GET /api/public-data/staged`
- `PATCH /api/public-data/staged/:id/review`
- `GET /api/public-data/coverage`
- `POST /api/public-data/coverage`

## Verification and limitations
- `npm run check`, `npm test`, and `npm run db:dry-run` are the required verification commands.
- No external API was queried and no credentials are configured. Connector contracts are not live adapters.
- No nationwide parcel, assessor, deed, tax, zoning, listing or ownership feed is connected.
- Local JSON remains demo persistence; production PostgreSQL, identity provider, tenant RLS runtime tests and deployment are still required.
- Research acceptance is not fact verification, title verification, environmental determination, legal advice, or permission to redistribute source data.
