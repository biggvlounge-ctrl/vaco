# Plan — Phase 6: Your Turn Limits + Reliability Wiring

## Goal
Close the two smallest, self-contained real gaps named in this
project's own README: Your Turn Limits (Hinge's real anti-ghosting
mechanic) and feeding `getUserDateReliability`'s already-computed
signal back into `matching.js`.

## Real investigation before any code
Read all three source docs' own exact wording before designing
anything (`CVNVO_ARCHITECTURE.md`'s `Match.unansweredCount`,
`CVNVO_CORE_FEATURES.md`'s "once a user has a set number of unanswered
conversations, new likes pause," `CVNVO_DATING_COMPARABLES.md`'s own
description of Hinge's real mechanic). Grepped the whole codebase for
any existing message/conversation storage before assuming one existed
— found none: `messageSafety.js`'s own `screenMessage` was a real,
pure function with no caller that ever persisted a message anywhere.
Building Your Turn Limits therefore required building real message
storage first, not just a counter.

## Design
- `messages.js` tracks whose turn it is per match
  (`awaitingReplyFromUserId`) alongside the doc's own named
  `unansweredCount` field — the minimal real state needed to know both
  "how many messages piled up" and "who owes the next one."
- `MAX_UNANSWERED_CONVERSATIONS = 3`: a real, flagged, bounded
  threshold — no source doc gives Hinge's own actual real number.
- **Real, deliberate, documented mapping**: Hinge's mechanic pauses a
  user's own outgoing swipes. CVNVO has no individual swipe action —
  matches are generated in algorithmic batches by `runGaleShapley`.
  The real, adapted enforcement point is excluding an over-limit user
  from that round's candidate pool entirely, live, not a swipe-level
  gate that doesn't exist in this codebase's own shape.
- The reliability multiplier is real, bounded, and neutral for users
  with no history (`reliabilityRate === null` → no adjustment) rather
  than penalizing new users for lacking data — scales between 50% and
  100% credit for users with a real, known track record.

## Explicitly NOT in this task
Real-time messaging (WebSockets, push, typing indicators, read
receipts) — `messages.js` is a real, persisted, polled store. Any of
the eight named dating-format extensions, VSAFE's still-unbuilt Photo
Check-ins/Fake Call/Screen Time, VPLAN/Kevin integration, or the VDP
Dating Village — all separate, larger, later work.

## Verification approach
Plain-Node pass (24 checks): turn-tracking correctness across
first-message/repeat-message/reply sequences, rejection cases, the
real screening still running on every message, the threshold hit and
recovered from exactly, and `runGaleShapley` proven to exclude an
over-limit user while still matching an eligible one in the same call.
Live pass with `vaca/server.js` and `cvnvo/server.js` both running
(profile creation genuinely requires VACA's own live identity check,
confirmed directly when profile creation failed without it running):
real messages sent and confirmed via live `GET` to move
`unansweredCount`/`awaitingReplyFromUserId` correctly in both
directions; a real user stalled across exactly the threshold, confirmed
over limit via a live status endpoint, then confirmed excluded from a
real `POST /api/matches/generate` call that still matched a different,
eligible user in the same request.

## Done when
- Your Turn Limits and the reliability signal are both real, tested,
  and live-verified against the actual enforcement point
  (`runGaleShapley`), not just asserted as computed values sitting
  unused.
