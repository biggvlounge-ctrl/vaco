# Plan — real caller authorization on casino session stakes

## Goal
Same `optionalOwnAccount(bodyField)` pattern as V3/VOKEN, applied to
VAGO's own `POST /api/casino/sessions` — the one route that actually
stakes real VCoin via `transferVCoin`.

## Design
`lib/shieldAuth.js`; `optionalOwnAccount('userId')` on
`/api/casino/sessions`. No Authorization header -> unchanged
passthrough; a header present must match the session's real userId to
`userId` in the body, or 403.

## Verification approach
Live: an unauthenticated call and an authenticated call using the
staking user's own real Shield session both reached real business
logic unchanged (both failed identically on a real, pre-existing,
unrelated validation error — missing `gameType` in the test payload —
confirming the auth layer let both through correctly). A second real
Shield session attempting to stake as a different `userId` was
rejected 403 before reaching business logic at all.

## Done when
Casino stake sessions reject impersonation from a real, differently-
owned Shield session, with zero change to any existing unauthenticated
caller's behavior.
