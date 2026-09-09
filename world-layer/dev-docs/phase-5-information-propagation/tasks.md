# Tasks — Phase 5: Information Propagation Engine

- [x] Add `informationEvents: []`, `nextInformationEventId: 1` to
      `createWorldLayer()` in `locations.js`.
- [x] Create `world-layer/propagation.js`: `originateEvent`,
      `getInformationEvent`, `calculatePropagation`, `propagateEvent`,
      `getPropagationsForLocation`, `DISTANCE_DECAY_CONSTANT`.
- [x] Wire `world-layer/index.js` to also export `propagation.js`.
- [x] Add `world_information_events` + `world_information_propagations`
      to `schema.sql`.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `originateEvent` throws on missing `eventType` and on a
        nonexistent `originLocationId`.
      - Two events with different, non-enumerated `eventType` values
        (`'rumor'`, `'faction_war_declared'`) both generate correctly
        — confirms `eventType` is genuinely unconstrained.
      - `calculatePropagation` throws on negative `distance`,
        out-of-range `connectivity`/`trustNetwork`, and a non-boolean
        `languageBarrier`.
      - Closer `distance` produces a higher `spreadProbability` than
        farther `distance` (same other inputs) — checked directly.
      - `languageBarrier: true` produces a lower `spreadProbability`
        than `false` (same other inputs) — checked directly.
      - `spreadProbability` stays within [0, 100]; `timeDelay` is
        always ≥ 1.
      - `propagateEvent` throws on a nonexistent event id or target
        location id.
      - `propagateEvent` records the correct `locationId`, and
        `arrivesTick` equals the World Layer's `tick` at call time plus
        the computed `timeDelay` (checked with `tick` manually
        advanced to 3 mid-test).
      - `getPropagationsForLocation` aggregates propagations from
        multiple different events targeting the same location, and
        each result carries the originating event's `eventType`.
      - Regression: Phase 1 (`generateLocation`) used in the same run,
        unaffected.
- [x] Commit as its own change.

## Next
Deriving `connectivity` from real Transportation Network data (Phase
4) instead of a caller-supplied number, and actually resolving
`spreadProbability` into a yes/no propagation outcome, are both
believable next steps — not done here.
