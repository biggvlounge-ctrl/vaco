# VDEX Build Status 0.3.7

## Completed
- Organization identity schema: external identity subject, user status, normalized email, memberships, role constraints, and hashed invitation tokens.
- Tenant ownership columns and indexes for property, source, job, application, seller, buyer, watchlist, property record, and audit tables.
- Fail-closed PostgreSQL RLS policies driven by transaction-local tenant/user context.
- Least-privilege authorization policy module and unit tests for invalid principals, role permissions, and tenant predicates.
- Health endpoint version corrected to 0.3.7.

## Verification
- `npm run check`
- `npm test`
- `npm run db:dry-run`

## Not completed / blockers
- No live PostgreSQL/PostGIS connection was provided; migration 002 has not been applied to a database.
- No identity provider, login/session flow, API authorization middleware, or authenticated organization selection is connected.
- Existing JSON data remains unassigned to organizations.
- Cross-tenant RLS behavior still requires integration tests using a non-BYPASSRLS application database role.

## Required activation sequence
1. Provision PostgreSQL with PostGIS and a restricted application role.
2. Apply migration 001, then migration 002.
3. Connect a trusted identity provider and validate external subject plus active organization membership.
4. In every transaction, set `vdex.user_id` and `vdex.tenant_id` with `SET LOCAL` only after server-side membership validation.
5. Add tenant ownership mapping and review every legacy record before assignment.
6. Test tenant A cannot read/write tenant B data, missing tenant context returns no rows, and role escalation is rejected.
7. Only then enable protected API routes and production deployment controls.
