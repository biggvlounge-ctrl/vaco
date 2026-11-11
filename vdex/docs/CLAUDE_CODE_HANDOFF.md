# VDEX — Claude Code Handoff (Pre-Claude build 0.3.24)

## Mission
Continue the existing **VDEX — Vertical Vision Development Exchange** application. VDEX is the property acquisition, real-estate marketplace, development, investment-intelligence, and workforce platform. The name VDEX is final; do not use the former project name.

**Before coding:** read `docs/CLAUDE_CODE_START_HERE.md` and `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md`. The audit is the current authoritative inventory and integration-boundary document. Historical reference material is subordinate to the confirmed VDEX identity and architecture.

## Working rules
1. Inspect the actual repository and current runtime before editing. This ZIP is a prepared handoff snapshot, not proof it is the user's latest external working tree.
2. Preserve the existing project structure, routes, API contracts, JSON data, and backward compatibility. Prefer additive migrations and adapters over rewrites.
3. Run `npm run check` and `npm test` before and after each bounded change. Report exact commands, test counts, failures, and files changed.
4. Do not call a feature production-ready because a mock, local API, or test passes.
5. Do not claim live integrations without working credentials, provider contracts, licensing, and verified end-to-end connections. Never scrape restricted sources.
6. Keep records distinct: verified listing, potential seller lead, development candidate, distressed/auction lead, and unavailable property are not interchangeable.
7. Preserve source name/type/URL, retrieval timestamp, publication date when known, jurisdiction, confidence, verification status, licensing status, limitations, and missing-data warnings.
8. Human approval is required before offers, contracts, financing, money movement, hiring, listing publication, and other binding actions.
9. Apply privacy, consent, fair-housing, employment, marketing, real-estate licensing, securities, lending, and data-use safeguards with counsel where required.
10. Do not duplicate VACO, VACON, VACA, VASH, VCoin, or VOKEN. Integrate through verified existing service contracts. Do not create a second identity, wallet, ledger, payment, or token system.

## Current verified snapshot
- App version: 0.3.24 (documentation/handoff audit increment; runtime capabilities remain those of 0.3.22).
- Verification: `npm run check` passed; `npm test` passed 77/77. `npm run db:dry-run` passed against an isolated empty JSON fixture. The archive intentionally excludes demo `data/db.json`; rerun migration preflight against the actual working database before migration.
- Runtime: Node.js 18+, built-in modules only.
- Persistence: local JSON (`data/db.json`) with `VDEX_DB_PATH` override for isolated tests.
- Existing routes: health, summary, properties, property detail, Property DNA snapshot, property sources, jobs, seller leads, buyer mandates, watchlist, audit.
- Property intelligence routes: evidence, highlights, assessments, development scenarios.
- No external identity provider, live PostgreSQL/PostGIS runtime connection, live MLS/foreclosure/auction feeds, title/ownership verification, payment/escrow, GIS provider, or AI service is connected. Optional HS256 bearer-token verification, route-level role authorization, and application-level tenant filtering are implemented in `VDEX_AUTH_MODE=required`; database-enforced RLS has not been activated in a live runtime. Do not deploy publicly or treat this as production security. PostgreSQL/PostGIS schemas and a JSON import utility exist, but have not been applied to a live database.
- Local JSON persistence is not safe for multi-process or production concurrency.

## Implemented in 0.3.2
- Existing property CRUD/listing foundation, numeric validation, normalized-address duplicate protection, source provenance, conservative availability classification, and creation history.
- Seller inquiry requires explicit consent; consent record captures timestamp, notice version, purpose, authority confirmation, contact preference, and capture method.
- Buyer mandate price/acreage criteria reject negative or invalid numbers.
- Property evidence records include status, confidence, source metadata, retrieval time, and limitations.
- Property Highlights returns exactly three entries; unsupported slots disclose insufficient information; factual highlights must cite evidence belonging to the property.
- Property assessments retain professional-review requirement and property-local evidence references.
- Development scenarios store non-negative assumptions and approval requirements; they are not financing offers or feasibility certifications.
- Intelligence mutations create audit events.

