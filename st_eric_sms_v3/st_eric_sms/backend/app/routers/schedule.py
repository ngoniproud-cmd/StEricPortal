"""School calendar (with .ics export) and class timetable (with clash detection)."""
import uuid
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_roles
from app.models import CalendarEvent, ClassGroup, Student, Subject, TeacherAssignment, TimetableSlot, User
from app.routers.reports import children_of

router = APIRouter(tags=["schedule"])
admin = require_roles("admin")
staff = require_roles("teacher", "admin")


class EventIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    kind: str = Field("event", pattern="^(term|holiday|exam|sports|event)$")
    start_date: date
    end_date: date | None = None
    form: int | None = Field(None, ge=1, le=6)
    class_id: uuid.UUID | None = None
    description: str | None = Field(None, max_length=2000)


@router.post("/calendar", status_code=201)
def add_event(b: EventIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    if b.end_date and b.end_date < b.start_date:
        raise HTTPException(422, "The end date is before the start date.")
    e = CalendarEvent(**b.model_dump())
    db.add(e); db.commit()
    return {"id": e.id}


@router.delete("/calendar/{eid}")
def remove_event(eid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    e = db.get(CalendarEvent, eid)
    if not e:
        raise HTTPException(404, "Event not found.")
    db.delete(e); db.commit()  # events are plain records, not learner data
    return {"ok": True}


def _visible_events(db: Session, user: User, start: date, end: date) -> list[CalendarEvent]:
    events = db.scalars(select(CalendarEvent).where(CalendarEvent.start_date <= end, (CalendarEvent.end_date >= start) | (CalendarEvent.start_date >= start)).order_by(CalendarEvent.start_date)).all()
    if user.role in ("admin", "teacher", "librarian"):
        return list(events)
    kids = children_of(db, user)
    classes = {k.class_id for k in kids}
    forms = {db.get(ClassGroup, c).form for c in classes if c}
    return [e for e in events if (e.class_id is None and e.form is None) or e.class_id in classes or (e.form in forms)]


@router.get("/calendar")
def events(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    start = start or date.today().replace(day=1)
    end = end or start + timedelta(days=92)
    return [{"id": e.id, "title": e.title, "kind": e.kind, "start_date": e.start_date, "end_date": e.end_date, "description": e.description,
             "form": e.form, "class_id": e.class_id} for e in _visible_events(db, user, start, end)]


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


@router.get("/calendar/ics", response_class=PlainTextResponse)
def ics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//St Eric High School//SMS//EN", "CALSCALE:GREGORIAN"]
    for e in _visible_events(db, user, date.today() - timedelta(days=30), date.today() + timedelta(days=400)):
        last = (e.end_date or e.start_date) + timedelta(days=1)  # DTEND is exclusive for all-day events
        lines += ["BEGIN:VEVENT", f"UID:{e.id}@steric.local", f"DTSTAMP:{datetime.utcnow():%Y%m%dT%H%M%SZ}",
                  f"DTSTART;VALUE=DATE:{e.start_date:%Y%m%d}", f"DTEND;VALUE=DATE:{last:%Y%m%d}", f"SUMMARY:{_esc(e.title)}"]
        if e.description:
            lines.append(f"DESCRIPTION:{_esc(e.description)}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return PlainTextResponse("\r\n".join(lines) + "\r\n", media_type="text/calendar", headers={"Content-Disposition": 'attachment; filename="st-eric.ics"'})


# ---------------- timetable ----------------
class SlotIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    day: int = Field(ge=1, le=5)
    period: int = Field(ge=1, le=10)
    room: str | None = Field(None, max_length=30)


@router.post("/timetable", status_code=201)
def add_slot(b: SlotIn, db: Session = Depends(get_db), _: User = Depends(admin)):
    """Rejects a slot that double-books the class, the teacher or the room."""
    same = list(db.scalars(select(TimetableSlot).where(TimetableSlot.day == b.day, TimetableSlot.period == b.period)))
    names = {c.id: c.name for c in db.scalars(select(ClassGroup))}
    for s in same:
        if s.class_id == b.class_id:
            raise HTTPException(409, "This class already has a lesson in that period.")
        if s.teacher_id == b.teacher_id:
            raise HTTPException(409, f"That teacher is already teaching {names.get(s.class_id)} in that period.")
        if b.room and s.room and s.room.lower() == b.room.lower():
            raise HTTPException(409, f"Room {b.room} is already used by {names.get(s.class_id)} in that period.")
    t = db.get(User, b.teacher_id)
    if not t or t.role != "teacher":
        raise HTTPException(422, "Choose a teacher.")
    slot = TimetableSlot(**b.model_dump())
    db.add(slot); db.commit()
    return {"id": slot.id}


@router.delete("/timetable/{sid}")
def remove_slot(sid: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    s = db.get(TimetableSlot, sid)
    if not s:
        raise HTTPException(404, "Lesson not found.")
    db.delete(s); db.commit()
    return {"ok": True}


def _grid(db: Session, class_id: uuid.UUID) -> list[dict]:
    subs = {s.id: s.name for s in db.scalars(select(Subject))}
    tch = {u.id: u.full_name for u in db.scalars(select(User).where(User.role == "teacher"))}
    return [{"id": s.id, "day": s.day, "period": s.period, "subject": subs.get(s.subject_id), "teacher": tch.get(s.teacher_id), "room": s.room}
            for s in db.scalars(select(TimetableSlot).where(TimetableSlot.class_id == class_id).order_by(TimetableSlot.day, TimetableSlot.period))]


@router.get("/timetable/class/{class_id}")
def class_timetable(class_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role in ("student", "parent") and class_id not in {k.class_id for k in children_of(db, user)}:
        raise HTTPException(403, "Not available to you.")
    if user.role == "teacher" and not db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.class_id == class_id)):
        raise HTTPException(403, "This is not one of your classes.")
    return _grid(db, class_id)


@router.get("/timetable/mine")
def my_timetable(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Teacher: their own week. Student/parent: each child's class timetable."""
    if user.role == "teacher":
        subs = {s.id: s.name for s in db.scalars(select(Subject))}
        cls = {c.id: c.name for c in db.scalars(select(ClassGroup))}
        return [{"title": "My week", "slots": [{"id": s.id, "day": s.day, "period": s.period, "subject": subs.get(s.subject_id), "class": cls.get(s.class_id), "room": s.room}
                for s in db.scalars(select(TimetableSlot).where(TimetableSlot.teacher_id == user.id).order_by(TimetableSlot.day, TimetableSlot.period))]}]
    return [{"title": k.full_name, "slots": _grid(db, k.class_id)} for k in children_of(db, user) if k.class_id]
