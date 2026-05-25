# SBOM and Dependency Transparency

SCFCA is a thesis-oriented proof of concept, so the goal here is software composition transparency rather than full supply-chain assurance. This repository can document which components it depends on and can generate SBOM evidence for local review, vulnerability analysis, and academic traceability.

## What an SBOM means for SCFCA

An SBOM is a structured inventory of the software components used by a project. For SCFCA, that means showing the backend Python packages, the frontend npm packages, and any container-related dependencies if container files are added later.

This supports the thesis section on dependency management and composition transparency by making the repository auditable and explainable. It does not imply production-grade software supply-chain security, signed provenance, or continuous artifact retention.

## Current dependency sources in this repository

Backend dependency source: backend/requirements.txt
Frontend dependency source: frontend/package.json and frontend/package-lock.json

| Area | Source of truth | Current status |
| --- | --- | --- |
| Backend | `backend/requirements.txt` | Present and suitable for SBOM generation |
| Frontend | `frontend/package.json` and `frontend/package-lock.json` | Present and suitable for SBOM generation |
| Containers | Dockerfile files | None found in the repository |
| Compose | `docker-compose.yml` | None found in the repository |
| CI | `.gitlab-ci.yml` | None found in the repository |
| GitHub Actions | `.github/workflows/` | Not configured; no workflows directory is currently present |
| Dependabot | `.github/dependabot.yml` | Present; covers pip dependencies in `/backend` and npm dependencies in `/frontend` |
| Docker dependency monitoring | Dockerfile or Compose files | Not configured because no Dockerfile or docker-compose file is currently present |

Dependabot provides dependency update visibility for the declared backend and frontend dependency sources. It is not currently paired with a GitHub Actions workflow in this repository.

The SBOM and SCA files under `docs/evidence/sbom/` are local repository evidence for transparency and thesis review. They are not currently generated, validated, or retained by an automated CI/CD pipeline.

## Practical SBOM generation commands

Run these from the repository root unless noted otherwise.

### Backend Python SBOM

Install the tool once if needed:

```bash
python -m pip install cyclonedx-bom
```

Generate an SBOM from the Python requirements file:

```bash
cyclonedx-py requirements backend/requirements.txt -o sbom-backend.json
```

### Frontend npm SBOM

Generate an SBOM from the frontend npm dependency tree:

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom-frontend.json
```

### Recommended output locations (for thesis evidence)

For thesis evidence we recommend placing generated SBOMs in `docs/evidence/sbom/`. Example commands (run from the repository root):

```bash
cyclonedx-py requirements backend/requirements.txt -o docs/evidence/sbom/sbom-backend.json
cd frontend && npx @cyclonedx/cyclonedx-npm --output-file ../docs/evidence/sbom/sbom-frontend.json
```

### Optional combined project snapshot

If container tooling is introduced later, a project-level CycloneDX export can also be produced with Syft:

```bash
syft packages dir:. -o cyclonedx-json > sbom-project.json
```

## How to use the SBOM evidence

The SBOM output is meant for:

- documenting the dependency footprint of the PoC,
- supporting vulnerability review,
- providing evidence for the thesis discussion of transparent component management.

Generated SBOM files are not committed by default in this repository. If example SBOM artifacts are needed as thesis evidence, place them intentionally under `docs/evidence/` and document that decision separately before committing them.

## Scope reminder

This PoC does not claim full software supply-chain assurance. It only demonstrates that SCFCA can be described and exercised in an SBOM-centered workflow.
