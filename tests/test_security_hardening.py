from fastapi.testclient import TestClient

from backend.auth.login_throttle import MAX_FAILED_ATTEMPTS, THROTTLED_LOGIN_DETAIL
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


def test_successful_login_still_issues_session_and_csrf_cookie():
    cookies, headers = login("alice", "alice123", "regular")

    assert cookies.get("scfca_session")
    assert cookies.get("scfca_csrf")
    assert headers["x-csrf-token"] == cookies.get("scfca_csrf")


def test_failed_login_returns_401_before_threshold_then_429():
    for _ in range(MAX_FAILED_ATTEMPTS):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "alice", "password": "wrong-password", "role": "regular"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    throttled = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong-password", "role": "regular"},
    )

    assert throttled.status_code == 429
    assert throttled.json()["detail"] == THROTTLED_LOGIN_DETAIL


def test_successful_login_resets_failed_attempt_counter():
    for _ in range(MAX_FAILED_ATTEMPTS - 1):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "bob", "password": "wrong-password", "role": "administrator"},
        )
        assert response.status_code == 401

    success = client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "bob123", "role": "administrator"},
    )
    assert success.status_code == 200

    for _ in range(MAX_FAILED_ATTEMPTS):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "bob", "password": "wrong-password", "role": "administrator"},
        )
        assert response.status_code == 401

    throttled = client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "wrong-password", "role": "administrator"},
    )
    assert throttled.status_code == 429


def test_unknown_user_and_wrong_password_are_throttled_consistently():
    cases = [
        {"username": "alice", "password": "wrong-password", "role": "regular"},
        {"username": "unknown-user", "password": "wrong-password", "role": "regular"},
    ]
    for payload in cases:
        for _ in range(MAX_FAILED_ATTEMPTS):
            response = client.post("/api/v1/auth/login", json=payload)
            assert response.status_code == 401
            assert response.json()["detail"] == "Invalid credentials"

        throttled = client.post("/api/v1/auth/login", json=payload)
        assert throttled.status_code == 429
        assert throttled.json()["detail"] == THROTTLED_LOGIN_DETAIL


def test_login_throttling_does_not_rate_limit_health_endpoint():
    for _ in range(MAX_FAILED_ATTEMPTS):
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "mallory", "password": "wrong-password", "role": "regular"},
        )
        assert response.status_code == 401

    throttled = client.post(
        "/api/v1/auth/login",
        json={"username": "mallory", "password": "wrong-password", "role": "regular"},
    )
    assert throttled.status_code == 429

    health = client.get("/api/v1/health/")
    assert health.status_code == 200


def test_login_rejects_role_mismatch_for_known_demo_user():
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "alice123", "role": "administrator"},
    )

    assert response.status_code == 403


def test_header_role_spoofing_is_not_accepted():
    client.cookies.clear()
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
