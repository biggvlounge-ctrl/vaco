# Tasks — Phase 1: Cvltvre Card core + the real Value Algorithm

- [x] Create `lib/cardTypes.js`: `CATEGORIES`, `RARITY_TIERS`,
      `TOKENIZATION_TYPES`, `FORMATS`.
- [x] Create `lib/cultureCards.js`: `mintCultureCard`, `getCultureCard`,
      `listCultureCardsByCategory`, `countMintedEditions`,
      `mintAdditionalEdition`, `transferEditionOwnership`.
- [x] Create `lib/valueAlgorithm.js`: `computeTraditionalScore`,
      `computeDigitalEngagementScore`, `computeGenuineSignificanceScore`,
      `computeCombinedRealValueScore`, `computeCultureCardValueScore`.
- [x] Create `lib/establishedCreatorAssessment.js`: `computeExternalScore`,
      `assessEstablishedCreator`, `ELIGIBLE_TIERS`.
- [x] Scaffold `server.js`, `package.json`, `.env.example`, `.gitignore`.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script,
      deleted after — 18 checks, all passed clean on first run):
      - `mintCultureCard`: rejects invalid category/rarity/
        tokenizationType/empty formats/non-positive mint count;
        guarantees the subject both digital and physical edition #1
        when both are planned; correctly skips the physical guarantee
        when `plannedPhysicalMintCount` is 0; exposes mint
        transparency on every card.
      - `mintAdditionalEdition`: assigns sequential edition numbers;
        enforces the real mint cap (a card with
        `plannedDigitalMintCount: 1` correctly rejects any further
        digital mint, since the subject's guarantee already consumed
        the entire run); rejects an unknown card and an invalid
        format.
      - `transferEditionOwnership` rejects a mismatched
        `fromOwnerId`, succeeds for the real owner.
      - `listCultureCardsByCategory` scopes correctly.
      - `computeTraditionalScore`: a true 1/1 scores meaningfully
        higher than a 500-print run; rejects invalid inputs.
      - `computeDigitalEngagementScore`: identical raw totals score
        higher with real positive engagement velocity than with none.
      - `computeGenuineSignificanceScore`: confirmed independent of
        engagement; rejects invalid inputs.
      - **The MLK test**: a card with immense genuine significance but
        modest real-time engagement genuinely outranks a card with
        massive viral engagement and no lasting substance in the
        combined score — the algorithm's stated design goal proven,
        not just asserted.
      - `computeCombinedRealValueScore` rejects out-of-range component
        scores.
      - `assessEstablishedCreator`: never assigns the blank-slate
        `common` tier; a genuinely bigger real profile produces a
        genuinely higher tier than a small one; rejects invalid
        inputs.
- [x] Verify live with `voken/server.js` running alone:
      - A real card minted (`music`, `legendary`, digital+physical
        formats, 500/50 mint plan) — subject correctly holds both
        digital and physical edition #1.
      - An additional digital edition minted to a live buyer.
      - A live value score computed for the same MLK-style scenario
        (`traditionalScore: 44.91`, `digitalEngagementScore: 56.11`,
        `genuineSignificanceScore: 100`, `combinedRealValueScore: 68.11`),
        matching the plain-Node result.
      - A live established-creator assessment for a genuinely large
        real profile correctly returned `mythic`, never `common`.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 2: card mechanics on top of this foundation — packs, raffles,
trading, and Kenji's two-path onboarding/application flow.
