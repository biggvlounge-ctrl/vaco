# Plan — Phase 13: real HVNTZ Affiliate Network verification

## Goal
Close a real, long-flagged gap: `externalIntegration.js`'s own header
comment admitted `isHvntzOnboarded` was "caller-declared here rather
than a live cross-service HVNTZ lookup, to keep this phase's scope
bounded." HVNTZ gained a real `GET /api/business/:id` lookup route
this same session (its own Phase 6), closing the reason this was ever
deferred.

## Real investigation before any code
Read `registerAffiliateStation` directly — confirmed the field was a
bare boolean with no verification anywhere. Grepped the whole repo for
other callers before changing its signature (found exactly one: the
one real route in `server.js`), so no other real code needed updating.

## Design
`registerAffiliateStation` becomes async, taking a real, optional
`hvntzBusinessId` + injected `hvntzFetchFn` — the same pattern CVNVO's
own BarBuddy fix just established (this session, same day). Unlike
BarBuddy's `venueId` (which doubles as VDP's own synthetic, non-HVNTZ
venue id and genuinely needs an unverified path), every real affiliate
station registration is about an actual real-world business — there's
no legitimate case for claiming HVNTZ-onboarded status without a real
id to prove it. So the old bare boolean is removed entirely, not kept
alongside real verification: omitting `hvntzBusinessId` now just means
`isHvntzOnboarded: false`, honest by default rather than a trusted,
unproven claim.

## Explicitly NOT in this task
Real demand forecasting for Kyle (a separate, larger, real gap, left
for its own future work).

## Verification approach
7 plain-Node checks. A live pass with `venvs-mock-backend`, `hvntz`,
and `void` all running: a real HVNTZ business registered, an
unverified affiliate station confirmed unaffected, a verified station
confirmed succeeding with the real business name stored, and a station
against a nonexistent business confirmed rejected with HVNTZ's own
real error message.

## Done when
The Affiliate Network's own HVNTZ-onboarded flag is never trusted from
the caller — it's either real and verified, or honestly false.
