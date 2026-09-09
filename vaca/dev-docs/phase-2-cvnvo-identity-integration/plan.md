# Plan — Phase 2: CVNVO Identity Integration

## Goal
Give VACA's `identity` claim type its first real caller. It existed
since Phase 1, fully tested, but nothing in the ecosystem actually
called it — flagged honestly as a gap in Phase 1's own README. CVNVO's
`lib/profiles.js` already has a `verifiedBadge` boolean field with
exactly the same "trusted client input" problem VOKEN's
`authenticityGrade` had before VACA closed that gap — a real,
pre-existing, natural fit, not a forced integration.

## Design
- `isIdentityVerified(store, subjectType, subjectId)` — the identity
  counterpart to `getAuthenticityGrade`, same shape, but resolves to a
  plain boolean since identity claims don't carry a grade (see the
  design note already at the top of `lib/verifications.js`).
- New route: `GET /api/identity-status/:subjectType/:subjectId`.
- CVNVO's `POST /api/profiles` becomes async, calls VACA live via a
  new injected `fetchIdentityStatus(userId)`, and overrides whatever
  `verifiedBadge` the client sent with VACA's real answer before
  calling `createUserProfile` — `lib/profiles.js` itself is untouched,
  the override lives in `server.js`, matching the exact layering
  VOKEN's own fix already used.
- `subjectType` is `'cvnvo-user'` — VACA's claim namespace scopes by
  subject type, so this doesn't collide with `voken-card`.

## Verification approach
Plain-Node pass on `isIdentityVerified` (8 checks): unclaimed → false,
pending → false, approved → true, an identity claim rejecting a
supplied grade at approval (mirrors `approveVerification`'s existing
authenticity-only grade rule), a rejected claim → false, no cross-leak
across `subjectType` namespaces, `getAuthenticityGrade` unaffected by
an identity claim on the same subject. Then a live pass: VACA and
CVNVO running independently — a lying `verifiedBadge: true` for an
unclaimed user comes back `false`; after a real VACA identity claim is
submitted and approved for a different user, a lying
`verifiedBadge: false` comes back `true`.

## Done when
- `isIdentityVerified` exists, is tested, and is exposed over HTTP.
- CVNVO's own `verifiedBadge` is genuinely VACA-backed, not
  client-trusted, verified live in both override directions.
