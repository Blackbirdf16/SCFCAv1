# Current SCFCA Requirements Traceability (SCFCAv2)

This annex maps thesis requirements to the current SCFCA repository implementation and evidence.

Status legend: `Implemented`, `Partial`, `Evidence-only`, `Design-level / documented`, `Deferred`, `Not implemented in PoC`.

## Table 1 - Thesis Security Goals to Implementation Evidence

| Thesis Goal / Security Control | Current Implementation Location(s) | Test / CI / Evidence Location(s) | Coverage Status | Notes |
| --- | --- | --- | --- | --- |
| Role-Based Access Control | `backend/auth/dependencies.py`, `backend/api/v1/routes/*.py`, `frontend/src/components/Sidebar.tsx` | `tests/test_workflows.py`, `tests/test_security_hardening.py` | Implemented | Backend role checks enforce access decisions. |
| Authentication and session handling | `backend/api/v1/routes/auth.py`, `backend/auth/dependencies.py`, `backend/auth/service.py` | `tests/test_security_hardening.py` | Implemented | Signed session cookie (`scfca_session`) and login/logout audit events. |
| CSRF protection | `backend/auth/csrf.py`, state-changing routes in `backend/api/v1/routes/` | `tests/test_security_hardening.py`, `tests/test_workflows.py` | Implemented | Cookie+header token check on mutation routes. |
| Admin-only case creation | `backend/api/v1/routes/cases.py` (`POST /cases/`) | `tests/test_workflows.py` | Implemented | `require_role(Role.administrator)` and CSRF protection. |
| Case assignment and scoped case visibility | `backend/api/v1/routes/cases.py`, `backend/core/models.py` (`CaseAssignment`) | `tests/test_workflows.py` | Implemented | Regular users only see assigned cases. |
| Ticket workflow | `backend/api/v1/routes/tickets.py`, `frontend/src/pages/Tickets.tsx` | `tests/test_workflows.py`, `tests/test_fuzz_security_inputs.py` | Implemented | Create/list/assign/approve/reject flows are present. |
| Dual approval / separation of duties | `backend/api/v1/routes/tickets.py` (`TicketApproval`, stage 1/2) | `tests/test_security_hardening.py`, `tests/test_workflows.py` | Implemented | Same admin cannot approve twice. |
| Auditor-only audit access | `backend/api/v1/routes/audit.py`, `frontend/src/pages/Audit.tsx`, `frontend/src/utils/roles.ts` | `tests/test_workflows.py` | Implemented | Audit endpoints require auditor role. |
| Audit event recording | `backend/api/v1/routes/audit.py` (`record_audit_event`) | `tests/test_workflows.py` | Implemented | Login, ticket, case, report, and hash-verify events recorded. |
| Audit hash-chain verification | `backend/api/v1/routes/audit.py` (`verify_audit_chain`, `/chain/verify`, `hash_chain`, `previous_hash`) | `tests/test_audit_hash_chain.py`, `tests/test_workflows.py` | Implemented | Chain verification recomputes event hashes, validates `previous_hash` continuity, detects tampered content, and is auditor-only. |
| Asset seized-fact immutability | `backend/core/models.py` (`Asset`, `FrozenValuationSnapshot` update guards), absence of direct asset mutation route | `tests/test_asset_immutability.py`, `tests/test_workflows.py` | Implemented | Persisted asset symbol/type/balance/wallet/timestamp facts and frozen valuation snapshots cannot be changed through ORM updates; no API route exposes direct asset/holding mutation. |
| Audit pagination / controlled audit review | `frontend/src/pages/Audit.tsx` (`AUDIT_PAGE_SIZE = 15`) | Manual role validation evidence, audit UI behavior checks | Partial | Pagination is client-side in frontend, not server-side paged API. |
| Document upload and hashing | `backend/api/v1/routes/documents.py` | `tests/test_security_hardening.py`, `tests/test_fuzz_security_inputs.py` | Implemented | Upload endpoint computes `sha256`, metadata endpoint validates document fields. |
| PostgreSQL persistence | `backend/core/database.py`, `backend/core/models.py`, `scripts/seed_demo_data.py` | `backend_tests` job in `.gitlab-ci.yml` | Implemented | CI uses PostgreSQL service for backend tests. |
| Docker Compose deployment | `docker-compose.yml` | `docker_compose_config` job in `.gitlab-ci.yml` | Implemented | Runtime stack for postgres/backend/frontend defined. |
| GitLab CI/CD validation | `.gitlab-ci.yml` | CI jobs in `validate`, `test`, `build`, `security` stages | Implemented | Includes compile/import, tests, build, and security evidence jobs. |
| SCA dependency scanning | `.gitlab-ci.yml` (`backend_dependency_audit`, `frontend_dependency_audit`) | `docs/evidence/sbom/README.md`, `docs/evidence/sbom/*.json` | Implemented | Uses `pip-audit` and `npm audit`. |
| SAST scanning | `.gitlab-ci.yml` (`backend_sast_bandit`, `semgrep_sast`) | `docs/evidence/security-reports/README.md` | Implemented | Bandit + Semgrep evidence pipeline. |
| Secret detection | `.gitlab-ci.yml` (`secret_scan_gitleaks`) | `docs/evidence/security-reports/README.md` | Implemented | Gitleaks report generation in CI. |
| Container scanning | `.gitlab-ci.yml` (`container_scan_backend_trivy`, `container_scan_frontend_trivy`) | `docs/evidence/security-triage/README.md` | Implemented | Trivy jobs produce JSON/HTML artifacts. |
| IaC/config scanning | `.gitlab-ci.yml` (`iac_scan_checkov`) | `docs/evidence/security-triage/README.md` | Implemented | Checkov on Dockerfile/YAML/GitLab CI configs. |
| DAST with OWASP ZAP | `.gitlab-ci.yml` (`dast_zap_baseline`) | `docs/evidence/dast/README.md` | Implemented | Baseline DAST is non-blocking evidence (`allow_failure: true`). |
| HTML security evidence reports | `scripts/security_reports_to_html.py` | `docs/evidence/security-reports/README.md` | Implemented | JSON reports transformed to reviewer-friendly HTML. |
| Manual validation checklist | `docs/evidence/manual-validation/README.md` | Manual validation evidence folder | Evidence-only | Checklist template exists; execution status is manual. |
| Security findings triage/remediation | `docs/evidence/security-triage/README.md` | Security triage document | Partial | Triage plan documented; not all findings remediated. |
| PlantUML architecture evidence | `docs/diagrams/plantuml/*.puml`, `docs/diagrams/plantuml/README.md` | Diagram exports in same folder (`.png`, `.svg`) | Design-level / documented | Architecture evidence is documented artifacts, not runtime control. |

