# Tasks — Phase 2: Experiences

- [x] Create `lib/experiences.js`: `EXPERIENCE_STATUSES`,
      `createExperience` (real double-booking guard against the host's
      own schedule), `getExperience`, `discoverExperiences`.
- [x] Create `lib/experienceBookings.js`: `bookExperience` (real
      capacity decrement + escrow charge), `getExperienceBooking`,
      `completeExperienceBooking` (real dual payout).
- [x] Extend `createVacayStore()` with `experiences`/`nextExperienceId`,
      `experienceBookings`/`nextExperienceBookingId`.
- [x] Wire `server.js`: 6 new endpoints (`/api/experiences`,
      `/api/experiences/:id`, `/api/experience-bookings`,
      `/api/experience-bookings/:id`,
      `/api/experience-bookings/:id/complete`), `experienceStatuses`
      added to the health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 23 checks): validation (missing hostId/description,
      non-positive price); real capacity tracking; discovery includes
      open/future experiences; the double-booking guard rejects an
      exact-overlap case (naming the real conflicting experience) and
      allows back-to-back scheduling; a real booking charges the guest
      and decrements capacity; the experience becomes `full` at zero
      remaining capacity and drops out of discovery; a booking against
      a full experience rejected; real dual payout matches the exact
      15.5%/84.5% split; double-completion rejected.
- [x] Verify live with `vacay/server.js` and `venvs-mock-backend`
      running independently: a real capacity-2 experience, two real
      bookings filling it, a real rejected third booking, and real
      completion settlement, all confirmed against the actual server
      and the real V3 mock ledger.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
VOID ground-transport/cleaning integration, VOID Hourly for
sightseeing, VPLAN itinerary generation, cancellation/refunds, the
real host-cancellation-guarantee/photo-verification differentiation
opportunities, and Flights+Stays bundling -- all still deferred, per
Phase 1's own README notes.
