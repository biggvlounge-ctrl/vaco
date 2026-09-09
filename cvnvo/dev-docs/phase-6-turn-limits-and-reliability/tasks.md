# Tasks — Phase 6: Your Turn Limits + Reliability Wiring

- [x] Investigate: grep the whole codebase for existing message/
      conversation storage (found none — `messageSafety.js` was a
      pure, never-called-with-persistence scanner); read all three
      source docs' own exact "Your Turn Limits" wording.
- [x] `lib/messages.js` — `MAX_UNANSWERED_CONVERSATIONS`, `sendMessage`
      (real screening + turn tracking), `getMessagesForMatch`,
      `getUnansweredConversations`, `isUserOverTurnLimit`.
- [x] `lib/matching.js` — `createMatch` initializes
      `awaitingReplyFromUserId: null`; `computePreferenceList` scales
      by the real reliability multiplier; `runGaleShapley` filters out
      over-limit users from both candidate groups before building
      preference lists.
- [x] `lib/store.js` — `messages`/`nextMessageId`.
- [x] `server.js` — `POST /api/matches/:id/messages`,
      `GET /api/matches/:id/messages`,
      `GET /api/users/:userId/turn-limit-status`.
- [x] Verify in plain Node (24 checks, all clean): turn-tracking
      sequences, rejection cases, real screening still active,
      threshold hit/recovered exactly, `runGaleShapley`'s real
      exclusion proven directly against a still-matched eligible user,
      reliability ranking proven across three distinct real track
      records.
- [x] Verify live against `vaca/server.js` + `cvnvo/server.js` both
      running (profile creation genuinely requires VACA live —
      confirmed directly when it failed without it): real message
      turn-tracking confirmed via live `GET` in both directions; a
      real user stalled to exactly the threshold, confirmed over limit
      via a live status endpoint, then confirmed excluded from a real
      match-generation call that still matched a different eligible
      user.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (Run, Test, What's here, Verified, Not yet
      built).
- [x] Write this plan/tasks pair.

## Next
The eight named dating-format extensions (Happn/BarBuddy, Speed
Dating, Long-Distance Mode, Blind Date, Group Dating, Gift Dating,
Snap Map, Hunts Dates). VSAFE's own Photo Check-ins/Fake Call/Screen
Time (blocked on VSAFE's own side first). The VDP Dating Village.
