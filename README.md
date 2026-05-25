# SCFCA: Secure Custody Framework for Cryptocurrency Assets

SCFCA is a thesis-oriented proof of concept for institutional crypto custody operations: cases, asset registry, documents (evidence), and a custody ticket approval workflow.

## Setup & Run (Local Demo)

### 1. Backend (FastAPI)
Prereqs: Python 3.10+

From the repository root:

```
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health

Optional: seed demo data (if you want to reset):

```
python scripts/seed_demo_data.py
```

### 2. Frontend (React + TypeScript)
Prereqs: Node.js 20+

From the repository root:

```
npm --prefix frontend install
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

- Frontend URL: http://127.0.0.1:5173

### 3. (Optional) Typecheck / Tests

Frontend typecheck:

```
npm --prefix frontend run typecheck
```

Python tests (if configured locally):

```
pytest
```

If PowerShell shows `npm is not recognized`, install Node.js and reopen the terminal.

## Docker / Containerized Execution

Prereqs: Docker Desktop.

From the repository root:

```
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

Seed or reset the PostgreSQL demo data from the backend container:

```
docker compose exec backend python scripts/seed_demo_data.py
```

Stop the containers:

```
docker compose down
```

### Docker security hardening

The Docker setup uses non-root users in the backend and frontend images, PostgreSQL health checks, a backend health check, dropped Linux capabilities for application containers, `no-new-privileges`, and a read-only backend filesystem with `/tmp` mounted as temporary writable storage.

### Secrets and configuration

Docker Compose reads configuration from shell variables with safe proof-of-concept defaults. Use `.env.docker.example` as a template for local overrides, and do not commit a real `.env` file.

Important values:

- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `SECRET_KEY`
- `DEBUG`

### Container scanning with Trivy

Trivy is optional and is not required to run the application. If installed, build the images and run:

```
trivy image scfca-repo-backend
trivy image scfca-repo-frontend
trivy fs .
```

Optional evidence commands are documented in `docs/evidence/container-security/README.md` and `scripts/container_scan.md`.

The Docker setup is for proof-of-concept reproducibility. It is not production-certified and does not include Kubernetes deployment policy, image signing, runtime monitoring, or CI/CD enforcement.

---

## Demo Walkthrough

### Regular (Operator)
- Login as: `alice` / `alice123`
- Work assigned cases
- Upload/view documents linked to assigned cases
- Create custody tickets for assigned cases

### Administrator
- Login as: `bob` / `bob123` or `eve` / `eve123`
- Approve/reject custody tickets (two-stage approval workflow)
- Manage cases/assets/documents

### Auditor
- Login as: `carol` / `carol123`
- Review audit events and traceability
- Read-only (no case/asset/ticket modifications)

### Additional Regular Demo Users
- Login as: `mark` / `mark123` or `john` / `john123`
- These are extra regular users for testing assignment and access boundaries

---

## Key Workflows (Tested)
- Login (all roles)
- Case listing and case details
- Document registration + integrity check
- Custody tickets: create, assign, approve stage 1, approve stage 2, reject
- Account: identification + security statement + reports (admin/auditor)
- Settings: profile + privacy export (local only)
- RBAC enforced across navigation and actions

---

## Notes
- This PoC is for academic demonstration only.
- All credentials and data are for demo use.
- In-browser persistence (localStorage) is used for demo realism and is not tamper-resistant.
- For thesis, see `docs/` and `docs/diagrams/` for architecture diagrams and rationale.
