.PHONY: dev test lint migrate seed up down logs backup

# ── development ──
dev:
	cd backend && uvicorn app.main:app --reload --port 8000 &
	cd frontend && npm run dev

test:
	cd backend && python -m pytest tests/ -v --tb=short

lint:
	cd backend && python -m py_compile app/main.py
	cd frontend && npx tsc --noEmit

# ── database ──
migrate:
	cd backend && alembic revision --autogenerate -m "auto"

upgrade:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m scripts.seed_data

# ── docker ──
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

# ── ops & CI ──
backup:
	bash scripts/backup.sh

restore-drill:
	bash scripts/restore_drill.sh

ci-postgres:
	docker compose run --rm backend sh -c "alembic upgrade head && alembic check && pytest tests/ -v"
