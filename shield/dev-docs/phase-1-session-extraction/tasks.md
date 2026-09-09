# Tasks — Phase 1: real Shield session extraction

- [x] Investigate: read the mock's own real Shield contract and
      `venvs/CLAUDE.md` §0.2; find all three real existing clients
      (`venvs`, `vdp`, `vaco-shell`); confirm no real credential system
      is specified anywhere.
- [x] New app scaffold: `package.json`, `.gitignore`, `lib/store.js`,
      `server.js`.
- [x] `lib/sessions.js` — `SESSION_LIFETIME_MS`, `createSession`
      (real unguessable token, one flagged deviation from the mock),
      `getSession`.
- [x] `server.js` — real Express API matching the mock's own real
      Shield routes exactly; V3's own routes deliberately excluded.
- [x] 7 plain-Node checks — all passing.
- [x] Live pass: direct contract parity over real HTTP (session
      creation, validation, unknown-token and missing-userId
      rejections matching the mock's exact error text).
- [x] **The defining verification**: `vaco-shell` (already-built,
      unmodified) started with only `SHIELD_API_URL` repointed — a
      real login through its own existing `/api/session` route, the
      resulting real token independently confirmed valid both
      directly against this service and through `vaco-shell`'s own
      existing `/api/session/:token` proxy. Zero code changes to
      `vaco-shell`.
- [x] Shut down all test servers; confirmed via process list.
- [x] Write `README.md`, including the "Switching an app over"
      section.
- [x] Register in `vaco-shell/lib/registry.js` (port 8812).
- [x] Write this plan/tasks pair.

## Next
Real credential/password authentication remains a real, undocumented,
flagged gap. Every existing Shield client still defaults to
`venvs-mock-backend` — switching each one over is a deliberate,
per-app follow-up.
