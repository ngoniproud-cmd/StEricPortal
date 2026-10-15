"""Users, classes, students, Excel import, guardian links, year-end promotion."""
import io
import re
import secrets
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_roles
from app.models import Assessment, ClassGroup, Mark, Student, StudentGuardian, Subject, TeacherAssignment, User
from app.notifications import notify
from app.security import hash_password, verify_password

router = APIRouter(tags=["people"])
admin = require_roles("admin")
staff = require_roles("teacher", "admin", "librarian", "hod")
PHONE = re.compile(r"^\+263\d{9}$")


class UserIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str = Field(min_length=2, max_length=200)
    role: str = Field(pattern="^(admin|teacher|student|parent|librarian|hod)$")
    department: str | None = None
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v):
        if v and not PHONE.match(v):
            raise ValueError("Phone must look like +263771234567")
        return v


@router.post("/users", status_code=201)
def create_user(b: UserIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    """Creates the account with a one-time password shown once; the user must change it at first sign-in."""
    if db.scalar(select(User.id).where(User.username == b.username.lower())):
        raise HTTPException(409, "That username is already taken.")
    temp = secrets.token_urlsafe(6)
    u = User(username=b.username.lower(), full_name=b.full_name.strip(), role=b.role, department=b.department, phone=b.phone,
             password_hash=hash_password(temp), must_change_password=True)
    db.add(u)
    db.commit()
    return {"id": u.id, "username": u.username, "temporary_password": temp}


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found.")
    temp = secrets.token_urlsafe(6)
    u.password_hash, u.must_change_password = hash_password(temp), True
    db.commit()
    return {"temporary_password": temp}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=100)


