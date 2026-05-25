"""SCFCA thesis demo data seeder.

This script seeds a deterministic PostgreSQL dataset for the canonical demo
users and the core custody workflow data. It is safe to rerun: it clears the
seeded demo domain tables and recreates them in a single transaction.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from hashlib import sha256
from typing import Any

from passlib.context import CryptContext

from backend.auth.schemas import Role
from backend.core.database import Base, SessionLocal, engine
from backend.core.models import Asset, AuditEvent, Case, CaseAssignment, Document, FrozenValuationSnapshot, Ticket, TicketApproval
from backend.users.models import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass(frozen=True)
class CaseSeed:
    case_id: str
    owner_username: str
    assigned_usernames: tuple[str, ...]
    title: str
    wallet_ref: str
    created_at: datetime
    custody_status: str
    asset_symbol: str
    ticket_type: str


CANONICAL_USERS: list[tuple[str, str, Role]] = [
    ("alice", "alice123", Role.regular),
    ("bob", "bob123", Role.administrator),
    ("eve", "eve123", Role.administrator),
    ("carol", "carol123", Role.auditor),
    ("mark", "mark123", Role.regular),
    ("john", "john123", Role.regular),
]

CASE_CODENAMES = [
    "GLOBE",
    "MARIPOSA",
    "FALCON-3",
    "NIGHTFALL",
    "EMBER",
    "SUNDIAL",
    "HARBOR",
    "COLDWIRE",
    "IRONCROWN",
    "SABLE",
    "RIVERSTONE",
    "CIPHER",
    "BLACKWELL",
    "VAULTLINE",
    "LANTERN",
    "ORBIT",
    "TIDAL",
    "MOSAIC",
    "PALISADE",
    "NOMAD",
    "SILKROAD",
    "VANTAGE",
    "MERIDIAN",
]

ASSET_FIXTURES = [
    ("BTC", "Bitcoin", "Native", "coin"),
    ("ETH", "Ethereum", "Native", "coin"),
    ("USDT", "Ethereum", "ERC-20", "stablecoin"),
    ("USDC", "Ethereum", "ERC-20", "stablecoin"),
    ("SOL", "Solana", "Native", "coin"),
    ("XMR", "Monero", "Native", "coin"),
    ("ADA", "Cardano", "Native", "coin"),
    ("TRX", "Tron", "Native", "coin"),
    ("AVAX", "Avalanche", "Native", "coin"),
    ("LINK", "Ethereum", "ERC-20", "token"),
    ("MATIC", "Polygon", "Native", "coin"),
    ("DOT", "Polkadot", "Native", "coin"),
    ("LTC", "Litecoin", "Native", "coin"),
    ("BCH", "Bitcoin Cash", "Native", "coin"),
    ("ARB", "Arbitrum", "ERC-20", "token"),
    ("OP", "Optimism", "ERC-20", "token"),
    ("NEAR", "NEAR", "Native", "coin"),
    ("ALGO", "Algorand", "Native", "coin"),
    ("HBAR", "Hedera", "Native", "coin"),
    ("ATOM", "Cosmos", "Native", "coin"),
    ("SUI", "Sui", "Native", "coin"),
    ("APT", "Aptos", "Native", "coin"),
    ("XTZ", "Tezos", "Native", "coin"),
]

TICKET_TYPE_CYCLE = [
    "transfer_request",
    "conversion_request",
    "reassignment_request",
    "administrative_metadata_update",
    "custody_change",
    "release_request",
]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _clear_demo_tables(db) -> None:
    for model in [AuditEvent, TicketApproval, Ticket, Document, FrozenValuationSnapshot, Asset, CaseAssignment, Case]:
        db.query(model).delete(synchronize_session=False)


def _upsert_users(db) -> dict[str, User]:
    users: dict[str, User] = {}
    for username, password, role in CANONICAL_USERS:
        existing = db.query(User).filter(User.username == username).one_or_none()
        if existing is None:
            existing = User(username=username, password_hash=hash_password(password), role=role, is_active=True)
            db.add(existing)
        else:
            existing.password_hash = hash_password(password)
            existing.role = role
            existing.is_active = True
        users[username] = existing

    db.flush()
    return users


def _build_case_specs() -> list[CaseSeed]:
    specs: list[CaseSeed] = []
    base_date = datetime(2026, 3, 1, 9, 0, 0)
    sequence: list[tuple[str, int, tuple[str, ...]]] = [
        ("alice", 10, ("alice",)),
        ("mark", 6, ("mark",)),
        ("john", 4, ("john",)),
    ]

    index = 0
    for owner, count, assigned_usernames in sequence:
        for _ in range(count):
            case_number = index + 1
            specs.append(
                CaseSeed(
                    case_id=f"SCFCA-CASE-2026-{case_number:04d}",
                    owner_username=owner,
                    assigned_usernames=assigned_usernames,
                    title=f"Operation {CASE_CODENAMES[index]}",
                    wallet_ref=f"WLT-{2000 + index:04d}",
                    created_at=base_date + timedelta(days=index * 2),
                    custody_status=("open", "in_review", "closed", "frozen")[index % 4],
                    asset_symbol=ASSET_FIXTURES[index][0],
                    ticket_type=(TICKET_TYPE_CYCLE[index % len(TICKET_TYPE_CYCLE)]),
                )
            )
            index += 1

    specs.append(
        CaseSeed(
            case_id="SCFCA-CASE-2026-0023",
            owner_username="mark",
            assigned_usernames=("mark", "john"),
            title="Operation Meridian Shared Custody Review",
            wallet_ref="WLT-2022",
            created_at=base_date + timedelta(days=index * 2),
            custody_status="in_review",
            asset_symbol=ASSET_FIXTURES[-1][0],
            ticket_type="case_creation_request",
        )
    )
    return specs


def _case_document_name(case_seed: CaseSeed) -> str:
    return f"{case_seed.case_id.lower()}_supporting_packet.pdf"


def _document_content_bytes(case_seed: CaseSeed, asset: Asset, ticket_ref: str) -> bytes:
    text = "\n".join(
        [
            "SCFCA demo document seed",
            f"Case: {case_seed.case_id}",
            f"Title: {case_seed.title}",
            f"Wallet: {case_seed.wallet_ref}",
            f"Asset: {asset.symbol} on {asset.network}",
            f"Ticket: {ticket_ref}",
            f"Owner: {case_seed.owner_username}",
        ]
    )
    return text.encode("utf-8")


def _make_audit_hash(event_fields: list[str], previous_hash: str | None) -> str:
    payload = "|".join(event_fields + [previous_hash or ""])
    return sha256(payload.encode("utf-8")).hexdigest()


def _append_audit_event(
    events: list[AuditEvent],
    *,
    timestamp: datetime,
    actor_id: int | None,
    action: str,
    entity_type: str | None,
    entity_id: int | None,
    details: str,
) -> AuditEvent:
    previous_hash = events[-1].hash_chain if events else None
    event_ref = f"AU-{len(events) + 1:04d}"
    event = AuditEvent(
        event_ref=event_ref,
        timestamp=timestamp,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        previous_hash=previous_hash,
    )
    event.hash_chain = _make_audit_hash(
        [
            event.event_ref,
            event.timestamp.isoformat(),
            str(event.actor_id or ""),
            event.action,
            event.entity_type or "",
            str(event.entity_id or ""),
            event.details or "",
        ],
        previous_hash,
    )
    events.append(event)
    return event


def _seed_core_data(db, users: dict[str, User]) -> dict[str, int]:
    cases = _build_case_specs()

    case_records: list[Case] = []
    for case_seed in cases:
        case = Case(
            case_id=case_seed.case_id,
            wallet_ref=case_seed.wallet_ref,
            title=case_seed.title,
            custody_status=case_seed.custody_status,
            created_at=case_seed.created_at,
            created_by_id=users["bob"].id,
        )
        db.add(case)
        case_records.append(case)

    db.flush()

    case_by_id = {case.case_id: case for case in case_records}
    assets: list[Asset] = []
    snapshots: list[FrozenValuationSnapshot] = []
    documents: list[Document] = []
    tickets: list[Ticket] = []
    approvals: list[TicketApproval] = []
    audit_events: list[AuditEvent] = []

    document_by_case_id: dict[str, Document] = {}
    ticket_by_case_id: dict[str, Ticket] = {}

    # Seed case assignments first so the rest of the dataset can reference them.
    for case_seed in cases:
        case = case_by_id[case_seed.case_id]
        for assignee in case_seed.assigned_usernames:
            db.add(
                CaseAssignment(
                    case_id=case.id,
                    assigned_to_username=assignee,
                    assigned_by_id=users["bob"].id,
                    assigned_at=case.created_at + timedelta(hours=1),
                    notes=f"Seeded assignment for {assignee}",
                )
            )

    db.flush()

    # Seed assets, frozen valuations, and documents.
    for index, case_seed in enumerate(cases):
        case = case_by_id[case_seed.case_id]
        asset_symbol, network, protocol, asset_type = ASSET_FIXTURES[index]
        asset_balance = Decimal(str(round(1.25 + (index * 0.75), 8)))
        asset = Asset(
            asset_id=f"AS-{index + 1:04d}",
            symbol=asset_symbol,
            network=network,
            wallet_ref=case.wallet_ref,
            balance=asset_balance,
            asset_type=asset_type,
            protocol=protocol,
            case_id=case.id,
            status=("active", "pending", "secured")[index % 3],
            registered_at=case.created_at + timedelta(hours=2),
            registered_by_id=users["bob"].id,
        )
        db.add(asset)
        assets.append(asset)
        db.flush()

        valuation = {
            "currency": "USD",
            "caseId": case.case_id,
            "snapshotLabel": f"seed-{index + 1:02d}",
            "assets": [
                {
                    "assetId": asset.asset_id,
                    "symbol": asset.symbol,
                    "balance": str(asset.balance),
                    "network": asset.network,
                    "estimatedUsd": float(asset.balance) * (25000.0 if asset.symbol == "BTC" else 1800.0 if asset.symbol == "ETH" else 1.5 if asset.symbol in {"USDT", "USDC"} else 35.0 + index),
                }
            ],
            "totalUsd": float(asset.balance) * (25000.0 if asset.symbol == "BTC" else 1800.0 if asset.symbol == "ETH" else 1.5 if asset.symbol in {"USDT", "USDC"} else 35.0 + index),
            "frozenReason": "court_order",
        }
        snapshots.append(
            FrozenValuationSnapshot(
                case_id=case.id,
                snapshot_time=case.created_at + timedelta(hours=3),
                valuation=valuation,
                created_by_id=users["bob"].id,
            )
        )

        document_payload = _document_content_bytes(case_seed, asset, f"T-{index + 1:04d}")
        document_hash = sha256(document_payload).hexdigest()
        uploader_username = case_seed.owner_username if case_seed.owner_username in {"alice", "mark", "john"} else "bob"
        uploader_id = users[uploader_username].id
        document = Document(
            doc_ref=f"DOC-{index + 1:04d}",
            name=_case_document_name(case_seed),
            hash=f"sha256:{document_hash}",
            created_at=case.created_at + timedelta(hours=4),
            case_id=case.id,
            wallet_ref=case.wallet_ref,
            uploaded_by_id=uploader_id,
            size_bytes=len(document_payload),
        )
        db.add(document)
        documents.append(document)
        db.flush()
        document_by_case_id[case.case_id] = document

    db.flush()

    # Seed tickets and approvals/rejections.
    for index, case_seed in enumerate(cases):
        case = case_by_id[case_seed.case_id]
        document = document_by_case_id[case_seed.case_id]
        created_by_username = case_seed.owner_username if case_seed.ticket_type != "case_creation_request" else "bob"
        if case_seed.ticket_type == "case_creation_request":
            created_by_username = "bob"
        created_by_id = users[created_by_username].id

        assigned_to_username = "bob" if case_seed.ticket_type == "case_creation_request" else case_seed.owner_username
        assigned_to_id = users[assigned_to_username].id
        if case_seed.assigned_usernames == ("mark", "john"):
            assigned_to_username = "bob"
            assigned_to_id = users["bob"].id

        ticket_status = ["approved", "rejected", "awaiting_second_approval", "pending_review"][index % 4]
        ticket = Ticket(
            ticket_ref=f"T-{index + 1:04d}",
            ticket_type=case_seed.ticket_type,
            description=f"{case_seed.ticket_type.replace('_', ' ').title()} for {case_seed.case_id}.",
            status=ticket_status,
            created_by_id=created_by_id,
            created_at=case.created_at + timedelta(hours=5),
            proposed_case_id=case.case_id,
            assigned_handler_username=assigned_to_username,
            assigned_to_id=assigned_to_id,
            linked_document_ids=[document.doc_ref],
        )
        db.add(ticket)
        tickets.append(ticket)
        db.flush()
        ticket_by_case_id[case.case_id] = ticket

        if ticket_status == "approved":
            approval = TicketApproval(
                    ticket_id=ticket.id,
                    stage=1,
                    decision="approved",
                    decided_by_id=users["bob"].id,
                    decided_at=case.created_at + timedelta(hours=6),
                )
            approvals.append(approval)
            db.add(approval)
            approval = TicketApproval(
                    ticket_id=ticket.id,
                    stage=2,
                    decision="approved",
                    decided_by_id=users["eve"].id,
                    decided_at=case.created_at + timedelta(hours=7),
                )
            approvals.append(approval)
            db.add(approval)
        elif ticket_status == "rejected":
            rejector = users["eve"] if index % 2 == 0 else users["bob"]
            approval = TicketApproval(
                    ticket_id=ticket.id,
                    stage=1,
                    decision="rejected",
                    decided_by_id=rejector.id,
                    decided_at=case.created_at + timedelta(hours=6),
                )
            approvals.append(approval)
            db.add(approval)
        elif ticket_status == "awaiting_second_approval":
            approval = TicketApproval(
                    ticket_id=ticket.id,
                    stage=1,
                    decision="approved",
                    decided_by_id=users["bob"].id,
                    decided_at=case.created_at + timedelta(hours=6),
                )
            approvals.append(approval)
            db.add(approval)

    db.add_all(snapshots)
    db.flush()

    db.flush()

    # Seed audit events in chronological order.
    _append_audit_event(
        audit_events,
        timestamp=datetime(2026, 2, 27, 8, 30, 0),
        actor_id=users["bob"].id,
        action="login_event",
        entity_type="user",
        entity_id=users["bob"].id,
        details="Administrator bob authenticated into the SCFCA control panel.",
    )
    _append_audit_event(
        audit_events,
        timestamp=datetime(2026, 2, 27, 8, 35, 0),
        actor_id=users["alice"].id,
        action="login_event",
        entity_type="user",
        entity_id=users["alice"].id,
        details="Case handler alice authenticated into the SCFCA control panel.",
    )

    for index, case_seed in enumerate(cases):
        case = case_by_id[case_seed.case_id]
        document = document_by_case_id[case_seed.case_id]
        ticket = ticket_by_case_id[case_seed.case_id]

        _append_audit_event(
            audit_events,
            timestamp=case.created_at,
            actor_id=users["bob"].id,
            action="case_created",
            entity_type="case",
            entity_id=case.id,
            details=f"Seeded custody case {case.case_id} for {case_seed.owner_username}.",
        )

        _append_audit_event(
            audit_events,
            timestamp=case.created_at + timedelta(hours=1),
            actor_id=users[case_seed.owner_username].id,
            action="case_viewed",
            entity_type="case",
            entity_id=case.id,
            details=f"{case_seed.owner_username} viewed assigned case {case.case_id}.",
        )

        if case_seed.case_id == "SCFCA-CASE-2026-0023":
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=1, minutes=15),
                actor_id=users["john"].id,
                action="case_viewed",
                entity_type="case",
                entity_id=case.id,
                details="john viewed the shared case assigned to both mark and john.",
            )

        _append_audit_event(
            audit_events,
            timestamp=case.created_at + timedelta(hours=2),
            actor_id=users[case_seed.owner_username].id,
            action="document_uploaded",
            entity_type="document",
            entity_id=document.id,
            details=f"Metadata registered for {document.name}.",
        )

        _append_audit_event(
            audit_events,
            timestamp=case.created_at + timedelta(hours=3),
            actor_id=users[case_seed.owner_username].id,
            action="ticket_created",
            entity_type="ticket",
            entity_id=ticket.id,
            details=f"Ticket {ticket.ticket_ref} created for case {case.case_id}.",
        )

        if ticket.status == "approved":
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=4),
                actor_id=users["bob"].id,
                action="ticket_approved",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Stage 1 approval recorded for ticket {ticket.ticket_ref}.",
            )
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=5),
                actor_id=users["eve"].id,
                action="ticket_approved",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Stage 2 approval recorded for ticket {ticket.ticket_ref}.",
            )
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=6),
                actor_id=users[case_seed.owner_username].id,
                action="ticket_status_changed",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Ticket {ticket.ticket_ref} transitioned to approved.",
            )
        elif ticket.status == "rejected":
            rejector = "eve" if index % 2 == 0 else "bob"
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=4),
                actor_id=users[rejector].id,
                action="ticket_rejected",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Ticket {ticket.ticket_ref} rejected by {rejector}.",
            )
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=5),
                actor_id=users[case_seed.owner_username].id,
                action="ticket_status_changed",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Ticket {ticket.ticket_ref} transitioned to rejected.",
            )
        elif ticket.status == "awaiting_second_approval":
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=4),
                actor_id=users["bob"].id,
                action="ticket_approved",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Stage 1 approval recorded for ticket {ticket.ticket_ref}; awaiting second approval.",
            )
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=5),
                actor_id=users["bob"].id,
                action="ticket_status_changed",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Ticket {ticket.ticket_ref} remains awaiting second approval.",
            )
        else:
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(hours=4),
                actor_id=users["bob"].id,
                action="ticket_status_changed",
                entity_type="ticket",
                entity_id=ticket.id,
                details=f"Ticket {ticket.ticket_ref} remains pending review.",
            )

        _append_audit_event(
            audit_events,
            timestamp=case.created_at + timedelta(hours=7),
            actor_id=users[case_seed.owner_username].id,
            action="frozen_valuation_snapshot_created",
            entity_type="frozen_valuation_snapshot",
            entity_id=case.id,
            details=f"Frozen valuation snapshot recorded for case {case.case_id}.",
        )

        if (index + 1) % 5 == 0:
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(days=1, hours=1),
                actor_id=users["carol"].id,
                action="report_generated",
                entity_type="audit_report",
                entity_id=case.id,
                details=f"Auditor exported a report covering cases through {case.case_id}.",
            )

        if (index + 1) % 6 == 0:
            _append_audit_event(
                audit_events,
                timestamp=case.created_at + timedelta(days=1, hours=2),
                actor_id=users["bob"].id,
                action="administrative_action",
                entity_type="administrative_action",
                entity_id=case.id,
                details=f"Administrative review completed for case {case.case_id}.",
            )

    _append_audit_event(
        audit_events,
        timestamp=datetime(2026, 5, 20, 18, 0, 0),
        actor_id=users["carol"].id,
        action="report_generated",
        entity_type="audit_report",
        entity_id=None,
        details="Auditor exported the final JSON audit evidence pack.",
    )
    _append_audit_event(
        audit_events,
        timestamp=datetime(2026, 5, 20, 18, 15, 0),
        actor_id=users["carol"].id,
        action="logout_event",
        entity_type="user",
        entity_id=users["carol"].id,
        details="Auditor logged out after exporting the evidence pack.",
    )
    _append_audit_event(
        audit_events,
        timestamp=datetime(2026, 5, 20, 18, 30, 0),
        actor_id=users["bob"].id,
        action="logout_event",
        entity_type="user",
        entity_id=users["bob"].id,
        details="Administrator bob logged out after review duties.",
    )

    for event in audit_events:
        db.add(event)

    db.flush()

    return {
        "users": len(users),
        "cases": len(case_records),
        "assets": len(assets),
        "snapshots": len(snapshots),
        "documents": len(documents),
        "tickets": len(tickets),
        "approvals": len(approvals),
        "audit_events": len(audit_events),
    }


def seed_demo_data() -> dict[str, Any]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _clear_demo_tables(db)
        users = _upsert_users(db)
        summary = _seed_core_data(db, users)
        db.commit()
        return summary
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _print_summary(summary: dict[str, Any]) -> None:
    case_counts = {
        "alice": 10,
        "mark": 7,
        "john": 5,
    }
    print("Demo database seeded successfully.")
    print(f"Users seeded: {summary['users']}")
    print(
        "Cases seeded per user: "
        + ", ".join(f"{username}={count}" for username, count in case_counts.items())
    )
    print("Shared cases created: 1 (mark and john)")
    print(f"Assets seeded: {summary['assets']}")
    print(f"Documents seeded: {summary['documents']}")
    print(f"Tickets seeded: {summary['tickets']}")
    print(f"Audit events seeded: {summary['audit_events']}")


if __name__ == "__main__":
    _print_summary(seed_demo_data())
