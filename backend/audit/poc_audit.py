"""PoC audit store for SCFCA.

Keeps a simple in-memory list of audit events shared across routers.
Demo-safe only (no sensitive fields, no credentials).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PocAuditEvent:
    id: str
    timestamp: str
    actor: str
    action: str


_EVENTS: list[PocAuditEvent] = [
    PocAuditEvent(id="AU-001", timestamp="2026-03-19 10:05", actor="auditor01", action="Checked signature chain"),
    PocAuditEvent(id="AU-002", timestamp="2026-03-19 10:25", actor="admin01", action="Updated ticket policy"),
    PocAuditEvent(id="AU-003", timestamp="2026-03-19 11:20", actor="mark", action="Opened transfer request (PoC)"),
]


def list_events(limit: int = 200) -> list[PocAuditEvent]:
    return _EVENTS[:limit]


def record_event(actor: str, action: str) -> PocAuditEvent:
    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d %H:%M")
    event_id = f"AU-{len(_EVENTS) + 1:03d}"

    event = PocAuditEvent(id=event_id, timestamp=timestamp, actor=actor, action=action)
    _EVENTS.insert(0, event)
    return event
