"""Online library. Teachers upload -> librarian/admin approves -> students read and download."""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.deps import current_user, require_roles
from app.models import ClassGroup, LibraryFavourite, LibraryItem, Student, Subject, User
from app.notifications import notify, users_with_role

router = APIRouter(prefix="/library", tags=["library"])
KINDS = {"textbook", "notes", "past_paper", "marking_scheme", "other"}
ALLOWED = {".pdf": "application/pdf", ".doc": "application/msword",
           ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
           ".ppt": "application/vnd.ms-powerpoint",
           ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
           ".xls": "application/vnd.ms-excel",
           ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
           ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
MAGIC = {".pdf": b"%PDF", ".png": b"\x89PNG", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff",
         ".docx": b"PK", ".pptx": b"PK", ".xlsx": b"PK", ".doc": b"\xd0\xcf\x11\xe0",
         ".ppt": b"\xd0\xcf\x11\xe0", ".xls": b"\xd0\xcf\x11\xe0"}
uploaders = require_roles("teacher", "librarian", "admin")
reviewers = require_roles("librarian", "admin")


def _dir() -> Path:
    p = Path(settings.UPLOAD_DIR) / "library"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _out(i: LibraryItem, subjects: dict, fav: set, uploaders_: dict) -> dict:
    return {"id": i.id, "title": i.title, "description": i.description, "kind": i.kind, "form": i.form,
            "subject": subjects.get(i.subject_id), "exam_year": i.exam_year, "session": i.session,
            "paper_no": i.paper_no, "file_name": i.original_name, "mime": i.mime, "size_bytes": i.size_bytes,
            "status": i.status, "views": i.views, "downloads": i.downloads, "favourite": i.id in fav,
            "uploaded_by": uploaders_.get(i.uploaded_by), "reject_reason": i.reject_reason,
            "created_at": i.created_at}


def _shape(db: Session, items: list[LibraryItem], user: User) -> list[dict]:
    subjects = {s.id: s.name for s in db.scalars(select(Subject))}
    fav = set(db.scalars(select(LibraryFavourite.item_id).where(LibraryFavourite.user_id == user.id)))
    names = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_({i.uploaded_by for i in items})))} if items else {}
    return [_out(i, subjects, fav, names) for i in items]


def _student_form(db: Session, user: User) -> int | None:
    if user.role != "student":
        return None
    row = db.execute(select(ClassGroup.form).join(Student, Student.class_id == ClassGroup.id)
                     .where(Student.user_id == user.id)).first()
    return row[0] if row else None


@router.post("", status_code=201)
async def upload(title: str = Form(..., min_length=2, max_length=255), kind: str = Form(...),
                 form: int = Form(0, ge=0, le=6), subject_id: uuid.UUID | None = Form(None),
                 description: str | None = Form(None), exam_year: int | None = Form(None, ge=1990, le=2100),
                 session: str | None = Form(None), paper_no: str | None = Form(None),
                 file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(uploaders)):
    if kind not in KINDS:
        raise HTTPException(422, "Choose a valid material type.")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(422, "This file type is not allowed. Use PDF, Word, PowerPoint, Excel or an image.")
    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File is too large (maximum {settings.MAX_UPLOAD_MB} MB).")
    if not data.startswith(MAGIC[ext]):
        raise HTTPException(422, "The file content does not match its type.")
    name = f"{uuid.uuid4().hex}{ext}"
    (_dir() / name).write_bytes(data)
    auto = user.role in ("librarian", "admin")
    item = LibraryItem(title=title.strip(), description=description, kind=kind, subject_id=subject_id, form=form,
                       exam_year=exam_year, session=session, paper_no=paper_no, file_path=name,
                       original_name=Path(file.filename).name, mime=ALLOWED[ext], size_bytes=len(data),
                       uploaded_by=user.id, status="approved" if auto else "pending",
                       reviewed_by=user.id if auto else None, reviewed_at=datetime.now(timezone.utc) if auto else None)
    db.add(item)
    if not auto:
        notify(db, users_with_role(db, "librarian"), "New upload awaiting approval", item.title, "/library?tab=review")
    db.commit()
    return _shape(db, [item], user)[0]


