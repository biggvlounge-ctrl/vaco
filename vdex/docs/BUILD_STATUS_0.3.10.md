# VDEX 0.3.10 Build Status

## Delivered
- Authenticated `GET /api/seller-leads` lists only the current organization’s leads and never returns withdrawal-token hashes.
- `PATCH /api/seller-leads/:id/review` supports constrained states, bounded review notes, reviewer attribution, timestamps, and audit events.
- Required-auth public intake uses `VDEX_SELLER_INTAKE_ORG_ID`; without it, intake returns 503 and stores nothing.
- Cross-tenant list and review attempts return no records.
- Withdrawn consent cannot be restored by review; only `Closed` or `Not a fit` can follow withdrawal.
- Review states do not authorize outreach; contact must remain within active, purpose-limited consent.

## Verification
- `npm run check`: PASS
- `npm test`: 40 passed, 0 failed
- `npm run db:dry-run`: PASS (2 properties, 2 jobs, 0 orphan references; source preserved)

## Files changed
- `backend/server.js`
- `tests/auth-routes.test.js`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `docs/CLAUDE_CODE_HANDOFF.md`
- `docs/BUILD_STATUS_0.3.10.md`

## Limitations
The workflow is still backed by local JSON, not PostgreSQL. JWT verification is a local shared-secret foundation, not a connected identity provider. There is no outbound contact action, assignment routing, verified seller identity, or production retention/deletion service. Do not deploy publicly.
