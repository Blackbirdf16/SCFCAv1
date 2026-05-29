# SCFCA — Secure Custody Framework for Cryptocurrency Assets

## 1. Project Overview

SCFCA is a thesis-oriented proof of concept for institutional custody, management, preservation, and auditing of cryptocurrency assets in criminal-investigation and institutional contexts.

The current SCFCAv2 repository demonstrates:

- FastAPI backend APIs.
- React/Vite frontend.
- PostgreSQL-backed persistence for users, cases, tickets, documents, assets, valuation snapshots, approvals, and audit events.
- Docker Compose runtime for PostgreSQL, backend, and frontend.
- GitLab CI/CD validation and security evidence collection.
- Backend-enforced role-based access control for regular users, administrators, and auditors.
- In-memory PoC login throttling for repeated failed login attempts.
- Short-lived re-authentication tokens for selected sensitive administrator actions.
- Audit hash-chain continuity verification for persisted audit events.
- ORM-level seized asset fact immutability guards.

This is not production custody software. It does not execute live blockchain transactions, does not sign transactions, and does not manage real private keys.

## 2. Login / Demo Accounts

| Role | Username | Password | Permissions |
| --- | --- | --- | --- |
| regular | `alice` | `alice123` | View assigned cases, create custody workflow tickets for assigned cases, and upload PDFs for assigned cases. |
| regular | `mark` | `mark123` | View assigned cases, create custody workflow tickets for assigned cases, and upload PDFs for assigned cases. |
| regular | `john` | `john123` | View assigned cases, create custody workflow tickets for assigned cases, and upload PDFs for assigned cases. |
| administrator | `bob` | `bob123` | Create custody cases, view all cases and tickets, assign tickets, and approve or reject tickets. Selected sensitive actions require recent password confirmation. |
| administrator | `eve` | `eve123` | Create custody cases, view all cases and tickets, assign tickets, and approve or reject tickets. Selected sensitive actions require recent password confirmation. |
| auditor | `carol` | `carol123` | Read-only audit, report, hash lookup, and audit hash-chain verification view. |

Auditors are audit-focused. They do not receive operational case records through the case list API, and the frontend hides operational navigation for the auditor role.

## 3. Quick Start with Docker Compose

Prerequisite: Docker Desktop or Docker Engine with Compose support.

Start the full PoC stack from the repository root:

```bash
docker compose up --build
```

URLs:

- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:8000
- Swagger/API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health/

Use `127.0.0.1` consistently for both frontend and backend. Do not mix `localhost` and `127.0.0.1`, because browser cookies are host-specific and CSRF/session cookies may not be visible across different hostnames.

Seed or reset the PostgreSQL demo data:

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

Stop the local runtime:

```bash
docker compose down
```

Delete the PostgreSQL volume and reset stored data:

```bash
docker compose down -v
```

## 4. Local Development Mode

Docker Compose is the reference PoC environment. Manual local mode requires a reachable PostgreSQL database.

Default local database URL used by backend settings:

```bash
postgresql://user:password@localhost:5432/scfca
```

Example environment setup:

```bash
$env:PYTHONPATH='.'
$env:DEBUG='false'
$env:DATABASE_URL='postgresql://user:password@localhost:5432/scfca'
```

Install backend dependencies and run the backend from the repository root:

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Seed or reset the local PostgreSQL demo data:

```bash
python scripts/seed_demo_data.py
```

Install frontend dependencies and run the frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

## 5. Automated Tests

Current local verification result: `59 passed, 255 warnings`.

Run backend tests:

```bash
$env:PYTHONPATH='.'
$env:DEBUG='false'
pytest -q
pytest -q tests
```

Run frontend build verification:

```bash
npm --prefix frontend run build
```

Validate Docker Compose configuration:

```bash
docker compose config
```

Current test files:

- `tests/test_workflows.py`
- `tests/test_fuzz_security_inputs.py`
- `tests/test_audit_hash_chain.py`
- `tests/test_asset_immutability.py`
- `tests/test_security_hardening.py`
- `tests/test_models.py`

## 6. Manual Demo Walkthrough

1. Start Docker Compose:

   ```bash
   docker compose up --build
   ```

