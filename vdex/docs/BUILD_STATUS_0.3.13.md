# VDEX 0.3.13 Build Status

## Delivered
- 41 curated source entries spanning federal public data, local parcel/assessor/recorder records, distress and auction records, land banks, planning/zoning/permits, environmental and hazard layers, soils/terrain, demographics/market, infrastructure, commercial data vendors, MLS/IDX, FSBO and owner-authorized leads.
- 56-jurisdiction scaffold covering all 50 states, DC and five inhabited U.S. territories. Local county/county-equivalent portal coverage remains `not_assessed` until researched.
- Filterable data catalog and controlled batch staging of 1–100 records.
- Import normalization for common parcel/assessor aliases, idempotency by external record ID, duplicate screening by parcel/jurisdiction and address, and missing-data/rights warnings.
- Human review endpoint supports approve, reject, link-existing and tightly controlled address-only keep-separate decisions.
- Approval creates an unverified property lead with provenance and history; linking attaches source provenance to an existing property. Parcel-ID matches cannot be overridden as separate properties.
- Staging and review actions are audit logged. No automated listing publication, ownership/title verification, seller outreach or external feed synchronization.

## Verification
- `npm run check` — passed.
- `npm test` — 48 passed, 0 failed.
- `npm run db:dry-run` — passed; 2 sample properties, 2 jobs, 0 orphan references; source JSON preserved.
- ZIP integrity — passed.

## Not delivered / limitations
- No live nationwide feed or connected third-party provider.
- No complete official national assessor/recorder/land-bank/zoning/foreclosure data API; local records are decentralized and their terms differ.
- Commercial ownership, transactions, leases, tenant, debt, and comps require negotiated provider-specific licenses and permitted-use review.
- County/county-equivalent portal directory and state-by-state adapters are still future work.
- Owner contact PII is deliberately not included in the generic import staging model; a separate access-controlled, lawful-purpose owner-record vault and suppression/consent workflow is needed before outreach.
- Local JSON is still demo storage; no live PostgreSQL runtime or production RLS has been activated.
