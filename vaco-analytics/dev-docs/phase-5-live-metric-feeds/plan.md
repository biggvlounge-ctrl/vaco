# Phase 5 — live metric feeds from real apps

## Goal
VACO Analytics's ingest/query/alert contract (Phases 1-4) was real and
fully tested, but no other app in the ecosystem actually called it —
the dashboard had a real API and a real wallboard with nothing feeding
either outside manual `curl` calls. Close that gap: wire a handful of
real, revenue-bearing apps to push their own real events in.

## Design
Three apps, each already representing a distinct real revenue shape,
get a `pushMetric(metric, value)` function added inline in `server.js`
(same convention every cross-app fetch call in this ecosystem already
follows — `transferVCoin`, `requestVoidCourierJob`, etc. — not a
separate client file):
- **vago** (`8795`) — `casino_payout`, pushed after a real Mines,
  Plinko, or Hi-Lo cash-out, value = the real `payout` field.
- **chopz-shop** (`8801`) — `checkout_revenue`, pushed after a real
  cart checkout, value = the real `totalCharged` field.
- **vulture-music** (`8806`) — `streaming_revenue`, pushed after a
  real streaming-revenue report, value = the real `amount` field.

`pushMetric` is fail-soft, matching `cvnvo/server.js`'s own
`fetchYapSignal` posture exactly: wrapped in try/catch, swallows any
failure silently. VACO Analytics is optional telemetry, never a
dependency — a real cash-out, checkout, or revenue report must never
fail or slow down because the dashboard happens to be offline.

## Verification approach
Live, end to end, against real running instances of all 5 involved
services (v3, vaco-analytics, vago, chopz-shop, vulture-music):
1. Trigger one real event in each of the 3 source apps (a real Mines
   cash-out, a real product + cart checkout, a real release taken live
   + a real revenue report).
2. Confirm all 3 metrics land in VACO Analytics's `GET /api/dashboard`
   with the correct real values.
3. Kill VACO Analytics, trigger another real VAGO cash-out, and confirm
   it still completes normally and quickly with no error surfaced —
   proving the fail-soft path is real, not just written and assumed.
4. Restart VACO Analytics and confirm the earlier metrics survived
   (already covered by Phase 4's persistence, re-confirmed here).

## Done when
- All 3 apps push their real metric after their real event.
- `node --check` passes on all 3 modified `server.js` files.
- Live verification (above) passes.
- vaco-analytics/README.md's "Not yet built" list no longer claims
  nothing feeds it.
