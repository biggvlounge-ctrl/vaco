# Phase 15 — referral/growth mechanic

## Goal
A user-flagged real gap: a Temu-style gamified referral mechanic
applied to VOKEN's existing referral/growth system. Direct
investigation before building anything found no such system existed
here at all — confirmed by grep across the whole repo; the only
"referral" hits anywhere in VOKEN's own docs were unrelated
marketplace referral-fee-percentage research (comparable-platform
commission rates), not a peer-to-peer invite program. This phase
builds the real thing from scratch, the identical design already built
for Vavlt Stvdios in the same pass, not a gamification layer over
something pre-existing.

## Design
Same shape as Vavlt Stvdios' own Phase 7 build: `lib/referralGrowth.js`
with `recordReferral`, `getReferralProgress`, `spinWheel`, the same
four real, flagged-interpretive escalating tiers (1/3/5/10 referrals →
10/25/50/150 VCoin + 1/1/2/3 spins), and spin-to-win reusing
`vago/lib/provablyFair.js` verbatim.

**VOKEN-specific choice**: bonus/prize payouts reuse the already-
existing `VOKEN_PLATFORM_ACCOUNT` (from `lib/vex.js`) rather than
inventing a second platform account — real code reuse, matching how
`lib/cardPacks.js` already imports the same constant for its own
pack-purchase payouts.

## Verification approach
Same 5 real unit test groups as Vavlt Stvdios' build (a shared test
harness covered both apps together in this pass), then live against
real running `v3` + `voken` instances: a real referral crossing tier 1
with the real bonus confirmed against V3, and the real anti-abuse rule
confirmed live (a second referrer attempting to claim an
already-referred user rejected). Restart-survival confirmed.

## Done when
- `node --check` passes on all modified/new files.
- All 5 unit test groups pass.
- Live verification (above) passes.
- README documents the honest "nothing existed here before" finding.
