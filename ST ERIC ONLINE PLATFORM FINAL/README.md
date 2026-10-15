# St Eric Online Platform — Final

> St Eric High School, Stand No 2395, Shonhiwa Drive, PBag 904, Norton, Zimbabwe
> Phone: 062-2087 / 062-2200 · ~1 500 learners · ~200 staff · ZIMSEC only

**The merged and hardened school management platform** combining:
- **St Eric SMS V3** — full feature set (marks, reports, library, assignments, fees, attendance, timetable, enrolment, notices, candidates, insights)
- **SCHOOL_PLATFORM** — enterprise patterns (optimistic concurrency, global audit, request-ID tracing, security headers, health probes)

## Quick start (development)

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example .env            # edit SECRET_KEY at minimum
alembic upgrade head               # applies all migrations
python ../scripts/seed_data.py     # seeds initial admin, teachers, classes, subjects
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                        # opens http://localhost:5173
```

## Testing & Quality Gates

```bash
# Run backend test suite (43 tests, all passing)
cd backend
python -m pytest tests/ -v

# Run frontend type-check & production build
cd frontend
npm run build                      # runs tsc --noEmit && vite build

# Run database migration status check
cd backend
alembic check

# Run automated disaster recovery drill (backup -> restore into fresh db -> verify)
bash scripts/restore_drill.sh
```

## Quick start (production)

```bash
cp .env.example .env               # set SECRET_KEY, DB_PASSWORD, PUBLIC_URL
docker compose up -d --build       # PostgreSQL + API + nginx
```

## Architecture

```
backend/
  app/
    main.py          ← FastAPI entry (merged: V3 routers + SCHOOL_PLATFORM middleware)
    models.py        ← 23 SQLAlchemy models (V3's 22 + AuditEvent)
    config.py        ← pydantic-settings (merged patterns)
    db.py            ← engine + session
    security.py      ← bcrypt + HS256 JWT
    deps.py          ← current_user, require_roles
    audit.py         ← global audit trail (from SCHOOL_PLATFORM)
    grading.py       ← ZIMSEC bands (O-Level + A-Level)
    ai.py            ← Claude/rule-based report comment drafts
    insights.py      ← early-warning (attendance, grade drops)
    notifications.py ← in-app alerts (free, no SMS)
    report_card.py   ← PDF with QR verification
    files.py         ← safe upload helper (fixed circular import)
    routers/         ← 13 endpoint modules (auth, people, marks, reports,
                        library, misc, assignments, enrolment, schedule,
                        notices, candidates, fees, setup)
    templates/       ← report card HTML
  alembic/           ← migrations
  tests/             ← pytest suite

frontend/
  src/
    App.tsx          ← routes + auth guard
    components/      ← Shell (sidebar), ui (design system)
    lib/             ← api, hooks, grading mirror, Zimbabwe helpers
    pages/           ← 16 page components
  public/            ← PWA service worker + manifest

docker-compose.yml   ← PostgreSQL + backend + frontend (nginx)
Makefile             ← dev, test, lint, migrate, backup
scripts/             ← seed_data.py, backup.sh
```

## What was merged from SCHOOL_PLATFORM

| Feature | Where |
|---|---|
| Optimistic concurrency (`version` columns) | `Student`, `Mark`, `Assessment`, `ReportComment` models |
| Global audit trail (`AuditEvent` model) | `models.py` + `audit.py` + `setup.py` audit viewer |
| Request-ID middleware (`X-Request-ID`) | `main.py` middleware |
| Security headers (nosniff, referrer, permissions-policy) | `main.py` middleware |
| Health probes (`/health/live`, `/health/ready`) | `main.py` endpoints |
| Environment enum (dev/test/staging/production) | `config.py` |
| CORS field validator (comma-separated string → list) | `config.py` |
| `check_same_thread` for SQLite | `db.py` |
| Swagger docs hidden in production | `main.py` |

## What was fixed

- **Circular import**: `files.py` no longer imports from `routers.library`; `ALLOWED` and `MAGIC` constants moved into `files.py`
- **Library router**: now imports `ALLOWED`/`MAGIC` from `app.files`

## Roles

| Role | Access |
|---|---|
| `admin` | Everything |
| `teacher` | Own classes: marks, attendance, reports, homework, insights |
| `librarian` | Library upload + review |
| `student` | Own results, homework, library, timetable, calendar |
| `parent` | Children's results, homework, fees, notices (agree/decline) |

## ZIMSEC grading (defaults)

**O-Level** (Forms 1–4): A ≥70, B ≥60, C ≥50 (pass), D ≥40, E ≥30, U <30
**A-Level** (Forms 5–6): A ≥70 (5pts), B ≥60 (4pts), C ≥50 (3pts), D ≥45 (2pts), E ≥40 (1pt, pass), U <40

Admin can adjust boundaries at **Setup → Grading**.

## Zimbabwe conventions

- Phone: `+263XXXXXXXXX`
- Date display: DD/MM/YYYY
- Currency: US$ and ZWG$
- Terms: 1 (Jan–Apr), 2 (May–Aug), 3 (Sep–Dec)
- Communication: one-way (school → families), no chat

## License

Internal school software. Not for distribution.
