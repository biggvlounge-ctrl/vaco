# VDEX Completeness Audit — 0.3.23

**Purpose:** authoritative inventory of what is in this pre-Claude package, what is only described/cataloged, what is partially implemented, and what remains to complete. This audit prevents Claude Code from treating roadmap text, sample data, source catalogs, or test fixtures as live integrations.

## 1. Product identity and architecture — binding decisions

- Product name: **VDEX — Vertical Vision Development Exchange**. This is the confirmed name. Do not rename it to VACO DEX or VACO Development Exchange.
- VDEX is an independent application. It remains grouped with **VACAY and VOID** in the same application constellation, but it is not merged into either app and is not placed inside V3 or V4.
- VDEX is a national property acquisition, listings/discovery, development intelligence, participant connectivity, and workforce platform.
- VDEX must connect to **VACAY** for authorized shared property/vehicle marketplace discovery and appropriate seller/owner workflows, inquiries, leads, viewing/booking requests, and transaction handoffs. VDEX remains a separate app and must use actual VACAY APIs/services rather than duplicate its marketplace.
- VDEX must attach to the **DREAMS Network** for approved discovery, distribution, project/community visibility, and workflow referrals. DREAMS integration must use actual contracts and consented data scopes.
- **VULCAN** is the designated tokenization integration. VDEX may prepare eligible property/project records and pass approved tokenization requests to VULCAN; it must not create its own token factory, blockchain, wallet, settlement ledger, or imply that tokenization creates legal title or securities compliance.
- Reuse **VACA** for identity/organization verification, **VASH** for authorized financial workflows, **VCoin** for settlement only where its real capabilities and approvals permit, and applicable **VOKEN** services for credentials/trust where supported. Do not duplicate these systems.
- Keep **VEX** stocks/trading separate from VDEX. No Pivx-style trading or investment brokerage should be built into VDEX merely because a property project has capital needs. Any investment/security workflow requires a separately approved legal and service boundary.
- VEDA/VEGA/VRG/VIG/PPG are relevant ownership, commercial, real-estate operations, or investment stakeholders only through confirmed organization and service contracts. Do not infer service APIs from organizational names.
- **B. VXLA** (spoken “B. Vila”; exact spelling `B. VXLA`) is a named person/persona in the VDEX project context. Preserve the name in project references. The current package does not define a verified role or permissions for this person; Claude must not invent either. Confirm the intended role with the project owner before assigning access or workflow authority.

## 2. Package inventory — actually present in 0.3.22

### Runnable application
- Node.js 18+ HTTP backend; built-in modules for local demo runtime.
- Responsive browser frontend with Property Exchange, Buyer Mandates, Property Watchtower, Workforce Marketplace, Seller Concierge, Data Intelligence, and architecture overview panels.
- Local JSON persistence and `VDEX_DB_PATH` test isolation.
- Optional JWT bearer-token verification, role/permission checks, and application-level tenant filtering when `VDEX_AUTH_MODE=required`.
- PostgreSQL/PostGIS migration foundation, tenant/identity schema, RLS policy definitions, and JSON-to-PostgreSQL migration utility. No live production database is connected.

### Property and acquisition foundations
- Property create/list/search/detail and Property DNA snapshot.
- Parcel identifier and address duplicate checks; no destructive auto-merge.
- Separate parcel area, above-grade finished area, below-grade finished area, and below-grade unfinished area.
- Property evidence, exactly-three highlights, assessments, development scenarios, source records, and audit events.
- Preliminary buyer-mandate matching with missing-data and verification warnings.
- Acquisition source registry, import staging, human review, duplicate linking, and promotion to an **unverified lead** only.
- Source discovery directory covering residential, rental, commercial, land, auction/foreclosure, public surplus and selected federal context sources.
- National state/DC/territory scaffold (56 entries); Missouri county-equivalent pilot (114 counties plus independent City of St. Louis) and TIGER geography import foundation.

### Participant and workforce foundations
- Buyer mandate create/list and preliminary property matches.
- Seller inquiry intake with purpose-limited explicit consent, one-time withdrawal token, consent withdrawal, and audit trail.
- Job/assignment create/list and job-specific applicant submission with consent and one-time withdrawal token.
- Applicant credentials are self-reported/unverified. No complete worker profile, employer review UI, credential verification, contractor bidding, assignment management, or payment workflow is present.

