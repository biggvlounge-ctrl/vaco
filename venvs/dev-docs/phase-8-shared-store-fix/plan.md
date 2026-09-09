# Plan — Phase 8: Fix the shared-store gap found in Phase 7

## Goal
Phase 7's regression pass confirmed and screenshotted a real bug:
`PublishingView` and `DegvchiView` each created their own catalog/
store on mount, so the standalone instances and the ones `WorldView`
renders on building entry were independent state. Fix it properly:
one catalog and one DEGVCHI store, created once in `App.jsx`, passed
down to every view that reads them.

## Design
- `App.jsx` now owns `catalog` (`useState(() =>
  SEED_CATALOG(createCatalog()))`) and `degvchiStore` (same pattern),
  seeded once via two small local functions (`SEED_CATALOG`,
  `SEED_DEGVCHI`) that hold the exact same demo data each view used to
  seed independently.
- `PublishingView` and `DegvchiView` now take `catalog`/`store` as
  required props instead of creating their own — the actual one-line
  fix for the bug Phase 7 found.
- `WorldView` takes the same two stores as props and forwards them
  unchanged to the `PublishingView`/`DegvchiView` instances it renders
  on building entry — this is what makes the nested and standalone
  instances genuinely the same data now, not just the same component
  code (which was already true before this phase and was the
  misleading part of the old header comment, now corrected).

## A second, real bug found and fixed while verifying the first fix
Confirming the fix live surfaced a second, independent bug: after
lifting the store, clicking "Equip" in the standalone `DegvchiView`
correctly mutated the shared store (confirmed via direct debug
logging — `equipWearable` returned the correct outfit object) but the
UI never updated to show "Equipped." Root cause, found by direct
observation rather than guessing: `handleEquip` was calling
`onPurchase` (which just re-fetches VCoin/VASH balances) to force a
parent-level re-render. Equipping a wearable doesn't touch VCoin — the
refetched balance is numerically identical to what `vcoinBalance`/
`vashBalance` already held, and **React's `setState` bails out of
scheduling a re-render when the new value is `Object.is`-equal to the
current one**, even for primitives. So the store mutation was
genuinely correct, but nothing ever forced React to re-render and
recompute the UI from it.

Fixed with a dedicated `tick` counter in `App.jsx`
(`setTick((t) => t + 1)`), which by construction is never equal to its
previous value, guaranteeing a real re-render on every call regardless
of whether any visible balance changed. All five views now call a
single `notifyStateChange` callback (bump `tick`, then refresh
balances) instead of directly calling `refreshBalances` — the same
callback name (`onPurchase`) is kept on each component's props for
minimal diff, but it now points at the fixed function.

## Verification approach
Three passes. First, a narrow live-browser check reproducing the
exact Phase 7 scenario (buy + equip one item in the standalone
DEGVCHI view, walk to the Fashion District, confirm the nested view
shows it as "Equipped" rather than "Buy") — this initially still
failed after the store-sharing fix alone, which is what surfaced the
second bug above. Debugged with direct `console.log` calls temporarily
added to `handleEquip`/`equipWearable` (confirmed the mutation was
correct) before concluding the problem was in the re-render trigger,
not the data — removed the debug logging once the real fix (the `tick`
counter) was in place and confirmed working. Second, the same
narrow check re-run clean. Third, the full 14-check regression
sequence from Phase 7 (wallet → Publishing → Marketplace → DEGVCHI →
world → CHOPZ, with a final independent ledger check) re-run in full
to confirm the fix didn't disturb anything else — passed with the same
exact hand-computed final balance (729.51) as Phase 7's original run,
plus the new, now-passing shared-outfit assertion.

## Explicitly NOT in this task
- `MarketplaceView` and `ChopzView` were not touched — neither has a
  world-nested counterpart (CHOPZ isn't placed in the world's district
  grid; Marketplace has no building in it either), so there was no
  independent-store bug to fix for them.
- No general "global state management" solution (Redux/Zustand/etc.)
  was introduced — three explicit props (`catalog`, `degvchiStore`,
  `onPurchase`/`notifyStateChange`) is proportionate to the actual
  problem at this scale; reaching for a state library would be
  premature abstraction for two shared objects.

## Done when
- Buying and equipping in the standalone DEGVCHI view is immediately
  visible (same tick, no reload) in the world-nested instance after
  entering the Fashion District building, and vice versa in principle
  (verified in the buy-then-walk direction, the direction that
  matters for the demo flow).
- The `tick`-based re-render fix is verified to actually be necessary
  and sufficient — confirmed by reproducing the failure with direct
  debug logging before applying the fix, not just asserting a fix and
  hoping.
- The full Phase 7 regression sequence still passes end-to-end with
  the same correct final balance, confirming no money-handling
  behavior was disturbed by either fix.
