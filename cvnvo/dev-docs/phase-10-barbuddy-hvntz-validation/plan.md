# Plan — Phase 10: BarBuddy's live HVNTZ venue validation

## Goal
Close CVNVO's own long-flagged BarBuddy gap: `venueId` was real but
caller-declared, never live-validated against HVNTZ, because HVNTZ had
no lookup route to validate against. HVNTZ's own Phase 6 added
`GET /api/business/:id` specifically to unblock this.

## Real investigation before any code
Re-checked the flagged claim directly rather than trusting the old
README wording still held: HVNTZ's own `server.js` now has a real
`GET /api/business/:id` route (confirmed by reading it, not assumed
from the phase number alone).

Checked what else uses `checkInAtVenue` before changing its signature:
VDP's own Dating Village (`vdp/src/lib/datingVillage.js`) calls this
exact function via CVNVO's own `/api/barbuddy/check-in` route, using a
real, fixed, synthetic `venueId` (`vdp-dating-village`) that is never
an actual HVNTZ business id. Making validation the default would have
broken that already-live, already-verified integration — a real
constraint that ruled out the obvious "just always validate" design.

## Design
`checkInAtVenue` gains `verifyAgainstHvntz` (default `false`) and an
injected `hvntzFetchFn`. Validation only runs when explicitly
requested, so VDP's own call (which never sets the flag) is completely
unaffected. On a genuine real-world check-in that opts in, the venue's
real HVNTZ business name is fetched once, cached on the venue record
(`hvntzVerified`/`hvntzBusinessName`), and never re-fetched on a
later check-in at the same venue — matching the same "store the real
response, not just re-validate every time" posture `linkHuntToDateEvent`
already established for Hunts Dates.

## Explicitly NOT in this task
Making validation mandatory. Any change to VDP's own Dating Village
code — it needed nothing, by design.

## Verification approach
6 plain-Node checks (unverified synthetic-venue check-in unaffected,
verified check-in succeeds, the fetch is cached not repeated, an
unknown business is rejected, a missing fetch function is rejected). A
live pass with `venvs-mock-backend`, `hvntz`, and `cvnvo` all running:
a real HVNTZ business registered, an unverified check-in against
`vdp-dating-village` confirmed unaffected, a verified check-in against
the real business confirmed succeeding, a verified check-in against a
nonexistent business confirmed rejected with HVNTZ's own real error
message propagated.

## Done when
BarBuddy can genuinely validate a real-world venue against HVNTZ when
asked to, without breaking the synthetic-venue case VDP's Dating
Village already depends on.
