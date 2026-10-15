# Infrastructure guidance

The compose file is a developer environment for the custom control plane, not production and not Canvas itself.

For production, prefer managed PostgreSQL with point-in-time recovery, managed Redis, S3-compatible object storage with lifecycle/versioning, a secrets manager, Web Application Firewall, central telemetry, and immutable image registry. Deploy Canvas web and job processes separately. Establish capacity from load tests representing login peaks and simultaneous submissions.

Before enabling the sample LTI registration, implement the runtime and narrow scopes to the exact feature. The file requests read-only scopes only and is not proof of a secure LTI implementation.
