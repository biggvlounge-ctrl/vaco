# Tasks — Phase 2: ecosystem-wide Shield default cutover

- [x] Grep every `.js` file for `SHIELD_API_URL\s*||` (3 found:
      `vaco-shell/server.js` + 2 frontend Vite clients).
- [x] Grep `.env.example` files for the same stale default
      (`vaco-shell/.env.example`, `venvs/.env.example`).
- [x] Swap the fallback default `8791` → `8812` in all 3 real callers
      and both `.env.example` files.
- [x] Grep-confirm zero `8791` Shield defaults remain, 3 real `8812`
      defaults present.
- [x] Live pass with **no env override**: real Shield + `vaco-shell`
      started with `SHIELD_API_URL` unset, a real login through
      `vaco-shell`'s own unmodified `POST /api/session` route, the
      resulting token confirmed valid both directly against Shield and
      through `vaco-shell`'s own unmodified proxy.
- [x] Shut down all test servers.
- [x] Update `shield/README.md`'s "Switching an app over" section into
      a real "Ecosystem cutover (done)" section.
- [x] Write this plan/tasks pair (paired with `../v3/`'s identical
      Phase 2 for the V3 half of the same cutover).

## Next
Real credential/password authentication is still the one genuinely
undocumented gap — unaffected by this cutover, which only changed
which service issues sessions, not how identity is proven.
