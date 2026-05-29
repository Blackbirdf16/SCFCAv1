# Phase 2 - Core Custody Workflows

## Status

Current SCFCAv2 implements PostgreSQL-backed custody cases, assignments, tickets, documents, assets, and frozen valuation snapshots at PoC scope.

## Cases and Assignments

| Behavior | Current evidence |
| --- | --- |
| Cases persisted in ORM model | `backend/core/models.py` (`Case`) |
| Active assignments persisted in ORM model | `backend/core/models.py` (`CaseAssignment`) |
| Admin-only case creation | `backend/api/v1/routes/cases.py`, `tests/test_workflows.py` |
| Regular users see assigned cases only | `backend/api/v1/routes/cases.py`, `tests/test_workflows.py` |
| Auditors denied operational case list access | `backend/api/v1/routes/cases.py`, `tests/test_workflows.py` |

Administrators can create custody cases through `POST /api/v1/cases/`. The route requires administrator role and CSRF protection.

## Tickets

| Behavior | Current evidence |
| --- | --- |
| Ticket persistence | `backend/core/models.py` (`Ticket`) |
| Ticket approvals | `backend/core/models.py` (`TicketApproval`) |
| Regular user ticket creation for assigned cases | `backend/api/v1/routes/tickets.py`, `tests/test_workflows.py` |
| Administrators cannot initiate regular custody workflow tickets | `backend/api/v1/routes/tickets.py`, `tests/test_workflows.py` |
| Administrator assignment/approval/rejection | `backend/api/v1/routes/tickets.py`, `tests/test_security_hardening.py` |
| Same administrator cannot approve twice | `backend/api/v1/routes/tickets.py`, `tests/test_security_hardening.py` |

The current ticket workflow models review and approval. It does not execute custody actions or blockchain transactions.

## Documents

| Behavior | Current evidence |
| --- | --- |
| Document metadata persistence | `backend/core/models.py` (`Document`) |
| Document metadata routes | `backend/api/v1/routes/documents.py` |
| PDF-only file upload | `backend/api/v1/routes/documents.py`, `tests/test_security_hardening.py` |
| SHA-256 hashing for uploaded PDF bytes | `backend/api/v1/routes/documents.py` |
| Fuzz/security input coverage | `tests/test_fuzz_security_inputs.py` |

Regular users can upload/register documents for assigned cases. Administrators can view operational records. Auditors are audit-focused and do not receive broad operational document access claims in this documentation.

## Assets and Frozen Valuation Snapshots

| Behavior | Current evidence |
| --- | --- |
| Asset persistence | `backend/core/models.py` (`Asset`) |
| Frozen valuation snapshot persistence | `backend/core/models.py` (`FrozenValuationSnapshot`) |
| Seeded assets and valuation snapshots | `scripts/seed_demo_data.py` |
| Holdings displayed through case responses | `backend/api/v1/routes/cases.py`, `frontend/src/services/scfcaData.ts` |
| No direct asset mutation route | `backend/api/v1/routes/`, `tests/test_workflows.py` |

Asset records are currently displayed as case-linked holdings. Custody changes are represented as tickets for review, not as direct asset mutations or blockchain operations.

## Limitations

- No asset registration API route is exposed in the current backend.
- No custody transfer execution is implemented.
- No blockchain broadcast, signing, HSM, MPC, or private-key custody is implemented.
