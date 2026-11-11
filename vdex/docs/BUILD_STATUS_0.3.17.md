# VDEX 0.3.17 build status

## Objective
Define a unified national information graph so listing platforms and data points can connect buyers, sellers, owners, developers, workers, suppliers, capital partners and transaction workflows.

## Implemented
- `backend/connectivity-map.js`: 12 domains, domain-specific record types, participant classes, source families, downstream connections and safeguards.
- `GET /api/connectivity`: summary and explicit connectivity status.
- `GET /api/connectivity/domains`: complete domain catalog.
- `GET /api/connectivity/relationships`: intended workflow relationship map.
- Tests assert domain completeness, relationship integrity and truthful connection status.

## Important distinction
This is the canonical integration blueprint, not a claim that every national listing service, MLS, assessor, auction, title, commercial data vendor, workforce registry or capital provider is connected. Sources still require individual discovery, rights review, adapter development, credentials, refresh monitoring and field-level provenance.

## Next implementation priorities
1. Expand the source registry into a source-by-jurisdiction matrix with source URL, publisher, coverage geography, record types, access method, terms/license, API/bulk format, refresh cadence, field availability, contact/credential state, and last verification.
2. Build canonical IDs and crosswalks for parcels, listings, organizations, people, projects, jobs, vendors and transactions.
3. Implement connector adapters for sources with documented public APIs or approved licensed access; avoid restricted scraping.
4. Add source freshness/quality scoring, conflict resolution, duplicate detection and change events.
5. Build participant graph and consented referrals so every handoff retains permissions and audit history.

## Verification
Run `npm run check`, `npm test`, and `npm run db:dry-run`. External feeds and national local-source coverage remain unconnected/unverified.
