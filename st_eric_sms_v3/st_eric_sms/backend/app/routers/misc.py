"""Announcements, notifications, attendance, insights, AI drafts, dashboards."""
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.ai import draft_comment
from app.db import get_db
from app.deps import current_user, require_roles
from app.insights import attendance_rate, class_insights
from app.models import (Announcement, Assessment, Attendance, ClassGroup, LibraryItem, Notification, ReportComment,
                        Student, StudentGuardian, TeacherAssignment, User)
from app.notifications import family_user_ids, notify, users_with_role
from app.report_card import build_report
from app.routers.reports import children_of

router = APIRouter(tags=["school"])
staff = require_roles("teacher", "admin")


# ---------- announcements (one-way) ----------
class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)
    audience: str = Field("all", pattern="^(all|students|parents|teachers)$")


@router.post("/announcements", status_code=201)
def post_announcement(b: AnnouncementIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and b.audience in ("all", "teachers"):
        raise HTTPException(403, "Teachers can post to students or parents. School-wide notices come from the office.")
    a = Announcement(title=b.title.strip(), body=b.body.strip(), audience=b.audience, published_by=user.id)
    db.add(a)
    roles = {"all": ("student", "parent", "teacher"), "students": ("student",), "parents": ("parent",), "teachers": ("teacher",)}[b.audience]
    notify(db, users_with_role(db, *roles), a.title, a.body[:140], "/announcements")
    db.commit()
    return {"id": a.id}


@router.get("/announcements")
def list_announcements(db: Session = Depends(get_db), user: User = Depends(current_user)):
    mine = {"student": "students", "parent": "parents", "teacher": "teachers"}.get(user.role)
    stmt = select(Announcement).where(Announcement.status == "published")
    if user.role != "admin":
        stmt = stmt.where(Announcement.audience.in_(["all", mine]))
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    return [{"id": a.id, "title": a.title, "body": a.body, "audience": a.audience, "by": names.get(a.published_by),
             "created_at": a.created_at} for a in db.scalars(stmt.order_by(Announcement.created_at.desc()).limit(50))]


# ---------- notifications ----------
@router.get("/notifications")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(30)).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {"unread": unread, "items": [{"id": n.id, "title": n.title, "body": n.body, "link": n.link, "read": n.is_read, "created_at": n.created_at} for n in rows]}


@router.post("/notifications/read-all")
def read_all(db: Session = Depends(get_db), user: User = Depends(current_user)):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))):
        n.is_read = True
    db.commit()
    return {"ok": True}


# ---------- attendance ----------
class RegisterRow(BaseModel):
    student_id: uuid.UUID
    status: str = Field(pattern="^(present|absent|late|excused)$")


def _can_mark(db: Session, user: User, class_id: uuid.UUID):
    if user.role == "teacher":
        ok = db.scalar(select(ClassGroup.id).where(ClassGroup.id == class_id, ClassGroup.class_teacher_id == user.id)) or \
             db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id))
        if not ok:
            raise HTTPException(403, "This is not one of your classes.")


@router.get("/attendance/class/{class_id}")
def get_register(class_id: uuid.UUID, day: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    day = day or date.today()
    saved = {a.student_id: a.status for a in db.scalars(select(Attendance).where(Attendance.day == day))}
    students = db.scalars(select(Student).where(Student.class_id == class_id, Student.status == "active").order_by(Student.last_name, Student.first_name)).all()
    return {"day": day, "rows": [{"student_id": s.id, "name": s.full_name, "admission_no": s.admission_no, "status": saved.get(s.id, "present")} for s in students],
            "already_marked": any(s.id in saved for s in students)}


@router.put("/attendance/class/{class_id}")
def save_register(class_id: uuid.UUID, rows: list[RegisterRow], day: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    day = day or date.today()
    if day > date.today():
        raise HTTPException(422, "You cannot mark attendance for a future date.")
    valid = set(db.scalars(select(Student.id).where(Student.class_id == class_id)))
    existing = {a.student_id: a for a in db.scalars(select(Attendance).where(Attendance.day == day, Attendance.student_id.in_(valid)))}
    newly_absent = []
    for r in rows:
        if r.student_id not in valid:
            raise HTTPException(422, "A student in the list is not in this class.")
        a = existing.get(r.student_id)
        if a:
            if a.status != "absent" and r.status == "absent":
                newly_absent.append(r.student_id)
            a.status, a.marked_by = r.status, user.id
        else:
            db.add(Attendance(student_id=r.student_id, day=day, status=r.status, marked_by=user.id))
            if r.status == "absent":
                newly_absent.append(r.student_id)
    for sid in newly_absent:
        st = db.get(Student, sid)
        notify(db, family_user_ids(db, [sid]), f"{st.first_name} was marked absent", day.strftime("%d/%m/%Y"), "/attendance")
    db.commit()
    return {"saved": len(rows), "absent": len(newly_absent)}


# ---------- insights + AI ----------
@router.get("/insights/class/{class_id}")
def insights(class_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    _can_mark(db, user, class_id)
    return class_insights(db, class_id, term, year)


@router.post("/ai/report-comment")
def ai_comment(student_id: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Returns a DRAFT. Nothing is saved until the teacher edits and saves it."""
    st = db.get(Student, student_id)
    if not st:
        raise HTTPException(404, "Student not found.")
    _can_mark(db, user, st.class_id)
    d = build_report(db, student_id, term, year)
    return draft_comment(st.first_name, d["level"], d["rows"], d["overall"], d["position"], d["class_size"], attendance_rate(db, student_id))


# ---------- dashboards ----------
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    base = {"role": user.role, "name": user.full_name, "unread": unread}
    if user.role == "admin":
        today = date.today()
        marked = db.scalar(select(func.count()).select_from(Attendance).where(Attendance.day == today))
        present = db.scalar(select(func.count()).select_from(Attendance).where(Attendance.day == today, Attendance.status.in_(["present", "late"])))
        return {**base, "students": db.scalar(select(func.count()).select_from(Student).where(Student.status == "active")),
                "teachers": db.scalar(select(func.count()).select_from(User).where(User.role == "teacher", User.status == "active")),
                "attendance_today": round(100 * present / marked) if marked else None,
                "pending_uploads": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "pending")),
                "published_reports": db.scalar(select(func.count()).select_from(ReportComment).where(ReportComment.published.is_(True)))}
    if user.role == "librarian":
        return {**base, "pending_uploads": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "pending")),
                "approved": db.scalar(select(func.count()).select_from(LibraryItem).where(LibraryItem.status == "approved"))}
    if user.role == "teacher":
        classes = db.scalar(select(func.count(func.distinct(TeacherAssignment.class_id))).where(TeacherAssignment.teacher_id == user.id))
        return {**base, "classes": classes}
    kids = children_of(db, user)
    return {**base, "children": [{"id": k.id, "name": k.full_name, "class": k.klass.name if k.klass else None, "attendance": attendance_rate(db, k.id)} for k in kids]}