Notes:
- Controls outside current PoC scope (MFA, HSM, MPC, blockchain transaction execution, private-key custody, production deployment hardening) are `Not implemented in PoC`.
- `docs/evidence/security-triage/README.md` explicitly marks CSP and COEP-related hardening as deferred/partial.

## Table 2 - Functional Requirements to Code and Test Evidence

| Req. ID | Requirement | Implementation Location(s) | Test / Evidence | Coverage Status |
| --- | --- | --- | --- | --- |
| FR-01 | Case listing and details | `backend/api/v1/routes/cases.py`, `frontend/src/pages/Cases.tsx`, `frontend/src/pages/CaseDetails.tsx` | `tests/test_workflows.py` | Implemented |
| FR-02 | Admin-only case creation | `backend/api/v1/routes/cases.py` (`POST /api/v1/cases/`) | `tests/test_workflows.py` | Implemented |
| FR-03 | Case assignment visibility | `backend/api/v1/routes/cases.py`, `backend/core/models.py` (`CaseAssignment`) | `tests/test_workflows.py` | Implemented |
| FR-04 | Document upload | `backend/api/v1/routes/documents.py`, `frontend/src/pages/Documents.tsx` | `tests/test_security_hardening.py`, `tests/test_fuzz_security_inputs.py` | Implemented |
| FR-05 | Ticket creation | `backend/api/v1/routes/tickets.py`, `frontend/src/pages/Tickets.tsx` | `tests/test_workflows.py`, `tests/test_fuzz_security_inputs.py` | Implemented |
| FR-06 | Ticket approval/rejection | `backend/api/v1/routes/tickets.py` (`/approve`, `/reject`) | `tests/test_security_hardening.py`, `tests/test_workflows.py` | Implemented |
| FR-07 | Audit events | `backend/api/v1/routes/audit.py` | `tests/test_workflows.py` | Implemented |
| FR-08 | Auditor access | `backend/api/v1/routes/audit.py`, `frontend/src/pages/Audit.tsx`, `frontend/src/utils/roles.ts` | `tests/test_workflows.py` | Implemented |
| FR-09 | PostgreSQL persistence | `backend/core/database.py`, `backend/core/models.py`, `scripts/seed_demo_data.py` | `.gitlab-ci.yml` (`backend_tests`) | Implemented |
| FR-10 | Reports/evidence export (audit JSON/HTML) | `backend/api/v1/routes/audit.py` (`/reports/json`, `/reports/html`), `frontend/src/services/audit.ts` | Manual evidence in `docs/evidence/` and CI artifact generation docs | Partial |

