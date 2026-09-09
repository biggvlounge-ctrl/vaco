# Tasks — Phase 2: Docker Compose deployment

- [x] Checked Docker/Docker Compose CLI availability in this sandbox
      (present) and daemon availability (not startable — no ulimit
      permission) before committing to a verification plan.
- [x] Grep-verified every real `process.env.*_API_URL` reference
      across every `server.js` in the repo, and every real
      `import.meta.env.VITE_*` reference across `vdp`/`venvs` client
      files — built the real `ENV_VAR_TO_SERVICE` table and the real
      Vite build-arg list from that, not from memory or assumption.
- [x] Grep-verified the real persisted-app list
      (`grep -l createPersistentStore */server.js`) — 24 apps.
- [x] Built `deploy/Dockerfile.node` (shared, all ~28 Express
      backends) and `deploy/Dockerfile.vite` (shared, both real Vite
      frontends, multi-stage build + `serve`).
- [x] Fixed a real correctness issue in `Dockerfile.vite` before it
      was ever tested: `ARG` alone isn't reliably visible to `RUN npm
      run build`'s process environment — re-declared every
      `VITE_*_API_URL` as `ENV` immediately before the build step.
- [x] Built `deploy/generate-docker-compose.js`, reading the same
      manifest `ecosystem.config.js`/`generate-nginx-conf.js` already
      use.
- [x] Extended `deploy/generate-nginx-conf.js` with a real `--docker`
      mode (service-name upstreams, `proxy_pass` instead of `alias`
      for `/vdp/`/`/venvs/`) rather than writing a second, duplicate
      script.
- [x] Ran both generators; validated the real output with `docker
      compose config` (real parsing + interpolation, no daemon
      required) — confirmed the `ANTHROPIC_API_KEY` guard rejects a
      missing value and validates clean once set, confirmed per-app
      env-var scoping is correct (spot-checked `vulture-studios`
      against its real 4 dependencies, `v4-search` against its real
      zero), confirmed exactly 24 named volumes.
- [x] Structurally validated `deploy/nginx-docker.conf` (balanced
      braces, all 31 expected `location` blocks present exactly once)
      — real `nginx -t` still isn't installable in this sandbox, same
      limit the original VPS config's own README section already
      disclosed.
- [x] Generated real `.dockerignore` files (excluding `node_modules/`,
      `data/`, `.git/`) into all 30 app directories in the manifest.
- [x] Added root `.env.example` documenting the one real, required
      secret (`ANTHROPIC_API_KEY`).
- [x] Updated `deploy/README.md` with the real Docker Compose section,
      the explicit Docker-over-Render reasoning, and an honest
      disclosure of what was and wasn't actually verified (no real
      `docker compose up --build` was possible in this sandbox).

## Next
The real first test is the user's own `docker compose up --build`
against every one of the ~30 real images. A real `HEALTHCHECK`
directive per service (backed by each app's own already-real
`/api/health`) is a reasonable, small follow-up once that first real
build is confirmed working — not attempted here since it would be one
more unverified claim stacked on top of an already-unverified build.
