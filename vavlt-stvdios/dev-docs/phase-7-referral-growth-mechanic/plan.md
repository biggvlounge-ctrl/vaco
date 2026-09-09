# Phase 7 — referral/growth mechanic

## Goal
A user-flagged real gap: a Temu-style gamified referral mechanic
(progress bars, spin-to-win, escalating invite tiers) applied to Vavlt
Stvdios' existing referral/growth system. Direct investigation before
building anything found no such system existed here at all — confirmed
by grep across the whole repo, not assumed — so this phase builds the
real thing from scratch, not a gamification layer over something
pre-existing.

## Design
`lib/referralGrowth.js`: `recordReferral`, `getReferralProgress`,
`spinWheel`. Four real, flagged-interpretive escalating tiers (no
source doc specifies exact thresholds or amounts): 1/3/5/10 referrals
→ 10/25/50/150 VCoin bonus + 1/1/2/3 spins. Each real referee can only
ever be credited to one referrer (the standard anti-abuse rule every
real referral program enforces). Crossing a new tier — not every
referral — fires the real bonus payout.

Spin-to-win reuses `vago/lib/provablyFair.js` verbatim, copied into
this app the same way `lib/persistence.js` is copied across the whole
ecosystem — the identical real commit-reveal HMAC scheme VAGO's own
Originals games already established, not a second random-number
scheme invented for this feature. A real, fixed, published prize table
(weights summing to 100).

## Verification approach
5 real unit test groups: basic referral + progress tracking, escalating
tiers only paying a bonus on the exact crossing (not every referral),
the anti-abuse rule (a referee can only ever be credited once, self-
referral blocked), spin-to-win's real provably-fair verification
(independently re-derivable, not just a self-reported flag), and
progress capping at 100% once every tier is reached.

Then live, against real running `v3` + `vavlt-stvdios` instances: a
real referral crossing tier 1 with the real bonus confirmed against
V3, a real spin, and — critically — independent re-verification of
that spin from a separate `node -e` process outside this app's own
code entirely: recomputing `sha256(serverSeed)` and confirming it
matches the committed `serverSeedHash`, then re-deriving the HMAC with
the real revealed `serverSeed`/`clientSeed`/`nonce` and confirming it
reproduces the exact same prize bucket. Restart-survival confirmed.

## Done when
- `node --check` passes on all modified/new files.
- All 5 unit test groups pass.
- Live verification (above) passes, including the independent,
  from-scratch re-derivation of a real spin outcome.
- README documents the honest "nothing existed here before" finding
  and the real design decisions.
