# Phase 6 - Hardening and Traceability

## Status

Current SCFCAv2 hardening work focuses on targeted PoC security improvements, honest limitations, and traceability evidence.

## Bandit B311 Remediation

Predictable pseudo-random behavior flagged by Bandit B311 was removed where security-sensitive interpretation would be misleading. Current evidence is tracked through:

- `docs/evidence/static-analysis/README.md`
- `.gitlab-ci.yml` (`backend_sast_bandit`)
- `docs/evidence/security-triage/README.md`

## HTTP Security Headers

Security headers are added by FastAPI middleware in `backend/main.py`.

Current headers include:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

Evidence:

- `backend/main.py`
- `tests/test_security_hardening.py`

## Safe npm Audit Fix

Frontend dependency evidence is captured by:

- `frontend/package.json`
- `frontend/package-lock.json`
- `.gitlab-ci.yml` (`frontend_dependency_audit`)
- `docs/evidence/sbom/npm-audit-frontend.json`
- `docs/evidence/sbom/README.md`

Dependency changes are not claimed here unless represented in the current repository lockfile and evidence artifacts.

## Audit Hash-Chain Hardening

Current audit hash-chain verification is implemented in `backend/api/v1/routes/audit.py`.

Tests prove:

- Valid chains verify successfully.
- Empty chains return controlled success.
- Broken `previous_hash` continuity is detected.
- Tampered event content is detected.
- The verification endpoint is auditor-only.

Evidence:

- `tests/test_audit_hash_chain.py`
- `tests/test_workflows.py`
- `docs/traceability/current-requirements-traceability.md`

## Asset Immutability Guards

Current asset immutability is enforced through SQLAlchemy mapper events in `backend/core/models.py`.

Protected persisted `Asset` fields include:

- `asset_id`
- `symbol`
- `network`
- `wallet_ref`
- `balance`
- `asset_type`
- `protocol`
- `case_id`
- `registered_at`

Protected `FrozenValuationSnapshot` fields include:

- `case_id`
- `snapshot_time`
- `valuation`

`Asset.status` remains mutable as operational metadata.

Evidence:

- `backend/core/models.py`
- `tests/test_asset_immutability.py`
- `tests/test_workflows.py`
- `docs/traceability/current-requirements-traceability.md`

Limitation: this is ORM-level enforcement, not a database trigger or external immutable store.

## Login Throttling Hardening

Current login throttling is implemented as a narrow in-memory PoC control for `POST /api/v1/auth/login`.

Policy:

- Maximum failed attempts: 5.
- Window: 5 minutes.
- Throttle duration: 5 minutes.
- Key: normalized username and client IP.
- Successful login resets the failed-attempt counter for that username/IP pair.

Evidence:

- `backend/auth/login_throttle.py`
- `backend/api/v1/routes/auth.py`
- `tests/test_security_hardening.py`
- `docs/traceability/current-requirements-traceability.md`

Limitations:

- Process-local only.
- Not distributed across backend workers or hosts.
- Does not use Redis or external infrastructure.
- Does not rate-limit health checks, frontend static assets, audit verification, or all API endpoints.

## Administrative Re-Authentication Hardening

Current re-authentication is implemented as a short-lived signed token for selected sensitive administrator actions.

Protected actions:

- Admin-only case creation: `POST /api/v1/cases/`.
- Ticket assignment: `PATCH /api/v1/tickets/{ticket_id}/assign`.
- Ticket approval: `POST /api/v1/tickets/{ticket_id}/approve`.
- Ticket rejection: `POST /api/v1/tickets/{ticket_id}/reject`.

Policy:

- The administrator must already have a valid session.
- `POST /api/v1/auth/reauth` verifies the current user's password.
- A signed `X-Reauth-Token` is valid for 5 minutes.
- Tokens are bound to the authenticated username and role.
- Missing, invalid, expired, or cross-user tokens return `403`.
- Wrong password returns `401` with a generic authentication failure.

Evidence:

- `backend/auth/reauth.py`
- `backend/api/v1/routes/auth.py`
- `backend/api/v1/routes/cases.py`
- `backend/api/v1/routes/tickets.py`
- `frontend/src/services/auth.ts`
- `frontend/src/services/scfcaData.ts`
- `frontend/src/pages/Cases.tsx`
- `frontend/src/pages/Tickets.tsx`
- `tests/test_security_hardening.py`
- `tests/test_workflows.py`
- `docs/traceability/current-requirements-traceability.md`

Limitations:

- Password confirmation only; not MFA.
- Stateless token; no server-side revocation list.
- PoC-level privileged action confirmation, not production privileged access management.
- Does not implement ticket execution or custody execution.

## RTM Documents

Current traceability files:

- `docs/traceability/current-requirements-traceability.md`
- `docs/traceability/current-requirements-traceability-latex.md`

These map controls to current files, tests, evidence, and residual risks.

## Previous Prototype Comparison

The previous prototype documentation included broader controls than the current SCFCAv2 repository implements. Current SCFCAv2 documentation does not claim those controls unless current code and tests support them.

Deferred or not implemented in the current PoC:

- MFA.
- Global API rate limiting.
- Ticket execution.
- Blockchain transaction execution.
- HSM/MPC/private-key custody.
- Production compliance or production deployment assurance.

## Deferred Controls

Deferred controls remain useful thesis discussion points, but they are not represented as implemented SCFCAv2 features. They should be tracked as future work unless current code, tests, and evidence are added.