## Implemented in 0.3.3
- Added `GET /api/properties/:id/dna` returning parcel identity, separately classified area measurements, linked evidence/sources, data-quality counts, and missing-data warnings.
- Added `GET /api/buyer-mandates/:id/matches` with preliminary type/location/budget/acreage screening; unknown values are not silently treated as confirmed fits, and seller authority remains a separate gate.
- Property create accepts optional jurisdiction-scoped parcel identifier and area measurements with unit validation.
- Duplicate detection now checks normalized address and normalized jurisdiction + parcel identifier; it returns HTTP 409 and never merges records automatically.
- Source registry records now reserve fields for publication date, jurisdiction, license scope, attribution, and refresh policy; licensing remains unknown until reviewed.
- Added baseline HTTP response headers and clear 400/413 request-body error handling.
- Verification: `npm run check` passed; `npm test` passed 30/30.


## Implemented in 0.3.4
- Seller inquiry consent is scoped to the specific property inquiry, not unrelated marketing.
- New seller inquiries receive a one-time random consent-withdrawal token; only its SHA-256 hash is stored.
- `POST /api/seller-leads/:id/withdraw-consent` requires explicit confirmation and the original token, records the withdrawal timestamp and audit event, marks consent false, and changes the lead to `Consent withdrawn — contact prohibited`.
- Invalid token, missing confirmation, unknown lead, and repeat withdrawal paths are tested.
- Existing seller inquiry request shape remains compatible; consent notice version is now `seller-inquiry-v2`.
- Verification: `npm run check` passed; `npm test` passed 30/30.
- Limitation: bearer-token possession is not identity verification. This does not replace production authentication, contact verification, retention/deletion workflows, or legal review.


## Implemented in 0.3.5
- Added job-specific worker applications via `POST /api/jobs/:id/applications` and a frontend apply form on each open job; requires applicant name, email or phone, and explicit consent for this job only.
- Captures skills, experience summary, availability, optional HTTPS portfolio, and self-reported credentials; credentials remain explicitly `unverified`.
- Prevents duplicate active applications for the same job/contact. Public job listing responses do not include applications or applicant contact details.
- Added `POST /api/job-applications/:id/withdraw` with a one-time random token (only SHA-256 hash stored), explicit confirmation, contact prohibition, applicant identity/contact/profile-field erasure from the local record, and audit event.
- No hiring decision, credential verification, worker assignment, or payment is automated. Employer review endpoints are intentionally withheld until authentication and tenant authorization exist.
- Verification: `npm run check` passed; `npm test` passed (see current build status for exact count).

## Next implementation order
### P0 — harden the foundation
- Add authentication and organization/tenant authorization before exposing any private API outside local development. The current consent-withdrawal token is a local MVP capability token, not identity verification.
- Replace JSON writes with transactional PostgreSQL migrations while preserving an import/export path for existing JSON data.
- Add request schema validation, request-size handling, rate limiting, CSRF/origin policy as appropriate, structured errors, secure headers, and secret management.
- Add concurrency, restart/persistence, access-control, negative-path, and end-to-end tests.
- Define retention, data-subject access/deletion, and audit immutability policies; replace capability-token-only consent withdrawal with authenticated, verified contact workflows.

### P1 — Property DNA and marketplace
- Continue from 0.3.3: add evidence reconciliation, parcel alias review queues, jurisdiction-specific APN normalization adapters, and source freshness/rights workflows. The current duplicate guard is exact-key matching only, not a legal parcel resolution service.
- Implement a canonical property schema with separate above-grade finished area, below-grade finished area, below-grade unfinished area, parcel area, unit, measurement method, source, timestamp, and confidence.
- Add parcel/APN identifiers with jurisdiction and source, never treating a normalized street address as a legal parcel identity.
- Add evidence conflict resolution and a source registry with license/terms review gates.
- Extend deduplication using jurisdiction + parcel identifiers + normalized address; support possible-duplicate review rather than destructive merges.
- Add listing lifecycle, seller authority verification, consent scope, publication approval, buyer mandates, inquiries, and documented handoff states.

