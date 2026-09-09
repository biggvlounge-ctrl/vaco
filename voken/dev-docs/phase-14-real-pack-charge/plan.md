# Phase 14 — real pack charge

## Goal
Close a real, self-flagged gap discovered while wiring VACO Analytics's
Phase 6 metrics feed: `openPack` minted real cards to a real buyer
without ever actually charging them. `packTier.price` was a real,
validated field on every pack tier — nothing in `openPack` ever read
it to move any real money. A buyer could open an unlimited number of
packs for free.

## Design
- `lib/cardPacks.js`'s `openPack` becomes `async` and now requires a
  real `transferFn(fromUserId, toUserId, amount, reason)`, matching
  every other real money-moving function in this ecosystem
  (`lib/vex.js`'s `placeTradeOrder`, `lib/fractionalOwnership.js`'s
  `buyShares`, etc.) rather than inventing a second convention.
- The charge routes to `VOKEN_PLATFORM_ACCOUNT` (imported from
  `lib/vex.js`, where it already exists as the shared "the platform's
  own account" constant — reused, not duplicated).
- **Ordering matters**: the charge fires *after* the pack's real
  contents are resolved (candidate cards validated, guaranteed-rarity
  swap applied) but *before* minting. A real "no qualifying card"
  failure — the one existing failure mode `openPack` already had —
  now provably never charges a buyer for a pack that couldn't be
  filled; a buyer who does pay always gets real cards back.
- The response gains a real `pricePaid` field so callers can confirm
  what was actually charged.
- `server.js`'s `POST /api/pack-tier/:id/open` route becomes `async`
  and passes the same real `transferVCoin` every other route in this
  server already uses.

## Verification approach
Real unit tests (3), each against a real in-memory store and a real
minted card/pack tier, no mocking of `openPack` itself:
1. A real charge fires exactly once, with the correct buyer, the real
   `VOKEN_PLATFORM_ACCOUNT`, and the exact real `packTier.price` —
   and `pricePaid` comes back correctly on the response.
2. Calling `openPack` without a `transferFn` rejects with a clear,
   real error, same posture as every sibling function.
3. A pack that can't be filled (no candidate card has remaining
   editions) rejects *and* the injected `transferFn` spy records zero
   calls — proving the ordering claim above, not just asserting it in
   a comment.

Then live, against real running `v3` + `voken` instances: minted 2
real Cvltvre cards, created a real $15 pack tier, checked the buyer's
real starting VCoin balance (1000), opened the pack for real, and
confirmed the real balance afterward (985 — exactly $15 less) and the
real `voken-platform` account's balance (1015 — exactly $15 more).
Then triggered the real unfillable-pack failure case again and
confirmed the buyer's balance was unchanged at 985 — the honest
failure path really doesn't charge, not just in the unit test's mock.

## Done when
- `node --check` passes on both modified files.
- All 3 unit tests pass.
- Live verification (above) passes, including the negative case.
- README documents the fix, including the ordering guarantee.
