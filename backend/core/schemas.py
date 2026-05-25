"""
Minimal Pydantic schemas for core models (Phase A).

These are small DTOs intended to aid tests and future route wiring.
"""
from __future__ import annotations

from pydantic import BaseModel
from typing import Optional, List, Any


class CaseSchema(BaseModel):
    case_id: str
    wallet_ref: str
    title: Optional[str]


class TicketSchema(BaseModel):
    ticket_ref: str
    ticket_type: str
    description: Optional[str]
    status: str
    proposed_case_id: Optional[str]
    assigned_handler_username: Optional[str]


class DocumentSchema(BaseModel):
    doc_ref: str
    name: str
    hash: str
    size_bytes: Optional[int]


__all__ = ["CaseSchema", "TicketSchema", "DocumentSchema"]
