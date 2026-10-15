import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user
from pydantic import BaseModel
from app.deps import require_roles
from app.models import ReportComment, Student, StudentGuardian, User
from app.notifications import family_user_ids, notify
from app.report_card import verify_signature
from app.report_card import build_report, render_pdf

router = APIRouter(prefix="/report-cards", tags=["report cards"])


def _can_view(db: Session, user: User, sid: uuid.UUID) -> bool:
    if user.role in ("admin", "teacher"):
        return True
    if user.role == "student":
        s = db.get(Student, sid)
        return bool(s and s.user_id == user.id)
    if user.role == "parent":
        return bool(db.scalar(select(StudentGuardian.id).where(
            StudentGuardian.student_id == sid, StudentGuardian.user_id == user.id)))
    return False


@router.get("/{student_id}")
def report_json(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    if not _can_view(db, user, student_id):
        raise HTTPException(403, "You can only view your own (or your child's) results.")
    d = build_report(db, student_id, term, year)
    if user.role in ("student", "parent") and not db.scalar(select(ReportComment.published).where(
            ReportComment.student_id == student_id, ReportComment.term == term, ReportComment.year == year)):
        raise HTTPException(404, "This report has not been published yet.")
    return {"student": d["student"].full_name, "class": d["klass"].name, "term": term, "year": year,
            "rows": d["rows"], "overall": d["overall"], "position": d["position"], "class_size": d["class_size"]}


@router.get("/{student_id}/pdf")
def report_pdf(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db),
               user: User = Depends(current_user)):
    report_json(student_id, term, year, db, user)  # same access + publish checks
    pdf = render_pdf(build_report(db, student_id, term, year))
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="report-T{term}-{year}.pdf"'})


def children_of(db: Session, user: User) -> list[Student]:
    """Students a user may see: self (student) or linked children (parent)."""
    if user.role == "student":
        return list(db.scalars(select(Student).where(Student.user_id == user.id)))
    if user.role == "parent":
        return list(db.scalars(select(Student).join(StudentGuardian, StudentGuardian.student_id == Student.id)
                               .where(StudentGuardian.user_id == user.id)))
    return []


class PublishIn(BaseModel):
    class_id: uuid.UUID
    term: int
    year: int


@router.post("/publish")
def publish(b: PublishIn, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    """Release a class's term results to students and parents, and alert them in-app."""
    kids = db.scalars(select(Student).where(Student.class_id == b.class_id, Student.status == "active")).all()
    for s in kids:
        c = db.scalar(select(ReportComment).where(ReportComment.student_id == s.id, ReportComment.term == b.term, ReportComment.year == b.year))
        if not c:
            c = ReportComment(student_id=s.id, term=b.term, year=b.year)
            db.add(c)
        c.published = True
        notify(db, family_user_ids(db, [s.id]), f"Term {b.term} results are out", f"{s.first_name}'s report is ready to view.", "/report-cards")
    db.commit()
    return {"published": len(kids)}


class CommentIn(BaseModel):
    term: int
    year: int
    class_teacher_comment: str | None = None
    head_comment: str | None = None


@router.put("/{student_id}/comments")
def save_comments(student_id: uuid.UUID, b: CommentIn, db: Session = Depends(get_db), user: User = Depends(require_roles("teacher", "admin"))):
    if b.head_comment is not None and user.role != "admin":
        raise HTTPException(403, "Only the headmaster's office can write the head's comment.")
    c = db.scalar(select(ReportComment).where(ReportComment.student_id == student_id, ReportComment.term == b.term, ReportComment.year == b.year))
    if not c:
        c = ReportComment(student_id=student_id, term=b.term, year=b.year)
        db.add(c)
    if b.class_teacher_comment is not None:
        c.class_teacher_comment = b.class_teacher_comment.strip()
    if b.head_comment is not None:
        c.head_comment = b.head_comment.strip()
    db.commit()
    return {"ok": True}


public = APIRouter(tags=["verify"])


@public.get("/verify/{student_id}/{term}/{year}/{sig}")
def verify(student_id: uuid.UUID, term: int, year: int, sig: str, db: Session = Depends(get_db)):
    """Public: anyone scanning the QR code on a printed report can confirm it is genuine."""
    if not verify_signature(student_id, term, year, sig):
        return {"genuine": False}
    s = db.get(Student, student_id)
    if not s:
        return {"genuine": False}
    from app.report_card import build_report
    d = build_report(db, student_id, term, year)
    return {"genuine": True, "student": s.full_name, "class": d["klass"].name, "term": term, "year": year, "overall": d["overall"]}
