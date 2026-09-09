# Tasks — Phase 1: Profiles + Real Gale-Shapley Matching

- [x] Scaffold the project: `package.json`, `.env.example`,
      `.gitignore`, source docs copied in (`CVNVO_ARCHITECTURE.md`,
      `CVNVO_CORE_FEATURES.md`, `CVNVO_DATING_COMPARABLES.md`,
      `CVNVO_BARBUDDY_FEATURE.md`).
- [x] Create `lib/store.js`: `createCvnvoStore()`.
- [x] Create `lib/profiles.js`: `createUserProfile`, `getUserProfile`.
- [x] Create `lib/compatibility.js`: `haversineKm`,
      `computeCompatibilityScore` (interest overlap + mutual age fit +
      distance).
- [x] Create `lib/matching.js`: `stableMatch` (the literal Gale-Shapley
      algorithm), `computePreferenceList`, `runGaleShapley`,
      `createMatch`, `getMatch`, `generateAndCreateMatches`.
- [x] Wire `server.js`: 6 endpoints (`POST`/`GET /api/profiles[/:userId]`,
      `GET /api/compatibility/:userAId/:userBId`,
      `POST /api/matches/generate` (preview, no persistence),
      `POST /api/matches` (generate + persist),
      `GET /api/matches/:id`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 12 checks, all passed clean on first run):
      - A photo-only (no prompts) profile is rejected; an empty prompt
        answer is rejected; a duplicate profile for the same user is
        rejected.
      - `haversineKm` matches a known real-world distance (NYC-LA,
        ~3,936km) within a sane tolerance.
      - `computeCompatibilityScore` genuinely rewards shared interests
        and mutual age fit over a mismatched pair.
      - Mutual age fit is proven genuinely bidirectional — a
        one-directional fit scores exactly 0.5, not 1.0.
      - **The centerpiece**: `stableMatch` produces the exact,
        hand-computed result on a worked-by-hand 3x3 case
        (A1-B1, A2-B2, A3-B3), independently re-verified via a direct
        blocking-pair stability check over every non-matched pair.
      - `runGaleShapley` rejects a group containing an unknown userId;
        correctly derives real preference rankings from real
        compatibility scores and returns a complete, valid pairing.
      - `generateAndCreateMatches` persists real Match records with a
        real 24-hour expiration and `unansweredCount: 0`.
      - `createMatch` rejects an invalid `matchType` and an
        out-of-range `compatibilityScore`.
- [x] Verify live with `cvnvo/server.js` running alone (no V3
      dependency this phase): 4 real profiles created, a live
      compatibility score confirmed for both a strong and a near-zero
      pair, and a real 2v2 match generated and persisted against the
      actual running server — surfacing the real, illustrative
      (documented in `plan.md`, not a bug) small-pool forced-pairing
      result.
- [x] Shut down the server cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Your Turn Limits (real anti-ghosting), the "We Met" feedback loop
(extending this same Match record with a real post-date check-in that
feeds both safety data and match-quality data from one action), and
Yap's decoupled reporting system — all deliberately deferred from this
foundational phase.
