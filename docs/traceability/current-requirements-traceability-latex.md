# SCFCA Current Requirements Traceability (LaTeX-Friendly)

Copy the `longtable` blocks below into Overleaf.

Status values used: `Implemented`, `Partial`, `Evidence-only`, `Design-level / documented`, `Deferred`, `Not implemented in PoC`.

## Table 1 - Thesis Security Goals to Implementation Evidence

```latex
\small
\begin{longtable}{|p{3cm}|p{4cm}|p{4cm}|p{2.5cm}|p{3cm}|}
\hline
\textbf{Thesis Goal / Security Control} & \textbf{Current Implementation Location(s)} & \textbf{Test / CI / Evidence Location(s)} & \textbf{Coverage Status} & \textbf{Notes} \\
\hline
\endfirsthead
\hline
\textbf{Thesis Goal / Security Control} & \textbf{Current Implementation Location(s)} & \textbf{Test / CI / Evidence Location(s)} & \textbf{Coverage Status} & \textbf{Notes} \\
\hline
\endhead
RBAC & backend/auth/dependencies.py; backend/api/v1/routes/*.py; frontend/src/components/Sidebar.tsx & tests/test_workflows.py; tests/test_security_hardening.py & Implemented & Backend role checks are authoritative. \\
\hline
Authentication and session handling & backend/api/v1/routes/auth.py; backend/auth/dependencies.py & tests/test_security_hardening.py & Implemented & Signed scfca\_session cookie and login/logout events. \\
\hline
Login throttling / brute-force reduction & backend/auth/login\_throttle.py; backend/api/v1/routes/auth.py & tests/test\_security\_hardening.py & Implemented & In-memory PoC limiter for failed login attempts only; not global or distributed rate limiting. \\
\hline
CSRF protection & backend/auth/csrf.py; mutation routes in backend/api/v1/routes/ & tests/test_security_hardening.py; tests/test_workflows.py & Implemented & Cookie+header token validation. \\
\hline
Admin-only case creation & backend/api/v1/routes/cases.py (POST /cases/) & tests/test_workflows.py & Implemented & require\_role(Role.administrator). \\
\hline
Case assignment and scoped visibility & backend/api/v1/routes/cases.py; backend/core/models.py (CaseAssignment) & tests/test_workflows.py & Implemented & Regular users get assigned cases only. \\
\hline
Ticket workflow & backend/api/v1/routes/tickets.py; frontend/src/pages/Tickets.tsx & tests/test_workflows.py; tests/test_fuzz_security_inputs.py & Implemented & Create/list/assign/approve/reject flow. \\
\hline
Dual approval / separation of duties & backend/api/v1/routes/tickets.py (TicketApproval) & tests/test_security_hardening.py; tests/test_workflows.py & Implemented & Two-stage approval logic. \\
\hline
Auditor-only audit access & backend/api/v1/routes/audit.py; frontend/src/pages/Audit.tsx & tests/test_workflows.py & Implemented & Audit route requires auditor role. \\
\hline
Audit recording & backend/api/v1/routes/audit.py (record\_audit\_event) & tests/test_workflows.py & Implemented & Events written for core actions. \\
\hline
Audit hash-chain verification & backend/api/v1/routes/audit.py (verify\_audit\_chain, /chain/verify, hash\_chain, previous\_hash) & tests/test\_audit\_hash\_chain.py; tests/test\_workflows.py & Implemented & Recomputes event hashes, validates previous\_hash continuity, detects tampering, and is auditor-only. \\
\hline
Asset seized-fact immutability & backend/core/models.py (Asset, FrozenValuationSnapshot update guards); no direct asset mutation route & tests/test\_asset\_immutability.py; tests/test\_workflows.py & Implemented & ORM guards block changes to registered asset facts and frozen valuation snapshots; API exposes no direct asset/holding mutation. \\
\hline
Audit pagination / controlled review & frontend/src/pages/Audit.tsx (AUDIT\_PAGE\_SIZE=15) & Manual UI validation evidence & Partial & Client-side pagination. \\
\hline
Document upload and hashing & backend/api/v1/routes/documents.py & tests/test_security_hardening.py; tests/test_fuzz_security_inputs.py & Implemented & Upload computes sha256 digest. \\
\hline
PostgreSQL persistence & backend/core/database.py; backend/core/models.py; scripts/seed_demo_data.py & .gitlab-ci.yml (backend\_tests) & Implemented & CI test stage uses PostgreSQL service. \\
\hline
Docker Compose deployment & docker-compose.yml & .gitlab-ci.yml (docker\_compose\_config) & Implemented & Stack defined for postgres/backend/frontend. \\
\hline
GitLab CI/CD validation & .gitlab-ci.yml & validate/test/build/security stages & Implemented & End-to-end CI evidence pipeline. \\
\hline
SCA scanning & .gitlab-ci.yml (pip-audit, npm audit jobs) & docs/evidence/sbom/; docs/evidence/security-reports/README.md & Implemented & Backend and frontend dependency scans. \\
\hline
SAST scanning & .gitlab-ci.yml (Bandit, Semgrep jobs) & docs/evidence/security-reports/README.md & Implemented & Multi-tool static checks. \\
\hline
Secret detection & .gitlab-ci.yml (Gitleaks job) & docs/evidence/security-reports/README.md & Implemented & Secret scan artifacts generated. \\
\hline
Container scanning & .gitlab-ci.yml (Trivy backend/frontend jobs) & docs/evidence/security-triage/README.md & Implemented & Findings require artifact review. \\
\hline
IaC/config scanning & .gitlab-ci.yml (Checkov job) & docs/evidence/security-triage/README.md & Implemented & Docker/YAML/GitLab CI scan scope. \\
\hline
DAST (OWASP ZAP) & .gitlab-ci.yml (dast\_zap\_baseline) & docs/evidence/dast/README.md & Implemented & Baseline, non-blocking DAST. \\
\hline
HTML security evidence & scripts/security_reports_to_html.py & docs/evidence/security-reports/README.md & Implemented & JSON-to-HTML reporting layer. \\
\hline
Manual validation checklist & docs/evidence/manual-validation/README.md & manual-validation evidence folder & Evidence-only & Checklist template, manual execution. \\
\hline
Security triage/remediation mapping & docs/evidence/security-triage/README.md & security-triage documentation & Partial & Triage documented; full remediation pending. \\
\hline
PlantUML architecture evidence & docs/diagrams/plantuml/*.puml & docs/diagrams/plantuml/README.md & Design-level / documented & Architecture evidence for thesis annex. \\
\hline
\end{longtable}
```

