# ============================================================================
# School Platform on Canvas LMS - Unified Makefile
# ============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/bash

# Python and Node executables
PYTHON ?= python
NPM ?= npm

.PHONY: help
help: ## Show this help message
	@echo "=================================================================="
	@echo " School Platform Control Plane - Available Commands"
	@echo "=================================================================="
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ----------------------------------------------------------------------------
# Docker & Container Lifecycle
# ----------------------------------------------------------------------------
.PHONY: up up-d down down-v restart logs logs-api logs-web ps

up: ## Start the full stack with Docker Compose (build & foreground)
	docker compose up --build

up-d: ## Start the full stack in detached mode (background)
	docker compose up -d --build

down: ## Stop and remove all running project containers
	docker compose down

down-v: ## Stop containers and wipe PostgreSQL volume (clean database reset)
	docker compose down -v

restart: down up-d ## Restart all containers cleanly in background

logs: ## Follow all container logs
	docker compose logs -f

logs-api: ## Follow backend API container logs
	docker compose logs -f api

logs-web: ## Follow frontend web container logs
	docker compose logs -f web

ps: ## Check status and ports of running containers
	docker compose ps

# ----------------------------------------------------------------------------
# Backend (FastAPI / Python)
# ----------------------------------------------------------------------------
.PHONY: install-api dev-api test-api lint-api format-api

install-api: ## Install backend dependencies including dev tools in editable mode
	cd apps/admin-api && $(PYTHON) -m pip install -e ".[dev]"

dev-api: ## Run FastAPI backend locally with hot reload on port 8000
	cd apps/admin-api && $(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test-api: ## Run backend unit & integration tests with coverage report
	cd apps/admin-api && $(PYTHON) -m pytest --cov=app --cov-report=term-missing

lint-api: ## Lint backend codebase using ruff
	$(PYTHON) -m ruff check apps/admin-api

format-api: ## Format backend code using ruff
	$(PYTHON) -m ruff format apps/admin-api

# ----------------------------------------------------------------------------
# Database Migrations (Alembic)
# ----------------------------------------------------------------------------
.PHONY: db-migrate db-rollback db-history db-revision

db-migrate: ## Apply latest database migrations (alembic upgrade head)
	cd apps/admin-api && $(PYTHON) -m alembic upgrade head

db-rollback: ## Roll back the most recent migration step
	cd apps/admin-api && $(PYTHON) -m alembic downgrade -1

db-history: ## View migration revision history
	cd apps/admin-api && $(PYTHON) -m alembic history

db-revision: ## Generate a new migration script (e.g. make db-revision MSG="add_field")
	cd apps/admin-api && $(PYTHON) -m alembic revision --autogenerate -m "$(MSG)"

# ----------------------------------------------------------------------------
# Frontend (React 19 / TypeScript / Vite)
# ----------------------------------------------------------------------------
.PHONY: install-web dev-web build-web test-web typecheck-web

install-web: ## Install frontend node modules
	cd apps/admin-web && $(NPM) install

dev-web: ## Run frontend Vite dev server with hot module replacement (HMR)
	cd apps/admin-web && $(NPM) run dev

build-web: ## Typecheck and build frontend for production
	cd apps/admin-web && $(NPM) run build

test-web: ## Run frontend test suite
	cd apps/admin-web && $(NPM) test

typecheck-web: ## Run TypeScript typecheck without emitting output
	cd apps/admin-web && npx tsc --noEmit

# ----------------------------------------------------------------------------
# Canvas SIS & Data Utilities
# ----------------------------------------------------------------------------
.PHONY: export-sis

export-sis: ## Generate a deterministic Canvas SIS users ZIP archive
	$(PYTHON) scripts/export_sis.py dist/canvas_users.zip

# ----------------------------------------------------------------------------
# Meta / Verification Targets
# ----------------------------------------------------------------------------
.PHONY: install test lint build clean health

install: install-api install-web ## Install both backend and frontend dependencies

test: test-api build-web ## Run full test suite across API and frontend build verification

lint: lint-api typecheck-web ## Run all code quality checks

build: ## Build Docker images for both API and Web
	docker compose build

health: ## Check live and ready status of the local API
	@echo "Checking API Live status:"
	@curl -s -f http://localhost:8000/health/live || echo "API not live"
	@echo "\nChecking API Ready status:"
	@curl -s -f http://localhost:8000/health/ready || echo "API not ready"

clean: ## Remove Python cache, build artifacts, and test databases
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	rm -rf apps/admin-web/dist dist/ apps/admin-api/school.db apps/admin-api/test_school.db 2>/dev/null || true
