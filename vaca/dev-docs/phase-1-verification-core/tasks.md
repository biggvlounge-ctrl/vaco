# Tasks — Phase 1: Verification Core

- [x] Create `lib/store.js`: `createVacaStore()`.
- [x] Create `lib/verifications.js`: `VERIFICATION_STATUSES`,
      `AUTHENTICITY_GRADES`, `submitVerification`, `getVerification`,
      `listVerificationsForSubject`, `approveVerification`,
      `rejectVerification`, `getAuthenticityGrade`.
- [x] Wire `server.js`: 6 endpoints (`POST /api/verifications`,
      `GET /api/verifications/:id`,
      `GET /api/verifications/subject/:subjectType/:subjectId`,
      `POST /api/verifications/:id/approve`,
      `POST /api/verifications/:id/reject`,
      `GET /api/authenticity-grade/:subjectType/:subjectId`).
- [x] Wire VOKEN: `server.js`'s `POST /api/card/:id/value-score` now
      calls a real, injected `fetchAuthenticityGrade` (live HTTP to
      VACA) instead of trusting the request body; updated
      `lib/valueAlgorithm.js`'s and `server.js`'s own header comments
      to point at the real integration.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 23 checks): submission validation; the real
      authenticity-claim happy path; double-approval rejected;
      non-authenticity claims reject a supplied grade and approve
      cleanly without one; rejection requires a reason and rejects a
      second rejection attempt; per-subject listing/isolation; an
      unclaimed subject resolves honestly to null; a later claim
      correctly supersedes an earlier one.
- [x] Verify live with `vaca/server.js` (8804) and `voken/server.js`
      (8794) running independently: a real card's value-score computed
      before verification (grade C / authenticityScore 40); a real
      VACA verification submitted and approved with grade A; the same
      card's value-score recomputed live (grade A / authenticityScore
      100, `combinedRealValueScore` genuinely changed from 28.68 to
      34.98); a second, fresh card's value-score request with a lying
      `"authenticityGrade":"A"` in the body confirmed to still resolve
      to grade C — proving client input is genuinely ignored now.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Real reviewer/dashboard UI for working a verification queue. Wiring
VACA into VEX (VOKEN's own trading floor) and anywhere else in the
ecosystem "VACA-verified" is referenced but not yet backed by a real
call. A real identity-claim consumer (VACA's `identity` claim type
exists and is tested but nothing in the ecosystem calls it live yet —
VSAFE's own `idVerification.js` covers dating-safety identity checks
specifically; VACA's is for account/commerce authenticity, a genuinely
different real concern, still unconnected to any real caller).