@router.post("/auth/change-password")
def change_password(b: PasswordChange, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not verify_password(b.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    if b.new_password == b.current_password:
        raise HTTPException(422, "Choose a different password.")
    user.password_hash, user.must_change_password = hash_password(b.new_password), False
    db.commit()
    return {"ok": True}


@router.get("/classes")
def classes(year: int | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    stmt = select(ClassGroup).where(ClassGroup.status == "active")
    if year:
        stmt = stmt.where(ClassGroup.year == year)
    if user.role == "teacher":
        mine = select(TeacherAssignment.class_id).where(TeacherAssignment.teacher_id == user.id)
        stmt = stmt.where(ClassGroup.id.in_(mine) | (ClassGroup.class_teacher_id == user.id))
    return [{"id": c.id, "name": c.name, "form": c.form, "year": c.year,
             "students": db.scalar(select(func.count()).select_from(Student).where(Student.class_id == c.id, Student.status == "active"))}
            for c in db.scalars(stmt.order_by(ClassGroup.form, ClassGroup.name))]


@router.get("/subjects")
def subjects(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return [{"id": s.id, "name": s.name, "zimsec_code": s.zimsec_code, "level": s.level, "department": s.department} for s in db.scalars(select(Subject).where(Subject.status == "active").order_by(Subject.name))]


@router.get("/classes/{class_id}/students")
def class_list(class_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher":
        is_ta = db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id))
        is_ct = db.scalar(select(ClassGroup.id).where(ClassGroup.id == class_id, ClassGroup.class_teacher_id == user.id))
        if not is_ta and not is_ct:
            raise HTTPException(403, "This is not one of your classes.")
    rows = db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active").order_by(Student.last_name, Student.first_name))
    return [{"id": s.id, "admission_no": s.admission_no, "name": s.full_name, "gender": s.gender} for s in rows]


class LinkIn(BaseModel):
    parent_username: str
    relationship_type: str = "parent"


@router.post("/students/{student_id}/guardians", status_code=201)
def link_guardian(student_id: uuid.UUID, b: LinkIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    p = db.scalar(select(User).where(User.username == b.parent_username.lower(), User.role == "parent"))
    if not p or not db.get(Student, student_id):
        raise HTTPException(404, "Parent account or student not found.")
    if not db.scalar(select(StudentGuardian.id).where(StudentGuardian.student_id == student_id, StudentGuardian.user_id == p.id)):
        db.add(StudentGuardian(student_id=student_id, user_id=p.id, relationship_type=b.relationship_type))
        db.commit()
    return {"ok": True}


@router.post("/students/import")
async def import_students(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(admin)):
    """Excel/CSV columns: admission_no, first_name, last_name, gender (M/F), class (must already exist, e.g. '1 Blue')."""
    import pandas as pd
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str) if (file.filename or "").lower().endswith(".csv") else pd.read_excel(io.BytesIO(raw), dtype=str)
        df.columns = [str(c).strip().lower() for c in df.columns]
        assert {"admission_no", "first_name", "last_name", "class"} <= set(df.columns)
    except Exception:
        raise HTTPException(422, "Could not read the file. Needed columns: admission_no, first_name, last_name, class.")
    by_name = {}
    for c in db.scalars(select(ClassGroup).where(ClassGroup.status == "active").order_by(ClassGroup.year)):
        by_name[c.name.strip().lower()] = c.id  # latest year wins
    created, errors = 0, []
    for n, r in enumerate(df.fillna("").to_dict("records"), start=2):
        adm = r["admission_no"].strip().upper()
        cid = by_name.get(r["class"].strip().lower())
        if not adm or not r["first_name"].strip() or not r["last_name"].strip():
            errors.append({"row": n, "error": "Missing admission number or name."})
        elif not cid:
            errors.append({"row": n, "error": f"Class '{r['class']}' does not exist."})
        elif db.scalar(select(Student.id).where(Student.admission_no == adm)):
            errors.append({"row": n, "error": f"{adm} already exists."})
        else:
            g = r.get("gender", "").strip().upper()[:1]
            db.add(Student(admission_no=adm, first_name=r["first_name"].strip(), last_name=r["last_name"].strip(),
                           gender=g if g in ("M", "F") else None, class_id=cid))
            db.flush()
            created += 1
    db.commit()
    return {"created": created, "errors": errors}


class PromoteIn(BaseModel):
    target_class_id: uuid.UUID
    repeat_student_ids: list[uuid.UUID] = []
    leave_student_ids: list[uuid.UUID] = []  # e.g. Form 4 and Form 6 completers


@router.post("/classes/{class_id}/promote")
def promote(class_id: uuid.UUID, b: PromoteIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    """Year-end: move a class up. Repeaters stay; leavers become 'graduated' (soft, never deleted)."""
    src, dst = db.get(ClassGroup, class_id), db.get(ClassGroup, b.target_class_id)
    if not src or not dst:
        raise HTTPException(404, "Class not found.")
    if dst.year <= src.year:
        raise HTTPException(422, "The target class must be in a later year.")
    moved = left = 0
    for s in db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active")):
        if s.id in b.leave_student_ids:
            s.status, left = "graduated", left + 1
        elif s.id not in b.repeat_student_ids:
            s.class_id, moved = dst.id, moved + 1
    db.commit()
    return {"promoted": moved, "graduated": left, "repeating": len(b.repeat_student_ids)}


@router.post("/users/import")
async def import_users(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(admin)):
    """Bulk create staff/user accounts from CSV: username, full_name, role, phone."""
    import csv, io, secrets
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    rd = csv.DictReader(io.StringIO(raw))
    if not rd.fieldnames or not {"username", "full_name", "role"} <= {f.strip().lower() for f in rd.fieldnames}:
        raise HTTPException(422, "CSV requires columns: username, full_name, role (optional: phone)")
    created = 0
    errors = []
    results = []
    for n, r in enumerate(rd, start=2):
        u_name = str(r.get("username", "")).strip().lower()
        f_name = str(r.get("full_name", "")).strip()
        role = str(r.get("role", "")).strip().lower()
        ph = str(r.get("phone", "")).strip() or None
        if not u_name or not f_name or role not in ("admin", "teacher", "librarian", "student", "parent"):
            errors.append({"row": n, "error": f"Invalid username, name or role '{role}'."})
            continue
        if db.scalar(select(User.id).where(User.username == u_name)):
            errors.append({"row": n, "error": f"Username '{u_name}' already exists."})
            continue
        temp = secrets.token_urlsafe(6)
        u = User(username=u_name, full_name=f_name, role=role, phone=ph,
                 password_hash=hash_password(temp), must_change_password=True)
        db.add(u)
        created += 1
        results.append({"username": u_name, "temporary_password": temp, "role": role})
    db.commit()
    return {"created": created, "errors": errors, "accounts": results}


@router.get("/students")
def all_students(db: Session = Depends(get_db), _: User = Depends(admin)):
    """Full school roster for headmaster."""
    from app.routers.reports import has_cleared_fees
    students = db.scalars(
        select(Student).where(Student.status == "active")
        .order_by(Student.last_name, Student.first_name)
    ).all()
    result = []
    for s in students:
        guardian_link = db.scalar(select(StudentGuardian).where(StudentGuardian.student_id == s.id))
        guardian_name = None
        if guardian_link:
            g = db.get(User, guardian_link.user_id)
            if g:
                guardian_name = g.full_name
        cleared, balances = has_cleared_fees(db, s)
        result.append({
            "id": str(s.id), "admission_no": s.admission_no, "name": s.full_name,
            "gender": s.gender, "form": s.klass.form if s.klass else None,
            "class_name": s.klass.name if s.klass else None,
            "guardian": guardian_name, "fees_cleared": cleared, "fee_balance": balances,
        })
    return result


@router.get("/students/{student_id}/profile")
def student_profile(student_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Full student profile."""
    s = db.get(Student, student_id)
    if not s:
        raise HTTPException(404, "Student not found.")
    if user.role == "teacher":
        assigned = set(db.scalars(select(TeacherAssignment.class_id).where(TeacherAssignment.teacher_id == user.id)).all())
        ct = set(db.scalars(select(ClassGroup.id).where(ClassGroup.class_teacher_id == user.id)).all())
        if s.class_id not in (assigned | ct):
            raise HTTPException(403, "You can only view students in your classes.")
    guards = []
    for sg in db.scalars(select(StudentGuardian).where(StudentGuardian.student_id == s.id)).all():
        g = db.get(User, sg.user_id)
        if g:
            guards.append({"name": g.full_name, "relationship": sg.relationship_type, "phone": g.phone})
    from app.routers.reports import has_cleared_fees
    cleared, balances = has_cleared_fees(db, s)
    recent_marks = []
    for a in db.scalars(select(Assessment).where(Assessment.class_id == s.class_id)
                        .order_by(Assessment.created_at.desc()).limit(20)).all():
        m = db.scalar(select(Mark).where(Mark.assessment_id == a.id, Mark.student_id == s.id))
        subj = db.get(Subject, a.subject_id)
        if m:
            pct = round((m.marks_obtained / a.max_marks) * 100, 1) if m.marks_obtained is not None and a.max_marks else None
            recent_marks.append({"subject": subj.name if subj else "", "title": a.title, "term": a.term,
                                 "year": a.year, "kind": a.kind, "marks": m.marks_obtained, "max": a.max_marks,
                                 "pct": pct, "grade": m.grade, "absent": m.absent})
    return {
        "id": str(s.id), "admission_no": s.admission_no, "name": s.full_name,
        "first_name": s.first_name, "last_name": s.last_name, "gender": s.gender,
        "date_of_birth": str(s.date_of_birth) if s.date_of_birth else None,
        "form": s.klass.form if s.klass else None, "class_name": s.klass.name if s.klass else None,
        "guardians": guards, "fees_cleared": cleared, "fee_balance": balances,
        "recent_marks": recent_marks,
    }
