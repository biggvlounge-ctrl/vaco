# Plan — Phase 7: All Eight Dating-Format Extensions

## Goal
Close CVNVO's largest remaining named gap: every dating-format
extension beyond core Gale-Shapley matching — Happn-style proximity +
BarBuddy, Speed Dating, Long-Distance Mode, Blind Date/AI-random
pairing, Group Dating, Gift Dating, the Snap Map-style social/event-
visibility layer, and Hunts Dates.

## Real investigation before any code
Read all four source docs in full before designing anything —
`CVNVO_ARCHITECTURE.md` (every real data model and API route named for
these formats), `CVNVO_CORE_FEATURES.md`, `CVNVO_BARBUDDY_FEATURE.md`,
and all 274 lines of `CVNVO_DATING_COMPARABLES.md` (the real research
grounding for every mechanic: Happn, Tinder's 2026 speed-dating pilot,
Bumble Travel, Coffee Meets Bagel, The Blinded/Ditto/Blind Match/Amata,
Snap Map, Facebook Events/Partiful, and the compliance flag against a
"sugar dating" feature). Checked two real claims directly rather than
trusting them: HVNTZ's own server has a real `GET /api/hunt/:huntId`
(so Hunts Dates gets real live validation) but no `GET /api/business/:id`
(so BarBuddy's `venueId` stays honestly caller-declared) — confirmed
by reading `hvntz/server.js` directly, not assumed either way.

## Design
- One real module per natural grouping, not eight separate ones:
  `speedDating.js` covers both Speed Dating and Group Dating since the
  architecture doc's own `SpeedDateSlot.participants` already real-
  supports both shapes; `dateEvents.js` covers Snap Map privacy,
  location-radius search, and Hunts Dates since they share the same
  real `DateEvent`/visibility concept.
- Every unscoped number is grounded in the doc's own cited real
  figures where one exists (Amata's real $20 token, Amata's real "two
  cancellations in a row," Happn's real 250m radius, the doc's own
  1-100 mile radius range, Tinder's real 3-minute pilot window) rather
  than invented from nothing.
- Two real, deliberate deviations from the literal architecture-doc
  schema, both flagged directly: `DateEvent.visibleAttendeeCount`
  becomes a real derived value instead of a stored field, matching
  VXLLAGE's own already-established "never a counter that could
  desync" principle; `BlindDateSession.aiAssignedMatchId` is a real
  `Match` id (not a bare candidate id) so photo-reveal gating can
  genuinely reuse `messages.js`'s own real conversation tracking.
- No fake AI anywhere: Blind Date's own "AI-driven interview" is not
  simulated — `assignBlindDate` reuses the real, deterministic,
  reliability-aware ranking `matching.js` already has, one candidate
  at a time, the same posture as MIA/DREA/every other named agent this
  session.
- Gift Dating is built exactly as `CVNVO_DATING_COMPARABLES.md`'s own
  compliance section recommends, specifically *in place of* a "sugar
  dating" feature it flags as real legal/App-Store risk — not a
  parallel feature alongside one.

## Explicitly NOT in this task
Real video/audio for "all-facetime" speed dates or BarBuddy's video
calling — no media pipeline exists anywhere in this ecosystem; a real,
unmodified `communicationControls.js` is the natural next step once a
matchId exists for a given pairing. BarBuddy's own live HVNTZ venue
validation — no lookup route exists there yet. A real, separate friend
graph for Snap Map's "My Friends" tier — an active Match substitutes.
Kevin/VPLAN, the VDP Dating Village, VSAFE's still-unbuilt features —
all separate, already-tracked gaps.

## Verification approach
Plain-Node pass (47 checks) across all six modules, covering every
real validation/rejection path and the two cross-cutting real
mechanics proven directly: the round-robin generator's own pairing
uniqueness, and the derived (not stored) attendee count. Live pass
with `vaca`, `venvs-mock-backend`, `hvntz`, and `cvnvo` all running
together: a real proximity crossing recorded and a too-far pair
rejected; a `DateEvent` linked to a real hunt created live on HVNTZ's
own server, with the real returned title (not echoed input) confirmed;
real VCoin movement confirmed via V3's own balances for both Gift
Dating and the Blind Date token; the message-count reveal gate proven
to flip from rejected to accepted after real messages were sent; all
three Snap Map privacy tiers proven live to correctly include/exclude
a real viewer; a real speed-date creation rejected live for an
unverified participant.

## Done when
- All eight named formats are real, tested, and the two genuine cross-
  app integrations (Hunts Dates' hunt validation, Gift Dating/Blind
  Date's VCoin movement) are live-verified against real, separate
  servers, not simulated.
- Every unscoped number is either grounded in a real cited figure or
  flagged directly as this project's own interpretive choice.
