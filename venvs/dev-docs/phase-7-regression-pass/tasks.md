# Tasks — Phase 7: Full regression pass

- [x] Run all 6 systems in one continuous browser session (Playwright
      + this environment's Chromium, temporary scratchpad install):
      - Login once; wallet cash-out (VCoin −100, VASH +1).
      - Publishing: buy the ebook (VCoin −5.99, running total
        checked).
      - Marketplace: 2-seller checkout (VCoin −40.50) + abandoned-cart
        recovery offer generation, both still working.
      - DEGVCHI: buy and equip all 3 items in the standalone view
        (VCoin −45, full outfit confirmed).
      - World: walk to and enter the Publisher building — confirmed a
        real second `PublishingView` renders; walk to and enter the
        Fashion District building — confirmed a real second
        `DegvchiView` renders.
      - **Confirmed and screenshotted the state-independence finding**:
        both nested views show fully unpurchased/unequipped state
        despite the standalone views already having real purchases —
        a real architectural gap (separate stores per component
        instance), not a bug in either view's own logic.
      - CHOPZ: lease + run shift (+15 net of −50), a second immediate
        shift attempt correctly rejected by cooldown (balance
        unchanged), the AI-employee backdated demo + collect (−50
        then +6).
      - **Final independent ledger check**: `demo-user`'s real VCoin
        balance via direct `fetch` to the mock backend matches the
        exact hand-computed total across the entire sequence
        (1000 − 270.49 = 729.51); VASH balance still correctly 1;
        `author-1`'s payout still correctly 1004.04.
- [x] Caught and fixed one test-script timing bug (the 6th across this
      session): a checkpoint read the balance right after an unrelated
      UI element appeared, not after the actual async balance-refresh
      resolved. Fixed by polling for the expected balance value
      directly instead. Confirmed clean on a fresh restart: 19/19
      checks passed.
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections.
- [x] No `src/` changes — this phase is verification only. The
      state-independence finding is documented, not silently patched.

## Next
Lifting `createCatalog()`/`createDegvchi()` to a shared location (e.g.
`App.jsx`, passed down as props) so the standalone and world-nested
views of Publishing/DEGVCHI reflect the same real state is the clear,
concrete next step surfaced by this pass — not done here, since this
phase was scoped to verification, not fixes.
