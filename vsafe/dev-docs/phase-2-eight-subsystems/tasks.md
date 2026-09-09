# Tasks — Phase 2: The Eight Undocumented Subsystems

- [x] Create `lib/idVerification.js`: `ID_DOCUMENT_TYPES`,
      `submitIdVerification`, `getIdVerification`, `isVerified`.
- [x] Create `lib/trustSignals.js`: `computeTrustScore`.
- [x] Create `lib/communicationControls.js`: `CALL_STATUSES`,
      `startAnonymousCall`, `endCall`, `getCallSession` (generalized,
      `sourceApp`-tagged version of CVNVO's earlier local copy).
- [x] Create `lib/privacyControls.js`: `PROFILE_VISIBILITY_OPTIONS`,
      `setPrivacySettings`, `getPrivacySettings`, `blockUser`,
      `unblockUser`, `isBlocked`.
- [x] Create `lib/aiMonitoring.js`: `screenContent`.
- [x] Create `lib/contentModeration.js`: `moderateContent`.
- [x] Create `lib/meetupVerification.js`: `requestMeetupVerification`,
      `getMeetupVerification`, `confirmMeetup`, `isBothConfirmed`.
- [x] Create `lib/relationshipSafety.js`: `CONCERN_TYPES`,
      `logSafetyConcern`, `getSafetyConcerns`.
- [x] Create `lib/securityFeatures.js`: `setSafetyWord`,
      `checkSafetyWord`.
- [x] Extend `createVsafeStore()` with `idVerifications`,
      `callSessions`/`nextCallSessionId`, `privacySettings`, `blocks`,
      `meetupVerifications`/`nextMeetupVerificationId`,
      `relationshipSafetyLogs`/`nextSafetyConcernId`, `safetyWords`.
- [x] Wire `server.js`: 22 new endpoints across all 8 modules.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 15 checks):
      - ID verification requires all three real steps; partial
        submission correctly not verified.
      - Trust score genuinely rewards verification/age, penalizes
        real incidents, stays bounded.
      - Communication Controls work with a real `sourceApp`, reject an
        invalid one, no phone number field anywhere.
      - Privacy Controls default to a real safe posture; block/unblock
        real and symmetric (checked from both directions).
      - AI Monitoring correctly tiers severity (medium for scam
        patterns, high for threat/self-harm language).
      - Content Moderation correctly flags harassment and sustained
        shouting, a distinct rule set from AI Monitoring.
      - Meetup Verification requires a real, existing check-in and
        real participants; `isBothConfirmed` proven genuinely derived
        (false after one confirmation, true after both).
      - Relationship Safety rejects self-concerns, uses real concern
        types, and is proven structurally private (the subject cannot
        see a concern logged about them).
      - The safety word is proven stored as a real hash (plaintext
        never appears anywhere in the store), and a genuine match is
        proven to escalate the user's real active check-in via the
        real `triggerEmergency` path — with a no-active-check-in case
        also confirmed to resolve cleanly (matched, not escalated).
- [x] Verify live with `vsafe/server.js` running alone: the full
      chain — ID verification → trust score → check-in created →
      safety word set → safety word triggered → check-in confirmed
      escalated — run end to end against the real running server;
      meetup verification's two-sided confirmation confirmed live;
      AI Monitoring vs. Content Moderation's distinct outputs
      confirmed live; the relationship-safety privacy check
      reconfirmed live.
- [x] Shut down the server cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Bug fixed during verification
`contentModeration.js`'s original shouting-detector used a single
regex requiring 10 *consecutive* uppercase letters with no spaces
(`/^[^a-z]*[A-Z]{10,}[^a-z]*$/`) — real sentences have spaces between
words, so this never actually matched real all-caps messages. Fixed
by replacing it with a real ratio calculation (uppercase letters ÷
total letters ≥ 90%, with a minimum letter-count floor), verified
against a real constructed shouting message.

## Next
Migrate CVNVO's own local `communicationControls.js`/`messageSafety.js`
copies to call into these real, shared VSAFE versions instead
(currently real, parallel duplicates — flagged, not silently left
duplicated forever). Wire ID verification and trust scores into
CVNVO's discovery stack (the doc's own "verified badge status...
should be a visible signal in the discovery stack" requirement).
