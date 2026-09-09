# Tasks — Phase 5: Originals outcome/settlement (Plinko + Mines)

- [x] Investigate: read `lib/casinoSession.js` in full; grep both VAGO
      docs for any cited RTP/payout figure (none found); confirm
      "provably-fair" is the real named mechanic.
- [x] `lib/provablyFair.js` — real HMAC-SHA256 commit-reveal RNG
      (`generateServerSeed`, `hashServerSeed`, `deriveFloat`/
      `deriveFloats`, `verifyServerSeedHash`).
- [x] `lib/originals.js` — `ORIGINALS_RTP` (real, flagged, Stake-
      grounded), Mines (`startMinesRound`, `revealMinesTile`,
      `cashOutMines`, `computeMinesMultiplier`), Plinko
      (`startPlinkoRound`, `dropPlinkoBall`, computed
      `PLINKO_MULTIPLIER_TABLE`), `getOriginalsRound`.
- [x] `lib/casinoSession.js` — added `roundStarted` guard field.
- [x] `lib/store.js` — added `originalsRounds`/`nextOriginalsRoundId`.
- [x] `server.js` — wired `POST /api/casino/mines/start`,
      `POST /api/casino/mines/:id/reveal`,
      `POST /api/casino/mines/:id/cash-out`,
      `POST /api/casino/plinko/start`,
      `POST /api/casino/plinko/:id/drop`,
      `GET /api/casino/rounds/:id`; exposed `originalsRtp`/
      `minesCountBounds`/`plinkoRows` on `/api/health`.
- [x] 10 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vago`: a real
      gold-coin Mines round (commitment-only reveal, real safe
      reveals, real cash-out, seed verification), a real gold-coin
      Plinko drop, a real vcoin Plinko round independently confirmed
      against the mock V3 ledger on both the player and `vago-house`
      accounts, plus unknown-round/invalid-`minesCount`/duplicate-
      reveal rejections, all over real HTTP.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
HILO (the comparable doc's third named Originals game),
live-dealer/game-show outcome logic, and host-configurable table
limits remain real, flagged gaps.