### Public-data foundations
- Eight public connector contracts/catalog entries: Census ACS, Census Geocoder, Data.gov Catalog API, EPA ECHO, EPA Facility Registry Service, FCC Area API, FEMA National Flood Hazard Layer, and USDA Soil Data Access.
- Working read-only adapter implementations in this release: Census ACS 2024 five-year county context and Census Geocoder address-to-Census-geography lookup.
- Observation normalization, provenance, staging/review, source coverage records, adapter run history, and migration 006.
- ACS values preserve estimates and margins of error. Geocoder coordinates may be address-range interpolations. Neither adapter establishes parcel identity, ownership, title, value, listing status, property condition, or zoning.
- Adapter tests use fixtures. The release does not claim live provider verification; ACS requires `CENSUS_API_KEY` for deployment execution.

### Historical reference add-ons retained in this ZIP
- `docs/reference/vaco_dex_preclaude_v0_3/` includes earlier property-intelligence code/tests, an integration patch, social-distribution connector contract, and a fundraising campaign prototype/tests.
- The fundraising prototype is a **VASH-owned extension concept**, not a VDEX runtime module. Preserve its separation between donations/rewards and securities; do not add it to VDEX's core financial stack or imply it is connected to VASH.
- The social connector is a contract/reference only; it does not publish to social platforms and is not a live DREAMS integration.
- The historical VACO DEX rename proposal is superseded and must not be followed. The current product name remains VDEX.

## 3. Modules in the master product vision that are not complete

The following are **not complete merely because they appear in the architecture panel, source catalog, roadmap, or reference bundle**:

1. National listing ingestion and synchronization across authorized MLS/IDX, broker feeds, residential marketplaces, rentals, commercial, land, auction, foreclosure, REO, FSBO, wholesale, government surplus, and off-market channels.
2. Nationwide parcel/APN, assessor, recorder/deed, tax, lien, code/vacancy, permit, zoning, land-bank and ownership records. The 56-jurisdiction scaffold is not source coverage. The Geocoder staging record retains the provider-returned matched address (which may correspond to the submitted address); the raw request is not separately persisted, and a normalized one-way hash is used for duplicate suppression.
3. Canonical parcel/property identity resolution, parcel geometry, parcel-to-building relationships, cross-source listing identity, owner/organization identity, and human conflict resolution at national scale.
4. Full distressed-property lifecycle: pre-foreclosure signals, notice/sale dates, sheriff/trustee auction, tax sale, REO, redemption periods, auction terms/deposits, lien/title diligence, occupancy/possession, bid approvals and post-sale workflow.
5. Full wholesale workflow: seller authority, contract/assignment permissions, earnest-money milestones, proof-of-funds review, disclosure, buyer assignment, double-close handoff and state-specific legal controls.
6. Developer, investor, broker, lender, vendor, supplier, contractor and professional profiles; organization verification; relationships; availability; mandates; capital criteria; and consented referral routing.
7. Parcel assembly, ownership adjacency, access/easement analysis, zoning and permitted-use lookup, setbacks/density, utility capacity, environmental overlays, flood/soil/wetland/topography, infrastructure, traffic, broadband, comps and market feasibility.
8. Financial underwriting: acquisition costs, rehab/construction budgets, soft costs, contingencies, taxes/insurance, financing assumptions, cash flows, sensitivity, rent/sale scenarios, yield and risk disclosures. Current development scenarios are basic assumption records, not a complete underwriting engine.
9. Dealroom and transaction lifecycle: offer drafts, negotiation, document exchange, due diligence checklist, title/escrow/closing milestones, contingencies, approvals, signatures, and licensed partner handoffs.
10. Full workforce marketplace: worker and company profiles, licenses/insurance, background/credential checks, worker classification safeguards, bids, employer review, assignments, milestones, deliverables, disputes, time tracking, approved payments and tax/reporting workflows.
11. Construction delivery: procurement, materials/equipment marketplace, vendor quotes, purchase approvals, permits, inspections, change orders, draw schedules, project schedules, contractor performance and closeout.
12. Rental/leasing/property management: availability, applications, compliant screening via approved providers, lease generation/signature, rent collection, maintenance, tenant communications, renewals and disposition.
13. Production maps/GIS, parcel boundary geometry, geospatial search, route/field-worker dispatch, imagery and authoritative map licensing.
14. Automated Watchtower monitoring, alerts, saved searches, event subscriptions, notification preferences, digest controls and change history.
15. VACAY, DREAMS, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and any external provider integrations. These are requirements/targets, not live connections in this package.
16. Production admin/compliance console, data-subject access/correction/deletion, consent preference center, retention automation, dispute process, audit export, support tooling and incident response.
17. Production search infrastructure, background jobs/queues, object/document storage, analytics, observability, backup/restore, disaster recovery, CI/CD, deployment, load tests and security testing.

