# Tasks — Phase 7: HILO, Flex Play, Originals table limits

- [x] Re-read `originals.js`, `fantasy.js`, `casinoSession.js` headers
      to match existing real patterns exactly.
- [x] `casinoSession.js` — `ORIGINALS_MIN_STAKE`/`ORIGINALS_MAX_STAKE`,
      enforced only for `gameType === 'originals'`.
- [x] `originals.js` — `HILO_CARD_VALUES`, `HILO_DIRECTIONS`,
      `drawHiloCard`, `computeHiloMultiplier`, `startHiloRound`,
      `guessHilo` (real push + guaranteed-loss guard), `cashOutHilo`;
      `publicRoundView` extended for the `hilo` game shape.
- [x] `fantasy.js` — `PLAY_TYPES`, `FLEX_MIN_PICKS`,
      `FLEX_PAYOUT_TABLE`; `createFantasyEntry` accepts `playType`;
      `gradeFantasyEntry` handles Flex grading (clean sweep, miss-one,
      miss-two-plus, and the push-driven below-`FLEX_MIN_PICKS` edge
      case).
- [x] `server.js` — 3 new HILO routes
      (`start`/`:id/guess`/`:id/cash-out`), health payload extended
      with `hiloCardValues`/`fantasyFlexMinPicks`/`fantasyFlexPayoutTable`.
- [x] 8 plain-Node checks — all passing.
- [x] Live pass: real V3 + VAGO started (post-cutover defaults, no
      override needed), a real HILO round played to a loss with the
      seed independently verified, a real 3-pick Flex entry missing
      exactly one pick paid its real `100` reduced payout, both
      confirmed against V3's own balance endpoint.
- [x] Shut down all test servers.
- [x] Update `vago/README.md` — new Phase 7 bullets in "What's here",
      a new "Verified" paragraph, and the three now-closed items
      removed from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Live-dealer and game-show outcome logic remain the one real Originals
gap still open — both need real video/human-dealer infrastructure this
session doesn't build.
