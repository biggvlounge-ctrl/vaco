# Tasks — Phase 3: Sportsbook + Esports Staking

- [x] Create `lib/sportsbook.js`: `SPORTS_EVENT_STATUSES`,
      `SPORTS_BET_STATUSES`, `isValidAmericanOdds`,
      `computeAmericanOddsPayout`, `createSportsEvent`,
      `getSportsEvent`, `placeSportsBet`, `getSportsBet`,
      `settleSportsEvent`.
- [x] Create `lib/esportsStaking.js`: `MATCH_STATUSES`,
      `createEsportsMatch`, `getEsportsMatch`, `startEsportsMatch`,
      `placeStake`, `resolveEsportsMatch`.
- [x] Extend `createVagoStore()` with `sportsEvents`/`sportsBets`/
      `nextSportsBetId`/`esportsMatches`.
- [x] Wire `server.js`: 10 new endpoints (`POST`/`GET /api/sports/events[/:eventId]`,
      `POST /api/sports/:eventId/bet`, `GET /api/sports/bets/:id`,
      `POST /api/sports/events/:eventId/settle`,
      `POST`/`GET /api/esports/matches[/:matchId]`,
      `POST /api/esports/matches/:matchId/start`,
      `POST /api/esports/:matchId/stake`,
      `POST /api/esports/matches/:matchId/resolve`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 17 checks, one test-fixture bug fixed: `pro-x`'s
      self-staking check needed the player's own account seeded in the
      throwaway ledger, not just the bettor/backer accounts):
      - `computeAmericanOddsPayout` matches real, hand-computed
        favorite (-150) and underdog (+130) payouts exactly.
      - `isValidAmericanOdds` rejects out-of-range and non-integer
        odds.
      - `createSportsEvent` rejects a duplicate `eventId` and invalid
        outcome odds.
      - `placeSportsBet` charges the real stake and locks in odds at
        bet time; rejects an unknown outcome and a non-open event.
      - `settleSportsEvent` pays the real, exact locked-in payout to
        winners and nothing to losers; rejects settling twice and an
        unknown winning outcome.
      - `createEsportsMatch` rejects a duplicate `matchId` and
        identical player IDs.
      - A pre-match stake is real and structurally `isFlashStake:
        false`; once `startEsportsMatch` transitions the match live, a
        new stake is structurally, automatically `isFlashStake: true`
        **even when the caller explicitly claims `false`** — proven
        adversarially, not just asserted.
      - Self-staking (a player backing themselves) is genuinely
        allowed; staking on a non-participant is rejected.
      - `resolveEsportsMatch` distributes the real pool pari-mutuel-
        style — solvent (total paid out never exceeds the real
        collected pool) and proportional; non-backers of the winner
        receive nothing; rejects resolving twice and an invalid
        `winnerId`.
      - `placeStake` rejects staking on an already-resolved match.
- [x] Verify live with both `vago/server.js` and `venvs-mock-backend`
      running together: a sportsbook bet's real $250 payout
      **independently confirmed** via `GET /api/vcoin/balance`; an
      esports match's real pari-mutuel payout independently confirmed,
      including live proof that a spoofed `isFlashStake: false` in the
      request body was genuinely overridden to `true` by the server's
      own real match state once the match had gone live.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
VAGO's three core wagering surfaces (prediction markets, sportsbook,
esports staking) plus the currency foundation are now complete. Next:
a full cross-phase regression across all four phases in one shared
store, matching the discipline used for VOID and VOKEN's own final
regression phases, before final delivery.
