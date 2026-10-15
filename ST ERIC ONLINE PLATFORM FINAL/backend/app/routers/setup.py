"""Administration: classes, subjects, teacher assignments, accounts, guardians, grading bands, audit, bulk PDFs."""
import io
import uuid
import zipfile
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_roles
from app.grading import DEFAULT_BANDS
from app.models import (AuditEvent, ClassGroup, GradingBand, LibraryItem, Mark, MarkAudit, Student, StudentGuardian, Subject,
                        TeacherAssignment, User)
from app.report_card import build_report, render_pdf

router = APIRouter(tags=["setup"])
admin = require_roles("admin")
staff = require_roles("admin", "teacher", "hod")
hod_or_admin = require_roles("admin", "hod")


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
    department: str | None = None


@router.post("/subjects", status_code=201)
def create_subject(b: SubjectIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    if db.scalar(select(Subject.id).where(Subject.name == b.name.strip(), Subject.level == b.level, Subject.status == "active")):
        raise HTTPException(409, "That subject already exists at this level.")
    s = Subject(name=b.name.strip(), zimsec_code=b.zimsec_code, level=b.level, department=b.department)
    db.add(s); db.commit()
    return {"id": s.id}


@router.put("/subjects/{sid}")
def edit_subject(sid: uuid.UUID, b: SubjectIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    s = db.get(Subject, sid)
    if not s:
        raise HTTPException(404, "Subject not found.")
    s.name, s.zimsec_code, s.level, s.department = b.name.strip(), b.zimsec_code, b.level, b.department
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
def list_ta(db: Session = Depends(get_db), user: User = Depends(hod_or_admin)):
    users = {u.id: u.full_name for u in db.scalars(select(User).where(User.role.in_(("teacher", "hod"))))}
    cls = {c.id: f"{c.name} ({c.year})" for c in db.scalars(select(ClassGroup))}
    subs = {s.id: s.name for s in db.scalars(select(Subject))}
    subs_dept = {s.id: s.department for s in db.scalars(select(Subject))}

    stmt = select(TeacherAssignment)
    if user.role == "hod" and user.department:
        dept_subj_ids = [sid for sid, d in subs_dept.items() if d == user.department]
        if dept_subj_ids:
            stmt = stmt.where(TeacherAssignment.subject_id.in_(dept_subj_ids))

    return [
        {
            "id": t.id,
            "teacher": users.get(t.teacher_id),
            "class": cls.get(t.class_id),
            "subject": subs.get(t.subject_id),
            "department": subs_dept.get(t.subject_id)
        }
        for t in db.scalars(stmt)
    ]


@router.post("/teacher-assignments", status_code=201)
def add_ta(b: TA, db: Session = Depends(get_db), user: User = Depends(hod_or_admin)):
    t = db.get(User, b.teacher_id)
    subj = db.get(Subject, b.subject_id)
    if not t or t.role not in ("teacher", "hod") or not db.get(ClassGroup, b.class_id) or not subj:
        raise HTTPException(422, "Choose a teacher, a class and a subject.")
    if user.role == "hod" and user.department:
        if t.department != user.department:
            raise HTTPException(403, f"As HOD of {user.department}, you can only assign teachers belonging to your department.")
        if subj.department != user.department:
            raise HTTPException(403, f"As HOD of {user.department}, you can only assign subjects belonging to your department.")
    if db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == b.teacher_id, TeacherAssignment.class_id == b.class_id, TeacherAssignment.subject_id == b.subject_id)):
        raise HTTPException(409, "That teacher already has this class and subject.")
    x = TeacherAssignment(**b.model_dump())
    db.add(x); db.commit()
    return {"id": x.id}


@router.delete("/teacher-assignments/{tid}")
def remove_ta(tid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(hod_or_admin)):
    t = db.get(TeacherAssignment, tid)
    if not t:
        raise HTTPException(404, "Assignment not found.")
    if user.role == "hod" and user.department:
        subj = db.get(Subject, t.subject_id)
        if not subj or subj.department != user.department:
            raise HTTPException(403, "You can only remove assignments within your department.")
    db.delete(t); db.commit()
    return {"ok": True}


@router.get("/hod/overview")
def hod_overview(db: Session = Depends(get_db), user: User = Depends(hod_or_admin)):
    dept = user.department if user.role == "hod" else None
    
    t_stmt = select(User).where(User.role.in_(("teacher", "hod")), User.status == "active")
    if dept:
        t_stmt = t_stmt.where(User.department == dept)
    dept_teachers = [
        {"id": u.id, "name": u.full_name, "username": u.username, "department": u.department, "role": u.role, "phone": u.phone}
        for u in db.scalars(t_stmt.order_by(User.full_name))
    ]

    s_stmt = select(Subject).where(Subject.status == "active")
    if dept:
        s_stmt = s_stmt.where(Subject.department == dept)
    dept_subjects = [
        {"id": s.id, "name": s.name, "zimsec_code": s.zimsec_code, "level": s.level, "department": s.department}
        for s in db.scalars(s_stmt.order_by(Subject.level.desc(), Subject.name))
    ]

    subj_ids = [s["id"] for s in dept_subjects]
    ta_stmt = select(TeacherAssignment)
    if subj_ids:
        ta_stmt = ta_stmt.where(TeacherAssignment.subject_id.in_(subj_ids))
    
    users_map = {u.id: u.full_name for u in db.scalars(select(User))}
    cls_map = {c.id: f"{c.name} ({c.year})" for c in db.scalars(select(ClassGroup))}
    subs_map = {s.id: s.name for s in db.scalars(select(Subject))}

    assignments = [
        {
            "id": t.id,
            "teacher_id": t.teacher_id,
            "teacher": users_map.get(t.teacher_id),
            "class_id": t.class_id,
            "class": cls_map.get(t.class_id),
            "subject_id": t.subject_id,
            "subject": subs_map.get(t.subject_id),
        }
        for t in db.scalars(ta_stmt)
    ]

    all_classes = [
        {"id": c.id, "name": c.name, "form": c.form, "year": c.year}
        for c in db.scalars(select(ClassGroup).where(ClassGroup.status == "active").order_by(ClassGroup.form, ClassGroup.name))
    ]

    return {
        "department": dept or "All Academic Departments",
        "hod_name": user.full_name,
        "teachers": dept_teachers,
        "subjects": dept_subjects,
        "assignments": assignments,
        "classes": all_classes
    }


