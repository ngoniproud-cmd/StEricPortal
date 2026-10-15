# Operations runbook baseline

## Service-level indicators

Track availability and p95 latency for login, course open, assignment submit and official-record operations; Canvas/API error ratio; delayed-job and outbox oldest age; SIS import duration/error count; event duplicate/lag; database connections/replication lag; object-store errors; backup age; notification failure; and authentication anomalies. Avoid learner names, tokens, submissions and free-text notes in telemetry.

## Alerts

Page for submission/login outage, database unavailability, rapidly growing queue, backup failure or suspected compromise. Ticket lower urgency for reconciliation drift and analytics delay. Every alert needs an owner, diagnostic link and tested action; avoid paging on raw CPU alone.

## SIS sync procedure

1. Snapshot source cutoff and generate deterministically.
2. Validate schema, references, duplicates and allowed status transitions.
3. Compare with last accepted manifest; enforce absolute and percentage deletion thresholds.
4. Human-approve destructive change.
5. Upload through SIS API; save import ID/checksum.
6. Poll to terminal status; ingest warnings/errors.
7. Reconcile source/Canvas counts and sampled records.
8. Mark manifest accepted or invoke compensating import. Never “roll back” by restoring Canvas database independently.

## Incident priorities

- **P1:** safety/privacy breach or broad learning outage—activate incident lead immediately, preserve evidence, isolate safely, follow notification assessment.
- **P2:** major degraded function—same-day owner and workaround.
- **P3:** limited issue—normal queue.

Maintain offline attendance and assessment contingencies. Run tabletop exercises before launch and twice yearly.
