# Plan — Phase 5: VACA Identity Integration

## Goal
`lib/profiles.js`'s `verifiedBadge` was a plain client-supplied
boolean — the same "trusted client input" gap VOKEN's own
`authenticityGrade` had before VACA closed it. Give VACA's `identity`
claim type its first real caller here.

## Design
`server.js`'s `POST /api/profiles` now calls VACA live
(`fetchIdentityStatus`, `GET /api/identity-status/cvnvo-user/:userId`)
and overrides whatever `verifiedBadge` the client sent with VACA's
real, reviewed answer before calling `createUserProfile`.
`lib/profiles.js` is untouched — the override lives in `server.js`.
Full design/verification detail lives in
`../../vaca/dev-docs/phase-2-cvnvo-identity-integration/` since the
bulk of the new logic (`isIdentityVerified`, the new route) is VACA's,
not CVNVO's.

## Done when
CVNVO's `verifiedBadge` is genuinely VACA-backed in both override
directions, verified live.
