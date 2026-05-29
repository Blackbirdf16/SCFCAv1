# SCFCAv2 Current Implementation Record

## Project Summary

SCFCAv2 is a thesis-oriented proof of concept for institutional custody, preservation, management, and audit of cryptocurrency-related evidence. The current repository implements a FastAPI backend, React/Vite frontend, PostgreSQL-backed domain data, Docker Compose runtime, role-based access control, audit evidence, and DevSecOps evidence collection.

This record describes the current repository only. It does not claim MFA, global API rate limiting, ticket execution, live blockchain execution, HSM/MPC custody, or private-key custody. Re-authentication is implemented only as short-lived password confirmation for selected sensitive administrator actions.

## Current Implementation Timeline

| Phase | Current focus | Primary evidence |
| --- | --- | --- |
| 1 | Runtime and repository foundation | `docker-compose.yml`, `scripts/seed_demo_data.py`, `.gitignore`, `pytest.ini` |
| 2 | Core custody workflows | `backend/api/v1/routes/cases.py`, `backend/api/v1/routes/tickets.py`, `backend/api/v1/routes/documents.py` |
| 3 | Role-based access and UI | `backend/auth/dependencies.py`, `frontend/src/components/Sidebar.tsx`, `frontend/src/pages/*.tsx` |
| 4 | Audit and evidence integrity | `backend/api/v1/routes/audit.py`, `tests/test_audit_hash_chain.py` |
| 5 | DevSecOps security evidence | `.gitlab-ci.yml`, `docs/evidence/`, `scripts/security_reports_to_html.py` |
| 6 | Hardening and traceability | `backend/core/models.py`, `docs/traceability/`, `tests/test_asset_immutability.py` |

## Architecture Summary

| Layer | Current implementation |
| --- | --- |
| Backend | FastAPI application in `backend/main.py` with route modules under `backend/api/v1/routes/`. |
| Frontend | React/Vite application under `frontend/src/`, with role-aware routes, pages, and navigation. |
| Persistence | SQLAlchemy models in `backend/core/models.py` and database configuration in `backend/core/database.py`. |
| Runtime | Docker Compose stack with PostgreSQL, backend, and frontend in `docker-compose.yml`. |
| Evidence | Security evidence documentation under `docs/evidence/` and RTM files under `docs/traceability/`. |

## Database/Persistence Summary

Current ORM models are defined in `backend/core/models.py`:

- `User`
- `Case`
- `CaseAssignment`
- `Asset`
- `FrozenValuationSnapshot`
- `Ticket`
- `TicketApproval`
- `Document`
- `CustodyAction`
- `AuditEvent`

Demo data is seeded by `scripts/seed_demo_data.py`. The current seed includes users, cases, assignments, assets, frozen valuation snapshots, documents, tickets, approvals, custody actions, and audit events.

## API Surface Summary

| API area | Current route file | Current behavior |
| --- | --- | --- |
| Auth | `backend/api/v1/routes/auth.py` | Login/logout/current principal with signed session cookie, CSRF token, in-memory failed-login throttling, and `/reauth` password confirmation. |
| Cases | `backend/api/v1/routes/cases.py` | Admin-only case creation with recent re-authentication; regular users see assigned cases; auditors are denied case list access. |
| Tickets | `backend/api/v1/routes/tickets.py` | Regular users create custody workflow tickets for assigned cases; admins assign, approve, reject, and update status. Assignment/approval/rejection require recent re-authentication. |
| Documents | `backend/api/v1/routes/documents.py` | Document metadata registration, PDF upload, SHA-256 hashing, RBAC-scoped listing/download. |
| Audit | `backend/api/v1/routes/audit.py` | Auditor-only audit listing, report export, hash lookup, and audit hash-chain verification. |
| Health | `backend/api/v1/routes/health.py` | Health endpoint for local/runtime checks. |
| Chat | `backend/api/v1/routes/chat.py` | Internal PoC chat messages and websocket route. |

No asset mutation API route is present in the current repository. Asset holdings are displayed from case-linked `Asset` rows through case responses and frontend derived views.

