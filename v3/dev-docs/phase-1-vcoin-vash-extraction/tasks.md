# Tasks — Phase 1: real V3 (VCoin/VASH) extraction

- [x] Investigate: read `venvs-mock-backend/server.js` in full;
      confirm VACA's own prior extraction as precedent; confirm V3 and
      Shield are real, distinct services per multiple source docs.
- [x] New app scaffold: `package.json`, `.gitignore`, `lib/store.js`,
      `server.js`.
- [x] `lib/vcoin.js` — `STARTING_VCOIN_BALANCE`, `getBalance`,
      `transfer`, `getTransactionHistory`, all byte-for-byte matching
      the mock's own real behavior and error text.
- [x] `lib/vash.js` — `VCOIN_TO_VASH_RATE`, `getVashBalance`,
      `cashout`, same parity discipline.
- [x] `server.js` — real Express API matching the mock's own real
      VCoin/VASH routes exactly; Shield's session routes deliberately
      excluded.
- [x] 8 plain-Node checks — all passing.
- [x] Live pass: every route hit directly over real HTTP, confirming
      exact contract parity with the mock (including exact error
      message text).
- [x] **The defining verification**: VAGO (already-built, unmodified)
      started with only `V3_API_URL` repointed at the new service — a
      real casino session placed through VAGO's own existing code, the
      real VCoin movement independently confirmed on the new V3
      service's own ledger. Zero code changes to VAGO.
- [x] Shut down all test servers; confirmed via process list.
- [x] Write `README.md`, including the "Switching an app over"
      section documenting the deliberate per-app, not ecosystem-wide,
      cutover path.
- [x] Register in `vaco-shell/lib/registry.js` (port 8811).
- [x] Write this plan/tasks pair.

## Next
Shield (session/auth) remains a real, separate, still-open gap. Every
other app's own `V3_API_URL` still defaults to `venvs-mock-backend` —
switching each one over is a deliberate, per-app follow-up, not done
as part of this build.
