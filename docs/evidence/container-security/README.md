# Container Security Evidence

This folder is reserved for optional local container scanning evidence for the SCFCA proof-of-concept.

The Docker setup is intended for reproducible thesis demonstration. It is not production-certified and does not include image signing, Kubernetes policies, runtime monitoring, or CI enforcement.

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
