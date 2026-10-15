# ADR 0002: Modular monolith for School Core

**Status:** Accepted for baseline

**Decision:** Start with one deployable codebase and PostgreSQL schema, with module boundaries and a transactional outbox. Run web and worker processes separately.

**Why:** This reduces distributed failure modes and operating cost for one school while preserving reliable asynchronous Canvas synchronisation. Service extraction requires measured independent scaling, ownership or security needs.