### P2 — acquisition sources
- Add licensed/authorized adapters for MLS/IDX where contractually permitted, county assessor/recorder, public foreclosure notices, auction operators, FSBO, and seller-authorized off-market sources.
- Store provider, retrieval time, license scope, attribution, refresh policy, raw reference IDs, and provenance. Never scrape restricted systems or imply public data equals listing authority.
- Keep distressed signals separate from confirmed sale opportunities.

### P3 — workforce
- Build on the 0.3.5 job application foundation with authenticated worker/organization profiles, private employer review, role requirements, credential and insurance/license checks, assignment bids, acceptance, milestones, deliverables, dispute states, and human-approved payment handoffs.
- Support photographers, property viewers, researchers, data-entry staff, inspectors, surveyors, trades, and development professionals. Do not imply credential verification until evidence is checked.

### P4 — parcel assembly and feasibility
- Add parcel adjacency only from licensed geospatial/parcel data; preserve source and geometry accuracy metadata.
- Add scenario assumptions for land, hard/soft costs, contingency, schedule, utilities, access, zoning, environmental, title, taxes, and financing.
- Display missing inputs and blocking risks. Keep outputs clearly labeled preliminary; require qualified professionals for surveys, title, engineering, environmental, zoning, and legal determinations.

### P5 — integrations and governance
- Inspect actual VACO/VACON/VACA/VASH/VCoin/VOKEN service contracts and credentials before adapter implementation.
- Use existing identity and permission services; do not create local identity/wallet/payment substitutes.
- Keep VEX consumer brokerage, VIG/PPG principal investment, and other legal entities/workflows separated pending corporate-register and counsel confirmation.
- Add security review, audit review, operational runbooks, backups, monitoring, and documented restore drills.

## Human approval gates
No automated action may publish or delist a property, contact a third party beyond the consent scope, make an offer, sign/accept a contract, move funds, issue financing, hire/terminate a worker, or make a regulated investment recommendation. Build draft/review/approve/execute states with named actor, timestamp, scope, and audit evidence.

## Start-of-session checklist for Claude Code
1. Print `pwd`, inspect repository status and files, and identify the active project root.
2. Compare this handoff snapshot with the actual current repository; do not overwrite newer code.
3. Run `npm run check` and `npm test`; save the baseline.
4. Inspect `docs/MASTER_SPEC.md`, current routes, frontend API usage, and data schema.
5. Select one bounded P0 task, implement it, add regression tests, rerun checks, and report exact results.
6. Keep the next build recommendation focused on the largest verified blocker.


## Implemented in 0.3.6
- Added `db/migrations/001_initial_postgres_postgis.sql` with typed relational tables for organizations, properties, property sources, jobs, job applications, seller leads, buyer mandates, watchlists, property intelligence, and audit events.
- Added PostGIS point and multipolygon columns and GiST indexes for future authorized geospatial data; no coordinates or boundaries are invented.
- Added `scripts/migrate-json-to-postgres.js`, with `npm run db:dry-run` and `npm run db:import`. Dry-run validates relationships, reports collection counts and source SHA-256, and does not need a database. Import uses a transaction/rollback and leaves the source JSON untouched.
- Current dry-run: 2 properties, 2 jobs, 0 orphan references. Tests: 32/32.
- No live database was available. `pg` must be installed and `VDEX_DATABASE_URL` configured before a live import. All migrated records remain `tenant_id` NULL until an explicit organization ownership mapping is approved.
- The application still uses local JSON at runtime. Do not represent the SQL schema as an active database or the nullable tenant field as access control.

## Next task after 0.3.6
Implement authentication and organization-level authorization before exposing private application, seller, buyer, or workforce data. Define a repository interface and PostgreSQL runtime adapter only after the access-control model and tenant ownership rules are established.


