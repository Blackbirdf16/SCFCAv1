"""Small Hypothesis checks for malformed security-sensitive inputs."""

from hypothesis import given, settings, strategies as st
from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


safe_text = st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),
        blacklist_characters=["\x00"],
    ),
    max_size=48,
)


def login(username: str = "alice", password: str = "alice123", role: str = "regular"):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "role": role},
    )
    assert response.status_code == 200
    csrf_token = response.cookies.get("scfca_csrf")
    assert csrf_token
    return response.cookies, {"x-csrf-token": csrf_token}


@settings(max_examples=25, deadline=None)
@given(prefix=safe_text)
def test_document_registration_rejects_fuzzed_non_pdf_names_without_500(prefix: str):
    cookies, headers = login()
    filename = f"{prefix}.txt"

    response = client.post(
        "/api/v1/documents/",
        cookies=cookies,
        headers=headers,
        json={
            "name": filename,
            "hash": "sha256:ABC123",
            "createdAt": "2026-05-05",
            "caseId": "SCFCA-CASE-2026-0001",
            "sizeBytes": 1024,
        },
    )

    assert response.status_code == 400
    assert response.status_code != 500


@settings(max_examples=25, deadline=None)
@given(description=safe_text, case_suffix=safe_text)
def test_ticket_creation_handles_fuzzed_text_and_invalid_case_ids_without_500(description: str, case_suffix: str):
    cookies, headers = login()

    response = client.post(
        "/api/v1/tickets/",
        cookies=cookies,
        headers=headers,
        json={
            "ticketType": "transfer_request",
            "description": description,
            "caseId": f"FUZZ-{case_suffix}",
            "linkedDocumentIds": [],
        },
    )

    assert response.status_code in {400, 404}
    assert response.status_code != 500
