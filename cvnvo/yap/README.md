# Yap

CVNVO's decoupled dating-safety report app, modeled directly on the
real Tea app. A separate, standalone app from CVNVO itself, per
explicit instruction — the same real split just applied to CHOPZ/
CHOPZ SHOP. Yap never imports CVNVO's own matching or profile code and
keeps no local copy of profile data; where it genuinely needs CVNVO's
real data (a reporter's verification status for the anti-abuse gate, a
subject's verification status for the safety lookup), it fetches it
live over HTTP from CVNVO's own already-existing `GET /api/profiles/:userId`.

Source docs: `../CVNVO_ARCHITECTURE.md`, `../CVNVO_CORE_FEATURES.md`.

**Decoupling is architectural, not just intentional**: no code path
anywhere in this app touches a compatibility score or a match — Yap's
reports genuinely cannot silently affect CVNVO's matching, by
construction, not just by convention.

**Gender-neutral by confirmed decision**: models two of Tea's real,
load-bearing mechanics — the verified-reporter requirement, and a
standalone pre-match safety lookup — but not Tea's actual women-
reviewing-men restriction, since nothing else in CVNVO's docs suggests
a gender-restricted design.

## Run
```
cd cvnvo/yap && npm install && npm start   # localhost:8802
# Needs CVNVO (localhost:8798) running too -- Yap calls back into its
# real profile API for verification checks.
```

## Test
```
curl http://localhost:8802/api/health
curl -X POST http://localhost:8802/yap/reports -H "Content-Type: application/json" -d '{
  "subjectId":"user-b","reporterId":"user-a","flag":"red","details":"..."
}'
```

## What's here
- `lib/yap.js` — `YAP_FLAGS`, `submitYapReport` (requires a real,
  live-verified reporter — rejects self-reports, invalid flags, and
  any reporter whose real CVNVO profile isn't verified), `getYapReports`,
  `getYapSummary` (a real, honest count-only aggregate, no automated
  action taken on it), `getSafetyLookup` (the real, standalone Tea-
  style lookup — works before any match exists, combining a live-
  fetched verification badge with the real Yap summary).
- `lib/moderation.js` — **the real moderation queue, dispute path, and
  takedown**, not documented in this file until now (added
  13 Nov 2026; the code itself predates this entry). Closes three of
  the four gaps `YAP_REVIEW_PLATFORM_COMPARABLES.md` named as
  "Not built" (dispute/appeal flow, removal process, identity
  verification of reviewers — the fourth, fraud/brigading resistance,
  is partially closed: see below). `listModerationQueue`/`queueDepth`
  give a moderator a real, oldest-first pending+disputed backlog;
  `publishReport`/`rejectReport` require a real `moderatorId` and
  (for rejection) a real reason — there is no automatic publication
  anywhere, no timer, no keyword classifier; `disputeYapReport` lets
  only the report's real subject contest it, which re-queues the
  report (still visible, dispute attached) rather than hiding it;
  `removeReport` takes a published report down for good, marked
  removed rather than deleted so the moderation record survives; and
  `detectBrigading` flags a subject hit by 3+ distinct reporters
  inside a 24-hour window for human review only — it takes no
  automatic action, so brigading/fraud resistance is a real detection
  signal, not full resistance. All four moderation routes
  (`GET /yap/moderation/queue`, `POST .../:id/publish`,
  `POST .../:id/reject`, `POST .../:id/remove`,
  `GET .../brigading`) are gated behind a real `yap:moderate` operator
  scope (`requireOperator`, this app's own `lib/operatorAuth.cjs`), and
  publish/reject/remove each page ops via `vaco-notify` — a real,
  separate gap from notifying the reporter/subject themselves, which
  this app still has no inbox feature for.
- `server.js` — a real Express API (CommonJS) with a real injected
  `fetchCvnvoProfile` cross-app call, mirroring CVNVO's own
  `voidFetchFn`/`vsafeCreateFn` pattern in the reverse direction.

## Verified
9 plain-Node checks (verified reporter accepted, unverified reporter
rejected with the real anti-abuse message, self-report rejected, a
report against a subject with no fetchable profile still succeeds
since only the reporter's verification is required, a reporter with no
fetchable profile rejected, summary counts, safety lookup combining
live data) plus a live pass: `yap/server.js` and `cvnvo/server.js`
running independently — a real verified CVNVO profile and a real
unverified CVNVO profile created, a real report submitted by the
verified user and confirmed accepted, the unverified user's own report
attempt confirmed genuinely rejected (the rejection came from a live
fetch back into CVNVO's real profile store, not a local guess), and
the safety lookup confirmed combining the subject's live `verifiedBadge`
with the real report summary. CVNVO's own remaining endpoints
(compatibility scoring) reconfirmed still working after Yap's removal
from its codebase. See `dev-docs/` for the full record.

**Corrected 13 Nov 2026**: "9 plain-Node checks" describes only this
app's original Phase 1 split and is long stale — it was already stale
even in the single commit that added `moderation.test.js`/`yap.test.js`
at their current size. Counted directly: `test/yap.test.js` (20),
`test/server.test.js` (6), `test/moderation.test.js` (16) — 42 tests
total, all passing (`node --test test/*.test.js`), covering the Tea-
model reporting additions and the full moderation queue/dispute/
takedown/brigading-detection surface above, none of which this
original count could have included.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8802) — YAP's own real state now survives a
restart. Live-verified: submitted a real YAP safety report, killed the
running process, restarted it, and confirmed the same real state came back
from a real GET. See `dev-docs/phase-2-real-persistence/`.

## Real signal surfaced on CVNVO's own discovery stack (Phase 3)
Closed. `../server.js`'s own `GET /api/profiles/:userId` now makes a
real, live fetch to this app's `GET /yap/summary/:subjectId` and
merges the result in as `yapSignal` — a real safety signal visible on
the exact profile read CVNVO's own discovery/matching flow already
uses, not a separate call a caller needs to know to make. See
`../README.md`'s own Phase 12 entry and
`../dev-docs/phase-12-yap-signal-on-profile/` for the live-verified
detail (zero-report, real-report, and Yap-unreachable cases).

## Not yet built
- Migrating the verified-reporter check onto VSAFE's own shared
  `idVerification.js`/`trustSignals.js` instead of CVNVO's local
  `verifiedBadge` field — a real, later architectural question (two
  real verification concepts now exist in the ecosystem), flagged
  directly, not silently resolved here.