## Implemented in 0.3.7
- Added `db/migrations/002_identity_tenant_security.sql`: external identity subjects, user status, organization memberships, role constraints, hashed invitations, tenant ownership columns/indexes, and fail-closed PostgreSQL row-level security policies.
- RLS is forced on tenant-owned tables and depends on transaction-local `vdex.tenant_id` and, for self/membership access, `vdex.user_id`. Membership administration additionally requires a trusted service layer to set `vdex.membership_manage=true` after checking owner/admin permission.
- Existing records remain unassigned (`tenant_id` NULL); no ownership mapping is inferred.
- Added `backend/authorization.js` with role permission definitions, active-principal validation, deny-by-default permission checks, and tenant predicate helpers. Roles: owner, admin, acquisitions, analyst, workforce_manager, worker, viewer.
- Corrected `/api/health` to report 0.3.7.
- Verification: `npm run check` passed; `npm test` passed 36/36; `npm run db:dry-run` passed (2 properties, 2 jobs, 0 orphan references).
- Critical limitation: this is a schema and authorization-policy foundation only. JSON API routes do not yet enforce these roles or tenant boundaries. The SQL migration has not been run against a live PostgreSQL instance; RLS requires real integration tests with a database role that does not have `BYPASSRLS`.

## Next task after 0.3.7
Connect trusted identity-provider claims to active organization memberships, add authenticated request middleware and route permissions, then move private routes to a PostgreSQL transaction/repository layer that sets tenant context with `SET LOCAL`. Do not bolt tenant scoping onto the current JSON file or expose it publicly.


## Implemented in 0.3.8
- Added HS256 JWT verification with required expiration, active membership, issuer/audience validation, 32-byte minimum secret, and timing-safe signature checks.
- Added opt-in `VDEX_AUTH_MODE=required` route protection and role permission checks; health, public job discovery/application, and token-based seller/applicant consent withdrawal remain public intake routes.
- Added `GET /api/auth/session` for validated principal inspection.
- Added employer application review list and status transitions (`Reviewing`, `Shortlisted`, `On hold`, `Not selected`) requiring `workforce:manage`; transitions are audited and explicitly do not represent a hire or offer.
- Added JWT unit tests and required-mode API integration tests.
- Critical limitation: this does not yet enforce tenant row filtering in the JSON API. The PostgreSQL RLS schema is not active until PostgreSQL is connected and all requests use a verified tenant context.


## Implemented in 0.3.9
- Added fail-closed organization filtering in authenticated JSON mode for properties and their DNA/source/intelligence records, buyer mandates/matches, watchlists, summary counts, audit reads, and employer job/application review. Unassigned legacy records are not visible to authenticated organizations.
- Server derives `tenantId` from the verified principal for new property, job, buyer mandate, and watchlist records; caller-supplied tenant IDs are ignored.
- Public job board returns open jobs only and strips tenant identifiers. Public job applications inherit the tenant ID of the target open job. Employer review verifies tenant ownership.
- Added cross-tenant tests proving organization B cannot list, detail-read, or retrieve DNA for organization A's property.
- Important remaining gaps: seller public intake does not yet have an organization-routing configuration; public withdrawal tokens remain bearer capabilities; legacy unassigned records require explicit ownership mapping; JWT signing key is shared-secret HS256 rather than a connected trusted IdP; PostgreSQL runtime/RLS is not activated; JSON file concurrency remains unsuitable for production. Do not deploy publicly.

## Next P0 tasks after 0.3.10
1. Introduce a repository abstraction and PostgreSQL runtime adapter; use parameterized SQL and `SET LOCAL vdex.tenant_id` within every transaction, and test RLS with a non-BYPASSRLS database role.
3. Add rate limits, security event logging, CSRF/origin controls for browser sessions, secret rotation guidance, and trusted external identity-provider validation.


## Implemented in 0.3.10
- Added authenticated `GET /api/seller-leads` organization queue with tenant filtering and removal of internal withdrawal-token hashes from responses.
- Added `PATCH /api/seller-leads/:id/review` with constrained review states (`New — not verified`, `Under review`, `Qualified lead`, `Not a fit`, `Closed`), reviewer identity, timestamp, bounded note, and audit event.
- Seller lead intake in required-auth mode is assigned only to `VDEX_SELLER_INTAKE_ORG_ID`; if absent, intake fails closed with HTTP 503.
- Cross-tenant seller lead list/review access is denied. Withdrawn consent cannot be reactivated through review; only closure or not-a-fit is permitted. Review status never authorizes outreach, which remains limited to active, purpose-scoped consent.
- Verification: `npm run check` passed; `npm test` passed 40/40; `npm run db:dry-run` passed (2 properties, 2 jobs, 0 orphan references; source preserved).
- Limitations: seller queue and review run on local JSON, no assignment routing or verified identity provider exists, and contact operations are intentionally not automated. Do not deploy publicly.


