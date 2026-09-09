# Tasks — Phase 6: The Dating Village

- [x] Investigate: confirm the Dating Village's own precedent citation
      ("the same pattern already established for VXLLAGE's Village") is
      real and true, by confirming Village District is genuinely built
      and live-verified in this same file (Phase 5) — unlike the
      Village District's own false VAGO citation.
- [x] Investigate: confirm CVNVO has no "rooms" concept the way VXLLAGE
      does, and that BarBuddy is CVNVO's own already-real, already-
      proportionate equivalent — grounds for a one-venue district
      rather than a second interior map.
- [x] `src/lib/cvnvoClient.js` — real, thin HTTP client into CVNVO's own
      API (venue check-in/checkout, visible-users lookup, proximity
      events + feed, FlashNotes).
- [x] `src/lib/datingVillage.js` — `DATING_VILLAGE_VENUE_ID`,
      `DATING_VILLAGE_COORDS` (the shared St. Louis anchor),
      `enterDatingVillage` (idempotent check-in + real proximity
      crossings with every other visible player), `leaveDatingVillage`,
      `getDatingVillageFeed`, `sendDatingVillageFlashNote`.
- [x] `src/components/DatingVillageView.jsx` — real "Here right now"
      list, real FlashNote send form, real crossing feed, real
      best-effort checkout on unmount.
- [x] `src/lib/world.js` — new `contentType: 'cvnvo-embed'` (documented
      in the header alongside the other 4), the real 8th `dating-village`
      district entry (row 3, column 3).
- [x] `src/components/WorldView.jsx` — import `DatingVillageView`, new
      render branch, `DISTRICT_COLORS` entry, header comment updated.
- [x] `npm run build` — confirmed clean after each edit ("✓ 50 modules
      transformed").
- [x] Verify live in a real browser (Playwright, `venvs-mock-backend` +
      `vaca` + `cvnvo` + `vdp` all running), with a real second user
      ("carol") pre-seeded via a direct curl call to CVNVO's own
      `/api/barbuddy/check-in`: walked to the real 8th district,
      entered it, real "CVNVO Dating Village" header rendered; carol
      confirmed appearing in "Here right now"; a real proximity
      crossing with carol confirmed recorded and rendered in the feed;
      a real FlashNote sent and independently re-confirmed via a direct
      server-side read of CVNVO's own `/api/flash-notes/carol`.
- [x] One test-script bug found and fixed during this exact pass (not
      an app bug): `button:has-text("Send")` ambiguously matched both
      the "Send a FlashNote" list button and the form's own "Send"
      submit button — fixed with an exact-text selector
      (`button:text-is("Send")`).
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `vdp/README.md` (intro, Run, What's here, Verified, Not
      yet built).
- [x] Update `cvnvo/README.md` — removed "CVNVO's presence inside
      VENVS/VDP's Dating Village" from its own "Not yet built" list,
      added a cross-reference entry to its own "Verified" section.
- [x] Write this plan/tasks pair.

## Next
The other seven CVNVO dating-format extensions (Speed Dating,
Long-Distance Mode, Blind Date, Group Dating, Gift Dating, Snap Map
location sharing, Hunts Dates) have no VDP-district surface yet. VDP's
own hardcoded single-user login means real multi-player testing inside
one live browser session still isn't possible.
