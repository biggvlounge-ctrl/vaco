# Plan — Phase 7: Full regression pass

## Goal
Every prior phase (1-6) was verified in isolation, on its own, freshly
mounted. This phase runs all six in one continuous browser session —
wallet, Publishing, Marketplace, DEGVCHI, the walkable world (entering
both buildings), and CHOPZ — to catch anything that only breaks when
systems interact, and to do one comprehensive, hand-computed,
independently-verified balance check across the whole session rather
than six separate small ones.

## Real finding, not a false alarm
**`PublishingView` and `DegvchiView` each create their own catalog/
store via `useMemo(() => createCatalog(), [])` (or `createDegvchi()`)
on mount.** This means the standalone instances rendered directly in
`App.jsx` and the nested instances rendered inside `WorldView` on
building entry are **two completely separate stores with independent
state** — not two views onto the same data.

Confirmed directly in this pass: after buying and equipping all 3
DEGVCHI items in the standalone view, walking into the Fashion
District building and entering it renders a *second* `DegvchiView`
where all 3 items still show "Buy" and the outfit reads
"clothing=none, cosmetics=none, accessories=none" — screenshotted as
proof, not just asserted. Same confirmed for Publishing (2 unpurchased
`Buy` buttons in the nested view after the standalone one already
bought book #1).

This is a real architectural gap, not a bug in either component
individually — each was built and verified correctly against its own
store in Phases 2/4. The gap is that there's no single shared
catalog/wearables store that both the analog-mode views and the
world's building-entry views read from. Flagging this explicitly
rather than letting it surface later as a confusing "why doesn't my
purchase show up" report — a real next step would be lifting
`createCatalog()`/`createDegvchi()` up to `App.jsx` (or higher) and
passing the store down as a prop, the same lift-state-up fix any React
app would need here.

## Verification approach
One continuous Playwright session (temporary scratchpad install, same
as every phase): login once, then in sequence — cash out VCoin, buy a
book, check out a 2-seller marketplace cart, run the abandoned-cart
recovery demo, buy and equip all 3 DEGVCHI items, walk into and enter
both the Publisher and Fashion District buildings (confirming the
state-independence finding above at each), lease/run/collect through
CHOPZ including a rejected cooldown attempt. **Tracked the running
VCoin balance by hand at every checkpoint** and compared against the
UI's displayed value, catching one real timing issue along the way
(see below) before landing on a clean 19/19 pass with a final
independent ledger check confirming the complete hand-computed total
(1000 − 270.49 = 729.51) exactly.

**One more test-script bug caught and fixed** (the 6th across this
session's phases, and arguably the most instructive): the checkpoint
right after Marketplace checkout read the balance immediately after
`await page.waitForSelector("text=Order #")` resolved — but
`MarketplaceView.handleCheckout` calls `setOrder(result)` (which is
what makes "Order #" appear) *before* its separate `await
onPurchase()` balance-refresh call resolves. The order confirmation
and the balance update are two independent state updates, not one
atomic one, so waiting for the first doesn't guarantee the second has
happened. Fixed by waiting for the balance value itself
(`page.waitForFunction` polling the displayed VCoin balance for the
expected number) instead of an unrelated piece of UI as a proxy for
"the async work is done." The eventual final ledger check already
proved the money moved correctly regardless — this was purely a
premature read, not a real defect.

## Explicitly NOT in this task
- Did not fix the independent-store finding — flagged for a future
  phase, not silently patched mid-regression-pass.
- Did not add any new features — this phase is verification only, no
  `src/` changes beyond what regression-testing revealed (none needed
  in the app code itself).

## Done when
- All 6 systems function correctly when exercised in one continuous
  session, not just in isolation.
- The state-independence gap between standalone and world-nested
  catalog views is confirmed directly (not assumed) and documented.
- One final, independent ledger check (`fetch` directly against the
  mock backend, not the UI) confirms the exact hand-computed VCoin
  total across all 6 systems combined, plus a spot-check of VASH and
  one payout recipient (`author-1`) for good measure.
- No console/page errors beyond the same harmless favicon 404 seen in
  every prior phase.
