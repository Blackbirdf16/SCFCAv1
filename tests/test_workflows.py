"""Basic tests for active SCFCA PoC workflows."""

from uuid import uuid4

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def login(username: str, password: str, role: str):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "role": role},
    )
    assert response.status_code == 200
    csrf_token = response.cookies.get("scfca_csrf")
    assert csrf_token
    return response.cookies, {"x-csrf-token": csrf_token}


def test_regular_user_can_see_assigned_cases():
    cookies, _headers = login("alice", "alice123", "regular")

    response = client.get("/api/v1/cases/", cookies=cookies)

    assert response.status_code == 200
    assert "cases" in response.json()


def test_admin_can_see_tickets():
    cookies, _headers = login("bob", "bob123", "administrator")

    response = client.get("/api/v1/tickets/", cookies=cookies)

    assert response.status_code == 200
    assert "tickets" in response.json()


def test_auditor_can_see_audit_log():
    cookies, _headers = login("carol", "carol123", "auditor")

    response = client.get("/api/v1/audit/", cookies=cookies)

    assert response.status_code == 200
    assert "events" in response.json()


def test_admin_cannot_see_audit_log():
    cookies, _headers = login("bob", "bob123", "administrator")

    response = client.get("/api/v1/audit/", cookies=cookies)

    assert response.status_code == 403


def test_regular_user_cannot_see_audit_log():
    cookies, _headers = login("alice", "alice123", "regular")

    response = client.get("/api/v1/audit/", cookies=cookies)

    assert response.status_code == 403


def test_auditor_can_run_audit_hash_chain_verification_endpoint():
    cookies, _headers = login("carol", "carol123", "auditor")

    response = client.get("/api/v1/audit/chain/verify", cookies=cookies)

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["verified"], bool)
    assert "eventCount" in body
    assert "issueCount" in body
    assert "issues" in body


def test_non_auditors_cannot_verify_audit_hash_chain():
    admin_cookies, _admin_headers = login("bob", "bob123", "administrator")
    regular_cookies, _regular_headers = login("alice", "alice123", "regular")

    admin_response = client.get("/api/v1/audit/chain/verify", cookies=admin_cookies)
    regular_response = client.get("/api/v1/audit/chain/verify", cookies=regular_cookies)

    assert admin_response.status_code == 403
    assert regular_response.status_code == 403


def test_admin_cannot_create_regular_custody_ticket():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "caseId": "C-100",
            "ticketType": "transfer_request",
            "description": "Workflow test transfer request",
            "linkedDocumentIds": [],
        },
    )

    assert response.status_code == 403
    assert "Administrators cannot initiate custody workflow tickets" in response.json()["detail"]


def test_admin_can_create_case_creation_request_and_no_case_is_created():
    cookies, headers = login("bob", "bob123", "administrator")

    before = client.get("/api/v1/cases/", cookies=cookies)
    assert before.status_code == 200
    before_ids = {c["id"] for c in before.json().get("cases", [])}

    proposed_case_id = "SCFCA-CASE-2026-9001"
    assert proposed_case_id not in before_ids

    create = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Request creation of a new custody case (ticket only).",
            "proposedCaseId": proposed_case_id,
            "assignedHandler": "handler1@scfca.local",
            "linkedDocumentIds": [],
        },
    )
    assert create.status_code == 200
    ticket = create.json()["ticket"]
    assert ticket["ticketType"] == "case_creation_request"
    assert ticket["status"] == "pending_review"
    assert ticket["proposedCaseId"] == proposed_case_id
    assert ticket["assignedHandler"] == "handler1@scfca.local"

    tickets = client.get("/api/v1/tickets/", cookies=cookies)
    assert tickets.status_code == 200
    assert any(t.get("id") == ticket["id"] for t in tickets.json().get("tickets", []))

    after = client.get("/api/v1/cases/", cookies=cookies)
    assert after.status_code == 200
    after_ids = {c["id"] for c in after.json().get("cases", [])}
    assert after_ids == before_ids
    assert proposed_case_id not in after_ids

    auditor_cookies, _auditor_headers = login("carol", "carol123", "auditor")
    audit = client.get("/api/v1/audit/", cookies=auditor_cookies)
    assert audit.status_code == 200
    assert any(e.get("action") == "case_creation_request_submitted" for e in audit.json().get("events", []))


def test_regular_user_cannot_create_case_creation_request():
    cookies, headers = login("alice", "alice123", "regular")

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Attempt case creation request (should fail).",
            "proposedCaseId": "SCFCA-CASE-2026-9002",
            "assignedHandler": "handler2@scfca.local",
        },
    )
    assert response.status_code == 403


def test_auditor_cannot_create_case_creation_request():
    cookies, headers = login("carol", "carol123", "auditor")

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Attempt case creation request (should fail).",
            "proposedCaseId": "SCFCA-CASE-2026-9003",
            "assignedHandler": "handler3@scfca.local",
        },
    )
    assert response.status_code == 403


