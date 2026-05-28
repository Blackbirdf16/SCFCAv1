"""Focused audit hash-chain verification tests."""

from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.api.v1.routes.audit import _raw_event_hash, verify_audit_chain
from backend.auth.schemas import Role
from backend.core.database import Base
from backend.core.models import AuditEvent
from backend.users.models import User


def _db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return Session(bind=engine)


def _seed_valid_chain(db: Session) -> list[AuditEvent]:
    user = User(username="carol", password_hash="not-used", role=Role.auditor, is_active=True)
    db.add(user)
    db.flush()

    events: list[AuditEvent] = []
    previous_hash: str | None = None
    for index, action in enumerate(["login_event", "case_viewed", "report_generated"], start=1):
        event = AuditEvent(
            event_ref=f"AU-TEST-{index:04d}",
            timestamp=datetime(2026, 5, 28, 12, index, 0),
            actor_id=user.id,
            action=action,
            entity_type="audit_test",
            entity_id=index,
            details=f"Audit verification fixture event {index}.",
            previous_hash=previous_hash,
        )
        event.hash_chain = _raw_event_hash(event, previous_hash)
        db.add(event)
        db.flush()
        events.append(event)
        previous_hash = event.hash_chain

    db.commit()
    return events


def test_valid_audit_hash_chain_verifies_successfully():
    db = _db_session()
    try:
        _seed_valid_chain(db)

        result = verify_audit_chain(db)

        assert result["verified"] is True
        assert result["eventCount"] == 3
        assert result["issueCount"] == 0
        assert result["issues"] == []
    finally:
        db.close()


def test_empty_audit_hash_chain_returns_controlled_success():
    db = _db_session()
    try:
        result = verify_audit_chain(db)

        assert result["verified"] is True
        assert result["eventCount"] == 0
        assert result["issueCount"] == 0
        assert result["issues"] == []
    finally:
        db.close()


def test_broken_previous_hash_is_detected():
    db = _db_session()
    try:
        events = _seed_valid_chain(db)
        events[1].previous_hash = "broken-link"
        db.commit()

        result = verify_audit_chain(db)

        assert result["verified"] is False
        assert result["issueCount"] >= 1
        assert any(issue["check"] == "previous_hash" for issue in result["issues"])
    finally:
        db.close()


def test_tampered_audit_event_content_is_detected():
    db = _db_session()
    try:
        events = _seed_valid_chain(db)
        events[1].details = "Tampered event details."
        db.commit()

        result = verify_audit_chain(db)

        assert result["verified"] is False
        assert result["issueCount"] >= 1
        assert any(issue["check"] == "hash_chain" for issue in result["issues"])
    finally:
        db.close()