## Table 2 - Functional Requirements to Code and Test Evidence

```latex
\small
\begin{longtable}{|p{1.7cm}|p{4cm}|p{4cm}|p{3.5cm}|p{2.5cm}|}
\hline
\textbf{Req. ID} & \textbf{Requirement} & \textbf{Implementation Location(s)} & \textbf{Test / Evidence} & \textbf{Coverage Status} \\
\hline
\endfirsthead
\hline
\textbf{Req. ID} & \textbf{Requirement} & \textbf{Implementation Location(s)} & \textbf{Test / Evidence} & \textbf{Coverage Status} \\
\hline
\endhead
FR-01 & Case listing and details & backend/api/v1/routes/cases.py; frontend/src/pages/Cases.tsx; frontend/src/pages/CaseDetails.tsx & tests/test_workflows.py & Implemented \\
\hline
FR-02 & Admin-only case creation & backend/api/v1/routes/cases.py (POST /api/v1/cases/) & tests/test_workflows.py & Implemented \\
\hline
FR-03 & Case assignment visibility & backend/api/v1/routes/cases.py; backend/core/models.py (CaseAssignment) & tests/test_workflows.py & Implemented \\
\hline
FR-04 & Document upload & backend/api/v1/routes/documents.py; frontend/src/pages/Documents.tsx & tests/test_security_hardening.py; tests/test_fuzz_security_inputs.py & Implemented \\
\hline
FR-05 & Ticket creation & backend/api/v1/routes/tickets.py; frontend/src/pages/Tickets.tsx & tests/test_workflows.py; tests/test_fuzz_security_inputs.py & Implemented \\
\hline
FR-06 & Ticket approval/rejection & backend/api/v1/routes/tickets.py (/approve, /reject) & tests/test_security_hardening.py; tests/test_workflows.py & Implemented \\
\hline
FR-07 & Audit events & backend/api/v1/routes/audit.py & tests/test_workflows.py & Implemented \\
\hline
FR-08 & Auditor access & backend/api/v1/routes/audit.py; frontend/src/pages/Audit.tsx & tests/test_workflows.py & Implemented \\
\hline
FR-09 & PostgreSQL persistence & backend/core/database.py; backend/core/models.py; scripts/seed_demo_data.py & .gitlab-ci.yml (backend\_tests) & Implemented \\
\hline
FR-10 & Audit report export / evidence endpoints & backend/api/v1/routes/audit.py (/reports/json, /reports/html) & docs/evidence/ and CI artifacts & Partial \\
\hline
\end{longtable}
```

## Table 3 - Security Requirements to Controls

