"""
Canonical SQLAlchemy models for SCFCA (Phase A only).

This file introduces the core domain ORM models without wiring them
into the existing routes. Routes remain unchanged and continue to use
in-memory PoC stores until later phases.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Numeric,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from backend.core.database import Base
from backend.users.models import User  # reuse existing User model


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True)
    case_id = Column(String, unique=True, index=True, nullable=False)  # non-semantic immutable id
    wallet_ref = Column(String, nullable=False)
    title = Column(String, nullable=True)
    custody_status = Column(String, nullable=False, default="open")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)

    assignments = relationship("CaseAssignment", back_populates="case", lazy="selectin")


class CaseAssignment(Base):
    __tablename__ = "case_assignments"

    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    assigned_to_username = Column(String, index=True, nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    unassigned_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    case = relationship("Case", back_populates="assignments")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True)
    asset_id = Column(String, unique=True, index=True, nullable=False)
    symbol = Column(String, nullable=False)
    network = Column(String, nullable=True)
    wallet_ref = Column(String, nullable=True)
    balance = Column(Numeric(36, 8), nullable=True)
    asset_type = Column(String, nullable=True)
    protocol = Column(String, nullable=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, nullable=False, default="active")
    registered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    registered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class FrozenValuationSnapshot(Base):
    __tablename__ = "frozen_valuations"

    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    snapshot_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    valuation = Column(JSON, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (UniqueConstraint("case_id", "snapshot_time", name="uq_case_snapshot_time"),)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True)
    ticket_ref = Column(String, unique=True, index=True, nullable=False)
    ticket_type = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, index=True, nullable=False, default="pending_review")
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    proposed_case_id = Column(String, nullable=True)
    assigned_handler_username = Column(String, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    linked_document_ids = Column(JSON, nullable=True)


class TicketApproval(Base):
    __tablename__ = "ticket_approvals"

    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), index=True, nullable=False)
    stage = Column(Integer, nullable=False)
    decision = Column(String, nullable=False)  # approved/rejected
    decided_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    doc_ref = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="SET NULL"), nullable=True)
    wallet_ref = Column(String, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    size_bytes = Column(Integer, nullable=True)


class CustodyAction(Base):
    __tablename__ = "custody_actions"

    id = Column(Integer, primary_key=True)
    action_ref = Column(String, unique=True, index=True, nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="requested")
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    executed_at = Column(DateTime, nullable=True)
    details = Column(JSON, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True)
    event_ref = Column(String, unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    previous_hash = Column(String, nullable=True)
    hash_chain = Column(String, nullable=True)


__all__ = [
    "User",
    "Case",
    "CaseAssignment",
    "Asset",
    "FrozenValuationSnapshot",
    "Ticket",
    "TicketApproval",
    "Document",
    "CustodyAction",
    "AuditEvent",
]
