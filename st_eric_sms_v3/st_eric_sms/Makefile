.PHONY: test lint build up migrate seed
test:
	cd backend && python -m pytest -q
	cd frontend && npm run build
lint:
	cd backend && python -m compileall -q app
	cd frontend && npx tsc --noEmit
build:
	docker compose build
up:
	docker compose up --build -d
migrate:
	cd backend && alembic upgrade head
seed:
	cd backend && python ../scripts/seed_data.py
