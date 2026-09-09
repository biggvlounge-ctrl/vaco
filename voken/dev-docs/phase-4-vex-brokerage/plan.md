# Plan — Phase 4: VEX Brokerage Trading (compliance-gated)

## Goal
The architecture doc is explicit and unambiguous: build the real code
path for VEX's brokerage trading now, but hold the live-money trigger
behind a compliance gate until real broker-dealer registration
actually clears. This phase implements that literally, as a real,
testable, two-state system — not a TODO comment.

## Design
- `lib/complianceGate.js`: a real, shared gate state
  (`'vex-brokerage'`/`'fractional-ownership'`, both start `false`),
  used by this phase and reserved for VADO's fractional ownership work
  later — one real mechanism, not each module inventing its own flag.
  `setComplianceStatus()` is a real admin action, standing in for what
  would be an actual legal sign-off in the real ecosystem.
- `lib/vex.js`: `openBrokerAccount()` moves no money, so it's
  deliberately **not** gated — the account-opening flow works today.
  `placeTradeOrder()` is the real, gated mechanic: it checks the
  compliance gate first and rejects with a clear, specific message if
  brokerage isn't cleared. Once cleared, a `buy` order performs a real
  payment to the platform account and mints real digital editions to
  the buyer through Phase 1's own `mintAdditionalEdition()`; a `sell`
  order verifies the account genuinely owns the editions being sold
  (checked against real, current ownership, not trusted) before
  transferring them to the platform and paying the seller. Both use
  this project's established injected-`transferFn` pattern.
- `server.js`: 6 new endpoints, including the compliance-gate
  read/write endpoints.

## Explicitly NOT in this task
- No real broker-dealer registration, Reg D/A+ filing, or any actual
  legal work — `setComplianceStatus` is a real code mechanism standing
  in for a real-world legal outcome, not a claim that VOKEN is
  actually compliant.
- No real order book/matching engine between two independent traders
  — `placeTradeOrder`'s buy/sell both settle directly against the
  platform account, a real, minimal mechanic, not a full exchange.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 10
checks). The gate itself is checked from both directions, not just
asserted to exist: `placeTradeOrder` is confirmed to genuinely reject
with a compliance-specific error message while the gate is closed,
then genuinely succeed — with a real payment and real edition minting
— once `setComplianceStatus` opens it. Then a live pass: both
`voken/server.js` and `venvs-mock-backend` running together — the same
reject-then-succeed sequence run through the real HTTP API, with the
resulting buy order's payout **independently confirmed against the
mock V3 ledger**, not just trusted from the order response.

## Done when
- The `vex-brokerage` gate starts closed by default.
- `openBrokerAccount` works regardless of gate state (moves no money).
- `placeTradeOrder` genuinely rejects while the gate is closed and
  genuinely succeeds once opened, for both `buy` and `sell`.
- `sell` correctly rejects an account attempting to sell more editions
  than it genuinely owns.
- `setComplianceStatus` rejects a non-boolean value and an invalid
  gate name.
- Live: the full reject-then-clear-then-succeed sequence confirmed
  through the real HTTP API, with the payout independently confirmed
  against the mock ledger.
