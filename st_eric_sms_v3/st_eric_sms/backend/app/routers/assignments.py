"""Assignments and homework: teachers post, students submit, teachers mark, planner warns of overload."""
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_roles
from app.files import store, upload_dir
from app.models import (Assessment, Assignment, CalendarEvent, ClassGroup, Student, StudentGuardian, Subject,
                        Submission, TeacherAssignment, User)
from app.notifications import family_user_ids, notify
from app.routers.marks import MarkIn, apply_marks
from app.routers.reports import children_of

router = APIRouter(prefix="/assignments", tags=["assignments"])
staff = require_roles("teacher", "admin")
OVERLOAD = 2  # more than this many items due on one day = warning


def _now():
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _own(db: Session, a: Assignment, user: User):
    if user.role == "teacher" and a.teacher_id != user.id:
        raise HTTPException(403, "This is not your assignment.")


def _shape(a: Assignment, names: dict, sub: Submission | None = None, counts: tuple[int, int] | None = None) -> dict:
    out = {"id": a.id, "title": a.title, "instructions": a.instructions, "due_at": a.due_at, "max_marks": a.max_marks,
           "class": names["class"].get(a.class_id), "class_id": a.class_id, "subject": names["subject"].get(a.subject_id),
           "has_attachment": bool(a.attachment_path), "overdue": _aware(a.due_at) < _now()}
    if sub is not None or counts is None:
        out["submission"] = None if sub is None else {"submitted_at": sub.submitted_at, "late": sub.is_late, "mark": sub.mark, "feedback": sub.feedback}
    if counts:
        out["submitted"], out["total"] = counts
    return out


def _names(db: Session) -> dict:
    return {"class": {c.id: c.name for c in db.scalars(select(ClassGroup))}, "subject": {s.id: s.name for s in db.scalars(select(Subject))}}


