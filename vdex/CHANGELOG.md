## 0.3.24 (post-release, round 2) — 2026-11-12 — real VOID connections
- Added `backend/void-staffing-adapter.js`: routes VDEX's construction/trade workforce through VOID's own real, payment-settled staffing marketplace (`POST /api/staffing-position`, a real service-to-service call authenticated via `X-Service-Name`/`X-Service-Token`) instead of VDEX building a second, parallel job-payment system. VDEX's own `/api/jobs` board keeps its real consent/withdrawal-token security unchanged; this adapter is additive.
- Added `backend/void-real-estate-media-adapter.js`: requests real property media (photos, video walkthrough, aerial drone, 3D tour, floor plan) through VOID's own HomeJab-style `realEstateMedia.js`. Job creation (`POST /api/real-estate-media-job`) requires the real estate agent's own forwarded VOID Shield session -- confirmed directly in VOID's `server.js` that this route has no service-credential path at all; the separate assignment step (`POST /api/real-estate-media-job/:id/assign`) genuinely is service-to-service.
- Updated `backend/ecosystem-integrations.js`'s VOID registry entry with the two new real capability scopes and the boundary that VDEX never duplicates VOID's marketplace loop or media pipeline.
- Added `VDEX_VOID_SERVICE_TOKEN` to `config/integrations.env.example`, documented as the one real intra-ecosystem shared secret (not an opaque vault reference like the other `*_CREDENTIAL_REF` entries) that must match whatever VOID's own `VACO_SERVICE_TOKENS` allowlist maps `vdex` to.
- **Live-verified end to end against real spawned servers, not mocked**: a real Shield server minted a real session; a real VOID server (seeded with `VACO_SERVICE_TOKENS="vdex:test-secret-123"`) accepted a real staffing-position call authenticated purely by service token (`SUCCESS`, real `jobId` returned from VOID's own marketplace), and accepted a real real-estate-media-job creation call authenticated by the forwarded Shield session (`SUCCESS`, real job record returned). The service-to-service assignment call also reached VOID and authenticated correctly, then was honestly refused by VOID's own real business rule (`assignNearestProvider requires at least one available provider` -- the freshly booted instance had no seeded photographer, not an auth or wiring failure).
- 14 new tests (`tests/void-staffing-adapter.test.js`, `tests/void-real-estate-media-adapter.test.js`); mutation-verified the service-token requirement (removing the check turned exactly one test red, confirmed, reverted). Full suite: 95/95, up from 81.

## 0.3.24 (post-release) — 2026-11-11 — VULCAN/VOKEN reconciliation
- Corrected a mistaken reference: "VULCAN" was never a real, separate service. Merged its tokenization capability into VOKEN's own real ecosystem-integration registry entry (`backend/ecosystem-integrations.js`) -- the real service count is eight, not nine.
- Updated `tests/ecosystem-integrations.test.js` and `tests/api.test.js` to match (count, boundary checks, key lookups); added an explicit assertion that `vulcan` must never exist as a registry key.
- Updated `config/integrations.env.example` and the live docs (`CLAUDE_CODE_START_HERE.md`, `MASTER_SPEC.md`, `INTEGRATION_CONTRACTS.md`, `BUILD_STATUS_0.3.24.md`, `CLAUDE_CODE_HANDOFF.md`); added forward-pointing correction notes to the two historical snapshots (`VDEX_COMPLETENESS_AUDIT_0.3.23.md`, `BUILD_STATUS_0.3.23.md`) rather than rewriting them.
- Added `docs/RECONCILIATION_11_NOV_2026.md`: verified the handoff's own claims against the real code (consent-withdrawal tokens, evidence-linked highlights, jurisdiction/county counts, JWT verification, RLS migrations, fail-closed acquisition authorization all confirmed real). Found one real discrepancy: the national source catalog has 36 entries, not the claimed 41 -- a loose `total>=35` test assertion had not caught it.
- Confirmed the Cold-to-Hot Potential Index's "previously agreed twenty categories" do not exist anywhere in this package; stays blocked rather than inventing a replacement list.
- `npm run check` and `npm test` both verified green (81/81) before and after every change in this round.

## 0.3.15 — county-equivalent directory and coverage tracking
- Added a Missouri pilot inventory of 114 counties plus the independent City of St. Louis, keyed by Census GEOID.
- Added nine source-coverage categories per county-equivalent and API filters/summary endpoints; all statuses start `not_assessed`.
- Added the official 2026 Census TIGER/Line county-equivalent geography download to the data catalog as the intended national inventory backbone.
- Added API regression coverage for the Missouri inventory, county-equivalent lookup, and coverage summary.
- No county source coverage or live integrations are claimed.

# Changelog

## 0.3.0 — 2026-11-08
- Added property source provenance records and source retrieval/addition API.
- Added property creation history events.
- Added conservative availability classification separate from submitted status.
- Added normalized-address duplicate detection (HTTP 409).
- Added numeric field and HTTP(S) source URL validation.
- Added isolated API regression tests and `npm test`.
- Updated frontend property cards to display availability classification and source-record count.

## 0.2.0
- Initial runnable VDEX MVP with property exchange, seller inquiry, buyer mandates, workforce jobs, watchlist, audit log, and responsive frontend.

## 0.3.1 — 2026-11-09
- Added structured, timestamped seller inquiry consent records and explicit consent audit events without changing the existing request contract.
- Added strict non-negative numeric validation for buyer mandate price and acreage criteria.
- Expanded API regression coverage for seller consent and buyer mandate validation.

## 0.3.2 — 2026-11-09
- Integrated property evidence, evidence-backed highlights, assessments, and development-scenario APIs.
- Added backward-compatible JSON collections and audit events for Property Intelligence mutations.
- Added API regression coverage for the new endpoints.


## 0.3.3 — Property DNA, buyer matching, and parcel identity
- Added a read-only Property DNA endpoint with separate parcel, above-grade finished, below-grade finished, and below-grade unfinished measurements.
- Added jurisdiction-scoped parcel identifier duplicate detection while retaining normalized-address duplicate protection.
- Added buyer mandate matching by property type, location, budget, and acreage; unknown price/acreage and unverified seller authority remain visible as warnings.
- Added measurement-unit validation and explicit data-quality/missing-data warnings.
- Extended source provenance records with publication date, jurisdiction, license scope, attribution, and refresh policy fields.
- No external parcel, GIS, title, MLS, or assessor connection is implied; submitted values remain unverified.


## 0.3.4 — seller consent withdrawal
- Seller inquiry consent is now purpose-limited to the specific property inquiry; it does not grant unrelated marketing permission.
- New inquiries receive a cryptographically random, one-time withdrawal token. Only a SHA-256 hash is stored; the token is returned once and must be retained by the submitter.
- Added `POST /api/seller-leads/:id/withdraw-consent`, requiring explicit confirmation and the original token. Successful withdrawal marks consent false, records the timestamp and audit event, and changes the lead state to contact prohibited.
- Invalid tokens, missing confirmation, unknown inquiries, and repeat withdrawals are rejected.
- Existing `POST /api/seller-leads` consent request shape remains compatible; consent notice version advances to `seller-inquiry-v2`.
- This is a local-MVP capability-token workflow, not proof of identity or a production access-control solution. Production must use authenticated identity, verified contact channels, retention/deletion policies, and legally reviewed consent language.

## 0.3.5 — Workforce application lifecycle
- Added job-specific worker applications for photographers, property viewers, researchers, data gatherers, inspectors, trades, and other assignment categories.
- Captures explicit purpose-limited application consent, skills, experience, availability, HTTPS portfolio links, and self-reported credentials clearly marked unverified.
- Prevents duplicate active applications for the same job/contact and keeps applicant records out of the public jobs endpoint.
- Added one-time application withdrawal tokens; withdrawal blocks further contact and erases stored email/phone from the local application record while retaining minimal audit metadata.
- No hiring, credential verification, or payment is automated; employer review and all hiring decisions remain human-controlled.


## 0.3.6 — PostgreSQL/PostGIS migration foundation
- Added an initial PostgreSQL/PostGIS schema for organizations, properties, source provenance, jobs, worker applications, seller leads, buyer mandates, watchlists, property-intelligence records, and audit events.
- Added an explicit JSON-to-PostgreSQL migration utility with a read-only dry-run, source SHA-256 report, referential-integrity preflight, transaction/rollback, and source-file preservation.
- Property coordinates and parcel boundaries have dedicated PostGIS geometry columns; existing records are not assigned invented geometry.
- Imported records remain unassigned to organizations (`tenant_id` NULL) until a reviewed ownership mapping and authenticated tenancy model exist.
- No database connection was available in this environment; schema application and live import have not been claimed or performed.
- Verification: `npm run check`, `npm test` (32/32), and `npm run db:dry-run` pass.

## Version 0.3.7 — organization identity and tenant-security foundation

- Added PostgreSQL migration `002_identity_tenant_security.sql` with external-identity user records, organization memberships, scoped invitations, explicit role constraints, and tenant ownership columns/indexes.
- Enabled and forced PostgreSQL row-level security on tenant-owned tables. Policies fail closed when transaction-local `vdex.tenant_id` (and, for user/membership access, `vdex.user_id`) context is absent. Existing records remain unassigned; no organization ownership is inferred.
- Added a least-privilege authorization policy module for the planned role model: owner, admin, acquisitions, analyst, workforce manager, worker, and viewer.
- Corrected the health endpoint version to match the package version.

This is a database/security foundation, not active API authentication. The current JSON API does not yet enforce these roles or tenant boundaries. Before activation, integrate a trusted identity provider, validate membership server-side, set tenant/user context with `SET LOCAL` inside every database transaction, use a database role without `BYPASSRLS`, and test cross-tenant reads/writes against a real PostgreSQL/PostGIS instance. Do not expose the JSON demo server publicly.

## Version 0.3.8 — signed access tokens and workforce review

- Added HS256 JWT verification with required expiry, 32-byte minimum secret, issuer/audience checks, active-membership validation, strict role claims, and timing-safe signature comparison.
- Added opt-in `VDEX_AUTH_MODE=required` API enforcement. Private routes require a valid bearer token and the role permission mapped to that route; health, public job discovery/application, and token-based consent withdrawals remain public intake routes.
- Added authenticated session introspection at `GET /api/auth/session`.
- Added employer application review listing and status transitions (`Reviewing`, `Shortlisted`, `On hold`, `Not selected`) gated by `workforce:manage`; transitions are audited and cannot represent an offer, hire, or assignment award.
- Added auth verifier and required-mode integration tests. The default local JSON demo mode remains backward compatible and is not safe for public deployment.
- Important: this increment adds API authentication/RBAC, not full tenant row filtering or production identity-provider integration. Do not enable public deployment until tenant isolation is enforced across all repositories, secrets and issuer trust are configured, and rate limiting/CSRF/CORS/operational controls are reviewed.


## Version 0.3.9 — JSON API tenant isolation

- Added fail-closed organization scoping for authenticated JSON-mode property lists/details/DNA/source/intelligence, buyer mandates and matching, watchlists, summary counts, audit reads, and employer job/application review. Unassigned legacy records are hidden from authenticated organizations.
- New properties, jobs, buyer mandates, and watchlist records receive the authenticated organization ID from the verified principal; client-supplied tenant IDs are ignored.
- Public job discovery now returns open jobs only and strips internal tenant identifiers. Public applications inherit the tenant of the open job they apply to. Employer review verifies the job/application belongs to the authenticated organization.
- Added cross-organization regression coverage for property list/detail/DNA and tenant-ID spoofing.
- This is JSON-mode application filtering, not a production database security boundary. Seller public intake routing, all legacy records, trusted identity-provider membership lookup, PostgreSQL runtime transactions/RLS, and operational security controls still require completion.


## 0.3.10 — seller lead operations and consent-aware review
- Added authenticated, organization-scoped seller lead queue and review endpoint.
- Added constrained lead review states, reviewer attribution, timestamps, bounded notes, and audit events.
- Added required-auth seller intake routing through `VDEX_SELLER_INTAKE_ORG_ID`; intake fails closed when routing is not configured.
- Prevented review workflow from reactivating withdrawn consent; review status does not itself authorize outreach.
- Added regression tests for intake routing, cross-tenant isolation, lead review, and withdrawn-consent blocking.


## 0.3.11 — acquisition source registry foundation
- Added organization-scoped acquisition source connector registrations for county assessor/recorder, foreclosure notices, auction operators, MLS/IDX, FSBO, wholesalers, owner-authorized off-market sources, and other providers.
- Added fail-closed connector states: registration begins as `pending_authorization`; administrator attestation advances only to `authorized_not_connected`.
- Authorization requires explicit confirmation, an HTTPS evidence reference, and a stated license scope; revoked registrations cannot be reauthorized.
- Connector metadata rejects API keys, passwords, tokens, and credential fields. No live adapters, provider connections, or feed imports are claimed.
- Fixed stale health-version assertion from 0.3.9 discovered during the 0.3.10 baseline rerun.
- Added source registry validation, secret rejection, authorization state, and cross-tenant API tests.


## 0.3.12 — nationwide data discovery and acquisition staging
- Added a curated 41-source nationwide property-development data directory and a 56-jurisdiction scaffold (50 states, DC and five inhabited territories) for assessor, recorder, tax, foreclosure, auction, land-bank, zoning, parcel GIS, vacancy and permit source discovery.
- Added catalog filtering by category, access model and search terms.
- Added batch import staging with field alias normalization, external-ID idempotency, parcel/address duplicate screening, provenance metadata, warnings, and organization-scoped review queue.
- Excludes owner contact PII from normalized staging records; raw import payloads are not retained by this pipeline.
- Added PostgreSQL migration 004 and JSON migration support for staged acquisition records. Unmapped tenant records remain unassigned and fail closed under RLS.
- No live national or commercial feeds are connected; source discovery and staging do not establish data rights, ownership, title, availability or listing authority.
- Verification: `npm run check`, `npm test` (47/47), `npm run db:dry-run` passed.


## 0.3.13 — acquisition review and controlled property creation
- Added a human-review endpoint for staged acquisition records: approve, reject, link to an existing property, or explicitly clear an address-only possible duplicate as distinct.
- Approved new records become unverified acquisition leads with source provenance and history; no listing publication, seller authority verification or outreach is performed.
- Parcel identifier + jurisdiction duplicates cannot be overridden as separate records; they must be linked or rejected.
- Added audit events and repeat-review protection.
- Preserved source publisher, terms, attribution, refresh cadence, jurisdiction and publication date in provenance metadata when available.
- Verification: `npm run check`, `npm test` (48/48), and `npm run db:dry-run` passed.

## 0.3.16 — national county geography import foundation
- Added a dependency-free Census TIGER county-equivalent import parser for CSV, JSON arrays/items, and GeoJSON FeatureCollections.
- Validates 2-digit state FIPS, 3-digit county FIPS, 5-character GEOID consistency, names, state abbreviations, and duplicate GEOIDs; preserves FIPS as strings.
- Added atomic, provenance-labelled import output and `npm run geography:import -- <file>` command.
- County directory automatically uses imported national records when `backend/data/national-county-equivalents.json` exists; otherwise it retains the Missouri 115-jurisdiction pilot.
- Geography import does not imply assessor, recorder, tax, auction, zoning, parcel, ownership or other local data-source coverage.

## 0.3.17 — National connectivity graph
- Added a 12-domain national information taxonomy covering property supply, distressed opportunities, buyers, sellers/owners, parcel identity, development, workforce, suppliers, capital, transactions, market context, and governance/provenance.
- Added record-type inventories, source-family discovery targets, connection relationships, and domain-specific compliance safeguards.
- Added read-only `/api/connectivity`, `/api/connectivity/domains`, and `/api/connectivity/relationships` endpoints protected by `properties:read`.
- Explicitly labels the graph as architecture-defined and external sources as not connected; this release does not add scraping or claim live national feeds.


## 0.3.18 — National source directory
- Added evidence-linked national source directory for listing networks, authorized MLS APIs, commercial listing partnerships, federal disposition portals, and public federal property/geography datasets.
- Added searchable/filterable `GET /api/national-sources` and `GET /api/national-sources/summary` endpoints with access and connection status explicitly distinguished.
- Added tests ensuring directory records never imply live integration or unrestricted redistribution rights.

## 0.3.19 — expanded national source and connectivity coverage
- Expanded the national source directory with residential and rental marketplace discovery, commercial property, land/farm, foreclosure/auction and government surplus destinations, plus federal public data/API sources for demographics, environmental screening, flood, soils, elevation, wetlands, housing benchmarks and geographic lookup.
- Added normalized source metadata: source type, ingestion mode, authentication expectations, rights-review requirement, refresh/format assessment state and verification status. Every newly cataloged source remains explicitly unconnected; marketplace discovery does not imply API access or redistribution rights.
- Added source-directory filtering by `ingestionMode` and summary counts by family, connection state and ingestion mode.
- Added searchable 56-jurisdiction tracker filters and `GET /api/data-catalog/jurisdiction-summary`; all jurisdictions remain `not_assessed` until actual portal research is completed.
- Expanded connectivity relationships for seller-authorized transaction workflows, listing preparation/workforce, procurement, financing milestones and market-to-development evidence.
- No external source adapters or live listings were connected in this release.

## 0.3.20 — public-data connector contracts and source coverage workflow
- Added connector contracts for Census ACS, Census Geocoder, Data.gov Catalog API, EPA ECHO, EPA Facility Registry Service, FCC Area API, FEMA NFHL, and USDA soil data services.
- Added normalized public-data observation staging with source lineage, geography, observed/published timestamps, duplicate suppression, and human review. Acceptance is for internal research only and does not verify facts or grant redistribution rights.
- Added jurisdiction/category source coverage tracking with HTTPS validation, status and access/rights notes. Coverage notes cannot mark a source connected.
- Added API routes for connector discovery, observation staging/review, and jurisdiction source coverage.
- No external API was called; no credentials or live feeds are configured.


## 0.3.21 — Census ACS read-only adapter and execution ledger
- Implemented a real Census ACS 2024 5-year API adapter for county-level demographic, housing and economic context, with FIPS validation and a required server-side `CENSUS_API_KEY`.
- Preserves published estimates and margins of error; derives a county-level vacancy rate with an explicit non-property-level limitation.
- Added status, run and run-history endpoints; failed and successful attempts are persisted without exposing API credentials.
- Successful fetches are staged into the existing public-data observation review queue with source lineage and idempotent duplicate suppression.
- Added PostgreSQL migration 006 with tenant RLS for adapter run history and JSON migration support.
- Fixture-backed adapter and API tests cover geography, mapping, missing credentials, HTTP errors, schema mismatch and run history. No live API key is configured and no live Census query is claimed.
- Verification: `npm run check` passed; `npm test` passed (72/72).


## 0.3.22 — Census Geocoder address-to-geography adapter
- Implemented a read-only Census Geocoder adapter for up to 20 address lookups per request, using current address-range benchmark and current geography vintage.
- Added server-side request handling and Data Intelligence UI for address batch submission, status and shared execution history.
- Stages matched address, coordinates, county/tract/block geography identifiers and TIGER line reference when available; original input is not stored and a deterministic hash is used for duplicate suppression.
- Explicitly labels interpolated coordinates and geographies as non-parcel evidence; no ownership, title, boundary or condition verification is implied.
- Added fixture-backed adapter tests and API validation tests. No live provider call is claimed.
- Verification: `npm run check` passed; `npm test` passed (77/77).


## 0.3.23 — pre-Claude completeness and integration audit

- Added authoritative built-vs-missing module inventory and recommended Claude Code implementation sequence.
- Explicitly documented VACAY, DREAMS Network, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and VOID integration boundaries; VEX remains separate.
- Preserved B. VXLA naming without inventing a role or permissions.
- Clarified historical reference bundle precedence and corrected current UI/version labels.
- Documentation/handoff increment only; no new live integration or production readiness is claimed.


## 0.3.24 — ecosystem integration registry
- Added a contract-first integration registry for VACAY, DREAMS Network, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and VOID.
- Added `GET /api/integrations` with per-service configuration readiness, required environment-variable names, capability boundaries and explicit live-connection status.
- Configuration is never reported as connected; the registry makes no outbound calls and does not store secrets.
- Added tests for service coverage, app boundaries, HTTPS validation and honest connection status.
