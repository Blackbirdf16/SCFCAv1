# Optional Container Scanning Commands

These commands are optional local checks for the SCFCA proof-of-concept. They require Trivy to be installed and Docker images to be built.

```powershell
docker compose build
trivy image scfca-repo-backend
trivy image scfca-repo-frontend
trivy fs .
```

Optional JSON evidence:

```powershell
trivy image --format json --output docs/evidence/container-security/trivy-backend.json scfca-repo-backend
trivy image --format json --output docs/evidence/container-security/trivy-frontend.json scfca-repo-frontend
trivy fs --format json --output docs/evidence/container-security/trivy-fs.json .
```
