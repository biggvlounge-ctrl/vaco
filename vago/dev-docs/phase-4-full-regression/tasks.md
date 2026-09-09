# Tasks — Phase 4: Full Cross-Phase Regression

- [x] Write one throwaway `.cjs` regression script exercising every
      module from Phases 1–3 in a single shared store:
      - AMOE grants real Gold Coin, isolated from the shared VCoin
        ledger.
      - A gold-coin casino session and a simultaneous vcoin casino
        session both settle correctly with zero cross-currency leakage
        (checked in both directions, for both participants).
      - A prediction market bought on both sides and resolved settles
        solvently inside the shared store (reusing Phase 2's own
        proven invariant).
      - A sportsbook event settles independently of the prediction
        market and esports modules running in the same store.
      - An esports match's pre-match stake and genuine live Flash
        Stake both real, pari-mutuel resolution correct and isolated.
      - Gold Coin balances for every VCoin-only participant confirmed
        at zero; the original AMOE recipient's Gold Coin balance
        confirmed untouched by every other module.
      - **Final sanity check**: every one of the store's 8 collections
        holds exactly its expected count, and a global VCoin
        conservation invariant — summing every account's real balance
        after the entire regression equals exactly the total seeded
        (9000) — holds exactly, proving no VCoin was created or
        destroyed anywhere across all four modules.
      - 7 checks, 1 test bug fixed (see below), all passed after the
        fix.
- [x] Live smoke test: `vago/server.js` started alongside
      `venvs-mock-backend`, `GET /api/health` and a real
      `POST /api/amoe-entry` both confirmed against the running server
      with every module wired.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Delete the throwaway script; commit `dev-docs/` as its own
      change (no `lib/`/`server.js` changes this phase — pure
      verification).

## Bug fixed during verification
**Test bug**: an assertion assumed `resolveMarket` would leave only
the losing side's contract record on a prediction market's book after
settlement. In fact it correctly leaves BOTH sides' contract records
in place — it pays out based on them but never deletes or zeroes a
contract (that only happens via an explicit `sellContract` call).
Fixed by correcting the expected count from 1 to 2.

## Next
VAGO is feature-complete against its currency foundation and three
wagering surfaces (prediction markets, sportsbook, esports staking).
Final delivery: since GitHub push remains blocked by the confirmed
GitHub App permission issue (independently confirmed via `git push`
from two separate clones and the GitHub MCP `push_files` tool during
the VOKEN delivery), ship `vago.zip` plus an updated
`vaco-repo-complete.zip` via the same zip-delivery fallback used for
VOID and VOKEN's completions.
