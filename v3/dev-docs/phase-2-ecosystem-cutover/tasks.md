# Tasks — Phase 2: ecosystem-wide V3 default cutover

- [x] Grep every `.js` file for `V3_API_URL\s*||` to find every real
      caller and its exact current default (15 found: 13 backend, 2
      frontend).
- [x] Grep every `.env.example` for the same stale default (8 found).
- [x] Swap the fallback default `8791` → `8811` in all 13 backend
      `server.js`/lib files.
- [x] Swap the fallback default `8791` → `8811` in both frontend Vite
      clients (`venvs/src/lib/v3Client.js`, `vdp/src/lib/v3Client.js`).
- [x] Swap the same default in all 8 `.env.example` files.
- [x] Grep-confirm zero `8791` V3 defaults remain, 15 real `8811`
      defaults present.
- [x] Live pass with **no env override**: real V3 + VAGO started with
      `V3_API_URL` unset, a real casino stake placed through VAGO's own
      unmodified route, balance confirmed moved on V3 directly
      (`1000 → 950`).
- [x] Shut down all test servers.
- [x] Update `vaco-shell/lib/registry.js`'s `v3`/`v3-shield` entry
      descriptions to reflect the real cutover, not "not yet the
      default."
- [x] Update `v3/README.md`'s "Switching an app over" section into a
      real "Ecosystem cutover (done)" section listing every switched
      app.
- [x] Write this plan/tasks pair.

## Next
`venvs-mock-backend` itself is untouched and still runs — it's simply
no longer any real app's default. No app's env var was force-set; an
app can still explicitly point back at the mock if needed.
