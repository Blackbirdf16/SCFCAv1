# Security Findings Triage

## Purpose

This phase reviews the current SCFCA proof-of-concept security scanner evidence, classifies findings, and identifies safe remediation actions for later approval.

This document is a triage and planning artifact only. It does not remediate findings, suppress findings, or claim that the PoC is production-ready or vulnerability-free.

## Scope

The triage scope covers the current GitLab CI/CD security evidence from:

- `pip-audit`
- `npm audit`
- Bandit
- Semgrep
- Gitleaks
- Checkov
- Trivy backend image scan
- Trivy frontend image scan
- OWASP ZAP baseline DAST

Latest GitLab artifacts should be treated as the source of truth. Only older local SCA JSON examples were available in this workspace during this triage pass.

## Triage Classification Model

| Classification | Meaning |
| --- | --- |
| Confirmed issue | A finding that appears valid and affects the current PoC behavior or configuration. |
| Dependency vulnerability | A finding in a declared or transitive package dependency. |
| Configuration hardening issue | A missing or weak hardening setting in application, HTTP, Docker, CI, or IaC configuration. |
| Container/base-image vulnerability | A finding in an OS package, runtime layer, or base image component. |
| False positive / acceptable PoC limitation | A finding that is not security-relevant in the current PoC context or is accepted with documented rationale. |
| Out of scope for PoC | A finding that relates to controls intentionally outside this thesis PoC. |
| Requires manual review | A finding that needs artifact inspection, code review, or safe-change analysis before remediation. |

## Findings Summary

| Tool | Finding / area | Severity | Evidence artifact | Classification | Proposed action | Remediation status |
| --- | --- | --- | --- | --- | --- | --- |
| Semgrep | No findings observed in current evidence. | None observed | `semgrep-report.html`, `semgrep-report.json` | No current action | Keep Semgrep in CI and continue reviewing artifacts. | Not required |
| Gitleaks | No findings observed in current evidence. | None observed | `gitleaks-report.html`, `gitleaks-report.json` | No current action | Keep Gitleaks in CI and continue reviewing artifacts. | Not required |
| Checkov | Latest report must be confirmed after output and parser fixes. | Requires artifact review | `checkov-report.html`, `checkov-report.json` | Configuration scan evidence / Requires manual review | Keep Checkov in CI; review failed checks if any appear in the latest artifact. | Not started |
| Bandit | B311 standard pseudo-random generator use in `backend/api/v1/routes/cases.py`. | Low to medium, context-dependent | `bandit-backend-report.html`, `bandit-backend-report.json` | Requires manual review | Determine whether randomness is demo-only or security-sensitive before changing. | Not started |
| OWASP ZAP | Missing browser security headers such as CSP, anti-clickjacking, `X-Content-Type-Options`, `Permissions-Policy`, COOP, COEP, and CORP. | Low to medium, header-dependent | `zap-baseline-report.html`, `zap-baseline-report.json`, `zap-baseline-report.md` | Configuration hardening issue | Add simple safe headers first; design CSP carefully to avoid breaking the frontend. | Not started |
| npm audit | Frontend dependency vulnerabilities observed in local npm audit evidence. | Moderate and high in local evidence | `frontend/npm-audit-frontend.html`, `frontend/npm-audit-frontend.json` | Dependency vulnerability | Inspect latest npm audit details; prefer non-breaking updates; run frontend build after changes. | Not started |
| Trivy backend | Backend container image vulnerabilities require latest artifact review. | Requires artifact review | `trivy-backend-report.html`, `trivy-backend-report.json` | Container/base-image vulnerability / Dependency vulnerability | Distinguish OS package findings from Python dependency findings before updating. | Not started |
| Trivy frontend | Frontend container image and dependency vulnerabilities require latest artifact review. | Requires artifact review | `trivy-frontend-report.html`, `trivy-frontend-report.json` | Container/base-image vulnerability / Dependency vulnerability | Separate base image findings from `node_modules` findings; coordinate with npm remediation. | Not started |
| pip-audit | Local `docs/evidence/sbom/pip-audit-report.json` showed no vulnerabilities, but latest CI artifact should be confirmed. | None observed locally / Requires artifact review | `pip-audit-report.html`, `pip-audit-report.json` | Requires manual review | Confirm latest CI artifact; update backend dependencies only after reviewing concrete findings. | Not started |

## Initial Triage Notes

### Semgrep

No Semgrep findings were observed in the current evidence available to the reviewer. Keep Semgrep in CI as a non-blocking visibility check.

### Gitleaks

No Gitleaks findings were observed in the current evidence available to the reviewer. Keep Gitleaks in CI because it provides useful protection against accidental secret commits.

