"""
Local smoke test helper (development only).

Purpose:
- Exercises login, audit listing, document upload, ticket creation, and approval
    flows against the in-memory demo backend using FastAPI's TestClient.

Notes:
- Intended for local development and validation only — not for production use.
- Uses the project's demo/test data and in-memory stores; it may add or
    modify demo objects in-memory but does not persist to an external database.
"""

from fastapi.testclient import TestClient
import json

from backend.main import app
import backend.api.v1.routes.audit as audit_mod


client = TestClient(app)


if __name__ == "__main__":
    # Ensure the repository root is on sys.path when executed as a script
    import sys
    from pathlib import Path

    repo_root = str(Path(__file__).resolve().parents[1])
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)


def login(username, password, role=None):
    payload = {"username": username, "password": password}
    if role is not None:
        payload["role"] = role
    r = client.post("/api/v1/auth/login", json=payload)
    return r


def last_event_by(actor: str, action: str):
    for ev in reversed(audit_mod.AUDIT_EVENTS):
        if ev.actor == actor and ev.action == action:
            return ev.model_dump()
    return None


def run_checks():
    out = {}

    # Auditor can view audit events
    r = login("carol", "carol123")
    out["login_carol_status"] = r.status_code
    r2 = client.get("/api/v1/audit/events")
    out["audit_events_status"] = r2.status_code
    out["audit_summary"] = r2.json().get("summary") if r2.status_code == 200 else None

    # Document upload by alice
    r_al = login("alice", "alice123")
    csrf = r_al.json().get("csrfToken")
    files = {"file": ("test.pdf", b"%PDF-1.4\n%Demo\n", "application/pdf")}
    data = {"caseId": "SCFCA-CASE-2026-0001", "walletRef": "WLT-TEST"}
    headers = {"x-csrf-token": csrf}
    r_up = client.post("/api/v1/documents/upload", files=files, data=data, headers=headers)
    out["upload_status"] = r_up.status_code
    out["upload_response"] = r_up.json() if r_up.status_code == 200 else r_up.text
    out["last_doc_event"] = last_event_by("alice", "document_uploaded")

    # Ticket create by alice
    ticket_payload = {"ticketType": "transfer_request", "description": "smoke test", "caseId": "SCFCA-CASE-2026-0001"}
    r_ticket = client.post("/api/v1/tickets", json=ticket_payload, headers=headers)
    out["ticket_create_status"] = r_ticket.status_code
    out["ticket_create_response"] = r_ticket.json() if r_ticket.status_code == 200 else r_ticket.text
    ticket_id = None
    try:
        ticket_id = r_ticket.json().get("ticket", {}).get("id")
    except Exception:
        ticket_id = None

    out["last_ticket_created_event"] = last_event_by("alice", "ticket_created")

    # Approve ticket by bob (admin)
    r_bob = login("bob", "bob123")
    bob_csrf = r_bob.json().get("csrfToken")
    headers_bob = {"x-csrf-token": bob_csrf}
    if ticket_id:
        r_approve = client.post(f"/api/v1/tickets/{ticket_id}/approve", headers=headers_bob)
        out["approve_status"] = r_approve.status_code
        out["last_ticket_approved_event"] = last_event_by("bob", "ticket_approved")
    else:
        out["approve_status"] = "no-ticket"

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    run_checks()