Notes:
- FR-10 is marked `Partial` because report generation is implemented, but evidence completeness depends on external CI artifact retention/review workflow.

## Table 3 - Security Requirements to Controls

| Security Requirement | Control Implemented | Backend / Frontend / CI Location | Evidence | Residual Risk / Limitation |
| --- | --- | --- | --- | --- |
| Least privilege RBAC | Role-gated dependencies and route checks | `backend/auth/dependencies.py`, `backend/api/v1/routes/*.py`, `frontend/src/components/Sidebar.tsx` | `tests/test_workflows.py` | UI role hiding is supportive; backend remains authoritative. |
| Auditor read-only separation | Auditor-only audit routes, operational route denial | `backend/api/v1/routes/audit.py`, `backend/api/v1/routes/cases.py` | `tests/test_workflows.py` | Auditor still depends on same app boundary (no separate reporting service). |
| Administrator/case-handler separation | Admin cannot create regular custody tickets; regular cannot create cases | `backend/api/v1/routes/tickets.py`, `backend/api/v1/routes/cases.py` | `tests/test_workflows.py` | Case creation request is ticket-based; broader governance workflow is PoC-level. |
| CSRF protection | CSRF cookie+header verification on state changes | `backend/auth/csrf.py`, mutation routes | `tests/test_security_hardening.py` | No claim of anti-automation/rate controls beyond CSRF. |
| Audit hash-chain integrity verification | Auditor-only chain verification validates stored hashes and continuity | `backend/api/v1/routes/audit.py` (`/chain/verify`) | `tests/test_audit_hash_chain.py`, `tests/test_workflows.py` | Implemented for persisted audit rows; not a separate append-only audit service. |
| Seized asset fact immutability | ORM update guards block changes to registered asset facts and frozen valuation snapshots; no direct mutation route exists | `backend/core/models.py`, `backend/api/v1/routes/cases.py` | `tests/test_asset_immutability.py`, `tests/test_workflows.py` | App-level ORM enforcement; not a database trigger or blockchain custody guarantee. |
| Controlled error handling | Explicit `HTTPException` responses and validation checks | `backend/api/v1/routes/*.py` | `tests/test_fuzz_security_inputs.py` | No unified global error envelope middleware for all exceptions. |
| Non-root Docker containers | Runtime user drop to non-root | `backend/Dockerfile`, `frontend/Dockerfile` | Dockerfile review | Host-level runtime controls are environment dependent. |
| Docker hardening | Read-only FS, `cap_drop: ALL`, `no-new-privileges`, `tmpfs` | `docker-compose.yml` | Compose config + README security section | No Kubernetes policy enforcement in PoC. |
| Dependency scanning | `pip-audit` and `npm audit` jobs | `.gitlab-ci.yml` | `docs/evidence/sbom/`, security reports docs | Findings still require manual triage/remediation decisions. |
| SAST | Bandit and Semgrep jobs | `.gitlab-ci.yml` | `docs/evidence/security-reports/README.md` | Scanner coverage is best-effort; not equivalent to full code audit. |
| Secret scanning | Gitleaks job | `.gitlab-ci.yml` | `docs/evidence/security-reports/README.md` | No guarantee against all secret leakage patterns. |
| Trivy container scanning | Backend/frontend image scans in CI | `.gitlab-ci.yml` | `docs/evidence/security-triage/README.md` | Triage doc states latest artifacts still require review. |
| Checkov IaC/config scanning | Dockerfile/YAML/GitLab CI check | `.gitlab-ci.yml` | `docs/evidence/security-triage/README.md` | Some findings may remain as accepted PoC limitations. |
| ZAP DAST baseline | Baseline DAST job with artifact outputs | `.gitlab-ci.yml` (`dast_zap_baseline`) | `docs/evidence/dast/README.md` | Baseline, unauthenticated scan; non-blocking evidence-only mode. |
| Residual CSP/COEP findings | Deferred hardening noted in triage | `docs/evidence/security-triage/README.md` | Triage notes | Marked deferred/partial in current PoC. |
| Residual Vite/esbuild moderate dev-tooling findings | npm audit evidence references `vite`/`esbuild` advisories | `docs/evidence/sbom/npm-audit-frontend.json` | npm audit JSON evidence | Dependency risk remains until planned upgrade/remediation. |
| Trivy findings requiring artifact review | Manual review required by triage process | `docs/evidence/security-triage/README.md` | Trivy artifact references in triage | Current status is review-driven, not auto-remediated. |

