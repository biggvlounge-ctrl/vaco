# Phase 8 — beat marketplace — tasks

- [x] Confirmed by direct grep across the whole repo that no beat/
      instrumental/producer-marketplace concept existed anywhere under
      any name before this.
- [x] Researched BeatStars' and Airbit's real, current commission
      models rather than guessing, to ground the fee-model decision.
- [x] `lib/beatMarketplace.js` — `listBeat`, `getBeat`,
      `listActiveBeats`, `takeDownBeat`, `purchaseBeat`,
      `listPurchasesForBuyer`, `listSalesForProducer`.
- [x] `lib/store.js` — `beats`/`nextBeatId`/`beatPurchases`/
      `nextBeatPurchaseId` added to the shared store shape.
- [x] `server.js` — `POST /api/beats`, `GET /api/beats`,
      `GET /api/beats/:id`, `POST /api/beats/:id/take-down`,
      `POST /api/beats/:id/purchase` (pushes `beat_sales_revenue` to
      VACO Analytics, fail-soft, same pattern as every other real
      metric feed), `GET /api/beat-purchases/buyer/:userId`,
      `GET /api/beat-purchases/producer/:userId`. Health check updated
      with `beatLicenseTypes`/`beatStatuses`.
- [x] `node --check` on all 3 modified/new files.
- [x] 6 real unit test groups, run and passed, scratch file removed
      after.
- [x] Live verification against real running v3 + vulture-music:
      non-exclusive lease sold to a real buyer (100% to producer,
      stays listed); exclusive beat sold once, delisted, second real
      attempt failed with zero balance change; producer blocked from
      self-purchase; `beat_sales_revenue` confirmed landing in VACO
      Analytics; restart-survival confirmed (real beats/purchases and
      V3 balances came back unchanged after a kill + restart).
- [x] Test/runtime artifacts cleaned up (`vulture-music/data`,
      `v3/data`, `vaco-analytics/data`, logs).
- [x] README.md — new "Real beat marketplace" section documenting the
      fee-model decision and license-delivery model.
- [x] plan.md / tasks.md (this file).

## Next
- A flat per-listing fee (mirroring `DISTRIBUTION_FEES`), if a
  platform revenue line is ever wanted here — a real, explicit
  business decision, not this phase's to make silently.
- A VDP district or UI surface for browsing/buying beats — none exists
  yet, same as most of Vvltvre Music's other real endpoints.
- Real audio-file storage/streaming behind `previewUrl` — a real,
  permanent ceiling in this environment, same class of gap as Vault
  Studios' own `streamUrl`.