## 4. National data strategy — required coverage model

VDEX should maintain a national source matrix at **jurisdiction × source category × record type × access right** granularity. For each source preserve publisher, official source URL, geography, fields, format/API, authentication, license/terms, allowed purposes, redistribution rules, retention rules, refresh cadence, contact/credential status, last checked time, last successful run, record count, error state and provenance.

Minimum categories to track for every state/county-equivalent/city where available:
- Assessor/parcels and property characteristics.
- Recorder/register of deeds, deeds, mortgages and releases.
- Tax collector, delinquency, tax sale and redemption.
- Court, sheriff, trustee, foreclosure and civil notices.
- Auction operators, REO and government disposition.
- Land bank, redevelopment authority, vacant/abandoned property.
- GIS, parcel polygons, address points and street centerlines.
- Planning, zoning, land use, permits, code enforcement and certificates of occupancy.
- Utilities, water/sewer, electric/gas, broadband, transportation and infrastructure context.
- Environmental: EPA facilities/contamination, flood, wetlands, soils, elevation/slope and hazards.
- Market: sales/comps, rents, vacancies, assessments, economic/demographic trends and construction costs.
- Listings: residential, multifamily, rental, commercial, industrial, hospitality, institutional, agricultural, land and business assets.
- Participants: buyer demand, seller-authorized leads, developers, investors, brokers, lenders, workers, suppliers and service firms.

Do not use scraped public web pages as a substitute for source authorization. Public visibility does not itself authorize bulk extraction, retention, display, or redistribution. RESO is a standards body, not a national MLS feed; access must come from each MLS or an authorized provider under its license and use scope. Support versioned RESO Data Dictionary mappings and provider-specific field maps rather than hardcoding one national schema.

## 5. Recommended architecture improvements

### Highest priority — before public or multi-tenant deployment
- Replace local JSON as the operational datastore with PostgreSQL/PostGIS and transactional writes; run migrations against a clean disposable DB and a representative copy of real project data.
- Complete an identity-provider integration using VACA's actual contract; remove local/demo auth assumptions from production paths.
- Prove tenant isolation with non-superuser PostgreSQL roles and RLS integration tests. Test every route for cross-tenant read/write leakage.
- Add rate limiting, request timeouts, body-size limits, idempotency keys, structured logging, secure secret rotation, CSRF/origin policy for cookie auth, CORS policy, abuse controls, and production security headers.
- Add encrypted object storage for contracts, deeds, photos, plans and evidence; never put raw sensitive documents in public JSON responses.
- Implement source rights and purpose gates at ingestion, query, display, export, API, cache, AI prompt and retention stages.
- Add a global event/outbox model so changes reliably propagate to VACAY/DREAMS/VULCAN and notifications without duplicate or lost handoffs.

### Highest value product/data improvements
- Canonical IDs for property, parcel, external listing, person, organization, project, job, source, observation, mandate, deal and transaction; explicit crosswalk tables and merge/split history.
- Bitemporal provenance: when a fact was true, when VDEX learned it, source publication/retrieval times, correction history and confidence.
- Data quality scoring with source authority, freshness, completeness, geographic precision, conflicts, and rights state; do not collapse these into one opaque score.
- Source health dashboard and scheduled connector jobs with retries, backoff, quotas, dead-letter queue, incremental sync, deletion/takedown propagation and run-level audit.
- Geospatial PostGIS query layer for parcel intersection, adjacency, buffers, flood/soil/wetland overlays and site assembly; do not infer parcel boundaries from geocoder points.
- Explainable matching across buyer, seller-authorized opportunity, developer, workforce and supplier needs; consent and rights checked at every handoff.
- Full-text + geospatial search, saved searches, alert rules and deduplicated event notifications.
- Import/export framework with mapping profiles, validation reports, quarantine, partial retry, duplicate resolution and rollback.

## 6. Integration contracts to build only after repository inspection

| System | VDEX responsibility | Must reuse / must not duplicate | State in 0.3.22 |
|---|---|---|---|
| VACAY | Shared listings/discovery, owner/seller workflow handoff, leads, inquiries, viewing/booking and transaction handoff | VACAY marketplace and existing APIs | Not connected |
| DREAMS Network | Approved distribution, discovery, project/community visibility and referrals | DREAMS network identity, distribution and permission model | Not connected |
| VULCAN | Tokenization eligibility package and approved tokenization request/status handoff | VULCAN token factory/chain/contract capabilities | Not connected |
| VACA | Individual/org identity and verification result | VACA identity and verification | Not connected |
| VASH | Authorized financial workflow orchestration | VASH financial system; do not create shadow finance | Not connected |
| VCoin | Settlement only if supported and legally approved | Existing VCoin rails and ledger | Not connected |
| VOKEN | Credential/trust proof where supported | Existing VOKEN services | Not connected |
| VACO/VACON | App launch, account context, approved AI/orchestration | Existing shell, identity context and AI services | Not connected |
| VOID | Optional cross-app discovery/referral where approved | VOID platform and consent model | Not connected |
| VEX | No direct trading product inside VDEX; only a separately approved referral boundary if needed | VEX brokerage/trading platform | Deliberately separate |

