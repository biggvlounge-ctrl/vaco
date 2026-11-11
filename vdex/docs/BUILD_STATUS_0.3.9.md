# VDEX 0.3.9 Build Status

## Delivered
- Authenticated JSON API tenant filtering for properties, Property DNA, property sources/intelligence, buyer mandates/matches, watchlists, summary, audit reads, and employer job/application review.
- Server-assigned tenant IDs for new properties, jobs, buyer mandates, and watchlist records. Client-provided tenant IDs are ignored.
- Public job discovery limited to open jobs and omits internal tenant IDs. Public job applications inherit the owning job's tenant ID.
- Employer job/application review checks tenant ownership. Legacy unassigned records fail closed for authenticated organizations.
- Regression tests for cross-tenant property list/detail/DNA access and tenant-ID spoofing.

## Verification
- `npm run check`: PASS
- `npm test`: 40 passed, 0 failed
- `npm run db:dry-run`: PASS (2 properties, 2 jobs, 0 orphan references; source preserved)

## Limitations
- This is application-level filtering over local JSON, not production-grade database isolation.
- Seller lead intake routing requires `VDEX_SELLER_INTAKE_ORG_ID` in required-auth mode; requests are rejected with 503 if it is absent. Authenticated seller-lead review still needs implementation.
- PostgreSQL runtime adapter and actual RLS enforcement are not connected or tested against a live database.
- Existing unassigned records remain invisible to authenticated organizations until reviewed ownership mapping is provided.
- Do not expose publicly; JSON storage is not safe for concurrent production workloads.
