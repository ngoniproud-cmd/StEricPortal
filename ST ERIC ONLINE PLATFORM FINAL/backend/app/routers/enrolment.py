"""Online enrolment. Public application form + admin review queue + one-click acceptance."""
import re
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import require_roles
from app.files import store, upload_dir
from app.models import Application, ClassGroup, Student, StudentGuardian, User
from app.security import hash_password

public = APIRouter(prefix="/public", tags=["enrolment"])
router = APIRouter(prefix="/applications", tags=["enrolment"])
admin = require_roles("admin")
PHONE = re.compile(r"^\+263\d{9}$")
STATUSES = {"received", "under_review", "accepted", "waitlisted", "declined"}
_hits: dict[str, deque] = defaultdict(deque)


def _limit(ip: str, per_hour: int = 6):
    q, now = _hits[ip], time.time()
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= per_hour:
        raise HTTPException(429, "Too many applications from this connection. Please try again later.")
    q.append(now)


@public.post("/applications", status_code=201)
async def apply(req: Request, first_name: str = Form(..., min_length=1, max_length=100), last_name: str = Form(..., min_length=1, max_length=100),
                gender: str | None = Form(None), date_of_birth: date = Form(...), intake_form: int = Form(...),
                previous_school: str | None = Form(None, max_length=200), subjects_interest: str | None = Form(None, max_length=1000),
                guardian_name: str = Form(..., min_length=2, max_length=200), guardian_phone: str = Form(...), guardian_email: str | None = Form(None, max_length=200),
                website: str = Form(""),  # honeypot: humans leave it empty
                birth_cert: UploadFile | None = File(None), last_report: UploadFile | None = File(None), db: Session = Depends(get_db)):
    ip = req.client.host if req.client else "local"
    if website:
        return {"reference": "SE-0000-000000"}  # pretend success, save nothing
    _limit(ip)
    if not (1 <= intake_form <= 6):
        raise HTTPException(422, "Applications must be for Form 1 through Form 6.")
    if not PHONE.match(guardian_phone):
        raise HTTPException(422, "Guardian phone must look like +263771234567.")
    if not 8 <= (date.today().year - date_of_birth.year) <= 25:
        raise HTTPException(422, "Please check the date of birth.")
    if not birth_cert or not birth_cert.filename:
        raise HTTPException(422, "A certified copy of the birth certificate is required to submit an application.")
    if not last_report or not last_report.filename:
        raise HTTPException(422, "The previous school report card or documentation is required to submit an application.")

    # Subjects of interest are only applicable for Form 5 (A-Level)
    if intake_form != 5:
        subjects_interest = None

    ok = {".pdf", ".png", ".jpg", ".jpeg"}
    app = Application(reference=f"SE-{date.today().year}-{secrets.token_hex(3).upper()}", first_name=first_name.strip(), last_name=last_name.strip(),
                      gender=(gender or "")[:1].upper() or None, date_of_birth=date_of_birth, intake_form=intake_form, previous_school=previous_school,
                      subjects_interest=subjects_interest.strip() if subjects_interest else None, guardian_name=guardian_name.strip(), guardian_phone=guardian_phone, guardian_email=guardian_email)
    app.birth_cert_path = (await store(birth_cert, "applications", ok, 10))[0]
    app.report_path = (await store(last_report, "applications", ok, 10))[0]
    db.add(app)
    db.commit()
    return {"reference": app.reference}


@public.get("/applications/status")
def status(reference: str, phone: str, db: Session = Depends(get_db)):
    a = db.scalar(select(Application).where(Application.reference == reference.strip().upper(), Application.guardian_phone == phone.strip()))
    if not a:
        raise HTTPException(404, "No application matches that reference and phone number.")
    return {"status": a.status, "name": f"{a.first_name} {a.last_name}", "intake_form": a.intake_form}


@router.get("")
def queue(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(admin)):
    stmt = select(Application).order_by(Application.created_at.desc())
    if status:
        stmt = stmt.where(Application.status == status)
    return [{"id": a.id, "reference": a.reference, "name": f"{a.first_name} {a.last_name}", "gender": a.gender, "date_of_birth": a.date_of_birth,
             "intake_form": a.intake_form, "previous_school": a.previous_school, "subjects_interest": a.subjects_interest, "guardian_name": a.guardian_name,
             "guardian_phone": a.guardian_phone, "guardian_email": a.guardian_email, "status": a.status, "notes": a.notes,
             "has_birth_cert": bool(a.birth_cert_path), "has_report": bool(a.report_path), "created_at": a.created_at, "student_id": a.student_id}
            for a in db.scalars(stmt.limit(300))]


@router.get("/{app_id}/file/{which}")
def file(app_id: uuid.UUID, which: str, db: Session = Depends(get_db), _: User = Depends(admin)):
    a = db.get(Application, app_id)
    p = a and {"birth_cert": a.birth_cert_path, "report": a.report_path}.get(which)
    if not p:
        raise HTTPException(404, "No such file.")
    return FileResponse(upload_dir("applications") / p)


class Review(BaseModel):
    status: str
    notes: str | None = None


@router.patch("/{app_id}")
def review(app_id: uuid.UUID, b: Review, db: Session = Depends(get_db), _: User = Depends(admin)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found.")
    if b.status not in STATUSES - {"accepted"}:
        raise HTTPException(422, "Use the Accept action to accept an application.")
    if a.status == "accepted":
        raise HTTPException(409, "This application was already accepted.")
    a.status, a.notes = b.status, b.notes
    db.commit()
    return {"status": a.status}


class Accept(BaseModel):
    class_id: uuid.UUID


@router.post("/{app_id}/accept")
def accept(app_id: uuid.UUID, b: Accept, db: Session = Depends(get_db), _: User = Depends(admin)):
    """Creates the learner and (if needed) a parent account. Temporary password is returned once."""
    a = db.get(Application, app_id)
    k = db.get(ClassGroup, b.class_id)
    if not a or not k:
        raise HTTPException(404, "Application or class not found.")
    if a.status == "accepted":
        raise HTTPException(409, "This application was already accepted.")
    if k.form != a.intake_form:
        raise HTTPException(422, f"This applicant is entering Form {a.intake_form}; choose a Form {a.intake_form} class.")
    n = db.scalar(select(func.count()).select_from(Student).where(Student.admission_no.like(f"SE{k.year}%"))) + 1
    adm = f"SE{k.year}{n:03}"
    while db.scalar(select(Student.id).where(Student.admission_no == adm)):
        n += 1; adm = f"SE{k.year}{n:03}"
    st = Student(admission_no=adm, first_name=a.first_name, last_name=a.last_name, gender=a.gender, date_of_birth=a.date_of_birth, class_id=k.id)
    db.add(st); db.flush()
    parent = db.scalar(select(User).where(User.phone == a.guardian_phone, User.role == "parent"))
    temp = None
    if not parent:
        temp = secrets.token_urlsafe(6)
        uname = f"p{a.guardian_phone[-9:]}"
        parent = User(username=uname, full_name=a.guardian_name, role="parent", phone=a.guardian_phone, password_hash=hash_password(temp), must_change_password=True)
        db.add(parent); db.flush()
    db.add(StudentGuardian(student_id=st.id, user_id=parent.id))
    a.status, a.student_id = "accepted", st.id
    db.commit()
    return {"admission_no": adm, "student_id": st.id, "parent_username": parent.username, "temporary_password": temp}
