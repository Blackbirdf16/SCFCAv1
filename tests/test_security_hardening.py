from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def login(username: str = "bob", password: str = "bob123", role: str = "administrator"):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "role": role},
    )
    assert response.status_code == 200
    csrf_token = response.cookies.get("scfca_csrf")
    assert csrf_token
    return response.cookies, {"x-csrf-token": csrf_token}


def test_login_rejects_unknown_demo_credentials():
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "mallory", "password": "password", "role": "administrator"},
    )

    assert response.status_code == 401


def test_login_rejects_role_mismatch_for_known_demo_user():
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "alice123", "role": "administrator"},
    )

    assert response.status_code == 403


def test_header_role_spoofing_is_not_accepted():
    response = client.get(
        "/api/v1/audit/",
        headers={"x-scfca-user": "mallory", "x-scfca-role": "administrator"},
    )

    assert response.status_code == 401


def test_ticket_mutation_requires_csrf_token():
    cookies, _headers = login()

    response = client.patch(
        "/api/v1/tickets/T-201/assign",
        cookies=cookies,
        json={"assignedTo": "bob"},
    )

    assert response.status_code == 403


def test_ticket_approval_mutation_accepts_valid_csrf_token():
    cookies, headers = login()

    create = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "CSRF assignment fixture ticket.",
            "proposedCaseId": "SCFCA-CASE-2026-9101",
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    assert create.status_code == 200
    ticket_id = create.json()["ticket"]["id"]

    response = client.post(
        f"/api/v1/tickets/{ticket_id}/approve",
        cookies=cookies,
        headers=headers,
    )

    assert response.status_code == 200


def test_document_registration_rejects_pdf_over_size_limit():
    cookies, headers = login()

    response = client.post(
        "/api/v1/documents/",
        cookies=cookies,
        headers=headers,
        json={
            "name": "oversized.pdf",
            "hash": "sha256:ABC123",
            "createdAt": "2026-05-05",
            "sizeBytes": 10 * 1024 * 1024 + 1,
        },
    )

    assert response.status_code == 413


def test_document_registration_rejects_non_pdf_name():
    cookies, headers = login()

    response = client.post(
        "/api/v1/documents/",
        cookies=cookies,
        headers=headers,
        json={
            "name": "audit_trace.csv",
            "hash": "sha256:ABC123",
            "createdAt": "2026-05-05",
            "sizeBytes": 1024,
        },
    )

    assert response.status_code == 400
