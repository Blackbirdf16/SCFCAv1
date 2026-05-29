# Phase 4 - Audit and Evidence Integrity

## Status

Current SCFCAv2 implements persisted audit events, document hash lookup, audit report export, and audit hash-chain continuity verification.

## Audit Events

Audit event persistence is implemented by `AuditEvent` in `backend/core/models.py`. Audit event routes and helpers are implemented in `backend/api/v1/routes/audit.py`.

Current audit events include:

- `timestamp`
- actor/user context
- action
- entity type and entity id
- details
- `previous_hash`
- `hash_chain`

Audit events are recorded from current workflows such as login/logout, case creation, ticket actions, document upload, audit report export, hash lookup, and audit chain verification. Evidence: `backend/api/v1/routes/audit.py`, `backend/api/v1/routes/cases.py`, `backend/api/v1/routes/tickets.py`, `backend/api/v1/routes/documents.py`.

## Hash-Chain Fields

The current audit implementation stores:

- `previous_hash`
- `hash_chain`

Hash generation and verification are implemented in `backend/api/v1/routes/audit.py`. Focused tests are in `tests/test_audit_hash_chain.py`.

## Audit Hash-Chain Verification Endpoint

Endpoint:

```text
GET /api/v1/audit/chain/verify
```

Current behavior:

- Recomputes expected audit event hashes.
- Validates each stored `hash_chain`.
- Validates `previous_hash` continuity.
- Detects broken continuity.
- Detects tampered event content where recomputation no longer matches.
- Returns controlled success/failure details.
- Is restricted to auditor role.

Evidence:

- `backend/api/v1/routes/audit.py`
- `tests/test_audit_hash_chain.py`
- `tests/test_workflows.py`

## Audit Pagination

The audit frontend paginates visible audit events at 15 events per page. Evidence: `frontend/src/pages/Audit.tsx` (`AUDIT_PAGE_SIZE = 15`).

This is frontend pagination. The current route still returns filtered event collections from the backend.

## Document Hash Verification

Endpoint:

```text
POST /api/v1/audit/hash/verify
```

Current behavior:

- Accepts a hash value.
- Looks up matching document hashes and audit event hashes.
- Returns controlled match/no-match responses.
- Is restricted to auditor role.

Evidence:

- `backend/api/v1/routes/audit.py`
- `frontend/src/services/audit.ts`
- `frontend/src/pages/Audit.tsx`

## Audit Reports

Endpoints:

```text
GET /api/v1/audit/reports/json
GET /api/v1/audit/reports/html
```

Current behavior:

- Exports filtered audit evidence as JSON or HTML.
- Is restricted to auditor role.
- Records audit report export events.

Evidence: `backend/api/v1/routes/audit.py`, `frontend/src/services/audit.ts`.

## Limitations

- Audit hash-chain verification is PoC-level continuity checking.
- It is not an external append-only ledger.
- It is not a separate write-once audit service.
- It does not prevent direct database tampering by a privileged database operator.
