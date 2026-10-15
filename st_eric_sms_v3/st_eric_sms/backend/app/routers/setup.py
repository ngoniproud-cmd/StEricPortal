"""Administration: classes, subjects, teacher assignments, accounts, guardians, grading bands, audit, bulk PDFs."""
import io
import uuid
import zipfile
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_roles
from app.grading import DEFAULT_BANDS
from app.models import (ClassGroup, GradingBand, LibraryItem, Mark, MarkAudit, Student, StudentGuardian, Subject,
                        TeacherAssignment, User)
from app.report_card import build_report, render_pdf

router = APIRouter(tags=["setup"])
admin = require_roles("admin")
staff = require_roles("admin", "teacher")


class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    form: int = Field(ge=1, le=6)
    year: int = Field(ge=2000, le=2100)
    class_teacher_id: uuid.UUID | None = None


@router.post("/classes", status_code=201)
def create_class(b: ClassIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    if db.scalar(select(ClassGroup.id).where(ClassGroup.name == b.name.strip(), ClassGroup.year == b.year, ClassGroup.status == "active")):
        raise HTTPException(409, "That class already exists for this year.")
    c = ClassGroup(name=b.name.strip(), form=b.form, year=b.year, class_teacher_id=b.class_teacher_id)
    db.add(c); db.commit()
    return {"id": c.id}


@router.put("/classes/{cid}")
def edit_class(cid: uuid.UUID, b: ClassIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    c = db.get(ClassGroup, cid)
    if not c:
        raise HTTPException(404, "Class not found.")
    c.name, c.form, c.year, c.class_teacher_id = b.name.strip(), b.form, b.year, b.class_teacher_id
    db.commit()
    return {"ok": True}


@router.delete("/classes/{cid}")
def archive_class(cid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    c = db.get(ClassGroup, cid)
    if not c:
        raise HTTPException(404, "Class not found.")
    if db.scalar(select(Student.id).where(Student.class_id == cid, Student.status == "active")):
        raise HTTPException(409, "Move the learners out of this class first.")
    c.status = "archived"; db.commit()
    return {"ok": True}


class SubjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    zimsec_code: str | None = Field(None, max_length=10)
    level: str = Field("O", pattern="^(O|A)$")


@router.post("/subjects", status_code=201)
def create_subject(b: SubjectIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    if db.scalar(select(Subject.id).where(Subject.name == b.name.strip(), Subject.level == b.level, Subject.status == "active")):
        raise HTTPException(409, "That subject already exists at this level.")
    s = Subject(name=b.name.strip(), zimsec_code=b.zimsec_code, level=b.level)
    db.add(s); db.commit()
    return {"id": s.id}


@router.put("/subjects/{sid}")
def edit_subject(sid: uuid.UUID, b: SubjectIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    s = db.get(Subject, sid)
    if not s:
        raise HTTPException(404, "Subject not found.")
    s.name, s.zimsec_code, s.level = b.name.strip(), b.zimsec_code, b.level
    db.commit()
    return {"ok": True}


@router.delete("/subjects/{sid}")
def archive_subject(sid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    s = db.get(Subject, sid)
    if not s:
        raise HTTPException(404, "Subject not found.")
    s.status = "archived"; db.commit()
    return {"ok": True}


class TA(BaseModel):
    teacher_id: uuid.UUID
    class_id: uuid.UUID
    subject_id: uuid.UUID


@router.get("/teacher-assignments")
def list_ta(db: Session = Depends(get_db), _: User = Depends(admin)):
    users = {u.id: u.full_name for u in db.scalars(select(User).where(User.role == "teacher"))}
    cls = {c.id: f"{c.name} ({c.year})" for c in db.scalars(select(ClassGroup))}
    subs = {s.id: s.name for s in db.scalars(select(Subject))}
    return [{"id": t.id, "teacher": users.get(t.teacher_id), "class": cls.get(t.class_id), "subject": subs.get(t.subject_id)} for t in db.scalars(select(TeacherAssignment))]


@router.post("/teacher-assignments", status_code=201)
def add_ta(b: TA, db: Session = Depends(get_db), _: User = Depends(admin)):
    t = db.get(User, b.teacher_id)
    if not t or t.role != "teacher" or not db.get(ClassGroup, b.class_id) or not db.get(Subject, b.subject_id):
        raise HTTPException(422, "Choose a teacher, a class and a subject.")
    if db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == b.teacher_id, TeacherAssignment.class_id == b.class_id, TeacherAssignment.subject_id == b.subject_id)):
        raise HTTPException(409, "That teacher already has this class and subject.")
    x = TeacherAssignment(**b.model_dump())
    db.add(x); db.commit()
    return {"id": x.id}


@router.delete("/teacher-assignments/{tid}")
def remove_ta(tid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    t = db.get(TeacherAssignment, tid)
    if not t:
        raise HTTPException(404, "Assignment not found.")
    db.delete(t); db.commit()  # link row only; marks and history are untouched
    return {"ok": True}


@router.get("/users")
def list_users(role: str | None = None, db: Session = Depends(get_db), _: User = Depends(admin)):
    stmt = select(User).order_by(User.role, User.full_name)
    if role:
        stmt = stmt.where(User.role == role)
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role, "phone": u.phone, "status": u.status} for u in db.scalars(stmt.limit(500))]


class StatusIn(BaseModel):
    status: str = Field(pattern="^(active|inactive)$")


@router.patch("/users/{uid}/status")
def set_status(uid: uuid.UUID, b: StatusIn, db: Session = Depends(get_db), me: User = Depends(admin)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found.")
    if u.id == me.id:
        raise HTTPException(422, "You cannot deactivate your own account.")
    u.status = b.status; db.commit()
    return {"status": u.status}


@router.get("/students/{sid}/guardians")
def guardians(sid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    rows = db.execute(select(StudentGuardian, User).join(User, User.id == StudentGuardian.user_id).where(StudentGuardian.student_id == sid))
    return [{"link_id": g.id, "user_id": u.id, "name": u.full_name, "username": u.username, "phone": u.phone, "relationship": g.relationship_type} for g, u in rows]


@router.delete("/guardian-links/{lid}")
def unlink(lid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    g = db.get(StudentGuardian, lid)
    if not g:
        raise HTTPException(404, "Link not found.")
    db.delete(g); db.commit()
    return {"ok": True}


class StudentEdit(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: str | None = Field(None, pattern="^[MF]$")
    class_id: uuid.UUID | None = None
    status: str = Field("active", pattern="^(active|inactive|graduated)$")


@router.get("/students/{sid}")
def student_profile(sid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(staff)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found.")
    return {"id": s.id, "admission_no": s.admission_no, "first_name": s.first_name, "last_name": s.last_name, "gender": s.gender,
            "date_of_birth": s.date_of_birth, "class_id": s.class_id, "status": s.status}


@router.put("/students/{sid}")
def edit_student(sid: uuid.UUID, b: StudentEdit, db: Session = Depends(get_db), _: User = Depends(admin)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found.")
    s.first_name, s.last_name, s.gender, s.class_id, s.status = b.first_name.strip(), b.last_name.strip(), b.gender, b.class_id, b.status
    db.commit()
    return {"ok": True}


# ---------- grading-band editor ----------
class BandIn(BaseModel):
    grade: str = Field(pattern="^[A-EU]$")
    min_pct: int = Field(ge=0, le=100)
    max_pct: int = Field(ge=0, le=100)
    points: int = Field(0, ge=0, le=10)
    remark: str = Field("", max_length=50)


def validate_bands(bands: list[BandIn]):
    if [b.grade for b in bands] != list("ABCDEU"):
        raise HTTPException(422, "Give all six grades in order: A, B, C, D, E, U.")
    expect = 100
    for b in bands:
        if b.max_pct != expect or b.min_pct > b.max_pct:
            raise HTTPException(422, f"Grade {b.grade} must end at {expect}% with no gap or overlap.")
        expect = b.min_pct - 1
    if expect != -1:
        raise HTTPException(422, "The bands must reach all the way down to 0%.")


@router.get("/grading/{level}")
def get_bands(level: str, db: Session = Depends(get_db), _: User = Depends(staff)):
    if level not in ("O", "A"):
        raise HTTPException(404, "Level must be O or A.")
    rows = db.scalars(select(GradingBand).where(GradingBand.level == level).order_by(GradingBand.min_pct.desc())).all()
    bands = [{"grade": r.grade, "min_pct": r.min_pct, "max_pct": r.max_pct, "points": r.points, "remark": r.remark} for r in rows] or \
            [{"grade": b.grade, "min_pct": b.min_pct, "max_pct": b.max_pct, "points": b.points, "remark": b.remark} for b in DEFAULT_BANDS[level]]
    return {"level": level, "custom": bool(rows), "bands": bands}


@router.put("/grading/{level}")
def set_bands(level: str, bands: list[BandIn], db: Session = Depends(get_db), _: User = Depends(admin)):
    if level not in ("O", "A"):
        raise HTTPException(404, "Level must be O or A.")
    validate_bands(bands)
    for r in db.scalars(select(GradingBand).where(GradingBand.level == level)):
        db.delete(r)
    db.flush()
    db.add_all(GradingBand(level=level, **b.model_dump()) for b in bands)
    db.commit()
    return {"ok": True, "note": "New marks use these bands immediately. Re-save marks to regrade older entries."}


# ---------- audit viewer ----------
@router.get("/audit")
def audit(limit: int = 100, db: Session = Depends(get_db), _: User = Depends(admin)):
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    out = []
    for a in db.scalars(select(MarkAudit).order_by(MarkAudit.created_at.desc()).limit(min(limit, 300))):
        m = db.get(Mark, a.mark_id)
        st = db.get(Student, m.student_id) if m else None
        out.append({"when": a.created_at, "kind": "Mark changed", "who": names.get(a.changed_by), "what": f"{st.full_name if st else '?'}: {a.old_value} to {a.new_value}", "reason": a.reason})
    for i in db.scalars(select(LibraryItem).where(LibraryItem.reviewed_at.is_not(None)).order_by(LibraryItem.reviewed_at.desc()).limit(50)):
        out.append({"when": i.reviewed_at, "kind": f"Library {i.status}", "who": names.get(i.reviewed_by), "what": i.title, "reason": i.reject_reason})
    return sorted(out, key=lambda r: r["when"], reverse=True)[:limit]


# ---------- bulk report cards ----------
@router.get("/report-cards/class/{class_id}/zip")
def class_zip(class_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), _: User = Depends(admin)):
    kids = list(db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active").order_by(Student.last_name)))
    if not kids:
        raise HTTPException(404, "No learners in this class.")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for k in kids:
            z.writestr(f"{k.admission_no}-{k.last_name}-{k.first_name}-T{term}-{year}.pdf".replace(" ", "_"), render_pdf(build_report(db, k.id, term, year)))
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="class-reports-T{term}-{year}.zip"'})
