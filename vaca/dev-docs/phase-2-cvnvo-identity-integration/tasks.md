# Tasks — Phase 2: CVNVO Identity Integration

- [x] Add `isIdentityVerified(store, subjectType, subjectId)` to
      `lib/verifications.js`.
- [x] Add `GET /api/identity-status/:subjectType/:subjectId` to
      `server.js`.
- [x] Verify in plain Node (8 checks): unclaimed → false, pending →
      false, approved → true, identity claim rejects a supplied grade,
      rejected claim → false, no cross-`subjectType` leak,
      `getAuthenticityGrade` unaffected by a co-located identity claim.
- [x] Wire `cvnvo/server.js`: `VACA_API_URL`, `fetchIdentityStatus`,
      `POST /api/profiles` overrides client `verifiedBadge` with
      VACA's real answer.
- [x] Verify live: VACA + CVNVO running independently — lying
      `verifiedBadge: true` on an unclaimed user → `false`; after a
      real approved VACA claim, lying `verifiedBadge: false` → `true`.
- [x] Shut down both test servers; confirmed ports clear.
- [x] Update `vaca/README.md` and `cvnvo/README.md`.
