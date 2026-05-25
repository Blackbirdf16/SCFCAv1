# SBOM Evidence for SCFCA (Proof-of-Concept)

These artifacts are a lightweight, proof-of-concept Software Bill of Materials (SBOM) and dependency-scan evidence for the SCFCA repository. They are intended for thesis evidence and transparency; they are not a replacement for formal supply-chain assurance.

Generation details
- Generation date: 2026-05-23
- Backend dependency source: backend/requirements.txt
- Frontend dependency source: frontend/package.json and frontend/package-lock.json

Commands used

Backend (CycloneDX via `cyclonedx-py`):

```bash
python -m pip install --upgrade cyclonedx-bom cyclonedx-py
cyclonedx-py requirements backend/requirements.txt -o docs/evidence/sbom/sbom-backend.json
```

Frontend (CycloneDX via npm helper):

```bash
cd frontend
npx @cyclonedx/cyclonedx-npm --output-file ../docs/evidence/sbom/sbom-frontend.json
```

Dependency scans (proof-of-concept)

Frontend npm audit (JSON):

```bash
cd frontend
npm audit --json > ../docs/evidence/sbom/npm-audit-frontend.json
```

Backend pip-audit (if available):

```bash
python -m pip install --upgrade pip-audit
pip-audit -r backend/requirements.txt -f json -o docs/evidence/sbom/pip-audit-report.json
```

Notes and limitations
- These artifacts demonstrate composition transparency for the project's declared dependencies.
- They do not prove complete supply-chain assurance or runtime security.
- If `pip-audit` or other tools are not available in your environment, the commands above describe how to install and run them.
- Keep SBOMs up-to-date as dependencies change; include SBOM generation in CI for stronger assurance.

Files in this folder
- `sbom-backend.json` — CycloneDX SBOM for backend (`backend/requirements.txt`)
- `sbom-frontend.json` — CycloneDX SBOM for frontend (`package-lock.json`)
- `npm-audit-frontend.json` — `npm audit` JSON output
- `pip-audit-report.json` — `pip-audit` JSON output (if generated)

Authority and provenance
- The backend SBOM and pip-audit report in this folder were generated from `backend/requirements.txt` using the repo-root commands shown above. These commands were executed from the repository root (not from inside `backend/`).

Use
- These files can be used for vulnerability scans, compliance reviews, and as evidence in CI/CD pipelines.