### Checkov

The Checkov output path and HTML parser were recently fixed. The latest GitLab artifact should be reviewed to confirm whether any failed checks remain. If failed checks appear, classify them individually as configuration hardening issues, acceptable PoC limitations, or remediation candidates.

### Bandit B311

Bandit reports use of the standard pseudo-random generator in `backend/api/v1/routes/cases.py`. Local code inspection shows this randomness is used to generate demo case display data such as custody status, asset count, asset symbol, and demo balance values.

Proposed action:

- If this remains demo-only data generation, document it as a low-risk PoC limitation or replace it with deterministic fixture data if that improves repeatability.
- If any randomness is later used for security-sensitive IDs, tokens, secrets, approval decisions, or authorization behavior, replace it with `secrets`, `uuid`, or deterministic persisted data as appropriate.
- Do not change it until the remediation plan is approved.

### OWASP ZAP Browser Security Headers

ZAP observed missing browser security headers. These are configuration hardening issues rather than proof of exploitable application logic bugs.

Proposed action:

- Prioritize simple, low-risk headers such as `X-Content-Type-Options: nosniff` and anti-clickjacking controls.
- Add `Permissions-Policy`, COOP, COEP, and CORP only after checking frontend/API behavior.
- Treat CSP as a separate careful change because an overly strict policy can break Vite or frontend runtime behavior.
- Do not remediate until the specific header set is approved.

### npm Audit Frontend Vulnerabilities

Local npm audit evidence under `docs/evidence/sbom/npm-audit-frontend.json` shows frontend dependency vulnerabilities, including direct and transitive packages. The latest GitLab artifact should be reviewed before changing dependencies.

Proposed action:

- Inspect the latest `npm-audit-frontend.html` and JSON artifact.
- Prefer `npm audit fix` only if it does not require breaking major upgrades.
- Review direct dependencies such as `axios`, `vite`, and `postcss` separately from transitive dependencies.
- Run `npm run build` after any dependency change.
- Do not upgrade major versions blindly.

### Trivy Backend and Frontend Vulnerabilities

Trivy findings can come from application dependencies, language package managers, OS packages, or container base images.

Proposed action:

- Separate OS package vulnerabilities from application dependency vulnerabilities.
- Coordinate frontend Trivy remediation with npm audit remediation because Trivy may also report `node_modules` issues.
- Consider updating base images only if the change is compatible with the PoC runtime.
- Document residual base-image risk where fixes are unavailable or not safe for the PoC.

### pip-audit

The local repository evidence file `docs/evidence/sbom/pip-audit-report.json` showed no backend dependency vulnerabilities at the time it was generated. The latest GitLab artifact should still be reviewed before concluding that no backend dependency action is needed.

Proposed action:

- Confirm the latest `pip-audit-report.html` and JSON artifact.
- Update backend dependencies only after reviewing concrete findings and compatibility risk.
- Run backend import, tests, and Docker build checks after any dependency change.

## Safe Remediation Priority

1. Review and fix or upgrade frontend dependencies if safe and `npm run build` passes.
2. Review Bandit B311 and replace `random` with `secrets`, `uuid`, or deterministic fixture data only if the usage is security-sensitive or if repeatability is preferred.
3. Add simple security headers if safe, starting with low-risk headers before CSP.
4. Review backend and frontend container base image updates after separating OS findings from application dependency findings.
5. Re-run the GitLab pipeline and compare JSON and HTML artifacts before and after remediation.
6. Document residual risk for findings that cannot be safely fixed in the PoC.

## Explicit Non-Goals

- Do not claim production security.
- Do not claim all CVEs will be eliminated.
- Do not perform or claim a full penetration test.
- Do not convert non-blocking CI security jobs into strict production gates yet.
- Do not suppress findings unless a specific finding is reviewed and justified as a false positive or acceptable PoC limitation.

## Evidence References

Use these placeholders for the latest GitLab evidence and screenshots. Do not treat them as proof until the artifact has been reviewed.

- GitLab pipeline screenshot
- `pip-audit-report.html`
- `frontend/npm-audit-frontend.html`
- `bandit-backend-report.html`
- `semgrep-report.html`
- `gitleaks-report.html`
- `checkov-report.html`
- `trivy-backend-report.html`
- `trivy-frontend-report.html`
- `zap-baseline-report.html`
- `zap-baseline-report.md`

## Known Limitations

- Latest GitLab HTML and JSON artifacts were not present locally during this documentation pass.
- The triage uses known current observations plus local older SCA examples where available.
- Severity labels must be confirmed from the current artifacts before remediation begins.
- This document is a remediation plan, not evidence that remediation has happened.
