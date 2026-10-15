# Security, privacy and safeguarding baseline

This is an engineering baseline, not legal advice. A South African school should have its Information Officer and counsel map processing to the Protection of Personal Information Act (POPIA), the Children's Act, the South African Schools Act, provincial requirements and contractual duties.

## Controls

- OIDC single sign-on; phishing-resistant multifactor authentication for administrators and finance staff.
- Deny by default. Separate `platform_admin`, `registrar`, `finance`, `teacher`, `counsellor`, `auditor` and learner/guardian scopes. Teachers only see assigned classes; finance roles do not gain course-edit rights.
- Secrets in a secrets manager, short-lived workload identity where available, TLS in transit, managed encryption keys at rest, quarterly key/access review.
- Append-only audit records for viewing/exporting sensitive records and every mutation. Export audit logs to a security account with tamper-resistant retention.
- Collect no card number or CVV. Redirect to a PCI-compliant payment provider and store provider references plus settlement status only.
- Malware scan uploads, constrain type/size, randomise object keys, and serve through short-lived signed URLs.
- Rate limits, structured redacted logs, dependency/image scanning, signed builds, software bill of materials, protected branches, two-person production approval.
- Data-subject workflows for access/correction/deletion objections, with legal-record holds and verifiable downstream propagation.
- Separate production from test; use generated or irreversibly masked child data outside production.

## Risk register excerpt

| Threat | Design response | Verification |
|---|---|---|
| Account takeover | MFA, session limits, risk-based alerting | quarterly access review; auth tests |
| Staff overreach | contextual RBAC, purpose-limited screens, audit | permission matrix tests; audit sampling |
| Learner data leak | minimisation, encryption, DLP/redaction | privacy review; restore/export tests |
| Malicious SIS import | validate, dry-run, diff threshold, approval | golden-file and destructive-change tests |
| Duplicate Canvas event | durable ID deduplication | replay tests |
| Grade tampering | separate duties, immutable history, approvals | reconciliation and audit tests |
| Ransomware | isolated immutable backups, least privilege | quarterly restore exercise |
| Biased risk alert | explainable rules, no protected attributes, human review | subgroup monitoring and appeal process |

## Retention schedule

Do not hard-code a universal schedule. Create a register with data category, purpose, legal basis, owner, retention trigger, period, archive rule and deletion proof. Fees and official academic records can have different statutory/operational periods from clickstream data. Approve it before migration.
