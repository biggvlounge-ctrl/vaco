# Tasks — Phase 4: DEGVCHI avatar-wearable economy

- [x] Create `src/lib/degvchi.js`: `createDegvchi`, `registerWearable`,
      `getWearable`, `browseWearables`, `ownsWearable`,
      `getOwnedWearables`, `purchaseWearable`, `equipWearable`,
      `unequipWearable`, `getEquippedOutfit`, `WEARABLE_CATEGORIES`.
- [x] Verify pure logic in plain Node (throwaway script, deleted after
      — 26 checks; caught and fixed a bug in the test's mocked ledger
      itself — see plan.md for the `undefined < amount` root cause):
      - `registerWearable` throws on missing `name`, invalid
        `category`, non-positive `price`, missing `creatorId`.
      - A sponsored item stores its real sponsor name; a
        DEGVCHI-original item stores `sponsor: null`.
      - `browseWearables` correct with no filter, `category` filter,
        and `sponsoredOnly` filter.
      - `purchaseWearable`: buyer charged exactly the price, the full
        amount lands on `creatorId` (no invented platform cut),
        `ownsWearable` flips correctly; rejects a double purchase, a
        bad `wearableId`, and (once the ledger fixture bug was fixed)
        a buyer with genuinely no funds.
      - `equipWearable` rejects equipping an unowned item; equipping a
        second same-category item replaces the first rather than
        layering (checked directly, not assumed); a full 3-category
        outfit equips correctly.
      - `unequipWearable` clears exactly the targeted category,
        leaves others untouched, rejects an invalid category.
- [x] Create `src/components/DegvchiView.jsx`: 3 seeded items (1
      sponsored + 2 original) across all 3 categories, real Buy/Equip
      buttons, live outfit display.
- [x] Wire `App.jsx` to render `DegvchiView` after `MarketplaceView`.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install). Caught and fixed a
      second test-script bug here too: an "equip all 3" loop grabbed
      all 3 button locators via `.all()` up front, but the DOM
      re-renders (Equip → Equipped) after each click, so the 3rd
      locator timed out; fixed by re-querying `.first()` fresh each
      iteration, matching the pattern already used for the "buy all 3"
      loop:
      - DEGVCHI section renders with the real sponsor name shown for
        the sponsored item and "DEGVCHI original" for the other two.
      - Outfit starts empty (all 3 categories "none").
      - Buying all 3 items: buyer's real VCoin balance drops by
        exactly $45.00 (12 + 25 + 8); all 3 items show "Equip" instead
        of "Buy" afterward.
      - Equipping all 3: outfit display shows the correct item name
        in each of the 3 categories; all 3 items show "Equipped."
      - **Independently verified via direct `fetch` calls to the mock
        backend** (not the UI): `elf-cosmetics-brand`'s balance is
        exactly `1000 + 12 = 1012`; `degvchi-original`'s balance is
        exactly `1000 + 25 + 8 = 1033`.
      - No unexpected console/page errors (same harmless favicon 404
        as prior phases).
- [x] Shut down both dev processes cleanly (restarted mid-phase for a
      clean baseline after the aborted first browser run); confirmed
      via follow-up `curl` that neither port accepts connections.
- [x] Commit as its own change.

## Next
No avatar/visual rendering exists to reflect equipped items — that
depends on the digital-mode walkable world, not built. Digital Twin
ownership ladder and CHOPZ (the other two comparables-doc sections)
still have no buildable mechanic given what else exists in this
session.
