# Tasks — Phase 2: real music/podcast distribution

- [x] Investigated Vvltvre Pods' own `publishEpisode` /
      `distributeEpisodeViaVultureMusic` as the real precedent for
      this kind of cross-app hand-off.
- [x] Confirmed Vvltvre Music's own `podcast-episode` format is
      already documented as a standalone item, avoiding the need to
      fabricate Vvltvre Pods Show/Episode metadata this project's own
      schema doesn't have.
- [x] Added `getInvestorCoWriterSplits` to `lib/projects.js`, exported
      it — reuses the same raw contribution totals
      `reportProjectRevenue` already uses internally.
- [x] Added the double-accounting guard to `reportProjectRevenue`:
      rejects once `distributionApp === 'vulture-music'`, naming the
      correct real endpoint to use instead.
- [x] Added `registerWithVultureMusic` to `server.js` — real cross-app
      POST to Vvltvre Music's `/api/releases`, same
      wrap-and-reprefix-with-"distribution call failed:" pattern as
      `registerWithVultureFlix` for reliable 502-vs-400 classification.
- [x] Rewrote the `distribute` route: added the real, previously-
      missing `project.status !== 'completed'` check before any
      cross-app call fires (for every medium, not just the new one),
      then branches film/tv -> Vvltvre Flix, music/podcast -> Vvltvre
      Music, else a real 400 for any unsupported medium.
- [x] `node --check` on `server.js` and `lib/projects.js` — passed.
- [x] Wrote 3 real unit tests to a scratchpad file, ran them — all
      passed. Deleted the scratch test file.
- [x] Started real V3/Vvltvre Music/Vvltvre Studios servers, ran the
      full real flow: greenlight a music project -> pre-completion
      distribute correctly rejected (400) -> two investors finance it
      70/30 -> start-production -> complete -> distribute (confirmed
      real Vvltvre Music release created with the correct `coWriters`
      and the real fee charged to the studio's production account,
      independently re-confirmed via Vvltvre Music's own `GET
      /api/releases/:id`) -> confirmed this app's own revenue endpoint
      now rejects a call for that project -> advanced the release
      through Vvltvre Music's own `distributing -> live` gate ->
      reported real revenue there -> confirmed the exact real 70/30
      payout via direct V3 balance checks.
- [x] Ran a second, real podcast project through the same flow,
      confirmed the `podcast-episode` format/platform mapping and a
      correct 100%-single-investor split.
- [x] Killed all test server processes; removed their `data/` dirs.
- [x] Updated `README.md`: new "Real music/podcast distribution
      (Phase 2)" section; removed the now-closed bullet from "Not yet
      built".

## Next
The remaining self-flagged gap is a real VDP district for Vvltvre
Studios — not started in this phase.
