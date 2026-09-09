# Tasks — Phase 6: CHOPZ District

- [x] Create `src/lib/chopz.js`: `createChopz`, `getUnit`,
      `getAvailableUnits`, `getOwnedUnits`, `leaseUnit`, `runShift`,
      `staffWithAIEmployee`, `switchToSelfRun`, `getPendingEarnings`,
      `collectEarnings`, `CATEGORIES`, `LEASE_COST`, `SHIFT_PAYOUT`,
      `SHIFT_COOLDOWN_MS`, `AI_EMPLOYEE_RATE_PER_HOUR`.
- [x] Verify pure logic in plain Node (throwaway script, deleted after
      — 25 checks; caught and fixed one bug in the test script itself,
      an un-awaited async `runShift()` call, same species as Phases 4
      and 5):
      - 8 units created across exactly 7 distinct categories; all
        start unowned.
      - `leaseUnit` throws on a bad `unitId`, missing `transferFn`;
        charges exactly `LEASE_COST`; sets `ownerId` and defaults
        `mode: 'self_run'`; rejects leasing an already-leased unit.
      - `runShift` pays exactly `SHIFT_PAYOUT`; returns the correct
        `nextAvailableAt`; rejects a second run during cooldown with
        the real remaining-minutes message; **succeeds again exactly
        at the cooldown boundary** (`now + SHIFT_COOLDOWN_MS`, not a
        moment before); rejects a bad `unitId`.
      - `getPendingEarnings` throws on a non-AI-staffed unit; returns
        exactly 0 at t=0, exactly the hourly rate at 1 hour, and
        exactly 2.5× the rate at 2.5 hours.
      - `collectEarnings` rejects when nothing is pending; pays
        exactly the pending amount; resets pending to 0 immediately;
        **a second accrual cycle after collecting correctly starts
        from the collection point**, not from zero — checked directly
        with a further elapsed hour.
      - `runShift` on an AI-staffed unit throws; `switchToSelfRun`
        correctly clears the employee; `getPendingEarnings` on the
        now-self-run unit throws again.
- [x] Create `src/components/ChopzView.jsx`: 8-unit list, real
      Lease/Run shift/Collect buttons, a demo button that stages a
      unit as AI-staffed 2 real hours in the past (same backdating
      technique as Phase 3's abandoned-cart demo).
- [x] Wire `App.jsx` to render `ChopzView` after `WorldView`.
- [x] Verify live in a real browser (Playwright + this environment's
      Chromium, temporary scratchpad install):
      - All 8 units render, all initially available.
      - Leasing unit #1: balance drops by exactly $50; unit shows
        "leased, self-run."
      - Running its shift: balance rises by exactly $15; confirmation
        message correct.
      - Immediately attempting a second shift: correctly rejected
        (real cooldown message shown); balance unchanged.
      - Staging the AI-employee demo: balance drops by exactly $50 for
        the second unit's lease; that unit shows "pending: 6 VCoin"
        (2 real hours × 3/hour), a real computed number, not
        hardcoded.
      - Collecting: confirmation shows exactly "Collected 6 VCoin";
        balance rises by exactly 6; pending resets to "0 VCoin" in the
        display immediately.
      - **Independently verified via a direct `fetch` to the mock
        backend**: the real ledger balance for `demo-user` matches the
        exact hand-computed net change across the whole sequence
        (1000 − 79 = 921).
      - No unexpected console/page errors (same harmless favicon 404
        as prior phases).
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections.
- [x] Commit as its own change.

## Next
Digital Twin Levels, DREAMS billboards, Vavlt Stvdios "go live"
toggle, AI Business Intelligence insight line, and placing CHOPZ as a
7th district in the walkable world are all believable next steps, not
built here.
