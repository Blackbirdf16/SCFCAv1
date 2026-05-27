# DAST Evidence (OWASP ZAP)

SCFCA includes a GitLab CI/CD visibility-first Dynamic Application Security Testing (DAST) job using the OWASP ZAP baseline scanner.

## What runs in CI

- Job: `dast_zap_baseline`
- Scanner: `ghcr.io/zaproxy/zaproxy:stable` (ZAP baseline)
- Approach: the job starts the application stack using `docker compose up -d --build`, waits for backend and frontend readiness, then runs `zap-baseline.py`.
- Target: the scan targets the running PoC frontend service (`http://frontend:5173`) inside the CI Docker Compose network.

## Outputs (CI artifacts)

The job stores the following artifacts:

- `zap-baseline-report.json`
- `zap-baseline-report.html`
- `zap-baseline-report.md`

## Non-blocking thesis evidence

This DAST job is intentionally non-blocking for thesis validation:

- The CI job is `allow_failure: true`.
- ZAP is run with `-I` to avoid failing the scan on baseline warnings.

## Limitations

- This is a baseline scan and does not perform authenticated testing.
- It does not prove production security.
- It is intended for visibility and evidence generation in CI, not a substitute for a full penetration test.
