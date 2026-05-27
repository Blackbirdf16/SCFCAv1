# Manual Validation Evidence

## Purpose

Manual validation complements the automated tests and scanner evidence by checking user-facing workflows, role-based behavior, and evidence review in the running SCFCA proof of concept.

This checklist is intended for thesis evidence. It is not a new automated test suite, production certification, or proof that the application is vulnerability-free.

## Scope

Manual validation covers:

- local Docker Compose PoC execution,
- GitLab CI/CD artifact review,
- role-based workflow validation for regular users, administrators, and auditors,
- screenshot and artifact collection for thesis/professor review.

## Checklist

Status values: `Pending`, `Passed`, `Failed`, `Not applicable`.

| ID | Validation area | Steps | Expected result | Evidence to collect | Status |
| --- | --- | --- | --- | --- | --- |
| MV-01 | Start PoC environment | Run `docker compose up --build`; open the frontend; open backend docs or health endpoint. | Backend health returns `ok`; frontend loads. | `mv-01-docker-compose-running.png`, backend health screenshot. | Pending |
| MV-02 | Login as regular/case-handler user | Log in as a regular demo user such as `alice`. | User can access permitted case and ticket features only. | `mv-02-regular-login.png`. | Pending |
| MV-03 | Login as administrator | Log in as an administrator such as `bob` or `eve`. | Administrator can access administration, ticket review, assignment, approval, and rejection features. | `mv-03-admin-login.png`. | Pending |
| MV-04 | Login as auditor | Log in as auditor `carol`. | Auditor has read-only oversight and audit access. | `mv-04-auditor-login.png`. | Pending |
| MV-05 | RBAC negative checks | Attempt admin/audit-only actions as a regular user; attempt modifying operational records as an auditor. | Unauthorized actions are blocked with controlled denial responses. | `mv-05-rbac-denied-action.png`. | Pending |
| MV-06 | Case listing and case access | Review case lists as assigned and non-assigned users where applicable. | Assigned or authorized case data is visible; restricted case data is blocked where applicable. | `mv-06-case-access.png`. | Pending |
| MV-07 | Document upload validation | Upload or register a supported PDF; attempt a non-PDF document. | Supported PDF is accepted where the role and case allow it; non-PDF is rejected; hash or integrity metadata is visible or recorded. | `mv-07-document-validation.png`. | Pending |
| MV-08 | Ticket creation | Create a valid ticket linked to an authorized case; omit required fields in a second attempt. | Valid ticket is created; required fields are enforced. | `mv-08-ticket-creation.png`. | Pending |
| MV-09 | Dual approval workflow | Submit or select a ticket requiring approval; approve once as an administrator; approve through the second required path where applicable. | First approval does not execute the final action alone; second approval completes the approval path where applicable. | `mv-09-dual-approval.png`. | Pending |
| MV-10 | Rejection path | Reject a pending ticket as an administrator. | Ticket is rejected or closed without executing the requested change. | `mv-10-ticket-rejection.png`. | Pending |
| MV-11 | Audit trail review | Review audit entries after login, ticket, document, approval, rejection, and report actions. | Important actions generate audit entries; auditor or administrator can review relevant audit evidence. | `mv-11-audit-trail.png`. | Pending |
| MV-12 | Security artifact review | Open the GitLab pipeline artifacts for security jobs. | JSON and HTML reports exist; ZAP JSON, HTML, and Markdown reports exist where the DAST job ran. | `mv-12-gitlab-security-artifacts.png`. | Pending |
| MV-13 | Known limitation review | Review scanner findings, non-blocking job status, and documented limitations. | Non-blocking security jobs are understood as visibility evidence; unresolved findings are documented for triage. | `mv-13-known-limitations.png`. | Pending |

## Evidence Naming Convention

Suggested screenshot and artifact names:

- `mv-01-docker-compose-running.png`
- `mv-02-regular-login.png`
- `mv-05-rbac-denied-action.png`
- `mv-09-dual-approval.png`
- `mv-12-gitlab-security-artifacts.png`

Use the same `mv-XX-...` prefix for related screenshots, exported reports, and notes so evidence remains easy to map back to the checklist.

## Manual Validation Summary Template

| Field | Value |
| --- | --- |
| Date |  |
| Environment |  |
| Validator |  |
| Commit hash |  |
| Total checks | 13 |
| Passed |  |
| Failed |  |
| Notes |  |

## Limitations

- Manual validation is scenario-based and not exhaustive.
- Manual validation complements but does not replace automated tests, security scanners, or DAST.
- This checklist does not prove production security or compliance.
- Screenshots, exported artifacts, and notes should be stored intentionally as evidence.
