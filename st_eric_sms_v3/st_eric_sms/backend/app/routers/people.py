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
from app.models import ClassGroup, Student, StudentGuardian, Subject, TeacherAssignment, User
from app.notifications import notify
from app.security import hash_password, verify_password

router = APIRouter(tags=["people"])
admin = require_roles("admin")
staff = require_roles("teacher", "admin", "librarian")
PHONE = re.compile(r"^\+263\d{9}$")


class UserIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str = Field(min_length=2, max_length=200)
    role: str = Field(pattern="^(admin|teacher|student|parent|librarian)$")
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
    u = User(username=b.username.lower(), full_name=b.full_name.strip(), role=b.role, phone=b.phone,
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
    return [{"id": s.id, "name": s.name, "level": s.level} for s in db.scalars(select(Subject).where(Subject.status == "active").order_by(Subject.name))]


@router.get("/classes/{class_id}/students")
def class_list(class_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and not db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id)):
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
