# Plan — Phase 2 (second slice): Digital Waiting Room

## Goal
Section 11's real state flow for digital experiences: BOOKED ->
CONFIRMATION -> REMINDERS -> WAITING ROOM -> IDENTITY CHECK ->
EXPERIENCE -> EXIT. Build the three real, new states this session
hasn't already covered.

## Design
- BOOKED/CONFIRMATION already exist: a `Booking` with
  `status: 'confirmed'` (Phase 1). REMINDERS is Section 33's
  Notification System, a real, separate, not-yet-built Phase 2 slice
  -- not duplicated or faked here.
- `lib/digitalWaitingRoom.js`: a real `WaitingRoomSession` per booking,
  states `['waiting-room', 'identity-verified', 'admitted', 'exited']`,
  gated to `format: 'digital'` or `'hybrid'` bookings only -- a
  physical-only booking has no digital room, per Section 11's own
  scoping, and uses Phase 1's existing QR check-in flow directly.
- Real code reuse, not a second verification concept: `verifyIdentity`
  calls straight into `bookings.js`'s own real `checkIn()` using the
  same credential issued at booking time (Section 6) -- a digital
  identity check and a physical QR scan are the same real action
  (present the credential, verify it) through two different channels.
  This is what actually flips `Booking.status` to `'checked-in'`;
  `WaitingRoomSession.status` tracks only the additional digital-only
  states layered on top, not a duplicate of Booking's own lifecycle.

## Explicitly NOT in this task
- Section 33's Notification System (REMINDERS) -- a real, separate
  slice.
- Real video/audio/chat infrastructure for the waiting room itself
  (Section 11 also lists "video, audio, chat, moderation, Q&A" for
  premium digital rooms) -- this module is the real state machine
  only, not media/streaming infrastructure.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 18
checks): a physical-format booking rejected from the waiting room; the
real happy path through all four states; a duplicate waiting-room
session for the same booking rejected; a wrong credential rejected at
identity check with the underlying booking left untouched; the correct
credential accepted, proven to be a genuine call into the real
`checkIn()` (booking status and `checkedInAt` both actually changed,
not just the session's own status); admission blocked before identity
check; exit blocked before admission and blocked twice; a hybrid-
format booking also allowed in. Then a live pass: a real digital
experience booked, a real waiting room entered, a wrong credential
genuinely rejected via the real `checkIn()` error message, the correct
credential accepted and confirmed to flip the underlying booking to
`checked-in`, admission and exit both confirmed, and the experience's
real completion/settlement re-run afterward to confirm a booking that
went through the waiting room still settles correctly (host share +
platform fee summing exactly to the price, escrow returned to its
starting balance).

## Done when
- All four waiting-room states are real and correctly gated.
- The identity check is proven to be genuine reuse of `checkIn()`, not
  a parallel credential system.
- A booking that went through the waiting room still settles correctly
  at experience completion.
