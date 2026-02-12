"""Documents API - unified filing, storage, archiving, viewing."""
import uuid
import hashlib
import logging
from pathlib import Path
from datetime import datetime, date, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, String

from core.database import get_db
from core.deps import require_staff
from models.user import User
from models.document import Document, DocumentCategory, DocumentStatus
from models.contact import Contact
from models.project import Task, Project
from models.notification import Notification
from schemas.document import (
    DocumentResponse, DocumentUpdate, DocumentCategoryResponse, DocumentCategoryCreate,
    DocumentTypeItem,
    BulkArchiveRequest, BulkTagRequest, BulkMoveRequest, BulkOperationResponse,
    RetentionReportItem,
)
from constants.document_types import SYSTEM_DOCUMENT_CATEGORIES, DOCUMENT_TYPE_SLUGS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


def _doc_response(d: Document) -> DocumentResponse:
    return DocumentResponse(
        id=d.id, org_id=d.org_id, contact_id=d.contact_id, task_id=d.task_id,
        project_id=d.project_id, purpose=d.purpose,
        category=d.category, folder=d.folder, tags=d.tags, description=d.description,
        file_name=d.file_name, file_path=d.file_path, file_size=d.file_size,
        mime_type=d.mime_type, checksum=d.checksum, status=d.status,
        archived_at=d.archived_at,
        retention_until=d.retention_until, uploaded_by=d.uploaded_by,
        created_at=d.created_at, updated_at=d.updated_at,
    )


def _audit_log(db: Session, org_id: str, user_id: str, action: str, doc: Document):
    """Create an audit notification for document actions."""
    title = f"Document {action}: {doc.file_name}"
    n = Notification(
        org_id=org_id,
        user_id=user_id,
        title=title,
        message=f"User {user_id} performed '{action}' on document '{doc.file_name}' (id={doc.id}, category={doc.category}).",
        category="audit",
        resource_type="document",
        resource_id=doc.id,
    )
    db.add(n)
    logger.info(f"Document audit: {action} on {doc.id} by {user_id}")


def _allowed_category_slugs(db: Session, org_id: str) -> set:
    """Return set of category slugs valid for this org: system types + org's document_categories."""
    allowed = set(DOCUMENT_TYPE_SLUGS)
    org_cats = db.query(DocumentCategory.slug).filter(
        DocumentCategory.org_id == org_id,
    ).all()
    for (slug,) in org_cats:
        allowed.add(slug)
    return allowed


