"""Case management endpoints for SCFCA backend."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.v1.routes.audit import record_audit_event
from backend.auth.csrf import require_csrf
from backend.auth.dependencies import Principal, get_current_principal
from backend.auth.schemas import Role
from backend.auth.dependencies import require_role
from backend.core.database import get_db
from backend.core.models import Asset, Case, CaseAssignment, User

router = APIRouter()


DEMO_CASES = []
handler_usernames = [
    "handler1@scfca.local",
    "handler2@scfca.local",
    "handler3@scfca.local",
]
asset_symbols = ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "XMR", "ADA", "TRX", "AVAX", "LINK"]
custody_statuses = ["open", "in_review", "closed"]
for i in range(50):
    handler = "alice" if i < 10 else handler_usernames[(i - 10) % len(handler_usernames)]
    case_id = f"SCFCA-CASE-2026-{i+1:04d}"
    wallet_ref = f"WLT-{1000+i:04d}"
    title = f"Seized Asset Case {i+1}"
    custody_status = custody_statuses[i % len(custody_statuses)]
    holdings = []
    for offset in range((i % 3) + 1):
        symbol = asset_symbols[(i + offset) % len(asset_symbols)]
        balance = round(0.5 + ((i + 1) * (offset + 1) * 17.25), 4)
        holdings.append({"symbol": symbol, "balance": balance})
    DEMO_CASES.append({
        "id": case_id,
        "walletRef": wallet_ref,
        "title": title,
        "handler": handler,
        "custodyStatus": custody_status,
        "holdings": holdings,
    })

def _active_assignees(case: Case) -> list[str]:
    return [
        assignment.assigned_to_username
        for assignment in case.assignments
        if assignment.unassigned_at is None
    ]


def _case_to_response(db: Session, case: Case, principal: Principal) -> dict:
    assignees = _active_assignees(case)
    assets = db.query(Asset).filter(Asset.case_id == case.id).order_by(Asset.asset_id.asc()).all()
    handler = principal.username if principal.role == Role.regular else ", ".join(assignees)

    return {
        "id": case.case_id,
        "walletRef": case.wallet_ref,
        "title": case.title or "Custody case",
        "handler": handler or "unassigned",
        "custodyStatus": case.custody_status,
        "createdAt": case.created_at.date().isoformat() if case.created_at else None,
        "holdings": [
            {"symbol": asset.symbol, "balance": float(asset.balance or 0)}
            for asset in assets
        ],
    }


class CaseCreate(BaseModel):
    walletRef: str
    title: str | None = None
    assignedHandler: str | None = None
    caseId: str | None = None


def _normalize_case_id(value: str | None) -> str | None:
    case_id = (value or "").strip().upper()
    return case_id or None


def _normalize_wallet_ref(value: str | None) -> str:
    wallet_ref = (value or "").strip().upper()
    if not wallet_ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="walletRef is required")
    return wallet_ref


def _normalize_title(value: str | None) -> str | None:
    title = (value or "").strip()
    return title or None


def _normalize_handler(value: str | None) -> str | None:
    handler = (value or "").strip()
    return handler or None


def _next_case_external_id(db: Session) -> str:
    year = time.gmtime().tm_year
    prefix = f"SCFCA-CASE-{year}-"
    max_number = 0
    for (case_id,) in db.query(Case.case_id).filter(Case.case_id.like(f"{prefix}%")).all():
        if not case_id:
            continue
        suffix = case_id[len(prefix):]
        if suffix.isdigit():
            max_number = max(max_number, int(suffix))
    return f"{prefix}{max_number + 1:04d}"


@router.post("/", summary="Create a custody case", tags=["cases"], status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_role(Role.administrator)),
    db: Session = Depends(get_db),
):
    """Create a new PostgreSQL-backed custody case.

    Admin-only, CSRF-protected.
    """
    wallet_ref = _normalize_wallet_ref(payload.walletRef)
    title = _normalize_title(payload.title)
    assigned_handler = _normalize_handler(payload.assignedHandler)
    case_external_id = _normalize_case_id(payload.caseId) or _next_case_external_id(db)

    if db.query(Case).filter(Case.case_id == case_external_id).one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="caseId already exists")
    if db.query(Case).filter(Case.wallet_ref == wallet_ref).one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="walletRef already exists")

    creator = db.query(User).filter(User.username == principal.username).one_or_none()

    case = Case(
        case_id=case_external_id,
        wallet_ref=wallet_ref,
        title=title,
        custody_status="open",
        created_by_id=creator.id if creator else None,
    )
    db.add(case)
    db.flush()

    handler_user: User | None = None
    if assigned_handler:
        handler_user = db.query(User).filter(User.username == assigned_handler).one_or_none()
        if handler_user is None or not handler_user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned handler not found or inactive")
        assignment = CaseAssignment(
            case_id=case.id,
            assigned_to_username=handler_user.username,
            assigned_by_id=creator.id if creator else None,
            notes="Initial assignment created at case creation.",
        )
        db.add(assignment)

    db.commit()
    db.refresh(case)

    handler_label = handler_user.username if handler_user else "unassigned"
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="case_created",
        description=f"Created custody case {case_external_id} for walletRef {wallet_ref} assigned to {handler_label}.",
        entity_type="case",
        entity_id=case_external_id,
        source_ip=request.client.host if request and request.client else None,
    )

    return {"case": _case_to_response(db, case, principal)}


@router.get("/", summary="List cases", tags=["cases"])
def list_cases(
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    """List wallet-linked custody cases from PostgreSQL.

    A case represents an institutional custody record linked to a real wallet
    reference. Regular users only receive cases assigned to them. Administrators
    receive all cases. Auditors do not receive case records through this route.
    """
    if principal.role == Role.auditor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditors must use audit/report endpoints")

    query = db.query(Case).order_by(Case.created_at.asc(), Case.case_id.asc())
    if principal.role == Role.regular:
        assigned_case_ids = [
            row[0]
            for row in db.query(CaseAssignment.case_id)
            .filter(
                CaseAssignment.assigned_to_username == principal.username,
                CaseAssignment.unassigned_at.is_(None),
            )
            .all()
        ]
        query = query.filter(Case.id.in_(assigned_case_ids)) if assigned_case_ids else query.filter(False)

    cases = query.all()

    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="case_viewed",
        description=f"Viewed {len(cases)} PostgreSQL-backed custody cases from the case registry.",
        entity_type="case_collection",
        entity_id="case-list",
        source_ip=request.client.host if request and request.client else None,
    )
    return {"cases": [_case_to_response(db, case, principal) for case in cases]}
