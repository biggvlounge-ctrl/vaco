# Phase 8 — beat marketplace

## Goal
A user-flagged real gap, not self-discovered: Vvltvre Music needed a
beat/instrumental marketplace (producers list, artists browse/preview/
buy) — a real feature of the original concept that was never built.
Confirmed genuinely new by direct grep across the whole repo (this
session's own standing discipline) before designing anything: no
beat/instrumental/producer-marketplace concept existed anywhere under
any name.

## Design
Built directly against the real, named comparables given: BeatStars
and Airbit. Lives inside `vulture-music` itself (same port, same
store, same `transferVCoin`) rather than a new app — it's the same
division, and matches how VOID already runs 18+ verticals through one
server rather than one app per feature.

**License types**, matching real convention: `non-exclusive` (a
lease — the beat stays listed, the producer can sell it again to
others) and `exclusive` (one-time — the beat is delisted immediately
after its one real sale).

**The real fee-model decision, made explicit rather than invented
silently**: researched both real comparables directly rather than
guessing. BeatStars charges sellers up to 30% on its free tier (down
to 0% on a paid Pro tier, plus a separate buyer-side service fee);
Airbit's current real model eliminated seller commissions entirely —
0% across every tier. Given `releases.js`'s own already-established
defining choice for this whole division ("no percentage split
anywhere in this codebase," the DistroKid/TuneCore flat-fee posture),
v1 takes the same consistent stance: **the producer keeps 100% of
every sale**. `transferFn` moves the real price directly from buyer to
producer — no platform account in the path. A flat per-listing fee
(mirroring `releases.js`'s own `DISTRIBUTION_FEES`) is real, later
work if a revenue line is wanted here, not invented in this pass.

**License delivery**: the real purchase record itself is the license —
a real, timestamped, immutable proof of what was bought, at what
price, under what license terms, queryable by both buyer and producer.
No fabricated download link or DRM — matches this session's own
honesty posture toward media it can't actually host (Vavlt Stvdios'
`streamUrl`, VENVM's `videoUrl`): `previewUrl` is a real, caller-
supplied field, honestly `null` unless a producer genuinely has one.

## Verification approach
6 real unit test groups against `lib/beatMarketplace.js` directly (no
mocking of the module under test): listing validation, a non-exclusive
lease surviving multiple real sales to different buyers, an exclusive
beat delisting after one real sale and the second attempt failing
*without* ever charging anyone, a producer blocked from buying their
own beat, the purchase record queryable both ways, and producer-scoped
take-down.

Then live, against real running `v3` + `vulture-music` instances:
listed a real non-exclusive beat, bought it, confirmed the real
100%-to-producer balance change (buyer −25, producer +25, no platform
account touched); listed and bought a real exclusive beat, confirmed
it delisted immediately and a second purchase attempt failed with no
balance change for the second buyer; confirmed the new
`beat_sales_revenue` metric lands in VACO Analytics; and confirmed
restart-survival (killed `vulture-music`, restarted it, the same real
beats/purchases and V3 balances came back unchanged).

## Done when
- `node --check` passes on all modified/new files.
- All 6 unit test groups pass.
- Live verification (above) passes, including the exclusive-beat
  negative case and restart-survival.
- README documents the fee-model decision and the license-delivery
  model.
