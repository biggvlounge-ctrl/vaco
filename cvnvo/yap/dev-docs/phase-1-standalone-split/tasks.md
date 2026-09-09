# Tasks — Phase 1: Standalone Split

- [x] Create `yap/lib/store.js`: `createYapStore()` (`yapReports`/
      `nextYapReportId` only).
- [x] Move `cvnvo/lib/yap.js` to `yap/lib/yap.js`; replace the local
      `getUserProfile` import with an injected `profileFetchFn(userId)`
      in `submitYapReport` and `getSafetyLookup`.
- [x] Create `yap/server.js`: real Express API (port 8802), real
      injected `fetchCvnvoProfile` (live HTTP call to CVNVO's own
      `GET /api/profiles/:userId`), 4 endpoints (`/yap/reports`,
      `/yap/reports/:subjectId`, `/yap/summary/:subjectId`,
      `/yap/lookup/:subjectId`).
- [x] Remove Yap from CVNVO: deleted `cvnvo/lib/yap.js`, removed
      `yapReports`/`nextYapReportId` from `cvnvo/lib/store.js`, removed
      the `lib/yap` require and all four `/api/yap/*` endpoints from
      `cvnvo/server.js`, removed `yapFlags` from its health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 9 checks): verified reporter accepted; unverified
      reporter rejected with the real anti-abuse message; self-report
      rejected; a report against a subject with no fetchable profile
      still succeeds (only the reporter's verification is required); a
      reporter with no fetchable profile rejected; summary counts
      correct; safety lookup combines live data; safety lookup
      requires the injected function.
- [x] Verify live with `yap/server.js` (8802) and `cvnvo/server.js`
      (8798) running independently:
      - A real verified CVNVO profile and a real unverified CVNVO
        profile created.
      - A real report submitted by the verified user, confirmed
        accepted.
      - The unverified user's own report attempt confirmed genuinely
        rejected — the rejection came from Yap's live fetch back into
        CVNVO's real profile store, not a local guess.
      - The safety lookup confirmed combining the subject's live
        `verifiedBadge` with the real report summary.
      - CVNVO's own remaining endpoint (compatibility scoring)
        reconfirmed still working after Yap's removal from its
        codebase.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Migrate the verified-reporter check onto VSAFE's own shared
`idVerification.js`/`trustSignals.js` instead of CVNVO's local
`verifiedBadge` field (a real, later architectural question — two
verification concepts now exist in the ecosystem, flagged not
resolved). Surface verification/Yap signals visibly in CVNVO's
discovery stack (VSAFE's own Phase 2 "Next" note).
