# Tasks — Phase 3: Card Engagement Tracking, Explore Page, Creator Digital Profile

- [x] Create `lib/cardEngagement.js`: `ENGAGEMENT_TYPES`,
      `DEFAULT_VELOCITY_WINDOW_MINUTES`, `recordEngagementEvent`,
      `computeEngagementStats`.
- [x] Create `lib/exploreVoken.js`: `getVokenExplorePage` (reuses
      Phase 1's `computeDigitalEngagementScore`).
- [x] Create `lib/creatorDigitalProfile.js`: `RISING_VELOCITY_THRESHOLD`,
      `computeCreatorDigitalProfile`.
- [x] Extend `createVokenStore()` with `cardEngagementEvents`.
- [x] Wire `server.js`: 4 new endpoints (`POST /api/card/:id/engagement`,
      `GET /api/card/:id/engagement`, `GET /api/explore`,
      `GET /api/creator-digital-profile/:creatorId`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 8 checks, all passed clean on first run):
      - `recordEngagementEvent` rejects an invalid type.
      - `computeEngagementStats` returns correct real per-type totals
        (50 views, 20 likes, 5 comments, 0 clicks, hand-verified); a
        real, adversarial velocity test confirms an old event (200
        minutes back) still counts in the lifetime total but is
        correctly excluded from the windowed velocity rate.
      - `getVokenExplorePage` ranks the genuinely more-engaged card
        above the quiet one, sorted descending.
      - `computeCreatorDigitalProfile`: aggregates correctly across a
        creator's own cards; returns real zeroed data (not an error)
        for a creator with no cards; only flags `risingIndicator` when
        average velocity genuinely exceeds the real 5-events/min
        threshold (checked with 400 events in the window, ~6.67/min);
        rejects a missing `creatorId`.
- [x] Verify live with `voken/server.js` running alone: two cards
      minted with clearly different real engagement levels; the
      Explore page correctly ranked the more-engaged card first
      (4.69 vs. 0.92 attention score); a Creator Digital Profile
      correctly returned real, non-zero data for the active creator
      and real, zeroed data for a creator with no registered cards.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 4: VEX brokerage trading, built behind the compliance gate the
architecture doc explicitly calls for.
