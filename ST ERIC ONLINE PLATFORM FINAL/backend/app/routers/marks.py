import io
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_roles, current_user
from app.grading import Band, grade_for, level_for_form, percentage
from app.models import (Assessment, ClassGroup, GradingBand, Mark, MarkAudit, Student, Subject,
                        TeacherAssignment, User)

router = APIRouter(prefix="/assessments", tags=["marks"])
staff = require_roles("teacher", "admin")


class MarkIn(BaseModel):
    student_id: uuid.UUID
    marks_obtained: float | None = Field(None, ge=0)
    absent: bool = False
    reason: str | None = None  # audit reason when changing an existing mark


class MarksPayload(BaseModel):
    marks: list[MarkIn] | None = None
    rows: list[MarkIn] | None = None

    @property
    def items(self) -> list[MarkIn]:
        return self.marks or self.rows or []


def bands_for(db: Session, level: str) -> list[Band] | None:
    rows = db.scalars(select(GradingBand).where(GradingBand.level == level).order_by(GradingBand.min_pct.desc())).all()
    return [Band(r.grade, r.min_pct, r.max_pct, r.points, r.remark) for r in rows] or None


def _assessment_for(db: Session, aid: uuid.UUID, user: User) -> Assessment:
    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(404, "Assessment not found.")
    if user.role == "teacher":
        ok = db.scalar(select(TeacherAssignment.id).where(
            TeacherAssignment.teacher_id == user.id,
            TeacherAssignment.class_id == a.class_id,
            TeacherAssignment.subject_id == a.subject_id))
        if not ok:
            raise HTTPException(403, "This is not one of your classes.")
    return a


class AssessmentIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    title: str = Field(min_length=2, max_length=150)
    kind: str = "test"
    term: int = Field(ge=1, le=3)
    year: int = Field(ge=2000, le=2100)
    max_marks: float = Field(gt=0, le=1000)
    weight: float = Field(1.0, gt=0, le=10)


