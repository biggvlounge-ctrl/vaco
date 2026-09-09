# Phase 6 — more live metric feeds

## Goal
Phase 5 wired 3 real apps into VACO Analytics's live metric feed.
Extend the same pattern to 3 more real, distinct revenue shapes so the
dashboard reflects a meaningfully wider slice of the ecosystem's real
economic activity, not just casino/commerce/streaming.

## Design
Same `pushMetric(metric, value)` inline pattern as Phase 5, fail-soft,
added to 3 more apps:
- **void** (`8793`) — `job_platform_fee`, pushed after a real job
  completion, value = the real `platformFee` field (VOID's own cut of
  a completed job, not the gross job price — a distinct revenue shape
  from Phase 5's gross-value metrics).
- **vulture-flix** (`8807`) — `subscription_revenue`, pushed after a
  real subscription, value = the real per-tier fee (`TIER_FEES[tier]`,
  already imported into `server.js`) that `subscribe()` itself charged.
- **voken** (`8794`) — `resale_trade_volume`, pushed after a real
  fractional-shares purchase, value = the real `amountPaid` field.
  Deliberately not the pack-tier-open flow: that route never actually
  charges a buyer (no `transferFn` wired into it), so a metric tied to
  it wouldn't be honestly backed by a real transaction — a real,
  pre-existing gap in VOKEN itself, not one to paper over here.

## Verification approach
Live, end to end, against real running instances of all 5 involved
services (v3, vaco-analytics, void, vulture-flix, voken):
1. VOID: create a real courier job, match/accept/complete it, confirm
   the real `platformFee` returned.
2. Vvltvre Flix: subscribe a real user to the `standard` tier, confirm
   the real per-tier fee charged.
3. VOKEN: mint a real Cvltvre card, clear the `fractional-ownership`
   compliance gate, create a real fractional listing, buy real shares,
   confirm the real `amountPaid`.
4. Confirm all 3 new metrics land in VACO Analytics's
   `GET /api/dashboard` with the correct real values, alongside the 3
   from Phase 5 remaining intact.

## Done when
- All 3 apps push their real metric after their real event.
- `node --check` passes on all 3 modified `server.js` files.
- Live verification (above) passes.
- vaco-analytics/README.md reflects 6 real live feeds, not 3.