For every integration, Claude must first inspect the owning repository, API schema, auth scopes, event semantics, rate limits, idempotency, data owner, service-level expectations and test environment. Then implement a versioned adapter and contract tests. No endpoint names, payloads, credentials or capabilities may be invented.

## 7. Compliance boundaries to preserve

- Fair housing, anti-discrimination, accessibility, consumer protection and advertising review for listing/search/matching.
- State-by-state real estate brokerage, wholesaling, auction, referral, property management and licensing requirements.
- Privacy, data minimization, notice, consent, Do Not Call, email/SMS, opt-out, retention and consumer-reporting rules; do not use sensitive or restricted data for eligibility decisions.
- MLS/IDX/VOW and commercial provider license scopes, attribution, display, retention and redistribution restrictions.
- Securities, lending, crowdfunding, money transmission, custody, escrow, payment and tokenization rules. Donations/rewards, ownership interests, debt and securities must never share an ambiguous campaign flow.
- Employment classification, wage/hour, contractor licensing, insurance, background checks, credential verification and fair hiring.
- Human approval for offers, bids, contracts, hiring, financing, tokenization, public listing, legal notices and money movement.
- AI output must cite source records, disclose uncertainty and never be presented as legal title, appraisal, engineering, environmental clearance, zoning determination or professional advice.

## 8. Recommended Claude Code build order

1. **Repository reconciliation:** inspect the actual project and app registry; compare with this package; do not overwrite newer user work. Resolve naming/architecture conflicts first.
2. **Production foundation:** PostgreSQL/PostGIS runtime, migration and rollback, VACA auth, tenant isolation/RLS tests, secure secrets, request limits, rate limits, backups and observability.
3. **Canonical property/parcel graph:** stable IDs, parcel aliases, source listing crosswalks, geometry, conflict review, provenance and bitemporal history.
4. **National source coverage:** use the existing 56-jurisdiction scaffold to discover official sources; prioritize Missouri/St. Louis pilot then expand state by state. Track source access and rights honestly.
5. **Actual data adapters:** finish public APIs (Data.gov, EPA, FCC, FEMA, USDA, USGS, USFWS and relevant public parcel sources) with fixtures, live sandbox checks, run ledgers and terms review. Build MLS/auction/commercial integrations only with signed access.
6. **Acquisition workflows:** foreclosure/tax-sale/auction/REO, FSBO, wholesale and seller-authorized off-market lead workflows with jurisdiction-specific fields and legal gates.
7. **Participant graph:** buyer, seller, developer, investor, broker, lender, workforce, supplier and professional profiles, consented connections and explainable matching.
8. **Property/development intelligence:** parcel assembly, GIS overlays, zoning, utilities, environmental context, comps, underwriting and feasibility review.
9. **Dealroom and delivery:** offers, diligence, document rooms, closing milestones, project delivery, procurement, rentals and management.
10. **Ecosystem integrations:** VACAY, DREAMS, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and approved VOID touchpoints, one verified contract at a time.
11. **Production launch gate:** full UI/API/E2E/accessibility/security/load/restore tests, legal review, data licenses, incident runbooks, monitoring and staged rollout.

## 9. Definition of done for the Claude handoff

Claude must deliver a route/module inventory, integration matrix, database ERD, data-source coverage dashboard, security test report, test and build logs, deployment/runbook, unresolved blockers, and a list of external credentials/contracts needed from the owner. Mark each item `implemented and tested`, `implemented but not live-verified`, `cataloged only`, `blocked by access/legal`, or `not started`. No percentage-complete estimate without a traceable denominator.


## 0.3.24 addendum — ecosystem integration readiness
The application now has a contract-first registry for nine ecosystem services: VACAY, DREAMS Network, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and VOID. `GET /api/integrations` exposes each service's purpose, permitted capability scope, boundaries, required configuration fields and readiness status. This does not establish a connection, prove provider credentials, or authorize data sharing. All nine remain disconnected until the actual service contracts, approved secrets, adapter implementation and end-to-end tests exist. VEX remains outside VDEX.