## Table 4 - DevSecOps Evidence Traceability

| Pipeline / Evidence Area | Tool / Job | Artifact(s) | Purpose | Thesis Evidence Use |
| --- | --- | --- | --- | --- |
| Backend tests + JUnit | `backend_tests` | `pytest-report.xml` | Validate functional workflows in CI | Demonstrates repeatable backend correctness checks. |
| Hypothesis fuzz/security tests | `pytest` execution of `tests/test_fuzz_security_inputs.py` | `pytest-report.xml` (includes these tests) | Validate malformed-input handling | Supports secure input-handling claims at PoC level. |
| Python dependency SCA | `backend_dependency_audit` (`pip-audit`) | `pip-audit-report.json`, `pip-audit-report.html` | Detect vulnerable backend packages | Vulnerability transparency evidence. |
| Frontend dependency SCA | `frontend_dependency_audit` (`npm audit`) | `frontend/npm-audit-frontend.json`, `frontend/npm-audit-frontend.html` | Detect vulnerable frontend packages | Dependency-risk evidence for discussion. |
| Python SAST | `backend_sast_bandit` | `bandit-backend-report.json`, `bandit-backend-report.html` | Static issue detection in backend code | SAST evidence in annex and review artifacts. |
| Multi-language SAST | `semgrep_sast` | `semgrep-report.json`, `semgrep-report.html` | Rule-based static analysis | Complements Bandit findings. |
| Secret scanning | `secret_scan_gitleaks` | `gitleaks-report.json`, `gitleaks-report.html` | Detect committed secrets | Shows secret hygiene checks in CI. |
| IaC/config scanning | `iac_scan_checkov` | `checkov-report.json`, `checkov-report.html` | Evaluate Docker/YAML/GitLab CI misconfigurations | IaC security evidence for thesis appendix. |
| Container scan (backend) | `container_scan_backend_trivy` | `trivy-backend-report.json`, `trivy-backend-report.html` | Image vulnerability scanning | Backend container risk evidence. |
| Container scan (frontend) | `container_scan_frontend_trivy` | `trivy-frontend-report.json`, `trivy-frontend-report.html` | Image vulnerability scanning | Frontend container risk evidence. |
| DAST baseline | `dast_zap_baseline` | `zap-baseline-report.json`, `zap-baseline-report.html`, `zap-baseline-report.md` | Runtime web baseline scan | DAST evidence for thesis validation section. |
| JSON artifact layer | Multiple security jobs | `*.json` reports in CI artifacts | Machine-readable provenance | Supports reproducibility and later parsing. |
| HTML artifact layer | Converter + scanner-native HTML | `*.html` security reports | Human-readable review layer | Used for screenshots and committee review. |
| Manual validation checklist | Documentation process | `docs/evidence/manual-validation/README.md` | Structured manual QA checklist | Complements automated evidence. |
| Security triage report | Documentation process | `docs/evidence/security-triage/README.md` | Classify findings and remediation priorities | Demonstrates governance and risk-aware interpretation. |
| Final reproducibility check | Documented workflow guidance | `README.md` (quick start + checks), `docs/evidence/manual-validation/README.md` | Repeatable local/CI verification steps | Design-level / documented reproducibility evidence. |

Additional notes:
- `backend/db/` is not present in the current repository. Database integration is implemented through `backend/core/database.py` and ORM models in `backend/core/models.py`.
- Features intentionally outside this PoC remain `Not implemented in PoC`: MFA, rate limiting, re-authentication prompts, HSM/MPC custody, live blockchain execution, and production deployment claims.

## Comparison with Previous Prototype Scope

The previous prototype included some additional application-level security controls such as MFA, re-authentication, rate limiting, and asset immutability tests. The current SCFCAv2 repository focuses on a PostgreSQL-backed proof of concept, Docker Compose execution, GitLab CI/CD validation, security scanner evidence, HTML security reports, DAST/container/IaC scanning, and role-aligned UI/RBAC. Controls not implemented in SCFCAv2 are marked as deferred or out of scope rather than claimed.

Repository-grounded clarification:
- Current code and tests confirm: CSRF protection, dual approval, PDF-only validation, admin-only case creation, auditor-only audit access, PostgreSQL-backed domain models/routes, and CI security evidence jobs.
- Current code does not show implemented MFA, login rate limiting, or re-authentication enforcement.
- Current tests in `tests/` include asset immutability coverage for ORM-level seized-fact guards and absence of direct asset mutation routes.
