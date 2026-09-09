# Plan — Phase 6: CHOPZ District

## Goal
`CLAUDE.md` §4: "CHOPZ District — 8 leasable retail units across 7
business categories. Lease a shop, run it yourself (instant-payout
shifts on cooldown) or staff it with a category-specific named AI
employee (passive income, real elapsed-time math)." Second phase
without a source doc giving concrete numbers (after Phase 5's world) —
category names, lease cost, shift payout, cooldown length, and AI
earn rate are all invented and flagged, same posture as Phase 5.

## Design
- `src/lib/chopz.js`: 8 units, 7 categories (`food_stand` gets 2 of
  the 8 slots — an interpretive distribution choice, no doc specifies
  which category gets the extra unit).
- `leaseUnit`/`runShift`/`collectEarnings` reuse the injected
  `transferFn` pattern from every prior real-money phase.
- **Cooldown and elapsed-time math both take an explicit, overridable
  `now` parameter** (defaulting to `Date.now()`), same pattern as
  Phase 3's `checkAbandonedCarts`. This is what makes the "instant-
  payout shifts on cooldown" and "passive income, real elapsed-time
  math" mechanics genuinely testable without waiting hours in a test
  run: the plain-Node pass exercises exact boundary instants (cooldown
  expiry down to the millisecond, 1 hour vs. 2.5 hours of accrual)
  deterministically.
- `runShift` rejects during cooldown with a message computed from the
  *real* remaining time, not a generic "try again later."
- AI-employee accrual: `getPendingEarnings` computes
  `elapsedHours * AI_EMPLOYEE_RATE_PER_HOUR` since `lastCollectedAt`;
  `collectEarnings` pays that exact amount and resets the baseline —
  verified that accrual correctly resumes from the collection point on
  a second collection cycle, not from zero, since that's the case most
  likely to silently break (a naive implementation might reset to
  "now" incorrectly or double-count).
- Mode is exclusive (`self_run` xor `ai_employee`): `runShift` on an
  AI-staffed unit throws, `getPendingEarnings`/`collectEarnings` on a
  self-run unit throws, `switchToSelfRun` clears the employee and
  resets cooldown state cleanly.
- `src/components/ChopzView.jsx`: real demo UI. Because a live browser
  session can't wait 2 real hours for a meaningful passive-income
  demo, one unit is staged via the same **backdating technique**
  already proven in Phase 3 (the abandoned-cart demo) — leased and
  AI-staffed with `lastCollectedAt` set 2 real hours in the past, so
  "Collect" shows a real, correctly-computed nonzero payout (6 VCoin =
  2 hours × 3/hour) immediately, without faking the number.

## Verification approach
Same two layers. Plain-Node pass first (25 checks; caught the same
species of bug as Phases 4 and 5's earlier passes — an un-awaited
async `runShift()` call inside a sync `try`, fixed the same way).
Live browser pass: leased a unit, ran a real shift (balance +15),
confirmed a second immediate attempt is correctly rejected by the real
cooldown (balance unchanged), staged the backdated AI-employee demo
(balance -50 for the lease), collected the real computed 6 VCoin
(balance +6), and — independently, via a direct `fetch` to the mock
backend rather than trusting the UI — confirmed the final ledger
balance matches the exact hand-computed net change across the whole
sequence (-50+15-50+6 = -79 from the starting 1000).

## Explicitly NOT in this task
- No Digital Twin Levels (1→2→3), no DREAMS billboards, no Vavlt
  Stvdios "go live" toggle, no AI Business Intelligence insight line —
  all explicitly listed in `CLAUDE.md` §4 as CHOPZ-adjacent but none
  built here; each would need its own concrete design decisions this
  doc doesn't specify.
- CHOPZ isn't placed as a 7th district in Phase 5's walkable-world
  grid — it exists only as an analog-mode-style view, same as
  Publishing/Marketplace/DEGVCHI before Phase 5 gave those two a
  physical presence. A real gap, not an oversight.
- No category-specific AI employee behavior (the doc says "category-
  specific named AI employee" — here, any leased unit can be staffed
  with any employee name regardless of category; a real per-category
  employee roster isn't specified anywhere).

## Done when
- 8 units generate across exactly 7 categories.
- `leaseUnit` validates correctly and rejects a double-lease.
- `runShift` pays correctly, sets a correct `nextAvailableAt`, rejects
  during cooldown with the real remaining time, and succeeds again
  exactly at the cooldown boundary (not a moment before).
- `getPendingEarnings`/`collectEarnings` compute exactly correct
  amounts at 0, 1, and 2.5 hours of elapsed time; collecting resets
  the accrual baseline correctly (verified a second accrual cycle
  starts fresh from the collection point, not from zero).
- Mode exclusivity is enforced in both directions (can't shift an
  AI-staffed unit; can't check/collect earnings on a self-run one).
- Live browser: every real balance change matches its hand-computed
  expected value exactly, including the final ledger check.
- Regression: Phases 1-5 still work in the same session.
