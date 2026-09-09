# Tasks — Phase 1-2: repository, Docker, configuration, domain models, database, migrations

## Phase 1 — repository, Docker, configuration
- [x] Confirmed the attached master directive's two governing
      principles (risk-has-veto-power §16, no-fabricated-probability
      §14/§15) directly to the user before writing any code.
- [x] Created the real repository skeleton (`apps/`, `packages/`,
      `migrations/`, `tests/`, `data/sample/`, `scripts/`,
      `infra/docker/`, `docs/`, `config/`) per Section 5.
- [x] Built a real uv workspace: root `pyproject.toml` +
      13 member packages, each with its own `pyproject.toml`.
- [x] Caught and fixed a real bug: every package's Hatch build config
      used the wrong table name (`tool.hatchling.build` instead of
      `tool.hatch.build`) — found via `uv sync --all-packages`
      failing loudly on most packages.
- [x] Caught and fixed a second real bug: the repo-root `.gitignore`'s
      `**/data/` rule was silently excluding `packages/data/` (a real
      package named `data`) from Hatchling's own VCS-aware wheel
      builder — found by inspecting the installed package's actual
      file list, not assumed working from a successful `uv sync`
      report. Fixed with a real `.gitignore` carve-out AND
      `ignore-vcs = true` (the carve-out alone did not fix it).
- [x] `uv sync --all-packages` — all 13 packages resolve and install
      cleanly, confirmed via direct import of `domain`, `data`,
      `config`.
- [x] Built `config/settings.py`: the real, two-part live-trading
      interlock (`LIVE_TRADING_ENABLED` + exact
      `LIVE_TRADING_CONFIRMATION` phrase). Tested all four real
      states directly — armed in exactly the one case it should be.
- [x] Built the real FastAPI app (`apps/api`), booted live,
      `GET /api/health` confirmed returning the real safety posture.
- [x] Built the real worker scaffold (`apps/worker`) — honest, idling,
      no fake jobs registered.
- [x] Built `Dockerfile.node`-equivalent for Python
      (`Dockerfile.api`/`Dockerfile.worker`) and a real multi-stage
      `Dockerfile.web` for the Next.js frontend.
- [x] Built the real, self-contained `docker-compose.yml` (postgres,
      redis, api, worker, web), ports deliberately outside the main
      ecosystem's range. Validated with `docker compose config` —
      real YAML parsing, no daemon required.
- [x] Built a real, minimal Next.js 16 dashboard (`apps/web`) —
      server-side fetch of the real API's `/api/health`, rendering
      the real safety posture. Caught and fixed a real issue: the
      initially-pinned Next.js 15.x line carried 3 real high-severity
      `npm audit` findings (PostCSS XSS/path-traversal, a
      `sharp`/libvips CVE) — bumped to 16.x, confirmed zero
      vulnerabilities.
- [x] `npm run build` (Next.js) and `npm run typecheck` both clean.
- [x] Booted the real API + real Next.js production server together,
      confirmed the dashboard rendered the real live safety posture
      via an actual HTTP request.

## Phase 2 — domain models, database, migrations
- [x] Built `domain/events.py`: the real, complete 30-event catalog
      from Section 7, verbatim, plus the real common envelope
      (`event_id`, `correlation_id`, etc.) Section 7 requires.
- [x] Built `domain/enums.py`: every enum whose values Section
      1/12/13/16/19 name explicitly, transcribed verbatim.
- [x] Built `domain/models.py`: `ContractSpec`/`ContractMapping`/
      `ContinuousSeries` (§9), `Bar` (§8, with real invalid-OHLC
      validators), `SessionConfig` (§10), `Signal`/
      `SignalComponentScores` (§13), `Probability`/`Opportunity` (§14,
      with the real no-fabricated-probability validator and the real
      50-point-target validator), `RiskCheckInputs`/`RiskDecision`
      (§16, with the real rejected-means-zero-quantity and
      rejected-requires-reason validators), `Order`/`Position` (§19),
      `ModelVersion` (§15).
- [x] Ran all four domain validators interactively against real
      inputs: invalid OHLC rejected, wrong 50-point target rejected,
      fabricated probability rejected, rejected-decision-with-nonzero-
      quantity rejected.
- [x] Built `data/orm.py`: real SQLAlchemy 2.0 models mirroring every
      domain model, table-for-table, with real foreign keys (an order
      cannot exist without a real risk decision behind it, structurally)
      and real indexes/unique constraints (the real duplicate-bar
      constraint from §8).
- [x] Built `data/database.py`: real async engine/session wiring
      reading from `config.settings`.
- [x] Created a real local Postgres 16 database + role for live
      testing (separate from any app's own persistence).
- [x] Set up Alembic, pointed `env.py` at the real `data.orm.Base`
      metadata and the real `config.settings` database URL.
- [x] `alembic revision --autogenerate` — detected and generated all
      12 real tables correctly on the first successful run.
- [x] `alembic upgrade head` — applied for real; `\dt` confirmed all
      12 tables exist in the real database.
- [x] Ran a real insert/query round trip — caught a third real bug:
      the first attempt failed inserting a real timezone-aware UTC
      datetime (`Mapped[datetime]` defaults to Postgres' `TIMESTAMP
      WITHOUT TIME ZONE`, which asyncpg correctly refuses for a
      tz-aware value). Fixed with a real `type_annotation_map` on the
      ORM `Base`; rolled back, regenerated, and reapplied the
      migration; reran the round trip — confirmed working, including
      the real UTC tzinfo surviving the round trip.
- [x] Ran a real duplicate-bar insert — confirmed rejected by a real
      Postgres `IntegrityError`, not just application logic.
- [x] `ruff check .` — 27 initial findings, fixed (13 auto, the rest
      by hand); clean.
- [x] `mypy --strict` — 21 initial findings, fixed (including deleting
      one genuinely dead, no-op Pydantic validator found while fixing
      its type annotation, rather than annotating code that did
      nothing); clean.
- [x] Deleted all test data from the real database before finalizing.

## Not done (disclosed, not silently skipped)
- `docker compose up --build` — this sandbox's Docker daemon cannot
  start (no permission to raise the ulimits `dockerd` needs). Every
  individual piece was verified outside Docker instead; the actual
  container images have never been built.

## Next
Phase 3 (feature engine, market regime engine, signal engine, the
50-point opportunity engine, the statistical engine, the risk engine's
real approve/reject logic, execution/broker adapters, backtest/replay
engines) is real, separate, substantial scope — not started here.
