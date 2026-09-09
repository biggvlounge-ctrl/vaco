# Tasks — Phase 7: Full Cross-Phase Regression

- [x] Write one throwaway `.cjs` regression script exercising every
      module from Phases 1–6 in a single shared store:
      - 5 Cvltvre cards across 4 categories, each with the real
        subject-#1 guarantee confirmed.
      - Established Creator Assessment for a large profile (never
        `common`).
      - Kenji onboarding: a proactive invitation always accepted, a
        weak self-initiated request correctly declined.
      - A card pack opened with a fixed `rng` for a deterministic
        regression total, minting exactly `cardsPerPack` real editions.
      - A raffle entered by two users, drawn to a real winner with a
        real minted edition.
      - A cross-card, cross-user trade accepted with genuine ownership
        swapped on both sides.
      - General Explore surfacing all 5 cards, ranked by real
        engagement; Creator Digital Profile non-zero for the engaged
        subject, zero for a stranger; exactly 5 real engagement events
        recorded.
      - VEX brokerage: buy rejected before the gate clears, buy+sell
        both real and reflected correctly in the ledger once cleared.
      - All four VADO auction types (instant/english/dutch/offer)
        settled for real against one shared art card, each edition's
        final owner independently confirmed.
      - VADO Explore correctly scoped to art-only (2 of 5 cards);
        gallery holdings correctly reflecting real ownership from the
        settled auctions.
      - Fractional ownership on a third, untouched card: gate closed
        rejects, cleared allows, two independent investors' stakes
        tracked correctly.
      - Merch dynamic pricing genuinely rising across two sequential
        real purchases.
      - Digital art frame: real load for a genuine owner, real
        rejection for a non-owner, both frames counted.
      - **Final sanity check**: every one of the store's 15 collections
        holds exactly its expected count, and the hand-computed global
        edition total (19) matches
        `store.cultureCards.reduce((sum, c) => sum + c.editions.length, 0)`
        exactly.
      - All 17 checks passed clean on the first run — no bugs found in
        cross-module interaction.
- [x] Live smoke test: `voken/server.js` started alongside
      `venvs-mock-backend`, `GET /api/health` and a real
      `POST /api/card` both confirmed against the running server with
      every module wired.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Delete the throwaway script; commit `dev-docs/` as its own
      change (no `lib/`/`server.js` changes this phase — pure
      verification).

## Next
VOKEN is feature-complete against all five source docs. Final delivery
step: push the complete `voken/` project (this session's push attempts
via both `git` and the GitHub MCP `push_files` tool are currently
blocked by a 403 -- the connected GitHub App lacks write/contents
access to this repository, confirmed independently from two separate
local clones and the MCP tool; this needs to be resolved by granting
that access, not fixable from within this session).