## Implemented in 0.3.11
- Added `backend/acquisition-sources.js` with an explicit source-type catalogue, strict metadata validation, credential-field rejection, and connector state transitions.
- Added organization-scoped `GET|POST /api/acquisition-sources`; registration is tenant-derived from the authenticated principal and starts as `pending_authorization`.
- Added `PATCH /api/acquisition-sources/:id/authorize`, restricted to organization managers/owners, requiring explicit confirmation, HTTPS authorization evidence, and a declared license scope. The state becomes `authorized_not_connected`, never `connected`.
- Supported categories: county assessor, county recorder, foreclosure notice, auction operator, MLS/IDX, FSBO, wholesaler, owner-authorized off-market, and other.
- Connector metadata cannot contain API keys, passwords, client secrets, access/refresh tokens, or generic credentials. Store future secrets only in a managed secret vault and reference them by opaque secret ID.
- Added `db/migrations/003_acquisition_source_connectors.sql` with organization foreign key, constrained source/status fields, and forced tenant RLS.
- Extended JSON migration to preserve acquisition-source records and apply migrations 001, 002, and 003 in order within the import transaction.
- No provider adapters, live network synchronization, data license verification, or feed imports are implemented. Authorization is an administrator attestation, not independent legal verification.
- Baseline check exposed a stale `0.3.9` health-version assertion in `tests/api.test.js`; corrected it to the current release version before final verification.
- Verification: `npm run check`, `npm test`, and `npm run db:dry-run` must be rerun for this release; current dry-run remains local JSON preflight only.

## Next engineering priorities after 0.3.11
1. Implement an actual PostgreSQL repository/runtime with transaction-scoped `SET LOCAL vdex.tenant_id` and integration tests under a non-BYPASSRLS database role. Do not claim DB activation until a real database is connected.
2. Build provider-specific adapters only after credentials, contracts, permitted use, attribution, retention, refresh limits, and jurisdiction are documented. Begin with manually imported public-record/auction data where legally permitted; never scrape restricted MLS/IDX or paywalled systems.
3. Add import staging, source-record deduplication, review queues, conflict handling, and human approval before creating or changing property records.


## Implemented in 0.3.12 — nationwide data catalog and acquisition staging
- Added `backend/data-catalog.js` with a curated discovery catalog spanning federal, state/local, public redevelopment, parcel/assessment, deeds/liens, tax delinquency, foreclosure, sheriff auction, zoning/permits, environmental, hazard, soils, terrain, demographics, market, infrastructure, public finance, commercial data vendors, MLS/IDX, auctions and owner-authorized FSBO/off-market records.
- Catalog entries include publisher, geography, cadence, access model, terms class, source URL, intended data points and limitations. The catalog is a source-discovery inventory only; it does not mean every source is available, licensed, complete, or connected.
- Added `GET /api/data-catalog` with category/access/text filters.
- Added `GET /api/data-catalog/jurisdictions` with 50 states, DC and five inhabited territories, each initialized as `not_assessed` and carrying local source categories to inventory. This is a nationwide coverage tracker scaffold, not evidence that every county portal has been discovered or connected.
- Added `POST /api/acquisition-imports/stage` for batches of 1–100 source records and `GET /api/acquisition-imports/staged` for the organization review queue. Normalizes common assessor aliases (APN, OBJECTID, assessed value, situs address, acreage, building area), retains only field names rather than raw source payloads, and deliberately excludes owner names/emails/phones from normalized candidates.
- Staging performs idempotency checks on source external IDs and possible-duplicate matching by jurisdiction + parcel ID, then normalized address. Duplicate candidates go to `duplicate_review`; others go to `pending_review`. Missing parcel IDs, address, publication dates, and restricted/contract-required access produce warnings.
- Staged records do not automatically create listings, verify ownership, confirm availability, or contact sellers. No source provider is queried by the import endpoint; data is supplied by an authorized manual import/integration process.
- Added migration 004 for tenant-scoped staging and included staged records in the JSON-to-PostgreSQL migration. Imported records whose tenant does not exist in the target organization table remain unassigned and are denied by tenant RLS rather than being assigned to a fabricated organization.
- National coverage is inherently fragmented: county assessor/recorder, tax-sale, foreclosure, zoning, code enforcement, and land-bank data have no single complete official national endpoint. Each jurisdiction must be inventoried and checked for data rights, fields, freshness, and access method.
- Verification: `npm run check`, `npm test` (47/47), and `npm run db:dry-run` passed. Dry-run source remains preserved; sample has 2 properties and 2 jobs, zero orphan references.

