# Tasks — Phase 4: real credential auth

- [x] Write `lib/credentials.js` (`registerCredentials`,
      `verifyCredentials`) using Node's built-in `crypto.scrypt` --
      no new npm dependency.
- [x] Add `credentials: {}` to `store.js`'s own factory.
- [x] Add `POST /api/shield/register` / `POST /api/shield/login`
      routes to `server.js`, additive alongside the existing `POST
      /api/shield/session`.
- [x] Real unit tests on `credentials.js` in isolation: correct
      password, wrong password, unknown user, duplicate registration,
      short password, no-plaintext-storage, per-user salting -- all 7
      passed.
- [x] Live `curl` pass against the real running server: register,
      login, wrong password (401), short password (400), duplicate
      (400), and confirmed `POST /api/shield/session` untouched.
- [x] Add real password field + Register/Log-in buttons to
      `vaco-shell/public/index.html`, alongside (not replacing) the
      existing quick-login.
- [x] Add `POST /api/register` / `POST /api/login` proxy routes to
      `vaco-shell/server.js`, same proxy shape as the existing session
      routes.
- [x] Real Playwright browser pass against `vaco-shell`'s own UI:
      register a new account, log out, log back in with the right
      password, wrong password shows a real error, and the original
      quick-login button still works.
- [x] Updated `README.md` (new Phase 4 section, corrected "Not yet
      built" bullet -- it previously named this exact gap).

## Next
No password reset, no email verification, no login-attempt
rate-limiting -- flagged directly in the updated README, not silently
skipped. The claimed-userId session route also stays intentionally
unauthenticated for ecosystem-internal callers -- a real, deliberate
scope boundary, not an oversight.
