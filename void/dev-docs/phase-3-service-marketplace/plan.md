# Plan — Phase 3: Service Marketplace / Verticals engine

## Goal
`VOID_SERVICE_VERTICALS_COMPARABLES.md`'s central, explicitly-stated
claim: every one of VOID's 18+ service verticals — regardless of
pricing unit (hourly, per-job, per-trip, flat-quote, Laundry's real
per-pound) — runs through the exact same backend loop: **request →
match → accept → complete → pay → rate**. That's what makes the
verticals feel like one platform instead of 18 bolted-on apps. This
phase builds that literal loop plus a real registry of every named
vertical with its real (or explicitly-fallback) pricing unit and take
rate, sourced directly from the doc rather than invented.

## Design
- `lib/verticals.js`: a static registry, `VERTICALS`, of 23 real named
  verticals. Five (Transportation, Pet Care, Laundry, Cleaning/
  Handyman, Beauty) carry real, deep-researched numbers straight from
  the doc (Laundry's real per-pound pricing and 75% worker payout →
  25% platform take; Fiverr's real flat 20% commission for Freelance,
  deliberately avoiding Upwork's pay-to-bid model per the doc's own
  explicit recommendation). The remaining 18 use the doc's own
  explicitly-authorized fallback: a consistent ~20% take rate on
  whichever pricing unit the doc names for that vertical, not an
  invented number. `freePickupDelivery` and `licensingGated` flags
  carried over directly from the doc's table.
- `lib/marketplace.js`: the actual loop.
  `requestJob()` computes `totalPrice = quantity * unitPrice` — one
  real formula applying uniformly regardless of what the "pricing
  unit" label conceptually means (hours, pounds, a single flat job),
  matching the doc's own "same underlying structure" framing. Rejects
  outright at the vertical any `licensingGated` vertical (Cannabis
  Delivery, Medical Transportation) — a real, enforced business rule,
  not a UI-only warning.
  `matchProvider()` → `acceptJob()` → `completeJob()` → `rateJob()`
  enforce the real state machine (`requested → matched → accepted →
  completed`), each step rejecting if the job isn't in the required
  prior state. `cancelJob()` is allowed only before `accepted`.
  `completeJob()` performs the real payout, reusing this session's
  established injected-`transferFn` pattern and the "one source, real
  dual payout" mechanism HVNTZ's hunt check-in already established:
  **two real transfers from the customer** — a provider payout and a
  platform fee — computed so the platform fee is rounded first and the
  provider payout is the exact remainder, guaranteeing the two numbers
  always sum to `totalPrice` exactly rather than drifting by a cent
  from two independently-rounded halves.
- `server.js`: 10 new endpoints covering the vertical registry and the
  full job lifecycle.

## Explicitly NOT in this task
- No real matching algorithm (nearest provider, best-rated provider,
  etc.) — `matchProvider()` takes an explicit `providerId`; real
  matching logic (V4's stated responsibility, an AI agent not built
  here) is a separate, later concern.
- No surge/dynamic pricing — `unitPrice` is caller-supplied.
- No dispute/refund handling beyond pre-acceptance cancellation.
- Cannabis Delivery and Medical Transportation remain licensing-gated,
  enforced as a real rejection, not attempted regardless of the
  underlying loop being generic enough to support them mechanically.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 18
checks; one test-script bug found and fixed mid-pass: the `check()`
test helper wasn't awaiting async check functions, the same class of
bug repeatedly caught elsewhere in this session — a `completeJob`
assertion failure was silently swallowed as an unhandled promise
rejection rather than failing the check that contained it, until the
helper was made `async` and every call site awaited). Then a live
pass: `void/server.js` and `venvs-mock-backend` running together, a
real Laundry job run end to end through the actual HTTP API, with the
provider payout and platform fee **independently confirmed against the
mock V3 ledger**, plus a live confirmation that requesting a
licensing-gated vertical is rejected through the real API, not just in
unit tests.

## Done when
- `listVerticals` returns every registry entry with a valid pricing
  unit and a take rate strictly between 0 and 1.
- `requestJob` rejects an unknown vertical, a licensing-gated vertical,
  and invalid customer/quantity/price inputs; computes `totalPrice`
  correctly.
- The state machine correctly rejects every out-of-order transition
  (accepting before matching, completing before accepting, re-matching
  an already-matched job, completing an already-completed job, rating
  before completion).
- `completeJob` performs two real transfers that sum exactly to
  `totalPrice`, confirmed against a real ledger, not just computed.
- `cancelJob` is allowed before acceptance and rejected after.
- `getJobsForVertical`/`getJobsForUser` scope correctly.
- Live: the full lifecycle and the licensing gate both confirmed
  through the real HTTP API, matching the plain-Node pass.