## Immediate next build
1. Extend the jurisdiction scaffold to a county/county-equivalent directory and record actual portal URLs, API formats, bulk downloads, contact points, terms, update cadence and data coverage.
2. Build field-level conflict resolution and provenance reconciliation for multiple assessor, recorder, GIS, FEMA, EPA, zoning and commercial source records.
3. Implement provider adapters only for approved sources, starting with open federal APIs and a pilot jurisdiction; then expand state-by-state and county-by-county. Commercial data requires negotiated license/redistribution rights.


## Implemented in 0.3.13 — acquisition review and property promotion
- Added `PATCH /api/acquisition-imports/:id/review` with human decisions: `approve`, `reject`, `link_existing`, and `keep_separate` for address-only possible duplicates.
- Approval creates a VDEX property record only after an authorized review. The new record remains `Unverified lead`, seller authority remains `Not verified`, and the attached source provenance remains unverified. No listing publication or seller outreach occurs.
- Parcel-ID + jurisdiction duplicates cannot be overridden as a separate property. They must be linked to the existing property or rejected. Address-only duplicate overrides require `confirmDistinctProperty=true` and a review note of at least 20 characters.
- Linking a duplicate adds a source provenance record and property history entry to the matched property without creating a second property.
- Rejected and already-reviewed records cannot be promoted again. Review decisions are audit logged.
- Source publisher, terms/license scope, refresh cadence, jurisdiction and publication date are attached to provenance metadata when available; license status remains unverified.
- Migration 004 supports `linked_existing` status.
- Verification: `npm run check` passed; `npm test` passed 48/48. `npm run db:dry-run` remains a local JSON preflight and does not activate PostgreSQL.


## Implemented in 0.3.15 — county-equivalent coverage pilot

- Added `backend/county-directory.js` with 115 Missouri county-equivalent GEOIDs: 114 counties plus the independent City of St. Louis.
- Added nine independently tracked source categories per county-equivalent: assessor, recorder, tax collector, foreclosure/court/sheriff, auction, land bank/redevelopment, planning/zoning/permits, GIS/parcels, and code/vacancy. All are initially `not_assessed`; no source coverage is implied.
- Added `GET /api/data-catalog/county-equivalents?state=MO` with GEOID/name filtering and `GET /api/data-catalog/coverage?state=MO` summary. Other states return no county records until the official Census geography inventory is loaded.
- Added the 2026 Census TIGER/Line County and Equivalent Entities file as a public geography source in the data catalog. The official file is the intended national import source; it is not included in this package and has not been downloaded or parsed here.
- The Census boundary layer is geography, not parcel ownership, assessment, title, tax, zoning, or listing data. Use its GEOIDs to reconcile local source inventories, not as evidence of property rights.
- No local feeds were connected. Source discovery, rights review, adapter implementation, and source refresh testing remain separate work.
- Verification: `npm run check`, `npm test`, and `npm run db:dry-run`.

