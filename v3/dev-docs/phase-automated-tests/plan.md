# Plan — first automated test suite

## Goal
Close part of the ecosystem audit's finding that only Vex Business had
any automated tests. V3 is one of the two apps (with Shield) every
other app's correctness depends on.

## Design
Node's own built-in `node:test` + `node:assert/strict` -- zero new
dependency, testing `lib/vcoin.js`/`lib/vash.js` directly against a
fresh `createV3Store()` rather than over HTTP, so the suite runs in
milliseconds with no server boot required.

## Real gotcha caught before shipping
`node --test test/` (a directory argument) failed with
`Cannot find module '/home/user/vaco/v3/test'` on this Node version
(v22.22.2) -- not assumed to be a real bug in the test files
themselves; confirmed by explicitly globbing `test/*.test.js`, which
passed clean. `package.json`'s own `test` script uses the glob form
that's actually confirmed to work here, not the directory form that
silently doesn't.

## Verification approach
`npm test`: 11/11 real assertions pass, covering the real starting-
balance auto-grant, real balance-sufficiency enforcement, real
transaction-id sequencing, real per-user transaction-history
filtering, and the real VCoin->VASH conversion math.

## Done when
`npm test` is a real, green, one-command regression check for V3's
own core ledger logic.
