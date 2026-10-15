# School Platform on Canvas LMS

This repository is an executable **foundation**, not a claim that a complete school system can be safely delivered in one generation. It keeps [Canvas LMS](https://github.com/instructure/canvas-lms) as the learning engine and adds a separately deployable school-administration control plane.

## What is implemented

- FastAPI administration API with learner records, role-based access control (RBAC), optimistic updates, audit events, and a transactional outbox.
- A Canvas API adapter with opaque `Link` pagination, request-cost telemetry, retries, and typed errors.
- A minimal React operations console.
- PostgreSQL-backed local stack, health checks, tests, and continuous integration.
- Architecture, threat model, data model, implementation roadmap, operating model, and architecture decision records.
- Canvas theme token sample and an LTI 1.3 registration template.

## System boundary

| Capability | System of record |
|---|---|
| Courses, modules, assignments, submissions, gradebook | Canvas |
| Learner identity, guardians, admissions, official enrolment | School Core |
| Invoices, payments, exemptions | School Core/approved payment provider |
| Authentication and multifactor authentication | OpenID Connect identity provider |
| Analytics warehouse and risk snapshots | Reporting plane; never Canvas transactional tables |

Do **not** write directly to Canvas's database. Integrate through supported REST APIs, SIS imports, Live Events and LTI 1.3. Do not put card data in this platform.

## Quick start

Requirements: Docker Compose v2.

```bash
cp .env.example .env
# For local API-only development, set DATABASE_URL to the compose value already supplied.
docker compose up --build
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

The API deliberately has no development authentication bypass. Supply a valid OpenID Connect (OIDC) bearer token, or use dependency overrides in automated tests. Configure Canvas separately and point `CANVAS_BASE_URL` at it. Canvas is not bundled because an unreviewed moving upstream image is inappropriate for production.

## Native Python development

```bash
cd apps/admin-api
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
pytest
uvicorn app.main:app --reload
```

## First production rollout

1. Complete the decisions in `docs/OPEN-QUESTIONS.md` with school leadership, finance, safeguarding, teaching staff, learners, and the Information Officer.
2. Select and pin a reviewed Canvas commit/release; apply upstream security updates routinely.
3. Integrate the school's identity provider and enable multifactor authentication for privileged staff.
4. Import a masked trial term into staging; reconcile counts and grade calculations.
5. Run privacy impact, accessibility, penetration, backup-restore and disaster-recovery exercises.
6. Pilot with one grade; retain a documented rollback and manual attendance/assessment process.

## Verification

The generated API suite currently passes 6 tests with 92% statement coverage. The web build is defined in CI/Docker, but could not be executed in the research environment because Node/npm was unavailable; run it before accepting the artifact. Generate and commit the web lockfile and a fully resolved Python lock before a release.

## Important limitations

This baseline does not yet implement attendance, timetable optimisation, admissions workflows, guardian portal, payment-provider settlement, LTI runtime, notifications, transcript signing, or a production Canvas cluster. Those require confirmed local rules and are sequenced in `docs/ROADMAP.md`. The risk model is intentionally rules-based and advisory; it must not make automated high-stakes decisions.