2. Seed the database:

   ```bash
   docker compose exec backend python scripts/seed_demo_data.py
   ```

3. Open the frontend at http://127.0.0.1:5173.
4. Log in as `alice` and show assigned-case visibility.
5. Log in as `bob` and show administrator visibility across cases and tickets.
6. Create a new case as an administrator from the Cases page.
7. Log in as a regular user assigned to a case and create a custody workflow ticket.
8. Approve or reject a ticket as an administrator.
9. Upload PDF evidence for an assigned case.
10. Log in as `carol`.
11. Open the audit section and show audit events.
12. Show audit event pagination at 15 events per page.
13. Run audit hash-chain verification from the auditor audit view.
14. Show that the auditor role is audit-focused: operational navigation is hidden, and direct case-list API access is denied.
15. Show GitLab CI evidence and retained artifacts for tests, builds, scanners, and DAST.

This walkthrough does not include ticket execution, multi-factor authentication, or global API rate limiting because those controls are not implemented in the current PoC. Re-authentication is implemented only for selected sensitive administrator actions.

## 7. Security Controls You Can Demonstrate

Implemented controls in the current repository:

- Backend RBAC and role-based frontend navigation.
- CSRF protection for state-changing cookie-authenticated routes.
- In-memory login throttling for repeated failed login attempts to `/api/v1/auth/login`.
- Short-lived password re-authentication for selected sensitive administrator actions: case creation, ticket approval, ticket rejection, and ticket assignment.
- Administrator-only case creation.
- Assigned-case scoping for regular users.
- Auditor-only audit access.
- PDF-only upload validation and backend SHA-256 hashing for uploaded PDF files.
- Document metadata hash storage using `sha256:<digest>` values.
- Audit event `previous_hash` and `hash_chain` fields.
- Auditor-only audit hash-chain verification endpoint: `GET /api/v1/audit/chain/verify`.
- Auditor-only hash lookup endpoint: `POST /api/v1/audit/hash/verify`.
- Auditor-only audit report exports: `GET /api/v1/audit/reports/json` and `GET /api/v1/audit/reports/html`.
- Asset immutability ORM guards for persisted seized asset facts and frozen valuation snapshots.
- Docker hardening: non-root container users, Dockerfile `HEALTHCHECK` instructions, `no-new-privileges`, `cap_drop: ALL`, backend read-only filesystem, and `/tmp` mounted as `tmpfs`.
- Security headers set by the FastAPI middleware.
- Dependency and security scanner evidence in GitLab CI.

Not implemented in the current PoC:

- MFA.
- Global API rate limiting.
- Ticket execution or blockchain transaction execution.

## 8. DevSecOps Security Evidence

GitLab CI/CD provides validation and visibility-first security evidence. Security jobs are intentionally non-blocking evidence jobs, not production release gates.

Current jobs and tools include:

- Backend compile/import validation.
- `pytest` backend tests.
- Hypothesis fuzz/security input tests.
- Frontend production build with `npm run build`.
- Docker Compose configuration validation.
- `pip-audit` for backend Python dependency analysis.
- `npm audit` for frontend dependency analysis.
- Bandit for Python SAST.
- Semgrep for broader static analysis.
- Gitleaks for secret scanning.
- Checkov for Docker/YAML/GitLab CI configuration scanning.
- Trivy backend and frontend container image scans.
- OWASP ZAP baseline DAST against the running PoC stack.
- HTML security evidence reports generated from scanner JSON where supported.
- JSON artifacts retained for machine-readable evidence.
- Manual validation checklist documentation.
- Security triage documentation.
- Requirements traceability documentation.

Relevant evidence paths:

- `.gitlab-ci.yml`
- `docs/evidence/sbom/`
- `docs/evidence/security-testing/README.md`
- `docs/evidence/security-reports/README.md`
- `docs/evidence/manual-validation/README.md`
- `docs/evidence/security-triage/README.md`
- `docs/evidence/container-security/README.md`
- `docs/evidence/iac-security/README.md`
- `docs/evidence/dast/README.md`
- `docs/evidence/static-analysis/README.md`
- `scripts/security_reports_to_html.py`

## 9. Requirements Traceability Matrix

Current traceability files:

