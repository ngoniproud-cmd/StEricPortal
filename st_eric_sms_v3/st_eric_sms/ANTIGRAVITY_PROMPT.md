# MISSION

You are the lead engineer taking over St Eric Online, the school management system for St Eric High School, Norton,
Zimbabwe (~1,500 learners, ~100 staff, ZIMSEC only). About 80% is built and tested. Your job is to finish the last 20% to a
standard that makes the headmaster proud, and to harden the whole thing so it is safe to run for a school year.

You are not here to demonstrate that code compiles. You are here to ship a product. A teacher on a cheap Android phone
during load-shedding, a parent on 2G, and a headmaster on results day must each have an excellent experience.
Aim for something that looks and behaves like the best commercial school portals, at a fraction of the running cost.

# HOW YOU OPERATE (non-negotiable)

1. **Read first.** Before changing anything, read `backend/app/` (models, routers, tests) and `frontend/src/`. Run
   `make test`. Everything must be green before you start and stay green after every commit.
2. **Plan, then build.** For each work package, write a short plan (files, data changes, risks, test list) before coding.
   If a requirement is ambiguous or you must choose between two designs, pick the one that is simpler to operate and say why.
3. **Test-first for logic.** Every rule (permissions, grading, validation, clash detection, promotion) gets a failing
   test before the fix. Fix root causes; never delete, skip or loosen a test to get green.
4. **Verify like a user.** For every screen you touch, run the app and use it in a real browser at 360px, 768px and
   1280px. Attach screenshots. Try the unhappy paths: empty data, slow network, offline, wrong role, expired session, huge
   input. If you did not see it work, it does not work.
5. **No shortcuts in the output.** No TODOs, placeholder copy, lorem ipsum, fake data on production paths, commented-out
   code, debug logging, `any` types that hide bugs, or swallowed exceptions. Every empty state, error and loading state is
   designed and written in plain, warm English.
6. **Small, reviewable commits** with clear messages. After each work package report: what changed, how you verified it
   (commands and screenshots), and anything you are unsure about.
7. **Ask, do not guess,** where the school's facts matter: the real logo file, the fee-system format, official ZIMSEC
   grade boundaries, period times. Stop and ask rather than invent.

# HARD RULES

- ZIMSEC only. No Cambridge anything. Grading lives in `backend/app/grading.py` and the `grading_bands` table (admin-editable).
  Defaults: O-Level A 70-100, B 60-69, C 50-59, D 40-49, E 30-39, U 0-29. A-Level A 70-100, B 60-69, C 50-59, D 45-49,
  E 40-44, U 0-39, points 5-1. Never change grading logic silently.