## Implemented in 0.3.16 — national geography import foundation
- `backend/tiger-import.js` parses TIGER county-equivalent CSV, JSON and GeoJSON exports without external dependencies.
- `scripts/import-tiger-counties.js` exposes `npm run geography:import -- <file> [--vintage=YYYY]` and atomically writes `backend/data/national-county-equivalents.json`.
- Import validation checks FIPS widths, GEOID composition, names, state resolution and duplicate GEOIDs. FIPS values remain strings.
- `backend/county-directory.js` automatically reads the national import when present; otherwise it continues to serve the Missouri pilot.
- The raw Census ZIP/DBF is not unpacked by this utility yet; convert/extract to CSV or GeoJSON first. Verify vintage and provenance.
- Importing geography does not mark any of the nine county source categories as discovered or connected. Continue source discovery separately, with licensing, access, freshness and attribution review.


## Implemented in 0.3.17 — national connectivity graph
- Added 12 canonical domains spanning every major VDEX participant and workflow: listing supply, distressed supply, buyer demand, seller/owner readiness, parcel identity, development, workforce, suppliers, capital, transactions, market context, and governance/provenance.
- Each domain defines record types, participant classes, source families, connected domains and compliance safeguards.
- Added read-only `/api/connectivity`, `/api/connectivity/domains`, and `/api/connectivity/relationships` endpoints.
- This is an architecture blueprint, not a claim of national feed connectivity. Continue building the source-by-jurisdiction matrix and connect only documented public APIs or properly licensed/authorized feeds.


## Implemented in 0.3.18 — national source directory
- `backend/national-source-directory.js` catalogs evidence-linked national listing/disposition and public data sources.
- APIs: `GET /api/national-sources` (filters `q`, `family`, `domain`, `connection`) and `GET /api/national-sources/summary`.
- Distinguishes public portals, licensed/partner feeds, standards documentation, and public datasets. All source entries remain unconnected until legal/technical access is verified and a connector is tested.
- Important semantics: RESO provides standards, not a national listing feed; Crexi Listing API documented flow is partner-to-Crexi, not an assumed VDEX inbound API.
- Next: expand this registry with state and jurisdiction-level sources, attach source-specific access/refresh/attribution metadata, and implement one authorized adapter at a time.

## Implemented in 0.3.20 — national source coverage expansion
- Expanded `backend/national-source-directory.js` with residential/rental/commercial/land marketplaces, auction and government-surplus discovery sources, and official federal public-data/API sources for Census demographics, EPA environmental context, FEMA flood, USDA soils, USGS elevation, USFWS wetlands, FHFA price trends, HUD rent benchmarks and FCC geography lookup.
- Source records now expose normalized integration metadata: source type, ingestion mode, authentication expectations, rights-review requirement, refresh policy, format assessment, verification status and last checked timestamp.
- Added `ingestionMode` filter to `GET /api/national-sources` and summary counts to `/api/national-sources/summary`.
- Added query/status filters to the 56-state/DC/territory jurisdiction scaffold and `GET /api/data-catalog/jurisdiction-summary`. All 56 remain not assessed; do not represent this as complete local source discovery.
- Expanded connectivity relationships between seller intent, listing preparation, workforce, suppliers, capital, market context and transactions.
- All marketplace listings remain manually discoverable only; no scraping, inbound APIs, provider permissions, feed imports or live connections are claimed.
- Continue with source-by-source validation and build one approved adapter at a time. Prioritize official public APIs and openly licensed bulk data before contract-dependent commercial feeds.

## Implemented in 0.3.20 — public data connector and coverage foundation
- Eight public/federal connector contracts: Census ACS, Census Geocoder, Data.gov Catalog API, EPA ECHO, EPA FRS, FCC Area API, FEMA NFHL, USDA soil data.
- New `backend/public-data-connectors.js` defines connector metadata, categories, observation normalization, and source coverage summaries.
- Added `/api/public-data/connectors`, `/api/public-data/stage`, `/api/public-data/staged`, `/api/public-data/staged/:id/review`, and `/api/public-data/coverage` endpoints.
- Staged observations preserve source lineage and are not promoted to property facts. Human acceptance is research-only; rights and factual verification remain pending.
- Coverage records cannot claim `connected`; only a separately implemented, tested adapter can establish operational connection.
- No external network requests or credentials are included in this release.


