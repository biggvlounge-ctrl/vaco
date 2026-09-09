# Tasks — Phase 2 (ninth slice): cancellations/refunds

- [x] Investigate: read `lib/bookings.js` in full to confirm the real
      escrow model and that no cancel/refund path exists; grep
      `VOID_MAGIC_MASTER_BUILD_BRIEF.md` for any real cited
      cancellation window or refund percentage (none found).
- [x] `lib/bookings.js` — added `CANCELLATION_CUTOFF_HOURS = 24`
      (real, flagged, grounded in Airbnb Experiences' own real
      cancellation policy) and `cancelBooking`.
- [x] `lib/notifications.js` — added real, flagged 15th type
      `booking-cancellation`.
- [x] `server.js` — wired `POST /api/bookings/:id/cancel`; exposed
      `cancellationCutoffHours` on `/api/health`.
- [x] 9 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `voidmagic`: a real
      early cancellation (full refund, slot reopened) and a real late
      cancellation (no refund, real $84.50/$15.50 host/platform
      settlement, escrow returned to its starting balance), plus
      double-cancel and unknown-booking rejections, all confirmed over
      real HTTP.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Host-initiated full-experience cancellation and a configurable
per-experience refund policy remain real, out-of-scope gaps — the
brief names neither with enough detail to build now.
