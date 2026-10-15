# Delivery roadmap

## Phase 0 — discovery and governance (3–5 weeks)

Map the school calendar, grades/subjects, admissions, attendance periods, mark policies, fee/exemption rules, guardian authority, current systems, connectivity, languages, exports and support model. Produce a data inventory, privacy impact assessment, permission matrix, service objectives, migration samples and signed acceptance tests.

**Gate:** accountable school owner, Information Officer, data owners, approved scope and budget.

## Phase 1 — foundation and one-grade pilot (8–12 weeks)

- Production-like Canvas staging, identity integration and branding.
- School Core learners, guardians, terms, classes and enrolment.
- Deterministic SIS sync with dry-run/reconciliation.
- Staff portal, audit, monitoring, backup and restore.
- Pilot course templates and training.

**Gate:** zero unresolved critical security/accessibility issues; restore and rollback passed; record counts reconcile.

## Phase 2 — daily school operations (8–12 weeks)

Attendance with offline-resilient capture, timetable import, communications/preferences, guardian portal, controlled documents, disciplinary/safeguarding case boundary. Safeguarding notes need a separate, stricter access model—not ordinary learner notes.

## Phase 3 — finance and official assessment (8–12 weeks)

Invoice ledger, exemptions, payment-provider redirects/webhooks, allocations/refunds/reconciliation, approved mark books, moderation, transcript/report-card generation and signing. Independent finance and calculation review required.

## Phase 4 — analytics and extensions (6–10 weeks)

Event pipeline, dashboards, rule-based early-warning, LTI tools, content integrations. Validate alert precision, workload, subgroup effects and appeal/override procedures before production.

## Phase 5 — optimisation (continuous)

Measured load testing, cost optimisation, upstream Canvas upgrades, usability/accessibility cycles, disaster recovery drills and feature extraction only when justified.

## Definition of done for every slice

Threat model updated; permissions tested; migration/rollback written; logs and metrics present; WCAG 2.2 AA checks; unit/integration/contract tests; operator and user documentation; named owner; retention classified; staging acceptance signed.
