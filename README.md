# SCFCA — Secure Custody Framework for Cryptocurrency Assets

SCFCA is a thesis-oriented proof of concept for institutional custody, management, preservation, and auditing of cryptocurrency assets in criminal investigations.

It demonstrates backend-enforced access control, PostgreSQL-backed custody records, document metadata integrity, audit evidence, and containerized local execution. It is not production custody software and does not execute live blockchain transactions or manage real private keys.

## Current Implemented Capabilities

- PostgreSQL-backed users, cases, tickets, documents, assets, valuation snapshots, ticket approvals, and audit events.
- Backend-enforced role-based access control for regular users, administrators, and auditors.
- Regular users see only cases, tickets, and documents linked to their assigned cases.
- Administrators see all cases and tickets, can assign tickets, can approve or reject tickets, and can review audit event metadata.
- Administrators cannot initiate regular custody workflow tickets; those are restricted to regular users assigned to the case. Administrators can submit case creation request tickets, but there is no direct case creation endpoint in this phase.
- Auditors have a read-only audit/report/hash verification view.
- Document metadata includes stored SHA-256 hash values.
- Uploaded PDF files are hashed by the backend when uploaded through the file upload endpoint.
- Audit events include `previous_hash` and `hash_chain` integrity fields.
- Backend-restricted auditor JSON and HTML audit report export endpoints.
- Backend-restricted auditor hash verification for known document hashes and audit event hashes.
- Docker Compose local runtime with PostgreSQL, backend, and frontend services.
- Docker hardening for the application containers: non-root users, `no-new-privileges`, dropped Linux capabilities, backend read-only filesystem, and `/tmp` mounted as `tmpfs`.
- SBOM/SCA evidence files and Dependabot configuration for backend pip and frontend npm dependencies.
- Trivy scanning guidance is documented, but executed Trivy scan results are not included unless generated locally.

## Quick Start

## CI/CD

`.gitlab-ci.yml` provides a basic GitLab CI foundation for this PoC. The current Phase 1 pipeline validates backend import and compilation, runs the backend test suite, builds the frontend, and checks the Docker Compose configuration syntax.

Security scanners such as SAST, SCA, DAST, container scanning, and IaC scanning are planned for later phases. This repository does not yet claim mature DevSecOps automation, production security gates, or implemented CI security scanning.

### A. Docker Compose Recommended

Prerequisite: Docker Desktop or Docker Engine with Compose support.

From the repository root:

```bash
docker compose up --build
```

URLs:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Backend docs: http://localhost:8000/docs

Seed or reset the PostgreSQL demo data:

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

Stop the local runtime:

```bash
docker compose down
```

### B. Local Execution

Prerequisites:

- Python 3.10+
- Node.js 20+
- A reachable PostgreSQL database

Default local database URL used by the backend settings:

```bash
postgresql://user:password@localhost:5432/scfca
```

