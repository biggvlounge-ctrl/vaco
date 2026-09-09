# Tasks — Phase 9: VAGO Casino + VACAY Experiences districts

- [x] Grep VAGO's real `server.js` routes for the Mines game's real
      request/response shapes -- no field guessed.
- [x] Grep VACAY's real `bookings/routes.js` for its real routes;
      confirmed Experiences has a browse-all route and Stays doesn't --
      this decided which VACAY resource to embed.
- [x] Write `vdp/src/lib/vagoClient.js` (thin client: casino session,
      Mines start/reveal/cash-out).
- [x] Write `vdp/src/lib/vacayClient.js` (thin client: list open
      experiences, create/book/cancel).
- [x] Add `vago` district to `world.js` at the one open 3rd-row slot.
- [x] Add `vacay` district to `world.js` in a new 4th row; grow
      `WORLD_HEIGHT` 860 -> 1140 to fit it.
- [x] Write `VagoView.jsx` (Mines board UI, modeled on `VadoView.jsx`).
- [x] Write `VacayView.jsx` (host/book/cancel UI, modeled on
      `VadoView.jsx`).
- [x] Wire both into `WorldView.jsx`'s import list + contentType/id
      switch; add both to `DISTRICT_COLORS`.
- [x] Live-verify in a real Playwright browser pass against all 5 real
      servers: VAGO Mines round start -> reveal -> cash-out with a real
      payout; VACAY host -> book -> cancel with real capacity tracking.
- [x] Found + fixed a real bug: `VacayView`'s cancel handler didn't
      refresh the experience list, leaving displayed capacity stale.
      Re-verified fixed.
- [x] Confirmed VACAY's real double-booking guard surfaces as an
      honest UI error, not a silent failure.
- [x] Update `world.js`'s own header (contentType vocabulary) and
      `README.md` (new integration paragraph + Verified entry).

## Next
VACAY Stays and VACAY Home/Auto still have no VDP district -- Stays
specifically blocked on VACAY's own backend having no browse-all
listings route (see this phase's plan.md). Not part of this phase's
scope.
