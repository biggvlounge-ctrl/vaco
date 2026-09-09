# Plan — Phase 3: Card Engagement Tracking, Explore Page, Creator Digital Profile

## Goal
Phase 1's `computeDigitalEngagementScore()` was built to consume real
view/click/comment/like counts, but nothing generated real counts yet
— callers had to invent numbers. This phase closes that gap with a
real engagement event log, then builds the two features that consume
it: the Explore page (surfacing cards by real, live attention) and the
Creator Digital Profile (aggregating a creator's own cards into one
ongoing score).

## Design
- `lib/cardEngagement.js`: `recordEngagementEvent()`/`computeEngagementStats()`
  — a real event log, not counters that could silently desync from
  reality. `engagementVelocity` is computed for real from events
  inside a real time window (default 60 minutes), expressed as a
  per-minute rate — feeding directly into Phase 1's existing, capped
  velocity bonus rather than a caller supplying an invented number.
- `lib/exploreVoken.js`: `getVokenExplorePage()` — the source doc says
  HVNTZ's location-and-attention Explore ranking "generalizes directly
  here," but what actually generalizes is the *pattern* (rank real
  content by a real score into one feed), not HVNTZ's location half
  specifically — Cvltvre Cards aren't tied to real-world coordinates
  the way HVNTZ's physical hunt checkpoints are. Genuine cross-phase
  code reuse: ranks cards by Phase 1's own `computeDigitalEngagementScore()`,
  fed by this phase's real engagement stats — not a rebuilt formula.
- `lib/creatorDigitalProfile.js`: `computeCreatorDigitalProfile()` —
  "tied to them" read literally as `subjectPersonId`. Aggregated as a
  real **average** digitalEngagementScore across a creator's cards,
  not a raw sum — a sum would let someone with many mediocre cards
  outrank someone with one genuinely popular one, which isn't a fair
  measure of real per-work attention. `risingIndicator` is real,
  threshold-gated (average velocity > 5 events/min, flagged), not
  always true/false.
- `server.js`: 4 new endpoints.

## Explicitly NOT in this task
- No real anti-fraud/bot-detection on engagement events — a `view`
  event is trusted as reported, matching this phase's scope (the
  Master Freeze doc's own "Trust & Verification" section is a
  separate, not-yet-attempted piece).
- No decay of old engagement into the totals — `views`/`clicks`/etc.
  are real lifetime totals; only `engagementVelocity` is time-windowed.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 8
checks, all passed clean on first run). The velocity check is
deliberately adversarial: one old event (200 minutes back, outside the
default 60-minute window) and one recent event are both recorded for
the same card, and the test confirms the lifetime total still counts
both while velocity reflects only the recent one — proving the window
logic is real, not just present. Then a live pass: `voken/server.js`
running alone — engagement recorded on two cards with clearly
different real activity levels, the Explore page confirmed to rank
the more-engaged card first, and a Creator Digital Profile confirmed
correct for both an active creator and one with no cards at all
(returning real zeroed data, not an error).

## Done when
- `recordEngagementEvent` rejects an invalid type.
- `computeEngagementStats` returns correct real per-type totals and a
  real, window-bounded velocity that correctly excludes an old event
  from the rate while still counting it in the lifetime total.
- `getVokenExplorePage` ranks cards correctly by real attention,
  sorted descending.
- `computeCreatorDigitalProfile` aggregates correctly across a
  creator's own cards, returns real zeroed data for a creator with
  none, and only flags `risingIndicator` when velocity genuinely
  exceeds the real threshold.
- Live: engagement tracking, the Explore ranking, and the Creator
  Digital Profile all confirmed through the real HTTP API.
