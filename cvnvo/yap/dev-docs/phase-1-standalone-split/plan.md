# Plan — Phase 1: Standalone Split

## Goal
Split Yap out of CVNVO into its own separate, standalone app (own
`package.json`, own store, own server/port), per explicit instruction
— the same real split just applied to CHOPZ/CHOPZ SHOP. Yap keeps its
existing real behavior (decoupled reports, verified-reporter gate,
standalone safety lookup) but no longer reads CVNVO's profile data
in-process.

## Design
- Move `cvnvo/lib/yap.js` to `yap/lib/yap.js`, `yap/lib/store.js` gets
  its own `yapReports`/`nextYapReportId` (removed from
  `cvnvo/lib/store.js`).
- The one real dependency Yap had on CVNVO — `getUserProfile` for the
  reporter's `verifiedBadge` (and, in the safety lookup, the subject's)
  — becomes an injected `profileFetchFn(userId)`, mirroring this
  session's established cross-app pattern (CVNVO's own
  `voidFetchFn`/`vsafeCreateFn`), just in the reverse direction since
  Yap is the side that doesn't own the data here. `yap/server.js`
  supplies the real implementation: a live HTTP call to CVNVO's own,
  already-existing `GET /api/profiles/:userId`.
- CVNVO's own `server.js` drops the local Yap require and its four
  `/api/yap/*` endpoints entirely — clients call Yap's own API
  directly now, the same "no proxy layer" precedent CHOPZ/CHOPZ SHOP
  established (CHOPZ's server never proxies to CHOPZ SHOP either).

## Explicitly NOT in this task
- Migrating the verified-reporter check onto VSAFE's own shared
  `idVerification.js`/`trustSignals.js` — a real, separate
  architectural question (two verification concepts now exist:
  CVNVO's local `verifiedBadge`, VSAFE's shared ID verification),
  flagged in the README, not resolved here.
- Any behavior change to Yap's actual rules (still: self-report
  rejected, invalid flag rejected, unverified reporter rejected,
  decoupled from matching).

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 9
checks, using a fake `profileFetchFn` over an in-memory profile map):
verified reporter accepted, unverified reporter rejected with the real
anti-abuse message, self-report rejected, a report against a subject
with no fetchable profile still succeeds (only the reporter's
verification is actually required), a reporter with no fetchable
profile rejected, summary counts correct, safety lookup combines live
data correctly, safety lookup requires the injected function. Then a
live pass: `yap/server.js` and `cvnvo/server.js` running independently
— a real verified CVNVO profile and a real unverified CVNVO profile
created, a real report submitted by the verified user and confirmed
accepted, the unverified user's own attempt confirmed genuinely
rejected (the rejection came from a live fetch back into CVNVO's real
profile store, not a local guess), the safety lookup confirmed
combining live data, and CVNVO's own remaining endpoints (compatibility
scoring) reconfirmed still working after Yap's removal from its
codebase.

## Done when
- Yap runs as its own process, its own port, with no import of CVNVO's
  code.
- The verified-reporter gate and safety lookup are proven live to
  genuinely depend on CVNVO's real, current profile data, not a cached
  or assumed copy.
- CVNVO itself still passes its own existing endpoints after Yap's
  removal.
