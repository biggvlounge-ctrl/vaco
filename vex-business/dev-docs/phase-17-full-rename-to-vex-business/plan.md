# Plan — Phase 17: full technical rename to Vex Business

## Goal
Per direct instruction, this is a **full technical rename**, not the
narrower display-only rebrand decided earlier in this project (VACON's
Stephanie agent showing `app: "Vex Business"` while the codebase
stayed `call`). Everything changes together: the directory (`call/` ->
`vex-business/`), every workspace package name (`call-*` ->
`vexbusiness-*`), the FastAPI app title, the Next.js page title, the
Docker/Postgres identity strings, and the README.

## Real investigation before any code
Checked how packages are actually imported before touching anything:
each `pyproject.toml`'s `name = "call-<x>"` is the *distribution* name
used only in `dependencies = [...]` and `[tool.uv.sources]` — the
actual Python import name comes from `[tool.hatch.build.targets.wheel]
packages = ["<x>"]` (e.g. `packages = ["market"]`), which was never
`call`-prefixed. Confirmed directly by reading `packages/market/pyproject.toml`
and `apps/api/pyproject.toml`: no Python source file anywhere imports
anything as `call_something`. This meant the rename was purely a
distribution-name/string-literal exercise — zero Python import
statements needed to change.

## Real gotchas found and fixed
- Grepped every `call-[a-z]+` and bare `\bCALL\b` occurrence across the
  whole tree before running any bulk replace, to rule out false
  positives (an English "call" verb, an unrelated identifier). None
  found — every hit was genuinely the product name/package prefix.
- `apps/api/api/main.py`'s `/api/health` response's `"service"` field
  was a real, tested literal (`"call-api"`) — caught by grep, not
  assumed to only live in comments; renamed to `"vexbusiness-api"` and
  live-verified over HTTP after the change, not just read in source.
- `docker-compose.yml`/`.env.example`/`config/settings.py` all had a
  real, literal `call`/`call` Postgres user/password/db baked into
  connection strings and the compose volume name — all three updated
  together so they stay internally consistent (a partial rename here
  would have silently broken local Docker Postgres auth).
- `apps/web`'s `CALL_API_URL` env var (read server-side in
  `app/page.tsx` and both proxy routes) renamed to
  `VEXBUSINESS_API_URL` everywhere it's read or set, including
  `docker-compose.yml`'s own `web` service environment block.

## Verification approach
`git mv call vex-business` to preserve history, then a scripted,
targeted sed pass (never a blind whole-tree replace) — first the
`call-[a-z]+` → `vexbusiness-[a-z]+` package-name pattern across every
`*.toml`/`*.py`/`*.ts`/`*.tsx`/`Makefile`/`*.yml`/`*.ini`, then the
bare `\bCALL\b` product-name pattern, both excluding `dev-docs/` (kept
as an accurate historical record of the CALL-named build) and handling
`README.md` and `packages/research` by hand since both narrated the
now-superseded display-only branding decision.

Then real, live re-verification, not just "the sed ran clean":
`rm -rf .venv uv.lock && uv sync --all-packages` resolved all 13
renamed packages with zero errors; the full `uv run pytest` suite (139
tests) passed unchanged; `uv run mypy packages apps config` (strict)
found zero issues; `npm run typecheck`/`npm run lint` in `apps/web`
both clean. Booted the real FastAPI app against local Postgres and
confirmed live, over HTTP: `GET /api/health` returns
`"service":"vexbusiness-api"`, and `GET /openapi.json`'s own
`info.title` reads `"Vex Business"` — not just source-level claims.

## Explicitly NOT in this task
Historical `dev-docs/phase-1-2-foundation/` through
`phase-13-trading-dashboard/` narrative text was left exactly as
written — it accurately describes what was built under the CALL name
at the time, and rewriting history there would misrepresent it, not
correct it.

## Done when
- Zero remaining `call-`/bare `CALL` identity tokens anywhere in the
  live source tree (confirmed by a final broad grep sweep).
- `uv sync`, the full test suite, mypy, and the frontend
  typecheck/lint/build all pass against the renamed tree.
- The running API and its OpenAPI schema both report "Vex Business"
  live, not just in source.
