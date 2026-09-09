# Tasks — Phase 2: Yap + First Date Safety

- [x] Create `lib/yap.js`: `YAP_FLAGS`, `submitYapReport`,
      `getYapReports`, `getYapSummary`.
- [x] Create `lib/firstDateSafety.js`: `DEFAULT_CHECKIN_WINDOW_MINUTES`,
      `CHECKIN_STATUSES`, `createSafetyCheckIn`, `getSafetyCheckIn`,
      `confirmSafe`, `checkForMissedCheckIns`, `getUserDateReliability`,
      `attachVoidRideData`.
- [x] Create `lib/communicationControls.js`: `CALL_STATUSES`,
      `startAnonymousCall`, `endCall`, `getCallSession`.
- [x] Create `lib/messageSafety.js`: `screenMessage`.
- [x] Extend `createCvnvoStore()` with `yapReports`/`nextYapReportId`,
      `safetyCheckIns`/`nextCheckInId`, `callSessions`/
      `nextCallSessionId`.
- [x] Wire `server.js`: 13 new endpoints, plus a real
      `fetchVoidJob()` helper making a genuine live HTTP call to
      VOID's `GET /api/job/:id` (`POST /api/yap/reports`,
      `GET /api/yap/reports/:subjectId`,
      `GET /api/yap/summary/:subjectId`,
      `POST`/`GET /api/safety/check-ins[/:id]`,
      `POST /api/safety/check-ins/:id/confirm-safe`,
      `POST /api/safety/check-missed`,
      `GET /api/safety/reliability/:userId`,
      `POST /api/safety/check-ins/:id/void-ride`,
      `POST /api/calls`, `POST /api/calls/:id/end`,
      `GET /api/calls/:id`, `POST /api/messages/screen`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 16 checks, all passed clean on first run):
      - `submitYapReport` rejects self-reporting and an invalid flag.
      - **The centerpiece**: three real red-flag reports submitted
        against a user with an active match leave
        `Match.compatibilityScore` byte-for-byte unchanged, checked
        directly before and after, not inferred.
      - `getYapReports`/`getYapSummary` return real, correct
        aggregates.
      - `createSafetyCheckIn` requires a real itinerary and at least
        one real trusted contact.
      - `confirmSafe` records real safety confirmation AND real
        match-quality feedback in one real action; rejects
        re-confirming and an out-of-range `dateRating`.
      - `checkForMissedCheckIns` real-escalates a check-in genuinely
        past its deadline, correctly ignores one still within window.
      - `getUserDateReliability` is real and honest — null with no
        data, correct once real dates confirm.
      - `attachVoidRideData` calls the real injected `voidFetchFn` and
        stores only VOID's real, current job fields (`driverId` from
        `providerId`, `voidJobStatus` from `status`) — no invented
        pickup/dropoff/live-location fields, since VOID's real job
        model doesn't have them yet; a real fetch failure surfaces as
        a real error, not a silent success.
      - `startAnonymousCall` creates a real session with no phone
        number field anywhere in its shape; rejects self-calling.
        `endCall` real-transitions status, rejects double-ending.
      - `screenMessage` flags real, concrete patterns (contact
        solicitation, phone-number-shaped content, external links,
        character flooding); requires a real string input.
- [x] Verify live with `cvnvo/server.js` running alongside VOID's own
      independently running `void/server.js`: a real match created; 2
      real red-flag Yap reports submitted with the match's
      `compatibilityScore` confirmed unchanged via live `GET`; a real
      VOID transportation job created and matched to a real driver on
      VOID's own server, then genuinely fetched cross-server by CVNVO
      via a live HTTP call — the real `driverId`/`voidJobStatus`
      confirmed attached to the check-in from VOID's actual live
      response; the combined confirm-safe/We-Met action and message
      screening both confirmed against the running server.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Addendum — Yap modeled directly on the real Tea app
The user confirmed Yap should be modeled on Tea, with an explicit,
confirmed decision to keep it **gender-neutral** (not Tea's actual
women-reviewing-men restriction, since nothing else in CVNVO's docs
suggests a gender-restricted design). Two of Tea's real mechanics were
added on top of the existing decoupled report system:

- [x] `submitYapReport` now requires the reporter to have a real
      profile AND a genuinely `verifiedBadge: true` status — Tea's
      actual anti-abuse mechanism (only verified users can post
      reviews at all), reusing CVNVO's own existing Phase 1
      `verifiedBadge` field rather than inventing a second
      verification concept.
- [x] `getSafetyLookup()` — a real, standalone "look before you leap"
      view (verification status + Yap summary in one call), explicitly
      NOT gated behind an existing match, matching Tea's real core use
      case of checking someone out before ever engaging with them.
- [x] Wired `GET /api/yap/lookup/:subjectId`.
- [x] Verified in plain Node (6 checks): an unverified reporter is
      rejected with the real Tea-model error message; a reporter with
      no profile at all is rejected; a verified reporter succeeds; the
      lookup works with no match required and has no gender field
      anywhere in its shape; the Yap-matching decoupling proof still
      holds with the new gate in place.
- [x] Verified live: an unverified reporter genuinely rejected, a
      verified one genuinely accepted, and a standalone lookup
      confirmed against the running server.
- [x] Committed as its own change.

## Next
Feeding `getUserDateReliability`'s real signal into `lib/matching.js`
for future match ranking; real notification delivery for safety
escalations; Yap's actual review/moderation workflow, once (if) that
spec becomes available.
