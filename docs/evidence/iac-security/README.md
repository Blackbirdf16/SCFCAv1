# IaC and Configuration Security Evidence

SCFCA uses GitLab CI/CD visibility jobs for Infrastructure-as-Code and configuration scanning.

Configured CI job:

- `iac_scan_checkov` runs Checkov against Dockerfiles, Docker Compose, and GitLab CI configuration, then stores `checkov-report.json`.

The report is expected as a GitLab CI artifact. The job is non-blocking in this phase, so findings provide visibility but do not enforce a production compliance or release gate.

Local execution is optional:

```bash
checkov -d . --framework dockerfile,docker_compose,gitlab_ci --output json --output-file-path checkov-report.local.json
```

Generated local reports should not be committed unless intentionally retained as thesis evidence.
