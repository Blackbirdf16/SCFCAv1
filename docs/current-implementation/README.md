# Current SCFCAv2 Implementation Documentation

This directory documents the current SCFCAv2 repository only. The documents are inspired by the structure of earlier prototype documentation, but claims are limited to current code, tests, CI, and evidence.

## Index

| Document | Purpose |
| --- | --- |
| [Implementation Record](implementation-record.md) | Current project summary, architecture, controls, tests, limitations, and documentation map. |
| [Phase 1 - Runtime and Repository Foundation](phase1-runtime-and-repository-foundation.md) | Docker Compose runtime, PostgreSQL PoC, seed data, URL conventions, and repo hygiene. |
| [Phase 2 - Core Custody Workflows](phase2-core-custody-workflows.md) | Cases, assignments, tickets, approvals, documents, assets, and valuation snapshots. |
| [Phase 3 - Role-Based Access and UI](phase3-role-based-access-and-ui.md) | Regular/admin/auditor behavior across backend and frontend UI. |
| [Phase 4 - Audit and Evidence Integrity](phase4-audit-and-evidence-integrity.md) | Audit events, hash-chain fields, chain verification, pagination, hash lookup, and report exports. |
| [Phase 5 - DevSecOps Security Evidence](phase5-devsecops-security-evidence.md) | GitLab CI jobs, security scanners, evidence artifacts, manual validation, and triage. |
| [Phase 6 - Hardening and Traceability](phase6-hardening-and-traceability.md) | Hardening work, audit-chain hardening, asset immutability, RTM, previous prototype comparison, and deferred controls. |
| [Testing Guide](testing-guide.md) | Current test files, commands, verification result, and CI test behavior. |

## Requirements Traceability Matrix

Current RTM documents:

- [Current Requirements Traceability](../traceability/current-requirements-traceability.md)
- [Current Requirements Traceability - LaTeX Friendly](../traceability/current-requirements-traceability-latex.md)

## Explicitly Deferred / Not Implemented in Current PoC

- MFA.
- Re-authentication prompts.
- Rate limiting/login throttling.
- Ticket execution.
- Live blockchain execution.
- HSM/MPC/private-key custody.
- Production compliance certification.