```latex
\small
\begin{longtable}{|p{3cm}|p{3.5cm}|p{3.5cm}|p{3.2cm}|p{3.8cm}|}
\hline
\textbf{Security Requirement} & \textbf{Control Implemented} & \textbf{Backend / Frontend / CI Location} & \textbf{Evidence} & \textbf{Residual Risk / Limitation} \\
\hline
\endfirsthead
\hline
\textbf{Security Requirement} & \textbf{Control Implemented} & \textbf{Backend / Frontend / CI Location} & \textbf{Evidence} & \textbf{Residual Risk / Limitation} \\
\hline
\endhead
Least privilege RBAC & Role-based dependency checks and UI gating & backend/auth/dependencies.py; backend/api/v1/routes/*.py; frontend/src/components/Sidebar.tsx & tests/test_workflows.py & UI controls are secondary; backend must remain source of truth. \\
\hline
Auditor read-only separation & Auditor-only access to audit endpoints & backend/api/v1/routes/audit.py; backend/api/v1/routes/cases.py & tests/test_workflows.py & Same app trust boundary; not a separate reporting service. \\
\hline
Administrator / case-handler separation & Admin blocked from regular custody ticket initiation; regular blocked from case creation & backend/api/v1/routes/tickets.py; backend/api/v1/routes/cases.py & tests/test_workflows.py & Governance model remains PoC-level. \\
\hline
Login throttling / brute-force reduction & In-memory failed-login counter keyed by normalized username and client IP & backend/auth/login\_throttle.py; backend/api/v1/routes/auth.py & tests/test\_security\_hardening.py & PoC-only, process-local, not distributed production abuse protection. \\
\hline
CSRF protection & CSRF cookie/header check on state-changing routes & backend/auth/csrf.py; mutation routes & tests/test_security_hardening.py & No global API rate limiting claimed beyond narrow login throttling. \\
\hline
Audit hash-chain integrity verification & Auditor-only chain verification validates stored hashes and continuity & backend/api/v1/routes/audit.py (/chain/verify) & tests/test\_audit\_hash\_chain.py; tests/test\_workflows.py & Implemented for persisted audit rows; not a separate append-only audit service. \\
\hline
Seized asset fact immutability & ORM update guards block changes to registered asset facts and frozen valuation snapshots; no direct mutation route exists & backend/core/models.py; backend/api/v1/routes/cases.py & tests/test\_asset\_immutability.py; tests/test\_workflows.py & App-level ORM enforcement; not a database trigger or blockchain custody guarantee. \\
\hline
Controlled error handling & Explicit HTTPException validation paths & backend/api/v1/routes/*.py & tests/test_fuzz_security_inputs.py & No unified global exception envelope middleware. \\
\hline
Non-root containers & Drop root runtime user & backend/Dockerfile; frontend/Dockerfile & Dockerfile review & Host/platform controls remain environment-dependent. \\
\hline
Docker hardening & no-new-privileges, cap\_drop, read-only backend FS, tmpfs & docker-compose.yml & Compose review + README.md & Not a full production container hardening profile. \\
\hline
Dependency scanning & pip-audit and npm audit CI jobs & .gitlab-ci.yml & docs/evidence/sbom/; security-reports docs & Findings require triage/remediation workflow. \\
\hline
SAST & Bandit and Semgrep CI jobs & .gitlab-ci.yml & docs/evidence/security-reports/README.md & Scanner-based coverage is incomplete by definition. \\
\hline
Secret scanning & Gitleaks CI job & .gitlab-ci.yml & docs/evidence/security-reports/README.md & Does not prove absence of all secret leakage vectors. \\
\hline
Trivy scanning & Backend/frontend image vulnerability scans & .gitlab-ci.yml & docs/evidence/security-triage/README.md & Triage doc marks latest artifact review as required. \\
\hline
Checkov scanning & IaC/config scan on Dockerfile/YAML/GitLab CI & .gitlab-ci.yml & docs/evidence/security-triage/README.md & Some findings may remain accepted PoC limitations. \\
\hline
ZAP DAST baseline & Non-blocking baseline runtime scan & .gitlab-ci.yml (dast\_zap\_baseline) & docs/evidence/dast/README.md & Unauthenticated baseline only; not full penetration testing. \\
\hline
Residual CSP/COEP findings & Deferred hardening noted in triage & docs/evidence/security-triage/README.md & security-triage documentation & Deferred / Partial in current PoC. \\
\hline
Residual Vite/esbuild moderate findings & npm audit evidence includes vite/esbuild advisories & docs/evidence/sbom/npm-audit-frontend.json & npm audit JSON evidence & Dependency risk remains until upgrades/remediation complete. \\
\hline
Trivy findings needing review & Manual artifact interpretation before remediation & docs/evidence/security-triage/README.md & triage evidence references & Requires manual review by design. \\
\hline
\end{longtable}
```

