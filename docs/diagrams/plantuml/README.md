# PlantUML Diagrams (Thesis Documentation)

This folder contains PlantUML source diagrams for the SCFCA proof-of-concept.

## Purpose

These diagrams support thesis documentation by providing maintainable, version-controlled sources for figures such as:

- Implementation architecture (frontend/backend/data + security evidence)
- Docker Compose execution model (services, ports, and hardening posture)
- DevSecOps CI/CD evidence pipeline (visibility-first security stages and artifacts)

## Notes and scope

- Diagrams reflect the current PoC repository structure and CI visibility checks.
- They are not a production reference architecture or a security certification.
- The CI pipeline uses visibility-first, non-blocking scanning (`allow_failure`) for thesis evidence.

## Exporting figures

Binary exports (PNG/SVG/PDF) are intentionally not committed here.
You can export figures later for Overleaf using any PlantUML renderer (VS Code PlantUML extension, local jar, or CI tooling).
