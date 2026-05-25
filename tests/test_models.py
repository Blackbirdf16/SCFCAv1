"""Tests for Phase A model foundation.

These tests import the core models module and verify SQLAlchemy metadata
is present and can create tables in an in-memory SQLite database. They do
not perform application route changes or persistent DB writes.
"""
from sqlalchemy import create_engine

from backend.core.database import Base


def test_models_importable_and_create_tables():
    # Importing backend.core.models should register models with Base
    import backend.core.models as core_models  # noqa: F401

    # Use an in-memory SQLite engine to ensure metadata compiles
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    # Basic sanity: ensure some expected tables exist in metadata
    table_names = set(Base.metadata.tables.keys())
    expected = {
        "cases",
        "case_assignments",
        "assets",
        "frozen_valuations",
        "tickets",
        "ticket_approvals",
        "documents",
        "custody_actions",
        "audit_events",
    }
    assert expected.issubset(table_names)
