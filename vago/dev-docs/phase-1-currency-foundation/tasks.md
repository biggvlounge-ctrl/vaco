# Tasks — Phase 1: Gold Coin / VCoin Currency Foundation

- [x] Scaffold the project: `package.json`, `.env.example`,
      `.gitignore`, source docs copied in (`VAGO_ARCHITECTURE.md`,
      `VAGO_CLAUDE.md`, `VAGO_COMPARABLES.md`).
- [x] Create `lib/store.js`: `createVagoStore()`.
- [x] Create `lib/goldCoin.js`: `getGoldCoinBalance`, `creditGoldCoin`,
      `debitGoldCoin`.
- [x] Create `lib/amoe.js`: `AMOE_GOLD_COIN_GRANT_AMOUNT`,
      `AMOE_COOLDOWN_HOURS`, `submitAmoeEntry`, `getAmoeHistory`.
- [x] Create `lib/casinoSession.js`: `CASINO_GAME_TYPES`,
      `CASINO_CURRENCIES`, `VAGO_HOUSE_ACCOUNT`, `startCasinoSession`,
      `getCasinoSession`.
- [x] Wire `server.js`: 6 endpoints (`GET /api/health`,
      `GET /api/gold-coin/balance/:userId`, `POST /api/amoe-entry`,
      `GET /api/amoe-entry/:userId`, `POST /api/casino/sessions`,
      `GET /api/casino/sessions/:id`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 16 checks, all passed clean on first run):
      - A new user has zero Gold Coin; credit/debit are real and
        correct; overdrawing rejected; non-positive amounts and a
        missing reason both rejected.
      - `goldCoin.js`'s own exports contain no vcoin-referencing
        function — the isolation is structural, checked directly
        against the module's exports, not just behaviorally implied.
      - `submitAmoeEntry` genuinely credits usable Gold Coin; a second
        entry inside the real cooldown window is rejected; a new entry
        after the cooldown elapses genuinely succeeds; history is a
        real per-user audit trail, empty for a stranger.
      - A gold-coin session debits ONLY the Gold Coin ledger — proven
        with a tracking `transferFn` wrapper confirmed never called.
      - A vcoin session calls `transferFn` ONLY — proven by confirming
        the same user's Gold Coin balance is untouched afterward.
      - An insufficient-funds failure on either currency leaves the
        other currency's balance completely untouched.
      - Invalid `gameType`/`currency` rejected; `amoeEntryUsed` records
        correctly as a real boolean field.
- [x] Verify live with both `vago/server.js` and `venvs-mock-backend`
      running together: AMOE granted and cooldown-rejected live; a
      gold-coin session's local debit confirmed; a vcoin session's real
      $75 payout **independently confirmed** via
      `GET /api/vcoin/balance` on both the player and house accounts;
      cross-checks confirming each currency's balance is genuinely
      untouched by the other currency's session, run live against the
      actual running server, not just the plain-Node store.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Phase 2: prediction markets (Kalshi-model peer-to-peer contracts,
including the in-world VDP/VACON-C prediction feeds), settled entirely
in VCoin through the same real `transferFn` pattern proven this phase.