def test_admin_cannot_assign_case_creation_request_to_self():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Invalid self-assignment.",
            "proposedCaseId": "SCFCA-CASE-2026-9004",
            "assignedHandler": "bob",
        },
    )
    assert response.status_code == 400
    assert "self" in (response.json().get("detail") or "").lower()


def test_admin_cannot_assign_case_creation_request_to_admin_like_values():
    cookies, headers = login("bob", "bob123", "administrator")

    invalid = [
        "admin",
        "administrator",
        "bob",
        "admin1",
        "admin2",
        "admin1@scfca.local",
        "admin2@scfca.local",
    ]
    for value in invalid:
        response = client.post(
            "/api/v1/tickets/",
            cookies=cookies,
            headers=headers,
            json={
                "ticketType": "case_creation_request",
                "description": "Invalid assigned handler.",
                "proposedCaseId": "SCFCA-CASE-2026-9005",
                "assignedHandler": value,
            },
        )
        assert response.status_code == 400


def test_admin_must_assign_case_creation_request_to_one_of_allowed_handlers():
    cookies, headers = login("bob", "bob123", "administrator")

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "case_creation_request",
            "description": "Invalid handler outside allow-list.",
            "proposedCaseId": "SCFCA-CASE-2026-9006",
            "assignedHandler": "mallory",
        },
    )
    assert response.status_code == 400


def test_admin_can_create_case_and_case_is_visible_to_admin_and_assignee():
    cookies, headers = login("bob", "bob123", "administrator")

    case_id = f"SCFCA-CASE-TEST-{uuid4().hex[:10].upper()}"
    wallet_ref = f"WLT-TEST-{uuid4().hex[:10].upper()}"

    create = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={
            "caseId": case_id,
            "walletRef": wallet_ref,
            "title": "Workflow created custody case",
            "assignedHandler": "alice",
        },
    )
    assert create.status_code == 201
    created = create.json()["case"]
    assert created["id"] == case_id
    assert created["walletRef"] == wallet_ref

    cases_admin = client.get("/api/v1/cases/", cookies=cookies)
    assert cases_admin.status_code == 200
    assert any(item.get("id") == case_id for item in cases_admin.json().get("cases", []))

    alice_cookies, _alice_headers = login("alice", "alice123", "regular")
    cases_alice = client.get("/api/v1/cases/", cookies=alice_cookies)
    assert cases_alice.status_code == 200
    assert any(item.get("id") == case_id for item in cases_alice.json().get("cases", []))

    auditor_cookies, _auditor_headers = login("carol", "carol123", "auditor")
    audit = client.get("/api/v1/audit/", cookies=auditor_cookies)
    assert audit.status_code == 200
    assert any(
        e.get("action") == "case_created" and (e.get("entityId") == case_id or e.get("entity_id") == case_id)
        for e in audit.json().get("events", [])
    )


def test_regular_user_cannot_create_case():
    cookies, headers = login("alice", "alice123", "regular")
    response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"walletRef": f"WLT-TEST-{uuid4().hex[:8].upper()}", "title": "Should fail"},
    )
    assert response.status_code == 403


def test_auditor_cannot_create_case():
    cookies, headers = login("carol", "carol123", "auditor")
    response = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"walletRef": f"WLT-TEST-{uuid4().hex[:8].upper()}", "title": "Should fail"},
    )
    assert response.status_code == 403


def test_no_direct_asset_mutation_route_for_admin_or_case_handler():
    admin_cookies, admin_headers = login("bob", "bob123", "administrator")
    regular_cookies, regular_headers = login("alice", "alice123", "regular")

    payload = {"symbol": "ETH", "balance": 99, "walletRef": "WLT-TAMPERED"}

    admin_asset_response = client.patch(
        "/api/v1/assets/AS-0001",
        cookies=admin_cookies,
        headers=admin_headers,
        json=payload,
    )
    regular_asset_response = client.patch(
        "/api/v1/assets/AS-0001",
        cookies=regular_cookies,
        headers=regular_headers,
        json=payload,
    )
    admin_case_holding_response = client.patch(
        "/api/v1/cases/SCFCA-CASE-2026-0001/holdings/AS-0001",
        cookies=admin_cookies,
        headers=admin_headers,
        json=payload,
    )

    assert admin_asset_response.status_code == 404
    assert regular_asset_response.status_code == 404
    assert admin_case_holding_response.status_code == 404


def test_admin_cannot_create_duplicate_case_id():
    cookies, headers = login("bob", "bob123", "administrator")

    case_id = f"SCFCA-CASE-TEST-{uuid4().hex[:10].upper()}"
    wallet_ref_1 = f"WLT-TEST-{uuid4().hex[:10].upper()}"
    wallet_ref_2 = f"WLT-TEST-{uuid4().hex[:10].upper()}"

    first = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"caseId": case_id, "walletRef": wallet_ref_1, "assignedHandler": "alice"},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/cases/",
        cookies=cookies,
        headers=headers,
        json={"caseId": case_id, "walletRef": wallet_ref_2, "assignedHandler": "alice"},
    )
    assert second.status_code == 409
