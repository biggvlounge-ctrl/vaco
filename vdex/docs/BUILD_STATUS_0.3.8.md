# VDEX Build Status 0.3.8

## Completed
- HS256 JWT access-token verification with timing-safe signature comparison.
- Required expiration, active membership, issuer/audience validation, strict role claims, and 32-byte minimum signing secret.
- Opt-in `VDEX_AUTH_MODE=required` API authentication and route-level permission enforcement.
- Public routes explicitly limited to health, job discovery/application, and bearer-token consent withdrawal intake; private data routes require authorization in required mode.
- Authenticated principal inspection at `GET /api/auth/session`.
- Employer application review listing and audited status transitions with `workforce:manage` permission.
- Review statuses limited to Reviewing, Shortlisted, On hold, and Not selected. No offer, hiring, or assignment action is automated.
- Added unit and API integration coverage for JWT validation, missing auth, insufficient permissions, valid access, and application review.

## Verification
- `npm run check` — passed.
- `npm test` — 40 tests passed, 0 failed.
- `npm run db:dry-run` — pending final package verification.

## Critical limitations
- No external identity provider is connected; a trusted issuer must mint signed tokens using the configured secret and exact claims.
- `VDEX_AUTH_MODE=required` protects routes but does not yet filter JSON records by organization. Do not expose the JSON API publicly or describe this as tenant isolation.
- Public job discovery/application and consent withdrawal endpoints need rate limiting, abuse controls, and a privacy/legal review before public exposure.
- PostgreSQL/PostGIS schemas are prepared but not connected or applied. RLS requires per-transaction server-side membership validation and tenant context.
- Existing legacy records remain unassigned to organizations.

## Next required build sequence
1. Implement a tenant-aware repository/storage adapter and prove cross-organization read/write isolation with integration tests.
2. Connect a trusted identity provider and server-side organization membership resolution; do not trust arbitrary client-supplied organization or role headers.
3. Activate PostgreSQL/PostGIS, apply migrations, and test RLS under a restricted non-BYPASSRLS application role.
4. Add rate limiting, request correlation, secure CORS/CSRF policy, secret rotation, and operational monitoring.
5. Add employer review UI and worker status notifications only after authorization and tenancy are enforced.
