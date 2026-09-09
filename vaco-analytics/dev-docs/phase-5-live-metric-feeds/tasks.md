# Phase 5 — live metric feeds — tasks

- [x] vago/server.js — `VACO_ANALYTICS_URL` env var, fail-soft
      `pushMetric()`, wired into mines/plinko/hilo cash-out routes
      (`casino_payout`).
- [x] chopz-shop/server.js — same pattern, wired into cart-checkout
      (`checkout_revenue`).
- [x] vulture-music/server.js — same pattern, wired into revenue
      report (`streaming_revenue`).
- [x] `node --check` on all 3 modified files.
- [x] Live verification: started v3, vaco-analytics, vago, chopz-shop,
      vulture-music; triggered one real event in each source app;
      confirmed all 3 metrics in `GET /api/dashboard` with correct
      values.
- [x] Killed vaco-analytics, triggered another real VAGO cash-out,
      confirmed it completed normally (~14ms) with no error surfaced.
- [x] Restarted vaco-analytics, confirmed prior metrics survived
      (Phase 4 persistence).
- [x] vaco-analytics/README.md — new "Live metric feeds" section,
      "Not yet built" list updated to reflect the real current state.
- [x] plan.md / tasks.md (this file).

## Next
- Extend `pushMetric` to more real revenue-bearing apps (VOID job
  completions, Vvltvre Flix subscriptions, VOKEN trades, etc.) as they
  come up naturally — same fail-soft pattern, no redesign needed.
- Historical charting/sparklines on the wallboard, once there's enough
  real event volume to make one worth building.
