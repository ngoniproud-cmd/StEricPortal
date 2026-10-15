# Test strategy

- Unit: policies, mark/fee calculations, serializers and state transitions.
- Property tests: money allocation, weighted grades, timetable constraints and SIS round trips.
- Contract: recorded/sandbox Canvas API, SIS golden files, LTI platform conformance, payment webhooks.
- Integration: real PostgreSQL/Redis/object store and pinned Canvas staging release.
- End to end: OIDC roles, enrolment-to-course path, submission/grade sync, report approval, revocation.
- Security: object-level authorization, token validation, CSRF/SSRF/upload abuse, dependency/container scans and independent penetration test.
- Accessibility: automated checks plus keyboard, zoom, screen-reader and learner usability testing against WCAG 2.2 AA.
- Resilience: duplicate/out-of-order events, Canvas throttling, queue replay, database failover, object-store outage and backup restoration.
- Performance: measured school workload with login and submission spikes; report percentile latency and error rate, not only requests/second.

The current 6-test executable slice covers student CRUD conflicts, role denial, audit/outbox creation, SIS determinism and Canvas pagination. It is not acceptance evidence for production.
