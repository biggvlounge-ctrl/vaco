# Tasks — Phase 17: full technical rename to Vex Business

- [x] Grepped every real `call-`/bare `CALL` occurrence tree-wide
      before touching anything; confirmed each hit was genuinely the
      product name (no English "call" false positives).
- [x] `git mv call vex-business` (history preserved).
- [x] Scripted rename: `call-[a-z]+` -> `vexbusiness-[a-z]+` across all
      `*.toml`/`*.py`/`*.ts`/`*.tsx`/`Makefile`/`*.yml`/`*.ini`
      (excluding `dev-docs/`).
- [x] Scripted rename: bare `CALL` -> `Vex Business` across the same
      file set (excluding `dev-docs/`, `README.md`,
      `packages/research` — handled by hand).
- [x] `README.md`: new top section explaining this is a full rename
      (not the earlier display-only one), old-framing paragraphs
      rewritten rather than blindly word-swapped.
- [x] `packages/research/pyproject.toml` + `comparables.py`: fixed the
      one paragraph that literally described "Vex Business" as a
      display name layered on the (still-`call`) codebase, now stale.
- [x] `apps/api/api/main.py`: FastAPI `title=` and `/api/health`'s
      `"service"` literal.
- [x] `apps/web/app/layout.tsx` (page title), `app/page.tsx` (`<h1>`),
      `apps/web/package.json` (`name`/`description`).
- [x] `CALL_API_URL` -> `VEXBUSINESS_API_URL` in both proxy routes,
      `page.tsx`, and `docker-compose.yml`'s `web` service.
- [x] `docker-compose.yml`, `.env.example`, `config/settings.py`:
      Postgres user/password/db/volume/connection-string literals
      (`call` -> `vexbusiness`), kept consistent across all three.
- [x] `infra/docker/Dockerfile.{api,worker}` header comments.
- [x] Final broad grep sweep: zero remaining `call-`/bare `CALL`
      identity tokens outside `dev-docs/`.
- [x] `rm -rf .venv uv.lock && uv sync --all-packages`: all 13 renamed
      packages resolve clean.
- [x] `uv run pytest`: 139/139 passed, unchanged.
- [x] `uv run mypy packages apps config` (strict): zero issues.
- [x] `apps/web`: `npm run typecheck` and `npm run lint` both clean.
- [x] Live-booted the real API against local Postgres: `GET
      /api/health` -> `"service":"vexbusiness-api"`; `GET
      /openapi.json` -> `info.title == "Vex Business"`. Shut down
      cleanly afterward (confirmed via a failed health-check curl).
