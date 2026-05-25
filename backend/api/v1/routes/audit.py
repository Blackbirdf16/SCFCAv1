"""Audit endpoints for SCFCA backend (PoC).

Role intent:
- regular: no access to system-wide logs
- administrator: operational log review
- auditor: evidence/traceability focused review
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.auth.dependencies import Principal, SESSION_COOKIE, require_any_role, require_role
from backend.auth.schemas import Role
from backend.core.database import SessionLocal, get_db
from backend.core.models import AuditEvent, Case, Document
from backend.users.models import User

router = APIRouter()


class AuditEventRecord(BaseModel):
    id: str
    timestamp: str
    date: str
    actor: str
    actor_username: str
    actor_role: str
    action: str
    action_type: str
    entity_type: str | None = None
    entity_id: str | None = None
    description: str
    status: str = "success"
    result: str = "success"
    source_ip: str | None = None
    session_id: str | None = None
    previous_hash: str | None = None
    hash_chain: str | None = None


class AuditQuery(BaseModel):
    date_from: str | None = None
    date_to: str | None = None
    actor: str | None = None
    role: str | None = None
    action: str | None = None
    entity_type: str | None = None
    case_id: str | None = None
    ticket_id: str | None = None
    q: str | None = None
    limit: int | None = Field(default=None, ge=1, le=1000)


class HashVerifyRequest(BaseModel):
    hash: str


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _session_identifier(request: Request) -> str | None:
    session_cookie = request.cookies.get(SESSION_COOKIE)
    return sha256(session_cookie.encode("utf-8")).hexdigest()[:12] if session_cookie else None


def _source_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _user_for_event(db: Session, event: AuditEvent) -> User | None:
    return db.get(User, event.actor_id) if event.actor_id else None


def _parse_details(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {"description": ""}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return {"description": raw}


def _event_ref_next(db: Session) -> str:
    max_number = 0
    for (event_ref,) in db.query(AuditEvent.event_ref).all():
        if event_ref and event_ref.startswith("AU-") and event_ref[3:].isdigit():
            max_number = max(max_number, int(event_ref[3:]))
    return f"AU-{max_number + 1:04d}"


def _event_hash(record: AuditEventRecord, previous_hash: str | None) -> str:
    payload = "|".join(
        [
            record.id,
            record.timestamp,
            record.date,
            record.actor_username,
            record.actor_role,
            record.action_type,
            record.entity_type or "",
            record.entity_id or "",
            record.description,
            record.status,
            record.result,
            record.source_ip or "",
            record.session_id or "",
            previous_hash or "",
        ]
    )
    return sha256(payload.encode("utf-8")).hexdigest()


def _record_to_dict(record: AuditEventRecord) -> dict[str, Any]:
    data = record.model_dump()
    data.update(
        {
            "actorUsername": record.actor_username,
            "actorRole": record.actor_role,
            "actionType": record.action_type,
            "entityType": record.entity_type,
            "entityId": record.entity_id,
            "sourceIp": record.source_ip,
            "sessionId": record.session_id,
            "previousHash": record.previous_hash,
            "hashChain": record.hash_chain,
        }
    )
    return data


def _audit_event_to_record(db: Session, event: AuditEvent) -> AuditEventRecord:
    actor = _user_for_event(db, event)
    details = _parse_details(event.details)
    timestamp = event.timestamp.isoformat(timespec="seconds")
    return AuditEventRecord(
        id=event.event_ref,
        timestamp=timestamp,
        date=event.timestamp.date().isoformat(),
        actor=actor.username if actor else "unknown",
        actor_username=actor.username if actor else "unknown",
        actor_role=actor.role.value if actor and hasattr(actor.role, "value") else str(actor.role) if actor else "unknown",
        action=event.action,
        action_type=event.action,
        entity_type=event.entity_type,
        entity_id=str(details.get("display_entity_id") or event.entity_id) if (details.get("display_entity_id") or event.entity_id is not None) else None,
        description=str(details.get("description") or ""),
        status=str(details.get("status") or "success"),
        result=str(details.get("result") or details.get("status") or "success"),
        source_ip=details.get("source_ip"),
        session_id=details.get("session_id"),
        previous_hash=event.previous_hash,
        hash_chain=event.hash_chain,
    )


def _event_haystack(item: AuditEventRecord) -> str:
    return " ".join(
        [
            item.id,
            item.timestamp,
            item.date,
            item.actor_username,
            item.actor_role,
            item.action_type,
            item.entity_type or "",
            item.entity_id or "",
            item.description,
            item.status,
            item.result,
            item.source_ip or "",
            item.session_id or "",
            item.hash_chain or "",
            item.previous_hash or "",
        ]
    ).lower()


def _matches_query(item: AuditEventRecord, query: AuditQuery) -> bool:
    text = _event_haystack(item)
    return all(
        [
            not query.date_from or item.date >= query.date_from,
            not query.date_to or item.date <= query.date_to,
            not query.actor or query.actor.lower() in item.actor_username.lower(),
            not query.role or query.role.lower() == item.actor_role.lower(),
            not query.action or query.action.lower() in item.action_type.lower(),
            not query.entity_type or query.entity_type.lower() in (item.entity_type or "").lower(),
            not query.case_id or query.case_id.lower() == (item.entity_id or "").lower(),
            not query.ticket_id or query.ticket_id.lower() == (item.entity_id or "").lower(),
            not query.q or query.q.lower() in text,
        ]
    )


def _filter_events(db: Session, query: AuditQuery) -> list[AuditEventRecord]:
    rows = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc(), AuditEvent.id.desc()).all()
    records = [_audit_event_to_record(db, row) for row in rows]
    filtered = [record for record in records if _matches_query(record, query)]
    return filtered[: query.limit] if query.limit is not None else filtered


def _summary(events: list[AuditEventRecord]) -> dict[str, Any]:
    return {
        "totalEvents": len(events),
        "uniqueActors": len({event.actor_username for event in events}),
        "uniqueActions": len({event.action_type for event in events}),
        "actions": dict(Counter(event.action_type for event in events)),
        "roles": dict(Counter(event.actor_role for event in events)),
        "entityTypes": dict(Counter((event.entity_type or "unknown") for event in events)),
    }


def _query_from_params(**kwargs: Any) -> AuditQuery:
    return AuditQuery(**kwargs)


def _report_payload(events: list[AuditEventRecord], filters: AuditQuery, format_name: str) -> dict[str, Any]:
    return {
        "generatedAt": _utc_now_iso(),
        "format": format_name,
        "filters": filters.model_dump(),
        "summary": _summary(events),
        "events": [_record_to_dict(event) for event in events],
    }


def _html_report(report: dict[str, Any]) -> str:
    rows = []
    for event in report["events"]:
        rows.append(
            "<tr>"
            f"<td>{escape(event['id'])}</td>"
            f"<td>{escape(event['date'])}</td>"
            f"<td>{escape(event['timestamp'])}</td>"
            f"<td>{escape(event['actor_username'])}</td>"
            f"<td>{escape(event['actor_role'])}</td>"
            f"<td>{escape(event['action_type'])}</td>"
            f"<td>{escape(event.get('entity_type') or '-')}</td>"
            f"<td>{escape(str(event.get('entity_id') or '-'))}</td>"
            f"<td>{escape(event['description'])}</td>"
            f"<td>{escape(event['status'])}</td>"
            f"<td>{escape(event.get('source_ip') or '-')}</td>"
            f"<td class='mono'>{escape(event.get('hash_chain') or '-')}</td>"
            "</tr>"
        )
    rows_html = "".join(rows) if rows else '<tr><td colspan="12">No audit events matched the selected filters.</td></tr>'
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SCFCA Audit Report</title>
  <style>
    body {{ margin:0; font-family:Arial,sans-serif; background:#0b0b0a; color:#e8e1d1; }}
    .wrap {{ padding:24px; }}
    table {{ width:100%; border-collapse:collapse; border:1px solid #4a4033; }}
    th,td {{ padding:8px; border-bottom:1px solid #4a4033; text-align:left; vertical-align:top; }}
    th {{ color:#b87935; text-transform:uppercase; font-size:12px; }}
    .mono {{ font-family:ui-monospace,Consolas,monospace; word-break:break-all; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>SCFCA Audit Report</h1>
    <p>Generated: {escape(report['generatedAt'])}</p>
    <p>Total events: {report['summary']['totalEvents']}</p>
    <table>
      <thead><tr><th>Event ID</th><th>Date</th><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Description</th><th>Status</th><th>Source IP</th><th>Hash</th></tr></thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</body>
</html>"""


