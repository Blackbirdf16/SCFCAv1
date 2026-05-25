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
