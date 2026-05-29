from uuid import uuid4

from fastapi.testclient import TestClient

from backend.auth.login_throttle import MAX_FAILED_ATTEMPTS, THROTTLED_LOGIN_DETAIL
from backend.auth.reauth import REAUTH_REQUIRED_DETAIL, create_reauth_token
from backend.auth.dependencies import Principal
from backend.auth.schemas import Role
from backend.main import app

client = TestClient(app)


def unique_ref(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10].upper()}"


def login(username: str = "bob", password: str = "bob123", role: str = "administrator"):
    client.cookies.clear()
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "role": role},
    )
    assert response.status_code == 200
    csrf_token = response.cookies.get("scfca_csrf")
    assert csrf_token
    return response.cookies, {"x-csrf-token": csrf_token}


def reauth_headers(cookies, headers, password: str = "bob123"):
    response = client.post("/api/v1/auth/reauth", cookies=cookies, headers=headers, json={"password": password})
    assert response.status_code == 200
    token = response.json()["reauthToken"]
    return {**headers, "x-reauth-token": token}


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
    reauth = reauth_headers(cookies, headers)

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
        headers=reauth,
    )

    assert response.status_code == 200


def test_admin_can_get_reauth_token_with_correct_password():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post("/api/v1/auth/reauth", cookies=cookies, headers=headers, json={"password": "bob123"})

    assert response.status_code == 200
    assert response.json()["reauthToken"]
    assert response.json()["expiresInSeconds"] == 300


def test_reauth_rejects_wrong_password():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post("/api/v1/auth/reauth", cookies=cookies, headers=headers, json={"password": "wrong"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_reauth_requires_csrf_token():
    cookies, _headers = login("bob", "bob123", "administrator")

    response = client.post("/api/v1/auth/reauth", cookies=cookies, json={"password": "bob123"})

    assert response.status_code == 403


def test_unauthenticated_user_cannot_get_reauth_token():
    client.cookies.clear()

    response = client.post("/api/v1/auth/reauth", json={"password": "bob123"})

    assert response.status_code == 401


def test_sensitive_admin_case_creation_requires_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-MISSING"), "walletRef": unique_ref("WLT-REAUTH-MISSING"), "assignedHandler": "alice"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == REAUTH_REQUIRED_DETAIL


def test_sensitive_admin_case_creation_accepts_valid_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")
    headers = reauth_headers(cookies, headers)

    response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-OK"), "walletRef": unique_ref("WLT-REAUTH-OK"), "assignedHandler": "alice"},
    )

    assert response.status_code == 201


def test_ticket_approval_requires_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")
    create = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Reauth required approval fixture.",
            "proposedCaseId": unique_ref("SCFCA-CASE-REAUTH-APPROVE"),
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    assert create.status_code == 200
    ticket_id = create.json()["ticket"]["id"]

    response = client.post(f"/api/v1/tickets/{ticket_id}/approve", cookies=cookies, headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == REAUTH_REQUIRED_DETAIL


def test_ticket_approval_accepts_valid_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")
    create = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Reauth valid approval fixture.",
            "proposedCaseId": unique_ref("SCFCA-CASE-REAUTH-APPROVE-OK"),
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    assert create.status_code == 200
    ticket_id = create.json()["ticket"]["id"]
    headers = reauth_headers(cookies, headers)

    response = client.post(f"/api/v1/tickets/{ticket_id}/approve", cookies=cookies, headers=headers)

    assert response.status_code == 200


def test_ticket_rejection_and_assignment_require_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")
    create = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Reauth required reject and assign fixture.",
            "proposedCaseId": unique_ref("SCFCA-CASE-REAUTH-REJECT"),
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    assert create.status_code == 200
    ticket_id = create.json()["ticket"]["id"]

    reject = client.post(f"/api/v1/tickets/{ticket_id}/reject", cookies=cookies, headers=headers)
    assign = client.patch(f"/api/v1/tickets/{ticket_id}/assign", cookies=cookies, headers=headers, json={"assignedTo": "mark"})

    assert reject.status_code == 403
    assert assign.status_code == 403


def test_ticket_rejection_and_assignment_accept_valid_reauth_token():
    cookies, headers = login("bob", "bob123", "administrator")
    create_reject = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Reauth valid reject fixture.",
            "proposedCaseId": unique_ref("SCFCA-CASE-REAUTH-REJECT-OK"),
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    create_assign = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Reauth valid assign fixture.",
            "proposedCaseId": unique_ref("SCFCA-CASE-REAUTH-ASSIGN-OK"),
            "assignedHandler": "alice",
            "linkedDocumentIds": [],
        },
    )
    assert create_reject.status_code == 200
    assert create_assign.status_code == 200
    headers = reauth_headers(cookies, headers)

    reject = client.post(f"/api/v1/tickets/{create_reject.json()['ticket']['id']}/reject", cookies=cookies, headers=headers)
    assign = client.patch(
        f"/api/v1/tickets/{create_assign.json()['ticket']['id']}/assign",
        cookies=cookies,
        headers=headers,
        json={"assignedTo": "mark"},
    )

    assert reject.status_code == 200
    assert assign.status_code == 200


def test_regular_user_and_auditor_reauth_do_not_grant_admin_actions():
    regular_cookies, regular_headers = login("alice", "alice123", "regular")
    regular_headers = reauth_headers(regular_cookies, regular_headers, "alice123")
    regular_response = client.post(
        "/api/v1/cases/",
        cookies=regular_cookies,
        headers=regular_headers,
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-REGULAR"), "walletRef": unique_ref("WLT-REAUTH-REGULAR")},
    )

    auditor_cookies, auditor_headers = login("carol", "carol123", "auditor")
    auditor_headers = reauth_headers(auditor_cookies, auditor_headers, "carol123")
    auditor_response = client.post(
        "/api/v1/cases/",
        cookies=auditor_cookies,
        headers=auditor_headers,
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-AUDITOR"), "walletRef": unique_ref("WLT-REAUTH-AUDITOR")},
    )

    assert regular_response.status_code == 403
    assert auditor_response.status_code == 403


def test_reauth_token_is_bound_to_authenticated_user():
    bob_cookies, bob_headers = login("bob", "bob123", "administrator")
    bob_reauth = reauth_headers(bob_cookies, bob_headers)
    eve_cookies, eve_headers = login("eve", "eve123", "administrator")
    mixed_headers = {**eve_headers, "x-reauth-token": bob_reauth["x-reauth-token"]}

    response = client.post(
        "/api/v1/cases/",
        cookies=eve_cookies,
        headers=mixed_headers,
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-MIXED"), "walletRef": unique_ref("WLT-REAUTH-MIXED"), "assignedHandler": "alice"},
    )

    assert response.status_code == 403


def test_invalid_and_expired_reauth_tokens_are_rejected():
    cookies, headers = login("bob", "bob123", "administrator")
    expired = create_reauth_token(Principal(username="bob", role=Role.administrator), now=1000, lifetime_seconds=-1)

    invalid_response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers={**headers, "x-reauth-token": "invalid"},
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-INVALID"), "walletRef": unique_ref("WLT-REAUTH-INVALID")},
    )
    expired_response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers={**headers, "x-reauth-token": expired},
        json={"caseId": unique_ref("SCFCA-CASE-REAUTH-EXPIRED"), "walletRef": unique_ref("WLT-REAUTH-EXPIRED")},
    )

    assert invalid_response.status_code == 403
    assert expired_response.status_code == 403


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