- `docs/traceability/current-requirements-traceability.md`
- `docs/traceability/current-requirements-traceability-latex.md`

These files map requirements to implementation files, tests, security evidence, residual risks, and PoC limitations. They are intended for thesis traceability and Overleaf/LaTeX-friendly annex material.

## 10. Project Structure

Current top-level repository structure:

```text
.
├── .github/
│   ├── copilot-instructions.md
│   └── dependabot.yml
├── backend/
│   ├── api/
│   │   └── v1/
│   │       └── routes/
│   │           ├── audit.py
│   │           ├── auth.py
│   │           ├── cases.py
│   │           ├── chat.py
│   │           ├── documents.py
│   │           ├── health.py
│   │           └── tickets.py
│   ├── asset_registry/
│   ├── assets/
│   ├── audit/
│   ├── auth/
│   ├── cases/
│   ├── common/
│   ├── config/
│   ├── core/
│   ├── custody/
│   ├── documents/
│   ├── middleware/
│   ├── models/
│   ├── repositories/
│   ├── roles/
│   ├── scripts/
│   ├── services/
│   ├── tests/
│   ├── tickets/
│   ├── users/
│   ├── validators/
│   ├── Dockerfile
│   ├── README.md
│   └── requirements.txt
├── diagrams/
├── docs/
│   ├── diagrams/
│   ├── evidence/
│   ├── traceability/
│   ├── README.md
│   └── sbom.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── types/
│   │   └── utils/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── infra/
├── scripts/
│   ├── container_scan.md
│   ├── security_reports_to_html.py
│   └── seed_demo_data.py
├── tests/
│   ├── test_asset_immutability.py
│   ├── test_audit_hash_chain.py
│   ├── test_fuzz_security_inputs.py
│   ├── test_models.py
│   ├── test_security_hardening.py
│   └── test_workflows.py
├── docker-compose.yml
├── pytest.ini
├── .dockerignore
├── .env.docker.example
├── .gitignore
├── .gitlab-ci.yml
└── README.md
```

## 11. Current Limitations / Deferred Controls

- Proof of concept only; not production custody software.
- No live blockchain execution.
- No ticket execution endpoint.
- No private-key custody.
- No HSM, MPC, wallet signing, or key ceremony integration.
- No production secret manager integration.
- No production compliance certification.
- CI security jobs are non-blocking evidence jobs, not production release gates.
- OWASP ZAP baseline is unauthenticated and does not replace deeper authenticated DAST or manual assessment.
- No MFA in the current PoC.
- Re-authentication is limited to selected sensitive administrator actions and is not MFA or production privileged access management.
- No global API rate limiting in the current PoC.
- Login throttling is in-memory and scoped only to failed `/api/v1/auth/login` attempts; it is not distributed production-grade brute-force protection.
- Asset immutability is SQLAlchemy ORM-level enforcement, not database-trigger immutable storage and not external immutable storage.
- Audit hash-chain verification is PoC-level continuity checking, not an external append-only ledger.
- Seeded documents are metadata-backed; original binary content for seeded records is not persisted.
- Uploaded document binary content is held in an in-memory runtime cache, so it is not durable across backend restarts.
- Security scanner output requires human triage and is not a claim that all findings are fixed.

## 12. Troubleshooting

| Problem | Current fix |
| --- | --- |
| Docker Desktop is not running | Start Docker Desktop, then rerun `docker compose up --build`. |
| `docker compose` cannot find `docker-compose.yml` | Run the command from the repository root. |
| Port `8000` is already in use | Stop the process using port `8000` or change the backend port mapping for local testing. |
| Port `5173` is already in use | Stop the existing frontend/Vite server or change the frontend port for local testing. |
| `vite` is not recognized | Run `npm --prefix frontend install`, then retry the frontend command. |
| `ModuleNotFoundError: No module named 'backend'` | Run backend commands from the repository root and set `PYTHONPATH=.`. |
| Frontend shows missing CSRF/session behavior or empty data unexpectedly | Use `127.0.0.1` consistently. Do not mix `localhost` and `127.0.0.1`. |
| Demo data needs a clean reset | Run `docker compose down -v`, start the stack again, then run `docker compose exec backend python scripts/seed_demo_data.py`. |