## Table 4 - DevSecOps Evidence Traceability

```latex
\small
\begin{longtable}{|p{3.2cm}|p{3.3cm}|p{3.8cm}|p{3cm}|p{3.2cm}|}
\hline
\textbf{Pipeline / Evidence Area} & \textbf{Tool / Job} & \textbf{Artifact(s)} & \textbf{Purpose} & \textbf{Thesis Evidence Use} \\
\hline
\endfirsthead
\hline
\textbf{Pipeline / Evidence Area} & \textbf{Tool / Job} & \textbf{Artifact(s)} & \textbf{Purpose} & \textbf{Thesis Evidence Use} \\
\hline
\endhead
Backend tests + JUnit & backend\_tests & pytest-report.xml & Functional validation in CI & Repeatability and regression evidence. \\
\hline
Hypothesis fuzz/security tests & pytest (includes tests/test\_fuzz\_security\_inputs.py) & pytest-report.xml & Malformed-input robustness checks & Security-focused test evidence. \\
\hline
Python SCA & backend\_dependency\_audit (pip-audit) & pip-audit-report.json; pip-audit-report.html & Backend dependency vulnerability scan & SCA evidence for annex. \\
\hline
Frontend SCA & frontend\_dependency\_audit (npm audit) & frontend/npm-audit-frontend.json; frontend/npm-audit-frontend.html & Frontend dependency vulnerability scan & Dependency risk transparency. \\
\hline
Backend SAST & backend\_sast\_bandit & bandit-backend-report.json; bandit-backend-report.html & Python static security analysis & SAST evidence. \\
\hline
General SAST & semgrep\_sast & semgrep-report.json; semgrep-report.html & Rule-based static analysis & Cross-check with Bandit findings. \\
\hline
Secret scan & secret\_scan\_gitleaks & gitleaks-report.json; gitleaks-report.html & Detect exposed secrets & Secret hygiene evidence. \\
\hline
IaC/config scan & iac\_scan\_checkov & checkov-report.json; checkov-report.html & Config and IaC security checks & DevSecOps configuration evidence. \\
\hline
Container scan backend & container\_scan\_backend\_trivy & trivy-backend-report.json; trivy-backend-report.html & Backend image vulnerability scan & Container risk evidence. \\
\hline
Container scan frontend & container\_scan\_frontend\_trivy & trivy-frontend-report.json; trivy-frontend-report.html & Frontend image vulnerability scan & Container risk evidence. \\
\hline
DAST baseline & dast\_zap\_baseline & zap-baseline-report.json; zap-baseline-report.html; zap-baseline-report.md & Runtime web baseline scan & DAST evidence for thesis chapter. \\
\hline
JSON evidence layer & Multiple security jobs & *.json CI artifacts & Machine-readable evidence & Reproducibility and parser input. \\
\hline
HTML evidence layer & Report converter + scanner HTML outputs & *.html CI artifacts & Human-readable summaries & Screenshots and committee review. \\
\hline
Manual validation checklist & Documentation process & docs/evidence/manual-validation/README.md & Structured manual checks & Complements automated pipeline evidence. \\
\hline
Security triage report & Documentation process & docs/evidence/security-triage/README.md & Classify and prioritize findings & Governance/risk interpretation evidence. \\
\hline
Final reproducibility check & Documented workflow guidance & README.md; docs/evidence/manual-validation/README.md & Repeatable verification steps & Design-level / documented reproducibility support. \\
\hline
\end{longtable}
```

## Notes for Overleaf

- `backend/db/` is not present; database integration is in `backend/core/database.py`.
- Out-of-scope controls are intentionally not claimed: MFA, global API rate limiting, re-authentication prompts, HSM/MPC custody, live blockchain execution, and production deployment assurance.

## Comparison with Previous Prototype Scope

The previous prototype included some additional application-level security controls such as MFA, re-authentication, broader rate limiting, and asset immutability tests. The current SCFCAv2 repository focuses on a PostgreSQL-backed proof of concept, Docker Compose execution, GitLab CI/CD validation, security scanner evidence, HTML security reports, DAST/container/IaC scanning, and role-aligned UI/RBAC. Controls not implemented in SCFCAv2 are marked as deferred or out of scope rather than claimed.

Current repository-only clarification:
- Implemented in current code/tests: CSRF protection, dual approval workflow, PDF-only document validation, admin-only case creation, auditor-only audit access, and CI security evidence jobs.
- Not implemented in current code snapshot: MFA, global API rate limiting, and re-authentication enforcement. Narrow in-memory failed-login throttling is implemented for the login endpoint only.
- Asset immutability tests are present for ORM-level seized-fact guards and absence of direct asset mutation routes.
