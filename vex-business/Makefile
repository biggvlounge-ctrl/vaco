# Vex Business — common commands. Every target here was actually run at least
# once while building this (not aspirational) — see README.md's own
# "Verified" section for what each one proved.

.PHONY: install dev-api dev-worker dev-web test lint typecheck migrate db-up db-down

install:
	uv sync --all-packages
	cd apps/web && npm install

dev-api:
	uv run uvicorn api.main:app --app-dir apps/api --host 0.0.0.0 --port 9000 --reload

dev-worker:
	uv run python -m worker.main

dev-web:
	cd apps/web && npm run dev

test:
	uv run pytest

lint:
	uv run ruff check .
	cd apps/web && npm run lint

typecheck:
	uv run mypy packages/domain packages/data packages/market packages/research packages/strategy packages/risk packages/execution packages/backtest config apps/api apps/worker
	cd apps/web && npm run typecheck

migrate:
	uv run alembic upgrade head

db-up:
	docker compose up -d postgres redis

db-down:
	docker compose down
