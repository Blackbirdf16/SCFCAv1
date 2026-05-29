# Phase 5 - DevSecOps Security Evidence

## Status

Current SCFCAv2 includes a GitLab CI/CD pipeline for validation, build checks, security scanning, and retained evidence artifacts.

## GitLab CI Overview

Pipeline definition: `.gitlab-ci.yml`

Stages:

- `validate`
- `test`
- `build`
- `security`

The security jobs are visibility-first and non-blocking where configured with `allow_failure: true`. They support thesis evidence and triage, not production release certification.

## Validation and Test Jobs

| Job | Current evidence |
| --- | --- |
| Backend compile/import | `.gitlab-ci.yml` (`backend_compile_import`) |
| Docker Compose config validation | `.gitlab-ci.yml` (`docker_compose_config`) |
| PostgreSQL-backed backend tests | `.gitlab-ci.yml` (`backend_tests`) |
| Frontend production build | `.gitlab-ci.yml` (`frontend_build`) |

The backend test job starts a PostgreSQL service, runs `scripts/seed_demo_data.py`, and then runs `pytest -q --junitxml=pytest-report.xml`.

## Security Tools

| Tool | Current job | Purpose |
| --- | --- | --- |
| `pip-audit` | `backend_dependency_audit` | Backend Python dependency SCA |
| `npm audit` | `frontend_dependency_audit` | Frontend npm dependency SCA |
| Bandit | `backend_sast_bandit` | Python SAST |
| Semgrep | `semgrep_sast` | Rule-based static analysis |
| Gitleaks | `secret_scan_gitleaks` | Secret scanning |
| Checkov | `iac_scan_checkov` | Docker/YAML/GitLab CI config scanning |
| Trivy | `container_scan_backend_trivy`, `container_scan_frontend_trivy` | Backend/frontend container vulnerability scanning |
| OWASP ZAP | `dast_zap_baseline` | Baseline DAST against running PoC stack |

## HTML Report Generation

Scanner JSON reports are converted to HTML where supported by `scripts/security_reports_to_html.py`.

Current hardening note: the active backend and frontend Dockerfiles include dependency-free `HEALTHCHECK` instructions, and the Checkov CI scan excludes `old-repo-reference/` because that directory is archived reference material rather than current SCFCA implementation scope.

Current frontend SCA note: the Vite/esbuild moderate npm audit finding was remediated by updating Vite within the frontend dependency set and re-running the frontend build and audit. This does not change application custody logic or claim production security.

Evidence paths:

- `docs/evidence/security-reports/README.md`
- `scripts/security_reports_to_html.py`

## Evidence Artifacts

CI artifacts include JSON and HTML reports for scanners and test outputs where configured. Documentation is maintained under:

- `docs/evidence/sbom/`
- `docs/evidence/security-testing/README.md`
- `docs/evidence/security-reports/README.md`
- `docs/evidence/static-analysis/README.md`
- `docs/evidence/container-security/README.md`
- `docs/evidence/iac-security/README.md`
- `docs/evidence/dast/README.md`

## Manual Validation Checklist

Manual validation evidence is documented at `docs/evidence/manual-validation/README.md`.

This complements automated evidence and provides a place for thesis review screenshots and checklist execution notes.

## Security Triage

Security findings are interpreted through `docs/evidence/security-triage/README.md`.

The triage process documents accepted PoC limitations, deferred hardening, and remediation priorities. Scanner output is not treated as a claim that all findings are fixed.

## Limitations

- CI security jobs are evidence-producing checks, not production release gates.
- OWASP ZAP baseline is unauthenticated.
- Scanner coverage is best-effort and does not prove absence of vulnerabilities.
- Some dependency or scanner findings may remain accepted PoC limitations pending triage.
