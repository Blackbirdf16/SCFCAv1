# Phase 3 - Role-Based Access and UI

## Status

Current SCFCAv2 implements backend RBAC and role-aware frontend navigation for regular users, administrators, and auditors.

## Backend Role Enforcement

| Role behavior | Current evidence |
| --- | --- |
| Current principal parsing | `backend/auth/dependencies.py` |
| Administrator-only case creation | `backend/api/v1/routes/cases.py` |
| Regular-only custody ticket initiation | `backend/api/v1/routes/tickets.py` |
| Administrator-only ticket assignment and decisions | `backend/api/v1/routes/tickets.py` |
| Auditor-only audit access | `backend/api/v1/routes/audit.py` |
| CSRF protection for mutations | `backend/auth/csrf.py`, route dependencies |

Backend role checks are authoritative. Frontend role behavior supports usability but does not replace backend checks.

## Frontend Role Behavior

| UI area | Current evidence |
| --- | --- |
| Route definitions | `frontend/src/app/routes.tsx` |
| Sidebar/menu role restrictions | `frontend/src/components/Sidebar.tsx` |
| Dashboard role-specific summaries | `frontend/src/pages/Dashboard.tsx` |
| Case list and case details | `frontend/src/pages/Cases.tsx`, `frontend/src/pages/CaseDetails.tsx` |
| Tickets workflow UI | `frontend/src/pages/Tickets.tsx` |
| Assets read-only and ticket-based UI | `frontend/src/pages/Assets.tsx` |
| Audit UI | `frontend/src/pages/Audit.tsx` |
| Document UI | `frontend/src/pages/Documents.tsx` |

## Regular User UI

Regular users can view assigned cases, create custody workflow tickets for assigned cases, and upload documents for assigned cases. Evidence includes:

- `frontend/src/pages/Cases.tsx`
- `frontend/src/pages/Tickets.tsx`
- `frontend/src/pages/Documents.tsx`
- `tests/test_workflows.py`

## Administrator UI

Administrators can view all cases and tickets, create custody cases, assign tickets, and approve or reject tickets. Administrators cannot initiate regular custody workflow tickets. Evidence includes:

- `frontend/src/pages/Cases.tsx`
- `frontend/src/pages/Tickets.tsx`
- `backend/api/v1/routes/cases.py`
- `backend/api/v1/routes/tickets.py`
- `tests/test_workflows.py`

## Auditor UI and Data Minimization

Auditors are audit-focused. The backend denies operational case-list access for auditors, and the frontend routes/navigation emphasize audit/report views rather than operational custody views. Evidence includes:

- `backend/api/v1/routes/cases.py`
- `backend/api/v1/routes/audit.py`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/pages/Audit.tsx`
- `tests/test_workflows.py`

## Ticket UI Cleanup

The current ticket UI states that regular users initiate custody requests and administrators review them. It does not claim signing, private-key operations, blockchain broadcast, or ticket execution. Evidence: `frontend/src/pages/Tickets.tsx`.

## Assets Page Cleanup

The current Assets page treats balances as recorded case metadata and custody changes as ticket-governed requests. It explicitly does not execute blockchain actions. Evidence: `frontend/src/pages/Assets.tsx`.

## Dashboard Cleanup

The dashboard presents role-aligned summaries and navigation without claiming unsupported custody execution behavior. Evidence: `frontend/src/pages/Dashboard.tsx`.

## Limitations

- Frontend role hiding is supportive only; backend checks remain the security boundary.
- Auditor isolation is within the same PoC application, not a separate reporting service.
