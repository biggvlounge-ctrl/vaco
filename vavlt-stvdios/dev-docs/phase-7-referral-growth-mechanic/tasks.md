# Phase 7 — referral/growth mechanic — tasks

- [x] Confirmed by direct grep across the whole repo that no referral/
      growth mechanic of any kind existed in this app before this
      phase.
- [x] `lib/provablyFair.js` — copied verbatim from `vago/lib/provablyFair.js`.
- [x] `lib/referralGrowth.js` — `REFERRAL_TIERS`, `SPIN_PRIZES`,
      `getReferralProgress`, `recordReferral`, `spinWheel`.
- [x] `lib/store.js` — `referrals`/`nextReferralId`/`referralGrowth`/
      `spins`/`nextSpinId` added to the shared store shape.
- [x] `server.js` — `POST /api/referrals`,
      `GET /api/referrals/:userId/progress`,
      `POST /api/referrals/:userId/spin`. Health check updated with
      `referralTiers`/`spinPrizes`.
- [x] `node --check` on all modified/new files.
- [x] 5 real unit test groups, run and passed (shared test harness
      covering both this app and VOKEN's identical build), scratch
      test file removed after.
- [x] Live verification: a real referral crossed tier 1, confirmed the
      real 10 VCoin bonus against V3; a real spin won a real 100 VCoin
      jackpot, independently re-verified from a separate process
      outside this app's own code (recomputed hash matched, re-derived
      HMAC reproduced the same outcome); a second spin correctly
      failed with zero spins remaining; restart-survival confirmed.
- [x] Test/runtime artifacts cleaned up (`v3/data`, `vavlt-stvdios/data`,
      logs).
- [x] README.md — new "Real referral/growth mechanic" section.
- [x] plan.md / tasks.md (this file).

## Next
- A VDP or UI surface for the progress bar/spin-wheel — none exists
  yet, real, later work.
- Real, tuned tier thresholds/rewards once actual user behavior data
  exists — the current numbers are honest, flagged defaults.