Example environment value:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/scfca
```

Install and run the backend:

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Seed or reset the local PostgreSQL demo data:

```bash
python scripts/seed_demo_data.py
```

Install and run the frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Optional local checks:

```bash
npm --prefix frontend run typecheck
pytest
```

## Demo Accounts

| Username | Password | Role |
| --- | --- | --- |
| `alice` | `alice123` | regular |
| `mark` | `mark123` | regular |
| `john` | `john123` | regular |
| `bob` | `bob123` | administrator |
| `eve` | `eve123` | administrator |
| `carol` | `carol123` | auditor |

## Demo Dataset

The current seeder creates a deterministic PostgreSQL dataset:

- `alice` has 10 assigned cases.
- `mark` has 7 assigned cases.
- `john` has 5 assigned cases.
- 1 shared case is assigned to both `mark` and `john`.
- 21 assets.
- 21 documents.
- 21 tickets.
- 161 audit events.

Run the seeder with:

```bash
python scripts/seed_demo_data.py
```

or, in Docker:

```bash
docker compose exec backend python scripts/seed_demo_data.py
```

## Role Behavior

Regular users:

- Can view only cases assigned to their username.
- Can view tickets and documents linked to their assigned cases.
- Can register/upload documents for assigned cases.
- Can create custody workflow tickets only for assigned cases.
- Can see a shared case if their username is one of the active assignments.

Administrators:

- Can view all cases and all tickets.
- Can assign tickets.
- Can approve or reject custody tickets.
- Cannot initiate regular custody workflow tickets.
- Can submit case creation request tickets for regular handlers.
- Cannot create cases directly through a backend case creation endpoint in this phase.
- Can review audit event metadata.

Auditors:

- Cannot access the case list route.
- Can view audit metadata through the audit endpoints.
- Can export JSON and HTML audit reports through backend auditor-restricted endpoints.
- Can verify stored document hashes and audit event hashes through a backend auditor-restricted endpoint.
- Do not have document content download access.

## Security Controls

Implemented controls in the current repository:

- Password hashing with `passlib[bcrypt]`.
- Signed session cookie named `scfca_session`, protected with an HMAC signature derived from `SECRET_KEY`.
- CSRF token cookie/header check for state-changing cookie-authenticated routes.
- Server-side RBAC dependencies in backend routes.
- Regular-user case scoping through PostgreSQL case assignments.
- Document metadata hash storage using `sha256:<digest>` values.
- Backend SHA-256 calculation for uploaded PDF content.
- Audit event `previous_hash` and `hash_chain` fields for a tamper-evident audit trail.
- Backend-restricted auditor hash verification endpoint.
- Docker hardening in Compose and Dockerfiles.
- SBOM/SCA evidence files for dependency transparency.
- Dependabot configuration for weekly backend pip and frontend npm dependency checks.

## Security Evidence / DevSecOps

Relevant files:

- `docs/sbom.md`
- `docs/evidence/sbom/`
- `docs/evidence/container-security/README.md`
- `scripts/container_scan.md`
- `.github/dependabot.yml`

Current scope:

- Trivy commands are documented for optional local execution.
- Trivy result files are not included unless generated locally.
- SBOM and SCA evidence files are present under `docs/evidence/sbom/`.
- Dependabot is configured for backend pip and frontend npm dependencies.
- No GitHub Actions workflow directory is present in this repository.
- No CI/CD security gate enforcement is currently configured.
- No production container certification is claimed.

## Suggested Thesis Defense Walkthrough

1. Start the local runtime:

   ```bash
   docker compose up --build
   ```

2. Seed the database:

   ```bash
   docker compose exec backend python scripts/seed_demo_data.py
   ```

3. Open the frontend at http://localhost:5173.
4. Log in as `alice` and show that only assigned cases are visible.
5. Log in as `mark`, then `john`, and show the shared Mark/John case is visible to both assigned users.
6. Log in as `bob` or `eve` and show administrator visibility across all tickets.
7. Approve or reject a ticket as an administrator.
8. Log in as `carol`.
9. Filter audit events by actor, role, action, entity, date, or free-text query.
10. Export an audit report as JSON and HTML.
11. Verify a known document hash from the document list.
12. Verify a known audit hash from an audit event.

## Project Structure

Current top-level repository structure:

```text
.
├── .github/
│   ├── copilot-instructions.md
│   └── dependabot.yml
├── backend/
│   ├── api/
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
│   ├── main.py
│   └── requirements.txt
├── diagrams/
├── docs/
│   ├── evidence/
│   ├── diagrams/
│   ├── sbom.md
│   └── README.md
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── infra/
├── scripts/
│   ├── container_scan.md
│   └── seed_demo_data.py
├── tests/
│   ├── test_models.py
│   ├── test_security_hardening.py
│   └── test_workflows.py
├── docker-compose.yml
├── .dockerignore
├── .env.docker.example
├── .gitignore
└── README.md
```

## Limitations

- Proof of concept only; not production custody software.
- No live blockchain execution.
- No HSM, MPC, wallet signing, or private-key custody integration.
- No production secret manager integration.
- No CI security gates are currently configured.
- Trivy scanning commands are documented, but scans are not executed by the repository unless run locally.
- No image signing or signed provenance.
- No Kubernetes deployment policy or runtime monitoring.
- Seeded documents are metadata-backed; original binary content for seeded records is not persisted.
- Uploaded document binary content is held in an in-memory runtime cache, so it is not durable across backend restarts.
- Audit hash chaining supports PoC tamper-evidence but is not an append-only external ledger.
