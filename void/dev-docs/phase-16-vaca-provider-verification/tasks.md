# Tasks — Phase 16: real VACA provider-verification signal

- [x] Confirmed VACA's real `GET /api/identity-status/:subjectType/:subjectId`
      always returns 200 with `verified: false` for an unknown
      subject (never 404) -- so a live fetch failure only ever means
      "VACA unreachable," not "not yet verified."
- [x] Added `providerVerified: null` to the real job shape
      (`lib/marketplace.js`).
- [x] Added `VACA_API_URL` env var + `fetchProviderVerification` to
      `server.js`, failing soft (`null`) on any error.
- [x] Wired it into `POST /api/job/:id/match`, called once after the
      existing `matchProvider` succeeds, cached onto the job.
- [x] `node --check server.js` -- clean.
- [x] Live pass, all three real cases: unverified provider (`false`),
      a provider with a real VACA-approved identity verification
      (`true`), VACA's own process killed mid-test (`null`, match
      still succeeds).
- [x] Confirmed non-breaking: re-ran VDP's own `VoidView.jsx` demo
      match (`void-demo-provider`, never verified) and confirmed it
      still matches successfully.
- [x] Updated `README.md` (new Phase 16 section).

## Next
Nothing further planned for this specific piece. A real "require
verification for high-value verticals" gate is a plausible future
step but explicitly not built here -- this phase is the signal only.
