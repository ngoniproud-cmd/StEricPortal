"""Consent notices: trips, sports, clinic. Parents only tap Agree or Decline (one-way, no free text)."""
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.deps import current_user, require_roles
from app.models import ClassGroup, Notice, NoticeResponse, Student, StudentGuardian, User
from app.notifications import family_user_ids, notify
from app.routers.reports import children_of

router = APIRouter(prefix="/notices", tags=["notices"])
staff = require_roles("teacher", "admin")


class NoticeIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=5000)
    deadline: date | None = None
    class_id: uuid.UUID | None = None


def _targets(db: Session, n: Notice) -> list[Student]:
    stmt = select(Student).where(Student.status == "active")
    if n.class_id:
        stmt = stmt.where(Student.class_id == n.class_id)
    return list(db.scalars(stmt.order_by(Student.last_name, Student.first_name)))


@router.post("", status_code=201)
def create(b: NoticeIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    if user.role == "teacher" and not b.class_id:
        raise HTTPException(403, "Teachers can send notices to a class. School-wide notices come from the office.")
    if b.deadline and b.deadline < date.today():
        raise HTTPException(422, "The deadline is in the past.")
    n = Notice(**b.model_dump(), created_by=user.id)
    db.add(n); db.flush()
    notify(db, family_user_ids(db, [s.id for s in _targets(db, n)]), f"Please respond: {n.title}", n.body[:120], "/notices")
    db.commit()
    return {"id": n.id}


@router.get("")
def list_notices(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role in ("teacher", "admin"):
        stmt = select(Notice).where(Notice.status == "active")
        if user.role == "teacher":
            stmt = stmt.where(Notice.created_by == user.id)
        out = []
        for n in db.scalars(stmt.order_by(Notice.created_at.desc())):
            t = _targets(db, n)
            r = {x.student_id: x.response for x in db.scalars(select(NoticeResponse).where(NoticeResponse.notice_id == n.id))}
            out.append({"id": n.id, "title": n.title, "body": n.body, "deadline": n.deadline, "audience": db.get(ClassGroup, n.class_id).name if n.class_id else "Whole school",
                        "agree": sum(v == "agree" for v in r.values()), "decline": sum(v == "decline" for v in r.values()), "waiting": len(t) - len(r)})
        return out
    kids = children_of(db, user)
    out = []
    for k in kids:
        resp = {x.notice_id: x.response for x in db.scalars(select(NoticeResponse).where(NoticeResponse.student_id == k.id))}
        for n in db.scalars(select(Notice).where(Notice.status == "active", (Notice.class_id.is_(None)) | (Notice.class_id == k.class_id)).order_by(Notice.created_at.desc())):
            out.append({"id": n.id, "title": n.title, "body": n.body, "deadline": n.deadline, "student": {"id": k.id, "name": k.full_name},
                        "response": resp.get(n.id), "closed": bool(n.deadline and n.deadline < date.today()), "can_respond": user.role == "parent"})
    return out


class Respond(BaseModel):
    student_id: uuid.UUID
    response: str = Field(pattern="^(agree|decline)$")


@router.post("/{nid}/respond")
def respond(nid: uuid.UUID, b: Respond, db: Session = Depends(get_db), user: User = Depends(require_roles("parent"))):
    n = db.get(Notice, nid)
    if not n or n.status != "active":
        raise HTTPException(404, "Notice not found.")
    if not db.scalar(select(StudentGuardian.id).where(StudentGuardian.student_id == b.student_id, StudentGuardian.user_id == user.id)):
        raise HTTPException(403, "You can only respond for your own child.")
    st = db.get(Student, b.student_id)
    if n.class_id and st.class_id != n.class_id:
        raise HTTPException(404, "This notice is not for your child's class.")
    if n.deadline and n.deadline < date.today():
        raise HTTPException(422, "The deadline for this notice has passed.")
    r = db.scalar(select(NoticeResponse).where(NoticeResponse.notice_id == nid, NoticeResponse.student_id == b.student_id))
    if r:
        r.response, r.parent_id = b.response, user.id
    else:
        db.add(NoticeResponse(notice_id=nid, student_id=b.student_id, parent_id=user.id, response=b.response))
    db.commit()
    return {"response": b.response}


def _own_notice(db: Session, nid: uuid.UUID, user: User) -> Notice:
    n = db.get(Notice, nid)
    if not n or (user.role == "teacher" and n.created_by != user.id):
        raise HTTPException(404, "Notice not found.")
    return n


@router.get("/{nid}/tally")
def tally(nid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    n = _own_notice(db, nid, user)
    r = {x.student_id: x for x in db.scalars(select(NoticeResponse).where(NoticeResponse.notice_id == nid))}
    return {"title": n.title, "deadline": n.deadline, "rows": [{"student_id": s.id, "name": s.full_name, "admission_no": s.admission_no,
            "response": r[s.id].response if s.id in r else None, "responded_at": r[s.id].updated_at if s.id in r else None} for s in _targets(db, n)]}


@router.post("/{nid}/remind")
def remind(nid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    n = _own_notice(db, nid, user)
    done = set(db.scalars(select(NoticeResponse.student_id).where(NoticeResponse.notice_id == nid)))
    waiting = [s.id for s in _targets(db, n) if s.id not in done]
    notify(db, family_user_ids(db, waiting), f"Reminder: {n.title}", "Your response is still needed.", "/notices")
    db.commit()
    return {"reminded": len(waiting)}
