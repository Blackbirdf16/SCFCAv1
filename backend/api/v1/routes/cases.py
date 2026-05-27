"""Case management endpoints for SCFCA backend."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.api.v1.routes.audit import record_audit_event
from backend.auth.dependencies import Principal, get_current_principal
from backend.auth.schemas import Role
from backend.core.database import get_db
from backend.core.models import Asset, Case, CaseAssignment

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
