# VDEX Master Application Specification

## Identity

**VDEX — Vertical Vision Development Exchange**  
Proposed application slot: **App 22 (provisional; verify against the official parent-app register).**  
Technology development/ownership alignment: VEDA. Commercial alignment: VEGA. Real estate operations integration: VRG. Investment integrations: VIG and PPG as authorized. VEX stocks/trading remains separate from VDEX. VDEX is an independent app grouped with VACAY and VOID; it must integrate with VACAY for authorized listing/discovery and owner/seller workflow handoffs, attach to DREAMS Network, and use VULCAN for approved tokenization handoffs. Reuse VACO/VACON, VACA, VASH, VCoin and applicable VOKEN services through verified contracts; do not duplicate identity, finance, wallets, ledgers or token systems.

## Product mission

VDEX is a property acquisition, real estate marketplace, development intelligence, investment workflow, and workforce platform. It serves authorized internal Vertical Vision users and public marketplace participants through role-separated experiences.

## Product pillars

1. **Discover:** residential, multifamily, vacant land, commercial, industrial, churches, schools, institutional, hospitality and mixed-use property opportunities.
2. **Acquire:** foreclosure and auction leads, REO, owner-listed/FSBO, traditional listings, wholesale opportunities, off-market research leads, direct seller submissions and multi-parcel assemblages.
3. **Verify:** persistent Property DNA, source provenance, seller authority, listing status, title/lien diligence, zoning screening, environmental screening and data freshness.
4. **Evaluate:** comparable sales, preliminary valuation, condition, repair assumptions, development scenarios, financial underwriting, sensitivity analysis and opportunity scoring.
5. **Connect:** sellers, buyers, investors, developers, brokers, architects, engineers, contractors and service providers.
6. **Employ:** AI-proposed job assignments, workforce marketplace, professional profiles, qualifications, hiring workflows, deliverables and milestone approvals.
7. **Develop:** site concepts, permitting, procurement, construction, project management, leasing, property management and disposition.

## Core modules

- Property Exchange / Property DNA
- Listing Aggregation and Source Registry
- Foreclosure and Auction Discovery
- Off-Market Lead Research
- FSBO and Direct Seller Marketplace
- Wholesale Deal Exchange
- Seller Concierge and Seller Consent
- Buyer Mandates and Matching
- Parcel Assembly Intelligence
- Opportunity Radar and Property Watchtower
- GIS, Zoning, Environmental and Infrastructure Screening
- Development Simulator and Underwriting
- Investor / Developer Network
- Workforce Marketplace and Property Bounty
- Dealroom, Offers and Due Diligence
- Construction Procurement and Project Delivery
- Rental, Leasing, Property Management and Disposition
- Market Memory, Data Quality and Community Impact
- Admin, Compliance, Audit and Analytics

## Property DNA

Every property should have a stable internal identity and one or more parcel identities. External listings must be attached to the underlying property/parcel record, not treated as separate properties by default. Preserve source, retrieval time, license/usage restrictions, confidence, verification state, and version history. Parcel assemblies group individual parcels while retaining each parcel's owner, title, restrictions and acquisition status.

## Seller and buyer workflows

A potential seller lead is not a verified listing. Record source and lawful contact basis, seller consent, identity/authority checks, contact preferences, opt-outs and status. Buyer mandates include geography, property types, budget, acreage, use, condition and timing. Match explanations must show why a candidate matched and which facts are unverified.

## Workforce

Support gig assignments, temporary work, contracts, B2B professional services, part-time/full-time roles, internships and apprenticeships. Jobs may be created manually or proposed by AI from project needs, but require employer approval before publication. Track scope, skills, licenses, insurance where applicable, compensation, deliverables, deadlines, applicant decisions, assignment milestones, disputes and payment status. Worker classification and regulated compensation must be reviewed under applicable law.

## AI governance

AI agents may discover, summarize, compare, draft, score and recommend. They must cite sources, show confidence, identify missing data, and distinguish verified facts from estimates and inferences. Human approval is required for hiring, offers, contracts, bids, financing commitments, money movement, regulated advice and legally binding actions. Automated zoning interpretation is not an official determination; environmental screening is not a clearance; automated value estimates are not appraisals.

## Suggested AI agents

Master Orchestrator; Property Scout; Listing Verification; Owner Research; Foreclosure Scout; Off-Market Scout; Seller Concierge; Parcel Assembly; GIS/Site Analyst; Zoning Analyst; Environmental Screening; Utility/Infrastructure Analyst; Market Analyst; Financial Analyst; Concept Designer; Buyer Matcher; Developer Matcher; Investor Matcher; Workforce Scout; Job Creation; Credential Verification; Deliverable Review; Deal Coordinator; Construction Analyst; Compliance Monitor; Data Quality; Market Memory.

## Technical architecture

Start with a modular Node.js backend and responsive web frontend, mapped to existing VEDA conventions after repository audit. Production data layer should use PostgreSQL/PostGIS, object storage, search index, background queue, audit/event history, analytics and observability. The current local MVP uses Node's built-in HTTP server and JSON file storage only. Do not scale that storage pattern into production.

## Security and compliance requirements

- Authentication, role-based access and tenant isolation.
- Public/internal separation and least-privilege permissions.
- Encryption in transit and at rest; secure secrets; backups and retention controls.
- Rate limiting, abuse prevention, input validation and security logging.
- Data licensing and redistribution rights for listing/property providers.
- Respect MLS rules and provider terms; do not scrape restricted sources.
- Comply with privacy, consent, Do Not Call, email/text, consumer reporting and applicable data-protection rules.
- Real estate brokerage, auction, referral, securities placement, lending, escrow, custody and payment activity require legal review and properly licensed partners where applicable.
- Verify professional licenses and insurance when legally or contractually required.
- Provide correction, dispute, opt-out and data deletion workflows where required.

## Local MVP status — v0.2.0

Working: frontend shell; property create/search/filter; preliminary opportunity screening; workforce job create/search; seller inquiry with explicit consent; buyer mandate create/list; manual property watchlist; audit events; health/summary APIs; local JSON persistence.

Not yet implemented: production authentication, tenant isolation, external data feeds, MLS integration, live foreclosure data, skip tracing, title search, live GIS, AI model calls, automated watch monitoring, payments, escrow, e-signatures, real-time notifications, production database, or production deployment.

## Build phases

0. Audit VEDA/VACO repositories, app registry, shared services, data licensing and compliance.
1. Production foundation: auth, organizations, roles, PostgreSQL/PostGIS, Property DNA, source registry, search and maps.
2. Acquisition: listings, foreclosures, auctions, FSBO, wholesale, off-market and seller concierge.
3. Intelligence: verification, parcel assembly, zoning/environment/infrastructure, Watchtower, opportunity scoring.
4. Workforce: profiles, job creation, applications, credentials, deliverables and payment-provider integration.
5. Development: concepts, feasibility, underwriting, buyer/investor/developer matching.
6. Transactions: offers, dealrooms, diligence, approvals, closing milestones.
7. Delivery: procurement, construction, leasing, property management and disposition.
8. Scale: regional/national sources, analytics, market memory and public marketplace operations.

## Definition of production readiness

No production-ready claim until authentication and tenant isolation, licensed integrations, data provenance, privacy and compliance controls, backups, monitoring, security review, migration strategy, API tests, frontend tests, end-to-end tests and operational runbooks are complete.
