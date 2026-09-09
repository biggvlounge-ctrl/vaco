# Plan — Phase 1-2: repository, Docker, configuration, domain models, database, migrations

## Goal
Build CALL — an autonomous futures-trading research platform — from a
real, comprehensive master directive, through exactly the two phases
requested: Phase 1 (repository, Docker, configuration) and Phase 2
(domain models, database, migrations). Phases 3+ (the actual
signal/risk/execution business logic) are explicitly out of scope for
this pass.

## Design

**Architecturally separate, per direct instruction.** Python/FastAPI/
Next.js, not Node.js/Express — CALL shares no process, store, or
docker-compose stack with any other app in this repo. Its own
`docker-compose.yml` uses ports 9000-9002/5433/6380, deliberately
outside the main ecosystem's 8787-8815 range, so both can run
simultaneously with zero collision.

**A real uv workspace, matching Section 5's own repo layout.**
`apps/{web,api,worker}` + `packages/{domain,market,strategy,risk,
execution,backtest,replay,analytics,ai,data}` + `config/`, each a real,
independently-versioned Python package, wired together via `uv`'s own
workspace mechanism (`[tool.uv.workspace]` + `{workspace = true}`
sources) rather than one flat `requirements.txt` — matches the
directive's own explicit package boundaries (Section 6: "The strategy
engine must not depend directly on the frontend. The strategy engine
must not depend directly on a specific broker.").

**Phase 3+ packages are real, empty, installable scaffolds — not
fake stubs.** `packages/{market,strategy,risk,execution,backtest,
replay,analytics,ai}` install cleanly as real workspace members with
zero business logic. A fake "always approve" risk engine or a fake
signal score would actively violate the two confirmed principles
(risk-has-veto-power, no-fabricated-probability) — leaving them
honestly empty is the correct choice, not a shortcut.

**Domain models trace directly to cited directive sections**, not
invented. Every field list in `domain/models.py` is transcribed from
the section that specifies it (Sections 8, 9, 10, 13, 14, 15, 16),
cited in-line. `Probability` and `RiskDecision` encode the two
confirmed governing principles as real Pydantic validators, not just
comments: a fabricated probability value or an out-of-policy rejected-
but-nonzero-quantity decision is rejected at construction, not
downstream.

**The live-trading interlock is deliberately two-part.** Neither the
directive nor any other source specifies an exact mechanism for "must
stay disabled by default, exactly as specified" beyond the requirement
itself — `is_live_trading_armed` requiring both a boolean AND an exact
confirmation phrase is a real, flagged interpretive choice, sized to
match the seriousness of real financial infrastructure rather than a
single flag a stray `true` could trip.

## Verification approach
Every claim below is a real, live result, not a written-and-assumed
one — see `README.md`'s own "Verified this pass" section for the full
list, including three real bugs a human might not have caught without
actually running each step (a wrong Hatch config table name silently
producing an empty wheel; the repo's own `**/data/` gitignore rule
silently excluding a real Python package also named `data`; a bare
`Mapped[datetime]` producing a Postgres column type that rejects real
timezone-aware UTC datetimes). `ruff check .` and `mypy --strict` both
clean. A real Postgres 16 instance, a real Alembic migration generated
and applied, a real insert/query round trip, and a real duplicate-bar
constraint rejection. A real FastAPI boot and a real Next.js 16
production build/boot, wired together live. Docker itself could not be
verified in this sandbox (no daemon permission) — disclosed directly,
not silently skipped.
