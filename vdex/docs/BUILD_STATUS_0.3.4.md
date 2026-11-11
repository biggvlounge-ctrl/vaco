# VDEX Build Status — 0.3.4

## Completed this increment
- Added purpose-limited seller inquiry consent language and a new consent notice version.
- Added one-time random withdrawal tokens; only SHA-256 hashes are persisted.
- Added explicit consent withdrawal endpoint with token validation, confirmation, timestamp, contact-prohibited state, and audit event.
- Added negative-path tests for invalid token, missing confirmation, and repeat withdrawal.

## Verification
- `npm run check`: PASS.
- `npm test`: PASS, 30 tests, 0 failures.

## Important limits
- Token possession is not verified identity. This local prototype has no authentication, tenancy, or production-grade access control.
- JSON persistence is local/single-process only.
- No MLS, foreclosure, auction, assessor, title, GIS, payment, escrow, or external identity integration is connected.
- Consent language and retention/deletion rules require legal/privacy review before production.

## Next build priority
Implement the storage abstraction and PostgreSQL/PostGIS migration plan, then authentication and tenant authorization before external exposure. Keep seller-consent lifecycle linked to the authenticated identity/contact verification layer.