## Security Controls Implemented

| Control | Current evidence |
| --- | --- |
| RBAC | `backend/auth/dependencies.py`, route dependencies in `backend/api/v1/routes/`, `tests/test_workflows.py` |
| CSRF protection | `backend/auth/csrf.py`, mutation routes, `tests/test_security_hardening.py` |
| Login throttling | `backend/auth/login_throttle.py`, `backend/api/v1/routes/auth.py`, `tests/test_security_hardening.py` |
| Sensitive action re-authentication | `backend/auth/reauth.py`, `backend/api/v1/routes/auth.py`, `backend/api/v1/routes/cases.py`, `backend/api/v1/routes/tickets.py`, `tests/test_security_hardening.py` |
| Admin-only case creation | `backend/api/v1/routes/cases.py`, `tests/test_workflows.py` |
| Assigned-case scoping | `backend/api/v1/routes/cases.py`, `backend/core/models.py`, `tests/test_workflows.py` |
| Auditor-only audit access | `backend/api/v1/routes/audit.py`, `tests/test_workflows.py` |
| PDF upload validation and hashing | `backend/api/v1/routes/documents.py`, `tests/test_security_hardening.py`, `tests/test_fuzz_security_inputs.py` |
| Audit hash-chain verification | `backend/api/v1/routes/audit.py`, `tests/test_audit_hash_chain.py` |
| Asset fact immutability | `backend/core/models.py`, `tests/test_asset_immutability.py` |
| Security headers | `backend/main.py`, `tests/test_security_hardening.py` |
| Docker hardening | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` |

## DevSecOps Evidence

The GitLab CI pipeline in `.gitlab-ci.yml` includes backend compile/import checks, PostgreSQL-backed tests, frontend build validation, Docker Compose config validation, SCA, SAST, secret scanning, IaC scanning, container scanning, and DAST baseline evidence.

Evidence documentation is under:

- `docs/evidence/sbom/`
- `docs/evidence/security-testing/README.md`
- `docs/evidence/security-reports/README.md`
- `docs/evidence/static-analysis/README.md`
- `docs/evidence/container-security/README.md`
- `docs/evidence/iac-security/README.md`
- `docs/evidence/dast/README.md`
- `docs/evidence/manual-validation/README.md`
- `docs/evidence/security-triage/README.md`

## Test Suite Summary

Current test files:

- `tests/test_workflows.py`
- `tests/test_security_hardening.py`
- `tests/test_fuzz_security_inputs.py`
- `tests/test_audit_hash_chain.py`
- `tests/test_asset_immutability.py`
- `tests/test_models.py`

Current local verification result: `59 passed, 255 warnings`.

## Known Limitations

- Proof of concept only; not production custody software.
- No MFA in the current PoC.
- Re-authentication is limited to selected sensitive administrator actions; it is not MFA or production privileged access management.
- No global API rate limiting in the current PoC.
- Login throttling is in-memory, process-local, and scoped only to failed login attempts.
- No ticket execution endpoint.
- No live blockchain execution.
- No private-key custody, HSM, MPC, or signing integration.
- Audit hash-chain verification is PoC-level continuity checking, not an external append-only ledger.
- Asset immutability is SQLAlchemy ORM-level enforcement, not database-trigger immutable storage.
- Uploaded document binary content is held in an in-memory runtime cache and is not durable across backend restarts.

## Documentation Index

- `docs/current-implementation/README.md`
- `docs/current-implementation/phase1-runtime-and-repository-foundation.md`
- `docs/current-implementation/phase2-core-custody-workflows.md`
- `docs/current-implementation/phase3-role-based-access-and-ui.md`
- `docs/current-implementation/phase4-audit-and-evidence-integrity.md`
- `docs/current-implementation/phase5-devsecops-security-evidence.md`
- `docs/current-implementation/phase6-hardening-and-traceability.md`
- `docs/current-implementation/testing-guide.md`
- `docs/traceability/current-requirements-traceability.md`
- `docs/traceability/current-requirements-traceability-latex.md`
