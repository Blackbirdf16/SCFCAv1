# HTML Security Evidence Reports

GitLab CI keeps JSON security reports for machine-readable evidence, traceability, and future automation. Phase 9 adds matching HTML reports so the same scanner output can be reviewed by humans during thesis evaluation, professor review, and screenshot-based walkthroughs.

The HTML converter summarizes scanner output without suppressing or reclassifying findings. JSON artifacts remain the source of truth for full machine-readable detail.

Reports are generated automatically in CI for pip-audit, npm audit, Bandit, Semgrep, Gitleaks, Checkov, and Trivy. OWASP ZAP already produces JSON, HTML, and Markdown baseline reports directly.

These reports are proof-of-concept pipeline evidence. They do not prove production security, compliance certification, or release-gate maturity.
