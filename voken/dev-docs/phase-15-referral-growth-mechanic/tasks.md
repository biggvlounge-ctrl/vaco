# Phase 15 — referral/growth mechanic — tasks

- [x] Confirmed by direct grep across the whole repo that no referral/
      growth mechanic of any kind existed in this app before this
      phase (only unrelated marketplace referral-fee research).
- [x] `lib/provablyFair.js` — copied verbatim from `vago/lib/provablyFair.js`.
- [x] `lib/referralGrowth.js` — same shape as Vavlt Stvdios' build,
      reusing `VOKEN_PLATFORM_ACCOUNT` from `lib/vex.js` for payouts.
- [x] `lib/store.js` — `referrals`/`nextReferralId`/`referralGrowth`/
      `spins`/`nextSpinId` added.
- [x] `server.js` — `POST /api/referrals`,
      `GET /api/referrals/:userId/progress`,
      `POST /api/referrals/:userId/spin`. Health check updated.
- [x] `node --check` on all modified/new files.
- [x] 5 real unit test groups (shared harness with Vavlt Stvdios), run
      and passed, scratch test file removed after.
- [x] Live verification: a real referral crossed tier 1, confirmed the
      real 10 VCoin bonus against V3; the real anti-abuse rule
      confirmed live (a second referrer trying to claim an
      already-referred user was rejected); restart-survival confirmed.
- [x] Test/runtime artifacts cleaned up (`v3/data`, `voken/data`, logs).
- [x] README.md — new "Real referral/growth mechanic" section.
- [x] plan.md / tasks.md (this file).

## Next
- A VDP or UI surface for the progress bar/spin-wheel — none exists
  yet, real, later work.
- Real, tuned tier thresholds/rewards once actual user behavior data
  exists.