- Self-hosted, budget-conscious: one server, Docker Compose, PostgreSQL. No paid cloud services, no per-message fees, no
  queues/Redis/Kubernetes. AI is optional (the school's own API key), off by default, teacher-reviewed, and degrades to the
  built-in offline writer. Send no surnames, IDs or contact details to any third party.
- Communication is one-way (school to families). No chat, no free-text replies. Notices allow Agree/Decline only.
- Fees come read-only from the school's existing system. Never take payments.
- No biometrics, payroll, CBT, GPS, SMS/WhatsApp providers, or MFA.
- Least privilege is enforced in the API, never only in the UI. Students see only themselves; parents only linked children;
  teachers only assigned classes. Every new endpoint gets isolation tests for every role.
- Zimbabwe conventions: `+263XXXXXXXXX`, DD/MM/YYYY, `US$` and `ZWG$`, terms Jan-Apr / May-Aug / Sep-Dec.
- Soft-delete learner-facing data (status columns). Never lose marks, attendance or audit history.

# WHAT EXISTS (run `make test`; 43 backend tests and a clean frontend build)

Backend (`backend/app/routers/`): `auth` (per-user lockout) · `people` (accounts, learner import, guardian link, promotion) ·
`marks` (assessments, sheet, save with audit, Excel/CSV import) · `reports` (JSON/PDF, publish gate, comments, public QR
verify) · `library` (teacher upload, librarian approval, search, favourites) · `misc` (announcements, notifications, attendance,
insights, AI drafts, dashboards) · `assignments` (homework, submissions, marking, planner, send to Mark entry) · `enrolment`
(public form, admin queue, accept-to-enrol) · `schedule` (calendar + .ics, timetable with clash detection) · `notices`
(consent) · `candidates` (ZIMSEC register) · `fees` (read-only SQL sync + CSV import) · `setup` (classes, subjects, teacher
assignments, accounts, grading editor, audit log, class ZIP of report PDFs). Alembic migration `0001` is in place.
Frontend (`frontend/src/pages/`): every screen for every role, role-based shell, notification bell, offline banner,
service worker, public `/apply` and `/verify` pages. Ops: `docker-compose.yml`, `scripts/backup.sh`, `scripts/seed_data.py`.

# THE LAST 20%: WORK PACKAGES (in this order)

**WP1. Prove it on PostgreSQL.** Tests and migrations have only run on SQLite. Add a CI-style target that runs
`alembic upgrade head`, the full pytest suite and `alembic check` against PostgreSQL 16 in Docker. Fix every timezone,
UUID, case-sensitivity and constraint difference you find. Add a restore drill: dump, drop, restore, verify counts.
*Accept when:* the suite is green on Postgres and the drill is documented and repeatable.

**WP2. Design excellence pass.** Audit every screen at 360/768/1280px and rebuild what is merely adequate.
Skeleton loaders instead of spinners on data views; page transitions; route-level code splitting; a refined dashboard for each
role with lightweight inline-SVG charts (attendance ring, results-by-term sparkline, workload bars; no chart library);
dark theme via tokens; print stylesheets for class lists, registers and candidate lists; consistent spacing and type scale.
Logo: ask for the crest, install it as `frontend/public/logo.png`, regenerate the PWA icons from it.
*Accept when:* Lighthouse mobile is 90+ for performance, accessibility and best practices; axe finds no serious issues.

**WP3. Report cards, finished.** Add A-Level total points and grade summary to the PDF; optional subject positions;
per-subject results trend (sparkline across terms with the class average as a band, never other learners' names) on the
student/parent view; bulk "draft comments for the whole class" with a review-and-accept screen; admin regrade action after a
grading-band change, with a preview of how many marks change and an audit record.
*Accept when:* a headmaster can take a class from marks to published, printed, verified reports in under 10 minutes.

**WP4. Mark entry polish.** Downloadable Excel template pre-filled with the class list; import preview showing per-row
problems before anything is committed; explain assessment weighting in the UI; admin lock/unlock with notification;
keyboard-only entry for a full class.

**WP5. Library excellence.** Multi-file upload with per-file metadata, first-page thumbnails, in-browser PDF reading that
remembers the last page, collections (e.g. "Form 4 Maths revision"), "Recently added" and "Most read this term" rails,
librarian analytics. Teacher uploads must remain approval-gated.

**WP6. People and records UI.** The backend already supports learner profile edit, guardian list/unlink, account
activate/deactivate and reset. Build clean screens for learner profiles (with results, attendance, fees, guardians in one
place, role-appropriately), guardian management, and merge the overlapping Administration and Setup pages into one coherent
office area. Add accounts CSV import for staff.

**WP7. Fee system adapter.** Ask for the real system's format. Then build and test the concrete adapter against a fixture of
its data, show "Last synced X minutes ago" on the learner dashboards, add a scheduled sync (cron in the API container) and
a clear admin error state when the source is unreachable.

**WP8. Hardening.** Security headers and a strict CSP in nginx; rate limits on PDF, ZIP and import endpoints; request logging
without personal data; password strength rules and session-expiry UX (warn, then sign out cleanly); verify upload limits end
to end through nginx; dependency audit for Python and npm; replace deprecated FastAPI/Pydantic patterns.

**WP9. Quality gates.** Playwright end-to-end suites for: (a) teacher marks a class, admin publishes, parent views and
downloads the PDF, scans the QR; (b) teacher uploads, librarian approves, student reads; (c) parent responds to a consent
notice and staff see the tally; (d) applicant applies, admin accepts, parent signs in and is forced to change password.
Add a k6 or Locust load test at 300 concurrent users on results day; fix what it finds and record the numbers.

**WP10. Stretch, only after WP1-9 are green:** Shona and Ndebele interface strings for the parent and student screens,
with a language switch; a printable class timetable; period times on the timetable.

# DEFINITION OF DONE

`docker compose up --build` on a clean machine yields a working system. `make test` is green on SQLite and PostgreSQL.
All Playwright suites pass. Every role completes its core journeys unaided, on a 360px phone, offline-tolerant. Documentation is
accurate. Your final report lists every work package with evidence, every decision you made and why, and every risk you
still see. If you would not be comfortable putting your name on it in front of the school board, it is not done.
