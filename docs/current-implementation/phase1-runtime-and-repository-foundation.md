# Phase 1 - Runtime and Repository Foundation

## Status

Current SCFCAv2 implementation evidence exists in the repository and runtime configuration. This phase documents the foundation used by later custody, audit, and security-evidence work.

## Scope

- Repository stabilization.
- Docker Compose runtime.
- PostgreSQL-backed local PoC.
- Deterministic seed data.
- Local demo URL standardization.
- Repository hygiene cleanup.

## Runtime Foundation

| Area | Current implementation | Evidence |
| --- | --- | --- |
| Local stack | PostgreSQL, backend, and frontend services | `docker-compose.yml` |
| Backend runtime | FastAPI app served by backend container | `backend/main.py`, `backend/Dockerfile` |
| Frontend runtime | React/Vite app served by frontend container | `frontend/`, `frontend/Dockerfile` |
| Database | PostgreSQL 16 Alpine service with named volume | `docker-compose.yml` |
| Health check | Backend health endpoint and Dockerfile container health checks | `backend/api/v1/routes/health.py`, `backend/Dockerfile`, `frontend/Dockerfile` |

## PostgreSQL-Backed PoC

The current backend uses SQLAlchemy configuration in `backend/core/database.py` and ORM models in `backend/core/models.py`. Docker Compose sets `DATABASE_URL` for the backend to use the PostgreSQL service.

The GitLab backend test job uses a PostgreSQL service and seeds the database before running tests. Evidence: `.gitlab-ci.yml`.

## Seed Data

The current deterministic seeder is `scripts/seed_demo_data.py`.

It creates demo users, cases, assignments, assets, frozen valuation snapshots, documents, tickets, approvals, custody actions, and audit events. The README documents the demo accounts and Docker seed command.

## Local Demo URL Standardization

The current README standardizes local access on:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/api/v1/health/`

The documentation warns not to mix `localhost` and `127.0.0.1` because browser cookies are host-specific.

## Repository Hygiene Cleanup

Repository hygiene changes removed tracked archive metadata and ignored local reference material:

- `.gitignore` ignores `__MACOSX/`.
- `.gitignore` ignores `old-repo-reference/`.
- The local old reference copy is not part of the current project test suite or implementation claims.

## Verification Commands

Current foundation checks:

```bash
python -m compileall backend
python -c "import sys; sys.path.insert(0, r'.'); from backend.main import app; print('APP_IMPORT_OK')"
docker compose config
```

## Limitations

- Docker Compose is the reference PoC runtime, not a production deployment claim.
- No Kubernetes policy, production secret manager, image signing, or production monitoring is claimed.
