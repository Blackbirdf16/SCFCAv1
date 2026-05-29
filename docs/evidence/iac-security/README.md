# IaC and Configuration Security Evidence

SCFCA uses GitLab CI/CD visibility jobs for Infrastructure-as-Code and configuration scanning.

Configured CI job:

- `iac_scan_checkov` runs Checkov against current Dockerfiles, Docker Compose/YAML, and GitLab CI configuration, then stores `checkov-report.json`.
- The CI scan excludes `old-repo-reference/` because it is archived reference material and is not part of the current SCFCA implementation scope.

The report is expected as a GitLab CI artifact. The job is non-blocking in this phase, so findings provide visibility but do not enforce a production compliance or release gate.

Local execution is optional:

```bash
checkov -d . --skip-path old-repo-reference --framework dockerfile yaml gitlab_ci --output json --output-file-path checkov-report.local.json
```

Generated local reports should not be committed unless intentionally retained as thesis evidence.