## Implemented in 0.3.21 — Census ACS county adapter
- Frontend: Data Intelligence tab checks key configuration, starts a state/county fetch, and lists run history.
- Adapter: `backend/census-acs-adapter.js`; read-only query against 2024 ACS 5-year county geography.
- Required secret: `CENSUS_API_KEY` in the server environment only. Never pass it through a client request or store it in source metadata.
- Variables include total population, housing units, vacant units, owner/renter occupied units, median household income and median gross rent; estimate and margin of error are retained separately.
- Routes: `GET /api/public-data/census-acs/status`, `POST /api/public-data/census-acs/run`, `GET /api/public-data/census-acs/runs`. POST body requires two-digit `stateFips`; optional three-digit `countyFips`. Example Missouri state FIPS `29`; St. Louis County FIPS `189`.
- Successful responses stage county observations in `publicDataObservations`; duplicate key is tenant + source + external ID. Every item remains pending review and unverified.
- Adapter run records persist status, requested geography, timestamps, record count, safe error code and source metadata. API key is never stored in the run ledger.
- Migration 006: `public_data_adapter_runs` with forced tenant RLS; JSON importer maps `publicDataRuns`.
- The county-level ACS vacancy estimate must never be presented as a specific property's vacancy status. ACS data does not supply parcel identity, ownership, title, active listing, assessed value, zoning or property-level development feasibility.
- Fixture-backed tests pass; no production Census key is included and live provider connectivity remains unverified until the deployment operator supplies a key and executes a successful run.


## Implemented in 0.3.22 — Census Geocoder adapter
- Adapter: `backend/census-geocoder-adapter.js`; read-only single-address lookup using the official Census Geocoder `geographies/onelineaddress` endpoint, current benchmark and current geography vintage. No API key is documented as required.
- Route: `GET /api/public-data/census-geocoder/status`; `POST /api/public-data/census-geocoder/run` with `{ "addresses": ["123 Main Street, Florissant, MO 63031"] }`; 1–20 addresses per request.
- Geocoder output is staged into `publicDataObservations` with deterministic hashed input identifier, matched address, coordinates, state/county/tract/block identifiers and TIGER line reference when returned.
- Coordinates are explicitly labeled as address-range interpolations, not rooftop or survey-grade points. Census geography is not a parcel boundary, parcel identity, ownership, title or property-condition determination.
- Shared execution history is available at `GET /api/public-data/runs`; legacy ACS run-history route remains available.
- Fixture tests cover URL construction, geography mapping, no-match, malformed responses and connection-state semantics. No live request is claimed by fixture tests.


## Implemented in 0.3.23 — completeness audit and integration scope
- Added `docs/CLAUDE_CODE_START_HERE.md` and `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md`.
- The audit inventories all modules actually present, all catalog-only data sources, and the major unimplemented product pillars.
- Binding architecture decisions: VDEX remains independent and grouped with VACAY/VOID; VACAY listing/workflow integration, DREAMS Network attachment and VULCAN tokenization handoff are required but not connected. Reuse VACA/VASH/VCoin/VOKEN/VACO/VACON through real contracts. VEX trading remains separate.
- B. VXLA is preserved as an exact project name; role/permissions require owner confirmation.
- Historical VACO DEX rename and VASH fundraising references are explicitly subordinate to current VDEX scope.
- No new provider connection or production feature is claimed in this documentation-only increment.


## Implemented in 0.3.24 — contract-first ecosystem integration registry
- Added `backend/ecosystem-integrations.js` with explicit service boundaries, purposes, capability scopes and required configuration fields for VACAY, DREAMS Network, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and VOID.
- Added `GET /api/integrations`; authenticated mode requires `properties:read`. The endpoint reports `not_configured`, `configuration_invalid` or `configured_unverified`; it always reports `liveConnectionVerified:false` because no provider health check or outbound call exists yet.
- Configuration uses endpoint, contract identifier and opaque credential-reference environment variables. Secret values are not accepted or stored by this registry. HTTPS is required.
- Added automated module and API tests. This is an integration readiness registry and contract boundary, not a live connector.
- Next integration step: obtain the real service contracts and approved credential references, then implement one adapter at a time with signed/authenticated requests, idempotency, event/outbox handling, retries, audit records and provider-backed sandbox tests.
