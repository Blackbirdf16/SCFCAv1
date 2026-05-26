# Static Analysis and Secret Scanning Evidence

SCFCA uses GitLab CI/CD visibility jobs for static analysis and accidental secret detection.

Configured CI jobs:

- `backend_sast_bandit` runs Bandit against the Python backend and stores `bandit-backend-report.json`.
- `semgrep_sast` runs Semgrep with automatic rules and stores `semgrep-report.json`.
- `secret_scan_gitleaks` runs Gitleaks against the working tree and stores `gitleaks-report.json`.

These reports are expected as GitLab CI artifacts. The jobs are visibility-first and non-blocking in this phase, so findings do not yet enforce a production release gate.

Local execution is optional. Generated local reports should use a temporary `.local.json` suffix and should not be committed unless intentionally retained as thesis evidence.

This phase does not claim mature DevSecOps automation, zero findings, or production security gate enforcement.
