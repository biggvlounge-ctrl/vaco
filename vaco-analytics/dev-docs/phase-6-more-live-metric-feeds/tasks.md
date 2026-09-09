# Phase 6 — more live metric feeds — tasks

- [x] void/server.js — `VACO_ANALYTICS_URL` env var, fail-soft
      `pushMetric()`, wired into `/api/job/:id/complete`
      (`job_platform_fee`).
- [x] vulture-flix/server.js — same pattern, wired into
      `/api/subscriptions` (`subscription_revenue`, real per-tier fee).
- [x] voken/server.js — same pattern, wired into
      `/api/fractional/listing/:id/buy` (`resale_trade_volume`).
- [x] `node --check` on all 3 modified files.
- [x] Live verification: started v3, vaco-analytics, void,
      vulture-flix, voken; ran a real courier job to completion, a real
      subscription, and a real fractional-share purchase (after minting
      a real card and clearing the `fractional-ownership` compliance
      gate); confirmed all 3 metrics in `GET /api/dashboard` with
      correct real values.
- [x] vaco-analytics/README.md — "Live metric feeds" section and "Not
      yet built" list updated from 3 to 6 real feeds.
- [x] plan.md / tasks.md (this file).

## Next
- Same fail-soft pattern extends to any other real revenue-bearing app
  as it comes up naturally — no redesign needed.
- VOKEN's pack-tier-open flow still doesn't actually charge a buyer
  (no `transferFn` wired in) — a real, pre-existing gap noted but not
  fixed here, since fixing it is a VOKEN-side change, not an analytics
  one.
