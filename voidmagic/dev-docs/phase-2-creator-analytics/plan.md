# Plan — Phase 2 (fourth slice): Creator Analytics

## Goal
Section 35's real, named metric list: bookings, revenue, attendance,
no-shows, conversion, average order value, experience duration,
creator earnings, customer retention, repeat booking, geographic
demand, digital vs physical, experience type, peak booking periods,
advertising performance, transportation usage, security usage, venue
performance.

## Design
`lib/creatorAnalytics.js`: a real, pure read-side aggregation over
data this codebase already has (`Experience`, `Booking`,
`EventServiceRequest`) -- no new store fields, no new writes. Of the
18 named metrics, 12 are genuinely computable and built:
`totalBookings`, `grossRevenue`, `averageOrderValue`, `creatorEarnings`,
`attendedCount`/`noShowCount`/`attendanceRate`, `repeatCustomerCount`,
`bookingsByFormat` (digital vs. physical, plus hybrid),
`bookingsByType` (experience type), `averageExperienceDurationMinutes`,
`eventServiceUsage` (transportation/security usage, generalized across
all five real Event Service types), `bookingsByHourUTC`/
`peakBookingHourUTC` (peak booking periods).

`creatorEarnings` deliberately recomputes the exact same real formula
`bookings.js`'s `completeExperience` already used at settlement
(`PLATFORM_TAKE_RATE`, per-booking rounding), not
`grossRevenue * (1 - PLATFORM_TAKE_RATE)`, which would drift from what
was actually transferred booking-by-booking -- it reports what was
actually paid, reusing the real formula rather than approximating it.

6 metrics are honestly flagged not computable (`notComputable` field
on the response) rather than faked: `conversion` (no real page-view
tracking exists), `geographicDemand`/`venuePerformance`
(`Experience.location` is a free-text string, not a real venue entity
with coordinates -- grouping by it would be a fragile, misleading
proxy, not a real metric), `advertisingPerformance` (needs DREAMS,
Phase 3, not built).

## Explicitly NOT in this task
Real geographic/venue entities, real ad-performance integration, real
page-view tracking -- all genuinely separate, later work.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 18
checks): a host with no data gets real zeroed stats (not an error),
`attendanceRate` is `null` (not `0`) when there's nothing to compute a
rate from; a real two-experience, three-booking, one-no-show, one-
repeat-customer scenario proven correct across every computed metric,
including `creatorEarnings` matching the exact real settlement formula
booking-by-booking; a completely separate host confirmed to have
zeroed stats, unaffected. Then a live pass: the same real scenario run
against `voidmagic/server.js`, `void/server.js`, and `venvs-mock-backend`
all running independently, with the real analytics endpoint confirmed
to return identical values to the plain-Node run.

## Done when
- All 12 computable metrics are real and correct against a
  multi-booking, multi-experience scenario, live.
- The 6 non-computable metrics are explicitly named, not silently
  omitted or faked.
