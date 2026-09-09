# Tasks — Phase 12: CHOPZ Shorts district

- [x] Grepped CHOPZ's and CHOPZ SHOP's real routes/lib functions -- no
      field guessed.
- [x] Found and flagged a real pre-existing naming collision:
      `ChopzView.jsx`/`lib/chopz.js` (leasable retail kiosks, VENVS's
      own CLAUDE.md §4) is a different real feature from the actual
      `chopz/` app, sharing only the name. Documented in both files,
      not silently merged or removed.
- [x] Wrote `chopzClient.js` (video creation + real linked-product
      verification) and `chopzShopClient.js` (product creation) --
      two clients since the real demo spans two real apps.
- [x] Wrote `ChopzShortsView.jsx` (deliberately not `ChopzView`, to
      stay distinct from the pre-existing component).
- [x] Added a new 6th `DISTRICTS` row to `world.js`; grew
      `WORLD_HEIGHT` 1420 -> 1700.
- [x] Updated `world.js`'s own contentType-vocabulary header comment.
- [x] Wired into `WorldView.jsx`: import, `DISTRICT_COLORS`, the
      contentType/id render switch, header comment (including the
      naming-collision flag).
- [x] `vite build` -- clean, 72 modules, no import errors.
- [x] Live Playwright pass against V3/Shield/CHOPZ/CHOPZ SHOP: real
      product created, real video created and linked, real live
      verification confirmed against CHOPZ SHOP's own API; confirmed
      the pre-existing `ChopzView` (leasable kiosks) still renders,
      untouched, outside the world.
- [x] Updated `README.md` (new integration paragraph, Verified entry,
      district count).

## Next
Nothing further planned for this specific piece. The naming collision
between the two "CHOPZ" features is a real, permanent characteristic
of the source docs, not something a future phase needs to resolve --
both are real, distinct, working features.