@router.get("/document-types/", response_model=list[DocumentTypeItem])
def list_document_types(
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Return merged document types: system list + org custom categories. Use for dropdowns (slug=value, name=label)."""
    result: List[DocumentTypeItem] = []
    # System types first (no id)
    for t in SYSTEM_DOCUMENT_CATEGORIES:
        result.append(DocumentTypeItem(slug=t["slug"], name=t["name"], id=None))
    if not current_user.org_id:
        return result
    # Then org-specific custom categories (slug not already in system)
    system_slugs = set(DOCUMENT_TYPE_SLUGS)
    org_cats = db.query(DocumentCategory).filter(
        DocumentCategory.org_id == current_user.org_id,
    ).order_by(DocumentCategory.name).all()
    for c in org_cats:
        if c.slug not in system_slugs:
            result.append(DocumentTypeItem(slug=c.slug, name=c.name, id=c.id))
    return result


@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    contact_id: str | None = None,
    task_id: str | None = None,
    project_id: str | None = None,
    category: str | None = None,
    status: str | None = None,
    folder: str | None = None,
    retention_expired: bool = False,
    search: str | None = None,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List documents with filters."""
    if not current_user.org_id:
        return []
    q = db.query(Document).filter(Document.org_id == current_user.org_id)
    if contact_id:
        q = q.filter(Document.contact_id == contact_id)
    if task_id:
        q = q.filter(Document.task_id == task_id)
    if project_id:
        q = q.filter(Document.project_id == project_id)
    if category:
        q = q.filter(Document.category == category)
    if status:
        q = q.filter(Document.status == status)
    if folder:
        q = q.filter(Document.folder == folder)
    if retention_expired:
        today = date.today()
        q = q.filter(
            Document.retention_until.isnot(None),
            Document.retention_until <= today,
            Document.status == DocumentStatus.ACTIVE,
        )
    if search:
        q = q.filter(
            or_(
                Document.file_name.ilike(f"%{search}%"),
                Document.description.ilike(f"%{search}%"),
                Document.category.ilike(f"%{search}%"),
                Document.tags.cast(String).ilike(f"%{search}%"),
            )
        )
    docs = q.order_by(Document.created_at.desc()).all()
    return [_doc_response(d) for d in docs]


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    contact_id: str | None = Form(None),
    task_id: str | None = Form(None),
    project_id: str | None = Form(None),
    purpose: str | None = Form(None),
    category: str = Form("other"),
    folder: str | None = Form(None),
    description: str | None = Form(None),
    retention_until: str | None = Form(None),
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Upload a document."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    if not contact_id and not task_id and not project_id:
        raise HTTPException(status_code=400, detail="Provide contact_id, task_id, or project_id")

    if contact_id:
        c = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.org_id == current_user.org_id,
        ).first()
        if not c:
            raise HTTPException(status_code=404, detail="Contact not found")
    if task_id:
        t = db.query(Task).filter(
            Task.id == task_id,
            Task.org_id == current_user.org_id,
        ).first()
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")
    if project_id:
        p = db.query(Project).filter(
            Project.id == project_id,
            Project.org_id == current_user.org_id,
        ).first()
        if not p:
            raise HTTPException(status_code=404, detail="Project not found")

    allowed = _allowed_category_slugs(db, current_user.org_id)
    if category not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Must be a system type or an org document category slug.",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    org_dir = UPLOAD_DIR / str(current_user.org_id)
    docs_dir = org_dir / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "file").suffix
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = docs_dir / safe_name

    contents = await file.read()
    file_path.write_bytes(contents)

    rel_path = f"{current_user.org_id}/documents/{safe_name}"
    file_size = len(contents)
    mime_type = file.content_type or "application/octet-stream"
    checksum = hashlib.sha256(contents).hexdigest()

    parsed_retention = None
    if retention_until:
        try:
            parsed_retention = date.fromisoformat(retention_until)
        except ValueError:
            pass

    doc = Document(
        org_id=current_user.org_id,
        contact_id=contact_id,
        task_id=task_id,
        project_id=project_id,
        purpose=purpose or None,
        category=category,
        folder=folder or None,
        description=description or None,
        file_name=file.filename or "document",
        file_path=rel_path,
        file_size=file_size,
        mime_type=mime_type,
        checksum=checksum,
        status=DocumentStatus.ACTIVE,
        uploaded_by=current_user.id,
        retention_until=parsed_retention,
    )
    db.add(doc)
    _audit_log(db, current_user.org_id, current_user.id, "upload", doc)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get document metadata."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _audit_log(db, current_user.org_id, current_user.id, "view", doc)
    db.commit()
    return _doc_response(doc)


