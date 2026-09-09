# Plan — Phase 3: concurrent-stream limit enforcement

## Goal
Close this project's own previously-flagged gap:
"`TIER_MAX_SIMULTANEOUS_STREAMS` is real and named, but no
stream-session/stream-end event exists anywhere in this codebase to
enforce it against." Part of a broader ecosystem sweep of small,
self-flagged gaps, confirmed with the user before starting.

## Real investigation before any code
Re-read `titles.js`'s own `watchTitle` (a single fire-and-forget watch
event, no duration/session concept) and `subscriptions.js`'s own
`TIER_MAX_SIMULTANEOUS_STREAMS` (informational only, named directly
against the gap). The real design question: does adding concurrency
enforcement mean changing `watchTitle` itself, or adding a real,
separate session-based action alongside it? Changing `watchTitle`
would break its own already-verified "single event, no session"
contract for callers who just want a watch-history entry, not an
open-ended session to remember to close. Chose the additive path.

## Design
A shared `assertCanWatch` helper is extracted from `watchTitle`'s own
checks (subscriber, streaming status, license validity) with no side
effects, so a new `startStream` can run the identical real checks
before deciding whether to log anything -- avoiding both duplicated
validation logic and a real correctness bug (logging a watch event for
a stream that then gets rejected for being over the concurrency
limit). `startStream` checks the caller's own active
`store.streamSessions` count against their real subscription tier's
`TIER_MAX_SIMULTANEOUS_STREAMS`, only then logs the watch event and
opens a real session. `endStream` closes a session, freeing the slot.
`watchTitle` itself is untouched in behavior -- it still never
touches `streamSessions` at all, matching its own already-verified
"zero-slot" watch-history-only contract.

## Explicitly NOT in this task
Time-based session auto-expiry (a real stream ends when a client
explicitly calls `endStream`, not on a timer -- no heartbeat/polling
infrastructure exists in this ecosystem to detect an abandoned
stream). Device-identity tracking (a "simultaneous stream" here is
counted per user, not per specific device, since no device-id concept
exists anywhere in this project).

## Verification approach
8 plain-Node checks across all three real tiers' limits (1/2/4),
slot-freeing on end, the no-spurious-watch-event-on-rejection
correctness fix, non-subscriber rejection parity with `watchTitle`,
double-end/unknown-session rejection, and a `watchTitle` regression
check. A live pass against the real running server and the real
standalone V3 (post ecosystem-cutover): a real `ad-supported` viewer's
first stream succeeding, a second correctly rejected naming their real
limit, and a new stream succeeding again after the first is ended.

## Done when
`TIER_MAX_SIMULTANEOUS_STREAMS` is genuinely enforced against real
stream sessions, and the README's own "Not yet built" list no longer
names this gap.
