# Plan — Phase 8: Driver/Fleet Management + Failed-Delivery Retry

## Goal
Resolves the first of the open items from the 8 follow-up VOID docs:
the driver/fleet layer that `VOID_AMAZON_LOGISTICS_INTEGRATION.md`,
`VOID_HUB_WALKUP_ORIGINATION.md`, and `VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md`
all assumed exists but didn't. Also builds the real failed-delivery
protocol the Amazon doc names as a concrete, adoptable standard.

## Design
- `lib/driverFleet.js`: `registerGigDriver`/`registerVoidDSP` — the
  real two-tier model from the source doc: gig drivers (Amazon Flex's
  real role — flexible overflow, 1099, own vehicle) and VOID DSP
  (Amazon DSP's real role — a small business running a branded,
  W-2-driver fleet on fixed routes for reliable core coverage).
  `DSP_STARTUP_CAPITAL_REQUIRED = 30000` is the real bar per the
  source doc (explicitly distinct from the $10,000 *operating* cost
  figure the doc corrected itself on). VOID cannot partner with
  Amazon's actual DSP program (individual-applicant-only) — this is
  VOID's own independent structure modeled on the same real approach.
- `lib/marketplace.js` extended: `'delivery-failed'` added to
  `JOB_STATUSES`. `reportFailedDelivery()`/`retryDelivery()` implement
  the source doc's real standard — contact the customer, then an
  automatic retry the next day if unresolved — as a real, enforced
  24-hour (`RETRY_DELAY_HOURS`) minimum wait, not just a status label.
  `cancelJob()` extended to also allow cancellation from
  `delivery-failed` (a customer shouldn't be forced to wait for a
  retry they don't want).
- `server.js`: 8 new endpoints.

## Explicitly NOT in this task
- No real driver onboarding/background-check flow, insurance
  verification, or W-2 payroll processing — `registerGigDriver`/
  `registerVoidDSP` are registry entries, not a full HR system.
- No automatic retry scheduling (a real cron-style trigger firing
  `retryDelivery` once 24 hours elapse) — the real time gate is
  enforced when `retryDelivery` is called, matching this session's
  established stance on background schedulers (no persistent job
  runner exists in this environment).

## Verification approach
Plain-Node pass first (throwaway `.cjs`, deleted after — 11 checks).
Then a live pass: `void/server.js` running alone — a real gig driver
and VOID DSP (with a driver/vehicle/route added) registered through
the actual HTTP API, and a real job driven through
match → accept → report-failed → early-retry-rejected, with the
rejection message reporting the real remaining wait time.

## Done when
- `registerVoidDSP` rejects `startupCapitalRequired` below the real
  $30,000 bar and defaults to it when omitted.
- DSP fleet mutators (`addDriverToDSP`/`addVehicleToDSP`/
  `assignRouteToDSP`) dedupe correctly and throw for an unknown DSP.
- `reportFailedDelivery` only fires from `accepted`; `retryDelivery`
  correctly rejects an early retry and correctly succeeds (moving back
  to `accepted`, incrementing `retryCount`) once the real 24-hour
  window has elapsed.
- A job can complete normally after a real retry cycle.
- `cancelJob` works from `delivery-failed`, not just the original two
  pre-acceptance statuses.
- Live: all of the above confirmed through the real HTTP API.