@router.get("")
def browse(q: str | None = None, kind: str | None = None, subject_id: uuid.UUID | None = None,
           form: int | None = None, exam_year: int | None = None, favourites: bool = False,
           sort: str = "new", limit: int = 60, offset: int = 0,
           db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = select(LibraryItem).where(LibraryItem.status == "approved")
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(LibraryItem.title.ilike(like), LibraryItem.description.ilike(like)))
    if kind:
        stmt = stmt.where(LibraryItem.kind == kind)
    if subject_id:
        stmt = stmt.where(LibraryItem.subject_id == subject_id)
    if form is not None:
        stmt = stmt.where(LibraryItem.form.in_([0, form]))
    if exam_year:
        stmt = stmt.where(LibraryItem.exam_year == exam_year)
    if favourites:
        stmt = stmt.where(LibraryItem.id.in_(select(LibraryFavourite.item_id).where(LibraryFavourite.user_id == user.id)))
    order = {"popular": LibraryItem.views.desc(), "title": LibraryItem.title}.get(sort, LibraryItem.created_at.desc())
    items = db.scalars(stmt.order_by(order).limit(min(limit, 100)).offset(offset)).all()
    sf = _student_form(db, user)
    if sf is not None:  # a student's own form first
        items.sort(key=lambda i: 0 if i.form in (0, sf) else 1)
    return _shape(db, list(items), user)


@router.get("/mine")
def mine(db: Session = Depends(get_db), user: User = Depends(uploaders)):
    items = db.scalars(select(LibraryItem).where(LibraryItem.uploaded_by == user.id, LibraryItem.status != "removed")
                       .order_by(LibraryItem.created_at.desc())).all()
    return _shape(db, list(items), user)


@router.get("/pending")
def pending(db: Session = Depends(get_db), user: User = Depends(reviewers)):
    items = db.scalars(select(LibraryItem).where(LibraryItem.status == "pending").order_by(LibraryItem.created_at)).all()
    return _shape(db, list(items), user)


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(uploaders)):
    count = lambda st: db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == st))
    top = db.scalars(select(LibraryItem).where(LibraryItem.status == "approved").order_by(LibraryItem.views.desc()).limit(5)).all()
    return {"approved": count("approved"), "pending": count("pending"),
            "top": [{"id": i.id, "title": i.title, "views": i.views, "downloads": i.downloads} for i in top]}


class Review(BaseModel):
    approve: bool
    reason: str | None = None


@router.post("/{item_id}/review")
def review(item_id: uuid.UUID, body: Review, db: Session = Depends(get_db), user: User = Depends(reviewers)):
    i = db.get(LibraryItem, item_id)
    if not i or i.status != "pending":
        raise HTTPException(404, "This upload is not waiting for review.")
    if not body.approve and not (body.reason or "").strip():
        raise HTTPException(422, "Please give the teacher a reason for rejecting.")
    i.status = "approved" if body.approve else "rejected"
    i.reject_reason = None if body.approve else body.reason.strip()
    i.reviewed_by, i.reviewed_at = user.id, datetime.now(timezone.utc)
    notify(db, [i.uploaded_by], "Upload approved" if body.approve else "Upload not approved",
           i.title if body.approve else f"{i.title}: {i.reject_reason}", "/library?tab=mine")
    db.commit()
    return {"status": i.status}


def _visible(db: Session, item_id: uuid.UUID, user: User) -> LibraryItem:
    i = db.get(LibraryItem, item_id)
    if not i or i.status == "removed" or (i.status != "approved" and user.role not in ("librarian", "admin") and i.uploaded_by != user.id):
        raise HTTPException(404, "Material not found.")
    return i


def _file(i: LibraryItem) -> Path:
    p = _dir() / i.file_path
    if not p.exists():
        raise HTTPException(404, "The file is missing on the server. Please tell the librarian.")
    return p


@router.get("/{item_id}/view")
def view(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    i = _visible(db, item_id, user)
    p = _file(i)
    i.views += 1
    db.commit()
    return FileResponse(p, media_type=i.mime, headers={"Content-Disposition": f'inline; filename="{i.original_name}"'})


@router.get("/{item_id}/download")
def download(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    i = _visible(db, item_id, user)
    p = _file(i)
    i.downloads += 1
    db.commit()
    return FileResponse(p, media_type=i.mime, filename=i.original_name)


@router.post("/{item_id}/favourite")
def favourite(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    _visible(db, item_id, user)
    f = db.scalar(select(LibraryFavourite).where(LibraryFavourite.user_id == user.id, LibraryFavourite.item_id == item_id))
    if f:
        db.delete(f)
    else:
        db.add(LibraryFavourite(user_id=user.id, item_id=item_id))
    db.commit()
    return {"favourite": not f}


@router.delete("/{item_id}")
def remove(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(uploaders)):
    i = db.get(LibraryItem, item_id)
    if not i or i.status == "removed":
        raise HTTPException(404, "Material not found.")
    if user.role == "teacher" and i.uploaded_by != user.id:
        raise HTTPException(403, "You can only remove your own uploads.")
    i.status = "removed"  # soft delete; file kept for recovery
    db.commit()
    return {"status": "removed"}