def record_audit_event(
    *,
    actor: str,
    role: str,
    action: str,
    description: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    status: str = "success",
    result: str | None = None,
    source_ip: str | None = None,
    session_id: str | None = None,
    timestamp: str | None = None,
) -> AuditEventRecord:
    with SessionLocal() as db:
        actor_row = db.query(User).filter(User.username == actor).one_or_none()
        previous = db.query(AuditEvent).order_by(AuditEvent.timestamp.desc(), AuditEvent.id.desc()).first()
        event_ref = _event_ref_next(db)
        ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).replace(tzinfo=None) if timestamp else datetime.utcnow()
        entity_int = int(entity_id) if entity_id and str(entity_id).isdigit() else None
        details = json.dumps(
            {
                "description": description,
                "status": status,
                "result": result or status,
                "source_ip": source_ip,
                "session_id": session_id,
                "display_entity_id": entity_id,
            }
        )
        provisional = AuditEventRecord(
            id=event_ref,
            timestamp=ts.isoformat(timespec="seconds"),
            date=ts.date().isoformat(),
            actor=actor,
            actor_username=actor,
            actor_role=role,
            action=action,
            action_type=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            description=description,
            status=status,
            result=result or status,
            source_ip=source_ip,
            session_id=session_id,
            previous_hash=previous.hash_chain if previous else None,
        )
        event = AuditEvent(
            event_ref=event_ref,
            timestamp=ts,
            actor_id=actor_row.id if actor_row else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_int,
            details=details,
            previous_hash=previous.hash_chain if previous else None,
            hash_chain=_event_hash(provisional, previous.hash_chain if previous else None),
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return _audit_event_to_record(db, event)


@router.get("/events", summary="List audit events", tags=["audit"])
@router.get("/", include_in_schema=False)
def list_audit_events(
    date_from: str | None = None,
    date_to: str | None = None,
    actor: str | None = None,
    role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    case_id: str | None = None,
    ticket_id: str | None = None,
    q: str | None = None,
    limit: int | None = None,
    principal: Principal = Depends(require_any_role([Role.administrator, Role.auditor])),
    db: Session = Depends(get_db),
):
    _ = principal
    query = _query_from_params(date_from=date_from, date_to=date_to, actor=actor, role=role, action=action, entity_type=entity_type, case_id=case_id, ticket_id=ticket_id, q=q, limit=limit)
    events = _filter_events(db, query)
    return {"events": [_record_to_dict(event) for event in events], "summary": _summary(events)}


@router.get("/reports/json", summary="Export audit report as JSON", tags=["audit"])
def export_audit_report_json(
    request: Request,
    date_from: str | None = None,
    date_to: str | None = None,
    actor: str | None = None,
    role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    case_id: str | None = None,
    ticket_id: str | None = None,
    q: str | None = None,
    principal: Principal = Depends(require_role(Role.auditor)),
    db: Session = Depends(get_db),
):
    query = _query_from_params(date_from=date_from, date_to=date_to, actor=actor, role=role, action=action, entity_type=entity_type, case_id=case_id, ticket_id=ticket_id, q=q)
    events = _filter_events(db, query)
    report = _report_payload(events, query, "json")
    record_audit_event(actor=principal.username, role=principal.role.value, action="report_generated", description="Auditor exported the JSON audit report.", entity_type="audit_report", entity_id=None, result="exported", source_ip=_source_ip(request), session_id=_session_identifier(request))
    return Response(content=json.dumps(report, indent=2), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="scfca-audit-report.json"'})


@router.get("/reports/html", summary="Export audit report as HTML", tags=["audit"])
def export_audit_report_html(
    request: Request,
    date_from: str | None = None,
    date_to: str | None = None,
    actor: str | None = None,
    role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    case_id: str | None = None,
    ticket_id: str | None = None,
    q: str | None = None,
    principal: Principal = Depends(require_role(Role.auditor)),
    db: Session = Depends(get_db),
):
    query = _query_from_params(date_from=date_from, date_to=date_to, actor=actor, role=role, action=action, entity_type=entity_type, case_id=case_id, ticket_id=ticket_id, q=q)
    events = _filter_events(db, query)
    report = _report_payload(events, query, "html")
    record_audit_event(actor=principal.username, role=principal.role.value, action="report_generated", description="Auditor exported the HTML audit report.", entity_type="audit_report", entity_id=None, result="exported", source_ip=_source_ip(request), session_id=_session_identifier(request))
    return Response(content=_html_report(report), media_type="text/html", headers={"Content-Disposition": 'attachment; filename="scfca-audit-report.html"'})


@router.post("/hash/verify", summary="Verify document or audit hash", tags=["audit"])
def verify_hash(
    payload: HashVerifyRequest,
    request: Request,
    principal: Principal = Depends(require_role(Role.auditor)),
    db: Session = Depends(get_db),
):
    value = (payload.hash or "").strip()
    if not value:
        return {"found": False}

    document = db.query(Document).filter(Document.hash == value).one_or_none()
    if document:
        case = db.get(Case, document.case_id) if document.case_id else None
        record_audit_event(actor=principal.username, role=principal.role.value, action="hash_verification_performed", description="Auditor verified a document hash.", entity_type="document", entity_id=document.id, result="found", source_ip=_source_ip(request), session_id=_session_identifier(request))
        return {
            "found": True,
            "matchedEntityType": "document",
            "document": {
                "documentId": document.doc_ref,
                "caseId": case.case_id if case else None,
                "filename": document.name,
                "uploadedTimestamp": document.created_at.isoformat(timespec="seconds"),
                "sha256Hash": document.hash,
            },
            "integrityStatus": "matched",
        }

    event = db.query(AuditEvent).filter(or_(AuditEvent.hash_chain == value, AuditEvent.previous_hash == value)).order_by(AuditEvent.timestamp.desc()).first()
    if event:
        record = _audit_event_to_record(db, event)
        record_audit_event(actor=principal.username, role=principal.role.value, action="hash_verification_performed", description="Auditor verified an audit event hash.", entity_type="audit_event", entity_id=event.id, result="found", source_ip=_source_ip(request), session_id=_session_identifier(request))
        return {
            "found": True,
            "matchedEntityType": "audit_event",
            "auditEvent": {
                "eventId": record.id,
                "action": record.action_type,
                "actorUsername": record.actor_username,
                "actorRole": record.actor_role,
                "entityType": record.entity_type,
                "entityId": record.entity_id,
                "timestamp": record.timestamp,
                "hashValue": value,
            },
            "integrityStatus": "matched",
        }

    record_audit_event(actor=principal.username, role=principal.role.value, action="hash_verification_performed", description="Auditor verified a hash that was not found.", entity_type="integrity_hash", entity_id=None, result="not_found", source_ip=_source_ip(request), session_id=_session_identifier(request))
    return {"found": False, "integrityStatus": "not_found"}