@router.post("", status_code=201)
async def create(class_id: uuid.UUID = Form(...), subject_id: uuid.UUID = Form(...), title: str = Form(..., min_length=3, max_length=200),
                 due_at: datetime = Form(...), instructions: str | None = Form(None), max_marks: float | None = Form(None, gt=0, le=1000),
                 file: UploadFile | None = File(None), db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and not db.scalar(select(TeacherAssignment.id).where(
            TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id, TeacherAssignment.subject_id == subject_id)):
        raise HTTPException(403, "This is not one of your classes.")
    a = Assignment(class_id=class_id, subject_id=subject_id, teacher_id=user.id, title=title.strip(), due_at=due_at,
                   instructions=instructions, max_marks=max_marks)
    if file and file.filename:
        a.attachment_path, a.attachment_name = await store(file, "assignments")
    db.add(a); db.flush()
    kids = list(db.scalars(select(Student.id).where(Student.class_id == class_id, Student.status == "active")))
    notify(db, family_user_ids(db, kids), f"New homework: {a.title}", f"Due {_aware(due_at).strftime('%d/%m/%Y')}", "/assignments")
    db.commit()
    return {"id": a.id}


@router.get("")
def list_mine(db: Session = Depends(get_db), user: User = Depends(current_user)):
    names = _names(db)
    if user.role in ("teacher", "admin"):
        stmt = select(Assignment).where(Assignment.status == "active")
        if user.role == "teacher":
            stmt = stmt.where(Assignment.teacher_id == user.id)
        out = []
        for a in db.scalars(stmt.order_by(Assignment.due_at.desc())):
            total = len(list(db.scalars(select(Student.id).where(Student.class_id == a.class_id, Student.status == "active"))))
            done = len(list(db.scalars(select(Submission.id).where(Submission.assignment_id == a.id))))
            out.append(_shape(a, names, counts=(done, total)))
        return out
    kids = children_of(db, user)
    if not kids:
        return []
    out = []
    for k in kids:
        subs = {s.assignment_id: s for s in db.scalars(select(Submission).where(Submission.student_id == k.id))}
        for a in db.scalars(select(Assignment).where(Assignment.class_id == k.class_id, Assignment.status == "active").order_by(Assignment.due_at.desc())):
            row = _shape(a, names, subs.get(a.id))
            row["student"] = {"id": k.id, "name": k.full_name}
            out.append(row)
    return out


@router.get("/planner")
def planner(class_id: uuid.UUID, week_start: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Everything due in a week for one class, with overload warnings."""
    start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    end = start + timedelta(days=7)
    days: dict[str, list] = defaultdict(list)
    names = _names(db)
    for a in db.scalars(select(Assignment).where(Assignment.class_id == class_id, Assignment.status == "active")):
        d = _aware(a.due_at).date()
        if start <= d < end:
            days[d.isoformat()].append({"kind": "homework", "title": a.title, "subject": names["subject"].get(a.subject_id)})
    for e in db.scalars(select(CalendarEvent).where(CalendarEvent.kind == "exam", CalendarEvent.start_date >= start, CalendarEvent.start_date < end)):
        if e.class_id in (None, class_id):
            days[e.start_date.isoformat()].append({"kind": "exam", "title": e.title, "subject": None})
    return {"week_start": start, "days": [{"date": d, "items": it, "overloaded": len(it) > OVERLOAD} for d, it in sorted(days.items())],
            "warnings": [f"{len(it)} items are due on {date.fromisoformat(d).strftime('%d/%m/%Y')}. Consider moving one." for d, it in sorted(days.items()) if len(it) > OVERLOAD]}


@router.get("/{aid}/attachment")
def attachment(aid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = db.get(Assignment, aid)
    if not a or not a.attachment_path:
        raise HTTPException(404, "No attachment.")
    if user.role in ("student", "parent") and a.class_id not in {k.class_id for k in children_of(db, user)}:
        raise HTTPException(403, "Not available to you.")
    return FileResponse(upload_dir("assignments") / a.attachment_path, filename=a.attachment_name)


@router.post("/{aid}/submit")
async def submit(aid: uuid.UUID, text: str | None = Form(None, max_length=10000), file: UploadFile | None = File(None),
                 db: Session = Depends(get_db), user: User = Depends(require_roles("student"))):
    a = db.get(Assignment, aid)
    me = db.scalar(select(Student).where(Student.user_id == user.id))
    if not a or not me or a.class_id != me.class_id or a.status != "active":
        raise HTTPException(404, "Assignment not found.")
    if not (text or "").strip() and not (file and file.filename):
        raise HTTPException(422, "Add some text or attach a file.")
    sub = db.scalar(select(Submission).where(Submission.assignment_id == aid, Submission.student_id == me.id))
    if sub and sub.mark is not None:
        raise HTTPException(423, "This work has already been marked.")
    if not sub:
        sub = Submission(assignment_id=aid, student_id=me.id)
        db.add(sub)
    if file and file.filename:
        sub.file_path, sub.file_name = await store(file, "submissions")
    sub.text = (text or "").strip() or sub.text
    sub.submitted_at = _now()
    sub.is_late = _now() > _aware(a.due_at)   # flagged, never blocked
    notify(db, [a.teacher_id], f"{me.first_name} handed in {a.title}", "Late" if sub.is_late else "", "/assignments")
    db.commit()
    return {"late": sub.is_late}


@router.get("/{aid}/submissions")
def submissions(aid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    a = db.get(Assignment, aid)
    if not a:
        raise HTTPException(404, "Assignment not found.")
    _own(db, a, user)
    subs = {s.student_id: s for s in db.scalars(select(Submission).where(Submission.assignment_id == aid))}
    rows = []
    for st in db.scalars(select(Student).where(Student.class_id == a.class_id, Student.status == "active").order_by(Student.last_name, Student.first_name)):
        s = subs.get(st.id)
        rows.append({"student_id": st.id, "name": st.full_name, "admission_no": st.admission_no, "submitted": bool(s),
                     "late": bool(s and s.is_late), "text": s.text if s else None, "file_name": s.file_name if s else None,
                     "submitted_at": s.submitted_at if s else None, "mark": s.mark if s else None, "feedback": s.feedback if s else None})
    return {"assignment": {"id": a.id, "title": a.title, "max_marks": a.max_marks}, "rows": rows}


@router.get("/{aid}/submissions/{student_id}/file")
def submission_file(aid: uuid.UUID, student_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    a = db.get(Assignment, aid)
    s = db.scalar(select(Submission).where(Submission.assignment_id == aid, Submission.student_id == student_id))
    if not a or not s or not s.file_path:
        raise HTTPException(404, "No file.")
    _own(db, a, user)
    return FileResponse(upload_dir("submissions") / s.file_path, filename=s.file_name)


class MarkIn2(BaseModel):
    mark: float | None = Field(None, ge=0)
    feedback: str | None = Field(None, max_length=2000)


@router.put("/{aid}/submissions/{student_id}/mark")
def mark(aid: uuid.UUID, student_id: uuid.UUID, b: MarkIn2, db: Session = Depends(get_db), user: User = Depends(staff)):
    a = db.get(Assignment, aid)
    s = db.scalar(select(Submission).where(Submission.assignment_id == aid, Submission.student_id == student_id))
    if not a or not s:
        raise HTTPException(404, "Submission not found.")
    _own(db, a, user)
    if a.max_marks is not None and b.mark is not None and b.mark > a.max_marks:
        raise HTTPException(422, f"Cannot exceed {a.max_marks:g}.")
    s.mark, s.feedback, s.marked_by = b.mark, b.feedback, user.id
    st = db.get(Student, student_id)
    notify(db, family_user_ids(db, [student_id]), f"{a.title} has been marked", f"{st.first_name}: feedback is ready.", "/assignments")
    db.commit()
    return {"ok": True}


@router.post("/{aid}/to-assessment")
def to_assessment(aid: uuid.UUID, term: int, year: int, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Copy marked submissions into a Mark Entry assessment (same audit rules apply)."""
    a = db.get(Assignment, aid)
    if not a:
        raise HTTPException(404, "Assignment not found.")
    _own(db, a, user)
    if not a.max_marks:
        raise HTTPException(422, "Set 'out of' marks on the assignment first.")
    if not 1 <= term <= 3:
        raise HTTPException(422, "Term must be 1, 2 or 3.")
    asm = Assessment(class_id=a.class_id, subject_id=a.subject_id, title=a.title, kind="assignment", term=term, year=year, max_marks=a.max_marks)
    db.add(asm); db.flush()
    rows = [MarkIn(student_id=s.student_id, marks_obtained=s.mark) for s in db.scalars(select(Submission).where(Submission.assignment_id == aid, Submission.mark.is_not(None)))]
    res = apply_marks(db, asm, rows, user)
    return {"assessment_id": asm.id, **res}
