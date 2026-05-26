# Container Security Evidence

This folder is reserved for optional local container scanning evidence for the SCFCA proof-of-concept.

The Docker setup is intended for reproducible thesis demonstration. It is not production-certified and does not include image signing, Kubernetes policies, runtime monitoring, or CI enforcement.

## GitLab CI Container Scanning

GitLab CI/CD builds the backend and frontend Docker images and scans them with Trivy in the security stage.

Configured CI jobs:

- `container_scan_backend_trivy` builds the backend image and stores `trivy-backend-report.json`.
- `container_scan_frontend_trivy` builds the frontend image and stores `trivy-frontend-report.json`.

The reports are retained as GitLab CI artifacts. The jobs are non-blocking in this phase and do not claim a production image gate, image certification, image signing, or runtime protection.

## Local Trivy Commands

Install Trivy separately if needed, then run from the repository root after building the Docker images:

```bash
trivy image scfca-repo-backend
trivy image scfca-repo-frontend
trivy fs .
```

Optional JSON evidence output:

```bash
trivy image --format json --output docs/evidence/container-security/trivy-backend.json scfca-repo-backend
trivy image --format json --output docs/evidence/container-security/trivy-frontend.json scfca-repo-frontend
trivy fs --format json --output docs/evidence/container-security/trivy-fs.json .
```

Do not treat these files as continuous assurance unless the scans are automated and reviewed in CI.
