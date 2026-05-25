"""Document endpoints for SCFCA backend (PoC).

Role intent:
- regular: upload/register metadata for assigned cases; view assigned-case metadata
- administrator: view all metadata; can upload/register metadata
- auditor: read-only access to document metadata only, never content download
"""

from __future__ import annotations

from datetime import date, datetime
from hashlib import sha256

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.v1.routes.audit import record_audit_event
from backend.auth.csrf import require_csrf
from backend.auth.dependencies import Principal, get_current_principal, require_any_role
from backend.auth.schemas import Role
from backend.core.database import get_db
from backend.core.models import Case, CaseAssignment, Document
from backend.users.models import User

router = APIRouter()
MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024
DOCUMENT_NOT_FOUND_DETAIL = "Document not found"
DOCUMENT_CONTENT_NOT_AVAILABLE_DETAIL = "Document content not available"
PDF_ONLY_DETAIL = "Only PDF documents are allowed"
JUDGE_FREEZE_ORDER = "Judge freeze order"


class DocumentRecord(BaseModel):
    id: str
    name: str
    docType: str | None = None
    hash: str
    createdAt: str
    caseId: str | None = None
    walletRef: str | None = None
    uploadedBy: str


class DocumentCreate(BaseModel):
    name: str
    docType: str | None = None
    hash: str
    createdAt: str
    caseId: str | None = None
    walletRef: str | None = None
    sizeBytes: int | None = None


# Legacy runtime content cache. Metadata no longer comes from this cache.
# Seeded documents are metadata-only in this phase.
DOCUMENTS: list[DocumentRecord] = []
DOCUMENT_CONTENT: dict[str, bytes] = {}


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _make_demo_pdf_bytes(lines: list[str]) -> bytes:
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body_parts: list[bytes] = []
    offsets: list[int] = [0]

    def add_obj(obj_num: int, content: bytes) -> None:
        offsets.append(len(header) + sum(len(p) for p in body_parts))
        body_parts.append(f"{obj_num} 0 obj\n".encode("ascii") + content + b"\nendobj\n")

    add_obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    add_obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    add_obj(
        3,
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    )

    text_lines = [f"({ _escape_pdf_text(line) }) Tj T*" for line in lines if (line or "").strip()]
    text_stream = "BT\n/F1 12 Tf\n72 740 Td\n14 TL\n" + "\n".join(text_lines) + "\nET\n"
    stream_bytes = text_stream.encode("latin-1")
    add_obj(4, f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii") + stream_bytes + b"endstream")
    add_obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    body = b"".join(body_parts)
    xref_start = len(header) + len(body)
    xref_lines = [b"xref\n", b"0 6\n", b"0000000000 65535 f \n"]
    for off in offsets[1:]:
        xref_lines.append(f"{off:010d} 00000 n \n".encode("ascii"))
    trailer = b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + f"{xref_start}".encode("ascii") + b"\n%%EOF\n"
    return header + body + b"".join(xref_lines) + trailer


def _source_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).one_or_none()


def _get_username(db: Session, user_id: int | None) -> str:
    if user_id is None:
        return "unknown"
    user = db.get(User, user_id)
    return user.username if user else "unknown"


def _get_case_by_external_id(db: Session, case_id: str) -> Case | None:
    return db.query(Case).filter(Case.case_id == case_id).one_or_none()


def _assigned_case_ids(db: Session, username: str) -> set[int]:
    rows = (
        db.query(CaseAssignment.case_id)
        .filter(CaseAssignment.assigned_to_username == username, CaseAssignment.unassigned_at.is_(None))
        .all()
    )
    return {row[0] for row in rows}


def _is_assigned_case(db: Session, username: str, case_row_id: int) -> bool:
    return case_row_id in _assigned_case_ids(db, username)


def _next_doc_ref(db: Session) -> str:
    max_number = 0
    for (doc_ref,) in db.query(Document.doc_ref).all():
        if doc_ref and doc_ref.startswith("DOC-"):
            suffix = doc_ref[4:]
            if suffix.isdigit():
                max_number = max(max_number, int(suffix))
    return f"DOC-{max_number + 1:04d}"


def _parse_created_at(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="createdAt must be ISO formatted") from exc
    return parsed


def _document_doc_type(document: Document) -> str:
    return JUDGE_FREEZE_ORDER if "freeze" in document.name.lower() else "Supporting PDF"


def _document_case_external_id(db: Session, document: Document) -> str | None:
    if document.case_id is None:
        return None
    case = db.get(Case, document.case_id)
    return case.case_id if case else None


def _document_to_record(db: Session, document: Document) -> DocumentRecord:
    return DocumentRecord(
        id=document.doc_ref,
        name=document.name,
        docType=_document_doc_type(document),
        hash=document.hash,
        createdAt=document.created_at.date().isoformat(),
        caseId=_document_case_external_id(db, document),
        walletRef=document.wallet_ref,
        uploadedBy=_get_username(db, document.uploaded_by_id),
    )


def _visible_documents(db: Session, principal: Principal) -> list[Document]:
    query = db.query(Document).order_by(Document.created_at.desc(), Document.id.desc())
    if principal.role == Role.regular:
        case_ids = _assigned_case_ids(db, principal.username)
        if not case_ids:
            return []
        return query.filter(Document.case_id.in_(case_ids)).all()
    return query.all()