@router.get("/{doc_id}/download")
def download_document(
    doc_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Download document file."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    full_path = UPLOAD_DIR / doc.file_path
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    _audit_log(db, current_user.org_id, current_user.id, "download", doc)
    db.commit()
    return FileResponse(full_path, filename=doc.file_name)


@router.get("/{doc_id}/preview")
def preview_document(
    doc_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get preview URL - returns download URL for now; frontend can embed PDF/images."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    previewable = doc.mime_type and (
        doc.mime_type.startswith("image/") or doc.mime_type == "application/pdf"
    )
    if not previewable:
        raise HTTPException(status_code=400, detail="Preview not supported for this file type")
    full_path = UPLOAD_DIR / doc.file_path
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    _audit_log(db, current_user.org_id, current_user.id, "preview", doc)
    db.commit()
    return FileResponse(full_path, filename=doc.file_name, media_type=doc.mime_type)


@router.patch("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: str,
    body: DocumentUpdate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update document metadata."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    updates = body.model_dump(exclude_unset=True)
    if "category" in updates:
        allowed = _allowed_category_slugs(db, current_user.org_id)
        if updates["category"] not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category '{updates['category']}'. Must be a system type or an org document category slug.",
            )
    for k, v in updates.items():
        setattr(doc, k, v)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.post("/{doc_id}/archive", response_model=DocumentResponse)
def archive_document(
    doc_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Archive a document."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = DocumentStatus.ARCHIVED
    doc.archived_at = datetime.now(timezone.utc)
    _audit_log(db, current_user.org_id, current_user.id, "archive", doc)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.post("/{doc_id}/restore", response_model=DocumentResponse)
def restore_document(
    doc_id: str,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Restore an archived document."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = DocumentStatus.ACTIVE
    doc.archived_at = None
    _audit_log(db, current_user.org_id, current_user.id, "restore", doc)
    db.commit()
    db.refresh(doc)
    return _doc_response(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: str,
    purge: bool = False,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Delete document (soft) or purge (hard delete from storage)."""
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.org_id == current_user.org_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _audit_log(db, current_user.org_id, current_user.id, "purge" if purge else "delete", doc)
    if purge:
        full_path = UPLOAD_DIR / doc.file_path
        if full_path.is_file():
            full_path.unlink()
    db.delete(doc)
    db.commit()
    return None


# Document categories
@router.get("/categories/", response_model=list[DocumentCategoryResponse])
def list_categories(
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List document categories for org."""
    if not current_user.org_id:
        return []
    cats = db.query(DocumentCategory).filter(
        DocumentCategory.org_id == current_user.org_id,
    ).order_by(DocumentCategory.name).all()
    return [DocumentCategoryResponse(
        id=c.id, org_id=c.org_id, name=c.name, slug=c.slug,
        parent_id=c.parent_id, is_system=c.is_system,
    ) for c in cats]


@router.post("/categories/", response_model=DocumentCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    body: DocumentCategoryCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Create a document category."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    slug = body.slug or body.name.lower().replace(" ", "_").replace("-", "_")
    cat = DocumentCategory(
        org_id=current_user.org_id,
        name=body.name,
        slug=slug,
        parent_id=body.parent_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return DocumentCategoryResponse(
        id=cat.id, org_id=cat.org_id, name=cat.name, slug=cat.slug,
        parent_id=cat.parent_id, is_system=cat.is_system,
    )


# ----- Bulk operations -----
@router.post("/bulk-archive", response_model=BulkOperationResponse)
def bulk_archive(
    body: BulkArchiveRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Archive multiple documents at once."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    now = datetime.now(timezone.utc)
    count = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.id.in_(body.document_ids),
        )
        .update(
            {Document.status: DocumentStatus.ARCHIVED, Document.archived_at: now},
            synchronize_session=False,
        )
    )
    db.commit()
    return BulkOperationResponse(updated_count=count)


@router.post("/bulk-tag", response_model=BulkOperationResponse)
def bulk_tag(
    body: BulkTagRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Add tags to multiple documents (merges with existing tags)."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    docs = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.id.in_(body.document_ids),
        )
        .all()
    )
    for d in docs:
        existing = list(d.tags) if d.tags else []
        merged = list(dict.fromkeys(existing + body.tags))
        d.tags = merged
    db.commit()
    return BulkOperationResponse(updated_count=len(docs))


@router.post("/bulk-move", response_model=BulkOperationResponse)
def bulk_move(
    body: BulkMoveRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Move multiple documents to a folder."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    count = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.id.in_(body.document_ids),
        )
        .update(
            {Document.folder: body.folder},
            synchronize_session=False,
        )
    )
    db.commit()
    return BulkOperationResponse(updated_count=count)


@router.post("/bulk-restore", response_model=BulkOperationResponse)
def bulk_restore(
    body: BulkArchiveRequest,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Restore multiple archived documents."""
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    count = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.id.in_(body.document_ids),
        )
        .update(
            {Document.status: DocumentStatus.ACTIVE, Document.archived_at: None},
            synchronize_session=False,
        )
    )
    db.commit()
    return BulkOperationResponse(updated_count=count)


# ----- Retention report -----
@router.get("/retention-report", response_model=list[RetentionReportItem])
def retention_report(
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get documents past their retention date that are still active."""
    if not current_user.org_id:
        return []
    today = date.today()
    docs = (
        db.query(Document)
        .filter(
            Document.org_id == current_user.org_id,
            Document.status == DocumentStatus.ACTIVE,
            Document.retention_until.isnot(None),
            Document.retention_until <= today,
        )
        .order_by(Document.retention_until.asc())
        .all()
    )
    return [
        RetentionReportItem(
            id=d.id, file_name=d.file_name, category=d.category,
            retention_until=d.retention_until,
            days_overdue=(today - d.retention_until).days,
            contact_id=d.contact_id, task_id=d.task_id, project_id=d.project_id,
        )
        for d in docs
    ]