@router.get("")
def list_assessments(term: int | None = None, year: int | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Assessments the user may mark (teacher: assigned classes only), with how many marks are still missing."""
    stmt = select(Assessment, ClassGroup.name, Subject.name).join(ClassGroup, ClassGroup.id == Assessment.class_id).join(Subject, Subject.id == Assessment.subject_id)
    if user.role == "teacher":
        stmt = stmt.join(TeacherAssignment, (TeacherAssignment.class_id == Assessment.class_id) & (TeacherAssignment.subject_id == Assessment.subject_id)).where(TeacherAssignment.teacher_id == user.id)
    if term:
        stmt = stmt.where(Assessment.term == term)
    if year:
        stmt = stmt.where(Assessment.year == year)
    out = []
    for a, cname, sname in db.execute(stmt.order_by(Assessment.year.desc(), Assessment.term.desc(), Assessment.created_at.desc())):
        total = db.scalar(select(func.count()).select_from(Student).where(Student.class_id == a.class_id, Student.status == "active"))
        done = db.scalar(select(func.count()).select_from(Mark).where(Mark.assessment_id == a.id, or_(Mark.marks_obtained.is_not(None), Mark.absent.is_(True))))
        out.append({"id": a.id, "title": a.title, "class": cname, "subject": sname, "term": a.term, "year": a.year,
                    "kind": a.kind, "weight": a.weight,
                    "max_marks": a.max_marks, "locked": a.is_locked, "entered": done, "total": total})
    return out


@router.post("", status_code=201)
def create_assessment(body: AssessmentIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and not db.scalar(select(TeacherAssignment.id).where(
            TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == body.class_id,
            TeacherAssignment.subject_id == body.subject_id)):
        raise HTTPException(403, "This is not one of your classes.")
    a = Assessment(**body.model_dump())
    db.add(a)
    db.commit()
    return {"id": a.id}


@router.post("/{aid}/lock")
def lock(aid: uuid.UUID, locked: bool = True, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    a = db.get(Assessment, aid)
    if not a:
        raise HTTPException(404, "Assessment not found.")
    a.is_locked = locked
    db.commit()
    return {"locked": a.is_locked}


@router.get("/{aid}/sheet")
def mark_sheet(aid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Class list + any saved marks, for the mark-entry screen."""
    a = _assessment_for(db, aid, user)
    klass = db.get(ClassGroup, a.class_id)
    subj = db.get(Subject, a.subject_id)
    level = level_for_form(klass.form) if klass else "O"
    bands = bands_for(db, level)
    students = db.scalars(select(Student).where(Student.class_id == a.class_id, Student.status == "active")
                          .order_by(Student.last_name, Student.first_name)).all()
    saved = {m.student_id: m for m in db.scalars(select(Mark).where(Mark.assessment_id == aid))}
    rows = []
    for s in students:
        m = saved.get(s.id)
        got = m.marks_obtained if m else None
        rows.append({"student_id": s.id, "admission_no": s.admission_no, "name": s.full_name,
                     "marks_obtained": got, "absent": bool(m and m.absent),
                     "grade": grade_for(percentage(got, a.max_marks), level, bands) if got is not None else None})
    return {"assessment": {"id": a.id, "title": a.title, "max_marks": a.max_marks, "weight": a.weight,
                            "locked": a.is_locked, "level": level, "kind": a.kind,
                            "class": klass.name if klass else "",
                            "subject": subj.name if subj else ""}, "rows": rows}


@router.get("/{aid}/template")
def download_template(aid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Pre-filled CSV template for mark entry with student admission numbers and names."""
    a = _assessment_for(db, aid, user)
    students = db.scalars(select(Student).where(Student.class_id == a.class_id, Student.status == "active")
                          .order_by(Student.last_name, Student.first_name)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["admission_no", "student_name", "marks"])
    for s in students:
        writer.writerow([s.admission_no, s.full_name, ""])
    csv_bytes = output.getvalue().encode("utf-8")
    filename = f"marks_template_{a.title.replace(' ', '_')}.csv"
    return Response(csv_bytes, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def apply_marks(db: Session, a: Assessment, rows: list[MarkIn], user: User) -> dict:
    """Validate and save marks. Rejected rows never touch existing data; each row reports its own error."""
    if a.is_locked and user.role != "admin":
        raise HTTPException(423, "Marks for this assessment are locked.")
    level = level_for_form(db.get(ClassGroup, a.class_id).form)
    bands = bands_for(db, level)
    in_class = set(db.scalars(select(Student.id).where(Student.class_id == a.class_id)))
    existing = {m.student_id: m for m in db.scalars(select(Mark).where(Mark.assessment_id == a.id))}
    saved, errors = 0, []
    for row in rows:
        if row.student_id not in in_class:
            errors.append({"student_id": str(row.student_id), "error": "Student is not in this class."})
            continue
        if row.marks_obtained is not None and row.marks_obtained > a.max_marks:
            errors.append({"student_id": str(row.student_id), "error": f"Mark cannot exceed maximum total of {a.max_marks:g}."})
            continue
        if row.marks_obtained is not None and row.marks_obtained < 0:
            errors.append({"student_id": str(row.student_id), "error": "Mark cannot be negative."})
            continue
        m = existing.get(row.student_id)
        new = None if row.absent else row.marks_obtained
        if m and m.marks_obtained is not None and m.marks_obtained != new:
            audit_reason = row.reason or "Score updated by teacher"
            db.add(MarkAudit(mark_id=m.id, old_value=m.marks_obtained, new_value=new,
                             reason=audit_reason, changed_by=user.id))
        if not m:
            m = Mark(assessment_id=a.id, student_id=row.student_id)
            db.add(m)
            existing[row.student_id] = m
        m.marks_obtained, m.absent, m.entered_by = new, row.absent, user.id
        m.grade = grade_for(percentage(new, a.max_marks), level, bands) if new is not None else None
        saved += 1
    db.commit()
    return {"saved": saved, "errors": errors}


@router.put("/{aid}/marks")
def save_marks(aid: uuid.UUID, payload: MarksPayload, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Single or bulk save. Editing an existing mark logs audit trail."""
    return apply_marks(db, _assessment_for(db, aid, user), payload.items, user)


@router.post("/{aid}/marks/upload")
async def upload_marks(aid: uuid.UUID, file: UploadFile = File(...), reason: str | None = None,
                       db: Session = Depends(get_db), user: User = Depends(staff)):
    """Excel/CSV with columns: admission_no, marks (blank = not entered, A/ABS = absent)."""
    import pandas as pd
    a = _assessment_for(db, aid, user)
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "File is too large.")
    try:
        name = (file.filename or "").lower()
        df = pd.read_csv(io.BytesIO(raw), dtype=str) if name.endswith(".csv") else pd.read_excel(io.BytesIO(raw), dtype=str)
        df.columns = [str(c).strip().lower() for c in df.columns]
        assert {"admission_no", "marks"} <= set(df.columns)
    except Exception:
        raise HTTPException(422, "Could not read the file. Use the columns admission_no and marks (.xlsx or .csv).")
    lookup = {s.admission_no.upper(): s.id for s in db.scalars(select(Student).where(Student.class_id == a.class_id))}
    rows, errors = [], []
    for n, rec in enumerate(df.to_dict("records"), start=2):
        adm = str(rec.get("admission_no", "")).strip().upper()
        val = str(rec.get("marks", "")).strip()
        sid = lookup.get(adm)
        if not sid:
            errors.append({"row": n, "admission_no": adm, "error": "Not in this class."})
            continue
        if val.lower() in ("a", "abs", "absent"):
            rows.append(MarkIn(student_id=sid, absent=True, reason=reason))
        elif val in ("", "nan"):
            continue
        else:
            try:
                rows.append(MarkIn(student_id=sid, marks_obtained=float(val), reason=reason))
            except ValueError:
                errors.append({"row": n, "admission_no": adm, "error": f"'{val}' is not a number."})
    result = apply_marks(db, a, rows, user)
    result["errors"] = errors + [{"admission_no": next((k for k, v in lookup.items() if v == e["student_id"]), ""), "error": e["error"]} for e in result["errors"]]
    return result


@router.get("/my-results")
def my_results(term: int | None = None, year: int | None = None,
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Student/parent sees their own assessment results for the current term and previous term only."""
    from app.routers.reports import children_of
    if user.role not in ("student", "parent"):
        raise HTTPException(403, "This endpoint is for students and parents.")
    students = children_of(db, user)
    results = []

    # Current term and previous term window (Term 3, 2026 is active; historical marks older than Term 2, 2026 automatically disappear)
    curr_year = 2026
    curr_term = 3
    if curr_term > 1:
        prev_term = curr_term - 1
        prev_year = curr_year
    else:
        prev_term = 3
        prev_year = curr_year - 1

    for s in students:
        stmt = (
            select(Mark, Assessment, Subject.name.label("subject_name"), ClassGroup.name.label("class_name"))
            .join(Assessment, Assessment.id == Mark.assessment_id)
            .join(Subject, Subject.id == Assessment.subject_id)
            .join(ClassGroup, ClassGroup.id == Assessment.class_id)
            .where(Mark.student_id == s.id)
        )
        if term and year:
            stmt = stmt.where(Assessment.term == term, Assessment.year == year)
        else:
            # Strictly limit to current term and previous term only
            stmt = stmt.where(
                or_(
                    (Assessment.term == curr_term) & (Assessment.year == curr_year),
                    (Assessment.term == prev_term) & (Assessment.year == prev_year)
                )
            )
        stmt = stmt.order_by(Assessment.year.desc(), Assessment.term.desc(), Assessment.created_at.desc())
        for mark, assessment, subject_name, class_name in db.execute(stmt).all():
            pct = round((mark.marks_obtained / assessment.max_marks) * 100, 1) if mark.marks_obtained is not None and assessment.max_marks else None
            is_exam = assessment.kind.startswith("exam")
            is_mid = assessment.kind in ("test", "assignment")
            results.append({
                "student_id": str(s.id), "student_name": s.full_name,
                "subject": subject_name, "class": class_name,
                "title": assessment.title, "kind": assessment.kind,
                "is_mid_term": is_mid,
                "is_exam": is_exam,
                "category": "End of Term Exam" if is_exam else "Mid Term Assessment",
                "term": assessment.term, "year": assessment.year,
                "is_current_term": assessment.term == curr_term and assessment.year == curr_year,
                "marks": mark.marks_obtained, "max": assessment.max_marks,
                "pct": pct, "grade": mark.grade, "absent": mark.absent,
                "date": str(assessment.created_at.date()) if assessment.created_at else None,
            })
    return results
