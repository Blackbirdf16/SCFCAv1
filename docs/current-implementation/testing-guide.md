# SCFCAv2 Current Testing Guide

## Scope

This guide describes the current SCFCAv2 test and verification commands only. It does not reference old prototype test files or unsupported controls.

## Current Verified Result

Latest local verification result:

```text
41 passed, 191 warnings
```

Warnings are currently deprecation and test-client warnings, not test failures.

## Backend Test Commands

From the repository root:

```powershell
Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
$env:PYTHONPATH='.'
$env:DEBUG='false'
pytest -q
pytest -q tests
```

## Backend Compile and Import Checks

```powershell
Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
$env:PYTHONPATH='.'
$env:DEBUG='false'
python -m compileall backend
python -c "import sys; sys.path.insert(0, r'.'); from backend.main import app; print('APP_IMPORT_OK')"
```

## Frontend Build Check

```powershell
npm --prefix frontend run build
```

Equivalent from inside `frontend/`:

```powershell
cd frontend
npm run build
cd ..
```

## Docker Compose Config Check

```powershell
docker compose config
```

## Current Test Files

| Test file | Current focus |
| --- | --- |
| `tests/test_workflows.py` | Role workflows, case creation, ticket behavior, audit access, audit chain endpoint access, absence of direct asset mutation routes. |
| `tests/test_security_hardening.py` | Security headers, CSRF behavior, ticket approval constraints, document validation. |
| `tests/test_fuzz_security_inputs.py` | Hypothesis malformed-input checks for selected backend routes. |
| `tests/test_audit_hash_chain.py` | Audit hash-chain verification function behavior. |
| `tests/test_asset_immutability.py` | ORM-level seized asset fact and frozen valuation immutability. |
| `tests/test_models.py` | ORM model import and table metadata creation. |

## CI Test Behavior

The GitLab `backend_tests` job in `.gitlab-ci.yml` uses a PostgreSQL service, waits for readiness, runs `scripts/seed_demo_data.py`, and executes:

```bash
pytest -q --junitxml=pytest-report.xml
```

## Notes

- `pytest.ini` scopes collection to `tests`, so local reference material is not collected as part of the current project suite.
- Generated `__pycache__` changes should not be committed.
- The test suite does not claim MFA, re-authentication, rate limiting, ticket execution, or blockchain custody behavior.