@router.get("/users")
def list_users(role: str | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and role != "teacher":
        raise HTTPException(403, "Teachers can only view teacher lists.")
    stmt = select(User).order_by(User.role, User.full_name)
    if role:
        stmt = stmt.where(User.role == role)
    if user.role == "hod" and role == "teacher" and user.department:
        stmt = stmt.where((User.department == user.department) | (User.department.is_(None)))
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "department": u.department,
            "phone": u.phone,
            "status": u.status
        }
        for u in db.scalars(stmt.limit(500))
    ]


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
    grade: str = Field(pattern="^[A-Z]$")
    min_pct: int = Field(ge=0, le=100)
    max_pct: int = Field(ge=0, le=100)
    points: int = Field(0, ge=0, le=10)
    remark: str = Field("", max_length=50)


def validate_bands(level: str, bands: list[BandIn]):
    grades = [b.grade for b in bands]
    if level == "A":
        if grades not in (list("ABCDEOF"), list("ABCDEU")):
            raise HTTPException(422, "A-Level grades must be: A, B, C, D, E, O, F.")
    else:
        if grades != list("ABCDEU"):
            raise HTTPException(422, "O-Level grades must be: A, B, C, D, E, U.")
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
    validate_bands(level, bands)
    for r in db.scalars(select(GradingBand).where(GradingBand.level == level)):
        db.delete(r)
    db.flush()
    db.add_all(GradingBand(level=level, **b.model_dump()) for b in bands)
    db.commit()
    return {"ok": True, "note": "New marks use these bands immediately. Re-save marks to regrade older entries."}


# ---------- audit viewer (merged: now includes both MarkAudit and global AuditEvent) ----------
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
    for ae in db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(min(limit, 300))):
        out.append({"when": ae.created_at, "kind": ae.action, "who": names.get(uuid.UUID(ae.actor_id)) if ae.actor_id != "internal" else "System",
                     "what": f"{ae.object_type} {ae.object_id}", "reason": str(ae.details) if ae.details else None})
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


# ---------- St Eric High Standard Classes Initialization ----------
@router.post("/init-standard-classes")
@router.post("/setup/init-standard-classes")
def init_standard_classes(year: int = 2026, db: Session = Depends(get_db), _: User = Depends(admin)):
    """Initialize St Eric High School class stream structure:
    Form 1 to 4: Ranked alphabetically A (best) to H (worst).
    Form 5 & 6 (A-Level): Grouped by combination (Sciences, Commercials, Arts)."""
    classes_to_create = []

    # Form 1 to 4: Streams A to H (A best, H worst)
    for form in (1, 2, 3, 4):
        for stream in ("A", "B", "C", "D", "E", "F", "G", "H"):
            classes_to_create.append((f"{form}{stream}", form))

    # Form 5 & 6: A-Level Combinations
    for form in (5, 6):
        classes_to_create.append((f"{form} Sciences A", form))
        classes_to_create.append((f"{form} Sciences B", form))
        classes_to_create.append((f"{form} Commercials A", form))
        classes_to_create.append((f"{form} Commercials B", form))
        classes_to_create.append((f"{form} Arts", form))

    created, existing = 0, 0
    for name, form in classes_to_create:
        if db.scalar(select(ClassGroup.id).where(ClassGroup.name == name, ClassGroup.year == year, ClassGroup.status == "active")):
            existing += 1
            continue
        db.add(ClassGroup(name=name, form=form, year=year))
        created += 1

    db.commit()
    return {"created": created, "existing": existing, "total_classes": created + existing, "year": year}


# ---------- Universal File Import (Spreadsheet, Word, PDF) ----------
@router.post("/bulk-import")
@router.post("/setup/bulk-import")
async def bulk_import_file(
    file: UploadFile = File(...),
    import_type: str = Form("students"),
    class_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(staff),
):
    """Universal import for spreadsheet (.xlsx, .xls, .csv), Word (.docx), and PDF (.pdf).
    Automatically creates student & guardian accounts, or staff accounts, with:
      - Username: first_name
      - Initial Password: SURNAME in ALL CAPS
      - Forced change on first login (must_change_password=True)
      - Multi-child linking for parents
    Accessible by Admins and Teachers (for their classes)."""
    from app.importer import process_bulk_import
    if user.role == "teacher" and class_id:
        cls = db.get(ClassGroup, class_id)
        if not cls or (cls.class_teacher_id != user.id and not db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id))):
            raise HTTPException(403, "You can only import students into classes you teach or manage.")

    raw = await file.read()
    try:
        res = process_bulk_import(db, raw, file.filename or "upload.xlsx", class_id, import_type)
        return res
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing file: {str(e)}")

