# St Eric Online — School Management System

ZIMSEC-only school portal for St Eric High School, Norton. One local server.
FastAPI + PostgreSQL + React (Vite, Tailwind) + nginx, all in Docker Compose.

## Start (production-like)
```bash
cp .env.example .env                 # set SECRET_KEY, database password, PUBLIC_URL
docker compose up --build -d         # migrations run automatically; site on http://localhost
docker compose exec api python ../scripts/seed_data.py     # optional demo data
```
Demo logins: `admin`, `teacher`, `librarian`, `student`, `parent`; password `ChangeMe123!` (change it).

## Develop
```bash
cd backend && pip install -r requirements.txt && alembic upgrade head && python ../scripts/seed_data.py
uvicorn app.main:app --reload                # API on :8000, docs at /docs
pytest                                       # 43 tests
cd frontend && npm install && npm run dev    # http://localhost:5173 (proxies /api to :8000)
```
`make test` runs the backend tests and a full frontend type-check and build.

## Logo
Save the crest as `frontend/public/logo.png` (transparent PNG, ~400px high). Replace `icon-192.png` and `icon-512.png` (phone home-screen icons) with the crest on a square background.

## Grading (ZIMSEC)
O-Level (Forms 1-4): A 70-100, B 60-69, C 50-59, D 40-49, E 30-39, U 0-29.
A-Level (Forms 5-6): A 70-100, B 60-69, C 50-59, D 45-49, E 40-44, U 0-39; points A5 B4 C3 D2 E1.
Editable by the admin under Setup > Grading. Confirm against the current ZIMSEC circular.

## Fees (existing system, read-only)
Set `FEE_SYSTEM_DB_URL` and `FEE_SYSTEM_QUERY` (a SELECT, see `.env.example`), then use Fees > Sync now. Or import a CSV from the same screen.

## Backups
`scripts/backup.sh /path/to/backup/drive` copies the database and uploaded files. Schedule it nightly with cron and keep a weekly copy off the machine. The restore command is at the bottom of the script.

## What is built
Roles: admin, teacher, librarian, student, parent.
Teaching: mark entry (picker, Excel paste, Excel/CSV import, absent flag, audit trail, autosave, offline draft) · homework (post, hand in, mark, feedback, send marks to Mark entry, weekly workload planner) · attendance with parent alerts · learner insights (early warning) · AI-drafted report comments (optional key).
Learning: report cards (PDF with QR verification, publish gate, class ZIP) · timetable with clash detection · online library (teacher upload, librarian approval, search, favourites).
School: calendar with phone export · announcements (one-way) · consent notices (Agree/Decline only, tally, reminders) · fees (read-only) · in-app notifications.
Office: online enrolment (public form, review queue, accept-to-enrol) · ZIMSEC candidate register · classes, subjects, teacher assignments, accounts, grading editor, audit log · learner import · year-end promotion.
Platform: JWT with lockout, forced first-login password change, gzip, PWA offline, Alembic migrations, backups.

See `ANTIGRAVITY_PROMPT.md` for the remaining work.
