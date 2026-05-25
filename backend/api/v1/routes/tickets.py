"""Ticket endpoints for SCFCA backend (PoC).

Role intent:
- regular: create tickets for assigned cases; view only assigned-case tickets
- administrator: view all; approve/reject; assign
- auditor: read-only view for traceability
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.v1.routes.audit import record_audit_event
from backend.auth.csrf import require_csrf
from backend.auth.dependencies import Principal, get_current_principal, require_any_role
from backend.auth.schemas import Role
from backend.core.database import get_db
from backend.core.models import Case, CaseAssignment, Ticket, TicketApproval
from backend.users.models import User

router = APIRouter()
TICKET_NOT_FOUND_DETAIL = "Ticket not found"


TicketType = Literal[
    "transfer_request",
    "conversion_request",
    "reassignment_request",
    "administrative_metadata_update",
    "case_creation_request",
    "custody_change",
    "release_request",
]
TicketStatus = Literal["pending_review", "awaiting_second_approval", "approved", "rejected", "open", "in_process", "closed"]
TicketDecision = Literal["approved", "rejected"]


class TicketApprovalEvent(BaseModel):
    stage: Literal[1, 2]
    decision: TicketDecision
    decidedBy: str
    decidedAt: str


class TicketRecord(BaseModel):
    id: str
    caseId: str
    ticketType: TicketType
    description: str
    status: TicketStatus
    linkedDocumentIds: list[str] = []
    approvalHistory: list[TicketApprovalEvent] = []
    createdBy: str
    assignedTo: str | None = None
    proposedCaseId: str | None = None
    assignedHandler: str | None = None


class TicketCreate(BaseModel):
    caseId: str | None = None
    ticketType: TicketType
    description: str
    linkedDocumentIds: list[str] = []
    proposedCaseId: str | None = None
    assignedHandler: str | None = None


class TicketStatusUpdate(BaseModel):
    status: str


class TicketAssignUpdate(BaseModel):
    assignedTo: str


# Legacy in-memory fixture retained for compatibility during phased migration.
# The list/write endpoints below no longer read from or write to this list.
TICKETS: list[TicketRecord] = []

CASE_CREATION_HANDLERS = {
    "alice",
    "mark",
    "john",
    "handler1@scfca.local",
    "handler2@scfca.local",
    "handler3@scfca.local",
}


def _source_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).one_or_none()


def _get_username(db: Session, user_id: int | None, fallback: str | None = None) -> str:
    if user_id is None:
        return fallback or "unknown"
    user = db.get(User, user_id)
    return user.username if user else fallback or "unknown"


def _get_ticket_or_404(db: Session, ticket_ref: str) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.ticket_ref == ticket_ref).one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TICKET_NOT_FOUND_DETAIL)
    return ticket


def _get_case_by_external_id(db: Session, case_id: str) -> Case | None:
    return db.query(Case).filter(Case.case_id == case_id).one_or_none()


def _assigned_case_ids(db: Session, username: str) -> set[str]:
    rows = (
        db.query(Case.case_id)
        .join(CaseAssignment, CaseAssignment.case_id == Case.id)
        .filter(CaseAssignment.assigned_to_username == username, CaseAssignment.unassigned_at.is_(None))
        .all()
    )
    return {row[0] for row in rows}


def _is_assigned_case(db: Session, username: str, case_id: str) -> bool:
    return case_id in _assigned_case_ids(db, username)


def _next_ticket_ref(db: Session) -> str:
    max_number = 0
    for (ticket_ref,) in db.query(Ticket.ticket_ref).all():
        if ticket_ref and ticket_ref.startswith("T-"):
            suffix = ticket_ref[2:]
            if suffix.isdigit():
                max_number = max(max_number, int(suffix))
    return f"T-{max_number + 1:04d}"


def _approval_history(db: Session, ticket: Ticket) -> list[TicketApprovalEvent]:
    approvals = (
        db.query(TicketApproval)
        .filter(TicketApproval.ticket_id == ticket.id)
        .order_by(TicketApproval.decided_at.desc(), TicketApproval.id.desc())
        .all()
    )
    return [
        TicketApprovalEvent(
            stage=approval.stage,
            decision=approval.decision,
            decidedBy=_get_username(db, approval.decided_by_id),
            decidedAt=approval.decided_at.strftime("%Y-%m-%d %H:%M"),
        )
        for approval in approvals
    ]


def _ticket_to_record(db: Session, ticket: Ticket) -> TicketRecord:
    created_by = _get_username(db, ticket.created_by_id)
    assigned_to = _get_username(db, ticket.assigned_to_id, ticket.assigned_handler_username) if ticket.assigned_to_id else ticket.assigned_handler_username
    case_id = ticket.proposed_case_id or ""
    return TicketRecord(
        id=ticket.ticket_ref,
        caseId=case_id,
        ticketType=ticket.ticket_type,
        description=ticket.description or "",
        status=ticket.status,
        linkedDocumentIds=list(ticket.linked_document_ids or []),
        approvalHistory=_approval_history(db, ticket),
        createdBy=created_by,
        assignedTo=assigned_to,
        proposedCaseId=ticket.proposed_case_id,
        assignedHandler=ticket.assigned_handler_username,
    )


def _visible_tickets_query(db: Session, principal: Principal):
    query = db.query(Ticket).order_by(Ticket.created_at.desc(), Ticket.id.desc())
    if principal.role == Role.regular:
        case_ids = _assigned_case_ids(db, principal.username)
        if not case_ids:
            return []
        return query.filter(Ticket.proposed_case_id.in_(case_ids)).all()
    return query.all()


def _create_ticket_row(
    *,
    db: Session,
    principal: Principal,
    ticket_type: str,
    description: str,
    case_id: str,
    linked_document_ids: list[str],
    assigned_handler: str | None = None,
) -> Ticket:
    principal_user = _get_user_by_username(db, principal.username)
    assigned_user = _get_user_by_username(db, assigned_handler) if assigned_handler else None
    ticket = Ticket(
        ticket_ref=_next_ticket_ref(db),
        ticket_type=ticket_type,
        description=description,
        status="pending_review",
        created_by_id=principal_user.id if principal_user else None,
        created_at=datetime.utcnow(),
        proposed_case_id=case_id,
        assigned_handler_username=assigned_handler,
        assigned_to_id=assigned_user.id if assigned_user else None,
        linked_document_ids=linked_document_ids or [],
    )
    db.add(ticket)
    db.flush()
    return ticket


def _append_ticket_event(
    *,
    principal: Principal,
    request: Request,
    action: str,
    description: str,
    entity_id: str,
    status_value: str | None = None,
    result: str | None = None,
) -> None:
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action=action,
        description=description,
        entity_type="ticket",
        entity_id=entity_id,
        status=status_value,
        result=result,
        source_ip=_source_ip(request),
    )


def _handle_case_creation_request(db: Session, payload: TicketCreate, principal: Principal, request: Request, description: str) -> TicketRecord:
    if principal.role != Role.administrator:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can create case creation requests")

    proposed_case_id = (payload.proposedCaseId or "").strip().upper()
    if not proposed_case_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="proposedCaseId is required")

    assigned_handler = (payload.assignedHandler or "").strip()
    if not assigned_handler:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="assignedHandler is required")
    if assigned_handler == principal.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Administrator cannot assign request to self")
    if assigned_handler not in CASE_CREATION_HANDLERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="assignedHandler must be a known regular handler")

    ticket = _create_ticket_row(
        db=db,
        principal=principal,
        ticket_type=payload.ticketType,
        description=description,
        case_id=proposed_case_id,
        linked_document_ids=payload.linkedDocumentIds,
        assigned_handler=assigned_handler,
    )
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="case_creation_request_submitted",
        description=f"Case creation request submitted for {proposed_case_id}.",
        entity_id=ticket.ticket_ref,
        status_value="pending_review",
    )
    return _ticket_to_record(db, ticket)


def _approve_ticket_record(db: Session, ticket_id: str, principal: Principal, request: Request) -> TicketRecord:
    ticket = _get_ticket_or_404(db, ticket_id)
    if ticket.status in {"approved", "rejected", "closed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ticket is already finalized")

    principal_user = _get_user_by_username(db, principal.username)
    approvals = db.query(TicketApproval).filter(TicketApproval.ticket_id == ticket.id, TicketApproval.decision == "approved").all()
    if len(approvals) >= 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ticket already has two approvals")
    if principal_user and any(approval.decided_by_id == principal_user.id for approval in approvals):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Administrator already approved")

    stage: Literal[1, 2] = 1 if len(approvals) == 0 else 2
    ticket.status = "awaiting_second_approval" if stage == 1 else "approved"
    db.add(
        TicketApproval(
            ticket_id=ticket.id,
            stage=stage,
            decision="approved",
            decided_by_id=principal_user.id if principal_user else None,
            decided_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="ticket_approved",
        description=f"Ticket {ticket_id} approved at stage {stage}.",
        entity_id=ticket_id,
        status_value=ticket.status,
        result="approved",
    )
    return _ticket_to_record(db, ticket)


def _reject_ticket_record(db: Session, ticket_id: str, principal: Principal, request: Request) -> TicketRecord:
    ticket = _get_ticket_or_404(db, ticket_id)
    if ticket.status in {"approved", "rejected", "closed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ticket is already finalized")

    principal_user = _get_user_by_username(db, principal.username)
    approvals = db.query(TicketApproval).filter(TicketApproval.ticket_id == ticket.id, TicketApproval.decision == "approved").all()
    stage: Literal[1, 2] = 1 if len(approvals) == 0 else 2
    ticket.status = "rejected"
    db.add(
        TicketApproval(
            ticket_id=ticket.id,
            stage=stage,
            decision="rejected",
            decided_by_id=principal_user.id if principal_user else None,
            decided_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="ticket_rejected",
        description=f"Ticket {ticket_id} rejected at stage {stage}.",
        entity_id=ticket_id,
        status_value="rejected",
        result="rejected",
    )
    return _ticket_to_record(db, ticket)


@router.get("/", summary="List tickets", tags=["tickets"])
def list_tickets(request: Request, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    tickets = _visible_tickets_query(db, principal)
    response = {"tickets": [_ticket_to_record(db, ticket).model_dump() for ticket in tickets]}
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="ticket_viewed",
        description=f"Viewed {len(tickets)} custody tickets.",
        entity_type="ticket_collection",
        entity_id="ticket-list",
        source_ip=_source_ip(request),
    )
    return response


@router.post("/", summary="Create ticket", tags=["tickets"])
def create_ticket(
    payload: TicketCreate,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.regular, Role.administrator])),
    db: Session = Depends(get_db),
):
    ticket_type = payload.ticketType
    description = (payload.description or "").strip()
    if not description:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="description is required")

    if ticket_type == "case_creation_request":
        return {"ticket": _handle_case_creation_request(db, payload, principal, request, description).model_dump()}
    if principal.role == Role.administrator:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrators cannot initiate custody workflow tickets")

    case_id = (payload.caseId or "").strip().upper()
    if not case_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="caseId is required")
    if _get_case_by_external_id(db, case_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if not _is_assigned_case(db, principal.username, case_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Case not assigned to user")

    ticket = _create_ticket_row(
        db=db,
        principal=principal,
        ticket_type=ticket_type,
        description=description,
        case_id=case_id,
        linked_document_ids=payload.linkedDocumentIds,
    )
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="ticket_created",
        description=f"Created {ticket_type} for case {case_id}.",
        entity_id=ticket.ticket_ref,
        status_value="pending_review",
    )
    return {"ticket": _ticket_to_record(db, ticket).model_dump()}


@router.patch("/{ticket_id}/status", summary="Update ticket status", tags=["tickets"])
def update_status(
    ticket_id: str,
    payload: TicketStatusUpdate,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.administrator])),
    db: Session = Depends(get_db),
):
    next_status = (payload.status or "").strip().lower()
    if next_status == "pending":
        next_status = "pending_review"
    if next_status not in {"pending_review", "awaiting_second_approval", "approved", "rejected", "open", "in_process", "closed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    ticket = _get_ticket_or_404(db, ticket_id)
    previous_status = ticket.status
    ticket.status = next_status
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="ticket_status_changed",
        description=f"Ticket {ticket_id} status changed from {previous_status} to {next_status}.",
        entity_id=ticket_id,
        status_value=next_status,
        result="updated",
    )
    return {"ticket": _ticket_to_record(db, ticket).model_dump()}


@router.patch("/{ticket_id}/assign", summary="Assign ticket", tags=["tickets"])
def assign_ticket(
    ticket_id: str,
    payload: TicketAssignUpdate,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.administrator])),
    db: Session = Depends(get_db),
):
    assignee = (payload.assignedTo or "").strip()
    if not assignee:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="assignedTo is required")

    ticket = _get_ticket_or_404(db, ticket_id)
    assigned_user = _get_user_by_username(db, assignee)
    ticket.assigned_handler_username = assignee
    ticket.assigned_to_id = assigned_user.id if assigned_user else None
    db.commit()
    db.refresh(ticket)
    _append_ticket_event(
        principal=principal,
        request=request,
        action="ticket_assignment_updated",
        description=f"Ticket {ticket_id} assigned to {assignee}.",
        entity_id=ticket_id,
        result="updated",
    )
    return {"ticket": _ticket_to_record(db, ticket).model_dump()}


@router.post("/{ticket_id}/approve", summary="Approve ticket (2-step)", tags=["tickets"])
def approve_ticket(
    ticket_id: str,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.administrator])),
    db: Session = Depends(get_db),
):
    return {"ticket": _approve_ticket_record(db, ticket_id, principal, request).model_dump()}


@router.post("/{ticket_id}/reject", summary="Reject ticket", tags=["tickets"])
def reject_ticket(
    ticket_id: str,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.administrator])),
    db: Session = Depends(get_db),
):
    return {"ticket": _reject_ticket_record(db, ticket_id, principal, request).model_dump()}
