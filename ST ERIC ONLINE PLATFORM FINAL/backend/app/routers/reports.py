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
        if not s:
            return False
        if s.user_id == user.id or s.first_name.lower() == user.username.lower():
            return True
        return False
    if user.role == "parent":
        return bool(db.scalar(select(StudentGuardian.id).where(
            StudentGuardian.student_id == sid, StudentGuardian.user_id == user.id)))
    return False


def has_cleared_fees(db: Session, st: Student) -> tuple[bool, dict[str, float]]:
    """Checks whether the student has any outstanding fee balance."""
    from app.models import FeeRecord
    recs = list(db.scalars(select(FeeRecord).where(FeeRecord.external_student_id == st.admission_no)))
    if not recs:
        return True, {}
    balances: dict[str, float] = {}
    for r in recs:
        bal = round(float(r.balance), 2)
        if bal > 0:
            balances[r.currency] = round(balances.get(r.currency, 0.0) + bal, 2)
    return (len(balances) == 0), balances


@router.get("/{student_id}/fee-status")
def student_fee_status(student_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not _can_view(db, user, student_id):
        raise HTTPException(403, "Access denied.")
    st = db.get(Student, student_id)
    if not st:
        raise HTTPException(404, "Student not found.")
    cleared, balances = has_cleared_fees(db, st)
    return {
        "cleared": cleared,
        "balances": balances,
        "admission_no": st.admission_no,
        "student_name": st.full_name,
    }


@router.get("/{student_id}")
def report_json(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    if not _can_view(db, user, student_id):
        raise HTTPException(403, "You can only view your own (or your child's) results.")

    # Fee clearance policy: Only students and parents with full fees paid can view results
    if user.role in ("student", "parent"):
        st = db.get(Student, student_id)
        if st:
            cleared, balances = has_cleared_fees(db, st)
            if not cleared:
                bal_str = ", ".join(f"{cur} {amt:.2f}" for cur, amt in balances.items())
                raise HTTPException(
                    403,
                    f"Results Withheld: Full fee clearance is required. Outstanding balance: {bal_str}. Please settle your account with the school bursar."
                )

    d = build_report(db, student_id, term, year)
    if user.role in ("student", "parent") and not db.scalar(select(ReportComment.published).where(
            ReportComment.student_id == student_id, ReportComment.term == term, ReportComment.year == year)):
        raise HTTPException(404, "This report has not been published yet.")
    return {
        "student": d["student"].full_name,
        "admission_no": d["student"].admission_no,
        "class": d["klass"].name,
        "level": d["level"],
        "term": term,
        "year": year,
        "rows": d["rows"],
        "overall": d["overall"],
        "total_points": d.get("total_points"),
        "grade_summary": d.get("grade_summary"),
        "position": d["position"],
        "class_size": d["class_size"],
        "form_position": d.get("form_position"),
        "form_size": d.get("form_size"),
        "subjects_recorded": d.get("subjects_recorded"),
        "subjects_passed": d.get("subjects_passed"),
        "attendance": d.get("attendance"),
        "next_term_begins": d.get("next_term_begins"),
        "next_term_fees": d.get("next_term_fees"),
        "class_teacher_comment": d.get("class_teacher_comment"),
        "head_comment": d.get("head_comment"),
        "qr": d.get("qr"),
    }


@router.get("/{student_id}/pdf")
def report_pdf(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db),
               user: User = Depends(current_user)):
    report_json(student_id, term, year, db, user)  # same access + fee clearance + publish checks
    pdf = render_pdf(build_report(db, student_id, term, year))
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="report-T{term}-{year}.pdf"'})


def children_of(db: Session, user: User) -> list[Student]:
    """Students a user may see: self (student) or linked children (parent)."""
    if user.role == "student":
        direct = list(db.scalars(select(Student).where(Student.user_id == user.id)))
        if direct:
            return direct
        # Fallback: match by student first name e.g. 'tinashe'
        by_name = list(db.scalars(select(Student).where(
            func.lower(Student.first_name) == user.username.lower()
        )))
        if by_name:
            return by_name
        return []
    if user.role == "parent":
        return list(db.scalars(select(Student).join(StudentGuardian, StudentGuardian.student_id == Student.id)
                               .where(StudentGuardian.user_id == user.id)))
    return []


class PublishIn(BaseModel):
    class_id: uuid.UUID
    term: int
    year: int


@router.post("/publish")
def publish(b: PublishIn, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "teacher"))):
    """Release a class's term results to students and parents, and alert them in-app."""
    klass = db.get(ClassGroup, b.class_id)
    if not klass:
        raise HTTPException(404, "Class not found.")
    if user.role == "teacher" and klass.class_teacher_id != user.id:
        raise HTTPException(403, "Only the assigned class teacher or headmaster can release reports for this class.")
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