def _validate_basic_metadata(payload: DocumentCreate):
    name = (payload.name or "").strip()
    doc_hash = (payload.hash or "").strip()
    created_at = (payload.createdAt or "").strip()
    if not name or not doc_hash or not created_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name, hash, createdAt are required")
    if not name.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PDF_ONLY_DETAIL)
    if payload.sizeBytes is not None:
        if payload.sizeBytes <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sizeBytes must be positive")
        if payload.sizeBytes > MAX_PDF_UPLOAD_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="PDF exceeds upload size limit")
    return name, doc_hash, _parse_created_at(created_at)


def _resolve_document_case(db: Session, principal: Principal, case_id_value: str | None) -> Case:
    case_id = (case_id_value or "").strip().upper()
    if not case_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="caseId is required")
    case = _get_case_by_external_id(db, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if principal.role == Role.regular and not _is_assigned_case(db, principal.username, case.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Case not assigned to user")
    return case


def _create_document_metadata(
    *,
    db: Session,
    principal: Principal,
    name: str,
    doc_hash: str,
    created_at: datetime,
    case: Case,
    wallet_ref: str | None,
    size_bytes: int | None,
) -> Document:
    uploader = _get_user_by_username(db, principal.username)
    document = Document(
        doc_ref=_next_doc_ref(db),
        name=name,
        hash=doc_hash,
        created_at=created_at,
        case_id=case.id,
        wallet_ref=wallet_ref,
        uploaded_by_id=uploader.id if uploader else None,
        size_bytes=size_bytes,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def _record_document_upload_audit(document: Document, principal: Principal, request: Request, case_external_id: str) -> None:
    record_audit_event(
        actor=principal.username,
        role=principal.role.value,
        action="document_uploaded",
        description=f"Registered document {document.name} for case {case_external_id}.",
        entity_type="document",
        entity_id=document.doc_ref,
        source_ip=_source_ip(request),
    )


def _can_view_document_content(db: Session, principal: Principal, document: Document) -> bool:
    if principal.role == Role.auditor:
        return False
    if principal.role == Role.administrator:
        return True
    if principal.role == Role.regular and document.case_id is not None:
        return _is_assigned_case(db, principal.username, document.case_id)
    return False


@router.get("/", summary="List documents", tags=["documents"])
def list_documents(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    documents = _visible_documents(db, principal)
    return {"documents": [_document_to_record(db, document).model_dump() for document in documents]}


@router.post("/", summary="Upload/register document", tags=["documents"])
def upload_document(
    payload: DocumentCreate,
    request: Request,
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.regular, Role.administrator])),
    db: Session = Depends(get_db),
):
    name, doc_hash, created_at = _validate_basic_metadata(payload)
    case = _resolve_document_case(db, principal, payload.caseId)
    wallet_ref = (payload.walletRef or case.wallet_ref or "").strip().upper() or None
    document = _create_document_metadata(
        db=db,
        principal=principal,
        name=name,
        doc_hash=doc_hash,
        created_at=created_at,
        case=case,
        wallet_ref=wallet_ref,
        size_bytes=payload.sizeBytes,
    )
    _record_document_upload_audit(document, principal, request, case.case_id)
    return {"document": _document_to_record(db, document).model_dump()}


@router.post("/upload", summary="Upload a PDF file", tags=["documents"])
async def upload_document_file(
    request: Request,
    case_id: str = Form(..., alias="caseId"),
    wallet_ref: str = Form("", alias="walletRef"),
    file: UploadFile = File(...),
    _: None = Depends(require_csrf),
    principal: Principal = Depends(require_any_role([Role.regular, Role.administrator])),
    db: Session = Depends(get_db),
):
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PDF_ONLY_DETAIL)

    case = _resolve_document_case(db, principal, case_id)
    wallet_value = (wallet_ref or case.wallet_ref or "").strip().upper() or None
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(content) > MAX_PDF_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="PDF exceeds upload size limit")

    digest = sha256(content).hexdigest()
    document = _create_document_metadata(
        db=db,
        principal=principal,
        name=filename,
        doc_hash=f"sha256:{digest}",
        created_at=datetime.combine(date.today(), datetime.min.time()),
        case=case,
        wallet_ref=wallet_value,
        size_bytes=len(content),
    )
    DOCUMENT_CONTENT[document.doc_ref] = content
    _record_document_upload_audit(document, principal, request, case.case_id)
    return {"document": _document_to_record(db, document).model_dump()}


@router.get("/{document_id}/download", summary="Download document content (RBAC)", tags=["documents"])
def download_document(
    document_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    document = db.query(Document).filter(Document.doc_ref == document_id).one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=DOCUMENT_NOT_FOUND_DETAIL)
    if not document.name.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Content download only supported for PDFs")
    if not _can_view_document_content(db, principal, document):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view document contents")

    content = DOCUMENT_CONTENT.get(document.doc_ref)
    if content is None:
        content = _make_demo_pdf_bytes(
            [
                "SCFCA Supporting Document (Metadata-backed PoC)",
                f"Document: {document.name}",
                f"Case: {_document_case_external_id(db, document) or '-'}",
                f"Wallet: {document.wallet_ref or '-'}",
                "",
                "Original binary content is not persisted in this phase.",
            ]
        )

    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{document.name}"'},
    )
