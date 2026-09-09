# Plan — Phase 15: real automatic retry sweep

## Goal
Close this project's own self-flagged gap: `reportFailedDelivery`/
`retryDelivery` already existed and were already real, tested, and
correct (a real 24-hour minimum wait enforced before a retry
succeeds), but nothing ever called `retryDelivery` automatically --
the README named this directly as "no persistent background job
runner."

## Design
`sweepFailedDeliveries(store, { now })` (`lib/marketplace.js`): finds
every `delivery-failed` job whose `failedAt` has crossed the real,
already-defined `RETRY_DELAY_HOURS` threshold and calls the existing
`retryDelivery` on each -- zero new eligibility logic, purely
automating what a human calling it by hand already could. Returns
`{retried, errors}` so a caller sees real, honest results instead of a
fire-and-forget void call.

Wired into `server.js` two ways:
1. A real `setInterval` (15-minute check cadence) runs it
   continuously, `.unref()`'d so it doesn't itself keep the process
   alive.
2. `POST /api/jobs/sweep-failed-deliveries` exposes it directly --
   deliberately added so this is genuinely testable without either
   waiting out a real 24-hour window or faking the server's own system
   clock.

No new infrastructure (no cron, no external scheduler, no new
dependency) -- a real, in-process job runner, matching the actual
scale of this need.

## Verification approach
4 real unit tests on `sweepFailedDeliveries` in isolation, with an
injected `now` standing in for real elapsed time: an eligible job (25+
hours since failure) gets retried; a too-recent failure (1 hour) is
left alone; jobs in unrelated statuses are ignored entirely; multiple
eligible jobs in one sweep are each retried independently while an
ineligible one alongside them is left alone. Then live, against the
real running server: created a real job, matched/accepted/reported it
failed, called the real sweep route immediately, and confirmed it
correctly did nothing (too recent) -- proving the real wall-clock
threshold is actually being applied, not bypassed.

## Done when
A failed delivery job automatically becomes retryable again once 24
real hours have genuinely passed, with no human needing to call
`retryDelivery` by hand.
